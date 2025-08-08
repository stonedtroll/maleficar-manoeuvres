import type { SpatialEntity } from '../interfaces/SpatialEntity.js';
import type { SpatialVolume } from '../value-objects/SpatialVolume.js';
import { AABB } from '../value-objects/AABB.js';
import { Vector2 } from '../value-objects/Vector2.js';
import { Vector3 } from '../value-objects/Vector3.js';
import { Wall } from '../entities/Wall.js';

export interface CoverResult {
  percentage: number; 
  blockingObstacles: SpatialEntity[];
  rayDetails?: {
    total: number;
    blocked: number;
  };
}

export class CoverCalculator {
  private static readonly MIN_SAMPLES = 16;
  private static readonly MAX_SAMPLES = 21;
  private static readonly DISTANCE_THRESHOLD = 1000; // pixels

  private static readonly ATTACKER_EYE_HEIGHT_RATIO = 0.93; 

  private readonly obstacleAABBCache = new WeakMap<SpatialEntity, AABB>();
  private readonly attackerEyeCache = new WeakMap<SpatialEntity, Vector3>();
  
  constructor() {}

  /**
   * Calculates cover percentage between attacker and target.
   */
  calculateCover(
    attacker: SpatialEntity,
    target: SpatialEntity,
    obstacles: SpatialEntity[],
    invalidateAttacker = false
  ): CoverResult {
    if (invalidateAttacker) {
      this.attackerEyeCache.delete(attacker);
    }

    const attackerAABB = this.getCachedAABB(attacker);
    const targetAABB = this.getCachedAABB(target);
    
    if (attackerAABB.intersects(targetAABB)) {
      return {
        percentage: 0,
        blockingObstacles: [],
        rayDetails: {
          total: 0,
          blocked: 0
        }
      };
    }
    
    const relevantObstacles = this.filterRelevantObstacles(
      attacker, 
      target, 
      obstacles
    );

    let attackerEyePosition = this.attackerEyeCache.get(attacker);
    if (!attackerEyePosition) {
      attackerEyePosition = new Vector3(
        attacker.position.x + attacker.width / 2,
        attacker.position.y + attacker.height / 2,
        attacker.elevation + attacker.verticalHeight * CoverCalculator.ATTACKER_EYE_HEIGHT_RATIO
      );
      this.attackerEyeCache.set(attacker, attackerEyePosition);
    }
    
    const distance = this.getDistance2D(attacker, target);
    const sampleCount = this.getAdaptiveSampleCount(distance);
    const targetPoints = this.getRealisticTargetPoints(target, attacker, sampleCount);
    const walls = relevantObstacles.filter(obs => obs instanceof Wall) as Wall[];
    const otherObstacles = relevantObstacles.filter(obs => !(obs instanceof Wall));

    const obstacleData = otherObstacles
      .map(obstacle => ({
        entity: obstacle,
        aabb: this.getCachedAABB(obstacle),
        volume: obstacle.getSpatialVolume(),
        minElev: obstacle.elevation,
        maxElev: obstacle.elevation + obstacle.verticalHeight,
        distanceSq: this.getDistanceSquaredToRay(attackerEyePosition, target, obstacle)
      }))
      .sort((a, b) => a.distanceSq - b.distanceSq);

    const blockedRays = new Set<number>();
    const blockingObstacles = new Set<SpatialEntity>();

    for (const wall of walls) {
      const attackerOrigin = new Vector2(attackerEyePosition.x, attackerEyePosition.y);
      if (!wall.blocksSightFromDirection(attackerOrigin)) {
        continue; 
      }
      
      for (let i = 0; i < targetPoints.length; i++) {
        if (blockedRays.has(i)) continue; 
        
        const targetPoint = targetPoints[i];
        if (!targetPoint) continue;
        
        if (this.isRayBlockedByWall(
          attackerEyePosition,
          targetPoint,
          wall
        )) {
          blockedRays.add(i);
          blockingObstacles.add(wall);
        }
      }
    }

    for (const obstacle of obstacleData) {
      if (blockedRays.size === targetPoints.length) {
        break; 
      }

      for (let i = 0; i < targetPoints.length; i++) {
        if (blockedRays.has(i)) continue; 
        
        const targetPoint = targetPoints[i];
        if (!targetPoint) continue; 
        
        if (this.isRayBlockedByObstacle(
          attackerEyePosition,
          targetPoint,
          obstacle
        )) {
          blockedRays.add(i);
          blockingObstacles.add(obstacle.entity);
        }
      }
    }

    const coverPercentage = targetPoints.length > 0 
      ? Math.round((blockedRays.size / targetPoints.length) * 100)
      : 0;

    return {
      percentage: coverPercentage,
      blockingObstacles: Array.from(blockingObstacles),
      rayDetails: {
        total: targetPoints.length,
        blocked: blockedRays.size
      }
    };
  }

