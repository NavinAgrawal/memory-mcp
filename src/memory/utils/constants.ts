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

/**
 * Similarity scoring weights for duplicate detection.
 * These weights determine the relative importance of each factor
 * when calculating entity similarity for duplicate detection.
 */
export const SIMILARITY_WEIGHTS = {
  /** Name similarity weight (40%) - Uses Levenshtein distance */
  NAME: 0.4,
  /** Entity type match weight (20%) - Exact match required */
  TYPE: 0.2,
  /** Observation overlap weight (30%) - Uses Jaccard similarity */
  OBSERVATION: 0.3,
  /** Tag overlap weight (10%) - Uses Jaccard similarity */
  TAG: 0.1,
} as const;

/**
 * Default threshold for duplicate detection (80% similarity required).
 */
export const DEFAULT_DUPLICATE_THRESHOLD = 0.8;

/**
 * Search result limits to prevent resource exhaustion.
 */
export const SEARCH_LIMITS = {
  /** Default number of results to return */
  DEFAULT: 50,
  /** Maximum number of results allowed */
  MAX: 200,
  /** Minimum number of results (must be at least 1) */
  MIN: 1,
} as const;

/**
 * Entity importance range validation constants.
 * Importance is used to prioritize entities (0 = lowest, 10 = highest).
 */
export const IMPORTANCE_RANGE = {
  /** Minimum importance value */
  MIN: 0,
  /** Maximum importance value */
  MAX: 10,
} as const;
