import type { SpatialEntity } from '../interfaces/SpatialEntity.js';
import type { AbstractWallAdapter } from '../../application/adapters/AbstractWallAdapter.js';

import { DispositionValue, DISPOSITION } from '../constants/TokenDisposition.js';
import { 
    DOOR_TYPES,
    DOOR_STATES,
    BLOCKING_DIRECTIONS,
    MOVEMENT_RESTRICTIONS,
    SENSE_RESTRICTIONS
} from '../../application/adapters/AbstractWallAdapter.js';
import { Vector2 } from '../value-objects/Vector2.js';
import { Vector3 } from '../value-objects/Vector3.js';
import { AABB } from '../value-objects/AABB.js';
import { SpatialVolume } from '../value-objects/SpatialVolume.js';
import { VerticalExtent } from '../value-objects/VerticalExtent.js';

export class Wall implements SpatialEntity {
    private readonly _wallAdapter: AbstractWallAdapter;
    
    readonly startPoint: Vector2;
    readonly endPoint: Vector2;
    
    private _centre: Vector2 | null = null;
    private _spatialCentre: Vector3 | null = null;
    private _length: number | null = null;
    private _normal: Vector2 | null = null;
    private _aabb: AABB | null = null;
    
    constructor(wallAdapter: AbstractWallAdapter) {
        this._wallAdapter = wallAdapter;
        
        const coordinates = wallAdapter.coordinates;
        this.startPoint = new Vector2(coordinates[0], coordinates[1]);
        this.endPoint = new Vector2(coordinates[2], coordinates[3]);
    }
    
    get id(): string {
        return this._wallAdapter.id;
    }
    
    get position(): Vector2 {
        return new Vector2(
            Math.min(this.startPoint.x, this.endPoint.x),
            Math.min(this.startPoint.y, this.endPoint.y)
        );
    }
    
    get width(): number {
        return Math.abs(this.endPoint.x - this.startPoint.x) || 1; // Minimum 1 pixel for vertical walls
    }
    
    get height(): number {
        return Math.abs(this.endPoint.y - this.startPoint.y) || 1; // Minimum 1 pixel for horizontal walls
    }
    
    get elevation(): number {
        return 0;
    }
    
    get verticalHeight(): number {
        return Infinity;
    }
    
    get verticalExtent(): VerticalExtent {
        return new VerticalExtent(
            this.elevation,
            this.elevation + this.verticalHeight
        );
    }
    
    get centre(): Vector2 {
        if (!this._centre) {
            this._centre = new Vector2(
                (this.startPoint.x + this.endPoint.x) / 2,
                (this.startPoint.y + this.endPoint.y) / 2
            );
        }
        return this._centre;
    }
    
    get spatialCentre(): Vector3 {
        if (!this._spatialCentre) {
            const centreElevation = this.verticalHeight === Infinity 
                ? this.elevation + 1000 
                : (this.verticalExtent.max) / 2;

            this._spatialCentre = new Vector3(
                this.centre.x,
                this.centre.y,
                centreElevation
            );
        }
        
        return this._spatialCentre;
    }
    
    get collidable(): boolean {
        return this.blocksMovement();
    }
    
    get providesCover(): boolean {
        return this.blocksSight();
    }
    
    get hidden(): boolean {
        return false;
    }
    
    get visible(): boolean {
        return true;
    }

    get disposition(): DispositionValue {
        return DISPOSITION.NONE;
    }
    
    getSpatialVolume(): SpatialVolume {
        return {
            type: 'box',
            centre: this.spatialCentre,
            width: this.width,
            height: this.height,
            depth: this.verticalHeight === Infinity ? 1000 : this.verticalHeight
        };
    }
    
    getAABB(): AABB {
        if (!this._aabb) {
            const minX = Math.min(this.startPoint.x, this.endPoint.x);
            const minY = Math.min(this.startPoint.y, this.endPoint.y);
            const maxX = Math.max(this.startPoint.x, this.endPoint.x);
            const maxY = Math.max(this.startPoint.y, this.endPoint.y);

            const width = maxX - minX || 1;
            const height = maxY - minY || 1;
            
            this._aabb = new AABB(
                new Vector2(minX, minY),
                new Vector2(minX + width, minY + height)
            );
        }
        return this._aabb;
    }
    
