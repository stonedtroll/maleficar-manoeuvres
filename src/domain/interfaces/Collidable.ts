import { CollisionShape } from '../value-objects/CollisionShape';
import { AABB } from '../value-objects/AABB';
import { VerticalExtent } from '../value-objects/VerticalExtent';
import { Vector2 } from '../value-objects/Vector2';

/**
 * Interface for entities that can participate in collision detection
 */
export interface Collidable {
    /**
     * Unique identifier for this entity
     */
    readonly id: string;
    
    /**
     * Get the collision shape of this entity
     */
    getCollisionShape(): CollisionShape;
    
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

    position: Vector2;
    centre: Vector2;
}