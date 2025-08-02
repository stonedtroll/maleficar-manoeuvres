/**
 * Orchestrates token movement operations and coordinates movement-based overlay updates. This coordinator acts as the bridge
 * between token position changes and the application's response, including collision
 * detection, snapping behaviour, and overlay display updates.
 * 
 * Features:
 * - Intelligent collision detection during movement
 * - Automatic snapping to valid positions
 * - Movement validation through domain services
 */

import type { TokenUpdateEvent } from '../../infrastructure/events/FoundryEvents.js';
import type { EventBus } from '../../infrastructure/events/EventBus.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import type { MoveTokenCommandOptions } from '../types/CommandOptions';

import { Token } from '../../domain/entities/Token.js';
import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';
import { MoveTokenCommand } from '../commands/MoveTokenCommand.js';
import { MovementValidator } from '../../domain/services/MovementValidator.js';
import { CommandExecutor } from '../commands/CommandExecutor.js';
import { Vector3 } from '../../domain/value-objects/Vector3.js';
import { SnapPositionCalculator } from '../../domain/services/SnapPositionCalculator.js';
import { MoveResult } from '../types/MoveResult.js';
import { TokenRepository } from '@/infrastructure/repositories/TokenRepository.js';
import { MovementConfigurationService } from '../../domain/services/MovementConfigurationService.js';

export class TokenMovementCoordinator {
  private readonly logger: FoundryLogger;

  /**
   * Default options for movement commands.
   */
  private static readonly DEFAULT_MOVE_OPTIONS: MoveTokenCommandOptions = {
    enableSnapping: true
  };

  constructor(
    private readonly commandExecutor: CommandExecutor,
    private readonly movementValidator: MovementValidator,
    private readonly snapCalculator: SnapPositionCalculator,
    private readonly eventBus: EventBus,
    private readonly tokenRepository: TokenRepository
  ) {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.TokenMovementCoordinator`);

    this.registerEventHandlers();

    this.logger.info('TokenMovementCoordinator initialised');
  }

  /**
   * Handles token update events for position changes.
   * Processes movement validation, collision detection, and snapping.
   */
  async handleTokenUpdate(event: TokenUpdateEvent): Promise<void> {
    try {
      if (!MovementConfigurationService.shouldValidateMovement()) {
        this.logger.debug('Movement validation is bypassed', {
          tokenId: event.updatingTokenId
        });
        return;
      }

      const changes = event.changes;

      if (event.updateOptions.maleficarManoeuvresValidatedMove || !this.hasPositionChanged(changes)) {
        return;
      }

      const updatingToken = this.tokenRepository.getById(event.updatingTokenId);
      if (updatingToken === undefined) {
        this.logger.warn(`Token with ID ${event.updatingTokenId} not found for update`);
        return;
      }

      const startPosition = new Vector3(updatingToken.position.x, updatingToken.position.y, updatingToken.elevation ?? 0);
      const endPosition = this.determineEndPosition(updatingToken, changes);

      if (this.isSamePosition(startPosition, endPosition)) {
        this.logger.debug('No actual position change detected');
        return;
      }

      // Execute movement command
      const moveResult = await this.executeMovement(updatingToken, endPosition);

      // Emit movement event based on result
      await this.emitMovementEvent(updatingToken, moveResult);

    } catch (error) {
      this.logger.error('Error handling token update', {
        error: error instanceof Error ? error.message : String(error),
        tokenId: event.updatingTokenId
      });
    }
  }

  /**
   * Registers event handlers for token updates.
   */
  private registerEventHandlers(): void {
    this.eventBus.on('token:update', this.handleTokenUpdate.bind(this));

    this.logger.debug('Token update event handler registered');
  }

  /**
   * Checks if the update event contains position changes.
   */
  private hasPositionChanged(changes: Partial<TokenUpdateEvent['changes']>): boolean {
    return 'x' in changes || 'y' in changes;
  }

  /**
   * Calculates the target position from state changes.
   */
  private determineEndPosition(
    updatingToken: Token,
    changes: Partial<TokenUpdateEvent['changes']>
  ): Vector3 {
    return new Vector3(
      changes.x ?? updatingToken.position.x,
      changes.y ?? updatingToken.position.y,
      changes.elevation ?? updatingToken.elevation ?? 0
    );
  }

  /**
   * Checks if two positions are the same.
   */
  private isSamePosition(
    startPosition: Vector3,
    endPosition: Vector3
  ): boolean {
    return endPosition.x === startPosition.x &&
      endPosition.y === startPosition.y;
  }

  /**
   * Executes the movement command with validation and snapping.
   */
  private async executeMovement(
    updatingToken: Token,
    endPosition: Vector3
  ) {

    const allTokens = this.tokenRepository.getAll();

    const command = new MoveTokenCommand(
      updatingToken,
      endPosition,
      allTokens,
      TokenMovementCoordinator.DEFAULT_MOVE_OPTIONS,
      this.movementValidator,
      this.snapCalculator
    );

    const result = await this.commandExecutor.execute(command);

    return result;
  }

  /**
   * Emits movement event based on command result.
   */
  private async emitMovementEvent(
    updatingToken: Token,
    moveResult: MoveResult
  ): Promise<void> {

    this.logger.debug('Emitting token movement event', {
      tokenId: updatingToken.id,
      newPosition: moveResult.newPosition,
      updatingToken: updatingToken,
      moveResult: moveResult
    });

    // Build base payload with guaranteed values
    const basePayload = {
      tokenId: updatingToken.id,
      tokenName: updatingToken.name,
      fromPosition: moveResult.previousPosition ?? {
        x: updatingToken.position.x,
        y: updatingToken.position.y
      },
      toPosition: moveResult.newPosition ?? {
        x: updatingToken.position.x,
        y: updatingToken.position.y
      },
      isSnapped: moveResult.isSnapped ?? false,
      distance: moveResult.distance ?? 0
    };

    // Add snap target if present
    const eventPayload = {
      ...basePayload,
      ...(moveResult.snapTargetId && moveResult.snapTargetName && {
        snapTarget: {
          id: moveResult.snapTargetId,
          name: moveResult.snapTargetName
        }
      })
    };

    // Emit based on result - preserving current logic
    if (moveResult.success && moveResult.newPosition && moveResult.isSnapped) {
      await this.eventBus.emit('token.moved', eventPayload);
    } else if (!moveResult.success) {
      // Preserve current behaviour: emit 'token.moved' even on failure
      await this.eventBus.emit('token.moved', {
        ...eventPayload,
        fromPosition: moveResult.previousPosition ?? {
          x: updatingToken.position.x,
          y: updatingToken.position.y
        },
        toPosition: moveResult.newPosition ?? {
          x: updatingToken.position.x,
          y: updatingToken.position.y
        },
        isSnapped: false
      });
    } else {
      this.logger.debug('No blockers', { moveResult });
    }
  }
}
