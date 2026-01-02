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
  CacheCompressionStats,
  // Archive types
  ArchiveResultExtended,
  // Import/Export types
  ExportFilter,
  ExportOptions,
  ExportResult,
  ImportResult,
  CompressionResult,
  // Backup types
  BackupOptions,
  BackupResult,
  RestoreResult,
  BackupMetadataExtended,
  BackupInfoExtended,
  // Tag types
  TagAlias,
  // Storage types
  IGraphStorage,
  StorageConfig,
  LowercaseData,
} from './types.js';
