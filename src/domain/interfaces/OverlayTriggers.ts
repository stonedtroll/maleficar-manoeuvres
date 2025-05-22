/**
 * Defines user-triggered actions for overlays
 */
export interface OverlayTriggers {
  /** Keyboard shortcut to toggle visibility */
  keyPress?: string[];
  /** Token hover state */
  tokenHover?: boolean;
  /** Token selection state */
  tokenSelect?: boolean;
  /** Token drag state */
  tokenDrag?: boolean;
  /** Mouse button to activate (e.g., 'left', 'right', 'middle') */
  mouseButton?: 'left' | 'right' | 'middle';
  /** Modifier keys required (e.g., ['shift', 'ctrl']) */
  modifierKeys?: Array<'shift' | 'ctrl' | 'alt' | 'meta'>;
  /** Custom activation condition */
  customTrigger?: (token: Token) => boolean;
}