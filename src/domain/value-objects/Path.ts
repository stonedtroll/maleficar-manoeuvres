import { Vector2 } from './Vector2';

export class Path {
    constructor(
        public readonly waypoints: ReadonlyArray<Vector2>
    ) {}
      get length(): number {
        if (this.waypoints.length < 2) return 0;
        
        let totalLength = 0;
        for (let i = 1; i < this.waypoints.length; i++) {
            const currentWaypoint = this.waypoints[i];
            const previousWaypoint = this.waypoints[i - 1];
            
            if (!currentWaypoint || !previousWaypoint) {
                continue;
            }
            
            totalLength += previousWaypoint.distanceTo(currentWaypoint);
        }
        return totalLength;
    }
      smoothed(): Path {
        if (this.waypoints.length < 3) return this;
        
        const firstWaypoint = this.waypoints[0];
        if (!firstWaypoint) return this;
        
        const smoothedWaypoints: Vector2[] = [];
        smoothedWaypoints.push(firstWaypoint);
        
        // Douglas-Peucker algorithm for path simplification
        const epsilon = 5; // Tolerance in pixels
        const simplified = this.douglasPeucker(this.waypoints, epsilon);
        
        return new Path(simplified);
    }
      private douglasPeucker(points: ReadonlyArray<Vector2>, epsilon: number): Vector2[] {
        if (points.length < 3) return [...points];
        
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        
        if (!firstPoint || !lastPoint) {
            return points.filter((p): p is Vector2 => p !== undefined);
        }
        
        // Find the point with the maximum distance
        let maxDistance = 0;
        let maxIndex = 0;
        
        for (let i = 1; i < points.length - 1; i++) {
            const point = points[i];
            if (!point) continue;
            
            const distance = this.perpendicularDistance(point, firstPoint, lastPoint);
            
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }
        
        // If max distance is greater than epsilon, recursively simplify
        if (maxDistance > epsilon) {
            const left = this.douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
            const right = this.douglasPeucker(points.slice(maxIndex), epsilon);
            
            return [...left.slice(0, -1), ...right];
        } else {
            return [firstPoint, lastPoint];
        }
    }
    
    private perpendicularDistance(point: Vector2, lineStart: Vector2, lineEnd: Vector2): number {
        const line = lineEnd.subtract(lineStart);
        const lineLength = line.magnitude();
        
        if (lineLength === 0) {
            return point.distanceTo(lineStart);
        }
        
        const t = Math.max(0, Math.min(1, point.subtract(lineStart).dot(line) / (lineLength * lineLength)));
        const projection = lineStart.add(line.multiply(t));
        
        return point.distanceTo(projection);
    }
}