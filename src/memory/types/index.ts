/**
 * Types Module - Barrel Export
 *
 * Central export point for all type definitions used throughout the
 * Memory MCP Server. Import from this file to access any type.
 *
 * @example
 * ```typescript
 * import { Entity, Relation, KnowledgeGraph, SearchResult } from './types/index.js';
 * ```
 */

// Entity types
export type {
  Entity,
  Relation,
  KnowledgeGraph,
} from './entity.types.js';

// Search types
export type {
  SearchResult,
  SavedSearch,
  BooleanQueryNode,
  DocumentVector,
  TFIDFIndex,
} from './search.types.js';

// Analytics types
export type {
  GraphStats,
  ValidationReport,
  ValidationError,
  ValidationWarning,
} from './analytics.types.js';

// Import/Export types
export type {
  ImportResult,
  CompressionResult,
} from './import-export.types.js';

// Tag types
export type {
  TagAlias,
} from './tag.types.js';
