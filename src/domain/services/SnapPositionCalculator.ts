/**
 * Collision resolution service. Calculates valid snap positions when token movement is blocked by obstacles.
 * 
 * The service performs a simple back-off calculation along the movement path to find the closest valid position
 * where the moving token is touching but not overlapping the blocking obstacle.
 * 
 * Key Features:
 * - Binary search for precise touch points along movement path
 * - Validates snap positions don't create new collisions
 * - Returns failure if no valid position exists
 * 
 * Performance Optimisations:
 * - Early exit when no movement possible
 * - Efficient binary search with configurable precision
 * - Minimal shape transformations
 */

import type { CollisionDetector } from '../collision/CollisionDetector.js';
import type { Collidable } from '../interfaces/Collidable.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

import { Vector2 } from '../value-objects/Vector2.js';
import { Vector3 } from '../value-objects/Vector3.js';
import { CollisionShape } from '../value-objects/CollisionShape.js';
import { Polygon2D } from '../value-objects/Polygon2D.js';
import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';

/**
 * Result of snap position calculation.
 */
export interface SnapResult {
  /** Whether a valid snap position was found */
  success: boolean;
  /** Calculated snap position in 3D space */
  position?: Vector3;
  /** Entity that blocked movement */
  snapTarget?: Collidable;
  /** Reason for failure if unsuccessful */
  reason?: string;
}

/**
 * Configuration constants for snap calculations.
 */
const SNAP_CONFIG = {
  /** Maximum iterations for binary search */
  BINARY_SEARCH_ITERATIONS: 30,
  /** Minimum movement distance threshold */
  MIN_MOVEMENT_DISTANCE: 0.001,
  /** Small offset to ensure no overlap after snapping */
  SEPARATION_BUFFER: 0.1,
  /** Precision for touch detection */
  TOUCH_PRECISION: 0.01
} as const;

export class SnapPositionCalculator {
  private readonly logger: FoundryLogger;

