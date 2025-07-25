/**
 * Immutable value object representing a token entity for collision detection.
 * Implements SpatialEntity interface for use in movement validation.
 */

import type { SpatialEntity } from '../interfaces/SpatialEntity.js';
import type { DispositionValue } from '../constants/TokenDisposition.js';

import { DISPOSITION } from '../constants/TokenDisposition.js';
import { SpatialVolume } from './SpatialVolume.js';
import { AABB } from './AABB.js';
import { VerticalExtent } from './VerticalExtent.js';
import { Vector2 } from './Vector2.js';
import { Vector3 } from './Vector3.js';

/**
 * Configuration parameters for creating a CollisionEntity
 */
export interface CollisionEntityConfig {
    readonly position: Vector2;
    readonly width: number;
    readonly height: number;
    readonly elevation: number;
    readonly disposition: DispositionValue;
    readonly verticalHeight: number; 
}

/**
 * Immutable collision entity value object for token collision detection.
 * Represents a token's spatial properties for collision calculations.
 */
export class CollisionEntity implements SpatialEntity {
    private readonly _position: Vector2;
    private readonly _elevation: number;
    private readonly _disposition: DispositionValue;
    private readonly _width: number;
    private readonly _height: number;
    private readonly _verticalHeight: number;

    constructor(config: CollisionEntityConfig) {
        this._position = Object.freeze(config.position);
        this._width = config.width;
        this._height = config.height;
        this._elevation = config.elevation;
        this._disposition = config.disposition;
        this._verticalHeight = config.verticalHeight;

        Object.freeze(this);
    }

    get position(): Readonly<Vector2> {
        return this._position;
    }

    get radius(): number {
        return Math.max(this.width, this.height) / 2;
    }

    get elevation(): number {
        return this._elevation;
    }

    get verticalHeight(): number {
        return this._verticalHeight;
    }

    get verticalExtent(): VerticalExtent {
        return new VerticalExtent(
            this._elevation,
            this._elevation + this._verticalHeight
        );
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }

    get disposition(): DispositionValue {
        return this._disposition;
    }

    get centre(): Vector2 {
        return new Vector2(
            this._position.x + this._width / 2,
            this._position.y + this._height / 2
        );
    }

    get spatialCentre(): Vector3 {
        return new Vector3(
            this.centre.x,
            this.centre.y,
            this._elevation + 0.5
        );
    }
    getSpatialVolume(): SpatialVolume {

        return {
            type: 'cylinder',
            centre: new Vector3(
                this.centre.x,
                this.centre.y,
                this._elevation + 0.5
            ),
            radius: this.radius,
            height: this.height,
            axis: 'z' // Always vertical
        };
    }

    getAABB(): AABB {
        // Simple 2D projection of the cylinder for QuadTree indexing
        return AABB.fromCircle(this.position, this.radius);
    }

    /**
     * Gets the entity type - always 'token' for collision entities
     */
    getType(): 'token' {
        return 'token';
    }

    canPassThrough(disposition: DispositionValue): boolean {
        return this._disposition === disposition ||
            disposition === DISPOSITION.NEUTRAL ||
            this._disposition === DISPOSITION.NEUTRAL;
    }

    get hidden(): boolean {
        return false;
    }

    get visible(): boolean {
        return true;
    }

    /**
     * Checks equality with another CollisionEntity
     * Two entities are equal if all their properties match
     */
    equals(other: CollisionEntity): boolean {
        if (!(other instanceof CollisionEntity)) {
            return false;
        }

        return (
            this.position.equals(other.position) &&
            this.width === other.width &&
            this.height === other.height &&
            this.elevation === other.elevation &&
            this.disposition === other.disposition
        );
    }
}