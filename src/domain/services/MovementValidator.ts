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

import type { Collidable } from '../interfaces/Collidable.js';
import type { CollisionDetector } from '../collision/CollisionDetector.js';
import type { CollisionShape } from '../value-objects/CollisionShape.js';
import type { MovementValidationResult } from '../types/MovementValidationResult.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

import { Vector2 } from '../value-objects/Vector2.js';
import { Vector3 } from '../value-objects/Vector3.js';
import { CollisionShapeGuards } from '../value-objects/CollisionShape.js';
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
  blockers: Collidable[];
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
    moveable: Collidable,
    start: Vector3,
    end: Vector3,
    obstacles: Collidable[],
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

    // Validate movement path
    const pathResult = this.validatePath(
      start,
      end,
      moveable,
      obstacles,
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

    return {
      type: 'valid',
      position: end
    };
  }

  /**
   * Validates teleportation to a destination.
   * Only checks destination collision, not the path.
   */
  validateTeleport(
    moveable: Collidable,
    destination: Vector3,
    obstacles: Collidable[]
  ): MovementValidationResult {
    const blockers: Collidable[] = [];

    // Check collisions at destination
    for (const obstacle of obstacles) {
      if (this.collisionDetector.checkSingleCollision(moveable, obstacle)) {
        blockers.push(obstacle);
      }
    }

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
    moveable: Collidable,
    obstacles: Collidable[],
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
    
    const moveableShape = moveable.getCollisionShape();
    
    // Calculate the offset from position to centre
    const moveableEntity = moveable as any;
    const widthOffset = (moveableEntity.width || 0) / 2;
    const heightOffset = (moveableEntity.height || 0) / 2;
    
    const stepSize = this.calculateStepSize(distance, moveableShape);
    const steps = Math.max(1, Math.ceil(distance / stepSize));
    
    this.logger.debug('Path validation parameters', {
      distance,
      stepSize,
      steps,
      shapeType: moveableShape.type
    });
    
    let lastValidPosition = start;
    const blockers = new Set<Collidable>();
    let firstCollisionPoint: Vector3 | undefined;

    // Check each step along the path
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const position = start.lerp(end, t);
      
      // Convert top-left position to centre position for shape transformation
      const centrePosition = new Vector3(
        position.x + widthOffset,
        position.y + heightOffset,
        position.z
      );
      
      // Create test shape at interpolated centre position
      const testShape = this.transformShape(moveableShape, centrePosition);

      // Check against all obstacles
      for (const obstacle of obstacles) {
        if (this.checkCollisionAtPosition(testShape, obstacle, ignoreElevation)) {
          if (!firstCollisionPoint) {
            firstCollisionPoint = position;
            this.logger.debug('First collision detected', {
              atStep: i,
              stepPercentage: (t * 100).toFixed(2) + '%',
              collisionPosition: position,
              obstacleId: obstacle.id,
              obstacleName: (obstacle as any).name,
              obstaclePosition: obstacle.position
            });
          }
          blockers.add(obstacle);
        }
      }
      
      // Early exit on collision
      if (blockers.size > 0) {
        this.logger.debug('Path blocked, exiting early', {
          atStep: i,
          blockerCount: blockers.size,
          blockerIds: Array.from(blockers).map(b => ({
            id: b.id,
            name: (b as any).name
          }))
        });
        break;
      }
      
      lastValidPosition = position;
    }

    const result = {
      clear: blockers.size === 0,
      ...(firstCollisionPoint && { firstCollisionPoint }),
      lastValidPosition,
      blockers: Array.from(blockers)
    };
    
    this.logger.debug('Path validation complete', {
      clear: result.clear,
      blockerCount: result.blockers.length,
      lastValidPosition: result.lastValidPosition,
      firstCollisionPoint: result.firstCollisionPoint
    });

    return result;
  }

  /**
   * Checks collision between a shape and obstacle at a specific position.
   */
  private checkCollisionAtPosition(
    testShape: CollisionShape,
    obstacle: Collidable,
    ignoreElevation: boolean
  ): boolean {
    const obstacleShape = obstacle.getCollisionShape();

    // Skip elevation check if requested
    if (!ignoreElevation) {
      const testExtent = CollisionShapeGuards.getVerticalExtent(testShape);
      const obstacleExtent = CollisionShapeGuards.getVerticalExtent(obstacleShape);
      
      if (!testExtent.overlaps(obstacleExtent)) {
        return false;
      }
    }

    // Add distance check before collision detection for cylinder shapes
    if (testShape.type === 'cylinder' && obstacleShape.type === 'cylinder') {
      const testCentre = testShape.centre;
      const obstacleCentre = obstacleShape.centre;
      const distance2D = Math.sqrt(
        Math.pow(testCentre.x - obstacleCentre.x, 2) + 
        Math.pow(testCentre.y - obstacleCentre.y, 2)
      );
      const minSeparation = testShape.radius + obstacleShape.radius;
      
      if (distance2D > minSeparation * 1.1) { // 10% buffer
        // Shapes are clearly separated, no need for detailed collision check
        return false;
      }
    }

    const hasCollision = this.collisionDetector.checkShapeCollision(testShape, obstacleShape);
    
    // Log detailed collision info for debugging
    if (hasCollision) {
      // Extract shape details based on type
      const getShapeDetails = (shape: CollisionShape) => {
        const details: any = { type: shape.type };
        
        switch (shape.type) {
          case 'sphere':
          case 'cylinder':
          case 'box':
            details.centre = shape.centre;
            if ('radius' in shape) details.radius = shape.radius;
            if ('width' in shape) details.width = shape.width;
            if ('height' in shape) details.height = shape.height;
            if ('depth' in shape) details.depth = shape.depth;
            break;
          case 'capsule':
            details.start = shape.start;
            details.end = shape.end;
            details.radius = shape.radius;
            details.centre = shape.start.add(shape.end).divide(2); // Calculate centre
            break;
          case 'extrudedPolygon':
            const centre2D = shape.polygon.getCentre();
            details.centre = new Vector3(centre2D.x, centre2D.y, shape.verticalExtent.centre);
            details.vertices = shape.polygon.vertices.length;
            break;
          case 'mesh':
          case 'convexHull':
            details.vertices = shape.vertices.length;
            details.centre = this.getVertexCentre(shape.vertices);
            break;
        }
        
        return details;
      };

      const testDetails = getShapeDetails(testShape);
      const obstacleDetails = getShapeDetails(obstacleShape);
      
      this.logger.debug('Collision detected between shapes', {
        testShape: testDetails,
        obstacleShape: obstacleDetails,
        obstacleId: obstacle.id,
        obstacleName: (obstacle as any).name,
        distance2D: testDetails.centre && obstacleDetails.centre
          ? Math.sqrt(
              Math.pow(testDetails.centre.x - obstacleDetails.centre.x, 2) + 
              Math.pow(testDetails.centre.y - obstacleDetails.centre.y, 2)
            )
          : 'N/A',
        minSeparation: testShape.type === 'cylinder' && obstacleShape.type === 'cylinder'
          ? testShape.radius + obstacleShape.radius
          : 'N/A'
      });
    }

    return hasCollision;
  }

  // Step Size Calculation

  /**
   * Calculates optimal step size for path validation.
   * Balances accuracy with performance based on movement distance.
   */
  private calculateStepSize(distance: number, shape: CollisionShape): number {
    const shapeSize = this.getShapeSmallestDimension(shape);

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
  private getShapeSmallestDimension(shape: CollisionShape): number {
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

  // Shape Transformation

  /**
   * Transforms a collision shape to a new position.
   * Efficiently creates a new shape at the target position.
   */
  private transformShape(
    originalShape: CollisionShape, 
    newPosition: Vector3
  ): CollisionShape {
    // Log transformation for debugging
    if (originalShape.type === 'cylinder') {
      this.logger.debug('Transforming shape', {
        originalCentre: originalShape.centre,
        newPosition,
        shapeType: originalShape.type
      });
    }

    switch (originalShape.type) {
      case 'sphere':
      case 'cylinder':
      case 'box':
        return { ...originalShape, centre: newPosition };

      case 'capsule': {
        const offset = newPosition.subtract(this.getCapsuleCentre(originalShape));
        return {
          ...originalShape,
          start: originalShape.start.add(offset),
          end: originalShape.end.add(offset)
        };
      }

      case 'mesh':
      case 'convexHull': {
        const centre = this.getVertexCentre(originalShape.vertices);
        const offset = newPosition.subtract(centre);
        return {
          ...originalShape,
          vertices: originalShape.vertices.map(v => v.add(offset))
        };
      }

      case 'extrudedPolygon': {
        const centre2D = originalShape.polygon.getCentre();
        const centre3D = new Vector3(
          centre2D.x, 
          centre2D.y, 
          originalShape.verticalExtent.centre
        );
        const offset = newPosition.subtract(centre3D);
        
        const translatedPolygon = originalShape.polygon.translate(
          new Vector2(offset.x, offset.y)
        );
        
        return {
          ...originalShape,
          polygon: translatedPolygon,
          verticalExtent: originalShape.verticalExtent.translate(offset.z)
        };
      }

      default:
        originalShape satisfies never;
        throw new Error(`Unhandled shape type`);
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

  /**
   * Calculates centre point of a capsule.
   */
  private getCapsuleCentre(capsule: Extract<CollisionShape, { type: 'capsule' }>): Vector3 {
    return capsule.start.add(capsule.end).divide(2);
  }

  /**
   * Calculates centre point of vertices.
   */
  private getVertexCentre(vertices: readonly Vector3[]): Vector3 {
    if (vertices.length === 0) {
      return Vector3.zero();
    }
    
    const sum = vertices.reduce((acc, v) => acc.add(v), Vector3.zero());
    return sum.divide(vertices.length);
  }
}