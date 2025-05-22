import { MoveableToken } from './MoveableToken';
import { Vector2 } from '../value-objects/Vector2';
import { Vector3 } from '../value-objects/Vector3';
import { AABB } from '../value-objects/AABB';
import { CollisionShape } from '../value-objects/CollisionShape';
import { Rotation } from '../value-objects/Rotation';
import { Collidable } from '../interfaces/Collidable';

export class GridlessToken extends MoveableToken implements Collidable {

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

    move(newPosition: Vector2): void {
        this._previousPosition = this.position;
        this.position = newPosition;
    }

    get radius(): number {
        return (this.width + this.height) / 4;
    }

    getCollisionShape(): CollisionShape {
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