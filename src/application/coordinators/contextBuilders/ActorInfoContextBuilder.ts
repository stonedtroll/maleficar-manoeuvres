/**
 * Context builder for actor information overlays.
 */

import type { OverlayContextBuilder } from '../../../domain/interfaces/OverlayContextBuilder.js';
import type { Token } from '../../../domain/entities/Token.js';
import type { OverlayRenderContext } from '../../../domain/interfaces/OverlayRenderContext.js';
import type { Actor } from '../../../domain/entities/Actor.js';
import type { OverlayDefinition } from '../../../domain/interfaces/OverlayDefinition.js';

interface ActorInfoContextOptions {
  ownedByCurrentUserActors: Actor[];
}

export class ActorInfoContextBuilder implements OverlayContextBuilder<ActorInfoContextOptions> {
  buildContext(
    targetToken: Token,
    overlayDefinition: OverlayDefinition,
    options: ActorInfoContextOptions
  ): OverlayRenderContext {

    const matchingActor = options.ownedByCurrentUserActors.find(actor =>
      actor.id === targetToken.actorId
    );

    const speeds = matchingActor
      ? matchingActor.speeds
        .filter(speed => speed.rate > 0)
        .map(speed => ({
          label: speed.toString(),
          icon: speed.icon,
        })) : [];

    const weaponRanges = matchingActor
      ? matchingActor.equippedWeapons
        .filter(weapon => weapon.isEquipped && weapon.range)
        .map(weapon => {
          const range = weapon.range!;
          const units = range.units || 'tbd';
          
          // Calculate effective range values
          const hasEffective = range.effective?.min !== undefined && range.effective?.max !== undefined;
          const effectiveMin = hasEffective ? range.effective!.min : (range.minimum ?? 0);
          const effectiveMax = hasEffective ? range.effective!.max : (range.maximum ?? 0);
          
          // Check if effective range equals min/max range
          const effectiveMatchesMinMax = 
            effectiveMin === (range.minimum ?? 0) && 
            effectiveMax === (range.maximum ?? 0);
          
          // Format effective range - show only max if min equals max
          const effectiveRangeText = effectiveMin === effectiveMax
            ? `${effectiveMax} ${units}`
            : `${effectiveMin}\u200A–\u200A${effectiveMax} ${units}`;
          
          // Format min/max range - show only max if min equals max
          const minMaxRangeText = (range.minimum ?? 0) === (range.maximum ?? 0)
            ? `${range.maximum ?? 0} ${units}`
            : `${range.minimum ?? 0}\u200A–\u200A${range.maximum ?? 0} ${units}`;
          
          return {
            name: weapon.name,
            icon: weapon.image,
            effectiveRange: effectiveRangeText,
            minimumRange: `${range.minimum ?? 0}`,
            maximumRange: `${range.maximum ?? 0}`,
            // Set range to null if effective range matches min/max
            range: effectiveMatchesMinMax 
              ? null 
              : minMaxRangeText,
            units: units
          };
        })
      : [];

    return {
      overlayTypeId: 'actor-info',
      renderLayer: overlayDefinition.renderLayer,
      renderOnTokenMesh: overlayDefinition.renderOnTokenMesh,
      zIndex: overlayDefinition.zIndex,
      ...(overlayDefinition.styling && { styling: overlayDefinition.styling }),
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
        radius: targetToken.radius,
        currentMovementMode: targetToken.currentMovementMode
      },
      actorInfo: {
        speeds: speeds,
        weaponRanges: weaponRanges
      }
    };
  }
}
