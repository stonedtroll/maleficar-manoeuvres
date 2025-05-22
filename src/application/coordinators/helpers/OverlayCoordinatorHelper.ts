/**
 * Provides common utility functions for overlay coordination.
 * This helper class handles permission checking and overlay rendering tracking.
 * It serves as a support service for overlay coordinators, abstracting common
 * functionality to promote code reuse.
 */

import type { OverlayRenderingService } from '../../../presentation/services/OverlayRenderingService.js';
import type { OverlayPermissionCoordinator } from '../OverlayPermissionCoordinator.js';
import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';
import type { OverlayRenderContext } from '../../../domain/interfaces/OverlayRenderContext.js';
import type { TokenState } from '../../../infrastructure/events/FoundryEvents.js';
import type { FoundryLogger } from '../../../../lib/log4foundry/log4foundry.js';

import { GridlessToken } from '../../../domain/entities/GridlessToken.js';
import { TokenStateAdapter } from '../../adapters/TokenStateAdapter.js';
import { LoggerFactory } from '../../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../../config.js';

export class OverlayCoordinatorHelper {
    private readonly logger: FoundryLogger;
    private readonly renderedOverlays = new Map<string, Set<string>>();

    constructor(
        private readonly overlayRenderer: OverlayRenderingService,
        private readonly permissionCoordinator: OverlayPermissionCoordinator,
        private readonly tokenStateAdapter: TokenStateAdapter
    ) {
        this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.OverlayCoordinatorHelper`);
    }

    /**
     * Categorises tokens for overlay rendering based on visibility and ownership.
     */
    categoriseTokensForOverlayRendering(
        placeableTokens: TokenState[],
        options: {
            includeAll?: boolean;
            onlyControlled?: boolean;
            onlyOwned?: boolean;
            onlyNotControlled?: boolean;
        } = {}
    ): {
        controlled: GridlessToken[];
        owned: GridlessToken[];
        targetTokens: GridlessToken[];
    } {
        // Filter to only visible tokens
        const visibleTokens = placeableTokens.filter(token => token.visible);

        // Categorise by control and ownership
        const controlled = this.filterAndTransformTokens(
            visibleTokens,
            token => token.controlled
        );

        const owned = this.filterAndTransformTokens(
            visibleTokens,
            token => token.ownedByCurrentUser && !token.controlled
        );

        // Determine target tokens based on options
        const targetTokens = this.determineTargetTokens(
            visibleTokens,
            controlled,
            owned,
            options
        );

        this.logger.debug('Tokens categorised for overlay rendering', {
            visibleCount: visibleTokens.length,
            controlledCount: controlled.length,
            ownedCount: owned.length,
            targetCount: targetTokens.length,
            options
        });

        return { controlled, owned, targetTokens };
    }

    /**
     * Requests overlay rendering on tokens after permission validation.
     */
    async requestOverlayRendering(
        controlledTokens: GridlessToken[],
        ownedTokens: GridlessToken[],
        targetTokens: GridlessToken[],
        matchingOverlays: OverlayDefinition[],
        isGM: boolean,
        contextBuilder: (overlayId: string, token: GridlessToken, isGM: boolean) => OverlayRenderContext
    ): Promise<void> {
        const ownedTokenIds = ownedTokens.map(token => token.id);
        const controlledTokenIds = controlledTokens.map(token => token.id);

        // Process each target token
        for (const targetToken of targetTokens) {
            await this.renderOverlaysOnToken(
                targetToken,
                matchingOverlays,
                controlledTokenIds,
                ownedTokenIds,
                isGM,
                contextBuilder
            );
        }
    }

    /**
     * Hides all tracked overlays across all tokens.
     */
    async hideAllTrackedOverlays(): Promise<void> {
        const overlayCount = this.renderedOverlays.size;
        
        this.logger.debug('Hiding all tracked overlays', { overlayCount });

        // Get unique overlay types
        const overlayTypes = this.getAllTrackedOverlayTypes();
        
        // Hide each overlay type
        for (const overlayTypeId of overlayTypes) {
            this.overlayRenderer.hideAllOverlaysOfType(overlayTypeId);
        }

        // Clear tracking
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

            // Hide each overlay on this token
            for (const overlayId of overlayIds) {
                this.overlayRenderer.hideTokenOverlay(overlayId, tokenId);
            }

            // Remove tracking for this token
            this.renderedOverlays.delete(tokenId);
        }
    }

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
     * Clears overlay tracking without hiding rendered overlays.
     * Use with caution as this can lead to orphaned overlays.
     */
    clearTracking(): void {
        this.logger.debug('Clearing overlay tracking', {
            tokenCount: this.renderedOverlays.size
        });
        
        this.renderedOverlays.clear();
    }

    /**
     * Gets the current render tracking state for debugging.
     */
    getRenderTrackingState(): Array<{ tokenId: string; overlayIds: string[] }> {
        return Array.from(this.renderedOverlays.entries()).map(([tokenId, overlayIds]) => ({
            tokenId,
            overlayIds: Array.from(overlayIds)
        }));
    }

    /**
     * Filters and transforms tokens based on a predicate.
     */
    private filterAndTransformTokens(
        tokens: TokenState[],
        predicate: (token: TokenState) => boolean
    ): GridlessToken[] {
        return tokens
            .filter(predicate)
            .map(token => this.tokenStateAdapter.toGridlessToken(token));
    }

    /**
     * Determines target tokens based on categorisation options.
     */
    private determineTargetTokens(
        visibleTokens: TokenState[],
        controlled: GridlessToken[],
        owned: GridlessToken[],
        options: {
            includeAll?: boolean;
            onlyControlled?: boolean;
            onlyOwned?: boolean;
            onlyNotControlled?: boolean;
        }
    ): GridlessToken[] {
        if (options.includeAll) {
            return this.tokenStateAdapter.toGridlessTokens(visibleTokens);
        }

        if (options.onlyControlled) {
            return controlled;
        }

        if (options.onlyOwned) {
            return [...controlled, ...owned];
        }

        if (options.onlyNotControlled) {
            return this.filterAndTransformTokens(
                visibleTokens,
                token => !token.controlled
            );
        }

        // Default: controlled tokens, or owned if none controlled
        return controlled.length > 0 ? controlled : owned;
    }

    /**
     * Renders overlays on a single token after permission checks.
     */
    private async renderOverlaysOnToken(
        targetToken: GridlessToken,
        overlays: OverlayDefinition[],
        controlledTokenIds: string[],
        ownedTokenIds: string[],
        isGM: boolean,
        contextBuilder: (overlayId: string, token: GridlessToken, isGM: boolean) => OverlayRenderContext
    ): Promise<void> {
        for (const overlay of overlays) {
            const hasPermission = await this.permissionCoordinator.canViewOverlayOnToken(
                overlay.id,
                targetToken.id,
                controlledTokenIds,
                ownedTokenIds,
                isGM
            );

            if (!hasPermission) {
                continue;
            }

            // Build context and render
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
     * Tracks a rendered overlay for later cleanup.
     */
    private trackRenderedOverlay(tokenId: string, overlayId: string): void {
        if (!this.renderedOverlays.has(tokenId)) {
            this.renderedOverlays.set(tokenId, new Set());
        }
        
        this.renderedOverlays.get(tokenId)!.add(overlayId);
    }
}