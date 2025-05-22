import { Collidable } from '../interfaces/Collidable';
import { Vector3 } from '../value-objects/Vector3';

/**
 * Result of a movement validation check
 */
export interface MovementValidationResult {
    type: 'valid' | 'invalid' | 'blocked';
    
    /**
     * Final position after movement (may differ from requested position)
     */
    position?: Vector3;
    
    /**
     * Reason for invalid or blocked movement
     */
    reason?: string;
    
    /**
     * Additional details about the result
     */
    details?: Record<string, unknown>;
    
    /**
     * Entities blocking the movement
     */
    blockers?: Collidable[];
    
    /**
     * First point where collision occurred during movement
     */
    collisionPoints?: Vector3[];
}