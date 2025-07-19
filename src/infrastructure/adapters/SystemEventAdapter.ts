/**
 * TODO: Pay the technical debt troll.
 * 
 * Unified adapter that bridges Foundry VTT's event system with the module's event bus.
 */

import { EventBus } from '../events/EventBus.js';
import { MODULE_ID, SETTINGS } from '../../config.js';
import { getSetting } from '../../settings.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import { TokenRepository } from '../repositories/TokenRepository.js';
import { ActorRepository } from '../repositories/ActorRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import type {
  TokenUpdateEvent,
  TokenPreUpdateEvent,
  ScenePreUpdateEvent,
  SceneUpdateEvent,
  WallUpdateEvent,
  TokenState,
  TokensReadyEvent,
  TokenDragStartEvent,
  TokenDragMoveEvent
} from '../events/FoundryEvents.js';
import type { InitialisableService } from '../../domain/interfaces/InitialisableService.js';
import type { DispositionValue } from '../..//domain/constants/TokenDisposition.js';

export class SystemEventAdapter implements InitialisableService {
  private readonly logger: FoundryLogger;
  private readonly registeredHooks: Map<string, number> = new Map();
  private readonly tokenRepository: TokenRepository;
  private readonly actorRepository: ActorRepository;
  private readonly userRepository: UserRepository;
  private readonly responseWaiter: EventResponseWaiter;
  private isInitialised = false;
  private currentlyDragging = false;

