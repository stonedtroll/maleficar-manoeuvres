import { createFoundryLogger, type FoundryLogger } from '../../../lib/log4foundry/log4foundry.js';
import { MODULE_ID } from '../../config.js';
import type { LocalisationKey } from './LocalisationKeys.js';
import { isLocalisationKey } from './LocalisationKeys.js';

/**
 * TODO: I might have overengineered
 * Service for handling module localisation
 * Provides type-safe access to localised strings with caching and validation
 */
export class LocalisationService {
  private readonly logger: FoundryLogger;
  private static instance: LocalisationService;
  private readonly cache = new Map<string, string>();
  private cacheEnabled = true;

  private constructor() {
    this.logger = createFoundryLogger(`${MODULE_ID}.LocalisationService`);
  }

  /**
   * Get singleton instance of LocalisationService
   */
  static getInstance(): LocalisationService {
    if (!LocalisationService.instance) {
      LocalisationService.instance = new LocalisationService();
    }
    return LocalisationService.instance;
  }

  /**
   * Get localised string with type safety and caching
   */
  get(key: LocalisationKey, data?: Record<string, any>): string {
    // Validate key at runtime in debug mode
    if ((game as any).settings?.get(MODULE_ID, 'debugMode') && !isLocalisationKey(key)) {
      this.logger.warn(`Invalid localisation key: ${key}`);
    }

    const fullKey = `${MODULE_ID}.${key}`;
    const cacheKey = data ? `${fullKey}:${JSON.stringify(data)}` : fullKey;
    
    // Check cache first
    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    try {
      const translated = data 
        ? (game as any).i18n.format(fullKey, data)
        : (game as any).i18n.localize(fullKey);
      
      // Cache the result
      if (this.cacheEnabled) {
        this.cache.set(cacheKey, translated);
      }
      
      return translated;
    } catch (error) {
      this.logger.warn(`Missing localisation key: ${fullKey}`, { error });
      return fullKey; // Return key as fallback
    }
  }

  /**
   * Check if a localisation key exists
   */
  has(key: LocalisationKey): boolean {
    const fullKey = `${MODULE_ID}.${key}`;
    return (game as any).i18n.has(fullKey);
  }

  /**
   * Get localised string or return default
   */
  getOrDefault(key: LocalisationKey, defaultValue: string, data?: Record<string, any>): string {
    return this.has(key) ? this.get(key, data) : defaultValue;
  }

  /**
   * Get multiple localised strings at once
   */
  getMany(keys: LocalisationKey[]): Record<LocalisationKey, string> {
    const result = {} as Record<LocalisationKey, string>;
    for (const key of keys) {
      result[key] = this.get(key);
    }
    return result;
  }

  /**
   * Format a localised string with rich formatting
   */
  format(key: LocalisationKey, data: Record<string, any>): string {
    return this.get(key, data);
  }

  /**
   * Clear the translation cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.debug('Translation cache cleared');
  }

  /**
   * Enable or disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheEnabled = enabled;
    if (!enabled) {
      this.clearCache();
    }
    this.logger.debug(`Translation caching ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get the current language code
   */
  getCurrentLanguage(): string {
    return (game as any).i18n.lang;
  }

  /**
   * Check if a specific language is available
   */
  isLanguageAvailable(lang: string): boolean {
    return (game as any).i18n.translations[lang] !== undefined;
  }

  /**
   * Get all available languages
   */
  getAvailableLanguages(): string[] {
    return Object.keys((game as any).i18n.translations);
  }

  /**
   * Validate all keys exist in the current language
   * Useful for debugging missing translations
   */
  validateAllKeys(): Record<LocalisationKey, boolean> {
    const result = {} as Record<LocalisationKey, boolean>;
    const allKeys = Array.from(new Set<LocalisationKey>());
    
    for (const key of allKeys) {
      result[key] = this.has(key);
    }
    
    return result;
  }

  /**
   * Log missing translations for debugging
   */
  logMissingTranslations(): void {
    const validation = this.validateAllKeys();
    const missing = Object.entries(validation)
      .filter(([_, exists]) => !exists)
      .map(([key]) => key);
    
    if (missing.length > 0) {
      this.logger.warn(`Missing translations for language '${this.getCurrentLanguage()}':`, missing);
    } else {
      this.logger.info(`All translations present for language '${this.getCurrentLanguage()}'`);
    }
  }
}

// Export singleton instance for convenient access
export const l10n = LocalisationService.getInstance();

// Re-export types for convenience
export type { LocalisationKey } from './LocalisationKeys.js';