import { SpatialEntity } from '../interfaces/SpatialEntity';
import { CollisionResult } from '../types/CollisionResult';

export interface CollisionDetector {
    /**
     * Check collision between a moving entity and multiple obstacles
     */
    checkCollision(
        movingEntity: SpatialEntity,
        obstacles: SpatialEntity[]
    ): CollisionResult;
    
    /**
     * Check if two entities collide
     */
    checkSingleCollision(
        entityA: SpatialEntity,
        entityB: SpatialEntity
    ): boolean;
}