  private isRayBlockedByWall(
    start: Vector3,
    end: Vector3,
    wall: Wall
  ): boolean {
    const rayMinElev = Math.min(start.z, end.z);
    const rayMaxElev = Math.max(start.z, end.z);
    
    if (!wall.intersectsElevationRange({
      min: rayMinElev,
      max: rayMaxElev
    } as any)) {
      return false; 
    }
    
    const intersection = this.rayIntersectsLineSegment(
      new Vector2(start.x, start.y),
      new Vector2(end.x, end.y),
      wall.startPoint,
      wall.endPoint
    );
    
    if (!intersection) {
      return false; 
    }

    const t = intersection.t; 
    const intersectionElev = start.z + (end.z - start.z) * t;

    return intersectionElev >= wall.elevation && 
           intersectionElev <= (wall.elevation + wall.verticalHeight);
  }

  private rayIntersectsLineSegment(
    rayStart: Vector2,
    rayEnd: Vector2,
    segStart: Vector2,
    segEnd: Vector2
  ): { t: number } | null {
    const rayDx = rayEnd.x - rayStart.x;
    const rayDy = rayEnd.y - rayStart.y;
    const segDx = segEnd.x - segStart.x;
    const segDy = segEnd.y - segStart.y;

    const denom = rayDx * segDy - rayDy * segDx;

    if (Math.abs(denom) < 0.0001) {
      return null; 
    }

    const dx = segStart.x - rayStart.x;
    const dy = segStart.y - rayStart.y;
    
    const t = (dx * segDy - dy * segDx) / denom; 
    const u = (dx * rayDy - dy * rayDx) / denom; 

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return { t };
    }
    
