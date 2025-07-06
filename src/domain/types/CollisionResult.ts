import { SpatialEntity } from '../interfaces/SpatialEntity';
import { Vector3 } from '../value-objects/Vector3';

/**
 * Represents the result of a collision detection check
 */
export interface CollisionResult {
    /**
     * Whether any collision was detected
     */
    isColliding: boolean;
    
    /**
     * Entities that are colliding with the tested entity
     */
    collidingWith: SpatialEntity[];
}

/**
 * Detailed collision information for a single collision
 */
export interface CollisionDetail {
    /**
     * The entity involved in the collision
     */
    entity: SpatialEntity;
    
    /**
     * Point of collision in world space (if calculable)
     */
    contactPoint?: Vector3;
    
    /**
     * Normal vector at collision point (if calculable)
     */
    contactNormal?: Vector3;
    
    /**
     * Penetration depth (if calculable)
     */
    penetrationDepth?: number;
}

/**
 * Extended collision result with detailed information
 */
export interface DetailedCollisionResult extends CollisionResult {
    /**
     * Detailed information about each collision
     */
    collisions: CollisionDetail[];
    
    /**
     * Minimum translation vector to resolve all collisions (if calculable)
     */
    mtv?: Vector3;
}

