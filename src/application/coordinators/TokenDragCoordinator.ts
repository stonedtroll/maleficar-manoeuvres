/**
 * 
 * Manages token drag operations and coordinates drag-triggered overlay rendering. 
 */

import type { EventBus } from '../../infrastructure/events/EventBus.js';
import type {
  TokenDragStartEvent,
  TokenDragMoveEvent,
  TokenDragEndEvent,
  TokenDragCancelEvent
} from '../../infrastructure/events/FoundryEvents.js';
import type { OverlayDefinition, OverlayTriggers } from '../../domain/interfaces/OverlayDefinition.js';
import type { OverlayRenderingService } from '../../presentation/services/OverlayRenderingService.js';
import type { OverlayRegistry } from '../registries/OverlayRegistry.js';
import type { OverlayContextBuilderRegistry } from '../registries/OverlayContextBuilderRegistry.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

import { Token } from '../../domain/entities/Token.js';
import { OverlayCoordinatorHelper } from './helpers/OverlayCoordinatorHelper.js';
import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MovementValidator } from '../../domain/services/MovementValidator.js';
import { MovementConfigurationService } from '../../domain/services/MovementConfigurationService.js';
import { MODULE_ID } from '../../config.js';
import { SpatialEntity } from '../../domain/interfaces/SpatialEntity.js';
import { TokenRepository } from '../../infrastructure/repositories/TokenRepository.js';

export class TokenDragCoordinator {
  private readonly logger: FoundryLogger;
  private readonly overlayHelper: OverlayCoordinatorHelper;
  private previousBlocker: SpatialEntity | null = null;
  private readonly dragOverlaysCache = new Map<string, Set<string>>();

