/**
 * This module implements the Command pattern for token movement.
 */

import type { Command } from './Command.js';
import type { MoveResult } from '../types/MoveResult.js';
import type { MoveTokenCommandOptions } from '../types/CommandOptions.js';
import type { SpatialEntity } from '../../domain/interfaces/SpatialEntity.js';
import type { MovementValidator } from '../../domain/services/MovementValidator.js';
import type { SnapPositionCalculator } from '../../domain/services/SnapPositionCalculator.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import type { MovementValidationResult } from '../../domain/types/MovementValidationResult.js';

import { Vector3 } from '../../domain/value-objects/Vector3.js';
import { Rotation } from '../../domain/value-objects/Rotation.js';
import { Token } from '../../domain/entities/Token.js';
import { CollisionEntity } from '../../domain/value-objects/CollisionEntity.js';
import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';

export class MoveTokenCommand implements Command<MoveResult> {
    private readonly logger: FoundryLogger;
    private _startPosition: Vector3;
    private _startRotation: Rotation;
    private _startElevation: number;

    constructor(
        private readonly updatingToken: Token,
        private readonly endPosition: Vector3,
        private readonly obstacles: SpatialEntity[],
        private readonly options: MoveTokenCommandOptions,
        private readonly movementValidator: MovementValidator,
        private readonly snapCalculator: SnapPositionCalculator
    ) {
        this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.MoveTokenCommand`);
    }

    /**
     * Executes the movement command with validation.
     * 
     * The execution flow:
     * 1. Stores current state for potential undo operations
     * 2. Filters obstacles to exclude hidden/invisible tokens
     * 3. Validates the movement path
     * 4. Attempts snap movement if blocked and snapping is enabled
     * 5. Executes the movement or returns failure
     */
    async execute(): Promise<MoveResult> {
        this.storeStartState();

        const filteredObstacles = this.filterObstacles(this.obstacles, this.updatingToken.id);
        const validationResult = await this.validateMovement(
            this.endPosition, 
            this.updatingToken, 
            filteredObstacles
        );

        // Attempt snap movement if blocked
        if (this.shouldAttemptSnap(validationResult)) {
            const snapResult = await this.attemptSnapMovement(
                this._startPosition, 
                validationResult, 
                filteredObstacles
            );
            if (snapResult) {
                return snapResult;
            }
        }

        // Execute direct movement if valid
        if (this.isMovementValid(validationResult)) {
            return this.executeDirectMovement(validationResult.position!);
        }

        // Return failure result
        return this.createFailureResult(validationResult);
    }

    /**
     * Reverses the movement operation, restoring the token to its previous state.
     */
    async undo(): Promise<void> {
        // TODO: Implement undo logic
        // Should restore token to _startPosition with _startRotation and _startElevation
    }

    /**
     * Stores the current token state for potential undo operations.
     * Captures position, rotation, and elevation data.
     */
    private storeStartState(): void {
        this._startPosition = this.updatingToken.position3D;
        this._startRotation = new Rotation(this.updatingToken.rotation.degrees);
        this._startElevation = this.updatingToken.elevation;
    }

    /**
     * Filters obstacles to exclude non-blocking entities.
     * Removes the moving token itself, hidden tokens, and invisible tokens.
     */
    private filterObstacles(
        obstacles: SpatialEntity[], 
        movingTokenId?: string
    ): SpatialEntity[] {
        return obstacles.filter(obstacle => {
            // Exclude self
            if (movingTokenId && obstacle.id === movingTokenId) {
                return false;
            }

            // Exclude hidden or invisible tokens
            if (obstacle instanceof Token) {
                const token = obstacle as Token;
                if (token.hidden) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Validates the movement from current to target position.
     * Creates a collision entity at the target position and checks for conflicts.
     */
    private async validateMovement(
        endPosition: Vector3, 
        updatingToken: Token, 
        obstacles: SpatialEntity[]
    ): Promise<MovementValidationResult> {
        // Create collision entity at target position
        const movingEntity = new CollisionEntity({
            position: endPosition.toVector2(),
            width: updatingToken.width,
            height: updatingToken.height,
            elevation: endPosition.z,
            disposition: updatingToken.disposition,
            verticalHeight: updatingToken.verticalHeight,
            collidable: updatingToken.collidable,
            providesCover: updatingToken.providesCover
        });

        // Validate movement
        const validationResult = this.movementValidator.validateMovement(
            updatingToken,
            movingEntity,
            obstacles,
            {
                ...(this.options.maxDistance !== undefined && { maxDistance: this.options.maxDistance }),
                ...(this.options.ignoreElevation !== undefined && { ignoreElevation: this.options.ignoreElevation })
            }
        );

        this.logger.debug('Movement validation result', {
            type: validationResult.type,
            reason: validationResult.reason,
            blockerCount: validationResult.blockers?.length ?? 0,
            startPos: updatingToken.position3D,
            endPos: endPosition
        });

        return validationResult;
    }

    /**
     * Determines if snap movement should be attempted.
     * Checks if movement is blocked, snapping is enabled, and blockers exist.
     */
    private shouldAttemptSnap(validationResult: MovementValidationResult): boolean {
        return validationResult.type === 'blocked' &&
               this.options.enableSnapping === true &&
               (validationResult.blockers?.length ?? 0) > 0;
    }

    /**
     * Checks if the movement validation passed successfully.
     */
    private isMovementValid(validationResult: MovementValidationResult): boolean {
        return validationResult.type === 'valid' && 
               validationResult.position !== undefined;
    }

    /**
     * Attempts to calculate and execute a snap movement to a blocking token.
     */
    private async attemptSnapMovement(
        startPosition: Vector3,
        validationResult: MovementValidationResult,
        obstacles: SpatialEntity[]
    ): Promise<MoveResult | undefined> {
        this.logger.debug('Attempting snap movement', {
            startPosition,
            blockerCount: validationResult.blockers?.length ?? 0
        });

        // Find suitable token blocker
        const tokenBlocker = this.findTokenBlocker(validationResult.blockers ?? []);
        if (!tokenBlocker) {
            this.logger.debug('No token blocker found for snapping');
            return undefined;
        }

        // Get collision point
        const collisionPoint = validationResult.collisionPoints?.[0];
        if (!collisionPoint) {
            this.logger.debug('No collision point provided, cannot perform snap calculation');
            return undefined;
        }

        // Calculate snap position
        const snapResult = await this.calculateSnapPosition(
            startPosition, 
            tokenBlocker, 
            collisionPoint, 
            obstacles
        );
        
        if (!snapResult.success || !snapResult.position) {
            this.logger.debug('Snap calculation failed', snapResult);
            return undefined;
        }

        // Execute snap movement
        return this.executeSnapMovement(snapResult.position, tokenBlocker);
    }

    /**
     * Finds a token blocker from the array of blocking entities.
     */
    private findTokenBlocker(blockers: SpatialEntity[]): Token | undefined {
        const tokenBlocker = blockers.find(blocker => blocker instanceof Token) as Token | undefined;

        if (tokenBlocker) {
            this.logger.debug('Token blocker identified', {
                blockerId: tokenBlocker.id,
                blockerName: tokenBlocker.name
            });
        }

        return tokenBlocker;
    }

    /**
     * Calculates the optimal snap position near a blocking token.
     */
    private async calculateSnapPosition(
        startPosition: Vector3, 
        tokenBlocker: Token, 
        collisionPoint: Vector3, 
        obstacles: SpatialEntity[]
    ) {
        this.logger.debug('Calculating snap position', {
            startPosition,
            tokenBlockerId: tokenBlocker.id,
            tokenBlockerName: tokenBlocker.name,
            collisionPoint
        });

        const snapResult = this.snapCalculator.calculateSnapPosition(
            this.updatingToken,
            startPosition,
            this.endPosition,
            tokenBlocker,
            obstacles,
            collisionPoint
        );

        this.logger.debug('Snap position calculated', {
            success: snapResult.success,
            position: snapResult.position,
            reason: snapResult.reason
        });

        return snapResult;
    }

    /**
     * Executes movement to the calculated snap position.
     */
    private executeSnapMovement(snapPosition: Vector3, snapTarget: Token): MoveResult {

        //TODO: Use the move method on the token. Also integrate with executeDirectMovement
        const snapPosition2D = snapPosition.toVector2();

        // Update elevation if changed
        if (snapPosition.z !== this.updatingToken.elevation) {
            this.updatingToken.elevation = snapPosition.z;
        }

        return {
            success: true,
            previousPosition: this._startPosition.toVector2(),
            previousRotation: this._startRotation,
            newPosition: snapPosition2D,
            newRotation: this.updatingToken.rotation,
            isSnapped: true,
            snapTargetId: snapTarget.id,
            snapTargetName: snapTarget.name,
            distance: this._startPosition.toVector2().distanceTo(snapPosition2D)
        };
    }

    /**
     * Executes direct movement to the validated position.
     */
    private executeDirectMovement(validatedPosition: Vector3): MoveResult {

        //TODO: Use the move method on the token
        const newPosition2D = validatedPosition.toVector2();

        // Update elevation if changed
        if (validatedPosition.z !== this.updatingToken.elevation) {
            this.updatingToken.elevation = validatedPosition.z;
        }

        return {
            success: true,
            previousPosition: this._startPosition.toVector2(),
            previousRotation: this._startRotation,
            newPosition: newPosition2D,
            newRotation: this.updatingToken.rotation,
            isSnapped: false,
            distance: this._startPosition.toVector2().distanceTo(newPosition2D)
        };
    }

    /**
     * Creates a failure result from validation errors.
     */
    private createFailureResult(validationResult: MovementValidationResult): MoveResult {
        return {
            success: false,
            reason: validationResult.reason ?? 'movement_invalid',
            ...(validationResult.blockers && { blockers: validationResult.blockers })
        };
    }
}