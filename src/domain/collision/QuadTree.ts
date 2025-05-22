/**
 * Spatial indexing data structure for the Maleficar Manoeuvres
 * Foundry VTT module. Provides efficient 2D spatial queries for collision detection
 * by recursively subdividing space into quadrants.
 * 
 * Performance characteristics:
 * - Insert: O(log n) average case
 * - Query: O(log n) average case
 * - Remove: O(n) worst case (could be optimised with parent references)
 * - Memory: O(n) where n is number of objects
 */

import { AABB } from '../value-objects/AABB.js';
import { Vector2 } from '../value-objects/Vector2.js';

/**
 * Configuration options for QuadTree behaviour.
 */
export interface QuadTreeOptions {
  /** Maximum tree depth before stopping subdivision (default: 6) */
  readonly maxDepth?: number;
  /** Maximum objects per node before subdivision (default: 8) */
  readonly maxObjectsPerNode?: number;
}

/**
 * Object stored in the QuadTree with spatial bounds.
 */
export interface QuadTreeObject<T = unknown> {
  /** Unique identifier for removal operations */
  readonly id: string;
  /** Spatial bounds for indexing */
  readonly bounds: AABB;
  /** Associated data (typically a Collidable entity) */
  readonly data: T;
}

/**
 * Quadrant indices for child nodes.
 * Arranged clockwise from top-right.
 */
enum Quadrant {
  TOP_RIGHT = 0,
  TOP_LEFT = 1,
  BOTTOM_LEFT = 2,
  BOTTOM_RIGHT = 3
}

/**
 * Default configuration optimised for typical Foundry VTT scenes.
 */
const DEFAULT_OPTIONS: Required<QuadTreeOptions> = {
  maxDepth: 6,
  maxObjectsPerNode: 8
};

export class QuadTree<T = unknown> {
  private readonly bounds: AABB;
  private readonly maxDepth: number;
  private readonly maxObjectsPerNode: number;
  private readonly depth: number;
  private objects: QuadTreeObject<T>[];
  private nodes: QuadTree<T>[];

  /**
   * Creates a new QuadTree node.
   */
  constructor(
    bounds: AABB,
    options: QuadTreeOptions = {},
    depth = 0
  ) {
    this.bounds = bounds;
    this.maxDepth = options.maxDepth ?? DEFAULT_OPTIONS.maxDepth;
    this.maxObjectsPerNode = options.maxObjectsPerNode ?? DEFAULT_OPTIONS.maxObjectsPerNode;
    this.depth = depth;
    this.objects = [];
    this.nodes = [];
  }

  /**
   * Inserts an object into the QuadTree.
   * Automatically handles subdivision when capacity is exceeded.
   */
  insert(object: QuadTreeObject<T>): void {
    // Try to insert into child nodes if subdivided
    if (this.isSubdivided()) {
      const quadrant = this.getQuadrant(object.bounds);
      
      if (quadrant !== -1) {
        const node = this.nodes[quadrant];
        if (node) {
          node.insert(object);
          return;
        }
      }
    }

    // Add to this node
    this.objects.push(object);

    // Subdivide if over capacity and not at max depth
    if (this.shouldSubdivide()) {
      this.subdivide();
      this.redistributeObjects();
    }
  }

