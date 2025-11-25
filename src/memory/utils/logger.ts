/**
 * Simple logging utility for the Memory MCP Server
 *
 * Provides consistent log formatting with levels: debug, info, warn, error
 */

export const logger = {
  /**
   * Debug level logging (verbose, for development)
   */
  debug: (msg: string, ...args: unknown[]): void => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(`[DEBUG] ${msg}`, ...args);
    }
  },

  /**
   * Info level logging (general informational messages)
   */
  info: (msg: string, ...args: unknown[]): void => {
    console.log(`[INFO] ${msg}`, ...args);
  },

  /**
   * Warning level logging (warnings that don't prevent operation)
   */
  warn: (msg: string, ...args: unknown[]): void => {
    console.warn(`[WARN] ${msg}`, ...args);
  },

  /**
   * Error level logging (errors that affect functionality)
   */
  error: (msg: string, ...args: unknown[]): void => {
    console.error(`[ERROR] ${msg}`, ...args);
  },
};
