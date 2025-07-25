import type { DispositionValue } from '../constants/TokenDisposition.js';
import type { AbstractTokenAdapter } from '../../application/adapters/AbstractTokenAdapter.js';

import { Vector2 } from '../value-objects/Vector2.js';
import { Vector3 } from '../value-objects/Vector3.js';
import { SpatialVolume } from '../value-objects/SpatialVolume.js';
import { VerticalExtent } from '../value-objects/VerticalExtent.js';
import { AABB } from '../value-objects/AABB.js';
import { Rotation } from '../value-objects/Rotation.js';
import { DISPOSITION } from '../constants/TokenDisposition.js';
import { SpatialEntity } from '../interfaces/SpatialEntity';
import { MovementTypes } from '../value-objects/Speed.js';

export class Token implements SpatialEntity {

    protected _previousPosition?: Vector2;
    protected _previousRotation?: Rotation;
    protected _previousElevation?: number;

    protected _radius: number;

    private _tokenAdapter: AbstractTokenAdapter;

    constructor(tokenAdapter: AbstractTokenAdapter) {
        this._tokenAdapter = tokenAdapter;
    }

    /**
     * Move the token to a new position.
     * Supports both 2D and 3D movement.
     */
    move(newPosition: Vector2 | Vector3): void {
        //TODO: Implement proper movement logic

        // this._previousPosition = this._position;

        // if (newPosition instanceof Vector3) {
        //     this._previousElevation = this._elevation;
        //     this._position = new Vector2(newPosition.x, newPosition.y);
        //     this._elevation = newPosition.z;
        // } else {
        //     this._position = newPosition;
        // }
    }

    get radius(): number {
        return Math.max(this.width, this.height) / 2;
    }

    getSpatialVolume(): SpatialVolume {
        return {
            type: 'cylinder',
            centre: new Vector3(
                this.centre.x,
                this.centre.y,
                this.elevation + this._tokenAdapter.verticalHeight / 2
            ),
            radius: this.radius,
            height: this._tokenAdapter.verticalHeight,
            axis: 'z' // Always vertical
        };
    }

    getAABB(): AABB {
        // Simple 2D projection of the cylinder for QuadTree indexing
        return AABB.fromCircle(this.position, this.radius);
    }

    get id(): string {
        return this._tokenAdapter.id;
    }

    get name(): string {
        return this._tokenAdapter.name;
    }

    get position(): Readonly<Vector2> {
        return this._tokenAdapter.position;
    }

    get position3D(): Readonly<Vector3> {
        return new Vector3(
            this._tokenAdapter.position.x,
            this._tokenAdapter.position.y,
            this._tokenAdapter.elevation ?? 0
        );
    }

    get rotation(): Rotation {
        return this._tokenAdapter.rotation;
    }

    rotate(angle: number): void {
        //TODO: Implement proper rotation logic
        
        // this._previousRotation = this._rotation;
        // this._rotation = new Rotation(((angle % 360) + 360) % 360);
    }

    get elevation(): number {
        return this._tokenAdapter.elevation;
    }

    get verticalExtent(): VerticalExtent {
        return new VerticalExtent(
            this._tokenAdapter.elevation,
            this._tokenAdapter.elevation + this._tokenAdapter.verticalHeight
        );
    }

    get width(): number {
        return this._tokenAdapter.width;
    }

    get height(): number {
        return this._tokenAdapter.height;
    }

    get centre(): Vector2 {
        return new Vector2(
            this._tokenAdapter.position.x + this._tokenAdapter.width / 2,
            this._tokenAdapter.position.y + this._tokenAdapter.height / 2
        );
    }

    get spatialCentre(): Vector3 {
        return new Vector3(
            this.centre.x,
            this.centre.y,
            this._tokenAdapter.elevation + this._tokenAdapter.verticalHeight / 2
        );
    }

    get visible(): boolean {
        return this._tokenAdapter.visible;
    }

    get hidden(): boolean {
        return this._tokenAdapter.hidden;
    }

    get scale(): number {
        return this._tokenAdapter.scale;
    }

    get disposition(): DispositionValue {
        return this._tokenAdapter.disposition;
    }

    get currentMovementMode(): MovementTypes | null {
        return this._tokenAdapter.currentMovementMode as MovementTypes | null;
    }

    get isControlledByCurrentUser(): boolean {
        return this._tokenAdapter.isControlledByCurrentUser;
    }

    get isOwnedByCurrentUser(): boolean {
        return this._tokenAdapter.isOwnedByCurrentUser;
    }

    get actorId(): string | null {
        return this._tokenAdapter.actorId;
    }

    get verticalHeight(): number {
        return this._tokenAdapter.verticalHeight;
    }

    /**
     * Check if another token can pass through this one based on disposition.
     */
    canPassThrough(obstacleDisposition: DispositionValue): boolean {
        // Tokens with matching dispositions can pass through each other
        if (this._tokenAdapter.disposition === obstacleDisposition) {
            return true;
        }

        if (this._tokenAdapter.disposition === DISPOSITION.SECRET ||
            obstacleDisposition === DISPOSITION.SECRET) {
            return false;
        }

        // Neutral tokens have special pass-through rules
        if (this._tokenAdapter.disposition === DISPOSITION.NEUTRAL ||
            obstacleDisposition === DISPOSITION.NEUTRAL) {
            return true;
        }

        // Different dispositions block each other by default
        return false;
    }
}