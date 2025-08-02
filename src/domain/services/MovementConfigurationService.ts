import { getSetting } from '../../settings.js';
import { SETTINGS } from '../../config.js';
import { UIControlsUtility } from '../../infrastructure/utils/UIControlsUtility.js';

/**
 * Domain service that provides movement configuration without exposing infrastructure details.
 */
export class MovementConfigurationService {
  static shouldValidateMovement(): boolean {
    if (!getSetting<boolean>(SETTINGS.MOVEMENT_VALIDATION)) {
      return false;
    }

    if (UIControlsUtility.isUnconstrainedMovementEnabled()) {
      return false;
    }

    return true;
  }


  static isSnappingEnabled(): boolean {
    // TODO: Implement snapping configuration logic
    return true;
  }
  
  static getDefaultTokenHeight(): number {
    return getSetting<number>(SETTINGS.TOKEN_DEFAULT_VERTICAL_HEIGHT);
  }
}