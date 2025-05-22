import { Vector2 } from './Vector2';

export class AABB {
    constructor(
        public readonly min: Vector2,
        public readonly max: Vector2
    ) {}
    
    // Convenience properties for easier access
    get minX(): number { return this.min.x; }
    get minY(): number { return this.min.y; }
    get maxX(): number { return this.max.x; }
    get maxY(): number { return this.max.y; }
    
    get width(): number { return this.max.x - this.min.x; }
    get height(): number { return this.max.y - this.min.y; }
    
    /**
     * Create AABB from array of points
     */
    static fromPoints(points: readonly Vector2[]): AABB {
        if (points.length === 0) {
            throw new Error('Cannot create AABB from empty points array');
        }

        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        for (const point of points) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }

        return new AABB(
            new Vector2(minX, minY),
            new Vector2(maxX, maxY)
        );
    }
    
    static fromCircle(centre: Vector2, radius: number): AABB {
        return new AABB(
            centre.subtract(new Vector2(radius, radius)),
            centre.add(new Vector2(radius, radius))
        );
    }
    
    /**
     * Create AABB from a rotated rectangle
     */
    static fromRectangle(centre: Vector2, width: number, height: number, rotation: number): AABB {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        
        // Calculate the absolute values of rotated dimensions
        const cos = Math.abs(Math.cos(rotation));
        const sin = Math.abs(Math.sin(rotation));
        
        // Calculate the bounding box dimensions
        const boundingWidth = halfWidth * cos + halfHeight * sin;
        const boundingHeight = halfWidth * sin + halfHeight * cos;
        
        return new AABB(
            new Vector2(centre.x - boundingWidth, centre.y - boundingHeight),
            new Vector2(centre.x + boundingWidth, centre.y + boundingHeight)
        );
    }
    
    intersects(other: AABB): boolean {
        return this.min.x <= other.max.x &&
               this.max.x >= other.min.x &&
               this.min.y <= other.max.y &&
               this.max.y >= other.min.y;
    }
    
    contains(point: Vector2): boolean {
        return point.x >= this.min.x &&
               point.x <= this.max.x &&
               point.y >= this.min.y &&
               point.y <= this.max.y;
    }
    
    expand(margin: number): AABB {
        return new AABB(
            this.min.subtract(new Vector2(margin, margin)),
            this.max.add(new Vector2(margin, margin))
        );
    }
}