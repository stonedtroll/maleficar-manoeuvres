/**
 * 
 * Manages token drag operations and coordinates drag-triggered overlay rendering. This service tracks individual
 * token drag states and ensures appropriate overlays are displayed during drag
 * operations, providing visual feedback for movement and positioning.
 * 
 * Features:
 * - Tracks individual token drag states with position history
 * - Manages drag-triggered overlay display in real-time
 * - Handles drag cancellation with proper cleanup
 * - Coordinates with permission system for overlay visibility
 * - Optimised for performance with early returns and efficient state checks
 */

import type { EventBus } from '../../infrastructure/events/EventBus.js';
import type {
  TokenDragStartEvent,
  TokenDragMoveEvent,
  TokenDragEndEvent,
  TokenDragCancelEvent,
  TokenState
} from '../../infrastructure/events/FoundryEvents.js';
import type { OverlayDefinition } from '../../domain/interfaces/OverlayDefinition.js';
import type { OverlayRenderContext } from '../../domain/interfaces/OverlayRenderContext.js';
import type { OverlayRenderingService } from '../../presentation/services/OverlayRenderingService.js';
import type { OverlayRegistry } from '../registries/OverlayRegistry.js';
import type { OverlayPermissionCoordinator } from './OverlayPermissionCoordinator.js';
import type { OverlayContextBuilderRegistry } from '../registries/OverlayContextBuilderRegistry.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

import { GridlessToken } from '../../domain/entities/GridlessToken.js';
import { OverlayCoordinatorHelper } from './helpers/OverlayCoordinatorHelper.js';
import { TokenStateAdapter } from '../adapters/TokenStateAdapter.js';
import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { Vector3 } from '../../domain/value-objects/Vector3.js';
import { MovementValidator } from '../../domain/services/MovementValidator.js';
import { MODULE_ID } from '../../config.js';
import { SpatialEntity } from '../../domain/interfaces/SpatialEntity.js';

export class TokenDragCoordinator {
  private readonly logger: FoundryLogger;
  private readonly overlayHelper: OverlayCoordinatorHelper;
  private readonly tokenStateAdapter: TokenStateAdapter;
  private previousBlocker: SpatialEntity | null = null;

