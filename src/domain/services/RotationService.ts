//TODO Rotate when snapping
//TODO Rewrite

import { Rotation } from '../value-objects/Rotation.js';
import { Vector2 } from '../value-objects/Vector2.js';
import type { Token } from '../entities/Token.js';

export class RotationService {
  private static readonly ROTATION_SEGMENTS = 24;
  private static readonly SEGMENT_DEGREES = 360 / RotationService.ROTATION_SEGMENTS;
  private static readonly MIN_ROTATION_DISTANCE = 10; // Minimum pixels to trigger rotation
  private static readonly MIN_ROTATION_CHANGE = 5; // Minimum degrees change to suggest
  
  private static readonly CARDINAL_DIRECTIONS = {
    north: 0,
    northeast: 45,
    east: 90,
    southeast: 135,
    south: 180,
    southwest: 225,
    west: 270,
    northwest: 315
  } as const;

  /**
   * Calculate the rotation angle from one position to another
   * Adjusted for Foundry's coordinate system (0° = south)
   */
  calculateRotationBetweenPoints(from: Vector2, to: Vector2): Rotation {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    
    // Calculate angle in radians
    const angleRadians = Math.atan2(deltaY, deltaX);
    const angleDegrees = angleRadians * 180 / Math.PI;
    
    // Adjust for Foundry's rotation system (0° = south)
    // Standard atan2: 0° = east, we need 0° = south
    const adjustedAngle = (angleDegrees + 90 + 360) % 360;
    
    return new Rotation(adjustedAngle);
  }

  /**
   * Suggest auto-rotation based on movement direction
   */
  suggestAutoRotation(
    currentPosition: Vector2,
    targetPosition: Vector2,
    currentRotation: Rotation,
    minDistance: number = RotationService.MIN_ROTATION_DISTANCE
  ): Rotation | null {
    const distance = currentPosition.distanceTo(targetPosition);
    
    // Don't suggest rotation for very small movements
    if (distance < minDistance) {
      return null;
    }
    
    const suggestedRotation = this.calculateRotationBetweenPoints(currentPosition, targetPosition);
    const rotationDelta = Math.abs(currentRotation.deltaTo(suggestedRotation));
    
    // Don't suggest if the rotation change is minimal
    if (rotationDelta < RotationService.MIN_ROTATION_CHANGE) {
      return null;
    }
    
    return suggestedRotation;
  }

  /**
   * Snap rotation to the nearest segment (15° increments by default)
   */
  snapToSegment(rotation: Rotation): Rotation {
    const degrees = rotation.degrees;
    const segment = Math.round(degrees / RotationService.SEGMENT_DEGREES);
    const snappedDegrees = (segment * RotationService.SEGMENT_DEGREES) % 360;
    
    return new Rotation(snappedDegrees);
  }

  /**
   * Get the segment index for a rotation (0-23 for 24 segments)
   */
  getRotationSegment(rotation: Rotation): number {
    const segment = Math.round(rotation.degrees / RotationService.SEGMENT_DEGREES);
    return segment === RotationService.ROTATION_SEGMENTS ? 0 : segment;
  }

  /**
   * Snap rotation to the nearest cardinal or intercardinal direction
   */
  snapToCardinal(rotation: Rotation, includeIntercardinal: boolean = true): Rotation {
    const snapAngle = includeIntercardinal ? 45 : 90;
    const degrees = rotation.degrees;
    const snapped = Math.round(degrees / snapAngle) * snapAngle;
    
    return new Rotation(snapped % 360);
  }

  /**
   * Get the cardinal direction name for a rotation
   */
  getCardinalDirection(rotation: Rotation): keyof typeof RotationService.CARDINAL_DIRECTIONS {
    const degrees = rotation.degrees;
    const directions = Object.entries(RotationService.CARDINAL_DIRECTIONS);
    
    // Find closest cardinal direction
    let closest: keyof typeof RotationService.CARDINAL_DIRECTIONS = 'north';
    let minDiff = 360;
    
    for (const [direction, cardinalDegrees] of directions) {
      const diff = Math.abs(this.calculateShortestRotation(degrees, cardinalDegrees));
      if (diff < minDiff) {
        minDiff = diff;
        closest = direction as keyof typeof RotationService.CARDINAL_DIRECTIONS;
      }
    }
    
    return closest;
  }

  /**
   * Check if a rotation is within a specific arc
   */
  isRotationInArc(
    rotation: Rotation,
    arcCenter: Rotation,
    arcWidth: number
  ): boolean {
    const halfArc = arcWidth / 2;
    const diff = Math.abs(rotation.deltaTo(arcCenter));
    return diff <= halfArc;
  }

  /**
   * Calculate rotation for a path of movements
   */
  calculatePathRotation(
    path: Vector2[],
    currentPosition?: Vector2
  ): Rotation | null {
    if (path.length < 2) {
      return null;
    }
    
    // Find the next significant waypoint
    const startIdx = currentPosition ? 0 : path.length - 2;
    const start = currentPosition || path[startIdx];
    
    // Look for a waypoint that's far enough to matter
    for (let i = startIdx + 1; i < path.length; i++) {
      const waypoint = path[i];
      if (!waypoint) continue;
      
      const distance = start.distanceTo(waypoint);
      if (distance >= RotationService.MIN_ROTATION_DISTANCE) {
        return this.calculateRotationBetweenPoints(start, waypoint);
      }
    }
    
    // If no significant waypoint, use the last segment
    return this.calculateRotationBetweenPoints(
      path[path.length - 2],
      path[path.length - 1]
    );
  }

  /**
   * Interpolate between two rotations using shortest path
   */
  interpolateRotation(
    current: Rotation,
    target: Rotation,
    factor: number
  ): Rotation {
    const currentDegrees = current.degrees;
    const targetDegrees = target.degrees;
    
    const shortestDelta = this.calculateShortestRotation(currentDegrees, targetDegrees);
    const clampedFactor = Math.max(0, Math.min(1, factor));
    const interpolatedDegrees = currentDegrees + shortestDelta * clampedFactor;
    
    return new Rotation((interpolatedDegrees + 360) % 360);
  }

  /**
   * Calculate shortest rotation delta between two angles
   */
  private calculateShortestRotation(from: number, to: number): number {
    let delta = to - from;
    
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    
    return delta;
  }

  /**
   * Validate if a rotation is valid for a given token
   */
  validateRotation(
    token: Token,
    proposedRotation: Rotation
  ): { valid: boolean; reason?: string } {
    // Base implementation - always valid
    // Can be extended for specific game rules
    return { valid: true };
  }

  /**
   * Orient token towards a target position
   */
  orientTowards(token: Token, target: Vector2): void {
    const targetRotation = this.calculateRotationBetweenPoints(
      token.getPosition(),
      target
    );
    token.rotate(targetRotation.degrees);
  }

  /**
   * Calculate optimal rotation for facing multiple targets
   */
  calculateAverageRotation(positions: Vector2[], from: Vector2): Rotation | null {
    if (positions.length === 0) return null;
    
    // Calculate rotation to each position
    const rotations = positions.map(pos => 
      this.calculateRotationBetweenPoints(from, pos).degrees
    );
    
    // Calculate circular mean
    let sinSum = 0;
    let cosSum = 0;
    
    for (const degrees of rotations) {
      const radians = (degrees * Math.PI) / 180;
      sinSum += Math.sin(radians);
      cosSum += Math.cos(radians);
    }
    
    const avgRadians = Math.atan2(sinSum, cosSum);
    const avgDegrees = (avgRadians * 180) / Math.PI;
    
    return new Rotation((avgDegrees + 360) % 360);
  }
}