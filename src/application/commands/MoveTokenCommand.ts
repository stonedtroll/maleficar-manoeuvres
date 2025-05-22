/**
 * Implements the Command pattern for token movement operations.
 * Handles token movement validation, collision detection, and snap-to-token functionality.
 */

import type { Command } from './Command.js';
import type { MoveResult } from '../types/MoveResult.js';
import type { MoveTokenCommandOptions } from '../types/CommandOptions.js';
import type { Collidable } from '../../domain/interfaces/Collidable.js';
import type { MovementValidator } from '../../domain/services/MovementValidator.js';
import type { SnapPositionCalculator } from '../../domain/services/SnapPositionCalculator.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

import { Vector2 } from '../../domain/value-objects/Vector2.js';
import { Vector3 } from '../../domain/value-objects/Vector3.js';
import { Rotation } from '../../domain/value-objects/Rotation.js';
import { MoveableToken } from '../../domain/entities/MoveableToken.js';
import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';

/**
 * Command for moving tokens with validation and collision detection.
 * Supports snap-to-token functionality and maintains movement history.
 */
export class MoveTokenCommand implements Command<MoveResult> {
    private readonly logger: FoundryLogger;
    private startPosition?: Vector2;
    private startRotation?: Rotation;
    private startElevation?: number;

