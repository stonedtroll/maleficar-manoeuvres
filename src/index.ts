/**
 * Maleficar Manoeuvres Module
 */
import { MODULE_ID, SETTINGS } from './config.js';
import { DIContainer } from './infrastructure/di/DIContainer.js';
import { registerSettings, getLogLevelFromString } from './settings.js';
import { LogLevel, LoggerFactory, type FoundryLogger } from '../lib/log4foundry/log4foundry.js';
import type { ManoeuvreApplication } from './application/ManoeuvreApplication.js';
import type { OverlayRegistry } from './application/registries/OverlayRegistry.js';
import type { OverlayPermissionCoordinator } from './application/coordinators/OverlayPermissionCoordinator.js';
import type { EventBus } from './infrastructure/events/EventBus.js';

let logger: FoundryLogger;
let container: DIContainer;
let application: ManoeuvreApplication;

// Module lifecycle hooks
Hooks.once('init', initialiseModule);
Hooks.once('ready', startApplication);
Hooks.once('closeGame', teardownModule);

/**
 * Initialise the module during Foundry's init phase
 * Sets up logging, settings, and dependency injection
 */
async function initialiseModule(): Promise<void> {
  console.log(`${MODULE_ID} | Initialising Maleficar Manoeuvres`);

  // Register module settings
  registerSettings();
  
  // Configure logging based on saved settings
  const logLevel = getConfiguredLogLevel();
  logger = configureLogging(logLevel);

  // Create and initialise dependency container
  container = new DIContainer();
  
  try {
    await container.initialise();
  } catch (error) {
    logger.error('Failed to initialise dependency container', error);
    ui.notifications?.error('Failed to initialise Maleficar Manoeuvres');
    return;
  }

  logger.info('Module initialisation complete');
  logger.info(`Log level set to: ${LogLevel[logLevel]}`);
  logger.debug('Debug logging is active');
}

/**
 * Start the application when Foundry is ready
 * Creates the main application and enables debug mode if configured
 */
async function startApplication(): Promise<void> {
  logger.info('Game ready, setting up Maleficar Manoeuvres');
  
  try {
    // Create and initialise the application
    application = container.createApplication();
    await application.initialise();
    
    // Enable debug mode if log level is DEBUG
    if (isDebugMode()) {
      enableDebugMode();
    }
    
    // Register module API
    registerModuleAPI();
    
  } catch (error) {
    logger.error('Failed to initialise ManoeuvreApplication', error);
    ui.notifications?.error('Failed to start Maleficar Manoeuvres');
  }
  
  logger.info('Maleficar Manoeuvres setup complete');
}

/**
 * Clean up resources when closing the game
 * Ensures proper teardown of application and container
 */
async function teardownModule(): Promise<void> {
  logger.info('Closing game, tearing down Maleficar Manoeuvres');
  
  if (application) {
    await application.tearDown();
  }
  
  if (container) {
    await container.shutdown();
  }
  
  logger.info('Maleficar Manoeuvres teardown complete');
}

/**
 * Get the configured log level from settings
 * Defaults to INFO if not set
 */
function getConfiguredLogLevel(): LogLevel {
  const savedLogLevel = game.settings.get(MODULE_ID, SETTINGS.LOG_LEVEL) as string;
  return savedLogLevel ? getLogLevelFromString(savedLogLevel) : LogLevel.INFO;
}

/**
 * Configure the logging system with the specified level
 * Returns the configured logger instance
 */
function configureLogging(logLevel: LogLevel): FoundryLogger {
  const factory = LoggerFactory.getInstance();
  factory.setDefaultLevel(logLevel);

  return factory.getFoundryLogger(MODULE_ID, {
    level: logLevel,
    useFoundryPrefix: true
  });
}

/**
 * Check if the module is running in debug mode
 * Based on the configured log level
 */
function isDebugMode(): boolean {
  const logLevel = getConfiguredLogLevel();
  return logLevel === LogLevel.DEBUG;
}

/**
 * Enable debug mode with development utilities
 * Exposes debug tools on the window object
 */
function enableDebugMode(): void {
  const overlayRegistry = container.get<OverlayRegistry>('overlayRegistry');
  const eventBus = container.get<EventBus>('eventBus');

  (window as any).maleficarDebug = {
    // Core module components
    getAPI,
    logger: () => logger,
    container: () => container,
    application: () => application,
    
    // Debug utilities
    listOverlays: () => overlayRegistry?.getAll(),
    getOverlay: (id: string) => overlayRegistry?.get(id),
    eventBus: () => eventBus,
    
    // Diagnostic tools
    getStats: () => ({
      overlays: overlayRegistry?.getAll().length ?? 0,
      logLevel: LogLevel[getConfiguredLogLevel()]
    })
  };

  console.log('Maleficar Manoeuvres debug mode enabled');
  console.log('  Access debug tools via: window.maleficarDebug');
  console.log('  Available commands:');
  console.log('    - maleficarDebug.getAPI()');
  console.log('    - maleficarDebug.listOverlays()');
  console.log('    - maleficarDebug.getStats()');
}

/**
 * Register the module API on the Foundry module object
 * Allows external modules to interact with Maleficar Manoeuvres
 */
function registerModuleAPI(): void {
  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    (mod as any).api = getAPI();
    logger.debug('Module API registered');
  }
}

/**
 * Get the public API for external module access
 * Returns undefined if module not properly initialised
 */
export function getAPI() {
  if (!container || !application) {
    return undefined;
  }
  
  const overlayRegistry = container.get<OverlayRegistry>('overlayRegistry');
  const overlayPermissionCoordinator = container.get<OverlayPermissionCoordinator>('overlayPermissionCoordinator');
  const eventBus = container.get<EventBus>('eventBus');
  
  return {
    // Core components
    application,
    overlayRegistry,
    overlayPermissionCoordinator,
    eventBus,
    
    // Utility methods
    registerOverlay: (definition: any) => overlayRegistry?.register(definition),
    getOverlay: (id: string) => overlayRegistry?.get(id),
    hasOverlay: (id: string) => overlayRegistry?.has(id) ?? false,

    isDebugMode
  };
}