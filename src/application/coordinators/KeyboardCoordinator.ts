/**
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
import type { OverlayContextBuilderRegistry } from '../registries/OverlayContextBuilderRegistry.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

import { GridlessToken } from '../../domain/entities/GridlessToken.js';
import { OverlayCoordinatorHelper } from './helpers/OverlayCoordinatorHelper.js';
import { TokenStateAdapter } from '../adapters/TokenStateAdapter.js';
import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';

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

  constructor(
    private readonly overlayRenderer: OverlayRenderingService,
    private readonly overlayRegistry: OverlayRegistry,
    private readonly permissionCoordinator: OverlayPermissionCoordinator,
    private readonly contextBuilderRegistry: OverlayContextBuilderRegistry,
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

    await this.updateOverlaysForKeyboardState(
      event.placeableTokens,
      event.user.isGM,
      event.user.colour
    );
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

    await this.updateOverlaysForKeyboardState(
      event.placeableTokens,
      event.user.isGM,
      event.user.colour
    );
  }

  /**
   * Clears all active key states.
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
    isGM: boolean,
    userColour: string
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
        isGM,
        userColour
      );
    }

    // Render and track M key overlays
    if (isMKeyPressed && mKeyOverlays.length > 0) {
      await this.renderAndTrackMKeyOverlays(
        controlled,
        owned,
        targetTokens,
        mKeyOverlays,
        isGM,
        userColour
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
    isGM: boolean,
    userColour: string
  ): Promise<void> {
    const overlaysWithContextBuilders = this.prepareOverlaysWithContextBuilders(overlays);

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
   * Renders and tracks M key overlays for later cleanup.
   */
  private async renderAndTrackMKeyOverlays(
    controlled: GridlessToken[],
    owned: GridlessToken[],
    targetTokens: GridlessToken[],
    overlays: OverlayDefinition[],
    isGM: boolean,
    userColour: string
  ): Promise<void> {
    // Clear previous M key overlay tracking
    this.mKeyOverlays.clear();

    this.logger.debug('Rendering M key overlays', {
      overlayCount: overlays.length,
    });

    const overlaysWithContextBuilders = this.prepareOverlaysWithContextBuilders(overlays);

    this.logger.debug('Prepared overlays with context builders', {
      overlayCount: overlaysWithContextBuilders.length,
    });

    // Render overlays
    await this.overlayHelper.requestOverlayRendering(
      controlled,
      owned,
      targetTokens,
      overlaysWithContextBuilders,
      isGM,
      (overlayId, targetToken, isGM) =>
        this.buildContextForOverlay(overlayId, targetToken, isGM, userColour, overlaysWithContextBuilders)
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
   * Prepares overlays with their context builders.
   * Filters overlays based on custom permissions if defined.
   */
  private prepareOverlaysWithContextBuilders(overlays: OverlayDefinition[]): OverlayDefinition[] {
    return overlays.map(overlay => {
      // Ensure each overlay has a context builder
      if (!overlay.contextBuilder) {
        const builder = this.getContextBuilder(overlay);
        if (builder) {
          return { ...overlay, contextBuilder: builder };
        }
      }
      this.logger.warn(`Overlay ${overlay.id} does not have a context builder defined`);
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
      activeKeys: this.activeKeys,
      isControlled: targetToken.controlled
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