import type { MovementTypes } from "../../domain/value-objects/Speed.js";

import { AbstractActorAdapter } from "../../application/adapters/AbstractActorAdapter";
import { Speed } from "../../domain/value-objects/Speed.js";

export class DnD5eActorAdapter extends AbstractActorAdapter {
  get id(): string | null {
    return this.actor.id ?? null;
  }

  get name(): string {
    return this.actor.name ?? 'Eldritch';
  }

  get type(): string {
    return this.actor.type;
  }

  get speeds(): ReadonlyArray<Speed> {
    const speeds: Speed[] = [];
    const movement = this.actor.system.attributes.movement;
    const units = movement.units || 'm';

    for (const [type, value] of Object.entries(movement)) {
            if (typeof value !== 'number') {
        continue;
      }

      speeds.push(Speed.create(value, units, type as MovementTypes));
    }
    
    return speeds;
  }
}