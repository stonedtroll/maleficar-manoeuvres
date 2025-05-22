/**
 * Token Movement Service
 * 
 * Handles the infrastructure layer concerns for token movement in Foundry VTT.
 * Acts as the bridge between domain events and Foundry's canvas/document system.
 */
import type { EventBus } from '../events/EventBus.js';
import type { TokenMovedEvent } from '../events/DomainEvents.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';


export class TokenMovementService {
  private readonly logger: FoundryLogger;

  // Event handler bindings (stored for cleanup)
  private readonly boundHandlers: Map<string, Function>;

  constructor(private readonly eventBus: EventBus) {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.TokenMovementService`);
    this.boundHandlers = new Map();
    this.initialise();
  }

  /**
   * Initialise the service and register event handlers
   */
  private initialise(): void {
    this.registerEventHandlers();
    this.logger.info('Token movement service initialised');
  }

  /**
   * Register all event handlers with proper binding
   */
  private registerEventHandlers(): void {
    // Create bound handlers for proper cleanup
    const movedHandler = this.handleTokenMoved.bind(this);
    
    this.boundHandlers.set('token.moved', movedHandler);
    
    // Register with event bus
    this.eventBus.on('token.moved', movedHandler);
  }

  /**
   * Handle successful token movement events
   * Updates the token document and provides visual feedback
   */
  private async handleTokenMoved(event: TokenMovedEvent): Promise<void> {
    try {
      const token = this.getCanvasToken(event.tokenId);
      if (!token) return;

      // Only process if this client initiated the movement (token is controlled)
      if (!token.controlled && !game.user?.isGM) {
        this.logger.debug('Skipping token update - not controlled by current user', { 
          tokenId: event.tokenId,
          userId: game.user?.id
        });
        return;
      }

      this.logger.debug('Processing token movement', { 
        tokenId: event.tokenId,
        from: event.fromPosition,
        to: event.toPosition,
        distance: event.distance,
        isSnapped: event.isSnapped
      });

      // Update token position with validation flag
      await this.updateTokenPosition(token, event.toPosition, event.isSnapped);

    } catch (error) {
      this.logger.error('Failed to handle token movement', error);
    }
  }

  /**
   * Get a token from the canvas by ID
   */
  private getCanvasToken(tokenId: string): Token | null {
    const token = canvas.tokens?.get(tokenId);
    if (!token) {
      this.logger.warn('Token not found on canvas', { tokenId });
      return null;
    }
    return token;
  }

  /**
   * Update token document position
   */
  private async updateTokenPosition(
    token: Token, 
    position: { x: number; y: number }, 
    isSnapped: boolean
  ): Promise<void> {
    const updateData = {
      x: position.x,
      y: position.y
    };

    const updateOptions = {
      animate: !isSnapped, // Avoid double animation for snapped movements
      maleficarManoeuvresValidatedMove: true // Skip re-validation
    };

    await token.document.update(updateData, updateOptions);
  }
}