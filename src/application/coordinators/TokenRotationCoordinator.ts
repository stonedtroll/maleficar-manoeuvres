/**
 * Manages synchronisation between token rotation events and overlay rendering. This coordinator processes token rotation
 * updates and ensures that rotation-sensitive overlays (such as facing arcs) are
 * updated in real-time to reflect the current token orientation.
 * 
 * Features:
 * - Real-time rotation overlay updates
 * - Disposition-based colour coding for facing arcs
 * - Permission-aware overlay rendering
 * - Optimised batch processing for multiple tokens
 * - Support for both rotation and position changes
 */

import type { 
  TokenControlEvent, 
  TokenState, 
  TokenUpdateEvent, 
  TokensReadyEvent 
} from '../../infrastructure/events/FoundryEvents.js';
import type { ApplicationReadyEvent } from '../../infrastructure/events/DomainEvents.js';
import type { OverlayRenderContext } from '../../domain/interfaces/OverlayRenderContext.js';
import type { OverlayRegistry } from '../registries/OverlayRegistry.js';
import type { OverlayPermissionCoordinator } from './OverlayPermissionCoordinator.js';
import type { OverlayRenderingService } from '../../presentation/services/OverlayRenderingService.js';
import type { EventBus } from '../../infrastructure/events/EventBus.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { RotationService } from '../../domain/services/RotationService.js';
import { MODULE_ID } from '../../config.js';
import { GridlessToken } from '../../domain/entities/GridlessToken.js';
import { OverlayCoordinatorHelper } from './helpers/OverlayCoordinatorHelper.js';
import { TokenStateAdapter } from '../adapters/TokenStateAdapter.js';
import { Vector2 } from '../../domain/value-objects/Vector2.js';

/**
 * Token disposition values.
 */
enum TokenDisposition {
  SECRET = -2,
  HOSTILE = -1,
  NEUTRAL = 0,
  FRIENDLY = 1
}

/**
 * Colour mapping for token dispositions.
 */
const DISPOSITION_COLOURS = {
  [TokenDisposition.SECRET]: '#2A0F37',   
  [TokenDisposition.HOSTILE]: '#8C0000',  
  [TokenDisposition.NEUTRAL]: '#6B6B6B',  
  [TokenDisposition.FRIENDLY]: '#4D5D43' 
} as const;

/**
 * Default arc colour for unspecified dispositions.
 */
const DEFAULT_ARC_COLOUR = '#8A6A1C'; 

export class TokenRotationCoordinator {
  private readonly logger: FoundryLogger;
  private readonly rotationService: RotationService;
  private readonly overlayHelper: OverlayCoordinatorHelper;
  private readonly tokenStateAdapter: TokenStateAdapter;
  private readonly applicationReadyPromise: Promise<void>;

