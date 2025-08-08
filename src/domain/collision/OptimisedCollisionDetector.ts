/**
 * Collision detection system. Combines QuadTree spatial indexing with Separating Axis Theorem (SAT) for
 * efficient and precise collision detection on Foundry's 2D canvas with elevation support.
 * 
 * Performance optimisations:
 * - QuadTree spatial indexing reduces collision checks from O(n) to O(log n)
 * - Early rejection using AABB and elevation checks
 * - Cached entity bounds in spatial index
 * - Efficient shape-to-AABB conversions
 */
import type { CollisionDetector } from './CollisionDetector.js';
import type { SpatialEntity } from '../interfaces/SpatialEntity.js';
import type { CollisionResult } from '../types/CollisionResult.js';

import { SATCollisionDetector } from './strategies/SATCollisionDetector.js';
import { AABB } from '../value-objects/AABB.js';
import { QuadTree } from './QuadTree.js';

/**
 * Configuration for QuadTree spatial indexing.
 */
interface QuadTreeConfig {
  readonly maxDepth: number;
  readonly maxObjectsPerNode: number;
}

/**
 * Statistics about the spatial index state.
 */
interface SpatialIndexStats {
  readonly entityCount: number;
  readonly nodeCount: number;
  readonly maxDepth: number;
}

/**
 * Default QuadTree configuration optimised for typical Foundry scenes.
 */
const DEFAULT_QUADTREE_CONFIG: QuadTreeConfig = {
  maxDepth: 6,
  maxObjectsPerNode: 8
};

export class OptimisedCollisionDetector implements CollisionDetector {
  private readonly satDetector: SATCollisionDetector;
  private readonly spatialIndex: QuadTree;
  private readonly indexedEntities: Map<string, SpatialEntity>;

  /**
   * Creates a new optimised collision detector.
   */
  constructor(
    sceneBounds: AABB,
    config: QuadTreeConfig = DEFAULT_QUADTREE_CONFIG
  ) {
    this.satDetector = new SATCollisionDetector();
    this.spatialIndex = new QuadTree(sceneBounds, config);
    this.indexedEntities = new Map();
  }

  /**
   * Checks if a moving entity collides with any obstacles.
   * Uses spatial index for broad-phase and SAT for narrow-phase detection.
   */
  checkCollision(
    movingEntity: SpatialEntity,
    obstacles: SpatialEntity[]
  ): CollisionResult {

    if (!movingEntity.collidable) {
      return { isColliding: false, collidingWith: [] };
    }

    const collidingObstacles: SpatialEntity[] = [];
    const movingAABB = movingEntity.getAABB();
    const movingVerticalExtent = movingEntity.verticalExtent;

    // Get potential colliders from spatial index or use all obstacles
    const potentialColliders = this.indexedEntities.size > 0
      ? this.getPotentialColliders(movingAABB)
      : obstacles;

    // Create obstacle set for O(1) lookup
    const obstacleSet = new Set(obstacles);

    for (const obstacle of potentialColliders) {
      // Skip if not in the provided obstacles list
      if (!obstacleSet.has(obstacle)) {
        continue;
      }
      
      // Quick elevation check
      if (!movingVerticalExtent.overlaps(obstacle.verticalExtent)) {
        continue;
      }

      // Quick 2D AABB check
      if (!movingAABB.intersects(obstacle.getAABB())) {
        continue;
      }

      // Precise collision check
      if (this.satDetector.checkSingleCollision(movingEntity, obstacle)) {
        collidingObstacles.push(obstacle);
      }
    }

    return {
      isColliding: collidingObstacles.length > 0,
      collidingWith: collidingObstacles
    };
  }

  /**
   * Checks collision between two individual entities.
   * Performs early rejection checks before precise detection.
   */
  checkSingleCollision(
    entityA: SpatialEntity,
    entityB: SpatialEntity
  ): boolean {

    if (!entityA.collidable || !entityB.collidable) {
      return false;
    }
    
    // Quick elevation check
    if (!entityA.verticalExtent.overlaps(entityB.verticalExtent)) {
      return false;
    }

    // Quick 2D AABB check
    if (!entityA.getAABB().intersects(entityB.getAABB())) {
      return false;
    }

    // Precise SAT check
    return this.satDetector.checkSingleCollision(entityA, entityB);
  }

  /**
   * Adds a single entity to the spatial index.
   */
  addToSpatialIndex(entity: SpatialEntity): void {
    const bounds = entity.getAABB();
    
    this.spatialIndex.insert({
      id: entity.id,
      bounds,
      data: entity
    });
    
    this.indexedEntities.set(entity.id, entity);
  }

  /**
   * Removes a single entity from the spatial index.
   */
  removeFromSpatialIndex(entityId: string): void {
    if (this.indexedEntities.has(entityId)) {
      this.spatialIndex.remove(entityId);
      this.indexedEntities.delete(entityId);
    }
  }

  /**
   * Updates an entity's position in the spatial index.
   * More efficient than remove + add for position changes.
   */
  updateEntityInSpatialIndex(entity: SpatialEntity): void {
    // Remove old entry
    this.spatialIndex.remove(entity.id);
    
    // Add updated entry
    this.addToSpatialIndex(entity);
  }

  /**
   * Clears all spatial indices.
   */
  clear(): void {
    this.spatialIndex.clear();
    this.indexedEntities.clear();
  }

  /**
   * Gets statistics about the spatial index.
   */
  getStats(): SpatialIndexStats {
    return {
      entityCount: this.indexedEntities.size,
      nodeCount: this.spatialIndex.getNodeCount(),
      maxDepth: this.spatialIndex.getMaxDepth()
    };
  }

  // Private Helper Methods

  /**
   * Gets potential colliders from spatial index.
   */
  private getPotentialColliders(queryBounds: AABB): SpatialEntity[] {
    const results = this.spatialIndex.query(queryBounds);
    return results.map(result => result.data as SpatialEntity);
  }
}