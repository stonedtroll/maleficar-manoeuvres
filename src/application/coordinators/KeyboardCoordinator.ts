/**
 * @fileoverview Keyboard Coordinator
 * 
 * Coordinates keyboard input and manages keyboard-triggered overlay rendering. This service acts as the
 * bridge between keyboard events and overlay display, managing active key states
 * and determining which overlays should be visible based on user input.
 */

import type { EventBus } from '../../infrastructure/events/EventBus.js';
import type {
  KeyboardKeyDownEvent,
  KeyboardKeyUpEvent,
  TokenState
} from '../../infrastructure/events/FoundryEvents.js';
import type { OverlayDefinition } from '../../domain/interfaces/OverlayDefinition.js';
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

/**
 * Coordinates keyboard input and manages keyboard-triggered overlay rendering.
 * 
 * Responsibilities:
 * - Track and manage active key press states
 * - Process keyboard events and determine which overlays to display
 * - Manage special key behaviours (e.g., M key for showing all boundaries)
 * - Build keyboard-specific render contexts for overlay display
 * - Clean up overlays when keys are released
 * 
 * Not responsible for:
 * - Raw keyboard event detection (handled by infrastructure layer)
 * - Direct overlay rendering (handled by OverlayRenderingService)
 * - Token movement or selection logic
 * - Permission enforcement (delegated to OverlayPermissionCoordinator)
 */
export class KeyboardCoordinator {
  private readonly logger: FoundryLogger;
  private readonly activeKeys = new Set<string>();
  private readonly mKeyOverlays = new Map<string, Set<string>>();
  private readonly overlayHelper: OverlayCoordinatorHelper;
  private readonly tokenStateAdapter: TokenStateAdapter;

  /**
   * Special key that shows all token overlays when held.
   */
  private static readonly SHOW_ALL_KEY = 'm';

