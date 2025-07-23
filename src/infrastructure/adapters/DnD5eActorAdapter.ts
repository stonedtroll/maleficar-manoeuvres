import type { MovementTypes } from "../../domain/value-objects/Speed.js";
import type { WeaponRange } from "../../domain/value-objects/Weapon.js";

import { AbstractActorAdapter } from "../../application/adapters/AbstractActorAdapter.js";
import { Speed } from "../../domain/value-objects/Speed.js";
import { Weapon } from "../../domain/value-objects/Weapon.js";

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

  fetchEquippedWeapons(): ReadonlyArray<Weapon> {
    const weapons: Weapon[] = [];
    const items = this.actor.items.filter(item => item.type === 'weapon' && item.system.equipped);

    for (const item of items) {
      const range = item.system.range;
      if (range) {
        const weaponRange: WeaponRange = {};
        weaponRange.melee = range.reach;
        weaponRange.minimum = 0;
        weaponRange.effective = {
          min: 0,
          max: range.reach ?? range.value
        };
        weaponRange.maximum = range.reach ?? range.long ?? range.value;
        weaponRange.units = range.units;

        weapons.push(new Weapon(
          item.name ?? 'Eldritch Weapon',
          item.img ?? 'icons/svg/sword.svg',
          weaponRange,
          item.system.equipped
        ));
      }
    }

    return weapons;
  }
}