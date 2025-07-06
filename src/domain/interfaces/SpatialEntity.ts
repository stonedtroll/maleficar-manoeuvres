import type { DispositionValue } from '../constants/TokenDisposition.js';

import { SpatialVolume } from '../value-objects/SpatialVolume.js';
import { AABB } from '../value-objects/AABB.js';
import { VerticalExtent } from '../value-objects/VerticalExtent.js';
import { Vector2 } from '../value-objects/Vector2.js';
import { Vector3 } from '../value-objects/Vector3.js';

/**
 * Interface for entities that can participate in collision detection
 */
export interface SpatialEntity {
    /**
     * Unique identifier for this entity
     */
    readonly id: string;

    /**
     * Get the collision shape of this entity
     */
    getSpatialVolume(): SpatialVolume;

    /**
     * Get the axis-aligned bounding box for quick spatial checks
     */
    getAABB(): AABB;

    /**
     * Get the vertical extent for elevation checks
     */
    verticalExtent: VerticalExtent;

    /**
     * Optional: Get the type of this collidable entity
     */
    getType?(): 'token' | 'wall' | 'terrain' | 'effect' | string;

    /**
     * Optional: Whether this entity blocks movement
     * Default: true for walls/tokens, false for effects/terrain
     */
    blocksMovement?(): boolean;

    canPassThrough(disposition: DispositionValue): boolean;
    move(position: Vector2 | Vector3): void;
    position: Vector2;
    elevation: number;
    centre: Vector2;
    spatialCentre: Vector3;
    disposition?: DispositionValue;
}