    constructor(
        private readonly token: MoveableToken,
        private readonly targetPosition: Vector3,
        private readonly obstacles: Collidable[],
        private readonly options: MoveTokenCommandOptions,
        private readonly movementValidator: MovementValidator,
        private readonly snapCalculator: SnapPositionCalculator
    ) {
        this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.MoveTokenCommand`);
    }

    /**
     * Executes the movement command with validation and collision detection.
     */
    async execute(): Promise<MoveResult> {
        // Store current state for potential undo
        this.storePreviousState();
        
        const startPosition = this.getStartPosition3D();
        
        // Validate the proposed movement
        const validationResult = await this.validateMovement(startPosition);
        
        // Handle blocked movement with snapping
        if (this.isBlockedWithSnappingEnabled(validationResult)) {
            const snapResult = await this.attemptSnapMovement(startPosition, validationResult);
            if (snapResult) {
                return snapResult;
            }
        }
        
        // Handle invalid movement
        if (!this.isValidMovement(validationResult)) {
            return this.createFailureResult(validationResult);
        }
        
        // Execute valid movement
        return this.executeDirectMovement(validationResult.position!);
    }

    /**
     * Undoes the movement, restoring the token to its previous state.
     */
    async undo(): Promise<void> {
        if (!this.startPosition) {
            this.logger.debug('No previous position to restore');
            return;
        }

        this.logger.debug('Undoing movement', {
            from: this.token.position,
            to: this.startPosition
        });

        this.token.move(this.startPosition);
        
        if (this.startRotation) {
            this.token.rotate(this.startRotation.degrees);
        }
        
        if (this.startElevation !== undefined) {
            this.token.elevation = this.startElevation;
        }
    }

    /**
     * Checks if the command can be executed in the current state.
     */
    canExecute(): boolean {
        const currentPosition3D = this.getTokenPosition3D();
        const canExecute = !currentPosition3D.equals(this.targetPosition);
        
        this.logger.debug('Checking if command can execute', {
            currentPosition: currentPosition3D,
            targetPosition: this.targetPosition,
            canExecute
        });
        
        return canExecute;
    }

    /**
     * Stores the current token state for undo functionality.
     */
    private storePreviousState(): void {
        this.startPosition = new Vector2(this.token.position.x, this.token.position.y);
        this.startRotation = new Rotation(this.token.rotation.degrees);
        this.startElevation = this.token.elevation;
    }

    /**
     * Gets the starting position in 3D space.
     */
    private getStartPosition3D(): Vector3 {
        return new Vector3(
            this.startPosition!.x,
            this.startPosition!.y,
            this.token.elevation ?? 0
        );
    }

    /**
     * Gets the current token position in 3D space.
     */
    private getTokenPosition3D(): Vector3 {
        return new Vector3(
            this.token.position.x,
            this.token.position.y,
            this.token.elevation ?? 0
        );
    }

    /**
     * Validates the movement from start to target position.
     */
    private async validateMovement(startPosition: Vector3) {
        const { maxDistance, ignoreElevation = false } = this.options;
        
        const validationResult = this.movementValidator.validateMovement(
            this.token,
            startPosition,
            this.targetPosition,
            this.obstacles,
            {
                ...(maxDistance !== undefined && { maxDistance }),
                ignoreElevation
            }
        );

        this.logger.debug('Movement validation result', {
            type: validationResult.type,
            reason: validationResult.reason,
            blockerCount: validationResult.blockers?.length ?? 0
        });

        return validationResult;
    }

    /**
     * Checks if movement is blocked but snapping is enabled.
     */
    private isBlockedWithSnappingEnabled(validationResult: any): boolean {
        return validationResult.type === 'blocked' && 
               this.options.enableSnapping && 
               validationResult.blockers?.length > 0;
    }

    /**
     * Checks if movement validation passed.
     */
    private isValidMovement(validationResult: any): boolean {
        return validationResult.type === 'valid' && validationResult.position !== undefined;
    }

    /**
     * Attempts to snap to a blocking token.
     */
    private async attemptSnapMovement(
        startPosition: Vector3, 
        validationResult: any
    ): Promise<MoveResult | undefined> {
        // Find token blockers
        const tokenBlocker = this.findTokenBlocker(validationResult.blockers);
        if (!tokenBlocker) {
            this.logger.debug('No token blocker found for snapping');
            return undefined;
        }

        // Calculate snap position
        const snapResult = await this.calculateSnapPosition(startPosition, tokenBlocker);
        if (!snapResult.success || !snapResult.position) {
            this.logger.debug('Snap calculation failed', snapResult);
            return undefined;
        }

        // Validate snap position
        const snapValidation = await this.validateSnapPosition(startPosition, snapResult.position);
        if (!this.isValidMovement(snapValidation)) {
            this.logger.debug('Snap position validation failed', snapValidation);
            return undefined;
        }

        // Execute snap movement
        return this.executeSnapMovement(snapValidation.position!, tokenBlocker);
    }

    /**
     * Finds a token blocker from the list of blockers.
     */
    private findTokenBlocker(blockers: Collidable[]): MoveableToken | undefined {
        const tokenBlocker = blockers.find(blocker => blocker instanceof MoveableToken);
        
        if (tokenBlocker) {
            this.logger.debug('Token blocker found', {
                blockerId: (tokenBlocker as MoveableToken).id,
                blockerName: (tokenBlocker as MoveableToken).name
            });
        }
        
        return tokenBlocker as MoveableToken | undefined;
    }

    /**
     * Calculates snap position for the given blocker.
     */
    private async calculateSnapPosition(startPosition: Vector3, tokenBlocker: MoveableToken) {
        const snapResult = this.snapCalculator.calculateSnapPosition(
            this.token,
            startPosition,
            this.targetPosition,
            tokenBlocker,
            this.obstacles
        );

        this.logger.debug('Snap position calculated', {
            success: snapResult.success,
            position: snapResult.position,
            reason: snapResult.reason
        });

        return snapResult;
    }

    /**
     * Validates the calculated snap position.
     * 
     */
    private async validateSnapPosition(startPosition: Vector3, snapPosition: Vector3) {
        const { maxDistance, ignoreElevation = false } = this.options;
        
        const snapValidation = this.movementValidator.validateMovement(
            this.token,
            startPosition,
            snapPosition,
            this.obstacles,
            {
                ...(maxDistance !== undefined && { maxDistance }),
                ignoreElevation
            }
        );

        this.logger.debug('Snap position validation', {
            type: snapValidation.type,
            position: snapValidation.position
        });

        return snapValidation;
    }

    /**
     * Executes movement to snap position.
     * 
     */
    private executeSnapMovement(snapPosition: Vector3, snapTarget: MoveableToken): MoveResult {
        const snapPosition2D = new Vector2(snapPosition.x, snapPosition.y);
        
        this.token.move(snapPosition2D);
        
        if (snapPosition.z !== this.token.elevation) {
            this.token.elevation = snapPosition.z;
        }

        return {
            success: true,
            previousPosition: this.startPosition!,
            previousRotation: this.startRotation!,
            newPosition: snapPosition2D,
            newRotation: this.token.rotation,
            isSnapped: true,
            snapTargetId: snapTarget.id,
            snapTargetName: snapTarget.name,
            distance: this.startPosition!.distanceTo(snapPosition2D)
        };
    }

    /**
     * Executes normal movement to validated position.
     */
    private executeDirectMovement(validatedPosition: Vector3): MoveResult {
        const newPosition2D = new Vector2(validatedPosition.x, validatedPosition.y);
        
        this.token.move(newPosition2D);
        
        if (validatedPosition.z !== this.token.elevation) {
            this.token.elevation = validatedPosition.z;
        }

        return {
            success: true,
            previousPosition: this.startPosition!,
            previousRotation: this.startRotation!,
            newPosition: newPosition2D,
            newRotation: this.token.rotation,
            isSnapped: false,
            distance: this.startPosition!.distanceTo(newPosition2D)
        };
    }

    /**
     * Creates a failure result from validation.
     */
    private createFailureResult(validationResult: any): MoveResult {
        return {
            success: false,
            reason: validationResult.reason ?? 'movement_invalid',
            ...(validationResult.blockers && { blockers: validationResult.blockers })
        };
    }
}