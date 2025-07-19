/**
 * This module provides centralised utility functions for overlay coordination.
 * It manages the orchestration of overlay rendering, tracking, and lifecycle management
 * across multiple tokens and overlay types.
 */

import type { OverlayRenderingService } from '../../../presentation/services/OverlayRenderingService.js';
import type { OverlayDefinition, TargetScope, OverlayTriggers } from '../../../domain/interfaces/OverlayDefinition.js';
import type { OverlayRenderContext } from '../../../domain/interfaces/OverlayRenderContext.js';
import type { FoundryLogger } from '../../../../lib/log4foundry/log4foundry.js';
import type { OverlayRegistry } from '../../registries/OverlayRegistry.js';
import type { OverlayContextBuilderRegistry } from '../../registries/OverlayContextBuilderRegistry.js';
import type { OverlayContextBuilder } from '../../../domain/interfaces/OverlayContextBuilder.js';
import type { Actor } from '../../../domain/entities/Actor.js';

import { Token } from '../../../domain/entities/Token.js';
import { LoggerFactory } from '../../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../../config.js';

export class OverlayCoordinatorHelper {
    private readonly logger: FoundryLogger;
    private readonly renderedOverlays = new Map<string, Set<string>>();

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
        allTokens: Token[],
        isGM: boolean,
        userColour: string,
        contextBuilderRegistry: OverlayContextBuilderRegistry,
        triggerType?: keyof OverlayTriggers,
        actors?: Actor[],
        previewToken?: Token
    ): Promise<Array<{ targetTokens: Token[], overlays: OverlayDefinition[] }>> {
        const overlayGroups = this.groupOverlaysByTargetScope(overlays, triggerType);
        const processedGroups: Array<{ targetTokens: Token[], overlays: OverlayDefinition[] }> = [];

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
                isGM,
                (overlayId, targetToken, isGM) =>
                    this.buildContextForOverlay(
                        overlayId,
                        targetToken,
                        isGM,
                        userColour,
                        preparedOverlays,
                        contextBuilderRegistry,
                        actors
                    )
            );

            processedGroups.push({
                targetTokens,
                overlays: scopeOverlays
            });
        }

        return processedGroups;
    }

    // Public API - Overlay Filtering

    /**
     * Filters overlays by trigger type.
     */
    // filterOverlaysByTrigger(
    //     trigger: keyof OverlayTriggers,
    //     overlayRegistry: OverlayRegistry
    // ): OverlayDefinition[] {
    //     return overlayRegistry.getAll().filter(overlay => {
    //         const triggerValue = overlay.triggers[trigger];

    //         if (!triggerValue) {
    //             return false;
    //         }

    //         // Handle trigger configs (objects with scope property)
    //         if (typeof triggerValue === 'object' && triggerValue !== null && !Array.isArray(triggerValue)) {
    //             // For keyPress with keys array
    //             if (trigger === 'keyPress' && 'keys' in triggerValue) {
    //                 return (triggerValue.keys?.length ?? 0) > 0;
    //             }

    //             // Any object trigger config is considered enabled
    //             return true;
    //         }

    //         // Handle modifier key arrays - non-empty array means enabled
    //         if (Array.isArray(triggerValue)) {
    //             return triggerValue.length > 0;
    //         }

    //         // Handle function predicates - presence means enabled
    //         if (typeof triggerValue === 'function') {
    //             return true;
    //         }

    //         return false;
    //     });

    // }

    // /**
    //  * Filters overlays by a specific key press trigger.
    //  */
    // filterOverlaysByTriggerKey(
    //     triggerKey: string,
    //     overlayRegistry: OverlayRegistry
    // ): OverlayDefinition[] {
    //     return overlayRegistry.getAll().filter(overlay => {
    //         const keyPressTrigger = overlay.triggers.keyPress;

    //         if (!keyPressTrigger) {
    //             return false;
    //         }

    //         // Handle boolean keyPress (shouldn't have specific keys)
    //         if (typeof keyPressTrigger === 'boolean') {
    //             return false;
    //         }

    //         // Check if it's a KeyPressTriggerConfig with keys
    //         if ('keys' in keyPressTrigger && keyPressTrigger.keys?.length) {
    //             return keyPressTrigger.keys.includes(triggerKey.toLowerCase());
    //         }

    //         return false;
    //     });
    // }

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

        this.logger.debug('Tokens categorised for overlay rendering', {
            targetCount: targetTokens.length,
            targetingScope: targetScope
        });

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
        isGM: boolean,
        userColour: string,
        overlaysWithBuilders: OverlayDefinition[],
        contextBuilderRegistry: OverlayContextBuilderRegistry,
        actors?: Actor[]
    ): OverlayRenderContext {
        const overlay = overlaysWithBuilders.find(o => o.id === overlayId);
        const contextBuilder = overlay?.contextBuilder ||
            this.getContextBuilder({ id: overlayId } as OverlayDefinition, contextBuilderRegistry);

        if (!contextBuilder) {
            throw new Error(`No context builder found for overlay ${overlayId}`);
        }

        const contextOptions = this.buildContextOptions(
            overlayId,
            isGM,
            userColour,
            actors
        );

        return contextBuilder.buildContext(targetToken, contextOptions);
    }

    // Public API - Rendering

    /**
     * Requests overlay rendering on specified tokens.
     */
    async requestOverlayRendering(
        targetTokens: Token[],
        matchingOverlays: OverlayDefinition[],
        isGM: boolean,
        contextBuilder: (overlayId: string, token: Token, isGM: boolean) => OverlayRenderContext
    ): Promise<void> {
        // Process each target token
        for (const targetToken of targetTokens) {
            await this.renderOverlaysOnToken(
                targetToken,
                matchingOverlays,
                isGM,
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

        this.logger.debug('Overlays grouped by scope', {
            triggerType,
            groups: Array.from(groups.entries()).map(([scope, overlays]) => ({
                scope,
                overlayIds: overlays.map(o => o.id),
                count: overlays.length
            }))
        });

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
        this.logger.debug('Determining target tokens', {
            scope: targetScope,
            totalTokens: allTokens.length,
            hasPreview: !!previewToken
        });

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
                filteredTokens = allTokens.filter(token => !token.isControlledByCurrentUser);
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

        this.logger.debug('Tokens filtered by scope', {
            scope: targetScope,
            originalCount: allTokens.length,
            filteredCount: filteredTokens.length
        });

        return filteredTokens;
    }

    // Private Methods - Rendering

    /**
     * Renders overlays on a specific token.
     */
    private async renderOverlaysOnToken(
        targetToken: Token,
        overlays: OverlayDefinition[],
        isGM: boolean,
        contextBuilder: (overlayId: string, token: Token, isGM: boolean) => OverlayRenderContext
    ): Promise<void> {
        for (const overlay of overlays) {
            const context = contextBuilder(overlay.id, targetToken, isGM);

            this.logger.debug(`Rendering overlay ${overlay.id} on token ${targetToken.name}`, {
                overlayId: overlay.id,
                tokenId: targetToken.id,
                tokenName: targetToken.name,
                isGM
            });

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
        isGM: boolean,
        userColour: string,
        actors?: Actor[]
    ): any {  // Using 'any' since different overlays have different option types
        switch (overlayId) {
            case 'actor-info':
                return {
                    isGM,
                    userColour,
                    ownedByCurrentUserActors: actors ?? []
                };

            default:
                // Return generic options for overlays that don't have specific requirements
                return {
                    isGM,
                    userColour
                };
        }
    }
}