  constructor(
    private readonly collisionDetector: CollisionDetector
  ) {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.SnapPositionCalculator`, {moduleIdColour: 'blue'});
  }

  /**
   * Calculates optimal snap position when movement is blocked.
   * 
   * Algorithm:
   * 1. Binary search along the movement path from target back to start
   * 2. Find the closest position to target where tokens are touching but not overlapping
   * 3. Return failure if the only valid position is the start position
   */
  calculateSnapPosition(
    movingEntity: Collidable,
    startPosition: Vector3,
    targetPosition: Vector3,
    snapTargetEntity: Collidable,
    allObstacles: Collidable[]
  ): SnapResult {
    this.logger.debug('Starting snap calculation', {
      movingEntity: movingEntity,
      startPosition: startPosition,
      targetPosition: targetPosition,
      snapTarget: snapTargetEntity
    });

    // Validate movement
    const distance = startPosition.distanceTo(targetPosition);
    if (distance < SNAP_CONFIG.MIN_MOVEMENT_DISTANCE) {
      this.logger.warn('No movement detected', { distance });
      return {
        success: false,
        reason: 'No movement detected'
      };
    }

    // Find snap position by backing off from target
    const snapPosition = this.findSnapPositionAlongPath(
      movingEntity,
      startPosition,
      targetPosition,
      snapTargetEntity
    );

    // Check if we found a valid position
    if (!snapPosition) {
      this.logger.debug('No valid snap position found');
      return {
        success: false,
        reason: 'No valid snap position along path'
      };
    }

    // Check if the snap position is essentially the start position
    if (snapPosition.distanceTo(startPosition) < SNAP_CONFIG.MIN_MOVEMENT_DISTANCE) {
      this.logger.debug('Snap position is start position - no movement possible');
      return {
        success: false,
        reason: 'Token cannot move from current position'
      };
    }

    // Validate against other obstacles
    const otherObstacles = allObstacles.filter(o => o.id !== snapTargetEntity.id);
    if (this.hasCollisionWithAny(movingEntity, snapPosition, otherObstacles)) {
      this.logger.warn('Snap position collides with other obstacles');
      return {
        success: false,
        reason: 'Snap position blocked by other obstacles'
      };
    }

    return {
      success: true,
      position: snapPosition,
      snapTarget: snapTargetEntity
    };
  }

  /**
   * Finds the closest valid position to the snapTarget along the movement path.
   * Uses binary search to find where the tokens are touching but not overlapping.
   */
  private findSnapPositionAlongPath(
    movingEntity: Collidable,
    start: Vector3,
    target: Vector3,
    snapTarget: Collidable
  ): Vector3 | null {
    const movingShape = movingEntity.getCollisionShape();
    const targetShape = snapTarget.getCollisionShape();

    // Calculate the offset from position (top-left) to centre
    const positionToCentreOffset = new Vector3(
      movingEntity.centre.x - movingEntity.position.x,
      movingEntity.centre.y - movingEntity.position.y,
      0
    );

    // Get the snapTarget's position
    const snapTargetPosition = new Vector3(
      snapTarget.position.x,
      snapTarget.position.y,
      0
    );

    // Project the snapTarget's position onto the movement path to find the closest point
    const pathDirection = target.subtract(start);
    const pathLength = pathDirection.magnitude();
    
    if (pathLength < SNAP_CONFIG.MIN_MOVEMENT_DISTANCE) {
      this.logger.warn('Path too short for snap calculation');
      return null;
    }

    const pathNormalised = pathDirection.normalised();
    const toSnapTarget = snapTargetPosition.subtract(start);
    const projectionLength = toSnapTarget.dot(pathNormalised);
    
    // Clamp the projection to the path
    const clampedProjection = Math.max(0, Math.min(pathLength, projectionLength));
    const closestPointOnPath = start.add(pathNormalised.multiply(clampedProjection));
    
    // Find the t value for this point
    const closestT = clampedProjection / pathLength;

    this.logger.debug('Closest point on path to snapTarget', {
      snapTargetPosition,
      closestPointOnPath,
      closestT,
      percentageOfPath: (closestT * 100).toFixed(2) + '%'
    });

    // Binary search backwards from the closest point to find touch position
    let low = 0;  // Start position (should be collision-free)
    let high = closestT; // Closest point to snapTarget
    let bestValidT = 0;
    let bestValidPosition = start;

    // Verify start position is collision-free
    const startCentre = start.add(positionToCentreOffset);
    const startShape = this.translateShapeTo(movingShape, startCentre);
    if (this.collisionDetector.checkShapeCollision(startShape, targetShape)) {
      this.logger.warn('Start position already colliding with snap target');
      return null;
    }

    // Binary search for the touch point
    for (let i = 0; i < SNAP_CONFIG.BINARY_SEARCH_ITERATIONS; i++) {
      const mid = (low + high) / 2;
      const testPosition = start.lerp(target, mid);
      // Convert top-left position to centre position
      const testCentre = testPosition.add(positionToCentreOffset);
      const testShape = this.translateShapeTo(movingShape, testCentre);
      
      if (this.collisionDetector.checkShapeCollision(testShape, targetShape)) {
        // Collision detected, back off more
        high = mid;
      } else {
        // No collision, can move closer
        low = mid;
        bestValidT = mid;
        bestValidPosition = testPosition;
      }

      // Check if we've converged
      if (high - low < SNAP_CONFIG.TOUCH_PRECISION) {
        break;
      }
    }

    this.logger.debug('Binary search complete', {
      bestT: bestValidT,
      percentageOfPath: (bestValidT * 100).toFixed(2) + '%',
      bestPosition: bestValidPosition
    });

    // Apply small buffer to ensure no overlap
    if (bestValidT > 0) {
      const backOffT = Math.max(0, bestValidT - SNAP_CONFIG.SEPARATION_BUFFER / 100);
      bestValidPosition = start.lerp(target, backOffT);
    }

    return bestValidPosition;
  }

  /**
   * Checks if entity at position collides with any of the specified obstacles.
   */
  private hasCollisionWithAny(
    movingEntity: Collidable,
    position: Vector3,
    obstacles: Collidable[]
  ): boolean {
    const shape = movingEntity.getCollisionShape();
    
    // Calculate the offset from position (top-left) to centre
    const positionToCentreOffset = new Vector3(
      movingEntity.centre.x - movingEntity.position.x,
      movingEntity.centre.y - movingEntity.position.y,
      0
    );
    
    // Convert top-left position to centre position
    const centrePosition = position.add(positionToCentreOffset);
    const adjustedShape = this.translateShapeTo(shape, centrePosition);

    return obstacles.some(obstacle =>
      this.collisionDetector.checkShapeCollision(
        adjustedShape,
        obstacle.getCollisionShape()
      )
    );
  }

  /**
   * Translates a shape to a new 3D position.
   * Maintains the shape's orientation and size while moving its centre.
   */
  private translateShapeTo(shape: CollisionShape, newPosition: Vector3): CollisionShape {
    switch (shape.type) {
      case 'sphere':
        return {
          type: 'sphere',
          centre: newPosition,
          radius: shape.radius
        };

      case 'cylinder': {
        const result: Extract<CollisionShape, { type: 'cylinder' }> = {
          type: 'cylinder',
          centre: newPosition,
          radius: shape.radius,
          height: shape.height
        };
        if (shape.axis) {
          result.axis = shape.axis;
        }
        return result;
      }

      case 'box': {
        const result: Extract<CollisionShape, { type: 'box' }> = {
          type: 'box',
          centre: newPosition,
          width: shape.width,
          height: shape.height,
          depth: shape.depth
        };
        if (shape.rotation) {
          result.rotation = shape.rotation;
        }
        return result;
      }

      case 'capsule': {
        const currentCentre = shape.start.add(shape.end).divide(2);
        const offset = newPosition.subtract(currentCentre);
        return {
          type: 'capsule',
          start: shape.start.add(offset),
          end: shape.end.add(offset),
          radius: shape.radius
        };
      }

      case 'extrudedPolygon': {
        const currentCentre2D = this.getPolygonCentre(shape.polygon.vertices);
        const currentCentre3D = new Vector3(
          currentCentre2D.x,
          currentCentre2D.y,
          shape.verticalExtent.centre
        );
        const offset = newPosition.subtract(currentCentre3D);

        const translatedVertices = shape.polygon.vertices.map(v =>
          v.add(new Vector2(offset.x, offset.y))
        );

        return {
          type: 'extrudedPolygon',
          polygon: Polygon2D.fromVertices(translatedVertices),
          verticalExtent: shape.verticalExtent.translate(offset.z)
        };
      }

      case 'mesh': {
        const currentCentre = this.getVertexCentre(shape.vertices);
        const offset = newPosition.subtract(currentCentre);
        return {
          type: 'mesh',
          vertices: shape.vertices.map(v => v.add(offset)),
          triangles: shape.triangles
        };
      }

      case 'convexHull': {
        const currentCentre = this.getVertexCentre(shape.vertices);
        const offset = newPosition.subtract(currentCentre);
        return {
          type: 'convexHull',
          vertices: shape.vertices.map(v => v.add(offset))
        };
      }

      default:
        shape satisfies never;
        throw new Error(`Unhandled shape type`);
    }
  }

  /**
   * Calculates centre of 2D polygon vertices.
   */
  private getPolygonCentre(vertices: readonly Vector2[]): Vector2 {
    if (vertices.length === 0) {
      return new Vector2(0, 0);
    }
    const sum = vertices.reduce((acc, v) => acc.add(v), new Vector2(0, 0));
    return sum.divide(vertices.length);
  }

  /**
   * Calculates centre of 3D vertices.
   */
  private getVertexCentre(vertices: readonly Vector3[]): Vector3 {
    if (vertices.length === 0) {
      return new Vector3(0, 0, 0);
    }
    const sum = vertices.reduce((acc, v) => acc.add(v), new Vector3(0, 0, 0));
    return sum.divide(vertices.length);
  }
}