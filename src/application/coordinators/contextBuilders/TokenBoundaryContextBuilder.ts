import type { OverlayContextBuilder } from '../../../domain/interfaces/OverlayContextBuilder.js';
import type { GridlessToken } from '../../../domain/entities/GridlessToken.js';
import type { OverlayRenderContext } from '../../../domain/interfaces/OverlayRenderContext.js';

/**
 * Context builder for token boundary overlays.
 */
export class TokenBoundaryContextBuilder implements OverlayContextBuilder {
  buildContext(
    token: GridlessToken,
    options: {
      isGM: boolean;
      userColour?: string;
      activeKeys?: Set<string>;
      [key: string]: any;
    }
  ): OverlayRenderContext {
    
    return {
      overlayTypeId: 'token-boundary',
      renderTarget: 'canvas',
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
        borderOpacity: 0.9,
        borderRadius: token.radius,
        fillColour: '#2A3A28',
        fillOpacity: 0.5,
        fillRadius: token.radius - 2,
        boundaryStyle: 'circle',
        dashed: false,
        dashLength: 0,
        gapLength: 0
      },
      user: {
        isGM: options.isGM
      }
    };
  }
}