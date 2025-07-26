/**
 * This module provides movement validation for tokens.
 * It handles path collision detection, distance constraints, and teleportation validation
 */

import type { SpatialEntity } from '../interfaces/SpatialEntity.js';
import type { CollisionDetector } from '../collision/CollisionDetector.js';
import type { SpatialVolume } from '../value-objects/SpatialVolume.js';
import type { MovementValidationResult } from '../types/MovementValidationResult.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

import { Vector3 } from '../value-objects/Vector3.js';
import { CollisionEntity } from '../value-objects/CollisionEntity.js';
import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';

/**
 * Movement validation options.
 * Controls how movement is validated and constrained.
 */
interface MovementOptions {
  /** Maximum allowed movement distance in grid units */
  maxDistance?: number;
  /** Whether to ignore elevation differences in collision detection */
  ignoreElevation?: boolean;
}

/**
 * Internal result structure for path validation.
 * Contains detailed information about path obstructions.
 */
interface PathValidationResult {
  /** Whether the path is clear of obstacles */
  clear: boolean;
  /** First collision point encountered along the path */
  firstCollisionPoint?: Vector3;
  /** Last valid position before collision */
  lastValidPosition: Vector3;
  /** All obstacles blocking the path */
  blockers: SpatialEntity[];
}

export class MovementValidator {
  private readonly logger: FoundryLogger;

  private static readonly MIN_STEP_SIZE = 1;
  private static readonly NEGLIGIBLE_DISTANCE = 0.1;
  private static readonly STEP_SCALE = {
    FINE: 10,
    NORMAL: 5,
    COARSE: 2
  } as const;

