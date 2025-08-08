/**
 * This module provides centralised utility functions for overlay coordination.
 * It manages the orchestration of overlay rendering, tracking, and lifecycle management
 * across multiple tokens and overlay types.
 */

import type { OverlayRenderingService } from '../../../presentation/services/OverlayRenderingService.js';
import type { OverlayDefinition, TargetScope, OverlayTriggers } from '../../../domain/interfaces/OverlayDefinition.js';
import type { OverlayRenderContext } from '../../../domain/interfaces/OverlayRenderContext.js';
import type { FoundryLogger } from '../../../../lib/log4foundry/log4foundry.js';
import type { OverlayContextBuilderRegistry } from '../../registries/OverlayContextBuilderRegistry.js';
import type { OverlayContextBuilder } from '../../../domain/interfaces/OverlayContextBuilder.js';
import type { Actor } from '../../../domain/entities/Actor.js';

import { Token } from '../../../domain/entities/Token.js';
import { LoggerFactory } from '../../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../../config.js';
import { RangeFinderService } from '../../../domain/services/RangeFinderService.js';
import { Weapon } from '../../../domain/value-objects/Weapon.js';
import { TokenRepository } from '../../../infrastructure/repositories/TokenRepository.js';
import { UserRepository } from '../../../infrastructure/repositories/UserRepository.js';
import { CoverCalculator } from '../../../domain/services/CoverCalculator.js';
import { ObstacleRepository } from '../../../infrastructure/repositories/ObstacleRepository.js';

export class OverlayCoordinatorHelper {
    private readonly logger: FoundryLogger;
    private readonly renderedOverlays = new Map<string, Set<string>>();
    // Cache for batch-calculated cover results
    private coverResultsCache = new Map<string, Map<string, number>>();

