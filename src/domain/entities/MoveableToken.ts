/**
 * Represents a token that can be moved and manipulated within the game world.
 * This abstract base class provides core functionality for all token types,
 * including position tracking, collision detection, and state management.
 */
import type { DispositionValue } from '../../domain/constants/TokenDisposition.js';

import { Vector2 } from '../value-objects/Vector2';
import { SpatialVolume } from '../value-objects/SpatialVolume.js';
import { VerticalExtent } from '../value-objects/VerticalExtent';
import { AABB } from '../value-objects/AABB';
import { Rotation } from '../value-objects/Rotation';
import { DISPOSITION } from '../constants/TokenDisposition.js';
import { Vector3 } from '../value-objects/Vector3.js';

export abstract class MoveableToken {
    // Core properties
    protected _position: Vector2;
    protected _rotation: Rotation;
    protected _elevation: number = 0;

    // Dimensions
    protected _width: number;
    protected _height: number;
    protected _scale: number;

    // State tracking
    protected _controlled: boolean = false;
    protected _visible: boolean = true;
    protected _disposition: DispositionValue = DISPOSITION.NEUTRAL;

    // Movement history for undo/redo functionality
    protected _previousPosition?: Vector2;
    protected _previousRotation?: Rotation;
    protected _previousElevation?: number;

    constructor(
        public readonly id: string,
        public name: string = 'Eldritch',
        position: Vector2,
        rotation: Rotation,
        width: number,
        height: number,
        scale: number = 1
    ) {
        this._position = position;
        this._rotation = rotation;
        this._width = width;
        this._height = height;
        this._scale = scale;
    }

    abstract move(newPosition: Vector2  | Vector3): void;
    abstract getSpatialVolume(): SpatialVolume;
    abstract getAABB(): AABB;

    // Getter for position - accessed as token.position
    get position(): Readonly<Vector2> {
        return this._position;
    }

    // Protected setter for subclasses
    protected set position(value: Vector2) {
        this._previousPosition = this._position;
        this._position = value;
    }

    // Getter for rotation - accessed as token.rotation
    get rotation(): Rotation {
        return this._rotation;
    }

    // Public method for controlled rotation
    rotate(angle: number): void {
        this._previousRotation = this._rotation;
        this._rotation = new Rotation(((angle % 360) + 360) % 360);
    }

    get elevation(): number {
        return this._elevation;
    }

    set elevation(value: number) {
        this._elevation = typeof value === 'number' && !isNaN(value) ? value : 0;
    }

    get verticalExtent(): VerticalExtent {
        return new VerticalExtent(
            this._elevation,
            this._elevation + 1 //TODO: Have to implement vbertical height
        );
    }

    get width(): number {
        return this._width;
    }

    set width(width: number) {
        this._width = width;
    }

    get height(): number {
        return this._height;
    }

    set height(height: number) {
        this._height = height;
    }

    // Centre coordinates - calculated from position and dimensions
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
            this._elevation + 1 / 2 //TODO: Have to implement vertical height
        );
    }

    get controlled(): boolean {
        return this._controlled;
    }

    set controlled(controlled: boolean) {
        this._controlled = controlled;
    }

    get visible(): boolean {
        return this._visible;
    }

    set visible(visible: boolean) {
        this._visible = visible;
    }

    get scale(): number {
        return this._scale;
    }

    set scale(scale: number) {
        this._scale = scale;
    }

    get disposition(): DispositionValue {
        return this._disposition;
    }

    set disposition(disposition: DispositionValue) {
        this._disposition = disposition;
    }

    canPassThrough(disposition: DispositionValue): boolean {
        return this._disposition === disposition || disposition === DISPOSITION.NEUTRAL;
    }
}