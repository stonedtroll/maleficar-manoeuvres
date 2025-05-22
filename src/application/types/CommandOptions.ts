/**
 * Options for configuring token movement commands
 */
export interface MoveTokenCommandOptions {
    /** Maximum movement distance allowed */
    maxDistance?: number;
    
    /** Whether to enable snapping to valid positions */
    enableSnapping: boolean;
    
    /** Whether to ignore elevation differences during movement validation */
    ignoreElevation?: boolean;
    
    /** Whether this is a teleport movement (no path checking) */
    isTeleport?: boolean;
    
    /** Whether to animate the movement */
    animate?: boolean;
    
    /** Animation duration in milliseconds */
    animationDuration?: number;
}

/**
 * Options for configuring token rotation commands
 */
export interface RotateTokenCommandOptions {
    /** Whether to animate the rotation */
    animate?: boolean;
    
    /** Duration of rotation animation in milliseconds */
    animationDuration?: number;
}

/**
 * Options for batch token operations
 */
export interface BatchTokenCommandOptions {
    /** Whether to process tokens in parallel */
    parallel?: boolean;
    
    /** Maximum number of concurrent operations */
    maxConcurrency?: number;
}