import { Vector2 } from '../value-objects/Vector2';
import { Path } from '../value-objects/Path';
import { CollisionDetector } from '../collision/CollisionDetector';
import { CollisionShape } from '../value-objects/CollisionShape';

export interface PathfindingContext {
    start: Vector2;
    goal: Vector2;
    tokenShape: CollisionShape;
    obstacles: CollisionShape[];
    collisionDetector: CollisionDetector;
}

export interface PathfindingAlgorithm {
    findPath(context: PathfindingContext): Path | null;
}