    canPassThrough(obstacle: SpatialEntity): boolean {
        return false;
    }
    
    getType(): string {
        return 'wall';
    }

    get isDoor(): boolean {
        return this._wallAdapter.doorType !== DOOR_TYPES.NONE;
    }
    
    get isOpen(): boolean {
        return this.isDoor && this._wallAdapter.doorState === DOOR_STATES.OPEN;
    }
    
    get isLocked(): boolean {
        return this.isDoor && this._wallAdapter.doorState === DOOR_STATES.LOCKED;
    }
    
    get isSecret(): boolean {
        return this._wallAdapter.doorType === DOOR_TYPES.SECRET;
    }
    
    blocksMovement(): boolean {
        // Open doors never block movement
        if (this.isOpen) return false;
        
        // Check movement restriction type
        return this._wallAdapter.movementRestriction !== MOVEMENT_RESTRICTIONS.NONE;
    }
    
    blocksSight(): boolean {
        // Open doors never block sight
        if (this.isOpen) return false;
        
        // Check sight restriction type
        return this._wallAdapter.sightRestriction !== SENSE_RESTRICTIONS.NONE;
    }

    blocksLight(): boolean {
        // Open doors never block light
        if (this.isOpen) return false;
        
        // Check light restriction type
        return this._wallAdapter.lightRestriction !== SENSE_RESTRICTIONS.NONE;
    }

    blocksSound(): boolean {
        // Open doors never block sound
        if (this.isOpen) return false;
        
        // Check sound restriction type
        return this._wallAdapter.soundRestriction !== SENSE_RESTRICTIONS.NONE;
    }

    get permeabilityThresholds(): {
        readonly light: number;
        readonly sight: number;
        readonly sound: number;
        readonly movement: number;
    } | null {
        const thresholds = this._wallAdapter.permeabilityThresholds;
        const movementThreshold = this._wallAdapter.movementRestriction === MOVEMENT_RESTRICTIONS.NONE ? 1 : 0;
        
        if (!thresholds) {
            return {
                light: this.getDefaultThreshold('light'),
                sight: this.getDefaultThreshold('sight'),
                sound: this.getDefaultThreshold('sound'),
                movement: movementThreshold
            };
        }
        
        return {
            light: thresholds.light,
            sight: thresholds.sight,
            sound: thresholds.sound,
            movement: movementThreshold
        };
    }
    
    /**
     * Calculates default threshold values based on restriction types.
     * Domain logic for permeability defaults.
     */
    private getDefaultThreshold(type: 'light' | 'sight' | 'sound'): number {
        const restrictionMap = {
            light: this._wallAdapter.lightRestriction,
            sight: this._wallAdapter.sightRestriction,
            sound: this._wallAdapter.soundRestriction,
        };
        
        const restriction = restrictionMap[type];
        
        switch (restriction) {
            case SENSE_RESTRICTIONS.NONE:
                return 1; // Fully permeable
                
            case SENSE_RESTRICTIONS.LIMITED:
                return 0.5; // Partially permeable
                
            case SENSE_RESTRICTIONS.NORMAL:
                return 0; // Fully blocks
                
            case SENSE_RESTRICTIONS.PROXIMITY:
            case SENSE_RESTRICTIONS.DISTANCE:
                return 0.3; // Conditionally permeable
                
            default:
                return 0; // Default to blocking
        }
    }
    
    get length(): number {
        if (this._length === null) {
            const dx = this.endPoint.x - this.startPoint.x;
            const dy = this.endPoint.y - this.startPoint.y;
            this._length = Math.sqrt(dx * dx + dy * dy);
        }
        return this._length;
    }
    
    get normal(): Vector2 {
        if (!this._normal) {
            const dx = this.endPoint.x - this.startPoint.x;
            const dy = this.endPoint.y - this.startPoint.y;
            const length = this.length; // Uses cached value
            
            this._normal = new Vector2(-dy / length, dx / length);
        }
        return this._normal;
    }
    
