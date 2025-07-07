/**
 * Dependency Injection Container
 * 
 * Infrastructure layer component responsible for wiring up all services.
 * Pragmatic approach that balances clean architecture with simplicity.
 */
import { CommandExecutor } from '../../application/commands/CommandExecutor.js';
import { MovementValidator } from '../../domain/services/MovementValidator.js';
import { SnapPositionCalculator } from '../../domain/services/SnapPositionCalculator.js';
import { TokenStateAdapter } from '../../application/adapters/TokenStateAdapter.js';
import { OptimisedCollisionDetector } from '../../domain/collision/OptimisedCollisionDetector.js';
import { EventBus } from '../events/EventBus.js';
import { FoundryLineOfSightChecker } from '../adapters/FoundryLineOfSightChecker.js';
import { TokenDragDetector } from '../input/TokenDragDetector.js';
import { KeyboardHandler } from '../input/KeyboardHandler.js';
import { OverlayPermissionService } from '../../domain/services/OverlayPermissionService.js';
import { OverlayRegistry } from '../../application/registries/OverlayRegistry.js';
import { OverlayPermissionCoordinator } from '../../application/coordinators/OverlayPermissionCoordinator.js';
import { OverlayRenderingService } from '../../presentation/services/OverlayRenderingService.js';
import { TokenRotationCoordinator } from '../../application/coordinators/TokenRotationCoordinator.js';
import { TokenMovementCoordinator } from '../../application/coordinators/TokenMovementCoordinator.js';
import { TokenDragCoordinator } from '../../application/coordinators/TokenDragCoordinator.js';
import { KeyboardCoordinator } from '../../application/coordinators/KeyboardCoordinator.js';
import { ManoeuvreApplication } from '../../application/ManoeuvreApplication.js';
import type { InitialisableService } from '../../domain/interfaces/InitialisableService.js';
import { LoggerFactory, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';
import { SystemEventAdapter } from '../adapters/SystemEventAdapter.js';
import { FoundryTokenSightRepository } from '../repositories/FoundryTokenSightRepository.js';
import { TokenMeshAdapter } from '../adapters/TokenMeshAdapter.js';
import { AABB } from '../../domain/value-objects/AABB.js';
import { Vector2 } from '../../domain/value-objects/Vector2.js';
import { TokenMovementService } from '../services/TokenMovementService.js';
import { OverlayContextBuilderRegistry } from '../../application/registries/OverlayContextBuilderRegistry.js';

export class DIContainer {
  private readonly services = new Map<string, any>();
  private readonly logger: FoundryLogger;
  private initialised = false;

  constructor() {
    this.logger = LoggerFactory.getInstance().getFoundryLogger(`${MODULE_ID}.DIContainer`);
  }

  /**
   * Initialise all services and wire dependencies
   */
  async initialise(): Promise<void> {
    if (this.initialised) {
      this.logger.warn('DIContainer already initialised');
      return;
    }

    this.logger.info('Initialising dependency container');

    try {
      // Infrastructure layer
      const eventBus = new EventBus();
      const tokenDragDetector = new TokenDragDetector(eventBus);
      const keyboardHandler = new KeyboardHandler(eventBus);
      const systemEventAdapter = new SystemEventAdapter(eventBus);
      const tokenMeshAdapter = new TokenMeshAdapter();
      const tokenMovementService = new TokenMovementService(eventBus);

      // Repository implementations
      const tokenSightRepository = new FoundryTokenSightRepository();

      // Domain services
      // Get scene bounds from Foundry canvas
      const sceneBounds = new AABB(
        new Vector2(0, 0), // min point
        new Vector2(canvas.dimensions?.width ?? 5000, canvas.dimensions?.height ?? 5000) // TODO: Write a canvas adapter
      );

      const optimisedCollisionDetector = new OptimisedCollisionDetector(sceneBounds);
      const movementValidator = new MovementValidator(optimisedCollisionDetector);
      const snapCalculator = new SnapPositionCalculator(optimisedCollisionDetector);
      const lineOfSightChecker = new FoundryLineOfSightChecker();
      const overlayPermissionService = new OverlayPermissionService(
        lineOfSightChecker
      );

      // Application services
      const commandExecutor = new CommandExecutor(eventBus);
      const tokenStateAdapter = new TokenStateAdapter();
      const overlayRegistry = new OverlayRegistry();
      const overlayPermissionCoordinator = new OverlayPermissionCoordinator(
        overlayRegistry,
        overlayPermissionService,
        tokenSightRepository
      );
      
      // Registry
      const overlayContextBuilderRegistry = new OverlayContextBuilderRegistry();

      // Presentation services
      const overlayRenderer = new OverlayRenderingService(
        overlayRegistry,  
        eventBus,
        tokenMeshAdapter
      );

      // Coordinators
      const tokenRotationCoordinator = new TokenRotationCoordinator(
        overlayRegistry,
        overlayPermissionCoordinator,
        overlayRenderer,
        eventBus
      );

      const tokenMovementCoordinator = new TokenMovementCoordinator(
        commandExecutor,
        movementValidator,
        snapCalculator,
        tokenStateAdapter,
        eventBus
      );

      const tokenDragCoordinator = new TokenDragCoordinator(
        overlayRenderer,
        overlayRegistry,
        overlayPermissionCoordinator,
        overlayContextBuilderRegistry,  
        eventBus
      );

      const keyboardCoordinator = new KeyboardCoordinator(
        overlayRenderer,
        overlayRegistry,
        overlayPermissionCoordinator,
        overlayContextBuilderRegistry,
        eventBus
      );

      // Store all services
      this.services.set('eventBus', eventBus);
      this.services.set('tokenDragDetector', tokenDragDetector);
      this.services.set('keyboardHandler', keyboardHandler);
      this.services.set('lineOfSightChecker', lineOfSightChecker);
      this.services.set('overlayPermissionService', overlayPermissionService);
      this.services.set('overlayRegistry', overlayRegistry);
      this.services.set('overlayPermissionCoordinator', overlayPermissionCoordinator);
      this.services.set('overlayContextBuilderRegistry', overlayContextBuilderRegistry);
      this.services.set('overlayRenderer', overlayRenderer);
      this.services.set('tokenRotationCoordinator', tokenRotationCoordinator);
      this.services.set('tokenMovementCoordinator', tokenMovementCoordinator);
      this.services.set('tokenDragCoordinator', tokenDragCoordinator);
      this.services.set('keyboardCoordinator', keyboardCoordinator);
      this.services.set('systemEventAdapter', systemEventAdapter);
      this.services.set('optimisedCollisionDetector', optimisedCollisionDetector);
      this.services.set('movementValidator', movementValidator);
      this.services.set('snapCalculator', snapCalculator);
      this.services.set('commandExecutor', commandExecutor);
      this.services.set('tokenStateAdapter', tokenStateAdapter);
      this.services.set('tokenMovementService', tokenMovementService);

      // Initialise services that need it
      await this.initialiseServices();

      this.initialised = true;
      this.logger.info('Dependency container initialised successfully');
    } catch (error) {
      this.logger.error('Failed to initialise dependency container', error);
      throw error;
    }
  }

  /**
   * Initialise all services that implement InitialisableService
   */
  private async initialiseServices(): Promise<void> {
    const initialisableServices = Array.from(this.services.entries())
      .filter((entry): entry is [string, InitialisableService] => {
        const [_, service] = entry;
        return service && typeof service === 'object' && 'initialise' in service;
      });

    for (const [name, service] of initialisableServices) {
      try {
        this.logger.debug(`Initialising service: ${name}`);
        await service.initialise();
      } catch (error) {
        this.logger.error(`Failed to initialise service: ${name}`, error);
        throw error;
      }
    }
  }

  /**
   * Get a service by key with type safety
   */
  get<T>(key: string): T {
    if (!this.initialised) {
      throw new Error('DIContainer not initialised. Call initialise() first.');
    }

    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service '${key}' not found in container`);
    }
    return service as T;
  }

  /**
   * Check if a service exists
   */
  has(key: string): boolean {
    return this.services.has(key);
  }

  /**
   * Get all registered service keys
   */
  getServiceKeys(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Create the main application instance
   */
  createApplication(): ManoeuvreApplication {
    return new ManoeuvreApplication(
      this.get<EventBus>('eventBus'),
      this.get<OverlayRegistry>('overlayRegistry')  
    );
  }

  /**
   * Shutdown and cleanup all services
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down dependency container');

    // Shutdown services in reverse order
    const services = Array.from(this.services.entries()).reverse();

    for (const [name, service] of services) {
      if (service && typeof service === 'object' && 'shutdown' in service) {
        try {
          this.logger.debug(`Shutting down service: ${name}`);
          await service.shutdown();
        } catch (error) {
          this.logger.error(`Error shutting down service: ${name}`, error);
        }
      }
    }

    this.services.clear();
    this.initialised = false;
  }
}