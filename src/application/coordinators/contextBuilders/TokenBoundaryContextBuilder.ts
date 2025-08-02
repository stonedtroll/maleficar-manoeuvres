import type { OverlayContextBuilder } from '../../../domain/interfaces/OverlayContextBuilder.js';
import type { Token } from '../../../domain/entities/Token.js';
import type { OverlayRenderContext } from '../../../domain/interfaces/OverlayRenderContext.js';
import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';

interface TokenBoundaryContextOptions {}

/**
 * Context builder for token boundary overlays.
 */
export class TokenBoundaryContextBuilder implements OverlayContextBuilder<TokenBoundaryContextOptions> {
  buildContext(
    token: Token,
    overlayDefinition: OverlayDefinition,
    options: TokenBoundaryContextOptions
  ): OverlayRenderContext {

    return {
      overlayTypeId: 'token-boundary',
      renderLayer: overlayDefinition.renderLayer,
      renderOnTokenMesh: overlayDefinition.renderOnTokenMesh,
      zIndex: overlayDefinition.zIndex,
      ...(overlayDefinition.styling && { styling: overlayDefinition.styling }),
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
        borderColour: '#0F0D0E',
        borderOpacity: 0.5,
        borderRadius: token.radius,
        fillColour: '#0F0D0E',
        fillOpacity: 0.3,
        fillRadius: token.radius - 2,
        boundaryStyle: 'circle',
        dashed: false,
        dashLength: 0,
        gapLength: 0
      }
    };
  }
}