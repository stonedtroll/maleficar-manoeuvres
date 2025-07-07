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
  TokenDraggingEvent,
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
import { MODULE_ID } from '../../config.js';

export class TokenDragCoordinator {
  private readonly logger: FoundryLogger;
  private readonly dragStates = new Map<string, {
    readonly startPosition: { x: number; y: number };
    currentPosition: { x: number; y: number };
    isDragging: boolean;
  }>();
  private readonly overlayHelper: OverlayCoordinatorHelper;
  private readonly tokenStateAdapter: TokenStateAdapter;

  constructor(
    private readonly overlayRenderer: OverlayRenderingService,
    private readonly overlayRegistry: OverlayRegistry,
    private readonly permissionCoordinator: OverlayPermissionCoordinator,
    private readonly contextBuilderRegistry: OverlayContextBuilderRegistry,
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
      const { id, position } = event;

      this.logger.debug('Token drag started', {
        tokenId: id,
        position
      });

      // Initialise drag state
      this.dragStates.set(id, {
        startPosition: position,
        currentPosition: position,
        isDragging: true
      });

      // Update overlays for drag operation
      await this.updateDragOverlays(
        event.placeableTokens, 
        event.user.isGM,
        event.user.colour
      );
    } catch (error) {
      this.logger.error('Error in handleDragStart', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event?.id
      });
    }
  }

  /**
   * Handles active dragging events.
   * Updates current position and refreshes overlays if needed.
   */
  async handleDragging(event: TokenDraggingEvent): Promise<void> {
    try {
      const dragState = this.dragStates.get(event.id);
      if (!dragState?.isDragging) {
        return;
      }

      // Calculate delta from previous position
      const delta = {
        x: event.currentState.x - dragState.currentPosition.x,
        y: event.currentState.y - dragState.currentPosition.y
      };

      // Update current position
      dragState.currentPosition = { x: event.currentState.x, y: event.currentState.y };

      this.logger.debug('Token dragging', {
        tokenId: event.id,
        position: dragState.currentPosition,
        delta
      });

      // Update overlays if position has changed significantly
      // Optimise by checking distance threshold
      const distanceMoved = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
      if (distanceMoved > 5) { // Only update if moved more than 5 pixels
        await this.updateDragOverlays(
          event.placeableTokens, 
          event.user.isGM,
          event.user.colour
        );
      }
    } catch (error) {
      this.logger.error('Error in handleDragging', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event?.id
      });
    }
  }

  /**
   * Handles token drag end events.
   * Cleans up drag state and hides overlays.
   */
  async handleDragEnd(event: TokenDragEndEvent): Promise<void> {
    try {
      const { id } = event;
      const dragState = this.dragStates.get(id);

      if (!dragState?.isDragging) {
        this.logger.warn('Drag end without drag start', { tokenId: id });
        return;
      }

      this.logger.debug('Token drag ended', {
        tokenId: id,
        finalPosition: dragState.currentPosition,
        totalDelta: event.totalDelta,
        startPosition: dragState.startPosition
      });

      // Clean up overlays and state
      await this.cleanupDragOperation(id);
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
      const { id } = event;
      const dragState = this.dragStates.get(id);

      if (!dragState) {
        this.logger.debug('Drag cancel for token without drag state', { tokenId: id });
        return;
      }

      this.logger.debug('Token drag cancelled', { tokenId: id });

      // Clean up overlays and state
      await this.cleanupDragOperation(id);
    } catch (error) {
      this.logger.error('Error in handleDragCancel', {
        error: error instanceof Error ? error.message : String(error),
        eventId: event?.id
      });
    }
  }

  /**
   * Registers event handlers for drag events.
   */
  private registerEventHandlers(): void {
    this.eventBus.on('token:dragStart', this.handleDragStart.bind(this));
    this.eventBus.on('token:dragging', this.handleDragging.bind(this));
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
    // Filter overlays with drag triggers
    const dragOverlays = this.overlayRegistry.getAll()
      .filter(overlay => overlay.triggers?.tokenDrag === true);

    if (dragOverlays.length === 0) {
      return;
    }

    // Categorise tokens for overlay rendering
    const { controlled, owned, targetTokens } = this.overlayHelper.categoriseTokensForOverlayRendering(
      placeableTokens,
      { includeAll: true }
    );

    this.logger.debug('Updating drag overlays', {
      dragOverlayCount: dragOverlays.length,
      targetTokenCount: targetTokens.length
    });

    // Prepare overlays with context builders
    const overlaysWithContextBuilders = this.prepareOverlaysWithContextBuilders(dragOverlays);

    // Request overlay rendering
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
      // Ensure each overlay has a context builder
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

    // Get drag state for additional context
    const dragState = this.dragStates.get(targetToken.id);
    
    return contextBuilder.buildContext(targetToken, {
      isGM,
      userColour,
      isControlled: targetToken.controlled,
      isDragging: dragState?.isDragging ?? false,
      dragStartPosition: dragState?.startPosition,
      dragCurrentPosition: dragState?.currentPosition
    });
  }

  /**
   * Gets the appropriate context builder for an overlay.
   */
  private getContextBuilder(overlay: OverlayDefinition) {
    // Use overlay's own context builder if defined
    if (overlay.contextBuilder) {
      return overlay.contextBuilder;
    }

    // Fall back to registry
    const builder = this.contextBuilderRegistry.get(overlay.id);
    if (builder) {
      return builder;
    }

    // Fall back to default boundary builder
    return this.contextBuilderRegistry.get('boundary-standard');
  }

  /**
   * Cleans up drag operation for a specific token.
   * Hides overlays and removes drag state.
   */
  private async cleanupDragOperation(tokenId: string): Promise<void> {
    // Remove drag state
    this.dragStates.delete(tokenId);

    // Hide all overlays if no more drag operations
    if (this.dragStates.size === 0) {
      await this.hideAllDragOverlays();
    }
  }

  /**
   * Hides all drag-triggered overlays.
   */
  private async hideAllDragOverlays(): Promise<void> {
    try {
      // Get drag-triggered overlays
      const dragOverlays = this.overlayRegistry.getAll()
        .filter(overlay => overlay.triggers?.tokenDrag === true);

      if (dragOverlays.length === 0) {
        return;
      }

      this.logger.debug('Hiding all drag overlays', {
        dragOverlayCount: dragOverlays.length
      });

      // Clear each overlay type
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