    get doorType(): number {
        return this._wallAdapter.doorType;
    }
    
    get doorState(): number {
        return this._wallAdapter.doorState;
    }
    
    get blockingDirection(): number {
        return this._wallAdapter.blockingDirection;
    }
    
    get movementRestriction(): number {
        return this._wallAdapter.movementRestriction;
    }
    
    get sightRestriction(): number {
        return this._wallAdapter.sightRestriction;
    }
    
    get soundRestriction(): number {
        return this._wallAdapter.soundRestriction;
    }
    
    get lightRestriction(): number {
        return this._wallAdapter.lightRestriction;
    }
    
    isPointOnLeftSide(point: Vector2): boolean {
        const dx = this.endPoint.x - this.startPoint.x;
        const dy = this.endPoint.y - this.startPoint.y;
        const px = point.x - this.startPoint.x;
        const py = point.y - this.startPoint.y;
        
        // Cross product to determine side
        return (dx * py - dy * px) > 0;
    }
    
    blocksMovementFromDirection(origin: Vector2): boolean {
        if (this.isOpen) return false;
        
        if (this.movementRestriction === MOVEMENT_RESTRICTIONS.NONE) return false;
        
        if (this.blockingDirection === BLOCKING_DIRECTIONS.BOTH) {
            return true;
        }
        
        const originOnLeft = this.isPointOnLeftSide(origin);
        
        if (this.blockingDirection === BLOCKING_DIRECTIONS.LEFT) {
            return originOnLeft;
        } else if (this.blockingDirection === BLOCKING_DIRECTIONS.RIGHT) {
            return !originOnLeft;
        }
        
        return false;
    }

    blocksSightFromDirection(origin: Vector2): boolean {
        if (this.isOpen) return false;
        
        if (this.sightRestriction === SENSE_RESTRICTIONS.NONE) return false;
        
        if (this.blockingDirection === BLOCKING_DIRECTIONS.BOTH) {
            return true;
        }

        const originOnLeft = this.isPointOnLeftSide(origin);
        
        if (this.blockingDirection === BLOCKING_DIRECTIONS.LEFT) {
            return originOnLeft;
        } else if (this.blockingDirection === BLOCKING_DIRECTIONS.RIGHT) {
            return !originOnLeft;
        }
        
        return false;
    }

    blocksLightFromDirection(origin: Vector2): boolean {
        if (this.isOpen) return false;
        
        if (this.lightRestriction === SENSE_RESTRICTIONS.NONE) return false;
        
        if (this.blockingDirection === BLOCKING_DIRECTIONS.BOTH) {
            return true;
        }
        
        const originOnLeft = this.isPointOnLeftSide(origin);
        
        if (this.blockingDirection === BLOCKING_DIRECTIONS.LEFT) {
            return originOnLeft;
        } else if (this.blockingDirection === BLOCKING_DIRECTIONS.RIGHT) {
            return !originOnLeft;
        }
        
        return false;
    }

    getClosestPoint(point: Vector2): Vector2 {
        const dx = this.endPoint.x - this.startPoint.x;
        const dy = this.endPoint.y - this.startPoint.y;
        const px = point.x - this.startPoint.x;
        const py = point.y - this.startPoint.y;
        
        const lengthSquared = dx * dx + dy * dy;
        
        if (lengthSquared === 0) {
            return this.startPoint;
        }
        
        let t = (px * dx + py * dy) / lengthSquared;
        
        t = Math.max(0, Math.min(1, t));
        
        return new Vector2(
            this.startPoint.x + t * dx,
            this.startPoint.y + t * dy
        );
    }

    intersectsElevationRange(verticalExtent: VerticalExtent): boolean {
        const wallTop = this.verticalExtent.max;
        const wallBottom = this.verticalExtent.min;

        if (wallTop === Infinity) {
            return verticalExtent.max >= wallBottom;
        }
        
        return !(verticalExtent.max < wallBottom || verticalExtent.min > wallTop);
    }
}