import type { MaleficarManoeuvresAPI } from '../api';

declare global {
  // Module API on window for macro access
  interface Window {
    MaleficarManoeuvres?: MaleficarManoeuvresAPI;
  }
  
  // Module-specific globals for debugging
  interface GlobalThis {
    updateLoggerLevel?: (level: any) => any;
    maleficarManoeuvres?: any;
  }
}

export {};