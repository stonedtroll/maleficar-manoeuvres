/**
 * Registry for overlay context builders.
 * Manages the creation and retrieval of context builders for different overlay types.
 */
import type { OverlayContextBuilder } from '../../domain/interfaces/OverlayContextBuilder.js';
import { LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';
import { TokenBoundaryContextBuilder } from '../coordinators/contextBuilders/TokenBoundaryContextBuilder.js';
import { FacingArcContextBuilder } from '../coordinators/contextBuilders/FacingArcContextBuilder.js';

export class OverlayContextBuilderRegistry {
  private readonly logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.OverlayContextBuilderRegistry`);
  private readonly builders = new Map<string, OverlayContextBuilder>();

  constructor() {
    this.registerDefaultBuilders();
  }

  /**
   * Registers default context builders.
   */
  private registerDefaultBuilders(): void {
    // Token boundary context builder
    this.register('token-boundary', new TokenBoundaryContextBuilder());
    
    // Facing arc context builder
    this.register('facing-arc', new FacingArcContextBuilder());

    this.logger.info('Default context builders registered', {
      count: this.builders.size,
      builders: Array.from(this.builders.keys())
    });
  }

  /**
   * Registers a context builder.
   */
  register(id: string, builder: OverlayContextBuilder): void {
    this.builders.set(id, builder);
    this.logger.debug('Context builder registered', { id });
  }

  /**
   * Gets a context builder by ID.
   */
  get(id: string): OverlayContextBuilder | undefined {
    return this.builders.get(id);
  }

  /**
   * Gets all registered builders.
   */
  getAll(): Map<string, OverlayContextBuilder> {
    return new Map(this.builders);
  }
}