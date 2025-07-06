import { Vector2 } from '../value-objects/Vector2';
import { Path } from '../value-objects/Path';
import { CollisionDetector } from '../collision/CollisionDetector';
import { SpatialVolume } from '../value-objects/SpatialVolume';

export interface PathfindingContext {
    start: Vector2;
    goal: Vector2;
    tokenShape: SpatialVolume;
    obstacles: SpatialVolume[];
    collisionDetector: CollisionDetector;
}

export interface PathfindingAlgorithm {
    findPath(context: PathfindingContext): Path | null;
}