import { MODULE_ID, SETTINGS } from './config.js';
import { LogLevel, LoggerFactory } from '../lib/log4foundry/log4foundry.js';

/**
 * Log level choices for settings
 */
export const LOG_LEVEL_CHOICES = {
  'debug': 'Debug - Show all messages',
  'info': 'Info - Show informational messages and above',
  'warn': 'Warning - Show warnings and errors only',
  'error': 'Error - Show errors only',
  'fatal': 'Fatal - Show critical errors only',
  'none': 'None - Disable logging'
};

/**
 * Convert string log level to LogLevel enum
 */
export function getLogLevelFromString(levelString: string): LogLevel {
  switch (levelString.toLowerCase()) {
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    case 'fatal':
      return LogLevel.FATAL;
    case 'none':
      return LogLevel.NONE;
    default:
      return LogLevel.INFO;
  }
}

/**
 * Register module settings
 */
export function registerSettings(): void {
  // Log Level Setting
  if ((game as any)?.settings) {
    (game as any).settings.register(MODULE_ID, SETTINGS.LOG_LEVEL, {
      name: 'Log Level',
      hint: 'Set the logging level for the module',
      scope: 'client',
      config: true,
      type: String,
      choices: LOG_LEVEL_CHOICES,
      default: 'info',
      onChange: (value: string) => {
        try {
          console.log(`[${MODULE_ID}] Log level changed to: ${value}`);

          // Convert string level to LogLevel enum
          const level = getLogLevelFromString(value);
          
          // Update all loggers via the factory
          LoggerFactory.getInstance().setAllLogLevels(level);
          
          console.log(`[${MODULE_ID}] Logger updated successfully to ${LogLevel[level]}`);
        } catch (error) {
          console.error(`[${MODULE_ID}] Failed to update log level:`, error);
        }
      }
    });
  }
}