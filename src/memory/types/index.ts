/**
 * Types Module - Barrel Export
 *
 * Central export point for all type definitions used throughout the
 * Memory MCP Server. All types are consolidated in types.ts (Phase 5 cleanup).
 *
 * @example
 * ```typescript
 * import { Entity, Relation, KnowledgeGraph, SearchResult } from './types/index.js';
 * ```
 */

export type {
  // Entity types
  Entity,
  Relation,
  KnowledgeGraph,
  ReadonlyKnowledgeGraph,
  // Search types
  SearchResult,
  SavedSearch,
  BooleanQueryNode,
  DocumentVector,
  TFIDFIndex,
  // Analytics types
  GraphStats,
  ValidationReport,
  ValidationIssue,
  ValidationWarning,
  // Import/Export types
  ExportFilter,
  ImportResult,
  CompressionResult,
  // Tag types
  TagAlias,
  // Storage types
  IGraphStorage,
  StorageConfig,
  LowercaseData,
} from './types.js';
