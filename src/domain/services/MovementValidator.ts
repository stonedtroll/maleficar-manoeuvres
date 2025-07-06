/**
 * Core domain service for validating token movement. Provides movement validation including path
 * collision detection, distance constraints, and teleportation validation.
 * 
 * Performance optimisations:
 * - Adaptive step size based on movement distance and shape size
 * - Early exit on first collision detection
 * - Efficient shape transformation caching
 * - Minimal object allocations during path validation
 */
import type { SpatialEntity } from '../interfaces/SpatialEntity.js';
import type { CollisionDetector } from '../collision/CollisionDetector.js';
import type { SpatialVolume } from '../value-objects/SpatialVolume.js';
import type { MovementValidationResult } from '../types/MovementValidationResult.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

import { Vector3 } from '../value-objects/Vector3.js';
import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';

/**
 * Movement validation options.
 */
interface MovementOptions {
  /** Maximum allowed movement distance */
  maxDistance?: number;
  /** Whether to ignore elevation differences in collision detection */
  ignoreElevation?: boolean;
}

/**
 * Path validation result internal structure.
 */
interface PathValidationResult {
  /** Whether the path is clear of obstacles */
  clear: boolean;
  /** First collision point if path is blocked */
  firstCollisionPoint?: Vector3;
  /** Last valid position before collision */
  lastValidPosition: Vector3;
  /** Obstacles blocking the path */
  blockers: SpatialEntity[];
}

export class MovementValidator {
  private readonly logger: FoundryLogger;

  /** Default step size for very small movements */
  private static readonly MIN_STEP_SIZE = 1;

  /** Step size scaling factors */
  private static readonly STEP_SCALE = {
    FINE: 10,    // For movements smaller than shape size
    NORMAL: 5,   // For normal movements
    COARSE: 2    // For long-distance movements
  } as const;

