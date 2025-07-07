/**
 * Maleficar Manoeuvres - Main Application Controller
 * 
 * Central orchestrator for the Maleficar Manoeuvres module, managing the 
 * high-level application lifecycle and coordinating core services.
 * 
 * Responsibilities:
 * - Application initialisation and teardown
 * - Default overlay registration
 * - Event bus coordination
 * - Service lifecycle management
 * 
 * Lifecycle:
 * 1. Initialisation - Register overlays and notify services
 * 2. Runtime - Coordinate between services via event bus
 * 3. Teardown - Clean shutdown of all services
 */

import type { EventBus } from '../infrastructure/events/EventBus.js';
import type { OverlayRegistry } from './registries/OverlayRegistry.js';
import type { FoundryLogger } from '../../lib/log4foundry/log4foundry.js';
import { LoggerFactory } from '../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../config.js';
import { TokenBoundaryDefinition } from '../infrastructure/overlays/definitions/TokenBoundaryDefinition.js';
import { FacingArcDefinition } from '../infrastructure/overlays/definitions/FacingArcDefinition.js';
import type { OverlayDefinition } from '../domain/interfaces/OverlayDefinition.js';

export class ManoeuvreApplication {
  private readonly logger: FoundryLogger;
  private initialised = false;

  constructor(
    private readonly eventBus: EventBus,
    private readonly overlayRegistry: OverlayRegistry
  ) {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.ManoeuvreApplication`);
  }

  /**
   * Initialise the application and all core services
   * Idempotent - safe to call multiple times
   */
  async initialise(): Promise<void> {
    if (this.initialised) {
      this.logger.warn('ManoeuvreApplication already initialised');
      return;
    }

    this.logger.info('Initialising ManoeuvreApplication');

    try {
      // Register built-in overlays
      await this.registerDefaultOverlays();

      // Notify all services that application is ready
      await this.eventBus.emit('application.ready', {
        timestamp: Date.now()
      });

      this.initialised = true;
      this.logger.info('ManoeuvreApplication initialised successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialise application', error);
      throw error;
    }
  }

  /**
   * Clean shutdown of application and all services
   * Ensures proper resource cleanup
   */
  async tearDown(): Promise<void> {
    if (!this.initialised) {
      this.logger.warn('ManoeuvreApplication not initialised, skipping teardown');
      return;
    }

    this.logger.info('Tearing down ManoeuvreApplication');

    try {
      // Notify all services to clean up
      await this.eventBus.emit('application.teardown', {
        timestamp: Date.now()
      });

      // Clear application state
      this.initialised = false;
      
      this.logger.info('ManoeuvreApplication teardown complete');
      
    } catch (error) {
      this.logger.error('Error during application teardown', error);
      // Don't throw - best effort cleanup
    }
  }

  /**
   * Check if the application is initialised and ready
   */
  isInitialised(): boolean {
    return this.initialised;
  }

  /**
   * Register built-in overlay definitions
   * These are the core overlays provided by the module
   */
  private async registerDefaultOverlays(): Promise<void> {
    this.logger.info('Registering default overlays');
    
    const overlayDefinitions: OverlayDefinition[] = [
      TokenBoundaryDefinition,
      FacingArcDefinition
    ];

    let successCount = 0;
    const errors: Array<{ id: string; error: unknown }> = [];

    for (const definition of overlayDefinitions) {
      try {
        this.overlayRegistry.register(definition);
        this.logger.debug(`Registered overlay: ${definition.id}`);
        successCount++;
      } catch (error) {
        this.logger.error(`Failed to register overlay ${definition.id}`, error);
        errors.push({ id: definition.id, error });
      }
    }

    // Verify registration
    const registeredOverlays = this.overlayRegistry.getAll();
    this.logger.info(`Successfully registered ${successCount}/${overlayDefinitions.length} overlays`, {
      total: overlayDefinitions.length,
      success: successCount,
      failed: errors.length,
      registered: registeredOverlays.map(o => o.id)
    });

    // Throw if critical overlays failed to register
    if (errors.length > 0) {
      const criticalFailure = errors.find(e => 
        e.id === 'facing-arc' || e.id === 'token-boundary'
      );
      
      if (criticalFailure) {
        throw new Error(`Failed to register critical overlay: ${criticalFailure.id}`);
      }
    }
  }

  /**
   * Get current application statistics
   * Useful for diagnostics and debugging
   */
  getStats(): Record<string, unknown> {
    const overlays = this.overlayRegistry.getAll();
    
    return {
      initialised: this.initialised,
      overlays: {
        total: overlays.length,
        types: overlays.map(o => ({
          id: o.id,
          displayName: o.name,
          visibleOnStart: o.visibleOnStart
        }))
      },
      uptime: this.initialised ? Date.now() : 0
    };
  }
}