import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import type { SpatialEntity } from '../../domain/interfaces/SpatialEntity.js';

import { Token } from '../../domain/entities/Token.js';
import { Wall } from '../../domain/entities/Wall.js';
import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';
import { TokenAdapter } from '../adapters/TokenAdapter.js';
import { WallAdapter } from '../adapters/WallAdapter.js';

export class ObstacleRepository {
    private readonly logger: FoundryLogger;

    constructor() {
        this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.ObstacleRepository`);
    }

    getAll(): SpatialEntity[] {
        if (!this.isCanvasReady()) {
            return [];
        }

        const obstacles: SpatialEntity[] = [];

        const allFoundryTokens = canvas!.tokens!.placeables as globalThis.Token[];
        const tokenObstacles = allFoundryTokens.map(token => 
            new Token(new TokenAdapter(token))
        );
        obstacles.push(...tokenObstacles);

        const allFoundryWalls = canvas!.walls!.placeables as globalThis.Wall[];
        const wallObstacles = allFoundryWalls.map(wall => 
            new Wall(new WallAdapter(wall))
        );
        obstacles.push(...wallObstacles);
        
        this.logger.debug(`Retrieved ${tokenObstacles.length} tokens and ${wallObstacles.length} walls as obstacles`);
        
        return obstacles;
    }

    getTokens(): Token[] {
        if (!this.isCanvasReady()) {
            return [];
        }

        const allFoundryTokens = canvas!.tokens!.placeables as globalThis.Token[];
        return allFoundryTokens.map(token => new Token(new TokenAdapter(token)));
    }

    getWalls(): Wall[] {
        if (!this.isCanvasReady()) {
            return [];
        }

        const allFoundryWalls = canvas!.walls!.placeables as globalThis.Wall[];
        return allFoundryWalls.map(wall => new Wall(new WallAdapter(wall)));
    }

    getMovementBlockingWalls(): Wall[] {
        if (!this.isCanvasReady()) {
            return [];
        }

        const allFoundryWalls = canvas!.walls!.placeables as globalThis.Wall[];
        return allFoundryWalls
            .map(wall => new Wall(new WallAdapter(wall)))
            .filter(wall => wall.blocksMovement());
    }

    getSightBlockingWalls(): Wall[] {
        if (!this.isCanvasReady()) {
            return [];
        }

        const allFoundryWalls = canvas!.walls!.placeables as globalThis.Wall[];
        return allFoundryWalls
            .map(wall => new Wall(new WallAdapter(wall)))
            .filter(wall => wall.blocksSight());
    }

    private isCanvasReady(): boolean {
        return Boolean(canvas?.ready && canvas?.tokens && canvas?.walls);
    }
}