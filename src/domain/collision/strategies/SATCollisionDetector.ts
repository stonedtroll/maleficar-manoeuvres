/**
 * Implements the Separating Axis Theorem (SAT) for precise collision detectione. This detector is optimised for the most
 * common collision scenarios in Foundry VTT: token-to-token (cylinder) and token-to-wall
 * (cylinder to extruded polygon) collisions.
 * 
 * Performance optimisations:
 * - Early elevation checks to avoid unnecessary 2D calculations
 * - Specialised algorithms for common shape combinations
 * - Squared distance calculations to avoid expensive square root operations
 * - Efficient 2D projections for polygon collisions
 */
import type { CollisionDetector } from '../CollisionDetector.js';
import type { SpatialEntity } from '../../interfaces/SpatialEntity.js';
import type { SpatialVolume } from '../../value-objects/SpatialVolume.js';
import type { CollisionResult } from '../../types/CollisionResult.js';
import type { FoundryLogger } from '../../../../lib/log4foundry/log4foundry.js';

import { Vector2 } from '../../value-objects/Vector2.js';
import { Vector3 } from '../../value-objects/Vector3.js';
import { Polygon2D } from '../../value-objects/Polygon2D.js';
import { LoggerFactory } from '../../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../../config.js';

export class SATCollisionDetector implements CollisionDetector {
  private readonly logger: FoundryLogger;

