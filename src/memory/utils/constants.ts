/**
 * Application Constants
 *
 * Centralized configuration constants for file paths, extensions, and default values.
 *
 * @module utils/constants
 */

/**
 * File extensions used by the memory system.
 */
export const FILE_EXTENSIONS = {
  /** JSONL format for line-delimited JSON storage */
  JSONL: '.jsonl',
  /** Legacy JSON format (backward compatibility) */
  JSON: '.json',
} as const;

/**
 * File name suffixes for auxiliary data files.
 * These suffixes are appended to the base memory file name.
 */
export const FILE_SUFFIXES = {
  /** Suffix for saved searches file */
  SAVED_SEARCHES: '-saved-searches',
  /** Suffix for tag aliases file */
  TAG_ALIASES: '-tag-aliases',
} as const;

/**
 * Default file names used by the memory system.
 */
export const DEFAULT_FILE_NAMES = {
  /** Default memory file name */
  MEMORY: 'memory',
  /** Legacy memory file name (for backward compatibility) */
  MEMORY_LEGACY: 'memory',
} as const;

/**
 * Environment variable names used for configuration.
 */
export const ENV_VARS = {
  /** Environment variable for custom memory file path */
  MEMORY_FILE_PATH: 'MEMORY_FILE_PATH',
} as const;

/**
 * Default base directory relative to the compiled code.
 */
export const DEFAULT_BASE_DIR = '../';

/**
 * Log message prefixes for consistent logging.
 */
export const LOG_PREFIXES = {
  /** Informational message prefix */
  INFO: '[INFO]',
  /** Error message prefix */
  ERROR: '[ERROR]',
  /** Warning message prefix */
  WARN: '[WARN]',
} as const;
