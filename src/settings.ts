import { MODULE_ID, SETTINGS } from './config.js';
import { LogLevel, LoggerFactory } from '../lib/log4foundry/log4foundry.js';

/**
 * Log level choices for settings
 */
export const LOG_LEVEL_CHOICES = {
  debug: 'Debug   — Show every log message, including detailed diagnostics',
  info:  'Info    — Show informational messages and above (hides debug)',
  warn:  'Warning — Show only warnings and errors',
  error: 'Error   — Show only error-level messages',
  fatal: 'Fatal   — Show only critical (fatal) errors',
  none:  'None    — Disable all logging'
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
 * Register module settings with performance optimisations
 */
export function registerSettings(): void {
  if (!game?.settings) {
    console.warn(`[${MODULE_ID}] Game settings not available during registration`);
    return;
  }

  try {
    game.settings.register(MODULE_ID, SETTINGS.LOG_LEVEL, {
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

    game.settings.register(MODULE_ID, SETTINGS.TOKEN_BORDER_INDICATOR, {
      name: 'Token Border Indicator',
      hint: 'Foundry default outline around tokens.',
      scope: 'client',
      config: true,
      type: Boolean,
      default: false,
      onChange: () => {
        canvas.tokens?.placeables.forEach(token => token.refresh());
      }
    });

    console.log(`[${MODULE_ID}] All settings registered successfully`);

  } catch (error) {
    console.error(`[${MODULE_ID}] Failed to register settings:`, error);
  }
}

/**
 * Get setting value 
 */
export function getSetting<T>(settingKey: string): T {
  try {
    return game.settings.get(MODULE_ID, settingKey) as T;
  } catch (error) {
    console.warn(`[${MODULE_ID}] Failed to get setting '${settingKey}', using default`);
    return getDefaultSettingValue(settingKey) as T;
  }
}

/**
 * Set setting value 
 */
export async function setSetting<T>(settingKey: string, value: T): Promise<void> {
  try {
    await game.settings.set(MODULE_ID, settingKey, value);
    console.log(`[${MODULE_ID}] Setting '${settingKey}' updated to:`, value);
  } catch (error) {
    console.error(`[${MODULE_ID}] Failed to set setting '${settingKey}':`, error);
    throw error;
  }
}

/**
 * Get default setting values for fallback
 */
function getDefaultSettingValue(settingKey: string): unknown {
  const defaults: Record<string, unknown> = {
    [SETTINGS.LOG_LEVEL]: 'info',
    [SETTINGS.TOKEN_BORDER_INDICATOR]: true,
  };

  return defaults[settingKey] ?? null;
}

/**
 * Check if a specific setting is enabled 
 */
export function isSettingEnabled(settingKey: string): boolean {
  return getSetting<boolean>(settingKey) ?? false;
}

/**
 * Batch get multiple settings
 */
export function getSettings<T extends Record<string, unknown>>(settingKeys: (keyof T)[]): Partial<T> {
  const result: Partial<T> = {};

  for (const key of settingKeys) {
    try {
      result[key] = game.settings.get(MODULE_ID, key as string) as T[keyof T];
    } catch (error) {
      console.warn(`[${MODULE_ID}] Failed to get batch setting '${String(key)}'`);
      result[key] = getDefaultSettingValue(key as string) as T[keyof T];
    }
  }

  return result;
}