  constructor(
    private readonly overlayRenderer: OverlayRenderingService,
    private readonly overlayRegistry: OverlayRegistry,
    private readonly contextBuilderRegistry: OverlayContextBuilderRegistry,
    private readonly movementValidator: MovementValidator,
    private readonly eventBus: EventBus,
    private readonly tokenRepository: TokenRepository
  ) {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.TokenDragCoordinator`);


    this.overlayHelper = new OverlayCoordinatorHelper(
      overlayRenderer
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
      this.logger.debug('Token dragging started', {
        tokenId: event.dragTokenId,
      });

      await this.updateObstacleIndicatorOverlays(event.dragTokenId);
      await this.updateOverlays(event.dragTokenId, 'tokenDragStart');
    } catch (error) {
      this.logger.error('Error in handleDragStart', {
        error: error instanceof Error ? error.message : String(error),
        tokenId: event.dragTokenId
      });
    }
  }

  /**
   * Handles active dragging events.
   * Updates current position and refreshes overlays if needed.
   */
  async handleDragMove(event: TokenDragMoveEvent): Promise<void> {
    try {
      await this.updateObstacleIndicatorOverlays(event.dragTokenId);
      await this.updateOverlays(event.dragTokenId, 'tokenDragMove');
    } catch (error) {
      this.logger.error('Error in handleDragMove', {
        error: error instanceof Error ? error.message : String(error),
        tokenId: event.dragTokenId
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
        eventId: event.dragTokenId
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

  private filterObstacles(obstacles: SpatialEntity[], movingTokenId?: string): SpatialEntity[] {
    return obstacles.filter(obstacle => {

      if (movingTokenId && obstacle.id === movingTokenId) {
        return false;
      }

      const isHidden = (obstacle as any).hidden;
      const isVisible = (obstacle as any).visible;

      if (isHidden === true) {
        return false;
      }

      if (isVisible === false) {
        return false;
      }

      return true;
    });
  }

  /**
 * Validates movement using MovementValidator and updates obstacle overlays
 */
  private async updateObstacleIndicatorOverlays(dragTokenId: string): Promise<void> {
    try {
      const allTokens = this.tokenRepository.getAll();
      const dragStartToken = this.tokenRepository.getById(dragTokenId);
      const previewToken = this.tokenRepository.getPreviewToken(dragTokenId);

      // Early exit if we don't have the required tokens
      if (!dragStartToken || !previewToken) {
        this.logger.warn('Cannot validate movement - missing required tokens', {
          dragTokenId,
          hasDragStartToken: !!dragStartToken,
          hasPreviewToken: !!previewToken
        });
        return;
      }

      const filteredObstacles = this.filterObstacles(allTokens, dragTokenId);

      const validationResult = this.movementValidator.validateMovement(
        dragStartToken,
        previewToken,
        filteredObstacles
      );

      const currentBlocker = validationResult.blockers?.[0] ?? null;

      if (currentBlocker && validationResult.type === 'blocked') {
        await this.handleObstacleDetected(currentBlocker);
      } else if (validationResult.type !== 'ignored') {
        await this.handleObstacleClear();
      }

    } catch (error) {
      this.logger.error('Error validating movement and updating overlays', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handles when an obstacle is detected during movement.
   * Only renders if the obstacle has changed from the previous one.
   */
  private async handleObstacleDetected(currentBlocker: SpatialEntity): Promise<void> {
    if (this.previousBlocker?.id === currentBlocker.id) {
      return;
    }

    await this.clearObstacleIndicatorOverlays();

    if (MovementConfigurationService.shouldValidateMovement()) {
      await this.renderObstacleIndicatorOverlays(currentBlocker as Token);
    }

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
   * Renders obstacle indicator overlay on a specific token
   */
  private async renderObstacleIndicatorOverlays(obstacle: Token): Promise<void> {
    try {
      const obstacleIndicatorOverlay = this.overlayRegistry.get('obstacle-indicator');
      if (!obstacleIndicatorOverlay) {
        this.logger.warn('Obstacle indicator overlay definition not found');
        return;
      }

      const overlaysWithContextBuilders = this.overlayHelper.prepareOverlaysWithContextBuilders([obstacleIndicatorOverlay], this.contextBuilderRegistry);

      if (overlaysWithContextBuilders.length === 0) {
        this.logger.warn('No context builder available for obstacle indicator overlay');
        return;
      }

      await this.overlayHelper.requestOverlayRendering(
        [obstacle],
        overlaysWithContextBuilders,
        (overlayId, targetToken) =>
          this.overlayHelper.buildContextForOverlay(
            overlayId,
            targetToken,
            overlaysWithContextBuilders,
            this.contextBuilderRegistry
          )
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

  private async updateOverlays(dragTokenId: string, trigger: keyof OverlayTriggers): Promise<void> {
    const dragOverlays = this.overlayRegistry.filterByTrigger(trigger);

    if (dragOverlays.length === 0) {
      return;
    }

    // Process overlays by scope and render them
    const overlayGroups = await this.overlayHelper.processOverlaysByScope(
      dragOverlays,
      this.contextBuilderRegistry,
      trigger,
      dragTokenId
    );

    for (const { targetTokens, overlays } of overlayGroups) {
      this.trackDragOverlays(targetTokens, overlays);
    }
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
 * Tracks drag overlays for efficient cleanup when key is released.
 */
  private trackDragOverlays(
    targetTokens: Token[],
    overlays: OverlayDefinition[]
  ): void {
    const overlayIds = new Set(overlays.map(overlay => overlay.id));

    for (const token of targetTokens) {
      if (overlayIds.size === 0) continue;

      // Merge with existing tracked overlays for this token
      const existingOverlays = this.dragOverlaysCache.get(token.id) ?? new Set<string>();
      const combinedOverlays = new Set([...existingOverlays, ...overlayIds]);

      this.dragOverlaysCache.set(token.id, combinedOverlays);
    }
  }

  /**
   * Hides all M-key overlays and clears tracking cache.
   */
  private async hideAllDragOverlays(): Promise<void> {
    const overlayTypesToHide = this.collectUniqueOverlayTypes();

    for (const overlayTypeId of overlayTypesToHide) {
      this.overlayRenderer.hideAllOverlaysOfType(overlayTypeId);
    }

    this.dragOverlaysCache.clear();
  }

  /**
   * Collects all unique overlay type IDs from the tracking cache.
   */
  private collectUniqueOverlayTypes(): Set<string> {
    const uniqueTypes = new Set<string>();

    for (const overlayIds of this.dragOverlaysCache.values()) {
      overlayIds.forEach(id => uniqueTypes.add(id));
    }

    return uniqueTypes;
  }
}