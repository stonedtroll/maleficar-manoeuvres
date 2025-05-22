/**
 * System Event Adapter
 * 
 * TODO: Pay the technical debt troll.
 * 
 * Unified adapter that bridges Foundry VTT's event system with the module's event bus.
 * Translates system hooks into domain events.
 * 
 * This adapter follows the Hexagonal Architecture pattern, isolating Foundry-specific
 * implementation details from the core domain logic.
 * 
 * Key responsibilities:
 * - Hook registration and lifecycle management
 * - Event translation from Foundry to domain events
 * - Token state change detection and propagation
 * - Canvas lifecycle event handling
 * - Combat tracking and scene management
 * 
 * Event naming conventions:
 * - Infrastructure events use colon notation (e.g., 'token:update')
 * - All events are emitted through the EventBus for decoupling
 */

import { EventBus } from '../events/EventBus.js';
import { MODULE_ID } from '../../config.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import type {
  TokenCreateEvent,
  TokenDeleteEvent,
  TokenSelectedEvent,
  TokenDeselectedEvent,
  TokenUpdateEvent,
  TokenPreUpdateEvent,
  TokenRefreshEvent,
  TokenHoverEvent,
  TokenHoverEndEvent,
  TokenControlEvent,
  CanvasInitEvent,
  CanvasReadyEvent,
  CanvasTeardownEvent,
  ScenePreUpdateEvent,
  SceneUpdateEvent,
  WallUpdateEvent,
  SettingsCloseEvent,
  TokenState,
  TokensReadyEvent
} from '../events/FoundryEvents.js';
import type { InitialisableService } from '../../domain/interfaces/InitialisableService.js';

export class SystemEventAdapter implements InitialisableService {
  private readonly logger: FoundryLogger;
  private readonly registeredHooks: Map<string, number> = new Map();
  private isInitialised = false;

