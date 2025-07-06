import { MoveableToken } from './MoveableToken';
import { Vector2 } from '../value-objects/Vector2';
import { Vector3 } from '../value-objects/Vector3';
import { AABB } from '../value-objects/AABB';
import { SpatialVolume } from '../value-objects/SpatialVolume';
import { Rotation } from '../value-objects/Rotation';
import { SpatialEntity } from '../interfaces/SpatialEntity';

export class GridlessToken extends MoveableToken implements SpatialEntity {

    constructor(
        id: string,
        name: string,
        position: Vector2,
        rotation: Rotation,
        width: number,
        height: number,
        scale: number
    ) {
        super(id, name, position, rotation, width, height, scale);
    }

    move(newPosition: Vector2 | Vector3): void {
        this._previousPosition = this.position;

        if (newPosition instanceof Vector3) {
            this.position = new Vector2(newPosition.x, newPosition.y);
            this.elevation = newPosition.z;
        } else {
            this.position = newPosition;
        }
    }

    get radius(): number {
        return (this.width + this.height) / 4;
    }

    getSpatialVolume(): SpatialVolume {
        // Tokens are always vertical cylinders in Foundry VTT
        return {
            type: 'cylinder',
            centre: new Vector3(
                this.centre.x,
                this.centre.y,
                this.elevation + this.height / 2
            ),
            radius: this.radius,
            height: this.height,
            axis: 'z' // Always vertical
        };
    }

    getAABB(): AABB {
        // Simple 2D projection of the cylinder for QuadTree indexing
        return AABB.fromCircle(this.position, this.radius);
    }
}