  constructor(
    private readonly overlayRegistry: OverlayRegistry,
    private readonly permissionCoordinator: OverlayPermissionCoordinator,
    private readonly overlayRenderingService: OverlayRenderingService,
    private readonly eventBus: EventBus,
    tokenStateAdapter?: TokenStateAdapter
  ) {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.TokenRotationCoordinator`);
    this.rotationService = new RotationService();
    this.tokenStateAdapter = tokenStateAdapter ?? new TokenStateAdapter();
    
    this.overlayHelper = new OverlayCoordinatorHelper(
      overlayRenderingService,
      permissionCoordinator,
      this.tokenStateAdapter
    );
    
    // Set up application ready promise for synchronisation
    this.applicationReadyPromise = new Promise(resolve => {
      this.eventBus.once('application.ready', (event: ApplicationReadyEvent) => {
        this.logger.debug('Application ready event received', event);
        resolve();
      });
    });
    
    this.registerEventHandlers();
    
    this.logger.info('TokenRotationCoordinator initialised');
  }

  /**
   * Handles token control events.
   * Updates rotation overlays when a token is selected or deselected.
   */
  async handleTokenControl(event: TokenControlEvent): Promise<void> {
    try {
      this.logger.debug('Handling token control event', {
        tokenId: event.token.id,
        controlled: event.token.controlled
      });

      // Update overlays for the controlled token
      await this.updateRotationOverlays(
        [event.token], 
        event.user.isGM, 
        event.user.colour
      );
    } catch (error) {
      this.logger.error('Error handling token control', {
        error: error instanceof Error ? error.message : String(error),
        tokenId: event?.token?.id
      });
    }
  }

  /**
   * Handles tokens ready event.
   * Initialises rotation overlays for all visible tokens on canvas ready.
   */
  async handleTokensReady(event: TokensReadyEvent): Promise<void> {
    try {
      this.logger.debug('Received tokens ready event');
      
      // Wait for application to be fully ready
      await this.applicationReadyPromise;
      
      this.logger.debug('Updating rotation overlays');
      await this.updateRotationOverlays(
        event.placeableTokens, 
        event.user.isGM, 
        event.user.colour
      );
    } catch (error) {
      this.logger.error('Error handling tokens ready', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Handles token update events.
   * Processes rotation and position changes to update relevant overlays.
   */
  async handleTokenUpdate(event: TokenUpdateEvent): Promise<void> {
    try {
      // Check if update includes rotation or position changes
      if (!this.hasRelevantChanges(event.changedState)) {
        return;
      }

      this.logger.debug(`Processing token update for: ${event.currentState.name} [${event.id}]`, {
        changedState: event.changedState
      });

      await this.updateRotationOverlays(
        event.placeableTokens, 
        event.user.isGM, 
        event.user.colour, 
        event.changedState
      );
    } catch (error) {
      this.logger.error('Error handling token update', {
        error: error instanceof Error ? error.message : String(error),
        tokenId: event?.id
      });
    }
  }

  /**
   * Registers event handlers for token events.
   */
  private registerEventHandlers(): void {
    this.eventBus.on('token:update', this.handleTokenUpdate.bind(this));
    this.eventBus.on('tokens:ready', this.handleTokensReady.bind(this));
    this.eventBus.on('token:control', this.handleTokenControl.bind(this));
    
    this.logger.debug('Token rotation event handlers registered');
  }

  /**
   * Checks if state changes include rotation or position updates.
   */
  private hasRelevantChanges(changedState: Partial<TokenState>): boolean {
    return changedState.rotation !== undefined || 
           changedState.x !== undefined || 
           changedState.y !== undefined;
  }

  /**
   * Updates rotation overlays for affected tokens.
   */
  private async updateRotationOverlays(
    placeableTokens: TokenState[], 
    isGM: boolean, 
    userColour: string, 
    changedState?: Partial<TokenState>
  ): Promise<void> {
    // Find overlays that respond to rotation
    const rotationOverlays = this.overlayRegistry.getAll()
      .filter(overlay => overlay.updateOn?.tokenRotate === true);
    
    if (rotationOverlays.length === 0) {
      this.logger.debug('No rotation overlays configured');
      return;
    }

    // Categorise tokens for rendering
    const { controlled, owned, targetTokens } = this.overlayHelper.categoriseTokensForOverlayRendering(
      placeableTokens,
      { includeAll: true }
    );

    // Apply state changes if provided
    const tokensToRender = changedState 
      ? this.applyStateChanges(targetTokens, controlled, changedState)
      : targetTokens;

    // Request overlay rendering
    await this.overlayHelper.requestOverlayRendering(
      controlled,
      owned,
      tokensToRender,
      rotationOverlays,
      isGM,
      (overlayId, targetToken, isGM) => 
        this.buildRotationRenderContext(overlayId, targetToken, isGM, userColour)
    );
  }

  /**
   * Applies state changes to controlled tokens.
   */
  private applyStateChanges(
    targetTokens: GridlessToken[],
    controlledTokens: GridlessToken[],
    changedState: Partial<TokenState>
  ): GridlessToken[] {
    const controlledIds = new Set(controlledTokens.map(t => t.id));
    
    return targetTokens.map(token => {
      if (!controlledIds.has(token.id)) {
        return token;
      }

      // Apply rotation if changed
      if (changedState.rotation !== undefined) {
        token.rotate(changedState.rotation);
      }

      // Apply position changes if changed
      if (changedState.x !== undefined || changedState.y !== undefined) {
        const newPosition = new Vector2(
          changedState.x ?? token.position.x,
          changedState.y ?? token.position.y
        );
        token.move(newPosition);
      }

      return token;
    });
  }

  /**
   * Builds render context for rotation overlays.
   */
  private buildRotationRenderContext(
    overlayTypeId: string,
    targetToken: GridlessToken,
    isGM: boolean,
    userColour: string
  ): OverlayRenderContext {
    // Determine arc colour based on control state and disposition
    const arcColour = this.determineArcColour(targetToken, userColour);

    return {
      overlayTypeId,
      overlayCentre: {
        x: targetToken.centre.x,
        y: targetToken.centre.y
      },
      renderTarget: 'world',
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
        radius: targetToken.radius + 2
      },
      rotation: {
        currentRotation: targetToken.rotation.degrees,
        isSnapped: false,
        arcColour,
        arcAngle: 20
      },
      user: {
        isGM
      }
    };
  }

  /**
   * Determines the arc colour based on token state.
   */
  private determineArcColour(token: GridlessToken, userColour: string): string {
    // Controlled tokens use the user's colour
    if (token.controlled) {
      return userColour;
    }

    // Otherwise use disposition-based colour
    return DISPOSITION_COLOURS[token.disposition as TokenDisposition] ?? DEFAULT_ARC_COLOUR;
  }
}