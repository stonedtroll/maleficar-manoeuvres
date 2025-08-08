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
    readonly collidable: boolean; 
    readonly providesCover: boolean; 
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
    private readonly _collidable: boolean;
    private readonly _providesCover: boolean;

    constructor(config: CollisionEntityConfig) {
        this._position = Object.freeze(config.position);
        this._width = config.width;
        this._height = config.height;
        this._elevation = config.elevation;
        this._disposition = config.disposition;
        this._verticalHeight = config.verticalHeight;
        this._collidable = config.collidable;
        this._providesCover = config.providesCover;

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
            this._elevation + (this.verticalHeight / 2)
        );
    }
    /**
     * Gets the spatial volume for collision detection.
     * Creates a cylinder representing the token's physical space.
     */
    getSpatialVolume(): SpatialVolume {
        const radius = Math.max(this.width, this.height) / 2;
        
        // Use centre coordinates for proper collision cylinder positioning
        const centre = new Vector3(
            this.centre.x,           
            this.centre.y,           
            this.elevation + (this.verticalHeight / 2)  
        );

        return {
            type: 'cylinder',
            centre,
            radius,
            height: this.verticalHeight,  
            axis: 'z' as const
        };
    }

    getAABB(): AABB {
        const min = this._position;
        const max = new Vector2(
            this._position.x + this._width,
            this._position.y + this._height
        );
        
        const aabb = new AABB(min, max);
        
        return aabb;
    }

    /**
     * Gets the entity type - always 'token' for collision entities...for now.
     */
    getType(): 'token' {
        return 'token';
    }

    get collidable(): boolean {
        return this._collidable;
    }

    get providesCover(): boolean {
        return this._providesCover;
    }

    canPassThrough(obstacle: SpatialEntity): boolean {

        if (!this._collidable || !obstacle.collidable) {
            return true;
        }

        return this._disposition === obstacle.disposition ||
            obstacle.disposition === DISPOSITION.NEUTRAL ||
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