import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SnapPositionCalculator } from './SnapPositionCalculator.js';
import type { CollisionDetector } from '../collision/CollisionDetector.js';
import type { SpatialEntity } from '../interfaces/SpatialEntity.js';
import { Vector2 } from '../value-objects/Vector2.js';
import { Vector3 } from '../value-objects/Vector3.js';
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

  // Helper function to create a mock spatial entity
  const createMockEntity = (
    id: string,
    position: Vector2,
    width: number = 55,
    height: number = 55,
    elevation: number = 0,
    radius: number = 27.5
  ): SpatialEntity & { move?: (pos: Vector3) => void; radius?: number; centre?: Vector2 } => {
    let currentPosition = position;
    let currentElevation = elevation;

    const entity = {
      id,
      position: currentPosition,
      elevation: currentElevation,
      verticalExtent: new VerticalExtent(currentElevation, currentElevation + 1),
      radius,
      centre: new Vector2(
        currentPosition.x + width / 2,
        currentPosition.y + height / 2
      ),
      // Required SpatialEntity properties
      spatialCentre: new Vector3(
        currentPosition.x + width / 2,
        currentPosition.y + height / 2,
        currentElevation + height / 2
      ),
      getSpatialVolume: () => ({
        type: 'cylinder' as const,
        centre: new Vector3(
          currentPosition.x + width / 2,
          currentPosition.y + height / 2,
          currentElevation + height / 2
        ),
        radius,
        height
      }),
      canPassThrough: () => false,
      move: vi.fn((pos: Vector3) => {
        currentPosition = new Vector2(pos.x, pos.y);
        currentElevation = pos.z;
        entity.position = currentPosition;
        entity.elevation = currentElevation;
        entity.centre = new Vector2(
          currentPosition.x + width / 2,
          currentPosition.y + height / 2
        );
        entity.spatialCentre = new Vector3(
          currentPosition.x + width / 2,
          currentPosition.y + height / 2,
          currentElevation + height / 2
        );
      }),
      getAABB: () => {
        const aabb = {
          min: new Vector2(currentPosition.x, currentPosition.y),
          max: new Vector2(currentPosition.x + width, currentPosition.y + height),
          minX: currentPosition.x,
          minY: currentPosition.y,
          maxX: currentPosition.x + width,
          maxY: currentPosition.y + height,
          width,
          height,
          centerX: currentPosition.x + width / 2,
          centerY: currentPosition.y + height / 2,
          intersects: (other: { minX: number; minY: number; maxX: number; maxY: number }) => {
            return !(
              other.maxX < currentPosition.x ||
              other.minX > currentPosition.x + width ||
              other.maxY < currentPosition.y ||
              other.minY > currentPosition.y + height
            );
          },
          contains: (point: Vector2) => {
            return (
              point.x >= currentPosition.x &&
              point.x <= currentPosition.x + width &&
              point.y >= currentPosition.y &&
              point.y <= currentPosition.y + height
            );
          },
          expand: (amount: number): any => {
            const expandedAABB: any = {
              min: new Vector2(currentPosition.x - amount, currentPosition.y - amount),
              max: new Vector2(currentPosition.x + width + amount, currentPosition.y + height + amount),
              minX: currentPosition.x - amount,
              minY: currentPosition.y - amount,
              maxX: currentPosition.x + width + amount,
              maxY: currentPosition.y + height + amount,
              width: width + amount * 2,
              height: height + amount * 2,
              centerX: currentPosition.x + width / 2,
              centerY: currentPosition.y + height / 2,
              intersects: (other: { minX: number; minY: number; maxX: number; maxY: number }) => {
                return !(
                  other.maxX < currentPosition.x - amount ||
                  other.minX > currentPosition.x + width + amount ||
                  other.maxY < currentPosition.y - amount ||
                  other.minY > currentPosition.y + height + amount
                );
              },
              contains: (point: Vector2) => {
                return (
                  point.x >= currentPosition.x - amount &&
                  point.x <= currentPosition.x + width + amount &&
                  point.y >= currentPosition.y - amount &&
                  point.y <= currentPosition.y + height + amount
                );
              }
            };
            expandedAABB.expand = (additionalAmount: number) => expandedAABB;
            return expandedAABB;
          }
        };
        return aabb;
      }
    };

    return entity;
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    mockCollisionDetector = {
      checkCollision: vi.fn().mockReturnValue({ isColliding: false, collidingWith: [] }),
      checkSingleCollision: vi.fn().mockReturnValue(false),
      checkShapeCollision: vi.fn().mockReturnValue({ isColliding: false, collidingWith: [] })
    } as unknown as CollisionDetector;
    
    calculator = new SnapPositionCalculator(mockCollisionDetector);
  });

  describe('calculateSnapPosition', () => {
    it('should find valid snap position when path is clear until collision', () => {
      const movingEntity = createMockEntity('token1', new Vector2(100, 100));
      const snapTarget = createMockEntity('token2', new Vector2(200, 100));
      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);
      const collisionPoint = new Vector3(172.5, 100, 0); // Where tokens would touch

      // Mock collision detection
      vi.mocked(mockCollisionDetector.checkCollision).mockImplementation((entity) => {
        const entityPos = (entity as any).position;
        // Collision occurs when entity centre is within 55 units of snap target centre
        const distance = Math.abs(entityPos.x + 27.5 - 227.5);
        return {
          isColliding: distance < 55,
          collidingWith: distance < 55 ? [snapTarget] : []
        };
      });

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        [],
        collisionPoint
      );

      expect(result.success).toBe(true);
      expect(result.position).toBeDefined();
      expect(result.snapTarget).toBe(snapTarget);
      
      // Position should be just before collision
      if (result.position) {
        expect(result.position.x).toBeLessThan(172.5);
        expect(result.position.x).toBeGreaterThan(100);
      }
    });

    it('should handle obstacles between start and snap target', () => {
      const movingEntity = createMockEntity('token1', new Vector2(100, 100));
      const snapTarget = createMockEntity('token2', new Vector2(300, 100));
      const obstacle = createMockEntity('obstacle', new Vector2(200, 100));
      
      const start = new Vector3(100, 100, 0);
      const target = new Vector3(400, 100, 0);
      const collisionPoint = new Vector3(272.5, 100, 0);

      // Mock collision detection
      vi.mocked(mockCollisionDetector.checkCollision).mockImplementation((entity, obstacles) => {
        const entityPos = (entity as any).position;
        const entityCentre = entityPos.x + 27.5;
        
        // Check collision with obstacle at x=200
        if (Math.abs(entityCentre - 227.5) < 55) {
          return { isColliding: true, collidingWith: [obstacle] };
        }
        
        // Check collision with snap target at x=300
        if (Math.abs(entityCentre - 327.5) < 55) {
          return { isColliding: true, collidingWith: [snapTarget] };
        }
        
        return { isColliding: false, collidingWith: [] };
      });

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        [obstacle],
        collisionPoint
      );

      expect(result.success).toBe(true);
      if (result.position) {
        // Should stop before the obstacle, not reach snap target
        expect(result.position.x).toBeLessThan(172.5);
        expect(result.position.x).toBeGreaterThan(100);
      }
    });

    it('should return failure when no valid position exists', () => {
      const movingEntity = createMockEntity('token1', new Vector2(100, 100));
      const snapTarget = createMockEntity('token2', new Vector2(100, 100)); // Same position
      
      const start = new Vector3(100, 100, 0);
      const target = new Vector3(200, 100, 0);
      const collisionPoint = new Vector3(100, 100, 0);

      // Mock all positions as colliding
      vi.mocked(mockCollisionDetector.checkCollision).mockReturnValue({
        isColliding: true,
        collidingWith: [snapTarget]
      });

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        [],
        collisionPoint
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('No valid snap position along path');
    });

    it('should use linear search when starting from collision point', () => {
      const movingEntity = createMockEntity('token1', new Vector2(100, 100));
      const snapTarget = createMockEntity('token2', new Vector2(200, 100));
      
      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);
      const collisionPoint = new Vector3(172.5, 100, 0);

      let checkCount = 0;
      vi.mocked(mockCollisionDetector.checkCollision).mockImplementation((entity) => {
        checkCount++;
        const entityPos = (entity as any).position;
        const distance = Math.abs(entityPos.x + 27.5 - 227.5);
        
        // First few checks collide, then find clear position
        if (checkCount <= 5) {
          return { isColliding: true, collidingWith: [snapTarget] };
        }
        
        return {
          isColliding: distance < 55,
          collidingWith: distance < 55 ? [snapTarget] : []
        };
      });

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        [],
        collisionPoint
      );

      expect(result.success).toBe(true);
      expect(checkCount).toBeGreaterThan(5); // Linear search performed multiple checks
    });

    it('should use gradient descent as fallback when linear search fails', () => {
      const movingEntity = createMockEntity('token1', new Vector2(100, 100));
      const snapTarget = createMockEntity('token2', new Vector2(200, 100));
      
      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);
      const collisionPoint = new Vector3(172.5, 100, 0);

      let checkCount = 0;
      vi.mocked(mockCollisionDetector.checkCollision).mockImplementation((entity) => {
        checkCount++;
        const entityPos = (entity as any).position;
        
        // Make linear search fail (first ~79 checks)
        if (checkCount < 80) {
          return { isColliding: true, collidingWith: [snapTarget] };
        }
        
        // Allow gradient descent to find position
        const distance = Math.abs(entityPos.x + 27.5 - 227.5);
        return {
          isColliding: distance < 55,
          collidingWith: distance < 55 ? [snapTarget] : []
        };
      });

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        [],
        collisionPoint
      );

      expect(result.success).toBe(true);
      expect(checkCount).toBeGreaterThan(80); // Gradient descent kicked in
    });

    it('should apply separation buffer to final position', () => {
      const movingEntity = createMockEntity('token1', new Vector2(100, 100));
      const snapTarget = createMockEntity('token2', new Vector2(200, 100));
      
      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);
      const collisionPoint = new Vector3(172.5, 100, 0);

      // Simple collision detection
      vi.mocked(mockCollisionDetector.checkCollision).mockImplementation((entity) => {
        const entityPos = (entity as any).position;
        const distance = Math.abs(entityPos.x + 27.5 - 227.5);
        return {
          isColliding: distance < 55,
          collidingWith: distance < 55 ? [snapTarget] : []
        };
      });

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        [],
        collisionPoint
      );

      expect(result.success).toBe(true);
      if (result.position) {
        // Should be backed off by buffer amount (0.1 units)
        const expectedMaxX = 172.5 - 0.1;
        expect(result.position.x).toBeLessThanOrEqual(expectedMaxX);
      }
    });

    it('should handle vertical movement with elevation changes', () => {
      const movingEntity = createMockEntity('token1', new Vector2(50, 100), 55, 55, 0);
      const snapTarget = createMockEntity('token2', new Vector2(150, 100), 55, 55, 10);
      
      const start = new Vector3(50, 100, 0);
      const target = new Vector3(200, 100, 10);
      const collisionPoint = new Vector3(122.5, 100, 5);

      vi.mocked(mockCollisionDetector.checkCollision).mockImplementation((entity) => {
        const entityPos = (entity as any).position;
        const entityElev = (entity as any).elevation || 0;
        
        // Simple 2D distance check ignoring elevation for this test
        const distance = Math.abs(entityPos.x + 27.5 - 177.5);
        return {
          isColliding: distance < 55,
          collidingWith: distance < 55 ? [snapTarget] : []
        };
      });

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        [],
        collisionPoint
      );

      expect(result.success).toBe(true);
      if (result.position) {
        // Should interpolate elevation as well
        expect(result.position.z).toBeGreaterThanOrEqual(0);
        expect(result.position.z).toBeLessThanOrEqual(10);
      }
    });

    it('should handle fine-tuning after finding initial valid position', () => {
      const movingEntity = createMockEntity('token1', new Vector2(100, 100));
      const snapTarget = createMockEntity('token2', new Vector2(200, 100));
      
      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);
      const collisionPoint = new Vector3(172.5, 100, 0);

      let fineSearchTriggered = false;
      vi.mocked(mockCollisionDetector.checkCollision).mockImplementation((entity) => {
        const entityPos = (entity as any).position;
        const distance = Math.abs(entityPos.x + 27.5 - 227.5);
        
        // Track if we're in fine search (small movements)
        if (entityPos.x > 140 && entityPos.x < 170) {
          fineSearchTriggered = true;
        }
        
        return {
          isColliding: distance < 55,
          collidingWith: distance < 55 ? [snapTarget] : []
        };
      });

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        [],
        collisionPoint
      );

      expect(result.success).toBe(true);
      expect(fineSearchTriggered).toBe(true); // Fine tuning was performed
    });

    it('should restore original entity position after calculation', () => {
      const movingEntity = createMockEntity('token1', new Vector2(100, 100), 55, 55, 5);
      const snapTarget = createMockEntity('token2', new Vector2(200, 100));
      
      const originalPos = new Vector2(100, 100);
      const originalElev = 5;
      
      const start = new Vector3(100, 100, 5);
      const target = new Vector3(300, 100, 5);
      const collisionPoint = new Vector3(172.5, 100, 5);

      calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        [],
        collisionPoint
      );

      // Entity should be moved back to original position
      expect(movingEntity.move).toHaveBeenLastCalledWith(
        new Vector3(originalPos.x, originalPos.y, originalElev)
      );
    });

    it('should handle entities without move method gracefully', () => {
      const movingEntity = {
        id: 'token1',
        position: new Vector2(100, 100),
        elevation: 0,
        verticalExtent: new VerticalExtent(0, 1),
        spatialCentre: new Vector3(127.5, 127.5, 27.5),
        centre: new Vector2(127.5, 127.5), // Add the missing centre property
        getSpatialVolume: () => ({
          type: 'cylinder' as const,
          centre: new Vector3(127.5, 127.5, 27.5),
          radius: 27.5,
          height: 55
        }),
        canPassThrough: () => false,
        getAABB: () => ({
          min: new Vector2(100, 100),
          max: new Vector2(155, 155),
          minX: 100,
          minY: 100,
          maxX: 155,
          maxY: 155,
          width: 55,
          height: 55,
          centerX: 127.5,
          centerY: 127.5,
          intersects: () => false,
          contains: () => false,
          expand: (amount: number) => ({
            min: new Vector2(100 - amount, 100 - amount),
            max: new Vector2(155 + amount, 155 + amount),
            minX: 100 - amount,
            minY: 100 - amount,
            maxX: 155 + amount,
            maxY: 155 + amount,
            width: 55 + amount * 2,
            height: 55 + amount * 2,
            centerX: 127.5,
            centerY: 127.5,
            intersects: () => false,
            contains: () => false,
            expand: () => { throw new Error('Not implemented'); }
          })
        })
      } as unknown as SpatialEntity; // Cast through unknown as suggested
      
      const snapTarget = createMockEntity('token2', new Vector2(200, 100));
      
      const start = new Vector3(100, 100, 0);
      const target = new Vector3(300, 100, 0);
      const collisionPoint = new Vector3(172.5, 100, 0);

      // Should not throw even without move method
      expect(() => {
        calculator.calculateSnapPosition(
          movingEntity,
          start,
          target,
          snapTarget,
          [],
          collisionPoint
        );
      }).not.toThrow();
    });

    it('should handle very small movements near precision threshold', () => {
      const movingEntity = createMockEntity('token1', new Vector2(100, 100));
      const snapTarget = createMockEntity('token2', new Vector2(100.005, 100));
      
      const start = new Vector3(100, 100, 0);
      const target = new Vector3(100.01, 100, 0); // Very small movement
      const collisionPoint = new Vector3(100.005, 100, 0);

      const result = calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        [],
        collisionPoint
      );

      // Should handle edge case without errors
      expect(result.success).toBeDefined();
    });

    it('should optimise search using collision point information', () => {
      const movingEntity = createMockEntity('token1', new Vector2(0, 0));
      const snapTarget = createMockEntity('token2', new Vector2(500, 0));
      
      const start = new Vector3(0, 0, 0);
      const target = new Vector3(1000, 0, 0); // Long path
      const collisionPoint = new Vector3(472.5, 0, 0); // Near snap target

      let checksInRange = 0;
      vi.mocked(mockCollisionDetector.checkCollision).mockImplementation((entity) => {
        const entityPos = (entity as any).position;
        
        // Count checks near the collision point
        if (entityPos.x > 400 && entityPos.x < 500) {
          checksInRange++;
        }
        
        const distance = Math.abs(entityPos.x + 27.5 - 527.5);
        return {
          isColliding: distance < 55,
          collidingWith: distance < 55 ? [snapTarget] : []
        };
      });

      calculator.calculateSnapPosition(
        movingEntity,
        start,
        target,
        snapTarget,
        [],
        collisionPoint
      );

      // Most checks should be near collision point, not along entire path
      expect(checksInRange).toBeGreaterThan(0);
      expect(vi.mocked(mockCollisionDetector.checkCollision).mock.calls.length).toBeLessThan(100);
    });
  });
});