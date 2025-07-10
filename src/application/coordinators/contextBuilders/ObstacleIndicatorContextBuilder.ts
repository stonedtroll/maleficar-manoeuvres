import type { OverlayContextBuilder } from '../../../domain/interfaces/OverlayContextBuilder.js';
import type { GridlessToken } from '../../../domain/entities/GridlessToken.js';
import type { OverlayRenderContext } from '../../../domain/interfaces/OverlayRenderContext.js';
import { MODULE_ID } from '../../../config.js';

/**
 * Context builder for obstacle indicator overlays.
 */
export class ObstacleIndicatorContextBuilder implements OverlayContextBuilder {
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
      overlayTypeId: 'obstacle-indicator',
      renderTarget: 'world',
      zIndex: 1000, 
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
      obstacle: {
        imagePath: `modules/${MODULE_ID}/assets/images/overlays/obstacle-indicator.webp`,
        width: token.width,
        height: token.height,
        opacity: 1,
        tintColour: '#FFFFFF',
        rotation: 0,
        blendMode: 'normal',
        maintainAspectRatio: true
      },
      user: {
        isGM: options.isGM
      }
    };
  }
}