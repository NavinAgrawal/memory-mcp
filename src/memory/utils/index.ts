/**
 * Utilities Module Barrel Export
 *
 * Centralizes all utility exports for convenient importing.
 * Consolidated from 17 files to 9 focused modules (Phase 5 cleanup).
 *
 * @module utils
 */

// ==================== Error Types ====================
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

// ==================== Constants ====================
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
  GRAPH_LIMITS,
  QUERY_LIMITS,
} from './constants.js';

// ==================== Logger ====================
export { logger } from './logger.js';

// ==================== Search Algorithms ====================
export {
  levenshteinDistance,
  calculateTF,
  calculateIDF,
  calculateTFIDF,
  tokenize,
} from './searchAlgorithms.js';

// ==================== Indexes ====================
export {
  NameIndex,
  TypeIndex,
  LowercaseCache,
  RelationIndex,
} from './indexes.js';

// ==================== Search Cache ====================
export {
  SearchCache,
  searchCaches,
  clearAllSearchCaches,
  getAllCacheStats,
  cleanupAllCaches,
  type CacheStats,
} from './searchCache.js';

// ==================== Schemas and Validation ====================
// Consolidated from: schemas.ts, validationHelper.ts, validationUtils.ts
export {
  // Zod schemas - Entity/Relation
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
  // Zod schemas - Observations
  AddObservationInputSchema,
  AddObservationsInputSchema,
  DeleteObservationInputSchema,
  DeleteObservationsInputSchema,
  // Zod schemas - Archive
  ArchiveCriteriaSchema,
  // Zod schemas - Saved Search
  SavedSearchInputSchema,
  SavedSearchUpdateSchema,
  // Zod schemas - Import/Export
  ImportFormatSchema,
  ExtendedExportFormatSchema,
  MergeStrategySchema,
  ExportFilterSchema,
  // Zod schemas - Search
  OptionalTagsSchema,
  OptionalEntityNamesSchema,
  // Schema types
  type EntityInput,
  type CreateEntityInput,
  type UpdateEntityInput,
  type RelationInput,
  type CreateRelationInput,
  type SearchQuery,
  type DateRange,
  type TagAlias,
  type ExportFormat,
  type AddObservationInput,
  type DeleteObservationInput,
  type ArchiveCriteriaInput,
  type SavedSearchInput,
  type SavedSearchUpdateInput,
  type ImportFormat,
  type ExtendedExportFormat,
  type MergeStrategy,
  type ExportFilterInput,
  // Validation result type
  type ValidationResult,
  // Zod helpers
  formatZodErrors,
  validateWithSchema,
  validateSafe,
  validateArrayWithSchema,
  // Manual validation functions
  validateEntity,
  validateRelation,
  validateImportance,
  validateTags,
} from './schemas.js';

// ==================== Formatters ====================
// Consolidated from: responseFormatter.ts, paginationUtils.ts
export {
  // Response formatting
  formatToolResponse,
  formatTextResponse,
  formatRawResponse,
  formatErrorResponse,
  type ToolResponse,
  // Pagination utilities
  validatePagination,
  applyPagination,
  paginateArray,
  getPaginationMeta,
  type ValidatedPagination,
} from './formatters.js';

// ==================== Entity Utilities ====================
// Consolidated from: entityUtils.ts, tagUtils.ts, dateUtils.ts, filterUtils.ts, pathUtils.ts
export {
  // Entity lookup
  findEntityByName,
  findEntitiesByNames,
  entityExists,
  getEntityIndex,
  removeEntityByName,
  getEntityNameSet,
  groupEntitiesByType,
  touchEntity,
  // Tag utilities
  normalizeTag,
  normalizeTags,
  hasMatchingTag,
  hasAllTags,
  filterByTags,
  addUniqueTags,
  removeTags,
  // Date utilities
  isWithinDateRange,
  parseDateRange,
  isValidISODate,
  getCurrentTimestamp,
  // Filter utilities
  isWithinImportanceRange,
  filterByImportance,
  filterByCreatedDate,
  filterByModifiedDate,
  filterByEntityType,
  entityPassesFilters,
  type CommonSearchFilters,
  // Path utilities
  validateFilePath,
  defaultMemoryPath,
  ensureMemoryFilePath,
} from './entityUtils.js';
