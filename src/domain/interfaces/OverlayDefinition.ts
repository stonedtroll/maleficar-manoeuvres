import type { GridTypeSupport } from './GridTypeSupport.js';
import type { OverlayContextBuilder } from './OverlayContextBuilder.js';
import type { RenderTarget } from './OverlayRenderContext.js';
import type { Token } from '../entities/Token.js';

export interface UpdateTriggers {

  tokenMove: boolean;
  tokenRotate: boolean;
  visionChange: boolean;
  wallChange: boolean;
  gridChange: boolean;
  selectionChange?: boolean;
  visibilityChange?: boolean;
  combatChange?: boolean;
}

export type TargetScope = 'all' | 'controlled' | 'owned' | 'non-controlled' | 'preview' | 'hovered' | 'visible' | 'visible-and-not-hidden';

export interface TriggerConfig {
  scope?: TargetScope;
}

export interface KeyPressTriggerConfig extends TriggerConfig {
  keys: string[];
}

export interface OverlayTriggers {
  keyPress?: KeyPressTriggerConfig;
  tokenControlled?: TriggerConfig;
  tokenHover?: TriggerConfig;
  tokenDragStart?: TriggerConfig;
  tokenDragMove?: TriggerConfig;
  mouseButton?: 'left' | 'right' | 'middle';
  modifierKeys?: Array<'shift' | 'ctrl' | 'alt' | 'meta'>;
  customTrigger?: (token: Token) => boolean;
}

/**
 * Defines the configuration and metadata for an overlay type
 */
export interface OverlayDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  enabledByDefault: boolean;
  visibleOnStart: boolean;
  renderTarget: RenderTarget;

  contextBuilder?: OverlayContextBuilder;

  permissions: {
    requireLOS: boolean;
    requireGM: boolean;
    requireOwnership: boolean;
    requireControl: boolean;
  };

  displayOn: GridTypeSupport;
  triggers: OverlayTriggers;
  updateOn: UpdateTriggers;
}