    constructor(
        private readonly overlayRenderer: OverlayRenderingService,
    ) {
        this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.OverlayCoordinatorHelper`);
    }

    // Public API - Overlay Processing

    /**
     * Processes overlays grouped by their target scope and renders them.
     * 
     * This is the main entry point for rendering overlays. It groups overlays
     * by scope, determines target tokens for each scope, and renders the
     * appropriate overlays on each token.
     */
    async processOverlaysByScope(
        overlays: OverlayDefinition[],
        contextBuilderRegistry: OverlayContextBuilderRegistry,
        triggerType?: keyof OverlayTriggers,
        dragTokenId?: string
    ): Promise<Array<{ targetTokens: Token[], overlays: OverlayDefinition[] }>> {
        const overlayGroups = this.groupOverlaysByTargetScope(overlays, triggerType);
        const processedGroups: Array<{ targetTokens: Token[], overlays: OverlayDefinition[] }> = [];
        const tokenRepository = new TokenRepository();
        const allTokens = tokenRepository.getAll();
        const previewToken = dragTokenId
            ? tokenRepository.getPreviewToken(dragTokenId)
            : undefined;

        // Determine source token for cover calculations
        let sourceToken: Token | undefined;
        if (previewToken) {
            sourceToken = previewToken;
        } else {
            sourceToken = allTokens.find(token => token.isControlledByCurrentUser);
        }

        // Pre-calculate cover if needed (check if any overlay needs cover data)
        const needsCoverCalculation = overlays.some(overlay =>
            overlay.id === 'token-info'
        );

        if (needsCoverCalculation && sourceToken) {
            await this.preCalculateCoverForAllTargets(sourceToken, allTokens, !!previewToken);
        }

        for (const [targetScope, scopeOverlays] of overlayGroups.entries()) {
            const targetTokens = this.getTargetTokens(
                allTokens,
                targetScope as TargetScope,
                previewToken
            );

            if (targetTokens.length === 0) {
                continue;
            }

            const preparedOverlays = this.prepareOverlaysWithContextBuilders(
                scopeOverlays,
                contextBuilderRegistry
            );

            await this.requestOverlayRendering(
                targetTokens,
                preparedOverlays,
                (overlayId, targetToken) =>
                    this.buildContextForOverlay(
                        overlayId,
                        targetToken,
                        preparedOverlays,
                        contextBuilderRegistry,
                        sourceToken
                    )
            );

            processedGroups.push({
                targetTokens,
                overlays: scopeOverlays
            });
        }

        return processedGroups;
    }

    /**
     * Pre-calculates cover for all potential targets using batch calculation.
     * Results are cached for use during context building.
     */
    private async preCalculateCoverForAllTargets(
        sourceToken: Token,
        allTokens: Token[],
        invalidateAttacker: boolean
    ): Promise<void> {
        const cacheKey = sourceToken.id;

        this.coverResultsCache.delete(cacheKey);

        // Filter to valid targets (visible, not hidden, not the attacker)
        const validTargets = allTokens.filter(token =>
            token.visible &&
            !token.hidden &&
            token.id !== sourceToken.id
        );

        if (validTargets.length === 0) {
            return;
        }

        // Get all potential obstacles
        const obstacleRepository = new ObstacleRepository();
        const allObstacles = obstacleRepository.getAll();

        // Base obstacle filtering - remove attacker and invisible/hidden tokens
        const baseObstacles = allObstacles.filter(obstacle => {
            // Exclude the attacker from obstacles
            if (obstacle.id === sourceToken.id) {
                return false;
            }

            // Check if obstacle is a token and apply visibility rules
            if ('visible' in obstacle && 'hidden' in obstacle) {
                // It's a token - check visibility
                if (!obstacle.visible || obstacle.hidden) {
                    return false;
                }
            }

            // Keep all other obstacles (walls, visible tokens including other targets)
            return true;
        });

        // Calculate cover for each target with per-target obstacle filtering
        const resultMap = new Map<string, number>();
        const coverCalculator = new CoverCalculator();

        for (const target of validTargets) {
            // Filter out only this specific target from obstacles
            const obstaclesForTarget = baseObstacles.filter(obstacle =>
                obstacle.id !== target.id
            );

            // Calculate cover for this specific target
            const result = coverCalculator.calculateCover(
                sourceToken,
                target,
                obstaclesForTarget,
                invalidateAttacker
            );

            resultMap.set(target.id, result.percentage);
        }

        this.coverResultsCache.set(cacheKey, resultMap);
    }

    // Public API - Token Filtering

    /**
     * Gets target tokens based on the specified scope.
     */
    getTargetTokens(
        allTokens: Token[],
        targetScope: TargetScope,
        previewToken?: Token
    ): Token[] {
        const targetTokens = this.determineTargetTokens(
            allTokens,
            targetScope,
            previewToken,
        );

        return targetTokens;
    }

    // Public API - Overlay Lifecycle Management

    /**
     * Hides all tracked overlays across all tokens.
     * Clears the tracking state after hiding.
     */
    async hideAllTrackedOverlays(): Promise<void> {
        const overlayCount = this.renderedOverlays.size;

        this.logger.debug('Hiding all tracked overlays', { overlayCount });

        const overlayTypes = this.getAllTrackedOverlayTypes();

        for (const overlayTypeId of overlayTypes) {
            this.overlayRenderer.hideAllOverlaysOfType(overlayTypeId);
        }

        this.renderedOverlays.clear();
        this.clearCoverCache(); // Clear cover cache when hiding overlays
    }

    /**
     * Hides overlays for specific tokens.
     */
    async hideOverlaysForTokens(tokenIds: string[]): Promise<void> {
        this.logger.debug('Hiding overlays for tokens', { tokenIds });

        for (const tokenId of tokenIds) {
            const overlayIds = this.renderedOverlays.get(tokenId);

            if (!overlayIds) {
                continue;
            }

            for (const overlayId of overlayIds) {
                this.overlayRenderer.hideTokenOverlay(overlayId, tokenId);
            }

            this.renderedOverlays.delete(tokenId);
        }
    }

    // Public API - Tracking State

    /**
     * Gets tracked overlay IDs for a specific token.
     */
    getTrackedOverlays(tokenId: string): Set<string> {
        return this.renderedOverlays.get(tokenId) || new Set();
    }

    /**
     * Gets all unique overlay types currently tracked.
     */
    getAllTrackedOverlayTypes(): Set<string> {
        const overlayTypes = new Set<string>();

        for (const overlayIds of this.renderedOverlays.values()) {
            overlayIds.forEach(id => overlayTypes.add(id));
        }

        return overlayTypes;
    }

    /**
     * Clears all overlay tracking without hiding overlays.
     * Use with caution - overlays will remain rendered but untracked.
     */
    clearTracking(): void {
        this.logger.debug('Clearing overlay tracking', {
            tokenCount: this.renderedOverlays.size
        });

        this.renderedOverlays.clear();
    }

    /**
     * Gets the current render tracking state.
     */
    getRenderTrackingState(): Array<{ tokenId: string; overlayIds: string[] }> {
        return Array.from(this.renderedOverlays.entries()).map(([tokenId, overlayIds]) => ({
            tokenId,
            overlayIds: Array.from(overlayIds)
        }));
    }

    // Public API - Context Building

    /**
     * Prepares overlays with their context builders.
     */
    prepareOverlaysWithContextBuilders(
        overlays: OverlayDefinition[],
        contextBuilderRegistry: OverlayContextBuilderRegistry
    ): OverlayDefinition[] {
        return overlays.map(overlay => {

            if (!overlay.contextBuilder) {
                const builder = this.getContextBuilder(overlay, contextBuilderRegistry);
                if (builder) {
                    return { ...overlay, contextBuilder: builder };
                }
                this.logger.warn(`Overlay ${overlay.id} does not have a context builder defined`);
            }
            return overlay;
        }).filter(overlay => overlay.contextBuilder);
    }

    /**
     * Builds the render context for a specific overlay.
     */
    buildContextForOverlay(
        overlayId: string,
        targetToken: Token,
        overlaysWithBuilders: OverlayDefinition[],
        contextBuilderRegistry: OverlayContextBuilderRegistry,
        sourceToken?: Token
    ): OverlayRenderContext {
        const overlay = overlaysWithBuilders.find(o => o.id === overlayId);

        if (!overlay) {
            throw new Error(`Overlay definition not found for ${overlayId}`);
        }

        const contextBuilder = overlay.contextBuilder ||
            this.getContextBuilder(overlay, contextBuilderRegistry);

        if (!contextBuilder) {
            throw new Error(`No context builder found for overlay ${overlayId}`);
        }

        const contextOptions = this.buildContextOptions(
            overlayId,
            targetToken,
            sourceToken
        );

        return contextBuilder.buildContext(targetToken, overlay, contextOptions);
    }

    // Public API - Rendering

    /**
     * Requests overlay rendering on specified tokens.
     */
    async requestOverlayRendering(
        targetTokens: Token[],
        matchingOverlays: OverlayDefinition[],
        contextBuilder: (overlayId: string, token: Token) => OverlayRenderContext
    ): Promise<void> {
        // Process each target token
        for (const targetToken of targetTokens) {
            await this.renderOverlaysOnToken(
                targetToken,
                matchingOverlays,
                contextBuilder
            );
        }
    }

    // Private Methods - Overlay Grouping

    /**
     * Groups overlays by their target scope.
     */
    private groupOverlaysByTargetScope(
        overlays: OverlayDefinition[],
        triggerType?: Extract<keyof OverlayTriggers, string>
    ): Map<string, OverlayDefinition[]> {
        const groups = new Map<string, OverlayDefinition[]>();

        for (const overlay of overlays) {
            let scope: TargetScope = 'all'; // Default fallback scope

            if (triggerType && overlay.triggers && triggerType in overlay.triggers) {
                const trigger = overlay.triggers[triggerType];

                if (trigger && typeof trigger === 'object' && 'scope' in trigger && trigger.scope) {
                    scope = trigger.scope;
                }
            }

            if (!groups.has(scope)) {
                groups.set(scope, []);
            }

            groups.get(scope)!.push(overlay);
        }

        return groups;
    }

    // Private Methods - Token Filtering

    /**
     * Determines target tokens based on scope criteria.
     */
    private determineTargetTokens(
        allTokens: Token[],
        targetScope: TargetScope,
        previewToken?: Token
    ): Token[] {
        let filteredTokens: Token[];

        switch (targetScope) {
            case 'visible':
                filteredTokens = allTokens.filter(token => token.visible);
                break;

            case 'visible-and-not-hidden':
                filteredTokens = allTokens.filter(token => token.visible && !token.hidden);
                break;

            case 'controlled':
                filteredTokens = allTokens.filter(token => token.isControlledByCurrentUser);
                break;

            case 'owned':
                filteredTokens = allTokens.filter(token =>
                    token.isOwnedByCurrentUser && token.visible && !token.hidden
                );
                break;

            case 'all':
                filteredTokens = allTokens;
                break;

            case 'non-controlled':
                filteredTokens = allTokens.filter(token => token.visible && !token.hidden && !token.isControlledByCurrentUser);
                break;

            case 'preview':
                if (previewToken) {
                    filteredTokens = [previewToken];
                } else {
                    this.logger.warn('Preview token requested but none provided');
                    filteredTokens = [];
                }
                break;

            default:
                this.logger.warn(`Unknown target scope: ${targetScope}, defaulting to visible`);
                filteredTokens = allTokens.filter(token => token.visible);
        }

        return filteredTokens;
    }

    // Private Methods - Rendering

    /**
     * Renders overlays on a specific token.
     */
    private async renderOverlaysOnToken(
        targetToken: Token,
        overlays: OverlayDefinition[],
        contextBuilder: (overlayId: string, token: Token) => OverlayRenderContext
    ): Promise<void> {
        for (const overlay of overlays) {
            const context = contextBuilder(overlay.id, targetToken);

            this.overlayRenderer.renderTokenOverlay(context);
            this.trackRenderedOverlay(targetToken.id, overlay.id);
        }
    }

    /**
     * Tracks a rendered overlay for lifecycle management.
     */
    private trackRenderedOverlay(tokenId: string, overlayId: string): void {
        if (!this.renderedOverlays.has(tokenId)) {
            this.renderedOverlays.set(tokenId, new Set());
        }

        this.renderedOverlays.get(tokenId)!.add(overlayId);
    }

    // Private Methods - Context Building

    /**
     * Gets the context builder for an overlay.
     */
    private getContextBuilder(
        overlay: OverlayDefinition,
        contextBuilderRegistry: OverlayContextBuilderRegistry
    ): OverlayContextBuilder | undefined {
        // Use overlay's own context builder if defined
        if (overlay.contextBuilder) {
            return overlay.contextBuilder;
        }

        // Fall back to registry
        return contextBuilderRegistry.get(overlay.id);
    }

    /**
     * Builds context options for specific overlay types.
     */
    private buildContextOptions(
        overlayId: string,
        targetToken: Token,
        sourceToken?: Token,
    ): any {
        switch (overlayId) {
            case 'facing-arc':
                const user = new UserRepository().getCurrentUser();
                return {
                    isGM: user?.isGM,
                    userColour: user?.colour
                };

            case 'actor-info':
                const ownedByCurrentUserTokens = new TokenRepository().getOwnedByCurrentUser();
                const ownedByCurrentUserActors = ownedByCurrentUserTokens
                    .map(token => token.actor)
                    .filter((actor): actor is Actor => actor !== null);

                return {
                    ownedByCurrentUserActors
                };

            case 'token-info': {
                if (!sourceToken) {
                    this.logger.debug('No controlled token found for token-info overlay');
                    return {};
                }

                const rangeResult = new RangeFinderService().distanceTo(sourceToken, targetToken);
                const sourceActor = sourceToken.actor;

                // Determine font colour based on weapon ranges
                const rangeBackgroundColour = this.determineBackgroundColourByRange(
                    sourceActor?.equippedWeapons ?? [],
                    rangeResult.distance
                );


                const displayRange = rangeResult.distance !== undefined && rangeResult.units !== undefined
                    ? `${rangeResult.distance.toFixed(1)} ${rangeResult.units}`
                    : null;


                // Include cover percentage if available
                const coverMap = this.coverResultsCache.get(sourceToken.id);
                const coverPercentage = coverMap?.get(targetToken.id) ?? null;

                const displayCover = coverPercentage !== null
                    ? `${coverPercentage}%`
                    : null;

                return {
                    rangeIcon: `modules/${MODULE_ID}/assets/images/icons/range.webp`,
                    displayRange,
                    rangeBackgroundColour: rangeBackgroundColour,
                    rangeBackgroundOpacity: 0.6,
                    coverIcon: `modules/${MODULE_ID}/assets/images/icons/cover.webp`,
                    displayCover: displayCover,
                    coverBackgroundColour: '#8F6300',
                    coverBackgroundOpacity: coverPercentage ? coverPercentage / 100 : 0,
                };
            }


            default:
                return {};
        }
    }

    /**
    * Determines the font colour based on weapon ranges and distance.
    */
    private determineBackgroundColourByRange(equippedWeapons: readonly Weapon[], distance: number): string | null {

        if (equippedWeapons.length === 0) {
            return null;
        }

        const inEffectiveRange = equippedWeapons.some(weapon =>
            weapon.isWithinEffectiveRange(distance)
        );

        if (inEffectiveRange) {
            return '#5D1313';
        }

        const inRange = equippedWeapons.some(weapon =>
            weapon.isWithinRange(distance)
        );

        if (inRange) {
            return '#134F5D';
        }

        return null;
    }

    /**
     * Clears the cover results cache.
     * Call when the scene changes or tokens are added/removed.
     */
    clearCoverCache(): void {
        this.coverResultsCache.clear();
    }
}