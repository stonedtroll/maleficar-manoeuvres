/**
 * @fileoverview Token Drag Coordinator
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
import type { OverlayRenderContext } from '../../domain/interfaces/OverlayRenderContext.js';
import type { OverlayRenderingService } from '../../presentation/services/OverlayRenderingService.js';
import type { OverlayRegistry } from '../registries/OverlayRegistry.js';
import type { OverlayPermissionCoordinator } from './OverlayPermissionCoordinator.js';
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

  /**
   * Default overlay rendering style for drag operations. //TODO Move to definition
   */
  private static readonly DEFAULT_DRAG_STYLE = {
    borderLineWidth: 2,
    borderColour: '#4A2A1F',
    borderOpacity: 0.9,
    fillColour: '#2A3A28',
    fillOpacity: 0.5,
    boundaryStyle: 'circle' as const,
    dashed: false,
    dashLength: 0,
    gapLength: 0
  };

  constructor(
    private readonly overlayRenderingService: OverlayRenderingService,
    private readonly overlayRegistry: OverlayRegistry,
    private readonly permissionCoordinator: OverlayPermissionCoordinator,
    private readonly eventBus: EventBus,
    tokenStateAdapter?: TokenStateAdapter
  ) {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.TokenDragCoordinator`);
    this.tokenStateAdapter = tokenStateAdapter ?? new TokenStateAdapter();

    this.overlayHelper = new OverlayCoordinatorHelper(
      overlayRenderingService,
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
      await this.updateDragOverlays(event.placeableTokens, event.user.isGM);
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
    // try {
    //   const dragState = this.dragStates.get(event.id);
    //   if (!dragState?.isDragging) {
    //     return;
    //   }

    //   // Calculate delta from previous position
    //   const delta = {
    //     x: event.currentState.x - dragState.currentPosition.x,
    //     y: event.currentState.y - dragState.currentPosition.y
    //   };

    //   // Update current position
    //   dragState.currentPosition = { x: event.currentState.x, y: event.currentState.y };

    //   this.logger.debug('Token dragging', {
    //     tokenId: event.id,
    //     position: dragState.currentPosition,
    //     delta
    //   });

    //   // Update overlays if position has changed significantly
    //   // Optimise by checking distance threshold
    //   const distanceMoved = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
    //   if (distanceMoved > 5) { // Only update if moved more than 5 pixels
    //     await this.updateDragOverlays(event.placeableTokens, event.user.isGM);
    //   }
    // } catch (error) {
    //   this.logger.error('Error in handleDragging', {
    //     error: error instanceof Error ? error.message : String(error),
    //     eventId: event?.id
    //   });
    // }
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
  private async updateDragOverlays(placeableTokens: TokenState[], isGM: boolean): Promise<void> {
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

    // Request overlay rendering
    await this.overlayHelper.requestOverlayRendering(
      controlled,
      owned,
      targetTokens,
      dragOverlays,
      isGM,
      (overlayId, targetToken, isGM) => this.buildDragRenderContext(overlayId, targetToken, isGM)
    );
  }

  /**
   * Builds render context for drag-triggered overlays.
   */
  private buildDragRenderContext(
    overlayTypeId: string,
    targetToken: GridlessToken,
    isGM: boolean
  ): OverlayRenderContext {
    const style = TokenDragCoordinator.DEFAULT_DRAG_STYLE;

    return {
      overlayTypeId,
      renderTarget: 'world',
      overlayCentre: {
        x: targetToken.centre.x,
        y: targetToken.centre.y
      },
      token: {
        id: targetToken.id,
        name: targetToken.name,
        position: {
          x: targetToken.position.x,
          y: targetToken.position.y
        },
        width: targetToken.width,
        height: targetToken.height,
        centre: {
          x: targetToken.centre.x,
          y: targetToken.centre.y
        },
        radius: targetToken.radius
      },
      boundary: {
        borderLineWidth: style.borderLineWidth,
        borderColour: style.borderColour,
        borderOpacity: style.borderOpacity,
        borderRadius: targetToken.radius,
        fillColour: style.fillColour,
        fillOpacity: style.fillOpacity,
        fillRadius: targetToken.radius - 2,
        boundaryStyle: style.boundaryStyle,
        dashed: style.dashed,
        dashLength: style.dashLength,
        gapLength: style.gapLength
      },
      user: {
        isGM
      }
    };
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
        this.overlayRenderingService.hideAllOverlaysOfType(overlay.id);
      }
    } catch (error) {
      this.logger.error('Error hiding drag overlays', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}