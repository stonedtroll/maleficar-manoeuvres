import { Vector2 } from './Vector2';
import { Edge2D } from './Edge2D';

/**
 * Immutable value object representing a 2D polygon
 */
export class Polygon2D {
    private readonly _vertices: readonly Vector2[];
    private readonly _edges: readonly Edge2D[];
    private readonly _hash: string;

    private constructor(vertices: readonly Vector2[], edges: readonly Edge2D[]) {
        this._vertices = Object.freeze([...vertices]);
        this._edges = Object.freeze([...edges]);
        this._hash = this.calculateHash();
    }

    /**
     * Create a polygon from vertices
     */
    static fromVertices(vertices: Vector2[]): Polygon2D {
        if (vertices.length < 3) {
            throw new Error('A polygon must have at least 3 vertices');
        }

        const edges: Edge2D[] = [];
        for (let i = 0; i < vertices.length; i++) {
            const start = vertices[i];
            const end = vertices[(i + 1) % vertices.length];
            if (!start || !end) {
                throw new Error('Invalid vertex found');
            }
            edges.push(Edge2D.fromPoints(start, end));
        }
        
        return new Polygon2D(vertices, edges);
    }

    get vertices(): readonly Vector2[] {
        return this._vertices;
    }

    get edges(): readonly Edge2D[] {
        return this._edges;
    }

    /**
     * Check if a point is inside the polygon using ray casting algorithm
     */
    contains(point: Vector2): boolean {
        let inside = false;
        const vertices = this._vertices;
        
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const xi = vertices[i]!.x;
            const yi = vertices[i]!.y;
            const xj = vertices[j]!.x;
            const yj = vertices[j]!.y;
            
            const intersect = ((yi > point.y) !== (yj > point.y))
                && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * Get the centre (centroid) of the polygon
     */
    getCentre(): Vector2 {
        const sum = this._vertices.reduce((acc, v) => acc.add(v), new Vector2(0, 0));
        return sum.divide(this._vertices.length);
    }

    /**
     * Get the area of the polygon
     */
    getArea(): number {
        let area = 0;
        const vertices = this._vertices;
        
        for (let i = 0; i < vertices.length; i++) {
            const j = (i + 1) % vertices.length;
            const vi = vertices[i]!;
            const vj = vertices[j]!;
            area += vi.x * vj.y;
            area -= vj.x * vi.y;
        }
        return Math.abs(area) / 2;
    }

    /**
     * Check if polygon vertices are in clockwise order
     */
    isClockwise(): boolean {
        let sum = 0;
        const vertices = this._vertices;
        
        for (let i = 0; i < vertices.length; i++) {
            const j = (i + 1) % vertices.length;
            const vi = vertices[i]!;
            const vj = vertices[j]!;
            sum += (vj.x - vi.x) * (vj.y + vi.y);
        }
        return sum > 0;
    }

    /**
     * Get the bounding box of the polygon
     */
    getBoundingBox(): { min: Vector2; max: Vector2 } {
        let minX = Number.POSITIVE_INFINITY;
        let minY = Number.POSITIVE_INFINITY;
        let maxX = Number.NEGATIVE_INFINITY;
        let maxY = Number.NEGATIVE_INFINITY;

        for (const vertex of this._vertices) {
            minX = Math.min(minX, vertex.x);
            minY = Math.min(minY, vertex.y);
            maxX = Math.max(maxX, vertex.x);
            maxY = Math.max(maxY, vertex.y);
        }

        return {
            min: new Vector2(minX, minY),
            max: new Vector2(maxX, maxY)
        };
    }

    /**
     * Transform the polygon by translation
     */
    translate(offset: Vector2): Polygon2D {
        const newVertices = this._vertices.map(v => v.add(offset));
        return Polygon2D.fromVertices(newVertices);
    }

    /**
     * Transform the polygon by scaling from its centre
     */
    scale(factor: number): Polygon2D {
        const centre = this.getCentre();
        const newVertices = this._vertices.map(v => {
            const offset = v.subtract(centre);
            return centre.add(offset.multiply(factor));
        });
        return Polygon2D.fromVertices(newVertices);
    }

    /**
     * Transform the polygon by rotation around its centre
     */
    rotate(angleRadians: number): Polygon2D {
        const centre = this.getCentre();
        const cos = Math.cos(angleRadians);
        const sin = Math.sin(angleRadians);
        
        const newVertices = this._vertices.map(v => {
            const offset = v.subtract(centre);
            return centre.add(new Vector2(
                offset.x * cos - offset.y * sin,
                offset.x * sin + offset.y * cos
            ));
        });
        return Polygon2D.fromVertices(newVertices);
    }

    /**
     * Check equality with another polygon
     */
    equals(other: Polygon2D): boolean {
        if (this === other) return true;
        if (this._vertices.length !== other._vertices.length) return false;
        return this._hash === other._hash;
    }

    /**
     * Calculate a hash for value equality comparison
     */
    private calculateHash(): string {
        return this._vertices
            .map(v => `${v.x.toFixed(6)},${v.y.toFixed(6)}`)
            .join('|');
    }

    /**
     * Get string representation
     */
    toString(): string {
        return `Polygon2D[${this._vertices.length} vertices]`;
    }
}