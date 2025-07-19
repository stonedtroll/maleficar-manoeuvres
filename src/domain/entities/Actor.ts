import type { AbstractActorAdapter } from '../../application/adapters/AbstractActorAdapter.js';

import { MovementTypes, Speed } from '../value-objects/Speed.js';

export class Actor {
    private readonly _actorAdapter: AbstractActorAdapter;

    constructor(actorAdapter: AbstractActorAdapter) {
        this._actorAdapter = actorAdapter;
    }

    get id(): string | null { return this._actorAdapter.id; }

    get name(): string { return this._actorAdapter.name; }

    get type(): string { return this._actorAdapter.type; }

    get speeds(): ReadonlyArray<Speed> {
        return this._actorAdapter.speeds;
    }

    hasMovementMode(mode: MovementTypes): boolean {
        return this._actorAdapter.speeds.some(s => s.mode === mode);
    }
}