import type { DispositionValue } from '../constants/TokenDisposition.js';

import { SpatialVolume } from '../value-objects/SpatialVolume.js';
import { AABB } from '../value-objects/AABB.js';
import { VerticalExtent } from '../value-objects/VerticalExtent.js';
import { Vector2 } from '../value-objects/Vector2.js';
import { Vector3 } from '../value-objects/Vector3.js';

export interface SpatialEntity {

    readonly id?: string;

    getSpatialVolume(): SpatialVolume;

    getAABB(): AABB;

    getType?(): 'token' | 'wall' | 'terrain' | 'effect' | string;

    blocksMovement?(): boolean;

    canPassThrough(disposition: DispositionValue): boolean;

    verticalExtent: VerticalExtent;
    verticalHeight: number;
    position: Vector2;
    elevation: number;
    width: number;
    height: number;
    centre: Vector2;
    spatialCentre: Vector3;
    disposition: DispositionValue;
    hidden: boolean;
    visible: boolean;
}