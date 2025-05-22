/**
 * Core domain service that determines overlay viewing permissions based on vision
 * and sight rules. Implements a hierarchical permission system that respects token ownership, control status,
 * and line-of-sight mechanics.
 * 
 * Permission Hierarchy:
 * 1. Game Masters - Universal visibility (when enabled)
 * 2. Token Control - Users can view overlays on controlled tokens
 * 3. Line of Sight - Users can view overlays visible to their tokens
 * 4. Ownership Fallback - Check owned tokens if no controlled tokens
 * 
 * Performance Optimisations:
 * - Early returns for common cases (GM, owned tokens)
 * - Sight checks only performed when necessary
 * - Batch operations supported through array parameters
 */

import type { TokenSightData, LineOfSightChecker } from '../interfaces/SightlineTypes.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';

export class OverlayPermissionService {
    private readonly logger: FoundryLogger;

    constructor(
        private readonly lineOfSightChecker: LineOfSightChecker,
    ) {
        this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.OverlayPermissionService`);
    }

    /**
     * Determines if a user can view overlays on a target token.
     * Evaluates permissions hierarchically from most to least permissive.
     */
    canViewOverlaysOnToken(
        targetTokenSightData: TokenSightData,
        controlledTokensSightData: TokenSightData[] = [],
        ownedTokensSightData: TokenSightData[] = [],
        isGM: boolean
    ): boolean {
        // Level 1: Game Master privileges
        if (isGM) {
            this.logger.debug('Permission granted: GM status');
            return true;
        }

        // Level 2: Direct control of target token
        if (this.isTokenControlledByUser(targetTokenSightData, controlledTokensSightData)) {
            this.logger.debug('Permission granted: User controls target token', {
                targetTokenId: targetTokenSightData.id
            });
            return true;
        }

        // Level 3: Line of sight from controlled tokens
        if (controlledTokensSightData.length > 0) {
            const canSee = this.canAnyTokenSeeTarget(
                controlledTokensSightData, 
                targetTokenSightData
            );
            
            this.logger.debug('Vision check from controlled tokens', {
                targetTokenId: targetTokenSightData.id,
                controlledCount: controlledTokensSightData.length,
                result: canSee ? 'granted' : 'denied'
            });
            
            return canSee;
        }

        // Level 4: Fallback to owned tokens when no controlled tokens
        if (ownedTokensSightData.length > 0) {
            const canSeeFromOwned = this.canAnyTokenSeeTarget(
                ownedTokensSightData, 
                targetTokenSightData
            );
            
            this.logger.debug('Fallback check from owned tokens', {
                targetTokenId: targetTokenSightData.id,
                ownedCount: ownedTokensSightData.length,
                result: canSeeFromOwned ? 'granted' : 'denied'
            });
            
            return canSeeFromOwned;
        }

        // No valid permission path
        this.logger.debug('Permission denied: No tokens available for permission check');
        return false;
    }

    // Token Control Checks

    /**
     * Checks if the target token is among the user's controlled tokens.
     */
    private isTokenControlledByUser(
        targetToken: TokenSightData, 
        controlledTokens: TokenSightData[]
    ): boolean {
        return controlledTokens.some(token => token.id === targetToken.id);
    }

    // Vision Checks

    /**
     * Checks if any viewer token can see the target token.
     * Short-circuits on first successful sight check for performance.
     */
    private canAnyTokenSeeTarget(
        viewerTokens: TokenSightData[], 
        targetToken: TokenSightData
    ): boolean {
        for (const viewer of viewerTokens) {
            if (this.canTokenSeeTarget(viewer, targetToken)) {
                this.logger.debug('Token has view permission', {
                    viewerId: viewer.id,
                    targetId: targetToken.id
                });
                return true;
            }
        }
        return false;
    }

    /**
     * Performs sight check between viewer and target.
     * Validates visibility, sight capability, range, and obstructions.
     */
    private canTokenSeeTarget(viewer: TokenSightData, target: TokenSightData): boolean {
        // Target must be visible on canvas
        if (!this.isTokenVisible(target)) {
            this.logger.debug('Sight check failed: Target not visible', {
                targetId: target.id,
                isVisible: target.isVisible,
                isHidden: target.isHidden
            });
            return false;
        }

        // Viewer must have sight capability
        if (!this.tokenHasSight(viewer)) {
            this.logger.debug('Sight check failed: Viewer has no sight', {
                viewerId: viewer.id
            });
            return false;
        }

        // Target must be within viewer's vision range
        if (!this.isTargetInSightRange(viewer, target)) {
            this.logger.debug('Sight check failed: Target outside vision range', {
                viewerId: viewer.id,
                targetId: target.id,
                distance: this.calculateDistance(viewer.position, target.position)
            });
            return false;
        }

        // Check for sight-blocking walls
        const hasLineOfSight = !this.lineOfSightChecker.isBlocked(
            viewer.position, 
            target.position
        );
        
        if (!hasLineOfSight) {
            this.logger.debug('Sight check failed: Line of sight blocked', {
                viewerId: viewer.id,
                targetId: target.id
            });
        }
        
        return hasLineOfSight;
    }

    // Visibility Validation

    /**
     * Checks if a token is visible on the canvas.
     * Tokens must be both visible and not hidden.
     */
    private isTokenVisible(token: TokenSightData): boolean {
        return token.isVisible && !token.isHidden;
    }

    /**
     * Checks if a token has sight capabilities.
     * Tokens without sight boundaries cannot see.
     */
    private tokenHasSight(token: TokenSightData): boolean {
        return token.sightBoundary !== undefined;
    }

    // Range Validation

    /**
     * Checks if target is within viewer's sight boundary.
     * Uses PIXI containsPoint for efficient polygon checks.
     */
    private isTargetInSightRange(viewer: TokenSightData, target: TokenSightData): boolean {
        const sightBoundary = viewer.sightBoundary;
        if (!sightBoundary) {
            return false;
        }

        return sightBoundary.contains(target.position.x, target.position.y);
    }

    /**
     * Calculates 2D distance between two positions.
     */
    private calculateDistance(
        pos1: { x: number; y: number }, 
        pos2: { x: number; y: number }
    ): number {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}