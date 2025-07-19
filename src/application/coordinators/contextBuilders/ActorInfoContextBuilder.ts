import type { OverlayContextBuilder } from '../../../domain/interfaces/OverlayContextBuilder.js';
import type { Token } from '../../../domain/entities/Token.js';
import type { OverlayRenderContext } from '../../../domain/interfaces/OverlayRenderContext.js';
import type { Actor } from '../../../domain/entities/Actor.js';

interface ActorInfoContextOptions {
  isGM?: boolean;
  userColour?: string;
  ownedByCurrentUserActors: Actor[];
}

/**
 * Context builder for actor information overlays.
 */
export class ActorInfoContextBuilder implements OverlayContextBuilder<ActorInfoContextOptions> {
  buildContext(
    targetToken: Token,
    options: ActorInfoContextOptions
  ): OverlayRenderContext {

    const matchingActor = options.ownedByCurrentUserActors.find(actor =>
      actor.id === targetToken.actorId
    );

    // Get speeds from matching actor or use defaults
    const speeds = matchingActor
      ? matchingActor.speeds
        .filter(speed => speed.rate > 0)
        .map(speed => ({
          label: speed.toString(),
          font: 'Arial',
          fontSize: 8,
          fontColour: '#D4C8B8',
          fontOpacity: 1,
          icon: speed.icon,
        })) : [];

    return {
      overlayTypeId: 'actor-info',
      renderTarget: 'world',
      zIndex: 500,
      overlayCentre: {
        x: targetToken.centre.x,
        y: targetToken.centre.y
      },
      token: {
        id: targetToken.id,
        name: targetToken.name,
        position: {
          x: targetToken.position.x,
          y: targetToken.position.y
        },
        width: targetToken.width,
        height: targetToken.height,
        centre: {
          x: targetToken.centre.x,
          y: targetToken.centre.y
        },
        radius: targetToken.radius
      },
      actorInfo: {
        speeds: speeds,
        weaponRange: 0
      },
      user: {
        isGM: options.isGM ?? false,
        colour: options.userColour ?? '#FFFFFF'
      }
    };
  }
}