  /**
   * Default overlay rendering style. //TODO Move to definition
   */
  private static readonly DEFAULT_OVERLAY_STYLE = {
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
    private readonly overlayRenderer: OverlayRenderingService,
    private readonly overlayRegistry: OverlayRegistry,
    private readonly permissionCoordinator: OverlayPermissionCoordinator,
    private readonly eventBus: EventBus,
    tokenStateAdapter?: TokenStateAdapter
  ) {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.KeyboardCoordinator`);
    this.tokenStateAdapter = tokenStateAdapter ?? new TokenStateAdapter();
    
    this.overlayHelper = new OverlayCoordinatorHelper(
      overlayRenderer,
      permissionCoordinator,
      this.tokenStateAdapter
    );
    
    this.registerEventHandlers();
    
    this.logger.info('KeyboardCoordinator initialised');
  }

  /**
   * Handles keyboard key down events.
   */
  async handleKeyDown(event: KeyboardKeyDownEvent): Promise<void> {
    const normalisedKey = event.key.toLowerCase();
    
    // Ignore repeated key down events
    if (this.activeKeys.has(normalisedKey)) {
      return;
    }
    
    this.activeKeys.add(normalisedKey);
    
    this.logger.debug('Key pressed', { 
      key: normalisedKey, 
      activeKeys: Array.from(this.activeKeys) 
    });
    
    await this.updateOverlaysForKeyboardState(event.placeableTokens, event.user.isGM);
  }

  /**
   * Handles keyboard key up events.
   */
  async handleKeyUp(event: KeyboardKeyUpEvent): Promise<void> {
    const normalisedKey = event.key.toLowerCase();
    
    // Ignore if key wasn't tracked as active
    if (!this.activeKeys.has(normalisedKey)) {
      return;
    }
    
    this.activeKeys.delete(normalisedKey);
    
    this.logger.debug('Key released', { 
      key: normalisedKey, 
      activeKeys: Array.from(this.activeKeys) 
    });
    
    await this.updateOverlaysForKeyboardState(event.placeableTokens, event.user.isGM);
  }

  /**
   * Clears all active key states.
   * Useful for cleanup or when focus is lost.
   */
  clearAllKeys(): void {
    const keyCount = this.activeKeys.size;
    this.activeKeys.clear();
    
    this.logger.debug('Cleared all key states', { 
      previousCount: keyCount 
    });
  }

  /**
   * Gets the current active keys.
   */
  getActiveKeys(): ReadonlySet<string> {
    return new Set(this.activeKeys);
  }

  /**
   * Registers event handlers for keyboard events.
   */
  private registerEventHandlers(): void {
    this.eventBus.on('keyboard:keyDown', this.handleKeyDown.bind(this));
    this.eventBus.on('keyboard:keyUp', this.handleKeyUp.bind(this));
    
    this.logger.debug('Keyboard event handlers registered');
  }

  /**
   * Updates overlay visibility based on current keyboard state.
   */
  private async updateOverlaysForKeyboardState(
    placeableTokens: TokenState[], 
    isGM: boolean
  ): Promise<void> {
    const isMKeyPressed = this.activeKeys.has(KeyboardCoordinator.SHOW_ALL_KEY);

    // Handle M key release - hide all M key overlays
    if (!isMKeyPressed && this.mKeyOverlays.size > 0) {
      await this.hideAllMKeyOverlays();
      return;
    }

    // No keys pressed - nothing to display
    if (this.activeKeys.size === 0) {
      return;
    }

    // Find overlays triggered by keyboard shortcuts
    const keyTriggeredOverlays = this.findKeyTriggeredOverlays();
    if (keyTriggeredOverlays.length === 0) {
      return;
    }

    // Separate M key overlays from other key overlays
    const { mKeyOverlays, otherKeyOverlays } = this.separateOverlaysByType(keyTriggeredOverlays);

    // Categorise tokens for rendering
    const { controlled, owned, targetTokens } = this.overlayHelper.categoriseTokensForOverlayRendering(
      placeableTokens,
      { includeAll: isMKeyPressed }
    );

    if (targetTokens.length === 0) {
      return;
    }

    // Render overlays for non-M keys
    if (otherKeyOverlays.length > 0) {
      await this.renderKeyOverlays(
        controlled,
        owned,
        targetTokens,
        otherKeyOverlays,
        isGM
      );
    }

    // Render and track M key overlays
    if (isMKeyPressed && mKeyOverlays.length > 0) {
      await this.renderAndTrackMKeyOverlays(
        controlled,
        owned,
        targetTokens,
        mKeyOverlays,
        isGM
      );
    }
  }

  /**
   * Finds all overlays that can be triggered by keyboard shortcuts.
   */
  private findKeyTriggeredOverlays(): OverlayDefinition[] {
    return this.overlayRegistry.getAll()
      .filter(overlay => overlay.triggers?.keyPress?.length);
  }

  /**
   * Separates overlays into M key and other key categories.
   */
  private separateOverlaysByType(overlays: OverlayDefinition[]): {
    mKeyOverlays: OverlayDefinition[];
    otherKeyOverlays: OverlayDefinition[];
  } {
    const mKeyOverlays = overlays.filter(overlay => 
      overlay.triggers?.keyPress?.includes(KeyboardCoordinator.SHOW_ALL_KEY)
    );
    
    const otherKeyOverlays = overlays.filter(overlay => {
      const keyPress = overlay.triggers?.keyPress;
      return keyPress?.some(key => 
        key !== KeyboardCoordinator.SHOW_ALL_KEY && 
        this.activeKeys.has(key.toLowerCase())
      );
    });

    return { mKeyOverlays, otherKeyOverlays };
  }

  /**
   * Renders overlays for standard keyboard shortcuts.
   */
  private async renderKeyOverlays(
    controlled: GridlessToken[],
    owned: GridlessToken[],
    targetTokens: GridlessToken[],
    overlays: OverlayDefinition[],
    isGM: boolean
  ): Promise<void> {
    await this.overlayHelper.requestOverlayRendering(
      controlled,
      owned,
      targetTokens,
      overlays,
      isGM,
      (overlayId, targetToken, isGM) => 
        this.buildKeyboardRenderContext(overlayId, targetToken, isGM)
    );
  }

  /**
   * Renders and tracks M key overlays for later cleanup.
   */
  private async renderAndTrackMKeyOverlays(
    controlled: GridlessToken[],
    owned: GridlessToken[],
    targetTokens: GridlessToken[],
    overlays: OverlayDefinition[],
    isGM: boolean
  ): Promise<void> {
    // Clear previous M key overlay tracking
    this.mKeyOverlays.clear();

    // Render overlays
    await this.overlayHelper.requestOverlayRendering(
      controlled,
      owned,
      targetTokens,
      overlays,
      isGM,
      (overlayId, targetToken, isGM) => 
        this.buildKeyboardRenderContext(overlayId, targetToken, isGM)
    );

    // Track M key overlays for cleanup
    const overlayIds = new Set(overlays.map(overlay => overlay.id));
    for (const token of targetTokens) {
      if (overlayIds.size > 0) {
        this.mKeyOverlays.set(token.id, new Set(overlayIds));
      }
    }
  }

  /**
   * Builds render context for keyboard-triggered overlays.
   */
  private buildKeyboardRenderContext(
    overlayTypeId: string,
    targetToken: GridlessToken,
    isGM: boolean
  ): OverlayRenderContext {
    const style = KeyboardCoordinator.DEFAULT_OVERLAY_STYLE;
    
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
   * Hides all M key overlays across all tokens.
   */
  private async hideAllMKeyOverlays(): Promise<void> {
    this.logger.debug('Hiding M key overlays', {
      tokenCount: this.mKeyOverlays.size
    });

    // Get unique M key overlay types
    const mKeyOverlayTypes = new Set<string>();
    for (const overlayIds of this.mKeyOverlays.values()) {
      overlayIds.forEach(id => mKeyOverlayTypes.add(id));
    }

    // Hide each overlay type
    for (const overlayTypeId of mKeyOverlayTypes) {
      this.overlayRenderer.hideAllOverlaysOfType(overlayTypeId);
    }

    // Clear tracking
    this.mKeyOverlays.clear();
  }
}