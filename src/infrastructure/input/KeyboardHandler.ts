/**
 * Keyboard Handler
 * 
 * TODO: Pay technical debt to the debt troll.
 * 
 * Centralised keyboard event handling for the module.
 * Captures and translates DOM keyboard events and Foundry keybindings.
 */

import { EventBus } from '../events/EventBus.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';
import type { InitialisableService } from '../../domain/interfaces/InitialisableService.js';
import type { KeyboardKeyDownEvent, KeyboardKeyUpEvent, TokenState } from '../events/FoundryEvents.js';

export class KeyboardHandler implements InitialisableService {
  private readonly logger: FoundryLogger;
  private readonly eventBus: EventBus;
  private readonly activeKeys = new Set<string>();
  private readonly modifierState = {
    shift: false,
    ctrl: false,
    alt: false,
    meta: false
  };

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.KeyboardHandler`);
  }

  async initialise(): Promise<void> {
    // Register DOM keyboard listeners
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);

    // Register Foundry keybindings after game is ready
    if (game?.ready) {
      this.registerKeybindings();
    } else {
      Hooks.once('ready', () => this.registerKeybindings());
    }

    this.logger.info('Keyboard handler initialised');
  }

  private registerKeybindings(): void {
    this.logger.info('Registering keybindings');

    try {
      game.keybindings.register(MODULE_ID, 'toggleOverlay', {
        name: `${MODULE_ID}.keybindings.toggleOverlay.name`,
        hint: `${MODULE_ID}.keybindings.toggleOverlay.hint`,
        editable: [{
          key: 'KeyM',
          modifiers: []
        }],
        onDown: () => this.emitKeyboardEvent('m', 'KeyM', false),
        onUp: () => this.emitKeyboardEvent('m', 'KeyM', true),
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
      });

      this.logger.info('Keybindings registered successfully');
    } catch (error) {
      this.logger.warn('Failed to register keybindings', error);
    }
  }

  async tearDown(): Promise<void> {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    this.activeKeys.clear();
  }

  private isInputFocused(): boolean {
    const activeElement = document.activeElement;
    return activeElement instanceof HTMLInputElement ||
           activeElement instanceof HTMLTextAreaElement ||
           activeElement instanceof HTMLSelectElement ||
           activeElement?.getAttribute('contenteditable') === 'true';
  }

  private shouldIgnoreKeyboardEvent(): boolean {
    // Ignore if typing in input fields
    if (this.isInputFocused()) {
      return true;
    }

    // Ignore if UI elements are active
    const activeControl = ui.controls?.control;
    const hasActiveControlTool = activeControl && activeControl.activeTool !== 'select';
    const hasOpenWindows = Object.keys(ui.windows).length > 0;

    if (hasActiveControlTool || hasOpenWindows) {
      return true;
    }

    return false;
  }

  private extractTokenState(token: Token): TokenState {
    return {
      id: token.id,
      name: token.name || 'Eldritch',
      ownedByCurrentUser: token.isOwner,
      controlled: token.controlled,
      visible: token.visible,
      x: token.x,
      y: token.y,
      width: token.w,
      height: token.h,
      rotation: token.document.rotation,
      elevation: token.document.elevation,
      scale: token.document.scale, 
      hidden: token.document.hidden,
      disposition: token.document.disposition
    };
  }

  private updateModifierState(event: KeyboardEvent): void {
    this.modifierState.shift = event.shiftKey;
    this.modifierState.ctrl = event.ctrlKey;
    this.modifierState.alt = event.altKey;
    this.modifierState.meta = event.metaKey;
  }

  private emitKeyboardEvent(key: string, code: string, isUp: boolean): void {
    if (!game?.ready || !game.user) {
      this.logger.warn('Game or user not ready, skipping keyboard event');
      return;
    }

    const placeableTokens = canvas?.ready && canvas.tokens
      ? (canvas.tokens.placeables as Token[]).map((t: Token) => this.extractTokenState(t))
      : [];

    const baseEvent = {
      key,
      code,
      modifiers: { ...this.modifierState },
      timestamp: Date.now(),
      user: {
        isGM: game.user.isGM,
        id: game.user.id,
        colour: game.user.color.toString()
      },
      placeableTokens
    };

    if (isUp) {
      this.eventBus.emit('keyboard:keyUp', baseEvent as KeyboardKeyUpEvent);
    } else {
      this.eventBus.emit('keyboard:keyDown', { ...baseEvent, repeat: false } as KeyboardKeyDownEvent);
    }
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    this.updateModifierState(event);
    
    if (this.shouldIgnoreKeyboardEvent()) return;

    const key = event.key.toLowerCase();
    if (event.repeat || this.activeKeys.has(key)) return;
    this.activeKeys.add(key);

    this.emitKeyboardEvent(key, event.code, false);
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.updateModifierState(event);
    
    if (this.shouldIgnoreKeyboardEvent()) return;

    const key = event.key.toLowerCase();
    this.activeKeys.delete(key);

    this.emitKeyboardEvent(key, event.code, true);
  };
}