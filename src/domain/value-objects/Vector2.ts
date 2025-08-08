import { Rotation } from './Rotation';

export class Vector2 {
    constructor(
        public readonly x: number,
        public readonly y: number
    ) { }

    add(other: Vector2): Vector2 {
        return new Vector2(this.x + other.x, this.y + other.y);
    }

    subtract(other: Vector2): Vector2 {
        return new Vector2(this.x - other.x, this.y - other.y);
    }

    multiplyScalar(scalar: number): Vector2 {
        return new Vector2(
            this.x * scalar,
            this.y * scalar
        );
    }

    divideScalar(scalar: number): Vector2 {
        if (Math.abs(scalar) < 0.0001) {
            throw new Error('Cannot divide by zero or near-zero value');
        }
        return new Vector2(
            this.x / scalar,
            this.y / scalar
        );
    }

    distanceTo(other: Vector2): number {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    distanceSquaredTo(other: Vector2): number {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return dx * dx + dy * dy;
    }

    magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    magnitudeSquared(): number {
        return this.x * this.x + this.y * this.y;
    }
    /**
     * Get the squared length of the vector (avoids expensive sqrt calculation)
     */
    lengthSquared(): number {
        return this.x * this.x + this.y * this.y;
    }

    /**
     * Returns the length (magnitude) of this vector.
     */
    length(): number {
        return Math.sqrt(this.lengthSquared());
    }

    /**
     * Returns a normalised (unit) version of this vector.
     * Throws an error if the vector has zero length.
     */
    normalise(): Vector2 {
        const len = this.length();
        if (len < 0.0001) {
            throw new Error('Cannot normalise a zero-length vector');
        }
        return this.divideScalar(len);
    }

    /**
     * Get the perpendicular vector (rotated 90 degrees counter-clockwise)
     */
    perpendicular(): Vector2 {
        return new Vector2(-this.y, this.x);
    }

    /**
     * Returns the dot product of this vector and another.
     */
    dot(other: Vector2): number {
        return this.x * other.x + this.y * other.y;
    }

    cross(other: Vector2): number {
        return this.x * other.y - this.y * other.x;
    }

    /**
     * Rotate this vector by a Rotation object
     */
    rotate(rotation: Rotation): Vector2 {
        const radians = rotation.radians;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        return new Vector2(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }

    /**
     * Get the angle of this vector as a Rotation object
     */
    toRotation(): Rotation {
        const radians = Math.atan2(this.y, this.x);
        const degrees = radians * 180 / Math.PI;
        return new Rotation(degrees);
    }

    /**
     * Create a unit vector from a Rotation
     */
    static fromRotation(rotation: Rotation): Vector2 {
        const radians = rotation.radians;
        return new Vector2(Math.cos(radians), Math.sin(radians));
    }

    equals(other: Vector2): boolean {
        return this.x === other.x && this.y === other.y;
    }

    clone(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    static zero(): Vector2 {
        return new Vector2(0, 0);
    }

    static one(): Vector2 {
        return new Vector2(1, 1);
    }

    lerp(other: Vector2, t: number): Vector2 {
        return new Vector2(
            this.x + (other.x - this.x) * t,
            this.y + (other.y - this.y) * t
        );
    }

    /**
     * Check if this vector is approximately equal to another vector
     */
    approximatelyEquals(other: Vector2, tolerance: number = 0.001): boolean {
        return Math.abs(this.x - other.x) <= tolerance &&
            Math.abs(this.y - other.y) <= tolerance;
    }
}