  constructor(
    private readonly collisionDetector: CollisionDetector,
    private readonly gridlessStepSize: number = 5
  ) {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.MovementValidator`);
  }

  // Public API - Movement Validation

  /**
   * Validates movement from start to end position.
   */
  validateMovement(
    startToken: SpatialEntity,
    movingToken: SpatialEntity,
    obstacles: SpatialEntity[],
    options: MovementOptions = {}
  ): MovementValidationResult {
    const { maxDistance, ignoreElevation = false } = options;

    const startPosition = this.extractPosition(startToken);
    const endPosition = this.extractPosition(movingToken);

    const travelDistance = this.calculateDistance(startPosition, endPosition, ignoreElevation);

    if (travelDistance < MovementValidator.NEGLIGIBLE_DISTANCE) {
      this.logger.debug('Movement negligible, early exit', { distance: travelDistance });
      return { type: 'ignored', position: endPosition };
    }

    const distanceValidation = this.validateDistanceConstraint(travelDistance, maxDistance);
    if (distanceValidation) {
      return distanceValidation;
    }

    const nonPassableObstacles = this.getNonPassableObstacles(startToken, obstacles);

    const pathResult = this.performPathValidation(
      startPosition,
      endPosition,
      travelDistance,
      movingToken,
      nonPassableObstacles,
      ignoreElevation
    );

    if (!pathResult.clear) {
      return this.createBlockedResult('path_blocked', pathResult);
    }

    const blockingObstacles = this.filterBlockingObstacles(obstacles);

    const destinationResult = this.validateDestination(movingToken, blockingObstacles);

    if (destinationResult.type === 'blocked') {
      return this.createDestinationBlockedResult(
        endPosition,
        pathResult.lastValidPosition,
        destinationResult.blockers ?? []
      );
    }

    return {
      type: 'valid',
      position: endPosition
    };
  }

  /**
   * Validates teleportation to a destination.
   */
  validateDestination(
    movingToken: SpatialEntity,
    obstacles: SpatialEntity[]
  ): MovementValidationResult {

    const collisionEntity = new CollisionEntity({
      position: movingToken.position,
      width: movingToken.width,
      height: movingToken.height,
      elevation: movingToken.elevation,
      disposition: movingToken.disposition,
      verticalHeight: movingToken.verticalHeight,
      isBlockingObstacle: movingToken.isBlockingObstacle
    });

    const collisionResult = this.collisionDetector.checkCollision(collisionEntity, obstacles);

    this.logger.debug('Destination validation complete', {
      tokenId: movingToken.id,
      destination: movingToken.position,
      obstacleCount: obstacles.length,
      isColliding: collisionResult.isColliding,
      blockerCount: collisionResult.collidingWith.length
    });

    if (collisionResult.isColliding) {
      return {
        type: 'blocked',
        reason: 'collision',
        blockers: collisionResult.collidingWith,
        collisionPoints: []
      };
    }

    return {
      type: 'valid',
      position: this.extractPosition(movingToken)
    };
  }

  // Private Methods - Position Management

  /**
   * Extracts a 3D position from a spatial entity.
   */
  private extractPosition(entity: SpatialEntity): Vector3 {
    return new Vector3(
      entity.position.x,
      entity.position.y,
      entity.elevation || 0
    );
  }

  /**
   * Calculates distance between two positions.
   */
  private calculateDistance(start: Vector3, end: Vector3, ignoreElevation: boolean): number {
    return ignoreElevation
      ? start.toVector2().distanceTo(end.toVector2())
      : start.distanceTo(end);
  }

  // Private Methods - Validation

  /**
   * Validates movement against distance constraints.
   */
  private validateDistanceConstraint(
    distance: number,
    maxDistance?: number
  ): MovementValidationResult | undefined {
    if (maxDistance !== undefined && distance > maxDistance) {
      return {
        type: 'invalid',
        reason: 'exceeds_max_distance',
        details: { distance, maxDistance }
      };
    }
    return undefined;
  }

  /**
   * Filters obstacles based on disposition rules.
   */
  private getNonPassableObstacles(
    movingEntity: SpatialEntity,
    obstacles: SpatialEntity[]
  ): SpatialEntity[] {

    return obstacles.filter(obstacle => {
      return !movingEntity.canPassThrough(obstacle);
    });
  }

  private filterBlockingObstacles(
    obstacles: SpatialEntity[]
  ): SpatialEntity[] {

    const blockingObstacles = obstacles.filter(obstacle => obstacle.isBlockingObstacle);

    return blockingObstacles;
  }

  /**
   * Performs path validation.
   */
  private performPathValidation(
    startPosition: Vector3,
    endPosition: Vector3,
    travelDistance: number,
    movingToken: SpatialEntity,
    obstacles: SpatialEntity[],
    ignoreElevation: boolean
  ): PathValidationResult {
    // Skip path validation if no obstacles
    if (obstacles.length === 0) {
      return { clear: true, lastValidPosition: endPosition, blockers: [] };
    }

    return this.validatePath(
      startPosition,
      endPosition,
      travelDistance,
      movingToken,
      obstacles,
      ignoreElevation
    );
  }

  /**
   * Creates a blocked movement result.
   */
  private createBlockedResult(
    reason: string,
    pathResult: PathValidationResult
  ): MovementValidationResult {
    return {
      type: 'blocked',
      reason,
      position: pathResult.lastValidPosition,
      blockers: pathResult.blockers,
      collisionPoints: pathResult.firstCollisionPoint ? [pathResult.firstCollisionPoint] : []
    };
  }

  /**
   * Creates a destination blocked result.
   */
  private createDestinationBlockedResult(
    endPosition: Vector3,
    lastValidPosition: Vector3,
    blockers: SpatialEntity[]
  ): MovementValidationResult {
    if (blockers.length === 0) {
      return {
        type: 'blocked',
        reason: 'destination_occupied',
        position: lastValidPosition,
        blockers: [],
        collisionPoints: []
      };
    }

    const nearestBlocker = this.findNearestBlocker(endPosition, blockers);
    const collisionPoint = this.extractPosition(nearestBlocker);

    return {
      type: 'blocked',
      reason: 'destination_occupied',
      position: lastValidPosition,
      blockers: [nearestBlocker],
      collisionPoints: [collisionPoint]
    };
  }

  // Private Methods - Path Validation

  /**
   * Validates a movement path for collisions.
   * 
   * Uses adaptive step size based on movement distance and shape size.
   */
  private validatePath(
    startPosition: Vector3,
    endPosition: Vector3,
    travelDistance: number,
    movingToken: SpatialEntity,
    obstacles: SpatialEntity[],
    ignoreElevation: boolean
  ): PathValidationResult {
    this.logger.debug('Validating movement path', {
      start: startPosition,
      end: endPosition,
      distance: travelDistance,
      tokenId: movingToken.id,
      obstacleCount: obstacles.length,
      ignoreElevation
    });

    // Calculate adaptive step parameters
    const stepSize = this.calculateStepSize(travelDistance, movingToken);
    const steps = Math.max(1, Math.ceil(travelDistance / stepSize));

    this.logger.debug('Path validation parameters', {
      distance: travelDistance,
      stepSize,
      steps,
      shapeType: movingToken.getSpatialVolume().type
    });

    // Initialise tracking variables
    let lastValidPosition = startPosition;
    let firstCollisionPoint: Vector3 | undefined;
    const allBlockers: SpatialEntity[] = [];
    const blockerIds = new Set<string>();

    // Check each step along the path
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const position = startPosition.lerp(endPosition, t);

      // Create collision entity at test position
      const collisionEntity = new CollisionEntity({
        position: position.toVector2(),
        width: movingToken.width,
        height: movingToken.height,
        elevation: ignoreElevation ? movingToken.elevation : position.z,
        disposition: movingToken.disposition,
        verticalHeight: movingToken.verticalHeight,
        isBlockingObstacle: movingToken.isBlockingObstacle
      });

      // Check for collisions
      const collisionResult = this.collisionDetector.checkCollision(collisionEntity, obstacles);

      if (collisionResult.isColliding) {
        // Record first collision point
        if (!firstCollisionPoint) {
          firstCollisionPoint = position;
          this.logger.debug('First collision detected', {
            atStep: i,
            stepPercentage: `${(t * 100).toFixed(2)}%`,
            collisionPosition: position,
            blockerCount: collisionResult.collidingWith.length
          });
        }

        // Collect unique blockers
        for (const blocker of collisionResult.collidingWith) {
          // Skip blockers without IDs
          if (!blocker.id) {
            this.logger.warn('Blocker without ID encountered', {
              blockerType: blocker.constructor.name,
              position: blocker.position
            });
            continue;
          }

          if (!blockerIds.has(blocker.id)) {
            blockerIds.add(blocker.id);
            allBlockers.push(blocker);
          }
        }

        // Early exit on collision
        this.logger.debug('Path blocked, exiting early', {
          atStep: i,
          blockerCount: allBlockers.length
        });
        break;
      }

      lastValidPosition = position;
    }

    // Compile and return results
    const result: PathValidationResult = {
      clear: allBlockers.length === 0,
      lastValidPosition,
      blockers: allBlockers
    };

    if (firstCollisionPoint) {
      result.firstCollisionPoint = firstCollisionPoint;
    }

    this.logger.debug('Path validation complete', {
      clear: result.clear,
      blockerCount: result.blockers.length,
      lastValidPosition: result.lastValidPosition,
      hasCollisionPoint: !!result.firstCollisionPoint
    });

    return result;
  }

  // Private Methods - Step Size Calculation
  // =======================================================================
  /**
   * Calculates optimal step size for path validation.
   * 
   * Balances accuracy with performance based on:
   * - Movement distance relative to token size
   * - Shape complexity
   * - Grid configuration
   */
  private calculateStepSize(distance: number, spatialEntity: SpatialEntity): number {
    const shapeSize = this.getShapeSmallestDimension(spatialEntity.getSpatialVolume());

    // Fine resolution for very small movements
    if (distance < shapeSize) {
      return Math.max(
        MovementValidator.MIN_STEP_SIZE,
        distance / MovementValidator.STEP_SCALE.FINE
      );
    }

    // Medium resolution for moderate movements
    if (distance < shapeSize * 5) {
      return Math.max(
        MovementValidator.STEP_SCALE.COARSE,
        shapeSize / MovementValidator.STEP_SCALE.FINE
      );
    }

    // Coarse resolution for long movements
    return Math.max(
      this.gridlessStepSize,
      shapeSize / MovementValidator.STEP_SCALE.NORMAL
    );
  }

  /**
   * Gets the smallest dimension of a spatial volume.
   * 
   * Used for calculating appropriate step sizes based on
   * the entity's physical size.
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

  // Private Methods - Geometry Helpers

  /**
   * Calculates bounding box dimensions for a set of vertices.
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

  /**
   * Finds the nearest blocker to a given position.
   */
  private findNearestBlocker(position: Vector3, blockers: SpatialEntity[]): SpatialEntity {

    if (blockers.length === 1) {
      return blockers[0]!;
    }

    const position2D = position.toVector2();
    let nearestBlocker = blockers[0]!;
    let minDistance = position2D.distanceTo(nearestBlocker.position);

    for (let i = 1; i < blockers.length; i++) {
      const blocker = blockers[i]!;
      const distance = position2D.distanceTo(blocker.position);

      if (distance < minDistance) {
        minDistance = distance;
        nearestBlocker = blocker;
      }
    }

    return nearestBlocker;
  }
}