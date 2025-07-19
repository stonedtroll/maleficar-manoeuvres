import type { OverlayContextBuilder } from '../../../domain/interfaces/OverlayContextBuilder.js';
import type { Token } from '../../../domain/entities/Token.js';
import type { OverlayRenderContext } from '../../../domain/interfaces/OverlayRenderContext.js';

interface TokenBoundaryContextOptions {
  isGM?: boolean;
  userColour?: string;
}

/**
 * Context builder for token boundary overlays.
 */
export class TokenBoundaryContextBuilder implements OverlayContextBuilder<TokenBoundaryContextOptions> {
  buildContext(
    token: Token,
    options: TokenBoundaryContextOptions
  ): OverlayRenderContext {

    return {
      overlayTypeId: 'token-boundary',
      renderTarget: 'world',
      overlayCentre: {
        x: token.centre.x,
        y: token.centre.y
      },
      token: {
        id: token.id,
        name: token.name,
        position: {
          x: token.position.x,
          y: token.position.y
        },
        width: token.width,
        height: token.height,
        centre: {
          x: token.centre.x,
          y: token.centre.y
        },
        radius: token.radius
      },
      boundary: {
        borderLineWidth: 2,
        borderColour: '#4A2A1F',
        borderOpacity: 0.5,
        borderRadius: token.radius,
        fillColour: '#2A3A28',
        fillOpacity: 0.1,
        fillRadius: token.radius - 2,
        boundaryStyle: 'circle',
        dashed: false,
        dashLength: 0,
        gapLength: 0
      },
      user: {
        isGM: options.isGM ?? false
      }
    };
  }
}