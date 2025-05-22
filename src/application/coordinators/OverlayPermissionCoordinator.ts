/**
 * @fileoverview Overlay Permission Coordinator
 * 
 * Orchestrates overlay permission checks and visibility determinations. This coordinator acts as the bridge
 * between the domain permission logic and the application layer, managing cache
 * optimisation and coordinating permission checks across multiple tokens.
 * 
 * Features:
 * - Intelligent caching of token sight data to minimise repository calls
 * - Fast-path optimisation for overlays without permission requirements
 * - Generation-based cache invalidation for scene changes
 * - Efficient batch fetching for multiple tokens
 */

import type { OverlayRegistry } from '../registries/OverlayRegistry.js';
import type { OverlayPermissionService } from '../../domain/services/OverlayPermissionService.js';
import type { 
  TokenSightRepository, 
  TokenSightData, 
  TokenId 
} from '../../domain/interfaces/SightlineTypes.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';

export class OverlayPermissionCoordinator {
  private readonly logger: FoundryLogger;
  private readonly tokenDataCache = new Map<string, TokenSightData>();
  private cacheGeneration = 0;

  constructor(
    private readonly registry: OverlayRegistry,
    private readonly permissionService: OverlayPermissionService,
    private readonly tokenSightRepository: TokenSightRepository
  ) {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(
      `${MODULE_ID}.OverlayPermissionCoordinator`
    );
  }

  /**
   * Checks if a user can view a specific overlay on a target token.
   */
  async canViewOverlayOnToken(
    overlayId: string,
    targetTokenId: TokenId,
    controlledTokenIds: TokenId[],
    ownedTokenIds: TokenId[],
    isGM: boolean
  ): Promise<boolean> {
    // Validate overlay exists
    const overlayConfig = this.registry.get(overlayId);
    if (!overlayConfig) {
      this.logger.warn(`Overlay "${overlayId}" not registered`);
      return false;
    }

    // Fast path: overlay doesn't require permissions
    if (!overlayConfig.usePermissionSystem) {
      this.logger.debug(`Overlay "${overlayId}" bypasses permission system`);
      return true;
    }

    // Fetch target token sight data
    const targetSightData = await this.getCachedTokenData(targetTokenId);
    if (!targetSightData) {
      this.logger.warn(`Sight data not found for token ${targetTokenId}`);
      return false;
    }

    // GMs bypass sight requirements for source tokens
    const controlledSightData = isGM ? [] : await this.getCachedTokensData(controlledTokenIds);
    const ownedSightData = isGM ? [] : await this.getCachedTokensData(ownedTokenIds);

    // Delegate to domain service for permission logic
    return this.permissionService.canViewOverlaysOnToken(
      targetSightData,
      controlledSightData,
      ownedSightData,
      isGM
    );
  }

  /**
   * Clears the token data cache and increments generation.
   * Should be called when scene changes or tokens are updated.
   */
  clearCache(): void {
    const previousSize = this.tokenDataCache.size;
    this.tokenDataCache.clear();
    this.cacheGeneration++;
    
    this.logger.debug('Token data cache cleared', {
      previousSize,
      newGeneration: this.cacheGeneration
    });
  }

  /**
   * Gets current cache statistics for monitoring.
   */
  getCacheStats(): {
    size: number;
    generation: number;
  } {
    return {
      size: this.tokenDataCache.size,
      generation: this.cacheGeneration
    };
  }

  /**
   * Retrieves cached token data or fetches from repository.
   * Uses generation-based cache keys to handle invalidation.
   */
  private async getCachedTokenData(tokenId: TokenId): Promise<TokenSightData | null> {
    const cacheKey = `${tokenId}-${this.cacheGeneration}`;
    let data = this.tokenDataCache.get(cacheKey);

    if (!data) {
      data = await this.tokenSightRepository.getTokenSightData(tokenId) ?? undefined;
      if (data) {
        this.tokenDataCache.set(cacheKey, data);
      }
    }

    return data ?? null;
  }

  /**
   * Retrieves cached data for multiple tokens efficiently.
   * Batches repository calls for uncached tokens.
   */
  private async getCachedTokensData(tokenIds: TokenId[]): Promise<TokenSightData[]> {
    if (tokenIds.length === 0) {
      return [];
    }

    const results: TokenSightData[] = [];
    const uncachedIds: TokenId[] = [];

    // Check cache for each token
    for (const tokenId of tokenIds) {
      const cached = this.tokenDataCache.get(`${tokenId}-${this.cacheGeneration}`);
      if (cached) {
        results.push(cached);
      } else {
        uncachedIds.push(tokenId);
      }
    }

    // Batch fetch uncached tokens
    if (uncachedIds.length > 0) {
      const freshData = await this.tokenSightRepository.getTokensSightData(uncachedIds);
      
      for (const data of freshData) {
        this.tokenDataCache.set(`${data.id}-${this.cacheGeneration}`, data);
        results.push(data);
      }
    }

    return results;
  }
}