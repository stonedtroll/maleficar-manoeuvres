import type { GridTypeSupport } from './GridTypeSupport.js';
import type { OverlayTriggers } from './OverlayTriggers.js';
import type { UpdateTriggers } from './UpdateTriggers.js';

/**
 * Defines the configuration and metadata for an overlay type
 */
export interface OverlayDefinition {
  /** Unique identifier for the overlay type */
  id: string;
  /** Human-readable name for display in UI */
  displayName: string;
  /** Description of what the overlay shows */
  description: string;
  /** Category for grouping overlays (e.g., 'visual', 'measurement', 'combat') */
  category: string;
  /** Whether this overlay is enabled by default for new users */
  enabledByDefault: boolean;
  /** Whether the overlay is visible when first enabled */
  visibleOnStart: boolean;
  /** Whether to check permissions before displaying */
  usePermissionSystem: boolean;
  /** Which grid types this overlay supports */
  displayOn: GridTypeSupport;
  /** User-triggered actions for this overlay */
  triggers: OverlayTriggers;
  /** Which events should trigger overlay updates */
  updateOn: UpdateTriggers;
}