  /**
   * Removes an object from the QuadTree by ID.
   */
  remove(id: string): boolean {
    // Check this node's objects
    const index = this.objects.findIndex(obj => obj.id === id);
    if (index !== -1) {
      this.objects.splice(index, 1);
      return true;
    }

    // Recursively check child nodes
    for (const node of this.nodes) {
      if (node.remove(id)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Queries the QuadTree for objects within specified bounds.
   */
  query(queryBounds: AABB): QuadTreeObject<T>[] {
    const results: QuadTreeObject<T>[] = [];

    // Early exit if bounds don't intersect
    if (!this.bounds.intersects(queryBounds)) {
      return results;
    }

    // Check objects in this node
    for (const object of this.objects) {
      if (queryBounds.intersects(object.bounds)) {
        results.push(object);
      }
    }

    // Recursively query child nodes
    if (this.isSubdivided()) {
      for (const node of this.nodes) {
        results.push(...node.query(queryBounds));
      }
    }

    return results;
  }

  /**
   * Clears all objects and child nodes from the tree.
   */
  clear(): void {
    this.objects = [];
    this.nodes = [];
  }

  /**
   * Gets the total number of nodes in the tree.
   */
  getNodeCount(): number {
    let count = 1; // This node
    
    for (const node of this.nodes) {
      count += node.getNodeCount();
    }
    
    return count;
  }

  /**
   * Gets the maximum depth of the tree.
   */
  getMaxDepth(): number {
    if (!this.isSubdivided()) {
      return this.depth;
    }
    
    return Math.max(
      ...this.nodes.map(node => node.getMaxDepth())
    );
  }

  /**
   * Gets statistics about the tree structure.
   */
  getStats(): {
    nodeCount: number;
    objectCount: number;
    maxDepth: number;
    averageObjectsPerNode: number;
  } {
    const nodeCount = this.getNodeCount();
    const objectCount = this.getObjectCount();
    
    return {
      nodeCount,
      objectCount,
      maxDepth: this.getMaxDepth(),
      averageObjectsPerNode: objectCount / nodeCount
    };
  }

  // Private Helper Methods

  /**
   * Checks if this node has been subdivided.
   */
  private isSubdivided(): boolean {
    return this.nodes.length > 0;
  }

  /**
   * Checks if this node should be subdivided.
   */
  private shouldSubdivide(): boolean {
    return (
      this.objects.length > this.maxObjectsPerNode &&
      this.depth < this.maxDepth &&
      !this.isSubdivided()
    );
  }

  /**
   * Subdivides this node into four child quadrants.
   */
  private subdivide(): void {
    const halfWidth = this.bounds.width / 2;
    const halfHeight = this.bounds.height / 2;
    const { x, y } = this.bounds.min;
    const childDepth = this.depth + 1;
    const childOptions = {
      maxDepth: this.maxDepth,
      maxObjectsPerNode: this.maxObjectsPerNode
    };

    // Create four quadrants (clockwise from top-right)
    this.nodes[Quadrant.TOP_RIGHT] = new QuadTree(
      new AABB(
        new Vector2(x + halfWidth, y),
        new Vector2(x + this.bounds.width, y + halfHeight)
      ),
      childOptions,
      childDepth
    );

    this.nodes[Quadrant.TOP_LEFT] = new QuadTree(
      new AABB(
        new Vector2(x, y),
        new Vector2(x + halfWidth, y + halfHeight)
      ),
      childOptions,
      childDepth
    );

    this.nodes[Quadrant.BOTTOM_LEFT] = new QuadTree(
      new AABB(
        new Vector2(x, y + halfHeight),
        new Vector2(x + halfWidth, y + this.bounds.height)
      ),
      childOptions,
      childDepth
    );

    this.nodes[Quadrant.BOTTOM_RIGHT] = new QuadTree(
      new AABB(
        new Vector2(x + halfWidth, y + halfHeight),
        new Vector2(x + this.bounds.width, y + this.bounds.height)
      ),
      childOptions,
      childDepth
    );
  }

  /**
   * Redistributes objects to child nodes after subdivision.
   */
  private redistributeObjects(): void {
    const remainingObjects: QuadTreeObject<T>[] = [];

    for (const object of this.objects) {
      const quadrant = this.getQuadrant(object.bounds);
      
      if (quadrant !== -1) {
        this.nodes[quadrant]!.insert(object);
      } else {
        // Object spans multiple quadrants, keep in parent
        remainingObjects.push(object);
      }
    }

    this.objects = remainingObjects;
  }

  /**
   * Determines which quadrant an object belongs to.
   */
  private getQuadrant(bounds: AABB): number {
    const midX = this.bounds.min.x + this.bounds.width / 2;
    const midY = this.bounds.min.y + this.bounds.height / 2;

    const inTopHalf = bounds.max.y <= midY;
    const inBottomHalf = bounds.min.y >= midY;
    const inLeftHalf = bounds.max.x <= midX;
    const inRightHalf = bounds.min.x >= midX;

    // Check each quadrant
    if (inTopHalf && inRightHalf) return Quadrant.TOP_RIGHT;
    if (inTopHalf && inLeftHalf) return Quadrant.TOP_LEFT;
    if (inBottomHalf && inLeftHalf) return Quadrant.BOTTOM_LEFT;
    if (inBottomHalf && inRightHalf) return Quadrant.BOTTOM_RIGHT;

    // Object spans multiple quadrants
    return -1;
  }

  /**
   * Gets the total number of objects in the tree.
   */
  private getObjectCount(): number {
    let count = this.objects.length;
    
    for (const node of this.nodes) {
      count += node.getObjectCount();
    }
    
    return count;
  }
}