    return null; 
  }

  private filterRelevantObstacles(
    attacker: SpatialEntity,
    target: SpatialEntity,
    obstacles: SpatialEntity[]
  ): SpatialEntity[] {
    const filteredObstacles = obstacles.filter(obstacle => {
      if (obstacle.id === attacker.id || obstacle.id === target.id) {
        return false;
      }
      const obstacleAABB = this.getCachedAABB(obstacle);
      const attackerAABB = this.getCachedAABB(attacker);
      const targetAABB = this.getCachedAABB(target);
      
      const containedInAttacker = 
        obstacleAABB.min.x >= attackerAABB.min.x &&
        obstacleAABB.max.x <= attackerAABB.max.x &&
        obstacleAABB.min.y >= attackerAABB.min.y &&
        obstacleAABB.max.y <= attackerAABB.max.y;
        
      const containedInTarget = 
        obstacleAABB.min.x >= targetAABB.min.x &&
        obstacleAABB.max.x <= targetAABB.max.x &&
        obstacleAABB.min.y >= targetAABB.min.y &&
        obstacleAABB.max.y <= targetAABB.max.y;
      
      if (containedInAttacker || containedInTarget) {
        return false;
      }

      return obstacle.providesCover;
    });

    const minX = Math.min(attacker.position.x, target.position.x);
    const minY = Math.min(attacker.position.y, target.position.y);
    const maxX = Math.max(
      attacker.position.x + attacker.width,
      target.position.x + target.width
    );
    const maxY = Math.max(
      attacker.position.y + attacker.height,
      target.position.y + target.height
    );
    
    const searchAABB = new AABB(
      new Vector2(minX - 50, minY - 50), 
      new Vector2(maxX + 50, maxY + 50)
    );

    // Filter obstacles within search area
    const relevantObstacles = filteredObstacles.filter(obstacle => {
      const obstacleAABB = this.getCachedAABB(obstacle);
      return searchAABB.intersects(obstacleAABB);
    });
    
    return relevantObstacles;
  }

  private getAdaptiveSampleCount(distance: number): number {
    const ratio = distance / CoverCalculator.DISTANCE_THRESHOLD;
    const samples = Math.round(
      CoverCalculator.MAX_SAMPLES - 
      (CoverCalculator.MAX_SAMPLES - CoverCalculator.MIN_SAMPLES) * Math.min(1, ratio)
    );
    return Math.max(CoverCalculator.MIN_SAMPLES, samples);
  }

  private getRealisticTargetPoints(
    target: SpatialEntity,
    attacker: SpatialEntity,
    sampleCount: number
  ): Vector3[] {
    const points: Vector3[] = [];

    const dirToTarget = new Vector2(
      target.position.x + target.width / 2 - (attacker.position.x + attacker.width / 2),
      target.position.y + target.height / 2 - (attacker.position.y + attacker.height / 2)
    );
    const angleToTarget = Math.atan2(dirToTarget.y, dirToTarget.x);

    const verticalZones = [
      { height: 0.95, weight: 0.15, name: 'head' },      // Head/top - 15%
      { height: 0.80, weight: 0.20, name: 'upperChest' }, // Upper chest - 20%
      { height: 0.65, weight: 0.25, name: 'centreMass' }, // Centre mass - 25%
      { height: 0.45, weight: 0.20, name: 'lowerTorso' }, // Lower torso - 20%
      { height: 0.25, weight: 0.10, name: 'waist' },      // Waist - 10%
      { height: 0.10, weight: 0.10, name: 'legs' }        // Legs/base - 10%
    ];
    
    for (const zone of verticalZones) {
      const zoneHeight = target.elevation + target.verticalHeight * zone.height;
      const zoneSamples = Math.max(1, Math.round(sampleCount * zone.weight));
      
      // Concentrate samples on the side facing the attacker (180° arc)
      const arcStart = angleToTarget - Math.PI / 2;
      const arcSpan = Math.PI;
      
      for (let i = 0; i < zoneSamples; i++) {
        const angle = arcStart + (i / Math.max(1, zoneSamples - 1)) * arcSpan;
        const x = target.position.x + target.width / 2 + 
                 Math.cos(angle) * target.width * 0.48; 
        const y = target.position.y + target.height / 2 + 
                 Math.sin(angle) * target.height * 0.48;
        
        // Clamp to token bounds
        const clampedX = Math.max(
          target.position.x, 
          Math.min(target.position.x + target.width, x)
        );
        const clampedY = Math.max(
          target.position.y, 
          Math.min(target.position.y + target.height, y)
        );
        
        points.push(new Vector3(clampedX, clampedY, zoneHeight));
      }
    }
    
    return points;
  }

  private getCachedAABB(obstacle: SpatialEntity): AABB {
    let aabb = this.obstacleAABBCache.get(obstacle);
    if (!aabb) {
      aabb = obstacle.getAABB();
      this.obstacleAABBCache.set(obstacle, aabb);
    }
    return aabb;
  }

  private getDistance2D(tokenA: SpatialEntity, tokenB: SpatialEntity): number {
    const dx = (tokenA.position.x + tokenA.width / 2) - 
               (tokenB.position.x + tokenB.width / 2);
    const dy = (tokenA.position.y + tokenA.height / 2) - 
               (tokenB.position.y + tokenB.height / 2);
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getDistanceSquaredToRay(
    origin: Vector3,
    target: SpatialEntity,
    obstacle: SpatialEntity
  ): number {
    const targetCentre = new Vector2(
      target.position.x + target.width / 2,
      target.position.y + target.height / 2
    );
    const obstacleCentre = new Vector2(
      obstacle.position.x + obstacle.width / 2,
      obstacle.position.y + obstacle.height / 2
    );
    const originCentre = new Vector2(origin.x, origin.y);

    const ray = targetCentre.subtract(originCentre);
    const rayLengthSq = ray.lengthSquared();
    
    if (rayLengthSq < 0.0001) {
      return obstacleCentre.subtract(originCentre).lengthSquared();
    }
    
    const toObstacle = obstacleCentre.subtract(originCentre);
    const t = Math.max(0, Math.min(1, toObstacle.dot(ray) / rayLengthSq));
    const closestPoint = originCentre.add(ray.multiplyScalar(t));
    
    return closestPoint.subtract(obstacleCentre).lengthSquared();
  }

  private isRayBlockedByObstacle(
    start: Vector3,
    end: Vector3,
    obstacle: {
      entity: SpatialEntity;
      aabb: AABB;
      volume: SpatialVolume;
      minElev: number;
      maxElev: number;
    }
  ): boolean {
    const rayMinElev = Math.min(start.z, end.z);
    const rayMaxElev = Math.max(start.z, end.z);
    
    if (rayMaxElev < obstacle.minElev || rayMinElev > obstacle.maxElev) {
      return false; 
    }

    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxX = Math.max(start.x, end.x);
    const maxY = Math.max(start.y, end.y);
    
    if (maxX < obstacle.aabb.min.x || minX > obstacle.aabb.max.x ||
        maxY < obstacle.aabb.min.y || minY > obstacle.aabb.max.y) {
      return false;
    }

    const rayDirX = end.x - start.x;
    const rayDirY = end.y - start.y;
    const rayDirZ = end.z - start.z; 
    const rayLength2D = Math.sqrt(rayDirX * rayDirX + rayDirY * rayDirY);

    let intersectionT: number | null = null;
    
    if (obstacle.volume.type === 'cylinder') {
      intersectionT = this.getCylinderIntersectionT(
        start.x,
        start.y,
        rayDirX,
        rayDirY,
        rayLength2D * rayLength2D,
        obstacle.volume
      );
    } else {
      intersectionT = this.getAABBIntersectionT(
        start.x,
        start.y,
        rayDirX,
        rayDirY,
        obstacle.aabb
      );
    }

    const epsilon = 0.01;
    if (intersectionT === null || intersectionT <= epsilon || intersectionT >= (1 - epsilon)) {
      return false;
    }

    const intersectionElev = start.z + rayDirZ * intersectionT;

    return intersectionElev >= obstacle.minElev && 
           intersectionElev <= obstacle.maxElev;
  }

  private getCylinderIntersectionT(
    startX: number,
    startY: number,
    rayDirX: number,
    rayDirY: number,
    rayLengthSq: number,
    cylinder: Extract<SpatialVolume, { type: 'cylinder' }>
  ): number | null {
    if (rayLengthSq < 0.0001) {
      const dx = startX - cylinder.centre.x;
      const dy = startY - cylinder.centre.y;
      return dx * dx + dy * dy <= cylinder.radius * cylinder.radius ? 0 : null;
    }
    
    // Calculate t parameter for closest point
    const toCentreX = cylinder.centre.x - startX;
    const toCentreY = cylinder.centre.y - startY;
    const dot = toCentreX * rayDirX + toCentreY * rayDirY;
    const t = Math.max(0, Math.min(1, dot / rayLengthSq));
  
    const closestX = startX + rayDirX * t;
    const closestY = startY + rayDirY * t;
    const dx = closestX - cylinder.centre.x;
    const dy = closestY - cylinder.centre.y;
    
    if (dx * dx + dy * dy <= cylinder.radius * cylinder.radius) {
      return t;
    }
    
    return null;
  }

  private getAABBIntersectionT(
    startX: number,
    startY: number,
    rayDirX: number,
    rayDirY: number,
    aabb: AABB
  ): number | null {
    if (Math.abs(rayDirX) < 0.0001 && Math.abs(rayDirY) < 0.0001) {
      return null; 
    }

    let tMin = 0;
    let tMax = 1;
    
    if (Math.abs(rayDirX) > 0.0001) {
      const invDx = 1 / rayDirX;
      let t1 = (aabb.min.x - startX) * invDx;
      let t2 = (aabb.max.x - startX) * invDx;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
    } else if (startX < aabb.min.x || startX > aabb.max.x) {
      return null;
    }
    
    if (Math.abs(rayDirY) > 0.0001) {
      const invDy = 1 / rayDirY;
      let t1 = (aabb.min.y - startY) * invDy;
      let t2 = (aabb.max.y - startY) * invDy;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
    } else if (startY < aabb.min.y || startY > aabb.max.y) {
      return null;
    }
    
    if (tMin <= tMax && tMin >= 0 && tMin <= 1) {
      return tMin; 
    }
    
    return null;
  }

  calculateCoverBatch(
    pairs: Array<{ attacker: SpatialEntity; target: SpatialEntity }>,
    obstacles: SpatialEntity[]
  ): Map<string, CoverResult> {
    const results = new Map<string, CoverResult>();
    
    if (pairs.length === 0) return results;
    
    const overallBounds = this.getOverallBounds(pairs);
    const potentialObstacles = obstacles.filter(obstacle => {
      const obstacleAABB = this.getCachedAABB(obstacle);
      return overallBounds.intersects(obstacleAABB);
    });

    const walls = potentialObstacles.filter(obs => obs instanceof Wall) as Wall[];
    const otherObstacles = potentialObstacles.filter(obs => !(obs instanceof Wall));

    const cachedObstacleData = otherObstacles.map(obstacle => ({
      entity: obstacle,
      aabb: this.getCachedAABB(obstacle),
      volume: obstacle.getSpatialVolume(),
      minElev: obstacle.elevation,
      maxElev: obstacle.elevation + obstacle.verticalHeight
    }));

    for (const { attacker, target } of pairs) {
      const pairKey = `${attacker.id}-${target.id}`;

      if (attacker.id === target.id) {
        results.set(pairKey, {
          percentage: 0,
          blockingObstacles: [],
          rayDetails: { total: 0, blocked: 0 }
        });
        continue;
      }

      const relevantWalls = this.filterRelevantWallsForPair(attacker, target, walls);
      const relevantObstacles = this.filterRelevantObstaclesForPair(
        attacker, 
        target, 
        cachedObstacleData
      );

      let attackerEyePosition = this.attackerEyeCache.get(attacker);
      if (!attackerEyePosition) {
        attackerEyePosition = new Vector3(
          attacker.position.x + attacker.width / 2,
          attacker.position.y + attacker.height / 2,
          attacker.elevation + attacker.verticalHeight * CoverCalculator.ATTACKER_EYE_HEIGHT_RATIO
        );
        this.attackerEyeCache.set(attacker, attackerEyePosition);
      }
      
      const distance = this.getDistance2D(attacker, target);
      const sampleCount = this.getAdaptiveSampleCount(distance);
      const targetPoints = this.getRealisticTargetPoints(target, attacker, sampleCount);

      const sortedObstacles = relevantObstacles
        .map(obs => ({
          ...obs,
          distanceSq: this.getDistanceSquaredToRay(attackerEyePosition, target, obs.entity)
        }))
        .sort((a, b) => a.distanceSq - b.distanceSq);

      const blockedRays = new Set<number>();
      const blockingObstacles = new Set<SpatialEntity>();

      const attackerOrigin = new Vector2(attackerEyePosition.x, attackerEyePosition.y);
      for (const wall of relevantWalls) {
        if (!wall.blocksSightFromDirection(attackerOrigin)) continue;
        
        for (let i = 0; i < targetPoints.length; i++) {
          if (blockedRays.has(i)) continue;
          
          const targetPoint = targetPoints[i];
          if (!targetPoint) continue;
          
          if (this.isRayBlockedByWall(attackerEyePosition, targetPoint, wall)) {
            blockedRays.add(i);
            blockingObstacles.add(wall);
          }
        }
      }

      for (const obstacle of sortedObstacles) {
        if (blockedRays.size === targetPoints.length) {
          break; 
        }
        
        for (let i = 0; i < targetPoints.length; i++) {
          if (blockedRays.has(i)) continue;
          
          const targetPoint = targetPoints[i];
          if (!targetPoint) continue;
          
          if (this.isRayBlockedByObstacle(attackerEyePosition, targetPoint, obstacle)) {
            blockedRays.add(i);
            blockingObstacles.add(obstacle.entity);
          }
        }
      }
      
      const coverPercentage = targetPoints.length > 0 
        ? Math.round((blockedRays.size / targetPoints.length) * 100)
        : 0;

      results.set(pairKey, {
        percentage: coverPercentage,
        blockingObstacles: Array.from(blockingObstacles),
        rayDetails: {
          total: targetPoints.length,
          blocked: blockedRays.size
        }
      });
    }
    
    return results;
  }

  private filterRelevantObstaclesForPair(
    attacker: SpatialEntity,
    target: SpatialEntity,
    cachedObstacles: Array<{
      entity: SpatialEntity;
      aabb: AABB;
      volume: SpatialVolume;
      minElev: number;
      maxElev: number;
    }>
  ): typeof cachedObstacles {
    const filtered = cachedObstacles.filter(obs => 
      obs.entity.id !== attacker.id && 
      obs.entity.id !== target.id &&
      obs.entity.providesCover 
    );
    
    // Create bounding box for this pair
    const minX = Math.min(attacker.position.x, target.position.x);
    const minY = Math.min(attacker.position.y, target.position.y);
    const maxX = Math.max(
      attacker.position.x + attacker.width,
      target.position.x + target.width
    );
    const maxY = Math.max(
      attacker.position.y + attacker.height,
      target.position.y + target.height
    );
    
    const pairAABB = new AABB(
      new Vector2(minX - 50, minY - 50),
      new Vector2(maxX + 50, maxY + 50)
    );
    
    return filtered.filter(obs => pairAABB.intersects(obs.aabb));
  }

  private filterRelevantWallsForPair(
    attacker: SpatialEntity,
    target: SpatialEntity,
    walls: Wall[]
  ): Wall[] {
    const minX = Math.min(attacker.position.x, target.position.x);
    const minY = Math.min(attacker.position.y, target.position.y);
    const maxX = Math.max(
      attacker.position.x + attacker.width,
      target.position.x + target.width
    );
    const maxY = Math.max(
      attacker.position.y + attacker.height,
      target.position.y + target.height
    );
    
    const pairAABB = new AABB(
      new Vector2(minX - 50, minY - 50),
      new Vector2(maxX + 50, maxY + 50)
    );

    return walls.filter(wall => {
      if (!wall.providesCover) return false;

      const wallAABB = this.getCachedAABB(wall);
      return pairAABB.intersects(wallAABB);
    });
  }

  private getOverallBounds(
    pairs: Array<{ attacker: SpatialEntity; target: SpatialEntity }>
  ): AABB {
    if (pairs.length === 0) {
      return new AABB(new Vector2(0, 0), new Vector2(0, 0));
    }
    
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    for (const { attacker, target } of pairs) {
      minX = Math.min(minX, attacker.position.x, target.position.x);
      minY = Math.min(minY, attacker.position.y, target.position.y);
      maxX = Math.max(maxX, attacker.position.x + attacker.width, target.position.x + target.width);
      maxY = Math.max(maxY, attacker.position.y + attacker.height, target.position.y + target.height);
    }
    
    return new AABB(
      new Vector2(minX, minY),
      new Vector2(maxX, maxY)
    );
  }
}