import { Vector2 } from './Vector2';

/**
 * Immutable value object representing an edge in 2D space
 */
export class Edge2D {
    private readonly _start: Vector2;
    private readonly _end: Vector2;
    private readonly _hash: string;

    private constructor(start: Vector2, end: Vector2) {
        this._start = start;
        this._end = end;
        this._hash = `${start.toString()}|${end.toString()}`;
    }

    /**
     * Create an edge from two points
     */
    static fromPoints(start: Vector2, end: Vector2): Edge2D {
        return new Edge2D(start, end);
    }

    /**
     * Create an edge from coordinates
     */
    static fromCoordinates(x1: number, y1: number, x2: number, y2: number): Edge2D {
        return new Edge2D(
            new Vector2(x1, y1),
            new Vector2(x2, y2)
        );
    }

    get start(): Vector2 {
        return this._start;
    }

    get end(): Vector2 {
        return this._end;
    }

    /**
     * Get the length of the edge
     */
    get length(): number {
        return this._start.distanceTo(this._end);
    }

    /**
     * Get the squared length (avoids expensive sqrt)
     */
    get lengthSquared(): number {
        const dx = this._end.x - this._start.x;
        const dy = this._end.y - this._start.y;
        return dx * dx + dy * dy;
    }

    /**
     * Get the direction vector (normalised)
     */
    get direction(): Vector2 {
        return this._end.subtract(this._start).normalised();
    }

    /**
     * Get the midpoint of the edge
     */
    get midpoint(): Vector2 {
        return this._start.add(this._end).divide(2);
    }

    /**
     * Get the normal vector (perpendicular, pointing outward)
     */
    get normal(): Vector2 {
        const dir = this.direction;
        return new Vector2(-dir.y, dir.x);
    }

    /**
     * Check if a point lies on the edge
     */
    containsPoint(point: Vector2, tolerance: number = 0.001): boolean {
        const distToStart = point.distanceTo(this._start);
        const distToEnd = point.distanceTo(this._end);
        
        return Math.abs(distToStart + distToEnd - this.length) < tolerance;
    }

    /**
     * Get the closest point on the edge to a given point
     */
    closestPoint(point: Vector2): Vector2 {
        const edgeVector = this._end.subtract(this._start);
        const pointVector = point.subtract(this._start);
        const edgeLengthSquared = this.lengthSquared;
        
        if (edgeLengthSquared === 0) {
            return this._start;
        }
        
        const t = Math.max(0, Math.min(1, pointVector.dot(edgeVector) / edgeLengthSquared));
        return this._start.add(edgeVector.multiply(t));
    }

    /**
     * Get the distance from a point to the edge
     */
    distanceToPoint(point: Vector2): number {
        return point.distanceTo(this.closestPoint(point));
    }

    /**
     * Check if this edge intersects with another edge
     */
    intersects(other: Edge2D): boolean {
        const d1 = this.direction;
        const d2 = other.direction;
        const w = this._start.subtract(other._start);
        
        const denom = d1.cross(d2);
        
        // Parallel edges
        if (Math.abs(denom) < 0.0001) {
            return false;
        }
        
        const t1 = w.cross(d2) / denom;
        const t2 = w.cross(d1) / denom;
        
        return t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1;
    }

    /**
     * Get the intersection point with another edge (if exists)
     */
    intersectionPoint(other: Edge2D): Vector2 | null {
        const d1 = this._end.subtract(this._start);
        const d2 = other._end.subtract(other._start);
        const w = this._start.subtract(other._start);
        
        const denom = d1.cross(d2);
        
        // Parallel edges
        if (Math.abs(denom) < 0.0001) {
            return null;
        }
        
        const t1 = w.cross(d2) / denom;
        const t2 = w.cross(d1) / denom;
        
        if (t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1) {
            return this._start.add(d1.multiply(t1));
        }
        
        return null;
    }

    /**
     * Reverse the direction of the edge
     */
    reverse(): Edge2D {
        return new Edge2D(this._end, this._start);
    }

    /**
     * Translate the edge by an offset
     */
    translate(offset: Vector2): Edge2D {
        return new Edge2D(
            this._start.add(offset),
            this._end.add(offset)
        );
    }

    /**
     * Scale the edge from its midpoint
     */
    scale(factor: number): Edge2D {
        const mid = this.midpoint;
        const halfVector = this._end.subtract(this._start).divide(2).multiply(factor);
        
        return new Edge2D(
            mid.subtract(halfVector),
            mid.add(halfVector)
        );
    }

    /**
     * Rotate the edge around its midpoint
     */
    rotate(angleRadians: number): Edge2D {
        const mid = this.midpoint;
        const cos = Math.cos(angleRadians);
        const sin = Math.sin(angleRadians);
        
        const rotatePoint = (p: Vector2): Vector2 => {
            const offset = p.subtract(mid);
            return mid.add(new Vector2(
                offset.x * cos - offset.y * sin,
                offset.x * sin + offset.y * cos
            ));
        };
        
        return new Edge2D(
            rotatePoint(this._start),
            rotatePoint(this._end)
        );
    }

    /**
     * Check equality with another edge
     */
    equals(other: Edge2D): boolean {
        if (this === other) return true;
        return this._hash === other._hash;
    }

    /**
     * Check if edges are approximately equal
     */
    approximatelyEquals(other: Edge2D, tolerance: number = 0.001): boolean {
        return this._start.approximatelyEquals(other._start, tolerance) &&
               this._end.approximatelyEquals(other._end, tolerance);
    }

    /**
     * Get string representation
     */
    toString(): string {
        return `Edge2D[${this._start.toString()} → ${this._end.toString()}]`;
    }
}