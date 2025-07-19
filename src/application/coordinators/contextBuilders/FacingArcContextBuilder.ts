import type { OverlayContextBuilder } from '../../../domain/interfaces/OverlayContextBuilder.js';
import type { Token } from '../../../domain/entities/Token.js';
import type { OverlayRenderContext } from '../../../domain/interfaces/OverlayRenderContext.js';
import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';

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

interface FacingArcContextOptions {
  isGM?: boolean;
  userColour?: string;
}

/**
 * Context builder for facing arc overlays.
 */
export class FacingArcContextBuilder implements OverlayContextBuilder<FacingArcContextOptions> {
  buildContext(
    token: Token,
    overlayDefinition: OverlayDefinition,
    options: FacingArcContextOptions
  ): OverlayRenderContext {
    const arcColour = this.determineArcColour(token, options.userColour);

    return {
      overlayTypeId: 'facing-arc',
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
        radius: token.radius + 2
      },
      rotation: {
        currentRotation: token.rotation.degrees,
        isSnapped: false,
        arcColour,
        arcAngle: 20
      },
      user: {
        isGM: options.isGM ?? false
      }
    };
  }

  /**
   * Determines the arc colour based on token control state and disposition.
   */
  private determineArcColour(token: Token, userColour?: string): string {
    if (token.isControlledByCurrentUser && userColour) {
      return userColour;
    }

    return DISPOSITION_COLOURS[token.disposition as keyof typeof DISPOSITION_COLOURS] ?? DEFAULT_ARC_COLOUR;
  }
}