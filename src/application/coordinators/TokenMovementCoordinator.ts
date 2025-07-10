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

import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';
import { MoveTokenCommand } from '../commands/MoveTokenCommand.js';
import { MovementValidator } from '../../domain/services/MovementValidator.js';
import { CommandExecutor } from '../commands/CommandExecutor.js';
import { Vector3 } from '../../domain/value-objects/Vector3.js';
import { SnapPositionCalculator } from '../../domain/services/SnapPositionCalculator.js';
import { TokenStateAdapter } from '../adapters/TokenStateAdapter.js';

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
    private readonly tokenStateAdapter: TokenStateAdapter,
    private readonly eventBus: EventBus
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
      if (event.isUnconstrainedMovement) {
        return;
      }

      // Check if position has changed
      if (event.updateOptions.maleficarManoeuvresValidatedMove || !this.hasPositionChanged(event)) {
        return;
      }

      const { currentState, changedState, placeableTokens } = event;

      // Calculate target position
      const targetPosition = this.calculateTargetPosition(currentState, changedState);

      // Skip if no actual movement
      if (this.isSamePosition(currentState, targetPosition)) {
        this.logger.debug('No actual position change detected');
        return;
      }

      // Execute movement command
      const moveResult = await this.executeMovement(
        currentState,
        targetPosition,
        placeableTokens
      );

      // Emit movement event based on result
      await this.emitMovementEvent(currentState, moveResult);

    } catch (error) {
      this.logger.error('Error handling token update', {
        error: error instanceof Error ? error.message : String(error),
        tokenId: event?.currentState?.id
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
  private hasPositionChanged(event: TokenUpdateEvent): boolean {
    return 'x' in event.changedState || 'y' in event.changedState;
  }

  /**
   * Calculates the target position from state changes.
   */
  private calculateTargetPosition(
    currentState: TokenUpdateEvent['currentState'],
    changedState: TokenUpdateEvent['changedState']
  ): Vector3 {
    return new Vector3(
      changedState.x ?? currentState.x,
      changedState.y ?? currentState.y,
      changedState.elevation ?? currentState.elevation ?? 0
    );
  }

  /**
   * Checks if two positions are the same.
   */
  private isSamePosition(
    currentState: TokenUpdateEvent['currentState'],
    targetPosition: Vector3
  ): boolean {
    return targetPosition.x === currentState.x &&
      targetPosition.y === currentState.y;
  }

  /**
   * Executes the movement command with validation and snapping.
   */
  private async executeMovement(
    tokenState: TokenUpdateEvent['currentState'],
    targetPosition: Vector3,
    placeableTokens: TokenUpdateEvent['placeableTokens']
  ) {
    // Convert to domain objects
    const domainToken = this.tokenStateAdapter.toGridlessToken(tokenState);
    const obstacles = this.prepareObstacles(tokenState.id, placeableTokens);

    // Create and execute movement command
    const command = new MoveTokenCommand(
      domainToken,
      targetPosition,
      obstacles,
      TokenMovementCoordinator.DEFAULT_MOVE_OPTIONS,
      this.movementValidator,
      this.snapCalculator
    );

    const result = await this.commandExecutor.execute(command);

    this.logger.debug('Move command executed', {
      success: result.success,
      newPosition: result.newPosition,
      previousPosition: result.previousPosition,
      snapTargetId: result.snapTargetId,
      snapTargetName: result.snapTargetName,
      distance: result.distance,
      isSnapped: result.isSnapped
    });

    return result;
  }

  /**
   * Prepares obstacles for collision detection.
   * Filters out hidden tokens and the moving token itself.
   */
  private prepareObstacles(
    movingTokenId: string,
    placeableTokens: TokenUpdateEvent['placeableTokens']
  ) {
    return placeableTokens
      .filter(token =>
        token.id !== movingTokenId &&
        !token.hidden
      )
      .map(token => this.tokenStateAdapter.toGridlessToken(token));
  }

  /**
   * Emits movement event based on command result.
   */
  private async emitMovementEvent(
    tokenState: TokenUpdateEvent['currentState'],
    moveResult: Awaited<ReturnType<typeof this.executeMovement>>
  ): Promise<void> {

    // Build base payload with guaranteed values
    const basePayload = {
      tokenId: tokenState.id,
      tokenName: tokenState.name,
      fromPosition: moveResult.previousPosition ?? {
        x: tokenState.x,
        y: tokenState.y
      },
      toPosition: moveResult.newPosition ?? {
        x: tokenState.x,
        y: tokenState.y
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
        fromPosition: { x: tokenState.x, y: tokenState.y },
        toPosition: { x: tokenState.x, y: tokenState.y },
        isSnapped: false
      });
    } else {
      this.logger.debug('No blockers', { moveResult });
    }
  }
}
