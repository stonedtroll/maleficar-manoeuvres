import { Collidable } from '../interfaces/Collidable';
import { CollisionShape } from '../value-objects/CollisionShape';
import { CollisionResult } from '../types/CollisionResult';

export interface CollisionDetector {
    /**
     * Check collision between a moving entity and multiple obstacles
     */
    checkCollision(
        movingEntity: Collidable,
        obstacles: Collidable[]
    ): CollisionResult;
    
    /**
     * Check if two entities collide
     */
    checkSingleCollision(
        entityA: Collidable,
        entityB: Collidable
    ): boolean;
    
    /**
     * Low-level shape collision check (for internal use or special cases)
     */
    checkShapeCollision(
        shapeA: CollisionShape,
        shapeB: CollisionShape
    ): boolean;
}