  constructor() {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.SATCollisionDetector`);
  }

  /**
   * Checks if a moving entity collides with any obstacles.
   */
  checkCollision(
    movingEntity: SpatialEntity,
    obstacles: SpatialEntity[]
  ): CollisionResult {

    if (!movingEntity.isBlockingObstacle) {
      return { isColliding: false, collidingWith: [] };
    }

    const collidingObstacles: SpatialEntity[] = [];

    for (const obstacle of obstacles) {
      if (this.checkSingleCollision(movingEntity, obstacle)) {
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
   */
  checkSingleCollision(
    entityA: SpatialEntity,
    entityB: SpatialEntity
  ): boolean {

    if (!entityA.isBlockingObstacle || !entityB.isBlockingObstacle) {
      return false;
    }

    const extentA = entityA.verticalExtent;
    const extentB = entityB.verticalExtent;

    if (!extentA.overlaps(extentB)) {
      return false;
    }

    return this.checkSpatialCollision(
      entityA.getSpatialVolume(),
      entityB.getSpatialVolume()
    );
  }

  /**
   * Optimised collision check routing to specialised algorithms.
   */
  private checkSpatialCollision(
    shapeA: SpatialVolume,
    shapeB: SpatialVolume
  ): boolean {
    // Most common case 1: Token vs Token (cylinder vs cylinder)
    if (shapeA.type === 'cylinder' && shapeB.type === 'cylinder') {
      return this.cylinderVsCylinder(shapeA, shapeB);
    }

    // Most common case 2: Token vs Wall (cylinder vs extruded polygon)
    if (shapeA.type === 'cylinder' && shapeB.type === 'extrudedPolygon') {
      return this.cylinderVsExtrudedPolygon(shapeA, shapeB);
    }
    if (shapeA.type === 'extrudedPolygon' && shapeB.type === 'cylinder') {
      return this.cylinderVsExtrudedPolygon(shapeB, shapeA);
    }

    if (shapeA.type === 'extrudedPolygon' && shapeB.type === 'extrudedPolygon') {
      return this.extrudedPolygonVsExtrudedPolygon(shapeA, shapeB);
    }

    // Fallback for other shape combinations
    return this.generalCollisionCheck(shapeA, shapeB);
  }

  /**
   * Optimised cylinder vs cylinder collision for vertical cylinders (tokens).
   * Uses simple 2D circle collision when both cylinders are vertical.
   */
  private cylinderVsCylinder(
    cylinderA: Extract<SpatialVolume, { type: 'cylinder' }>,
    cylinderB: Extract<SpatialVolume, { type: 'cylinder' }>
  ): boolean {
    // Optimisation: Most tokens in Foundry are vertical cylinders
    if (this.isVerticalCylinder(cylinderA) && this.isVerticalCylinder(cylinderB)) {
      // Simple 2D circle collision
      const dx = cylinderA.centre.x - cylinderB.centre.x;
      const dy = cylinderA.centre.y - cylinderB.centre.y;
      const distanceSquared = dx * dx + dy * dy;
      const radiusSum = cylinderA.radius + cylinderB.radius;

      return distanceSquared <= radiusSum * radiusSum;
    }

    // Fallback for non-vertical cylinders
    return this.generalCylinderCollision(cylinderA, cylinderB);
  }

  /**
   * Optimised cylinder vs extruded polygon collision.
   * Common case for token vs wall collisions.
   */
  private cylinderVsExtrudedPolygon(
    cylinder: Extract<SpatialVolume, { type: 'cylinder' }>,
    polygon: Extract<SpatialVolume, { type: 'extrudedPolygon' }>
  ): boolean {
    // For vertical cylinders, check 2D circle vs polygon
    if (this.isVerticalCylinder(cylinder)) {
      const centre2D = new Vector2(cylinder.centre.x, cylinder.centre.y);
      return this.circleVsPolygon2D(centre2D, cylinder.radius, polygon.polygon);
    }

    // Fallback: Use bounding sphere approximation
    return this.generalCollisionCheck(cylinder, polygon);
  }

  /**
   * Optimised extruded polygon vs extruded polygon collision.
   * Uses 2D SAT algorithm since elevation was already checked.
   */
  private extrudedPolygonVsExtrudedPolygon(
    polygonA: Extract<SpatialVolume, { type: 'extrudedPolygon' }>,
    polygonB: Extract<SpatialVolume, { type: 'extrudedPolygon' }>
  ): boolean {
    return this.polygon2DSAT(polygonA.polygon, polygonB.polygon);
  }

  /**
   * Efficient 2D circle vs polygon collision detection.
   */
  private circleVsPolygon2D(
    centre: Vector2,
    radius: number,
    polygon: Polygon2D
  ): boolean {
    // Check if centre is inside polygon
    if (polygon.contains(centre)) {
      return true;
    }

    // Check distance to polygon edges
    for (const edge of polygon.edges) {
      const closest = this.closestPointOnLineSegment(centre, edge.start, edge.end);
      const distanceSquared = centre.distanceSquaredTo(closest);

      if (distanceSquared <= radius * radius) {
        return true;
      }
    }

    return false;
  }

  /**
   * Efficient 2D polygon vs polygon SAT collision detection.
   */
  private polygon2DSAT(
    polygonA: Polygon2D,
    polygonB: Polygon2D
  ): boolean {
    // Get separating axes from both polygons
    const axesA = this.getPolygonAxes(polygonA.vertices);
    const axesB = this.getPolygonAxes(polygonB.vertices);
    const axes = [...axesA, ...axesB];

    // Test separation on each axis
    for (const axis of axes) {
      const projA = this.projectPolygon(polygonA.vertices, axis);
      const projB = this.projectPolygon(polygonB.vertices, axis);

      if (!this.projectionsOverlap(projA, projB)) {
        return false; // Separated on this axis
      }
    }

    return true; // No separating axis found
  }

  /**
   * General collision check using bounding sphere approximation.
   * Fallback for less common or complex shape combinations.
   */
  private generalCollisionCheck(
    shapeA: SpatialVolume,
    shapeB: SpatialVolume
  ): boolean {
    const sphereA = this.getBoundingSphere(shapeA);
    const sphereB = this.getBoundingSphere(shapeB);

    const distance = sphereA.centre.distanceTo(sphereB.centre);
    return distance <= sphereA.radius + sphereB.radius;
  }

  /**
   * Complex cylinder-cylinder collision for arbitrary orientations.
   * Currently uses bounding sphere approximation.
   */
  private generalCylinderCollision(
    cylinderA: Extract<SpatialVolume, { type: 'cylinder' }>,
    cylinderB: Extract<SpatialVolume, { type: 'cylinder' }>
  ): boolean {
    // TODO: Implement precise arbitrary cylinder collision if needed
    const sphereA = this.getBoundingSphere(cylinderA);
    const sphereB = this.getBoundingSphere(cylinderB);

    const distance = sphereA.centre.distanceTo(sphereB.centre);
    return distance <= sphereA.radius + sphereB.radius;
  }

  // Helper Methods

  /**
   * Checks if a cylinder is vertical (aligned with z-axis).
   */
  private isVerticalCylinder(cylinder: Extract<SpatialVolume, { type: 'cylinder' }>): boolean {
    return cylinder.axis === 'z' || !cylinder.axis;
  }

  /**
   * Gets perpendicular axes for polygon edges.
   */
  private getPolygonAxes(vertices: readonly Vector2[]): Vector2[] {
    const axes: Vector2[] = [];

    for (let i = 0; i < vertices.length; i++) {
      const start = vertices[i];
      const end = vertices[(i + 1) % vertices.length];

      if (!start || !end) continue;

      const edge = end.subtract(start);
      const normal = edge.perpendicular().normalised();
      axes.push(normal);
    }

    return axes;
  }

  /**
   * Projects polygon vertices onto an axis.
   */
  private projectPolygon(vertices: readonly Vector2[], axis: Vector2): [number, number] {
    let min = Infinity;
    let max = -Infinity;

    for (const vertex of vertices) {
      const projection = vertex.dot(axis);
      min = Math.min(min, projection);
      max = Math.max(max, projection);
    }

    return [min, max]; // Tuple is faster than object
  }

  /**
   * Checks if two projections overlap.
   */
  private projectionsOverlap(projA: [number, number], projB: [number, number]): boolean {
    return projA[0] <= projB[1] && projA[1] >= projB[0];
  }

  /**
   * Finds closest point on a line segment to a given point.
   */
  private closestPointOnLineSegment(
    point: Vector2,
    lineStart: Vector2,
    lineEnd: Vector2
  ): Vector2 {
    const line = lineEnd.subtract(lineStart);
    const lineLengthSquared = line.magnitudeSquared();

    if (lineLengthSquared === 0) {
      return lineStart;
    }

    const pointVector = point.subtract(lineStart);
    const t = Math.max(0, Math.min(1, pointVector.dot(line) / lineLengthSquared));

    return lineStart.add(line.multiply(t));
  }

  /**
   * Calculates bounding sphere for any collision shape.
   * Used as fallback for complex collision scenarios.
   */
  private getBoundingSphere(shape: SpatialVolume): { centre: Vector3; radius: number } {
    switch (shape.type) {
      case 'sphere':
        return { centre: shape.centre, radius: shape.radius };

      case 'cylinder': {
        // Bounding sphere for cylinder
        const radiusSquared = shape.radius * shape.radius;
        const heightSquared = (shape.height * shape.height) / 4;
        return {
          centre: shape.centre,
          radius: Math.sqrt(radiusSquared + heightSquared)
        };
      }

      case 'box': {
        // Bounding sphere for box
        const diagonalSquared =
          shape.width * shape.width +
          shape.height * shape.height +
          shape.depth * shape.depth;
        return {
          centre: shape.centre,
          radius: Math.sqrt(diagonalSquared) / 2
        };
      }

      case 'capsule': {
        // Bounding sphere for capsule
        const midpoint = shape.start.add(shape.end).divide(2);
        const halfLength = shape.start.distanceTo(shape.end) / 2;
        return {
          centre: midpoint,
          radius: halfLength + shape.radius
        };
      }

      case 'extrudedPolygon': {
        // Bounding sphere for extruded polygon
        const centre2D = this.getPolygonCentre(shape.polygon);
        const maxRadius = this.getPolygonMaxRadius(shape.polygon, centre2D);

        const verticalCentre = shape.verticalExtent.centre;
        const halfHeight = shape.verticalExtent.height / 2;

        return {
          centre: new Vector3(centre2D.x, centre2D.y, verticalCentre),
          radius: Math.sqrt(maxRadius * maxRadius + halfHeight * halfHeight)
        };
      }

      case 'mesh':
      case 'convexHull': {
        // Bounding sphere for vertex-based shapes
        const centre = this.getVerticesCentre(shape.vertices);
        const maxRadius = this.getVerticesMaxRadius(shape.vertices, centre);

        return { centre, radius: maxRadius };
      }

      default:
        shape satisfies never;
        throw new Error(`Unhandled shape type`);
    }
  }

  /**
   * Calculates centroid of polygon vertices.
   */
  private getPolygonCentre(polygon: Polygon2D): Vector2 {
    let sumX = 0;
    let sumY = 0;

    for (const vertex of polygon.vertices) {
      sumX += vertex.x;
      sumY += vertex.y;
    }

    return new Vector2(
      sumX / polygon.vertices.length,
      sumY / polygon.vertices.length
    );
  }

  /**
   * Calculates maximum radius from centre to vertices.
   */
  private getPolygonMaxRadius(polygon: Polygon2D, centre: Vector2): number {
    let maxRadiusSquared = 0;

    for (const vertex of polygon.vertices) {
      const distSquared = centre.distanceSquaredTo(vertex);
      maxRadiusSquared = Math.max(maxRadiusSquared, distSquared);
    }

    return Math.sqrt(maxRadiusSquared);
  }

  /**
   * Calculates centroid of 3D vertices.
   */
  private getVerticesCentre(vertices: readonly Vector3[]): Vector3 {
    let centre = new Vector3(0, 0, 0);

    for (const vertex of vertices) {
      centre = centre.add(vertex);
    }

    return centre.divide(vertices.length);
  }

  /**
   * Calculates maximum radius from centre to vertices.
   */
  private getVerticesMaxRadius(vertices: readonly Vector3[], centre: Vector3): number {
    let maxRadiusSquared = 0;

    for (const vertex of vertices) {
      const distSquared = centre.distanceSquaredTo(vertex);
      maxRadiusSquared = Math.max(maxRadiusSquared, distSquared);
    }

    return Math.sqrt(maxRadiusSquared);
  }
}