  constructor(
    private readonly overlayRenderer: OverlayRenderingService,
    private readonly overlayRegistry: OverlayRegistry,
    private readonly permissionCoordinator: OverlayPermissionCoordinator,
    private readonly contextBuilderRegistry: OverlayContextBuilderRegistry,
    private readonly movementValidator: MovementValidator,
    private readonly eventBus: EventBus,
    tokenStateAdapter?: TokenStateAdapter
  ) {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.TokenDragCoordinator`);
    this.tokenStateAdapter = tokenStateAdapter ?? new TokenStateAdapter();

    this.overlayHelper = new OverlayCoordinatorHelper(
      overlayRenderer,
      permissionCoordinator,
      this.tokenStateAdapter
    );

    this.registerEventHandlers();

    this.logger.info('TokenDragCoordinator initialised');
  }

  /**
   * Handles token drag start events.
   * Initialises drag state and displays appropriate overlays.
   */
  async handleDragStart(event: TokenDragStartEvent): Promise<void> {
    try {
      const { dragPosition } = event;

      this.logger.debug('Token drag started', {
        tokenId: event.controlledToken.id,
        dragPosition: dragPosition
      });

      await this.updateObstacleIndicatorOverlays(event);
      await this.updateDragOverlays(
        event.placeableTokens,
        event.user.isGM,
        event.user.colour
      );

    } catch (error) {
      this.logger.error('Error in handleDragStart', {
        error: error instanceof Error ? error.message : String(error),
        tokenId: event.controlledToken.id
      });
    }
  }

  /**
   * Handles active dragging events.
   * Updates current position and refreshes overlays if needed.
   */
  async handleDragMove(event: TokenDragMoveEvent): Promise<void> {
    try {
      this.logger.debug('Token dragging', {
        tokenId: event.controlledToken.id,
      });

      await this.updateObstacleIndicatorOverlays(event);

    } catch (error) {
      this.logger.error('Error in handleDragMove', {
        error: error instanceof Error ? error.message : String(error),
        tokenId: event?.controlledToken.id
      });
    }
  }

  /**
   * Handles token drag end events.
   * Cleans up drag state and hides overlays.
   */
  async handleDragEnd(event: TokenDragEndEvent): Promise<void> {
    try {
      await this.cleanupDragOperation();
      this.previousBlocker = null;
    } catch (error) {
      this.logger.error('Error in handleDragEnd', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event?.id
      });
    }
  }

  /**
   * Handles token drag cancel events.
   * Reverts drag operation and cleans up state.
   */
  async handleDragCancel(event: TokenDragCancelEvent): Promise<void> {
    try {
      await this.cleanupDragOperation();
      this.previousBlocker = null;
    } catch (error) {
      this.logger.error('Error in handleDragCancel', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event?.id
      });
    }
  }

  /**
 * Validates movement using MovementValidator and updates obstacle overlays
 */
  private async updateObstacleIndicatorOverlays(
    event: TokenDragStartEvent | TokenDragMoveEvent
  ): Promise<void> {
    try {
      const movingToken = this.tokenStateAdapter.toGridlessToken(event.controlledToken);
      const obstacles = this.prepareObstacles(movingToken.id, event.placeableTokens);

      const startPosition = new Vector3(
        event.controlledToken.x,
        event.controlledToken.y,
        event.controlledToken.elevation || 0
      );

      const dragPosition = new Vector3(
        event.dragPosition.x,
        event.dragPosition.y,
        event.dragElevation || 0
      );

      const validationResult = this.movementValidator.validateMovement(
        movingToken,
        startPosition,
        dragPosition,
        obstacles
      );

      const currentBlocker = validationResult.blockers?.[0] ?? null;

      if (currentBlocker && validationResult.type === 'blocked') {
        await this.handleObstacleDetected(currentBlocker, movingToken, event);
      } else if (validationResult.type !== 'ignored') {
        await this.handleObstacleClear();
      }

    } catch (error) {
      this.logger.error('Error validating movement and updating overlays', {
        tokenId: event.controlledToken.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handles when an obstacle is detected during movement.
   * Only renders if the obstacle has changed from the previous one.
   */
  private async handleObstacleDetected(
    currentBlocker: SpatialEntity,
    movingToken: GridlessToken,
    event: TokenDragStartEvent | TokenDragMoveEvent
  ): Promise<void> {
    if (this.previousBlocker?.id === currentBlocker.id) {
      return;
    }

    await this.clearObstacleIndicatorOverlays();
    await this.renderObstacleIndicatorOverlays(
      [movingToken],
      currentBlocker as GridlessToken,
      event.user.isGM,
      event.user.colour
    );

    this.previousBlocker = currentBlocker;
  }

  /**
   * Handles when no obstacles are detected.
   * Clears any existing obstacle indicators.
   */
  private async handleObstacleClear(): Promise<void> {
    if (this.previousBlocker === null) {
      return;
    }

    await this.clearObstacleIndicatorOverlays();
    this.previousBlocker = null;
  }

  /**
   * Prepares obstacles for collision detection.
   * Filters out hidden tokens and the moving token itself.
   */
  private prepareObstacles(
    movingTokenId: string,
    placeableTokens: TokenState[]
  ) {
    return placeableTokens
      .filter(token =>
        token.id !== movingTokenId &&
        !token.hidden
      )
      .map(token => this.tokenStateAdapter.toGridlessToken(token));
  }

  /**
   * Renders obstacle indicator overlay on a specific token
   */
  private async renderObstacleIndicatorOverlays(
    controlled: GridlessToken[],
    obstacle: GridlessToken,
    isGM: boolean,
    userColour: string
  ): Promise<void> {
    try {
      const obstacleIndicatorOverlay = this.overlayRegistry.get('obstacle-indicator');
      if (!obstacleIndicatorOverlay) {
        this.logger.warn('Obstacle indicator overlay definition not found');
        return;
      }

      const overlaysWithContextBuilders = this.prepareOverlaysWithContextBuilders([obstacleIndicatorOverlay]);

      if (overlaysWithContextBuilders.length === 0) {
        this.logger.warn('No context builder available for obstacle indicator overlay');
        return;
      }

      await this.overlayHelper.requestOverlayRendering(
        controlled,
        [],
        [obstacle],
        overlaysWithContextBuilders,
        isGM,
        (overlayId, targetToken, isGM) =>
          this.buildContextForOverlay(overlayId, targetToken, isGM, userColour, overlaysWithContextBuilders)
      );
    } catch (error) {
      this.logger.error('Error rendering obstacle indicator', {
        tokenId: obstacle.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Clears all blocking overlay indicators
   */
  private async clearObstacleIndicatorOverlays(): Promise<void> {
    try {
      this.overlayRenderer.clearOverlayType(`obstacle-indicator`);

    } catch (error) {
      this.logger.error('Error clearing obstacle indicator overlays', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Registers event handlers for drag events.
   */
  private registerEventHandlers(): void {
    this.eventBus.on('token:dragStart', this.handleDragStart.bind(this));
    this.eventBus.on('token:dragMove', this.handleDragMove.bind(this));
    this.eventBus.on('token:dragEnd', this.handleDragEnd.bind(this));
    this.eventBus.on('token:dragCancel', this.handleDragCancel.bind(this));

    this.logger.debug('Drag event handlers registered');
  }

  /**
   * Updates overlays during drag operations.
   * Only processes overlays configured for drag triggers.
   */
  private async updateDragOverlays(
    placeableTokens: TokenState[],
    isGM: boolean,
    userColour: string
  ): Promise<void> {
    const dragOverlays = this.overlayRegistry.getAll()
      .filter(overlay => overlay.triggers?.tokenDrag === true);

    if (dragOverlays.length === 0) {
      return;
    }

    const { controlled, owned, targetTokens } = this.overlayHelper.categoriseTokensForOverlayRendering(
      placeableTokens,
      { includeAll: true }
    );

    this.logger.debug('Updating drag overlays', {
      dragOverlayCount: dragOverlays.length,
      targetTokenCount: targetTokens.length
    });

    const overlaysWithContextBuilders = this.prepareOverlaysWithContextBuilders(dragOverlays);

    await this.overlayHelper.requestOverlayRendering(
      controlled,
      owned,
      targetTokens,
      overlaysWithContextBuilders,
      isGM,
      (overlayId, targetToken, isGM) =>
        this.buildContextForOverlay(overlayId, targetToken, isGM, userColour, overlaysWithContextBuilders)
    );
  }

  /**
   * Prepares overlays with their context builders.
   */
  private prepareOverlaysWithContextBuilders(overlays: OverlayDefinition[]): OverlayDefinition[] {
    return overlays.map(overlay => {
      if (!overlay.contextBuilder) {
        const builder = this.getContextBuilder(overlay);
        if (builder) {
          return { ...overlay, contextBuilder: builder };
        }
        this.logger.warn(`No context builder found for overlay ${overlay.id}`, {
          overlayId: overlay.id,
          registryHasBuilder: this.contextBuilderRegistry.get(overlay.id) !== undefined,
          availableBuilders: Array.from(this.contextBuilderRegistry.getAll().keys())
        });
      }
      return overlay;
    }).filter(overlay => overlay.contextBuilder);
  }

  /**
   * Builds context for a specific overlay.
   * This method is called by OverlayCoordinatorHelper after permission checks.
   */
  private buildContextForOverlay(
    overlayId: string,
    targetToken: GridlessToken,
    isGM: boolean,
    userColour: string,
    overlaysWithBuilders: OverlayDefinition[]
  ): OverlayRenderContext {
    const overlay = overlaysWithBuilders.find(o => o.id === overlayId);
    const contextBuilder = overlay?.contextBuilder || this.getContextBuilder({ id: overlayId } as OverlayDefinition);

    if (!contextBuilder) {
      throw new Error(`No context builder found for overlay ${overlayId}`);
    }

    return contextBuilder.buildContext(targetToken, {
      isGM,
      userColour,
      isControlled: targetToken.controlled,
    });
  }

  /**
   * Gets the appropriate context builder for an overlay.
   */
  private getContextBuilder(overlay: OverlayDefinition) {
    if (overlay.contextBuilder) {
      return overlay.contextBuilder;
    }

    const builder = this.contextBuilderRegistry.get(overlay.id);
    if (builder) {
      return builder;
    }

    return this.contextBuilderRegistry.get('boundary-standard');
  }

  /**
   * Cleans up drag operation for a specific token.
   * Hides overlays and removes drag state.
   */
  private async cleanupDragOperation(): Promise<void> {

    this.clearObstacleIndicatorOverlays();

    this.hideAllDragOverlays();
  }

  /**
   * Hides all drag-triggered overlays.
   */
  private async hideAllDragOverlays(): Promise<void> {
    try {
      const dragOverlays = this.overlayRegistry.getAll()
        .filter(overlay => overlay.triggers?.tokenDrag === true);

      if (dragOverlays.length === 0) {
        return;
      }

      this.logger.debug('Hiding all drag overlays', {
        dragOverlayCount: dragOverlays.length
      });

      for (const overlay of dragOverlays) {
        this.overlayRenderer.hideAllOverlaysOfType(overlay.id);
      }
    } catch (error) {
      this.logger.error('Error hiding drag overlays', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}