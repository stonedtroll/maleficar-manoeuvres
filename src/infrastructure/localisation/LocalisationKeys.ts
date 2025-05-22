/**
 * TODO: Simplify this monstrosity
 * Centralised location for all translation keys used throughout the module
 */

// Settings keys
export type SettingsLocalisationKey =
  | 'settings.showBoundaryOverlays.name'
  | 'settings.showBoundaryOverlays.hint'
  | 'settings.showFacingIndicators.name'
  | 'settings.showFacingIndicators.hint'
  | 'settings.showMovementPaths.name'
  | 'settings.showMovementPaths.hint'
  | 'settings.showCollisionIndicators.name'
  | 'settings.showCollisionIndicators.hint'
  | 'settings.showElevationIndicators.name'
  | 'settings.showElevationIndicators.hint'
  | 'settings.enablePathfinding.name'
  | 'settings.enablePathfinding.hint'
  | 'settings.pathfindingQuality.name'
  | 'settings.pathfindingQuality.hint'
  | 'settings.pathfindingQuality.choices.low'
  | 'settings.pathfindingQuality.choices.medium'
  | 'settings.pathfindingQuality.choices.high'
  | 'settings.debugMode.name'
  | 'settings.debugMode.hint';

// Combined type for all localisation keys
export type LocalisationKey =
  | SettingsLocalisationKey;

/**
 * Type guard to check if a string is a valid localisation key
 */
export function isLocalisationKey(key: string): key is LocalisationKey {
  return VALID_KEYS.has(key as LocalisationKey);
}

/**
 * Set of all valid localisation keys for runtime validation
 */
const VALID_KEYS = new Set<LocalisationKey>([
  // Settings
  'settings.showBoundaryOverlays.name',
  'settings.showBoundaryOverlays.hint',
  'settings.showFacingIndicators.name',
  'settings.showFacingIndicators.hint',
  'settings.showMovementPaths.name',
  'settings.showMovementPaths.hint',
  'settings.showCollisionIndicators.name',
  'settings.showCollisionIndicators.hint',
  'settings.showElevationIndicators.name',
  'settings.showElevationIndicators.hint',
  'settings.enablePathfinding.name',
  'settings.enablePathfinding.hint',
  'settings.pathfindingQuality.name',
  'settings.pathfindingQuality.hint',
  'settings.pathfindingQuality.choices.low',
  'settings.pathfindingQuality.choices.medium',
  'settings.pathfindingQuality.choices.high',
  'settings.debugMode.name',
  'settings.debugMode.hint'
]);

/**
 * Helper to get all keys of a specific category
 */
export function getKeysByCategory(category: 'settings' | 'ui' | 'notifications' | 'tooltips' | 'logs'): LocalisationKey[] {
  return Array.from(VALID_KEYS).filter(key => key.startsWith(`${category}.`));
}