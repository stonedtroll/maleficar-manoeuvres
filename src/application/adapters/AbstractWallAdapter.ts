/**
 * Abstract adapter class for wall entities in Foundry VTT v13.
 */
export abstract class AbstractWallAdapter {
    constructor(protected wall: Wall) { }

    abstract get id(): string;
    abstract get coordinates(): readonly [number, number, number, number]; // [x1, y1, x2, y2]

    /**
     * Door configuration from CONST.WALL_DOOR_TYPES
     * Determines if this wall segment is a door and what type
     */
    abstract get doorType(): number;

    /**
     * Current door state from CONST.WALL_DOOR_STATES
     * Only relevant when doorType indicates this is a door
     */
    abstract get doorState(): number;

    /**
     * Blocking direction from CONST.WALL_DIRECTIONS
     * Determines which side(s) of the wall block perception/movement
     */
    abstract get blockingDirection(): number;

    /**
     * Movement restriction level from CONST.WALL_MOVEMENT_TYPES
     * Controls physical movement through the wall
     */
    abstract get movementRestriction(): number;

    /**
     * Sight restriction level from CONST.WALL_SENSE_TYPES
     * Controls vision and line-of-sight through the wall
     */
    abstract get sightRestriction(): number;

    /**
     * Sound restriction level from CONST.WALL_SENSE_TYPES
     * Controls sound propagation through the wall
     */
    abstract get soundRestriction(): number;

    /**
     * Light restriction level from CONST.WALL_SENSE_TYPES
     * Controls light propagation through the wall
     */
    abstract get lightRestriction(): number;

    /**
     * Permeability thresholds for partial blocking (0-1 range)
     * null if wall uses default thresholds based on restriction types
     */
    abstract get permeabilityThresholds(): {
        light: number;
        sight: number;
        sound: number;
    } | null;

    /**
     * Module-specific flags and custom data
     */
    abstract get flags(): Record<string, any>;

    /**
     * Gets the bounding rectangle of the wall.
     * This is the minimal axis-aligned rectangle that contains the wall segment.
     */
    abstract get bounds(): { x: number; y: number; width: number; height: number };
}

/**
 * Door type constants matching CONST.WALL_DOOR_TYPES
 */
export const DOOR_TYPES = {
    NONE: 0,        // Not a door
    DOOR: 1,        // Regular door
    SECRET: 2       // Secret door
} as const;

/**
 * Door state constants matching CONST.WALL_DOOR_STATES
 */
export const DOOR_STATES = {
    CLOSED: 0,      // Door is closed
    OPEN: 1,        // Door is open
    LOCKED: 2       // Door is locked
} as const;

/**
 * Blocking direction constants matching CONST.WALL_DIRECTIONS
 */
export const BLOCKING_DIRECTIONS = {
    BOTH: 0,        // Blocks from both directions
    LEFT: 1,        // Blocks from left side only
    RIGHT: 2        // Blocks from right side only
} as const;

/**
 * Movement restriction constants matching CONST.WALL_MOVEMENT_TYPES
 */
export const MOVEMENT_RESTRICTIONS = {
    NONE: 0,        // No movement restriction
    NORMAL: 1       // Blocks all movement
} as const;

/**
 * Sight restriction constants matching CONST.WALL_SENSE_TYPES
 * Also used for sound and light restrictions
 */
export const SENSE_RESTRICTIONS = {
    NONE: 0,        // No blocking
    LIMITED: 1,     // Partial blocking
    NORMAL: 2,      // Full blocking
    PROXIMITY: 3,   // Proximity-activated blocking
    DISTANCE: 4     // Distance-based blocking
} as const;

export type DoorType = typeof DOOR_TYPES[keyof typeof DOOR_TYPES];
export type DoorState = typeof DOOR_STATES[keyof typeof DOOR_STATES];
export type BlockingDirection = typeof BLOCKING_DIRECTIONS[keyof typeof BLOCKING_DIRECTIONS];
export type MovementRestriction = typeof MOVEMENT_RESTRICTIONS[keyof typeof MOVEMENT_RESTRICTIONS];
export type SenseRestriction = typeof SENSE_RESTRICTIONS[keyof typeof SENSE_RESTRICTIONS];