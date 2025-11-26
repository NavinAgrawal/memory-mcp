/**
 * Utilities Module Barrel Export
 *
 * Centralizes all utility exports for convenient importing.
 * Sprint 1 additions: responseFormatter, tagUtils, entityUtils,
 * validationHelper, paginationUtils, filterUtils
 */

// Error types
export {
  KnowledgeGraphError,
  EntityNotFoundError,
  RelationNotFoundError,
  DuplicateEntityError,
  ValidationError,
  CycleDetectedError,
  InvalidImportanceError,
  FileOperationError,
  ImportError,
  ExportError,
  InsufficientEntitiesError,
} from './errors.js';

// String utilities
export { levenshteinDistance } from './levenshtein.js';
export { calculateTF, calculateIDF, calculateTFIDF, tokenize } from './tfidf.js';

// Logging
export { logger } from './logger.js';

// Date utilities
export { isWithinDateRange, parseDateRange, isValidISODate, getCurrentTimestamp } from './dateUtils.js';

// Validation utilities
export { validateEntity, validateRelation, validateImportance, validateTags, type ValidationResult } from './validationUtils.js';

// Path utilities
export { defaultMemoryPath, ensureMemoryFilePath, validateFilePath } from './pathUtils.js';

// Constants
export {
  FILE_EXTENSIONS,
  FILE_SUFFIXES,
  DEFAULT_FILE_NAMES,
  ENV_VARS,
  DEFAULT_BASE_DIR,
  LOG_PREFIXES,
  SIMILARITY_WEIGHTS,
  DEFAULT_DUPLICATE_THRESHOLD,
  SEARCH_LIMITS,
  IMPORTANCE_RANGE,
} from './constants.js';

// Zod schemas
export {
  EntitySchema,
  CreateEntitySchema,
  UpdateEntitySchema,
  RelationSchema,
  CreateRelationSchema,
  SearchQuerySchema,
  DateRangeSchema,
  TagAliasSchema,
  ExportFormatSchema,
  BatchCreateEntitiesSchema,
  BatchCreateRelationsSchema,
  EntityNamesSchema,
  DeleteRelationsSchema,
  type EntityInput,
  type CreateEntityInput,
  type UpdateEntityInput,
  type RelationInput,
  type CreateRelationInput,
  type SearchQuery,
  type DateRange,
  type TagAlias,
  type ExportFormat,
} from './schemas.js';

// Search cache
export {
  SearchCache,
  searchCaches,
  clearAllSearchCaches,
  getAllCacheStats,
  cleanupAllCaches,
  type CacheStats,
} from './searchCache.js';

// === Sprint 1: New Utility Exports ===

// MCP Response formatting (Task 1.1)
export {
  formatToolResponse,
  formatTextResponse,
  formatRawResponse,
  formatErrorResponse,
  type ToolResponse,
} from './responseFormatter.js';

// Tag utilities (Task 1.2)
export {
  normalizeTag,
  normalizeTags,
  hasMatchingTag,
  hasAllTags,
  filterByTags,
  addUniqueTags,
  removeTags,
} from './tagUtils.js';

// Entity utilities (Task 1.3)
export {
  findEntityByName,
  findEntitiesByNames,
  entityExists,
  getEntityIndex,
  removeEntityByName,
  getEntityNameSet,
  groupEntitiesByType,
  touchEntity,
} from './entityUtils.js';

// Zod validation helpers (Task 1.4)
export {
  formatZodErrors,
  validateWithSchema,
  validateSafe,
  validateArrayWithSchema,
} from './validationHelper.js';

// Pagination utilities (Task 1.5)
export {
  validatePagination,
  applyPagination,
  paginateArray,
  getPaginationMeta,
  type ValidatedPagination,
} from './paginationUtils.js';

// Filter utilities (Task 1.6)
export {
  isWithinImportanceRange,
  filterByImportance,
  filterByCreatedDate,
  filterByModifiedDate,
  filterByEntityType,
  entityPassesFilters,
  type CommonSearchFilters,
} from './filterUtils.js';
