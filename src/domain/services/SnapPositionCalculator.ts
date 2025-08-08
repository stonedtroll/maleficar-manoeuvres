/**
 * Collision resolution service. Calculates valid snap positions when token movement is blocked by obstacles.
 * 
 * The service performs a simple back-off calculation along the movement path to find the closest valid position
 * where the moving token is touching but not overlapping the blocking obstacle.
 */
import type { CollisionDetector } from '../collision/CollisionDetector.js';
import type { SpatialEntity } from '../interfaces/SpatialEntity.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

import { CollisionEntity } from '../value-objects/CollisionEntity.js';
import { Vector3 } from '../value-objects/Vector3.js';
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
  snapTarget?: SpatialEntity;
  /** Reason for failure if unsuccessful */
  reason?: string;
}

/**
 * Configuration constants for snap calculations.
 */
const SNAP_CONFIG = {
  /** Maximum iterations for binary search */
  BINARY_SEARCH_ITERATIONS: 50,
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
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.SnapPositionCalculator`, { moduleIdColour: 'blue' });
  }

  /**
   * Calculates optimal snap position when movement is blocked.
   */
  calculateSnapPosition(
    movingEntity: SpatialEntity,
    startPosition: Vector3,
    targetPosition: Vector3,
    snapTargetEntity: SpatialEntity,
    allObstacles: SpatialEntity[],
    collisionPoint: Vector3
  ): SnapResult {
    this.logger.debug('Starting snap calculation', {
      movingEntity: movingEntity,
      startPosition: startPosition,
      targetPosition: targetPosition,
      snapTarget: snapTargetEntity
    });

    const otherObstacles = allObstacles.filter(o => o.id !== movingEntity.id);
    // Find snap position by backing off from target
    const snapPosition = this.findSnapPositionAlongPath(
      movingEntity,
      startPosition,
      targetPosition,
      snapTargetEntity,
      otherObstacles,
      collisionPoint
    );

    if (!snapPosition) {
      this.logger.debug('No valid snap position found');
      return {
        success: false,
        reason: 'No valid snap position along path'
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
    movingEntity: SpatialEntity,
    start: Vector3,
    target: Vector3,
    snapTarget: SpatialEntity,
    otherObstacles: SpatialEntity[],
    collisionPoint: Vector3
  ): Vector3 | null {

    let estimatedCollisionT = -1;

    if (collisionPoint) {
        const pathLength = start.distanceTo(target);
        const collisionDistance = start.distanceTo(collisionPoint);
        estimatedCollisionT = collisionDistance / pathLength;

        this.logger.debug('Using collision point to optimise search', {
          collisionPoint: collisionPoint,
          estimatedT: (estimatedCollisionT * 100).toFixed(2) + '%',
        });
    }

    let bestValidT = -1; // Use -1 to indicate no valid position found yet
    let bestValidPosition: Vector3 | null = null;

    // Start from the collision point and work backwards
    const pathLength = start.distanceTo(target);
    const stepSize = 1.0 / pathLength; 
    
    // Linear search backwards from collision point
    for (let t = estimatedCollisionT; t >= 0; t -= stepSize) {
      const testPosition = start.lerp(target, t);
      
      // Move entity to test position
      const collisionEntity = new CollisionEntity({
        position: testPosition.toVector2(),
        width: movingEntity.width,
        height: movingEntity.height,
        elevation: testPosition.z,
        disposition: movingEntity.disposition,
        verticalHeight: movingEntity.verticalHeight,
        collidable: movingEntity.collidable,
        providesCover: movingEntity.providesCover
      });
      
      // Check for any collisions
      const allCollisions = this.collisionDetector.checkCollision(collisionEntity, [snapTarget, ...otherObstacles]);
      
      if (!allCollisions.isColliding) {
        // Found a valid position
        bestValidT = t;
        bestValidPosition = testPosition;
        
        this.logger.debug('Found valid position', {
          t,
          percentageOfPath: (t * 100).toFixed(2) + '%',
          position: testPosition
        });
        
        // Now do a small forward search to get as close as possible
        const fineStepSize = stepSize / 10; // 0.1 unit steps
        for (let fineT = t; fineT <= estimatedCollisionT; fineT += fineStepSize) {
          const finePosition = start.lerp(target, fineT);
          const fineCollisionEntity = new CollisionEntity({
            position: finePosition.toVector2(),
            width: movingEntity.width,
            height: movingEntity.height,
            elevation: finePosition.z,
            disposition: movingEntity.disposition,
            verticalHeight: movingEntity.verticalHeight,
            collidable: movingEntity.collidable,
            providesCover: movingEntity.providesCover
          });

          const fineCollisions = this.collisionDetector.checkCollision(fineCollisionEntity, [snapTarget, ...otherObstacles]);

          if (fineCollisions.isColliding) {
            // Hit a collision, use previous position
            break;
          }
          
          bestValidT = fineT;
          bestValidPosition = finePosition;
        }
        
        break; // Found our position
      }
    }

    // Alternative approach: Gradient descent from collision point
    if (bestValidT < 0) {
      this.logger.debug('Linear search failed, trying gradient descent');
      
      // Start at collision point and move back by token radius
      const tokenRadius = (movingEntity as any).radius || 27.5;
      const backoffDistance = tokenRadius * 2.1; // Slightly more than diameter
      const backoffT = backoffDistance / pathLength;
      
      let currentT = Math.max(0, estimatedCollisionT - backoffT);
      let currentPosition = start.lerp(target, currentT);
      
      // Gradient descent to find optimal position
      const descentSteps = 20;
      let stepScale = backoffT / 2;
      
      for (let i = 0; i < descentSteps; i++) {
          const collisionEntity = new CollisionEntity({
            position: currentPosition.toVector2(),
            width: movingEntity.width,
            height: movingEntity.height,
            elevation: currentPosition.z,
            disposition: movingEntity.disposition,
            verticalHeight: movingEntity.verticalHeight,
            collidable: movingEntity.collidable,
            providesCover: movingEntity.providesCover
          });

        const currentCollisions = this.collisionDetector.checkCollision(collisionEntity, [snapTarget, ...otherObstacles]);

        if (currentCollisions.isColliding) {
          // Still colliding, move back
          currentT = Math.max(0, currentT - stepScale);
        } else {
          // Not colliding, set as valid if we haven't found one yet
          if (bestValidT < 0) {
            bestValidT = currentT;
            bestValidPosition = currentPosition;
          }
          
          // Try to get closer
          const testT = currentT + stepScale / 2;
          const testPos = start.lerp(target, testT);
          const testCollisionEntity = new CollisionEntity({
            position: testPos.toVector2(),
            width: movingEntity.width,
            height: movingEntity.height,
            elevation: testPos.z,
            disposition: movingEntity.disposition,
            verticalHeight: movingEntity.verticalHeight,
            collidable: movingEntity.collidable,
            providesCover: movingEntity.providesCover
          });

          const testCollisions = this.collisionDetector.checkCollision(testCollisionEntity, [snapTarget, ...otherObstacles]);

          if (!testCollisions.isColliding) {
            currentT = testT;
            bestValidT = testT;
            bestValidPosition = testPos;
          } else {
            // Can't get closer, reduce step size
            stepScale *= 0.5;
          }
        }
        
        currentPosition = start.lerp(target, currentT);
        
        if (stepScale < 0.001) {
          break; // Converged
        }
      }
    }

    this.logger.debug('Search complete', {
      bestT: bestValidT,
      percentageOfPath: bestValidT >= 0 ? (bestValidT * 100).toFixed(2) + '%' : 'none',
      bestPosition: bestValidPosition,
      method: bestValidT > 0 ? 'linear-search' : bestValidT === 0 ? 'gradient-descent' : 'none'
    });

    // Return null if no valid position was found
    if (bestValidT < 0 || !bestValidPosition) {
      return null;
    }

    // Apply minimal buffer to ensure clean separation
    if (bestValidT > SNAP_CONFIG.TOUCH_PRECISION) {
      const bufferDistance = SNAP_CONFIG.SEPARATION_BUFFER; 
      const bufferT = bufferDistance / pathLength;
      
      const bufferedT = Math.max(0, bestValidT - bufferT);
      bestValidPosition = start.lerp(target, bufferedT);
      
      this.logger.debug('Applied buffer', {
        originalT: bestValidT,
        bufferedT,
        bufferDistance: bufferDistance,
        actualBackoff: pathLength * bufferT
      });
    }

    return bestValidPosition;
  }
}