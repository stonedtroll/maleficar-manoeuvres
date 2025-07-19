/**
 * Centralised keyboard event handling service. Manages keyboard input capture, state tracking, and event translation for both
 * DOM keyboard events and Foundry VTT keybindings.
 * 
 * Technical debt:
 * TODO: Refactor modifier state management to use a more type-safe approach
 * TODO: Consider extracting input filtering logic to a separate service
 */

import type { EventBus } from '../events/EventBus.js';
import type { InitialisableService } from '../../domain/interfaces/InitialisableService.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import type {
  KeyboardKeyDownEvent,
  KeyboardKeyUpEvent
} from '../events/FoundryEvents.js';

import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';
import { TokenRepository } from '../repositories/TokenRepository.js';
import { ActorRepository } from '../repositories/ActorRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';

export class KeyboardHandler implements InitialisableService {

  private readonly logger: FoundryLogger;
  private readonly eventBus: EventBus;
  private readonly tokenRepository: TokenRepository;
  private readonly actorRepository: ActorRepository;
  private readonly userRepository: UserRepository;
  
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
    this.tokenRepository = new TokenRepository();
    this.actorRepository = new ActorRepository(this.tokenRepository);
    this.userRepository = new UserRepository();
  }

  // Public API - Lifecycle

  /**
   * Initialises the keyboard handler by registering event listeners.
   */
  async initialise(): Promise<void> {

    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);

    if (game?.ready) {
      this.registerKeybindings();
    } else {
      Hooks.once('ready', () => this.registerKeybindings());
    }

    this.logger.info('Keyboard handler initialised');
  }

  /**
   * Tears down the keyboard handler by removing all event listeners.
   * Clears internal state to prevent memory leaks.
   */
  async tearDown(): Promise<void> {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    this.activeKeys.clear();
    
    this.logger.info('Keyboard handler torn down');
  }

  // Private Methods - Event Handling

  /**
   * Handles DOM keydown events.
   * Tracks key state and emits domain events.
   */
  private handleKeyDown = (event: KeyboardEvent): void => {
    this.updateModifierState(event);

    if (this.shouldIgnoreKeyboardEvent()) {
      return;
    }

    const key = event.key.toLowerCase();
    
    // Ignore repeated events while key is held
    if (event.repeat || this.activeKeys.has(key)) {
      return;
    }
    
    this.activeKeys.add(key);
    this.emitKeyboardKeyDownEvent(key, event.code);
  };

  /**
   * Handles DOM keyup events.
   * Updates key state and emits domain events.
   */
  private handleKeyUp = (event: KeyboardEvent): void => {
    this.updateModifierState(event);

    if (this.shouldIgnoreKeyboardEvent()) {
      return;
    }

    const key = event.key.toLowerCase();
    this.activeKeys.delete(key);
    
    this.emitKeyboardKeyUpEvent(key, event.code);
  };

  // Private Methods - Event Emission

  /**
   * Emits keyboard key down event with game context.
   */
  private emitKeyboardKeyDownEvent(key: string, code: string): void {
    if (!this.validateGameState()) {
      return;
    }

    const keyDownEvent: KeyboardKeyDownEvent = {
      key,
      code,
      modifiers: { ...this.modifierState },
      timestamp: Date.now(),
      user: this.userRepository.getCurrentUserContext(),
      allTokenAdapters: this.tokenRepository.getAllAsAdapters(),
      ownedByCurrentUserActorAdapters: this.actorRepository.getFromOwnedTokensAsAdapters(),
    };

    this.logger.debug(`Key pressed`, {
      key: keyDownEvent.key,
      code: keyDownEvent.code,
      modifiers: keyDownEvent.modifiers,
      timestamp: keyDownEvent.timestamp,
      user: keyDownEvent.user,
    });

    this.eventBus.emit('keyboard:keyDown', keyDownEvent);
  }

  /**
   * Emits keyboard key up event.
   */
  private emitKeyboardKeyUpEvent(key: string, code: string): void {
    if (!this.validateGameState()) {
      return;
    }

    const keyUpEvent: KeyboardKeyUpEvent = {
      key,
      code,
      modifiers: { ...this.modifierState },
      timestamp: Date.now(),
      user: this.userRepository.getCurrentUserContext(),
    };

    this.logger.debug(`Key released`, {
      key: keyUpEvent.key,
      code: keyUpEvent.code,
      modifiers: keyUpEvent.modifiers,
      timestamp: keyUpEvent.timestamp,
      user: keyUpEvent.user,
    });

    this.eventBus.emit('keyboard:keyUp', keyUpEvent);
  }

  // Private Methods - Keybinding Registration

  /**
   * Registers module keybindings with Foundry VTT.
   * Configures the 'M' key for overlay toggling.
   */
  private registerKeybindings(): void {
    this.logger.info('Registering keybindings');

    if (!game.keybindings) {
      this.logger.warn('Keybindings not available, skipping registration');
      return;
    }

    try {
      game.keybindings.register(MODULE_ID, 'toggleOverlay', {
        name: `${MODULE_ID}.keybindings.toggleOverlay.name`,
        hint: `${MODULE_ID}.keybindings.toggleOverlay.hint`,
        editable: [{
          key: 'KeyM',
          modifiers: []
        }],
        onDown: () => this.emitKeyboardKeyDownEvent('m', 'KeyM'),
        onUp: () => this.emitKeyboardKeyUpEvent('m', 'KeyM'),
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
      });

      this.logger.info('Keybindings registered successfully');
    } catch (error) {
      this.logger.warn('Failed to register keybindings', error);
    }
  }

  // Private Methods - Input Filtering

  /**
   * Determines whether keyboard events should be ignored based on UI context.
   * Prevents interference with text input and UI interactions.
   */
  private shouldIgnoreKeyboardEvent(): boolean {
    // Ignore if typing in input fields
    if (this.isInputFieldFocused()) {
      this.logger.debug('Ignoring keyboard event: input field focused');
      return true;
    }

    return false;
  }

  /**
   * Checks if an input field has focus.
   */
  private isInputFieldFocused(): boolean {
    const activeElement = document.activeElement;
    
    return activeElement instanceof HTMLInputElement ||
           activeElement instanceof HTMLTextAreaElement ||
           activeElement instanceof HTMLSelectElement ||
           activeElement?.getAttribute('contenteditable') === 'true';
  }

  // Private Methods - State Management

  /**
   * Updates modifier key state from keyboard event.
   */
  private updateModifierState(event: KeyboardEvent): void {
    this.modifierState.shift = event.shiftKey;
    this.modifierState.ctrl = event.ctrlKey;
    this.modifierState.alt = event.altKey;
    this.modifierState.meta = event.metaKey;
  }

  /**
   * Validates that the game is in a valid state for processing events.
   */
  private validateGameState(): boolean {
    if (!this.userRepository.isReady()) {
      this.logger.warn('Game or user not ready, skipping keyboard event');
      return false;
    }
    
    return true;
  }
}