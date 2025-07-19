import type { Token } from '../entities/Token.js';
import type { OverlayRenderContext } from './OverlayRenderContext.js';

export interface BaseContextOptions {
  isGM?: boolean;
  userColour?: string;
}

/**
 * Interface for building overlay-specific render contexts.
 */
export interface OverlayContextBuilder<TOptions extends BaseContextOptions = BaseContextOptions> {
  buildContext(targetToken: Token, options: TOptions): OverlayRenderContext;
}