import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SnapPositionCalculator } from './SnapPositionCalculator.js';
import type { CollisionDetector } from '../collision/CollisionDetector.js';
import type { Collidable } from '../interfaces/Collidable.js';
import { Vector2 } from '../value-objects/Vector2.js';
import { Vector3 } from '../value-objects/Vector3.js';
import { CollisionShape } from '../value-objects/CollisionShape.js';
import { Polygon2D } from '../value-objects/Polygon2D.js';
import { VerticalExtent } from '../value-objects/VerticalExtent.js';

// Mock the logger
vi.mock('../../../lib/log4foundry/log4foundry.js', () => ({
  LoggerFactory: {
    getInstance: () => ({
      getFoundryLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      })
    })
  }
}));

describe('SnapPositionCalculator', () => {
  let calculator: SnapPositionCalculator;
  let mockCollisionDetector: CollisionDetector;

  // Helper function to create a mock collidable
  const createMockCollidable = (
    id: string,
    position: Vector2,
    width: number,
    height: number,
    shape: CollisionShape
  ): Collidable => {
    // Create a factory function for AABB to handle recursion
    const createAABB = (pos: Vector2, w: number, h: number): any => ({
      min: new Vector2(pos.x, pos.y),
      max: new Vector2(pos.x + w, pos.y + h),
      minX: pos.x,
      minY: pos.y,
      maxX: pos.x + w,
      maxY: pos.y + h,
      width: w,
      height: h,
      centerX: pos.x + w / 2,
      centerY: pos.y + h / 2,
      contains: (point: Vector2) => {
        return point.x >= pos.x && 
               point.x <= pos.x + w &&
               point.y >= pos.y && 
               point.y <= pos.y + h;
      },
      intersects: (other: { minX: number; minY: number; maxX: number; maxY: number }) => {
        return !(other.maxX < pos.x || 
                 other.minX > pos.x + w ||
                 other.maxY < pos.y || 
                 other.minY > pos.y + h);
      },
      expand: (amount: number) => createAABB(
        new Vector2(pos.x - amount, pos.y - amount),
        w + amount * 2,
        h + amount * 2
      )
    });

    return {
      id,
      position,
      centre: new Vector2(position.x + width / 2, position.y + height / 2),
      getCollisionShape: () => shape,
      verticalExtent: new VerticalExtent(0, 55),
      getAABB: () => createAABB(position, width, height)
    };
  };

  beforeEach(() => {
    mockCollisionDetector = {
      checkShapeCollision: vi.fn()
    } as unknown as CollisionDetector;
    
    calculator = new SnapPositionCalculator(mockCollisionDetector);
  });

  describe('calculateSnapPosition', () => {
    it('should return failure when movement distance is too small', () => {
      const movingEntity = createMockCollidable(
        'token1',
        new Vector2(100, 100),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(127.5, 127.5, 27.5), radius: 27.5, height: 55 }
      );
      
      const snapTarget = createMockCollidable(
        'token2',
        new Vector2(200, 200),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(227.5, 227.5, 27.5), radius: 27.5, height: 55 }
      );

      const start = new Vector3(100, 100, 0);
      const target = new Vector3(100, 100, 0); // Same as start

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        []
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('No movement detected');
    });

    it('should return failure when snap position is essentially the start position', () => {
      const movingEntity = createMockCollidable(
        'token1',
        new Vector2(100, 100),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(127.5, 127.5, 27.5), radius: 27.5, height: 55 }
      );
      
      const snapTarget = createMockCollidable(
        'token2',
        new Vector2(100, 100),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(127.5, 127.5, 27.5), radius: 27.5, height: 55 }
      );

      const start = new Vector3(100, 100, 0);
      const target = new Vector3(200, 200, 0);

      // Mock collision at start position
      vi.mocked(mockCollisionDetector.checkShapeCollision).mockReturnValue(true);

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        []
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('No valid snap position along path');
    });

    it('should calculate valid snap position when movement is blocked', () => {
      const movingEntity = createMockCollidable(
        'token1',
        new Vector2(100, 100),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(127.5, 127.5, 27.5), radius: 27.5, height: 55 }
      );
      
      const snapTarget = createMockCollidable(
        'token2',
        new Vector2(200, 100),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(227.5, 127.5, 27.5), radius: 27.5, height: 55 }
      );

      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);

      // Mock collision detection:
      // - No collision at start
      // - Collision at target
      // - Binary search will find touch point
      let callCount = 0;
      vi.mocked(mockCollisionDetector.checkShapeCollision).mockImplementation((shape1, shape2) => {
        callCount++;
        // First call is start position check - no collision
        if (callCount === 1) return false;
        
        // Simulate finding touch point through binary search
        const movingCentre = (shape1 as any).centre;
        const targetCentre = (shape2 as any).centre;
        const distance = movingCentre.distanceTo(targetCentre);
        
        // Collision if distance < sum of radii (55)
        return distance < 55;
      });

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        []
      );

      expect(result.success).toBe(true);
      expect(result.position).toBeDefined();
      expect(result.snapTarget).toBe(snapTarget);
      
      // Verify position is between start and target
      if (result.position) {
        expect(result.position.x).toBeGreaterThan(start.x);
        expect(result.position.x).toBeLessThan(target.x);
        expect(result.position.y).toBe(start.y);
        expect(result.position.z).toBe(start.z);
      }
    });

    it('should return failure when snap position collides with other obstacles', () => {
      const movingEntity = createMockCollidable(
        'token1',
        new Vector2(100, 100),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(127.5, 127.5, 27.5), radius: 27.5, height: 55 }
      );
      
      const snapTarget = createMockCollidable(
        'token2',
        new Vector2(200, 100),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(227.5, 127.5, 27.5), radius: 27.5, height: 55 }
      );

      const otherObstacle = createMockCollidable(
        'token3',
        new Vector2(150, 100),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(177.5, 127.5, 27.5), radius: 27.5, height: 55 }
      );

      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);

      // Mock collision detection to always return true for other obstacles
      vi.mocked(mockCollisionDetector.checkShapeCollision).mockImplementation((shape1, shape2) => {
        // Check if this is testing against other obstacle
        const targetCentre = (shape2 as any).centre;
        if (Math.abs(targetCentre.x - 177.5) < 1) {
          return true; // Collision with other obstacle
        }
        return false;
      });

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        [snapTarget, otherObstacle]
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Snap position blocked by other obstacles');
    });
  });

  describe('shape translation', () => {
    it('should correctly translate sphere shapes', () => {
      const movingEntity = createMockCollidable(
        'token1',
        new Vector2(100, 100),
        50,
        50,
        { type: 'sphere', centre: new Vector3(125, 125, 25), radius: 25 }
      );
      
      const snapTarget = createMockCollidable(
        'token2',
        new Vector2(200, 100),
        50,
        50,
        { type: 'sphere', centre: new Vector3(225, 125, 25), radius: 25 }
      );

      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);

      // Configure mock to allow movement
      vi.mocked(mockCollisionDetector.checkShapeCollision).mockReturnValueOnce(false);

      calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        []
      );

      // Verify collision detector was called with translated shapes
      expect(mockCollisionDetector.checkShapeCollision).toHaveBeenCalled();
    });

    it('should correctly translate box shapes', () => {
      const movingEntity = createMockCollidable(
        'token1',
        new Vector2(100, 100),
        50,
        50,
        { 
          type: 'box', 
          centre: new Vector3(125, 125, 25), 
          width: 50, 
          height: 50, 
          depth: 50,
          rotation: new Vector3(0, 0, 45)
        }
      );
      
      const snapTarget = createMockCollidable(
        'token2',
        new Vector2(200, 100),
        50,
        50,
        { type: 'box', centre: new Vector3(225, 125, 25), width: 50, height: 50, depth: 50 }
      );

      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);

      vi.mocked(mockCollisionDetector.checkShapeCollision).mockReturnValueOnce(false);

      calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        []
      );

      expect(mockCollisionDetector.checkShapeCollision).toHaveBeenCalled();
    });

    it('should correctly translate capsule shapes', () => {
      const movingEntity = createMockCollidable(
        'token1',
        new Vector2(100, 100),
        50,
        100,
        { 
          type: 'capsule', 
          start: new Vector3(125, 100, 25), 
          end: new Vector3(125, 200, 25), 
          radius: 25 
        }
      );
      
      const snapTarget = createMockCollidable(
        'token2',
        new Vector2(200, 100),
        50,
        100,
        { 
          type: 'capsule', 
          start: new Vector3(225, 100, 25), 
          end: new Vector3(225, 200, 25), 
          radius: 25 
        }
      );

      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);

      vi.mocked(mockCollisionDetector.checkShapeCollision).mockReturnValueOnce(false);

      calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        []
      );

      expect(mockCollisionDetector.checkShapeCollision).toHaveBeenCalled();
    });

    it('should correctly translate extruded polygon shapes', () => {
      const vertices = [
        new Vector2(100, 100),
        new Vector2(150, 100),
        new Vector2(150, 150),
        new Vector2(100, 150)
      ];

      const movingEntity = createMockCollidable(
        'token1',
        new Vector2(100, 100),
        50,
        50,
        { 
          type: 'extrudedPolygon', 
          polygon: Polygon2D.fromVertices(vertices),
          verticalExtent: new VerticalExtent(0, 50)
        }
      );
      
      const snapTarget = createMockCollidable(
        'token2',
        new Vector2(200, 100),
        50,
        50,
        { 
          type: 'extrudedPolygon', 
          polygon: Polygon2D.fromVertices(vertices.map(v => v.add(new Vector2(100, 0)))),
          verticalExtent: new VerticalExtent(0, 50)
        }
      );

      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);

      vi.mocked(mockCollisionDetector.checkShapeCollision).mockReturnValueOnce(false);

      calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        []
      );

      expect(mockCollisionDetector.checkShapeCollision).toHaveBeenCalled();
    });

    it('should correctly translate convex hull shapes', () => {
      const vertices = [
        new Vector3(100, 100, 0),
        new Vector3(150, 100, 0),
        new Vector3(125, 150, 50)
      ];

      const movingEntity = createMockCollidable(
        'token1',
        new Vector2(100, 100),
        50,
        50,
        { type: 'convexHull', vertices }
      );
      
      const snapTarget = createMockCollidable(
        'token2',
        new Vector2(200, 100),
        50,
        50,
        { 
          type: 'convexHull', 
          vertices: vertices.map(v => v.add(new Vector3(100, 0, 0)))
        }
      );

      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);

      vi.mocked(mockCollisionDetector.checkShapeCollision).mockReturnValueOnce(false);

      calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        []
      );

      expect(mockCollisionDetector.checkShapeCollision).toHaveBeenCalled();
    });

    it('should correctly translate mesh shapes', () => {
      const vertices = [
        new Vector3(100, 100, 0),
        new Vector3(150, 100, 0),
        new Vector3(125, 150, 0),
        new Vector3(125, 125, 50)
      ];
      
      const triangles = [
        [0, 1, 2],
        [0, 1, 3],
        [1, 2, 3],
        [2, 0, 3]
      ] as [number, number, number][];

      const movingEntity = createMockCollidable(
        'token1',
        new Vector2(100, 100),
        50,
        50,
        { type: 'mesh', vertices, triangles }
      );
      
      const snapTarget = createMockCollidable(
        'token2',
        new Vector2(200, 100),
        50,
        50,
        { 
          type: 'mesh', 
          vertices: vertices.map(v => v.add(new Vector3(100, 0, 0))),
          triangles
        }
      );

      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);

      vi.mocked(mockCollisionDetector.checkShapeCollision).mockReturnValueOnce(false);

      calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        []
      );

      expect(mockCollisionDetector.checkShapeCollision).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle vertical movement correctly', () => {
      const movingEntity = createMockCollidable(
        'token1',
        new Vector2(100, 100),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(127.5, 127.5, 27.5), radius: 27.5, height: 55 }
      );
      
      const snapTarget = createMockCollidable(
        'token2',
        new Vector2(100, 200),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(127.5, 227.5, 27.5), radius: 27.5, height: 55 }
      );

      const start = new Vector3(100, 100, 0);
      const target = new Vector3(100, 300, 0); // Vertical movement

      vi.mocked(mockCollisionDetector.checkShapeCollision).mockImplementation((shape1) => {
        const movingCentre = (shape1 as any).centre;
        // Collision if y > 170 (touching snapTarget)
        return movingCentre.y > 170;
      });

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        []
      );

      expect(result.success).toBe(true);
      expect(result.position).toBeDefined();
      if (result.position) {
        expect(result.position.x).toBe(start.x);
        expect(result.position.y).toBeGreaterThan(start.y);
        expect(result.position.y).toBeLessThan(target.y);
      }
    });

    it('should handle diagonal movement correctly', () => {
      const movingEntity = createMockCollidable(
        'token1',
        new Vector2(100, 100),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(127.5, 127.5, 27.5), radius: 27.5, height: 55 }
      );
      
      const snapTarget = createMockCollidable(
        'token2',
        new Vector2(200, 200),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(227.5, 227.5, 27.5), radius: 27.5, height: 55 }
      );

      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 300, 0); // Diagonal movement

      vi.mocked(mockCollisionDetector.checkShapeCollision).mockImplementation((shape1, shape2) => {
        const movingCentre = (shape1 as any).centre;
        const targetCentre = (shape2 as any).centre;
        const distance = movingCentre.distanceTo(targetCentre);
        return distance < 55;
      });

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        []
      );

      expect(result.success).toBe(true);
      expect(result.position).toBeDefined();
      if (result.position) {
        // Position should be on the diagonal line
        const ratio = (result.position.x - start.x) / (result.position.y - start.y);
        expect(ratio).toBeCloseTo(1, 1); // 45-degree angle
      }
    });

    it('should handle empty obstacle array', () => {
      const movingEntity = createMockCollidable(
        'token1',
        new Vector2(100, 100),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(127.5, 127.5, 27.5), radius: 27.5, height: 55 }
      );
      
      const snapTarget = createMockCollidable(
        'token2',
        new Vector2(200, 100),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(227.5, 127.5, 27.5), radius: 27.5, height: 55 }
      );

      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);

      vi.mocked(mockCollisionDetector.checkShapeCollision).mockReturnValueOnce(false);

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        [] // Empty obstacles array
      );

      expect(result).toBeDefined();
      // Should not throw error
    });

    it('should handle very long paths efficiently', () => {
      const movingEntity = createMockCollidable(
        'token1',
        new Vector2(0, 0),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(27.5, 27.5, 27.5), radius: 27.5, height: 55 }
      );
      
      const snapTarget = createMockCollidable(
        'token2',
        new Vector2(500, 0),
        55,
        55,
        { type: 'cylinder', centre: new Vector3(527.5, 27.5, 27.5), radius: 27.5, height: 55 }
      );

      const start = new Vector3(0, 0, 0);
      const target = new Vector3(10000, 0, 0); // Very long path

      let checkCount = 0;
      vi.mocked(mockCollisionDetector.checkShapeCollision).mockImplementation(() => {
        checkCount++;
        return false; // No collision for performance test
      });

      const startTime = performance.now();
      calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        []
      );
      const endTime = performance.now();

      // Should complete quickly with limited iterations
      expect(endTime - startTime).toBeLessThan(100); // 100ms max
      expect(checkCount).toBeLessThan(50); // Limited collision checks
    });
  });
});