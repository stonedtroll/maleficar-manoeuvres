import type { OverlayContextBuilder } from '../../../domain/interfaces/OverlayContextBuilder.js';
import type { GridlessToken } from '../../../domain/entities/GridlessToken.js';
import type { OverlayRenderContext } from '../../../domain/interfaces/OverlayRenderContext.js';
import { DISPOSITION } from '../../../domain/constants/TokenDisposition.js';

/**
 * Disposition-based colours for non-controlled tokens
 */
const DISPOSITION_COLOURS = {
  [DISPOSITION.SECRET]: '#2A0F37',   // Deep purple
  [DISPOSITION.HOSTILE]: '#8C0000',  // Dark red
  [DISPOSITION.NEUTRAL]: '#6B6B6B',  // Grey
  [DISPOSITION.FRIENDLY]: '#4D5D43'  // Olive green
} as const;

const DEFAULT_ARC_COLOUR = '#8A6A1C'; 

/**
 * Context builder for facing arc overlays.
 */
export class FacingArcContextBuilder implements OverlayContextBuilder {
  buildContext(
    token: GridlessToken,
    options: {
      isGM: boolean;
      userColour?: string;
      activeKeys?: Set<string>;
      [key: string]: any;
    }
  ): OverlayRenderContext {
    const arcColour = this.determineArcColour(token, options.userColour);

    return {
      overlayTypeId: 'facing-arc',
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
        radius: token.radius + 2
      },
      rotation: {
        currentRotation: token.rotation.degrees,
        isSnapped: false,
        arcColour,
        arcAngle: 20
      },
      user: {
        isGM: options.isGM
      }
    };
  }

  /**
   * Determines the arc colour based on token control state and disposition.
   */
  private determineArcColour(token: GridlessToken, userColour?: string): string {
    if (token.controlled && userColour) {
      return userColour;
    }

    return DISPOSITION_COLOURS[token.disposition as keyof typeof DISPOSITION_COLOURS] ?? DEFAULT_ARC_COLOUR;
  }
}