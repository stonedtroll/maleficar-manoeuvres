import { 
    AbstractWallAdapter, 
    DOOR_TYPES, 
    DOOR_STATES, 
    BLOCKING_DIRECTIONS,
    MOVEMENT_RESTRICTIONS,
    SENSE_RESTRICTIONS 
} from '../../application/adapters/AbstractWallAdapter.js';

export class WallAdapter extends AbstractWallAdapter {
    
    get id(): string {
        return this.wall.id;
    }
    
    get coordinates(): readonly [number, number, number, number] {
        return this.wall.document.c as [number, number, number, number];
    }
    
    get doorType(): number {
        return this.wall.document.door ?? DOOR_TYPES.NONE;
    }
    
    get doorState(): number {
        return this.wall.document.ds ?? DOOR_STATES.CLOSED;
    }
    
    get blockingDirection(): number {
        return this.wall.document.dir ?? BLOCKING_DIRECTIONS.BOTH;
    }
    
    get movementRestriction(): number {
        return this.wall.document.move ?? MOVEMENT_RESTRICTIONS.NORMAL;
    }
    
    get sightRestriction(): number {
        return this.wall.document.sight ?? SENSE_RESTRICTIONS.NORMAL;
    }
    
    get soundRestriction(): number {
        return this.wall.document.sound ?? SENSE_RESTRICTIONS.NONE;
    }
    
    get lightRestriction(): number {
        return this.wall.document.light ?? SENSE_RESTRICTIONS.NORMAL;
    }
    
    get permeabilityThresholds(): {
        light: number;
        sight: number;
        sound: number;
    } | null {
        const threshold = this.wall.document.threshold;
        
        if (!threshold) return null;
        
        return {
            light: threshold.light ?? this.getDefaultThreshold('light'),
            sight: threshold.sight ?? this.getDefaultThreshold('sight'),
            sound: threshold.sound ?? this.getDefaultThreshold('sound')
        };
    }
    
    get flags(): Record<string, any> {
        return this.wall.document.flags ?? {};
    }
    
    get bounds(): { x: number; y: number; width: number; height: number } {
        const wallBounds = this.wall.bounds;
        return {
            x: wallBounds.x,
            y: wallBounds.y,
            width: wallBounds.width,
            height: wallBounds.height
        };
    }
    
    private getDefaultThreshold(type: 'light' | 'sight' | 'sound'): number {
        const restrictionMap = {
            light: this.lightRestriction,
            sight: this.sightRestriction,
            sound: this.soundRestriction,
        };
        
        const restriction = restrictionMap[type];
        
        switch (restriction) {
            case SENSE_RESTRICTIONS.NONE:
            case MOVEMENT_RESTRICTIONS.NONE:
                return 1; // Allows everything
                
            case SENSE_RESTRICTIONS.LIMITED:
                return 0.5; // Partially blocks
                
            case SENSE_RESTRICTIONS.NORMAL:
            case MOVEMENT_RESTRICTIONS.NORMAL:
                return 0; // Blocks everything
                
            case SENSE_RESTRICTIONS.PROXIMITY:
            case SENSE_RESTRICTIONS.DISTANCE:
                return 0.3; // Conditional blocking
                
            default:
                return 0; // Default to blocking
        }
    }
}