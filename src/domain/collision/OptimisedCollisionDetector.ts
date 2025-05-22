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
import type { Collidable } from '../interfaces/Collidable.js';
import type { CollisionShape } from '../value-objects/CollisionShape.js';
import type { CollisionResult } from '../types/CollisionResult.js';

import { SATCollisionDetector } from './strategies/SATCollisionDetector.js';
import { CollisionShapeGuards } from '../value-objects/CollisionShape.js';
import { AABB } from '../value-objects/AABB.js';
import { QuadTree } from './QuadTree.js';
import { Vector2 } from '../value-objects/Vector2.js';

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
  private readonly indexedEntities: Map<string, Collidable>;

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
    movingEntity: Collidable,
    obstacles: Collidable[]
  ): CollisionResult {
    const collidingObstacles: Collidable[] = [];
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
    entityA: Collidable,
    entityB: Collidable
  ): boolean {
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
   * Checks collision between two shapes.
   * Performs early rejection checks before precise detection.
   */
  checkShapeCollision(
    shapeA: CollisionShape,
    shapeB: CollisionShape
  ): boolean {
    // Quick elevation check using shape guards
    const extentA = CollisionShapeGuards.getVerticalExtent(shapeA);
    const extentB = CollisionShapeGuards.getVerticalExtent(shapeB);
    
    if (!extentA.overlaps(extentB)) {
      return false;
    }

    // Quick 2D AABB check
    const aabbA = this.getShapeAABB(shapeA);
    const aabbB = this.getShapeAABB(shapeB);
    
    if (!aabbA.intersects(aabbB)) {
      return false;
    }

    // Delegate to SAT detector for precise collision
    return this.satDetector.checkShapeCollision(shapeA, shapeB);
  }

  // Spatial Index Management

  /**
   * Updates the spatial index with current entities.
   * Should be called when scene entities change significantly.
   */
  updateSpatialIndex(entities: Collidable[]): void {
    this.clear();

    for (const entity of entities) {
      this.addToSpatialIndex(entity);
    }
  }

  /**
   * Adds a single entity to the spatial index.
   */
  addToSpatialIndex(entity: Collidable): void {
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
  updateEntityInSpatialIndex(entity: Collidable): void {
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
  private getPotentialColliders(queryBounds: AABB): Collidable[] {
    const results = this.spatialIndex.query(queryBounds);
    return results.map(result => result.data as Collidable);
  }

  /**
   * Converts a collision shape to 2D AABB for spatial indexing.
   * Optimised for common Foundry VTT shapes.
   */
  private getShapeAABB(shape: CollisionShape): AABB {
    switch (shape.type) {
      case 'sphere':
        return AABB.fromCircle(
          new Vector2(shape.centre.x, shape.centre.y),
          shape.radius
        );

      case 'cylinder':
        return this.getCylinderAABB(shape);

      case 'box':
        return this.getBoxAABB(shape);

      case 'capsule':
        return this.getCapsuleAABB(shape);

      case 'extrudedPolygon':
        return AABB.fromPoints([...shape.polygon.vertices]);

      case 'mesh':
      case 'convexHull':
        return this.getVertexBasedAABB(shape);

      default:
        shape satisfies never;
        throw new Error(`Unhandled shape type`);
    }
  }

  /**
   * Gets AABB for cylinder shape.
   */
  private getCylinderAABB(cylinder: Extract<CollisionShape, { type: 'cylinder' }>): AABB {
    // Vertical cylinder - simple case
    if (cylinder.axis === 'z' || !cylinder.axis) {
      return AABB.fromCircle(
        new Vector2(cylinder.centre.x, cylinder.centre.y),
        cylinder.radius
      );
    }

    // Non-vertical cylinder - conservative bounds
    const maxExtent = Math.sqrt(
      cylinder.radius * cylinder.radius + 
      (cylinder.height * cylinder.height) / 4
    );
    
    return AABB.fromCircle(
      new Vector2(cylinder.centre.x, cylinder.centre.y),
      maxExtent
    );
  }

  /**
   * Gets AABB for box shape.
   */
  private getBoxAABB(box: Extract<CollisionShape, { type: 'box' }>): AABB {
    // Unrotated box
    if (!box.rotation || (box.rotation.x === 0 && box.rotation.y === 0 && box.rotation.z === 0)) {
      const halfWidth = box.width / 2;
      const halfHeight = box.height / 2;
      
      return new AABB(
        new Vector2(box.centre.x - halfWidth, box.centre.y - halfHeight),
        new Vector2(box.centre.x + halfWidth, box.centre.y + halfHeight)
      );
    }

    // Z-rotated box only
    if (!box.rotation.x && !box.rotation.y) {
      return AABB.fromRectangle(
        new Vector2(box.centre.x, box.centre.y),
        box.width,
        box.height,
        box.rotation.z
      );
    }

    // Fully rotated box - conservative bounds
    const diagonal = Math.sqrt(
      box.width * box.width + 
      box.height * box.height + 
      box.depth * box.depth
    ) / 2;
    
    return AABB.fromCircle(
      new Vector2(box.centre.x, box.centre.y),
      diagonal
    );
  }

  /**
   * Gets AABB for capsule shape.
   */
  private getCapsuleAABB(capsule: Extract<CollisionShape, { type: 'capsule' }>): AABB {
    const minX = Math.min(capsule.start.x, capsule.end.x) - capsule.radius;
    const maxX = Math.max(capsule.start.x, capsule.end.x) + capsule.radius;
    const minY = Math.min(capsule.start.y, capsule.end.y) - capsule.radius;
    const maxY = Math.max(capsule.start.y, capsule.end.y) + capsule.radius;
    
    return new AABB(
      new Vector2(minX, minY),
      new Vector2(maxX, maxY)
    );
  }

  /**
   * Gets AABB for vertex-based shapes (mesh, convex hull).
   */
  private getVertexBasedAABB(
    shape: Extract<CollisionShape, { type: 'mesh' | 'convexHull' }>
  ): AABB {
    const vertices2D = shape.vertices.map(v => new Vector2(v.x, v.y));
    return AABB.fromPoints(vertices2D);
  }
}