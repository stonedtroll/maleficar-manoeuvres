import { Vector2 } from './Vector2';
import { Vector3 } from './Vector3';
import { VerticalExtent } from './VerticalExtent';
import { Polygon2D } from './Polygon2D';

/**
 * Represents a collision shape for overlay rendering and collision detection
 */
export type CollisionShape = 
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
  is3D(shape: CollisionShape): boolean {
    return shape.type !== 'extrudedPolygon';
  },

  isCircular(shape: CollisionShape): shape is Extract<CollisionShape, { radius: number }> {
    return shape.type === 'sphere' || shape.type === 'cylinder' || shape.type === 'capsule';
  },

  /**
   * Get the vertical extent for any shape
   */
  getVerticalExtent(shape: CollisionShape): VerticalExtent {
    switch (shape.type) {
      case 'sphere':
        return VerticalExtent.fromCentreAndHeight(shape.centre.z, shape.radius * 2);
      
      case 'cylinder':
        if (shape.axis === 'z' || !shape.axis) {
          return VerticalExtent.fromCentreAndHeight(shape.centre.z, shape.height);
        }
        // Handle other axes if needed
        return new VerticalExtent(shape.centre.z - shape.radius, shape.centre.z + shape.radius);
      
      case 'box':
        return VerticalExtent.fromCentreAndHeight(shape.centre.z, shape.depth);
      
      case 'capsule': {
        const minZ = Math.min(shape.start.z, shape.end.z) - shape.radius;
        const maxZ = Math.max(shape.start.z, shape.end.z) + shape.radius;
        return new VerticalExtent(minZ, maxZ);
      }
      
      case 'mesh':
      case 'convexHull': {
        const zValues = shape.vertices.map(v => v.z);
        return new VerticalExtent(Math.min(...zValues), Math.max(...zValues));
      }
      
      case 'extrudedPolygon':
        return shape.verticalExtent;
      
      default:
        return new VerticalExtent(0, 0);
    }
  }
};

/**
 * Factory functions for creating collision shapes
 */
export const CollisionShapeFactory = {
  // Token shapes (circles -> cylinders, rectangles -> boxes)
  tokenCylinder(position: Vector2, radius: number, elevation: number, height: number): CollisionShape {
    return {
      type: 'cylinder',
      centre: new Vector3(position.x, position.y, elevation + height / 2),
      radius,
      height,
      axis: 'z'
    };
  },

  tokenBox(position: Vector2, width: number, length: number, rotation: number, elevation: number, height: number): CollisionShape {
    return {
      type: 'box',
      centre: new Vector3(position.x, position.y, elevation + height / 2),
      width,
      height: length, // height in 2D becomes height in 3D box
      depth: height,   // vertical height becomes depth
      rotation: new Vector3(0, 0, rotation)
    };
  },

  // 3D shapes
  sphere(centre: Vector3, radius: number): CollisionShape {
    return { type: 'sphere', centre, radius };
  },

  cylinder(centre: Vector3, radius: number, height: number, axis: 'x' | 'y' | 'z' = 'z'): CollisionShape {
    return { type: 'cylinder', centre, radius, height, axis };
  },

  box(centre: Vector3, width: number, height: number, depth: number, rotation?: Vector3): CollisionShape {
    const box: Extract<CollisionShape, { type: 'box' }> = {
      type: 'box',
      centre,
      width,
      height,
      depth
    };
    
    if (rotation !== undefined) {
      return { ...box, rotation };
    }
    
    return box;
  },

  capsule(start: Vector3, end: Vector3, radius: number): CollisionShape {
    return { type: 'capsule', start, end, radius };
  },

  mesh(vertices: Vector3[], triangles: Array<[number, number, number]>): CollisionShape {
    return { type: 'mesh', vertices, triangles };
  },

  convexHull(vertices: Vector3[]): CollisionShape {
    return { type: 'convexHull', vertices };
  },

  // Special case for complex 2D shapes
  extrudedPolygon(vertices: Vector2[], elevation: number, height: number): CollisionShape {
    return {
      type: 'extrudedPolygon',
      polygon: Polygon2D.fromVertices(vertices),
      verticalExtent: VerticalExtent.fromHeightAtElevation(elevation, height)
    };
  }
};
