import { TokenState } from '../../infrastructure/events/FoundryEvents.js';

export interface ObstacleFilterOptions {
  movingTokenElevation: number;
  movingTokenDisposition?: number;
  excludeIds?: string[];
}

/**
 * Application service for filtering obstacles based on game rules
 */
export class ObstacleFilterService {
  
  /**
   * Filter token states to only include valid obstacles
   */
  filterTokenObstacles(
    tokenStates: TokenState[], 
    options: ObstacleFilterOptions
  ): TokenState[] {
    // Pre-create exclude set for O(1) lookup
    const excludeSet = new Set(options.excludeIds || []);
    return tokenStates.filter(state => {
      // Exclude specified IDs
      if (excludeSet.has(state.id)) {
        return false;
      }
      
      return this.isValidObstacle(state, options);
    });
  }
  
  /**
   * Check if a token state represents a valid obstacle
   */
  private isValidObstacle(
    tokenState: TokenState, 
    options: ObstacleFilterOptions
  ): boolean {
    // Hidden tokens don't block movement
    if (tokenState.hidden) return false;

    if (!tokenState.visible) {
      return false;
    }

    // Check if friendly tokens should block
    if (options.movingTokenDisposition !== undefined && tokenState.disposition !== undefined) {
      
      // If both tokens are friendly and setting says they don't block
      if (options.movingTokenDisposition === tokenState.disposition) {
        return false;
      }
    }

    // Check elevation difference
    const tokenElevation = tokenState.elevation || 0;
    const elevationDiff = Math.abs(tokenElevation - options.movingTokenElevation);

    return elevationDiff <= 30;
  }
}