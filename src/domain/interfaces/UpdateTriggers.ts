/**
 * Defines which events trigger overlay updates
 */
export interface UpdateTriggers {
  /** Update when token moves */
  tokenMove: boolean;
  /** Update when token rotates */
  tokenRotate: boolean;
  /** Update when token elevation changes */
  tokenElevation: boolean;
  /** Update when vision/fog changes */
  visionChange: boolean;
  /** Update when walls change */
  wallChange: boolean;
  /** Update when grid configuration changes */
  gridChange: boolean;
  /** Update when token selection changes */
  selectionChange?: boolean;
  /** Update when token visibility changes */
  visibilityChange?: boolean;
  /** Update when combat state changes */
  combatChange?: boolean;
}