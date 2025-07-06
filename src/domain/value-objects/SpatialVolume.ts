import { Vector3 } from './Vector3';
import { VerticalExtent } from './VerticalExtent';
import { Polygon2D } from './Polygon2D';

/**
 * Represents a collision shape for overlay rendering and collision detection
 */
export type SpatialVolume = 
  // 3D primitives
  | {
      type: 'sphere';
      centre: Vector3;
      radius: number;
    }
  | {
      type: 'cylinder';
      centre: Vector3;
      radius: number;
      height: number;
      axis?: 'x' | 'y' | 'z'; // defaults to 'z' (vertical)
    }
  | {
      type: 'box';
      centre: Vector3;
      width: number;
      height: number;
      depth: number;
      rotation?: Vector3; // Euler angles in radians
    }
  | {
      type: 'capsule';
      start: Vector3;
      end: Vector3;
      radius: number;
    }
  | {
      type: 'mesh';
      vertices: Array<Vector3>;
      triangles: Array<[number, number, number]>; // indices into vertices array
    }
  | {
      type: 'convexHull';
      vertices: Array<Vector3>;
    }
  // Complex 2D shapes that can't be simplified to 3D primitives
  | {
      type: 'extrudedPolygon';
      polygon: Polygon2D;  // Use Polygon2D instead of raw vertices
      verticalExtent: VerticalExtent;
    };

/**
 * Helper type guards for collision shapes
 */
export const CollisionShapeGuards = {
  is3D(shape: SpatialVolume): boolean {
    return shape.type !== 'extrudedPolygon';
  },

  isCircular(shape: SpatialVolume): shape is Extract<SpatialVolume, { radius: number }> {
    return shape.type === 'sphere' || shape.type === 'cylinder' || shape.type === 'capsule';
  },
};

