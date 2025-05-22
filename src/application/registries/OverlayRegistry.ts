/**
 * Centralised registry for managing overlay type definitions in the Maleficar Manoeuvres. This registry provides a single source of truth for all overlay
 * configurations, enabling dynamic registration, retrieval, and categorisation of overlays.
 * 
 * Features:
 * - Type-safe overlay definition storage
 * - Efficient lookup by ID or characteristics
 * - Event-based overlay categorisation
 * - Batch registration support
 */

import type { OverlayDefinition } from '../../domain/interfaces/OverlayDefinition.js';
import type { FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';

import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';

export class OverlayRegistry {
  private readonly overlayTypes = new Map<string, OverlayDefinition>();
  private readonly logger: FoundryLogger;

  constructor() {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.OverlayRegistry`);
    this.logger.info('OverlayRegistry initialised');
  }

  /**
   * Registers a new overlay type definition.
   * Overwrites existing definitions with the same ID.
   */
  register(definition: OverlayDefinition): void {
    this.validateDefinition(definition);
    
    const isUpdate = this.overlayTypes.has(definition.id);
    this.overlayTypes.set(definition.id, definition);
    
    this.logger.info(`${isUpdate ? 'Updated' : 'Registered'} overlay type: ${definition.id}`);
  }
  
  /**
   * Registers multiple overlay types at once.
   * Useful for bulk initialisation during module setup.
   */
  registerBatch(definitions: OverlayDefinition[]): void {
    const startCount = this.overlayTypes.size;
    
    for (const definition of definitions) {
      try {
        this.register(definition);
      } catch (error) {
        this.logger.error(`Failed to register overlay "${definition.id}"`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const registered = this.overlayTypes.size - startCount;
    this.logger.info(`Batch registered ${registered} overlay types`);
  }
  
  /**
   * Unregisters an overlay type.
   */
  unregister(overlayTypeId: string): boolean {
    const removed = this.overlayTypes.delete(overlayTypeId);
    
    if (removed) {
      this.logger.info(`Unregistered overlay type: ${overlayTypeId}`);
    } else {
      this.logger.warn(`Attempted to unregister non-existent overlay type: ${overlayTypeId}`);
    }
    
    return removed;
  }
  
  /**
   * Retrieves a specific overlay type definition.
   */
  get(overlayTypeId: string): OverlayDefinition | undefined {
    return this.overlayTypes.get(overlayTypeId);
  }
  
  /**
   * Retrieves all registered overlay definitions.
   */
  getAll(): OverlayDefinition[] {
    return Array.from(this.overlayTypes.values());
  }
  
  /**
   * Checks if an overlay type is registered.
   */
  has(overlayTypeId: string): boolean {
    return this.overlayTypes.has(overlayTypeId);
  }
  
  /**
   * Retrieves all registered overlay IDs.
   */
  getAllIds(): string[] {
    return Array.from(this.overlayTypes.keys());
  }
  
  /**
   * Clears all registered overlay types.
   * Useful for testing or module teardown.
   */
  clear(): void {
    const count = this.overlayTypes.size;
    this.overlayTypes.clear();
    this.logger.info(`Cleared ${count} overlay types`);
  }
  
  /**
   * Retrieves overlays that use the permission system.
   */
  getPermissionBased(): OverlayDefinition[] {
    return Array.from(this.overlayTypes.values())
      .filter(definition => definition.usePermissionSystem === true);
  }
  
  /**
   * Retrieves overlays that update on specific token events.
   */
  getByUpdateEvent(event: 'tokenMove' | 'tokenRotate' | 'tokenElevation'): OverlayDefinition[] {
    return Array.from(this.overlayTypes.values())
      .filter(definition => definition.updateOn?.[event] === true);
  }
  
  /**
   * Retrieves overlays triggered by specific events.
   */
  getByTrigger(trigger: 'tokenDrag' | 'tokenSelect' | 'tokenHover'): OverlayDefinition[] {
    return Array.from(this.overlayTypes.values())
      .filter(definition => definition.triggers?.[trigger] === true);
  }
  
  /**
   * Retrieves overlays visible on canvas startup.
   */
  getStartupOverlays(): OverlayDefinition[] {
    return Array.from(this.overlayTypes.values())
      .filter(definition => definition.visibleOnStart === true);
  }
  
  /**
   * Gets registry statistics for monitoring.
   */
  getStats(): {
    total: number;
    permissionBased: number;
    startupVisible: number;
    byTrigger: Record<string, number>;
    byUpdateEvent: Record<string, number>;
  } {
    const overlays = this.getAll();
    
    return {
      total: overlays.length,
      permissionBased: overlays.filter(o => o.usePermissionSystem).length,
      startupVisible: overlays.filter(o => o.visibleOnStart).length,
      byTrigger: {
        tokenDrag: overlays.filter(o => o.triggers?.tokenDrag).length,
        tokenSelect: overlays.filter(o => o.triggers?.tokenSelect).length,
        tokenHover: overlays.filter(o => o.triggers?.tokenHover).length
      },
      byUpdateEvent: {
        tokenMove: overlays.filter(o => o.updateOn?.tokenMove).length,
        tokenRotate: overlays.filter(o => o.updateOn?.tokenRotate).length,
        tokenElevation: overlays.filter(o => o.updateOn?.tokenElevation).length
      }
    };
  }
  
  /**
   * Validates an overlay definition before registration.
   */
  private validateDefinition(definition: OverlayDefinition): void {
    if (!definition.id) {
      throw new Error('Overlay definition must have an id');
    }
    
    if (!definition.displayName) {
      throw new Error(`Overlay definition "${definition.id}" must have a name`);
    }
    
    // Validate boolean fields are actually booleans if present
    if (definition.usePermissionSystem !== undefined && 
        typeof definition.usePermissionSystem !== 'boolean') {
      throw new Error(`Overlay definition "${definition.id}" usePermissionSystem must be a boolean`);
    }
    
    if (definition.visibleOnStart !== undefined && 
        typeof definition.visibleOnStart !== 'boolean') {
      throw new Error(`Overlay definition "${definition.id}" visibleOnStart must be a boolean`);
    }
  }
}