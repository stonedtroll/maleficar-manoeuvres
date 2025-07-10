import type { GridTypeSupport } from './GridTypeSupport.js';
import type { OverlayTriggers } from './OverlayTriggers.js';
import type { UpdateTriggers } from './UpdateTriggers.js';
import type { OverlayContextBuilder } from './OverlayContextBuilder.js';
import type { RenderTarget } from './OverlayRenderContext.js';

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