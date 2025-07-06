import { Vector2 } from '../../domain/value-objects/Vector2';
import { Rotation } from '../../domain/value-objects/Rotation';
import { SpatialEntity } from '../../domain/interfaces/SpatialEntity';

export interface MoveResult {
    success: boolean;
    reason?: string;
    blockers?: SpatialEntity[];
    previousPosition?: Vector2;
    previousRotation?: Rotation;
    newPosition?: Vector2;
    newRotation?: Rotation;
    isSnapped?: boolean;
    snapTargetId?: string;
    snapTargetName?: string;
    distance?: number;
}