  constructor(private readonly eventBus: EventBus) {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.SystemEventAdapter`, { moduleIdColour: 'green' });
  }

  /**
   * Initialise the adapter and register all hooks
   */
  async initialise(): Promise<void> {
    if (this.isInitialised) {
      this.logger.warn('SystemEventAdapter already initialised, skipping');
      return;
    }

    this.logger.info('Initialising System Event Adapter');

    this.registerCanvasHooks();
    this.registerTokenHooks();
    this.registerSceneHooks();
    this.registerCombatHooks();
    this.registerSystemHooks();

    this.isInitialised = true;
    this.logger.info(`System Event Adapter initialised with ${this.registeredHooks.size} hooks`);
  }

  /**
   * Register canvas lifecycle hooks
   */
  private registerCanvasHooks(): void {
    this.registerHook('canvasInit', this.handleCanvasInit.bind(this));
    this.registerHook('canvasReady', this.handleCanvasReady.bind(this));
    this.registerHook('canvasTearDown', this.handleCanvasTearDown.bind(this));
    this.registerHook('canvasPan', this.handleCanvasPan.bind(this));

    this.logger.debug('Canvas hooks registered');
  }

  /**
   * Register token-related hooks
   */
  private registerTokenHooks(): void {
    // Token lifecycle
    this.registerHook('createToken', this.handleTokenCreated.bind(this));
    this.registerHook('deleteToken', this.handleTokenDeleted.bind(this));

    // Token interaction
    this.registerHook('controlToken', this.handleTokenControl.bind(this));
    this.registerHook('hoverToken', this.handleTokenHover.bind(this));

    // Token updates
    this.registerHook('preUpdateToken', this.handlePreUpdateToken.bind(this));
    this.registerHook('updateToken', this.handleTokenUpdate.bind(this));
    this.registerHook('refreshToken', this.handleTokenRefresh.bind(this));

    this.logger.debug('Token hooks registered');
  }

  /**
   * Register scene management hooks
   */
  private registerSceneHooks(): void {
    this.registerHook('preUpdateScene', this.handlePreUpdateScene.bind(this));
    this.registerHook('updateScene', this.handleSceneUpdate.bind(this));

    this.logger.debug('Scene hooks registered');
  }

  /**
   * Register combat tracking hooks
   */
  private registerCombatHooks(): void {
    this.registerHook('combatStart', this.handleCombatStart.bind(this));
    this.registerHook('combatTurn', this.handleCombatTurn.bind(this));
    this.registerHook('combatEnd', this.handleCombatEnd.bind(this));

    this.logger.debug('Combat hooks registered');
  }

  /**
   * Register system-level hooks
   */
  private registerSystemHooks(): void {
    this.registerHook('updateWall', this.handleWallUpdate.bind(this));
    this.registerHook('closeSettingsMenu', this.handleSettingsClose.bind(this));

    this.logger.debug('System hooks registered');
  }

  /**
   * Helper to register and track hooks
   */
  private registerHook(hookName: string, callback: Function): void {
    const hookId = Hooks.on(hookName, callback);
    this.registeredHooks.set(hookName, hookId);
  }

  // Canvas Event Handlers

  private handleCanvasInit(canvas: Canvas): void {
    this.logger.debug('Canvas initialising');
    this.eventBus.emit('canvas:init', { canvas });
  }

  private handleCanvasReady(canvas: Canvas): void {
    this.logger.info('Canvas ready');

    const canvasReadyEvent = { canvas };
    this.eventBus.emit('canvas:ready', canvasReadyEvent);

    setTimeout(() => {

      // Safe to read final positions here

      const placeableTokens: TokenState[] = [];
      if (canvas?.ready && canvas.tokens?.placeables) {
        for (const t of canvas.tokens.placeables) {
          if (t && t.id) { // Ensure token exists and has an id
            try {
              placeableTokens.push(this.extractTokenState(t));
            } catch (error) {
              this.logger.warn('Failed to extract token state', {
                tokenId: t.id,
                error: error as Error
              });
            }
          }
        }
      }

      this.logger.debug(`Canvas ready with ${placeableTokens.length} tokens`, {
        user: game.user
      });
      const tokensReadyEvent: TokensReadyEvent = {
        placeableTokens: placeableTokens,
        user: {
          id: game.user.id,
          colour: game.user.color.toString(16).padStart(6, "0"),
          isGM: game.user.isGM
        }
      };
      this.logger.debug('Emitting tokens:ready event', {
        tokensReadyEvent
      });
      this.eventBus.emit('tokens:ready', tokensReadyEvent );
    }, 0);
  }

  private handleCanvasTearDown(canvas: Canvas): void {
    this.logger.info('Canvas tearing down');
    this.eventBus.emit('canvas:teardown', { canvas });
  }

  private handleCanvasPan(position: { x: number; y: number; scale: number }): void {
    this.eventBus.emit('canvas:pan', { position });
  }

  // Token Event Handlers

  private handleTokenCreated(document: TokenDocument, options: any, userId: string): void {
    const token = canvas.tokens?.get(document.id);
    if (!token) return;

    this.logger.debug(`Token created: ${document.name} [${document.id}]`);
    this.eventBus.emit('token:create', { token });
  }

  private handleTokenDeleted(document: TokenDocument, options: any, userId: string): void {
    this.logger.debug(`Token deleted: ${document.name} [${document.id}]`);
    this.eventBus.emit('token:delete', {
      documentId: document.id,
      userId
    });
  }

  private handleTokenControl(token: Token, controlled: boolean): void {
    this.logger.debug(`Token control changed: ${token.name} [${token.id}] - ${controlled}`);

    const tokenState: TokenState = this.extractTokenState(token);
    const event = {
      token: tokenState,
      user: {
        id: game.user?.id,
        colour: game.user?.color.toString(16).padStart(6, "0"),
        isGM: game.user?.isGM
      }
    }
    
    this.eventBus.emit('token:control', event);
  }

  private handleTokenHover(token: Token, hovered: boolean): void {
    if (!token) return;

    if (token.border) {
      token.border.clear();
    }
    const event = {
      tokenId: token.id,
      token,
      userId: game.user?.id || ''
    };

    this.eventBus.emit(hovered ? 'token:hover' : 'token:hoverEnd', event);

    this.logger.debug(`Token hover ${hovered ? 'started' : 'ended'}: ${token.name} [${token.id}]`);
  }

  private handlePreUpdateToken(
    document: TokenDocument,
    changes: any,
    options: any,
    userId: string
  ): void {
    if (!this.hasRelevantChanges(changes)) return;

    const event: TokenPreUpdateEvent = {
      tokenId: document.id,
      tokenName: document.name ?? 'Unknown',
      currentState: this.extractTokenState(document),
      proposedState: this.extractProposedChanges(changes),
      updateOptions: this.extractUpdateOptions(options),
      userId
    };

    this.eventBus.emit('token:preUpdate', event);

    this.logger.debug(`Pre-update: ${document.name} [${document.id}]`, {
      currentState: event.currentState,
      proposedState: event.proposedState
    });
  }

  private extractTokenState(token: Token): TokenState {
    // Add defensive checks for token properties
    if (!token || !token.id) {
      throw new Error('Invalid token: missing id');
    }

    return {
      id: token.id,
      name: token.name || 'Eldritch',
      x: token.x ?? 0,
      y: token.y ?? 0,
      rotation: token.document?.rotation ?? 0,
      elevation: token.document?.elevation ?? 0,
      width: token.w ?? token.width ?? 1,
      height: token.h ?? token.height ?? 1,
      scale: token.document?.scale ?? 1,
      hidden: token.document?.hidden ?? false,
      visible: token.visible ?? true,
      controlled: token.controlled ?? false,
      ownedByCurrentUser: token.isOwner ?? false,
      disposition: token.document?.disposition ?? 0
    };
  }

  private handleTokenUpdate(
    document: TokenDocument,
    changes: any,
    options: any,
    userId: string
  ): void {
    this.logger.debug(`Token update requested: ${document.name} [${document.id}]`, {
      changes,
      options,
      userId
    });
    if (options.maleficarManoeuvresValidatedMove) {
      return;
    }
    const token = canvas?.tokens?.get(document.id);
    const user = game.users?.get(userId);
    const placeableTokens: TokenState[] = [];
    if (canvas?.ready && canvas.tokens?.placeables) {
      for (const t of canvas.tokens.placeables) {
        if (t && t.id) { // Ensure token exists and has an id
          try {
            placeableTokens.push(this.extractTokenState(t));
          } catch (error) {
            this.logger.warn('Failed to extract token state', {
              tokenId: t.id,
              error: error as Error
            });
          }
        }
      }
    }

    const event: TokenUpdateEvent = {
      id: document.id,
      currentState: this.extractCurrentState(document, token),
      changedState: this.extractChangedState(changes),
      updateOptions: this.extractUpdateOptions(options),
      placeableTokens: placeableTokens,
      user: {
        id: userId,
        colour: user?.color.toString(16).padStart(6, "0"),
        isGM: user?.isGM
      }
    };
    this.eventBus.emit('token:update', event);

    this.logger.debug(`Token updated: ${document.name} [${document.id}]`, {
      event
    });
  }

  private handleTokenRefresh(token: Token, flags: any): void {
    if (token.border) {
      token.border.clear();
    }
    this.eventBus.emit('token:refresh', { token, flags: flags || {} });
  }

  // Scene Event Handlers

  private handlePreUpdateScene(
    document: Scene,
    changes: any,
    options: any,
    userId: string
  ): void {
    const event: ScenePreUpdateEvent = {
      sceneId: document.id,
      sceneName: document.name ?? 'Unknown',
      currentState: {
        width: document.width,
        height: document.height,
        gridSize: document.grid.size
      },
      proposedChanges: changes,
      updateOptions: options,
      userId
    };

    this.eventBus.emit('scene:preUpdate', event);
  }

  private handleSceneUpdate(
    document: Scene,
    changes: any,
    options: any,
    userId: string
  ): void {
    const event: SceneUpdateEvent = {
      sceneId: document.id,
      sceneName: document.name ?? 'Unknown',
      changes,
      updateOptions: options,
      userId
    };

    this.eventBus.emit('scene:update', event);
    this.logger.debug(`Scene updated: ${document.name} [${document.id}]`);
  }

  // Combat Event Handlers

  private handleCombatStart(combat: Combat, updateData: any): void {
    this.logger.info(`Combat started: ${combat.id}`);
    this.eventBus.emit('combat:start', {
      combatId: combat.id,
      round: combat.round,
      turn: combat.turn,
      updateData
    });
  }

  private handleCombatTurn(combat: Combat, updateData: any, updateOptions: any): void {
    this.logger.debug(`Combat turn: Round ${combat.round}, Turn ${combat.turn}`);
    this.eventBus.emit('combat:turn', {
      combatId: combat.id,
      round: combat.round,
      turn: combat.turn,
      combatantId: combat.current.combatantId,
      updateData,
      updateOptions
    });
  }

  private handleCombatEnd(combat: Combat): void {
    this.logger.info(`Combat ended: ${combat.id}`);
    this.eventBus.emit('combat:end', {
      combatId: combat.id
    });
  }

  // System Event Handlers

  private handleWallUpdate(document: WallDocument, changes: any, options: any, userId: string): void {
    const event: WallUpdateEvent = {
      type: options.deleted ? 'delete' : (options.created ? 'create' : 'update'),
      wallId: document.id,
      wallData: {
        c: document.c,
        move: document.move,
        sense: document.sense,
        dir: document.dir,
        door: document.door,
        ds: document.ds,
        flags: document.flags
      },
      changes,
      userId
    };

    this.eventBus.emit('wall:update', event);
  }

  private handleSettingsClose(app: Application, html: JQuery): void {
    this.eventBus.emit('settings:close', {});
  }

  // Helper Methods

  private hasRelevantChanges(changes: any): boolean {
    const relevantKeys = ['x', 'y', 'rotation', 'elevation', 'hidden', 'alpha'];
    return relevantKeys.some(key => changes[key] !== undefined);
  }

  private extractCurrentState(document: TokenDocument, token: Token | undefined): TokenState {
    return {
      id: document.id,
      name: document.name ?? 'Eldritch',
      x: document.x,
      y: document.y,
      rotation: (document as any).rotation ?? 0,
      elevation: document.elevation ?? 0,
      width: token?.w ?? document.width * canvas.grid.size,
      height: token?.h ?? document.height * canvas.grid.size,
      scale: document.scale ?? 1,
      hidden: document.hidden,
      visible: token?.visible ?? true,
      controlled: token?.controlled ?? false,
      ownedByCurrentUser: token?.isOwner ?? false,
      disposition: document.disposition
    };
  }

  private extractProposedChanges(changes: any): Partial<TokenState> {
    return {
      x: changes.x,
      y: changes.y,
      rotation: changes.rotation,
      elevation: changes.elevation,
      hidden: changes.hidden
    };
  }

  private extractChangedState(changes: any): Partial<TokenState> {
    return {
      x: changes.x,
      y: changes.y,
      rotation: changes.rotation,
      elevation: changes.elevation,
      hidden: changes.hidden
    };
  }

  private extractUpdateOptions(options: any): any {
    return {
      animate: Boolean(options.animate ?? true),
      isUndo: Boolean(options.isUndo ?? false),
      noHook: Boolean(options.noHook ?? false),
      diff: Boolean(options.diff ?? true),
      maleficarManoeuvresValidatedMove: Boolean(options.maleficarManoeuvresValidatedMove ?? false),
      recursive: Boolean(options.recursive ?? true),
      ...(options.render && {
        render: {
          renderSheet: Boolean(options.render?.renderSheet ?? true),
          renderFlags: options.render?.renderFlags ?? {}
        }
      })
    };
  }

  /**
   * Clean up all registered hooks
   */
  async tearDown(): Promise<void> {
    this.logger.info('Tearing down System Event Adapter');

    // Remove all hooks
    for (const [hookName, hookId] of this.registeredHooks) {
      Hooks.off(hookName, hookId);
      this.logger.debug(`Unregistered hook: ${hookName}`);
    }

    // Clear collections
    this.registeredHooks.clear();

    this.isInitialised = false;
    this.logger.info('System Event Adapter torn down');
  }
}