  constructor(private readonly eventBus: EventBus) {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.SystemEventAdapter`);
    this.tokenRepository = new TokenRepository();
    this.actorRepository = new ActorRepository(this.tokenRepository);
    this.userRepository = new UserRepository();
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
      this.eventBus.emit('tokens:ready', tokensReadyEvent);
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
    // if (!token) return;

    // if (token.border) {
    //   token.border.clear();
    // }
    // const event = {
    //   tokenId: token.id,
    //   token,
    //   userId: game.user?.id || ''
    // };

    // this.eventBus.emit(hovered ? 'token:hover' : 'token:hoverEnd', event);

    // this.logger.debug(`Token hover ${hovered ? 'started' : 'ended'}: ${token.name} [${token.id}]`);
  }

  private handlePreUpdateToken(
    document: TokenDocument,
    changes: any,
    options: any,
    userId: string
  ): void {

    // Skip if already validated
    if (options.maleficarManoeuvresValidatedMove) {
      return;
    }

    // Check if movement validation is needed
    // if (this.shouldValidateMovement(changes)) {
    //   try {
    //   const validationResponse = await this.responseWaiter.waitForResponse<
    //     MovementValidationRequest,
    //     MovementValidationResponse
    //   >(
    //     'movement:validate:request',
    //     'movement:validate:response',
    //     {
    //       tokenId: document.id,
    //       currentPosition: { x: document.x, y: document.y },
    //       proposedPosition: { x: changes.x ?? document.x, y: changes.y ?? document.y },
    //       userId,
    //       timestamp: Date.now()
    //     },
    //     { timeoutMs: 3000 }
    //   );

    //   if (!validationResponse.approved) {
    //     // Revert the movement
    //     await document.update(
    //       { x: document.x, y: document.y },
    //       { 
    //         animate: false,
    //         maleficarManoeuvresValidatedMove: true 
    //       }
    //     );

    //     // Show rejection feedback
    //     ui.notifications?.warn(validationResponse.reason ?? 'Movement blocked');
    //     return;
    //   }
    // } catch (error) {
    //   this.logger.warn('Movement validation failed, allowing movement', error);
    //   // On timeout or error, allow the movement
    // }
    // }
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
      disposition: (token.document?.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL) as DispositionValue
    };
  }

  private isUnconstrainedMovementEnabled(): boolean {
    const unconstrainedMovementTool = ui.controls?.tools?.unconstrainedMovement;

    if (!unconstrainedMovementTool) {
      return false;
    }

    return unconstrainedMovementTool.active ?? false;
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

    const updatedToken = this.tokenRepository.getById(document.id);

    if (!updatedToken) {
      this.logger.warn(`Token update failed: Token not found for ID ${document.id}`);
      return;
    }

    this.emitTokenUpdateEvent(updatedToken, changes, options);

    this.logger.debug(`Token updated: ${document.name} [${document.id}]`, {
      event
    });
  }

  private emitTokenUpdateEvent(
    token: Token,
    changes: any,
    options: any
  ): void {

    const tokenUpdateEvent: TokenUpdateEvent = {
      timestamp: Date.now(),
      allTokenAdapters: this.tokenRepository.getAllAsAdapters(),
      updatingTokenAdapter: this.tokenRepository.getAsAdapter(token),
      changes: this.extractChangedState(changes),
      updateOptions: this.extractUpdateOptions(options),
      isUnconstrainedMovement: this.isUnconstrainedMovementEnabled(),
      user: this.userRepository.getCurrentUserContext()
    };

    this.eventBus.emit('token:update', tokenUpdateEvent);
  }

  /**
 * Clears token border graphics.
 */
  private clearTokenBorder(token: Token): void {
    try {
      // Check if token border indicator is enabled in settings
      const showTokenBorder = getSetting<boolean>(SETTINGS.TOKEN_BORDER_INDICATOR);

      if (!showTokenBorder && token?.border) {
        token.border.clear();
      }
    } catch (error) {
      this.logger.warn('Failed to clear token border graphics', {
        tokenId: token?.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private handleTokenRefresh(token: Token, flags: any): void {
    this.clearTokenBorder(token);

    const previewToken = canvas.tokens.preview.children.find(p => p.id === token.id);
    const controlledTokens = canvas.tokens?.controlled || [];
    if (controlledTokens.length === 0 && token.id !== controlledTokens[0]?.id) {
      return;
    }
    if (previewToken) {
      if (!this.currentlyDragging) {
        this.logger.debug('Drag starting detected', {
          token,
          previewToken,
          movementData: token.actor?.system?.attributes?.movement ?? 'unknown',
          movementAction: token.document.movementAction ?? 'unknown',
          actions: CONFIG.Token.movement.actions ?? 'unknown'
        });
        this.currentlyDragging = true;
        this.emitTokenDragStartEvent(token, previewToken);
      } else if (this.currentlyDragging) {
        this.logger.debug('Drag moving detected', {
          token,
          previewToken,
          movementData: token.actor?.system?.attributes?.movement ?? 'unknown',
          movementAction: token.document.movementAction ?? 'unknown',
          actions: CONFIG.Token.movement.actions ?? 'unknown'
        });
        this.handleDragMove(token, previewToken);
      }
    } else if (this.currentlyDragging) {
      this.logger.debug('Drag ending detected', {
        token,
        previewToken,
        movementData: token.actor?.system?.attributes?.movement ?? 'unknown',
        movementAction: token.document.movementAction ?? 'unknown',
        actions: CONFIG.Token.movement.actions ?? 'unknown'
      });
      this.currentlyDragging = false;
      this.handleDragEnd(token);
    }
  }

  private emitTokenDragStartEvent(token: Token, previewToken: Token): void {

    const tokenDragStartEvent: TokenDragStartEvent = {
      timestamp: Date.now(),
      allTokenAdapters: this.tokenRepository.getAllAsAdapters(),
      dragStartTokenAdaptor: this.tokenRepository.getAsAdapter(token),
      previewTokenAdapter: this.tokenRepository.getAsAdapter(previewToken),
      ownedByCurrentUserActorAdapters: this.actorRepository.getFromOwnedTokensAsAdapters(),
      user: this.userRepository.getCurrentUserContext(),
    };

    this.eventBus.emit('token:dragStart', tokenDragStartEvent);
  }

  /**
   * Handle drag movement detected by polling
   */
  private handleDragMove(token: Token, previewToken: Token): void {

    const tokenDragMoveEvent: TokenDragMoveEvent = {
      timestamp: Date.now(),
      allTokenAdapters: this.tokenRepository.getAllAsAdapters(),
      dragStartTokenAdaptor: this.tokenRepository.getAsAdapter(token),
      previewTokenAdapter: this.tokenRepository.getAsAdapter(previewToken),
      ownedByCurrentUserActorAdapters: this.actorRepository.getFromOwnedTokensAsAdapters(),
      user: this.userRepository.getCurrentUserContext(),
    };

    this.logger.debug('Token dragging', {
      tokenId: token.id,
      position: { x: token.x, y: token.y },
      previewPosition: { x: previewToken.x, y: previewToken.y },
      previewToken: previewToken,
      placeables: canvas.tokens?.placeables
    });
    this.eventBus.emit('token:dragMove', tokenDragMoveEvent);
  }

  /**
   * Handle drag end detected by polling
   */
  private handleDragEnd(token: Token): void {
    // const state = this.dragStates.get(token.id);
    // if (!state) return;

    // At drag end, use token.x/y for the final rendered position
    const finalPosition = { x: token.x, y: token.y };
    const worldPos = canvas.mousePosition || finalPosition;

    this.eventBus.emit('token:dragEnd', {
      id: token.id,
      position: finalPosition,
      worldPosition: { x: worldPos.x, y: worldPos.y },
      screenPosition: { x: 0, y: 0 },
      // totalDelta: {
      //   x: finalPosition.x - state.startPosition.x,
      //   y: finalPosition.y - state.startPosition.y
      // },
      totalDelta: {
        x: finalPosition.x,
        y: finalPosition.y
      },
      prevented: false
    });

    // this.dragStates.delete(token.id);
    // this.lastDragPosition = null;
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