/**
 * @file Logger Utilities
 * @module maleficar-manoeuvres/infrastructure/logging
 * @description Utility functions for managing logging within the Maleficar Manoeuvres module.
 * Provides centralised logging configuration and helper functions for the log4foundry library.
 */

import { LogLevel, createFoundryLogger, type FoundryLogger, LoggerFactory } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';

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
    case 'warning':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    case 'fatal':
      return LogLevel.FATAL;
    case 'none':
    default:
      return LogLevel.NONE;
  }
}

/**
 * Create a module logger with the specified level
 */
export function createModuleLogger(level?: LogLevel): FoundryLogger {
  return createFoundryLogger(MODULE_ID, level !== undefined ? { level } : undefined);
}

/**
 * Update all loggers to the specified level
 */
export function setGlobalLogLevel(level: LogLevel): void {
  LoggerFactory.getInstance().setAllLogLevels(level);
}