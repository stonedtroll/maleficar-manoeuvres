import { Vector2 } from '../../domain/value-objects/Vector2';
import { Rotation } from '../../domain/value-objects/Rotation';
import { Collidable } from '../../domain/interfaces/Collidable';

export interface MoveResult {
    success: boolean;
    reason?: string;
    blockers?: Collidable[];
    previousPosition?: Vector2;
    previousRotation?: Rotation;
    newPosition?: Vector2;
    newRotation?: Rotation;
    isSnapped?: boolean;
    snapTargetId?: string;
    snapTargetName?: string;
    distance?: number;
}