  constructor(
    private readonly collisionDetector: CollisionDetector,
    private readonly gridlessStepSize: number = 5
  ) {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.MovementValidator`);
  }

  /**
   * Validates movement from start to end position.
   * Checks the entire path for collisions and distance constraints.
   */
  validateMovement(
    moveable: SpatialEntity,
    start: Vector3,
    end: Vector3,
    obstacles: SpatialEntity[],
    options: MovementOptions = {}
  ): MovementValidationResult {
    const { maxDistance, ignoreElevation = false } = options;

    // Validate distance constraint
    if (maxDistance !== undefined) {
      const distance = ignoreElevation
        ? start.toVector2().distanceTo(end.toVector2())
        : start.distanceTo(end);

      if (distance > maxDistance) {
        return {
          type: 'invalid',
          reason: 'exceeds_max_distance',
          details: { distance, maxDistance }
        };
      }
    }

    const blockingObstacles = moveable.disposition === undefined
      ? obstacles // No disposition = blocked by everything
      : obstacles.filter(obstacle => {
          // Obstacles without disposition always block
          if (obstacle.disposition === undefined) {
            return true;
          }
          // Check if moveable can pass through this obstacle
          return !moveable.canPassThrough(obstacle.disposition);
        });

    const pathResult = this.validatePath(
      start,
      end,
      moveable,
      blockingObstacles,
      ignoreElevation
    );

    if (!pathResult.clear) {
      return {
        type: 'blocked',
        reason: 'path_blocked',
        position: pathResult.lastValidPosition,
        blockers: pathResult.blockers,
        collisionPoints: pathResult.firstCollisionPoint ? [pathResult.firstCollisionPoint] : []
      };
    }

    const destinationResult = this.validateDestination(moveable, end, obstacles);

    if (destinationResult.type === 'blocked') {
      const blockers = destinationResult.blockers ?? [];
      if (blockers.length > 0) {
        let nearestDestinationBlocker: SpatialEntity = blockers[0]!;

        if (blockers.length > 1) {
          // Convert end position to 2D for consistent distance calculation
          const end2D = end.toVector2();

          const closestPosition = nearestDestinationBlocker.position;

          let minDistance = end2D.distanceTo(closestPosition);

          for (let i = 1; i < blockers.length; i++) {
            const blocker = blockers[i]!;
            const blockerPosition = blocker.position;

            const distance = end2D.distanceTo(blockerPosition);
            if (distance < minDistance) {
              minDistance = distance;
              nearestDestinationBlocker = blocker;
            }
          }
        }

        // Convert blocker position to Vector3 for collision points
        const blockerPosition = nearestDestinationBlocker.position;
        const blockerElevation = nearestDestinationBlocker.elevation || 0;
        const collisionPoint = new Vector3(blockerPosition.x, blockerPosition.y, blockerElevation);

        return {
          type: 'blocked',
          reason: 'destination_occupied',
          position: pathResult.lastValidPosition,
          blockers: [nearestDestinationBlocker],
          collisionPoints: [collisionPoint]
        };
      }
    }

    return {
      type: 'valid',
      position: end
    };
  }

  /**
   * Validates teleportation to a destination.
   * Only checks destination collision, not the path.
   */
  validateDestination(
    moveable: SpatialEntity,
    destination: Vector3,
    obstacles: SpatialEntity[]
  ): MovementValidationResult {
    const blockers: SpatialEntity[] = [];
    const originalPosition = moveable.position;
    const originalElevation = moveable.elevation || 0;

    moveable.move?.(destination);

    for (const obstacle of obstacles) {
      if (this.collisionDetector.checkSingleCollision(moveable, obstacle)) {
        blockers.push(obstacle);
      }
    }

    moveable.move?.(new Vector3(originalPosition.x, originalPosition.y, originalElevation));


    this.logger.debug('Validating destination', {
      moveable: moveable,
      destination,
      obstacleCount: obstacles.length,
      blockers: blockers
    });

    if (blockers.length > 0) {
      return {
        type: 'blocked',
        reason: 'collision',
        blockers,
        collisionPoints: []
      };
    }

    return {
      type: 'valid',
      position: destination
    };
  }

  // Path Validation

  /**
   * Validates a movement path for collisions.
   * Uses adaptive step size based on movement distance and shape size.
   */
  private validatePath(
    start: Vector3,
    end: Vector3,
    moveable: SpatialEntity,
    obstacles: SpatialEntity[],
    ignoreElevation: boolean
  ): PathValidationResult {
    this.logger.debug('Validating movement path', {
      start,
      end,
      moveable: moveable.id,
      moveablePosition: moveable.position,
      obstacleCount: obstacles.length,
      ignoreElevation
    });

    const distance = ignoreElevation
      ? start.toVector2().distanceTo(end.toVector2())
      : start.distanceTo(end);

    // Optimisation: No movement, no collision
    if (distance < 0.001) {
      return {
        clear: true,
        lastValidPosition: end,
        blockers: []
      };
    }

    const stepSize = this.calculateStepSize(distance, moveable);
    const steps = Math.max(1, Math.ceil(distance / stepSize));

    this.logger.debug('Path validation parameters', {
      distance,
      stepSize,
      steps,
      shapeType: moveable.getSpatialVolume().type
    });

    let lastValidPosition = start;
    let firstCollisionPoint: Vector3 | undefined;
    let allBlockers: SpatialEntity[] = [];

    // Store original position
    const originalPosition = moveable.position;
    const originalElevation = (moveable as any).elevation || 0;

    // Check each step along the path
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const position = start.lerp(end, t);

      // Move entity to test position
      moveable.move?.(position);

      // Use collision detector to check against all obstacles at once
      const collisionResult = this.collisionDetector.checkCollision(moveable, obstacles);

      if (collisionResult.isColliding) {
        if (!firstCollisionPoint) {
          firstCollisionPoint = position;
          this.logger.debug('First collision detected', {
            atStep: i,
            stepPercentage: (t * 100).toFixed(2) + '%',
            collisionPosition: position,
            blockerCount: collisionResult.collidingWith.length
          });
        }
        
        // Collect all unique blockers
        for (const blocker of collisionResult.collidingWith) {
          if (!allBlockers.some(b => b.id === blocker.id)) {
            allBlockers.push(blocker);
          }
        }

        // Restore original position and exit early
        moveable.move?.(new Vector3(originalPosition.x, originalPosition.y, originalElevation));
        
        this.logger.debug('Path blocked, exiting early', {
          atStep: i,
          blockerCount: allBlockers.length,
          blockerIds: allBlockers.map(b => ({
            id: b.id,
            name: (b as any).name
          }))
        });
        break;
      }

      lastValidPosition = position;
    }

    // Restore original position
    moveable.move?.(new Vector3(originalPosition.x, originalPosition.y, originalElevation));

    const result = {
      clear: allBlockers.length === 0,
      ...(firstCollisionPoint && { firstCollisionPoint }),
      lastValidPosition,
      blockers: allBlockers
    };

    this.logger.debug('Path validation complete', {
      clear: result.clear,
      blockerCount: result.blockers.length,
      lastValidPosition: result.lastValidPosition,
      firstCollisionPoint: result.firstCollisionPoint
    });

    return result;
  }

  // Step Size Calculation

  /**
   * Calculates optimal step size for path validation.
   * Balances accuracy with performance based on movement distance.
   */
  private calculateStepSize(distance: number, spatialEntity: SpatialEntity): number {
    const shapeSize = this.getShapeSmallestDimension(spatialEntity.getSpatialVolume());

    // Fine steps for very small movements
    if (distance < shapeSize) {
      return Math.max(MovementValidator.MIN_STEP_SIZE, distance / MovementValidator.STEP_SCALE.FINE);
    }

    // Normal steps for medium movements
    if (distance < shapeSize * 5) {
      return Math.max(MovementValidator.STEP_SCALE.COARSE, shapeSize / MovementValidator.STEP_SCALE.FINE);
    }

    // Coarse steps for long movements
    return Math.max(this.gridlessStepSize, shapeSize / MovementValidator.STEP_SCALE.NORMAL);
  }

  /**
   * Gets the smallest dimension of a collision shape.
   * Used for calculating appropriate step sizes.
   */
  private getShapeSmallestDimension(shape: SpatialVolume): number {
    switch (shape.type) {
      case 'sphere':
        return shape.radius * 2;

      case 'cylinder':
        return Math.min(shape.radius * 2, shape.height);

      case 'box':
        return Math.min(shape.width, shape.height, shape.depth);

      case 'capsule':
        return shape.radius * 2;

      case 'mesh':
      case 'convexHull': {
        const bounds = this.getVertexBounds(shape.vertices);
        return Math.min(bounds.width, bounds.height, bounds.depth);
      }

      case 'extrudedPolygon': {
        const bounds2D = shape.polygon.getBoundingBox();
        const width = bounds2D.max.x - bounds2D.min.x;
        const height = bounds2D.max.y - bounds2D.min.y;
        const depth = shape.verticalExtent.height;
        return Math.min(width, height, depth);
      }

      default:
        shape satisfies never;
        return this.gridlessStepSize;
    }
  }

  // Geometry Helpers

  /**
   * Calculates bounding box for vertices.
   */
  private getVertexBounds(vertices: readonly Vector3[]): {
    width: number;
    height: number;
    depth: number;
  } {
    if (vertices.length === 0) {
      return { width: 0, height: 0, depth: 0 };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const vertex of vertices) {
      minX = Math.min(minX, vertex.x);
      minY = Math.min(minY, vertex.y);
      minZ = Math.min(minZ, vertex.z);
      maxX = Math.max(maxX, vertex.x);
      maxY = Math.max(maxY, vertex.y);
      maxZ = Math.max(maxZ, vertex.z);
    }

    return {
      width: maxX - minX,
      height: maxY - minY,
      depth: maxZ - minZ
    };
  }
}