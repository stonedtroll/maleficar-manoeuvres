import type { GridlessToken } from '../entities/GridlessToken.js';
import type { OverlayRenderContext } from './OverlayRenderContext.js';

/**
 * Interface for building overlay-specific render contexts.
 */
export interface OverlayContextBuilder {
  /**
   * Builds a render context for a specific overlay and token.
   */
  buildContext(
    token: GridlessToken,
    options: {
      isGM: boolean;
      userColour?: string;
      activeKeys?: Set<string>;
      [key: string]: any; 
    }
  ): OverlayRenderContext;
}