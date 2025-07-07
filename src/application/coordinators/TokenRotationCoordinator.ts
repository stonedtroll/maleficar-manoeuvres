/**
 * TODO: No longer needed. Should delete this file.
 */
import type { 
  TokenState, 
  TokenUpdateEvent
} from '../../infrastructure/events/FoundryEvents.js';
import type { OverlayRegistry } from '../registries/OverlayRegistry.js';
import type { OverlayPermissionCoordinator } from './OverlayPermissionCoordinator.js';
import type { OverlayRenderingService } from '../../presentation/services/OverlayRenderingService.js';
import type { EventBus } from '../../infrastructure/events/EventBus.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { RotationService } from '../../domain/services/RotationService.js';
import { MODULE_ID } from '../../config.js';
import { OverlayCoordinatorHelper } from './helpers/OverlayCoordinatorHelper.js';
import { TokenStateAdapter } from '../adapters/TokenStateAdapter.js';
// import { RotationOverlayHelper } from './helpers/RotationOverlayHelper.js';

export class TokenRotationCoordinator {
  private readonly logger: FoundryLogger;
  private readonly rotationService: RotationService;
  private readonly overlayHelper: OverlayCoordinatorHelper;
  // private readonly rotationOverlayHelper: RotationOverlayHelper;
  private readonly tokenStateAdapter: TokenStateAdapter;

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
    
    // Create rotation overlay helper
    // this.rotationOverlayHelper = new RotationOverlayHelper(
    //   overlayRegistry,
    //   this.overlayHelper
    // );
    
    this.registerEventHandlers();
    
    this.logger.info('TokenRotationCoordinator initialised');
  }

  /**
   * Handles token update events.
   * Processes rotation and position changes to update relevant overlays.
   */
  async handleTokenUpdate(event: TokenUpdateEvent): Promise<void> {
    // try {
    //   // Check if update includes rotation or position changes
    //   if (!this.hasRelevantChanges(event.changedState)) {
    //     return;
    //   }

    //   this.logger.debug(`Processing token update for: ${event.currentState.name} [${event.id}]`, {
    //     changedState: event.changedState
    //   });

    //   // Delegate to helper
    //   await this.rotationOverlayHelper.updateRotationOverlays(
    //     event.placeableTokens, 
    //     event.user.isGM, 
    //     event.user.colour, 
    //     event.changedState
    //   );
    // } catch (error) {
    //   this.logger.error('Error handling token update', {
    //     error: error instanceof Error ? error.message : String(error),
    //     tokenId: event?.id
    //   });
    // }
  }

  /**
   * Registers event handlers for token events.
   */
  private registerEventHandlers(): void {
    this.eventBus.on('token:update', this.handleTokenUpdate.bind(this));
    
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
}