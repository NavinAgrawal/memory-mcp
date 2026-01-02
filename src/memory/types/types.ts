/**
 * Type Definitions
 *
 * Consolidated type definitions for the Memory MCP Server.
 * Combines entity, relation, search, analytics, import/export, tag, and storage types.
 *
 * @module types
 */

// ==================== Entity Types ====================

/**
 * Represents an entity in the knowledge graph.
 *
 * Entities are the primary nodes in the graph, containing:
 * - Identity (name, type)
 * - Content (observations)
 * - Metadata (timestamps, tags, importance)
 * - Hierarchy (optional parent reference)
 *
 * @example
 * ```typescript
 * const entity: Entity = {
 *   name: "Alice",
 *   entityType: "person",
 *   observations: ["Works at TechCorp", "Loves TypeScript"],
 *   createdAt: "2024-01-01T00:00:00Z",
 *   lastModified: "2024-01-02T00:00:00Z",
 *   tags: ["employee", "developer"],
 *   importance: 8,
 *   parentId: "TechCorp"
 * };
 * ```
 */
export interface Entity {
  /** Unique name identifying the entity */
  name: string;

  /** Type/category of the entity (e.g., "person", "project", "concept") */
  entityType: string;

  /** Array of observation strings describing facts about the entity */
  observations: string[];

  /** ISO 8601 timestamp when entity was created */
  createdAt?: string;

  /** ISO 8601 timestamp when entity was last modified */
  lastModified?: string;

  /** Array of lowercase tags for categorization */
  tags?: string[];

  /** Importance level from 0 (low) to 10 (high) */
  importance?: number;

  /** Optional parent entity name for hierarchical nesting */
  parentId?: string;
}

/**
 * Represents a directed relation between two entities.
 *
 * Relations form the edges of the knowledge graph, connecting entities
 * with semantic relationships.
 *
 * @example
 * ```typescript
 * const relation: Relation = {
 *   from: "Alice",
 *   to: "TechCorp",
 *   relationType: "works_at",
 *   createdAt: "2024-01-01T00:00:00Z",
 *   lastModified: "2024-01-01T00:00:00Z"
 * };
 * ```
 */
export interface Relation {
  /** Source entity name */
  from: string;

  /** Target entity name */
  to: string;

  /** Type of relationship (should be in active voice, e.g., "works_at", "manages") */
  relationType: string;

  /** ISO 8601 timestamp when relation was created */
  createdAt?: string;

  /** ISO 8601 timestamp when relation was last modified */
  lastModified?: string;
}

/**
 * Represents the complete knowledge graph structure.
 *
 * The knowledge graph consists of entities (nodes) and relations (edges),
 * forming a semantic network of interconnected information.
 *
 * @example
 * ```typescript
 * const graph: KnowledgeGraph = {
 *   entities: [
 *     { name: "Alice", entityType: "person", observations: ["Developer"] },
 *     { name: "TechCorp", entityType: "company", observations: ["Tech company"] }
 *   ],
 *   relations: [
 *     { from: "Alice", to: "TechCorp", relationType: "works_at" }
 *   ]
 * };
 * ```
 */
export interface KnowledgeGraph {
  /** Array of all entities in the graph */
  entities: Entity[];

  /** Array of all relations between entities */
  relations: Relation[];
}

/**
 * Read-only version of KnowledgeGraph for safe cache access.
 * Prevents accidental mutation of cached data.
 */
export type ReadonlyKnowledgeGraph = {
  readonly entities: readonly Entity[];
  readonly relations: readonly Relation[];
};

// ==================== Search Types ====================

/**
 * Represents a search result with relevance scoring and match details.
 *
 * Used by ranked search to return entities sorted by relevance
 * with information about which fields matched the query.
 *
 * @example
 * ```typescript
 * const result: SearchResult = {
 *   entity: { name: "Alice", entityType: "person", observations: ["Developer"] },
 *   score: 0.85,
 *   matchedFields: {
 *     name: true,
 *     observations: ["Developer"]
 *   }
 * };
 * ```
 */
export interface SearchResult {
  /** The entity that matched the search */
  entity: Entity;

  /** Relevance score (0.0 to 1.0, higher is more relevant) */
  score: number;

  /** Details about which fields matched the search query */
  matchedFields: {
    /** True if entity name matched */
    name?: boolean;

    /** True if entity type matched */
    entityType?: boolean;

    /** Array of observations that matched the query */
    observations?: string[];
  };
}

/**
 * Represents a saved search query that can be executed repeatedly.
 *
 * Saved searches store frequently used queries with their filters,
 * tracking usage statistics for analytics.
 *
 * @example
 * ```typescript
 * const savedSearch: SavedSearch = {
 *   name: "high-priority-developers",
 *   description: "Find all high-priority developer entities",
 *   query: "developer",
 *   tags: ["employee"],
 *   minImportance: 7,
 *   createdAt: "2024-01-01T00:00:00Z",
 *   lastUsed: "2024-01-15T00:00:00Z",
 *   useCount: 42
 * };
 * ```
 */
export interface SavedSearch {
  /** Unique name for the saved search */
  name: string;

  /** Optional description of what this search does */
  description?: string;

  /** The search query string */
  query: string;

  /** Optional tags to filter by */
  tags?: string[];

  /** Optional minimum importance level (0-10) */
  minImportance?: number;

  /** Optional maximum importance level (0-10) */
  maxImportance?: number;

  /** Optional entity type to filter by */
  entityType?: string;

  /** ISO 8601 timestamp when search was created */
  createdAt: string;

  /** ISO 8601 timestamp when search was last executed */
  lastUsed?: string;

  /** Number of times this search has been executed */
  useCount: number;
}

/**
 * Abstract Syntax Tree node types for boolean search queries.
 *
 * Supports AND, OR, NOT operators and field-specific searches.
 * Used by the boolean query parser to build and evaluate complex queries.
 *
 * @example
 * ```typescript
 * // Query: "name:Alice AND (type:person OR observation:developer)"
 * const ast: BooleanQueryNode = {
 *   type: 'AND',
 *   children: [
 *     { type: 'TERM', field: 'name', value: 'alice' },
 *     {
 *       type: 'OR',
 *       children: [
 *         { type: 'TERM', field: 'type', value: 'person' },
 *         { type: 'TERM', field: 'observation', value: 'developer' }
 *       ]
 *     }
 *   ]
 * };
 * ```
 */
export type BooleanQueryNode =
  | { type: 'AND'; children: BooleanQueryNode[] }
  | { type: 'OR'; children: BooleanQueryNode[] }
  | { type: 'NOT'; child: BooleanQueryNode }
  | { type: 'TERM'; field?: string; value: string };

/**
 * Document vector for TF-IDF index.
 *
 * Stores pre-calculated term frequencies for a single entity document.
 * Used to speed up ranked search by avoiding recalculation.
 *
 * @example
 * ```typescript
 * const vector: DocumentVector = {
 *   entityName: "Alice",
 *   terms: { "developer": 2, "python": 1, "senior": 1 },
 *   documentText: "Alice is a senior developer who codes in Python"
 * };
 * ```
 */
export interface DocumentVector {
  /** Entity name this vector represents */
  entityName: string;

  /** Map of term to frequency in this document */
  terms: Record<string, number>;

  /** Original document text (for cache invalidation) */
  documentText: string;
}

/**
 * Pre-calculated TF-IDF index for fast ranked search.
 *
 * Stores document vectors and inverse document frequencies
 * to avoid recalculating TF-IDF scores on every search.
 *
 * @example
 * ```typescript
 * const index: TFIDFIndex = {
 *   version: "1.0",
 *   lastUpdated: "2024-01-15T00:00:00Z",
 *   documents: new Map([
 *     ["Alice", { entityName: "Alice", terms: {...}, documentText: "..." }]
 *   ]),
 *   idf: new Map([
 *     ["developer", 0.693],
 *     ["python", 1.386]
 *   ])
 * };
 * ```
 */
export interface TFIDFIndex {
  /** Index format version */
  version: string;

  /** ISO 8601 timestamp of last index update */
  lastUpdated: string;

  /** Document vectors for all entities */
  documents: Map<string, DocumentVector>;

  /** Inverse document frequency for all terms */
  idf: Map<string, number>;
}

// ==================== Analytics Types ====================

/**
 * Comprehensive statistics about the knowledge graph.
 *
 * Provides counts, type distributions, and temporal information
 * about entities and relations in the graph.
 *
 * @example
 * ```typescript
 * const stats: GraphStats = {
 *   totalEntities: 150,
 *   totalRelations: 320,
 *   entityTypesCounts: { person: 50, project: 30, concept: 70 },
 *   relationTypesCounts: { works_on: 100, manages: 20, related_to: 200 },
 *   oldestEntity: { name: "Alice", date: "2024-01-01T00:00:00Z" },
 *   newestEntity: { name: "Bob", date: "2024-12-31T23:59:59Z" },
 *   entityDateRange: { earliest: "2024-01-01T00:00:00Z", latest: "2024-12-31T23:59:59Z" },
 *   cacheStats: { totalEntries: 150, compressedEntries: 50, uncompressedEntries: 100, estimatedMemorySaved: 250000 }
 * };
 * ```
 */
export interface GraphStats {
  /** Total number of entities in the graph */
  totalEntities: number;

  /** Total number of relations in the graph */
  totalRelations: number;

  /** Count of entities by type */
  entityTypesCounts: Record<string, number>;

  /** Count of relations by type */
  relationTypesCounts: Record<string, number>;

  /** Information about the oldest entity (by createdAt) */
  oldestEntity?: { name: string; date: string };

  /** Information about the newest entity (by createdAt) */
  newestEntity?: { name: string; date: string };

  /** Information about the oldest relation (by createdAt) */
  oldestRelation?: { from: string; to: string; relationType: string; date: string };

  /** Information about the newest relation (by createdAt) */
  newestRelation?: { from: string; to: string; relationType: string; date: string };

  /** Date range of all entities */
  entityDateRange?: { earliest: string; latest: string };

  /** Date range of all relations */
  relationDateRange?: { earliest: string; latest: string };

  /** Cache compression statistics (optional, only when CompressedCache is used) */
  cacheStats?: CacheCompressionStats;
}

/**
 * Complete validation report for the knowledge graph.
 *
 * Contains errors (critical issues) and warnings (non-critical issues)
 * along with summary statistics.
 *
 * @example
 * ```typescript
 * const report: ValidationReport = {
 *   isValid: false,
 *   issues: [
 *     { type: 'orphaned_relation', message: 'Relation references non-existent entity', details: {...} }
 *   ],
 *   warnings: [
 *     { type: 'isolated_entity', message: 'Entity has no relations', details: {...} }
 *   ],
 *   summary: {
 *     totalErrors: 1,
 *     totalWarnings: 1,
 *     orphanedRelationsCount: 1,
 *     entitiesWithoutRelationsCount: 1
 *   }
 * };
 * ```
 */
export interface ValidationReport {
  /** True if graph has no issues (warnings are acceptable) */
  isValid: boolean;

  /** Array of critical issues found */
  issues: ValidationIssue[];

  /** Array of warnings (non-critical issues) */
  warnings: ValidationWarning[];

  /** Summary statistics of validation results */
  summary: {
    totalErrors: number;
    totalWarnings: number;
    orphanedRelationsCount: number;
    entitiesWithoutRelationsCount: number;
  };
}

/**
 * Represents a critical issue found during graph validation.
 * Note: Named ValidationIssue to avoid collision with ValidationError class in utils/errors.ts
 */
export interface ValidationIssue {
  /** Type of issue */
  type: 'orphaned_relation' | 'duplicate_entity' | 'invalid_data';

  /** Human-readable issue message */
  message: string;

  /** Additional details about the issue */
  details?: Record<string, unknown>;
}

/**
 * Represents a non-critical warning found during graph validation.
 */
export interface ValidationWarning {
  /** Type of warning */
  type: 'isolated_entity' | 'empty_observations' | 'missing_metadata';

  /** Human-readable warning message */
  message: string;

  /** Additional details about the warning */
  details?: Record<string, unknown>;
}

// ==================== Import/Export Types ====================

/**
 * Export filter criteria for filtering graph exports by date, type, or tags.
 *
 * @example
 * ```typescript
 * const filter: ExportFilter = {
 *   startDate: '2024-01-01',
 *   endDate: '2024-12-31',
 *   entityType: 'Person',
 *   tags: ['important', 'reviewed']
 * };
 * ```
 */
export interface ExportFilter {
  /** Start date for filtering (ISO 8601) */
  startDate?: string;
  /** End date for filtering (ISO 8601) */
  endDate?: string;
  /** Entity type filter */
  entityType?: string;
  /** Tags filter */
  tags?: string[];
}

/**
 * Result summary from importing a knowledge graph.
 *
 * Provides detailed statistics about what was imported, skipped,
 * updated, and any errors encountered.
 *
 * @example
 * ```typescript
 * const result: ImportResult = {
 *   entitiesAdded: 50,
 *   entitiesSkipped: 10,
 *   entitiesUpdated: 5,
 *   relationsAdded: 100,
 *   relationsSkipped: 20,
 *   errors: ["Invalid entity format on line 42"]
 * };
 * ```
 */
export interface ImportResult {
  /** Number of new entities added */
  entitiesAdded: number;

  /** Number of entities skipped (duplicates or invalid) */
  entitiesSkipped: number;

  /** Number of existing entities updated */
  entitiesUpdated: number;

  /** Number of new relations added */
  relationsAdded: number;

  /** Number of relations skipped (duplicates or invalid) */
  relationsSkipped: number;

  /** Array of error messages encountered during import */
  errors: string[];
}

/**
 * Result summary from graph compression operations.
 *
 * Provides statistics about deduplication, merging, and space savings
 * achieved through compression.
 *
 * @example
 * ```typescript
 * const result: CompressionResult = {
 *   duplicatesFound: 15,
 *   entitiesMerged: 10,
 *   observationsCompressed: 25,
 *   relationsConsolidated: 30,
 *   spaceFreed: 5000,
 *   mergedEntities: [
 *     { kept: "Alice", merged: ["Alice_Smith", "A_Smith"] },
 *     { kept: "TechCorp", merged: ["Tech_Corp", "TechCorporation"] }
 *   ]
 * };
 * ```
 */
export interface CompressionResult {
  /** Number of duplicate entities found */
  duplicatesFound: number;

  /** Number of entities merged into others */
  entitiesMerged: number;

  /** Number of observations compressed */
  observationsCompressed: number;

  /** Number of relations consolidated */
  relationsConsolidated: number;

  /** Approximate character count saved */
  spaceFreed: number;

  /** Details of which entities were merged */
  mergedEntities: Array<{ kept: string; merged: string[] }>;
}

// ==================== Backup Types ====================

/**
 * Options for backup creation.
 *
 * @example
 * ```typescript
 * const options: BackupOptions = {
 *   compress: true,
 *   description: 'Pre-migration backup'
 * };
 * ```
 */
export interface BackupOptions {
  /** Whether to compress the backup with brotli (default: true) */
  compress?: boolean;
  /** Optional description for the backup */
  description?: string;
}

/**
 * Result of a backup creation operation.
 *
 * Provides details about the created backup including compression statistics.
 *
 * @example
 * ```typescript
 * const result: BackupResult = {
 *   path: '/path/to/.backups/backup_2024-01-01.jsonl.br',
 *   timestamp: '2024-01-01T00:00:00.000Z',
 *   entityCount: 150,
 *   relationCount: 320,
 *   compressed: true,
 *   originalSize: 125000,
 *   compressedSize: 37500,
 *   compressionRatio: 0.3
 * };
 * ```
 */
export interface BackupResult {
  /** Full path to the backup file */
  path: string;
  /** ISO 8601 timestamp when backup was created */
  timestamp: string;
  /** Number of entities in the backup */
  entityCount: number;
  /** Number of relations in the backup */
  relationCount: number;
  /** Whether the backup is compressed */
  compressed: boolean;
  /** Original size in bytes (before compression) */
  originalSize: number;
  /** Size after compression in bytes (same as original if not compressed) */
  compressedSize: number;
  /** Compression ratio (compressedSize / originalSize). Lower is better. */
  compressionRatio: number;
  /** Optional description for the backup */
  description?: string;
}

/**
 * Result of a backup restoration operation.
 *
 * @example
 * ```typescript
 * const result: RestoreResult = {
 *   entityCount: 150,
 *   relationCount: 320,
 *   restoredFrom: '/path/to/.backups/backup_2024-01-01.jsonl.br',
 *   wasCompressed: true
 * };
 * ```
 */
export interface RestoreResult {
  /** Number of entities restored */
  entityCount: number;
  /** Number of relations restored */
  relationCount: number;
  /** Path of the backup file that was restored */
  restoredFrom: string;
  /** Whether the backup was compressed */
  wasCompressed: boolean;
}

/**
 * Extended backup metadata with compression information.
 *
 * Stored alongside backups for integrity verification and restoration.
 */
export interface BackupMetadataExtended {
  /** Timestamp when backup was created (ISO 8601) */
  timestamp: string;
  /** Number of entities in the backup */
  entityCount: number;
  /** Number of relations in the backup */
  relationCount: number;
  /** File size in bytes (compressed size if compressed) */
  fileSize: number;
  /** Optional description/reason for backup */
  description?: string;
  /** Whether the backup is compressed */
  compressed: boolean;
  /** Original size before compression in bytes */
  originalSize?: number;
  /** Compression ratio achieved (compressedSize / originalSize) */
  compressionRatio?: number;
  /** Compression format used */
  compressionFormat?: 'brotli' | 'none';
}

/**
 * Extended backup info with compression details.
 *
 * Used when listing backups to show compression statistics.
 */
export interface BackupInfoExtended {
  /** Backup file name */
  fileName: string;
  /** Full path to backup file */
  filePath: string;
  /** Whether the backup is compressed */
  compressed: boolean;
  /** File size in bytes */
  size: number;
  /** Original size before compression (if available) */
  originalSize?: number;
  /** Compression ratio (if available) */
  compressionRatio?: number;
  /** Backup metadata */
  metadata: BackupMetadataExtended;
}

// ==================== Export Types ====================

/**
 * Options for export operations with optional compression.
 *
 * @example
 * ```typescript
 * const options: ExportOptions = {
 *   filter: { entityType: 'person' },
 *   compress: true,
 *   compressionQuality: 11
 * };
 * ```
 */
export interface ExportOptions {
  /** Optional filter criteria for the export */
  filter?: ExportFilter;
  /** Whether to compress the export with brotli (default: false, auto-enabled for >100KB) */
  compress?: boolean;
  /** Brotli quality level 0-11 (default: 6). Higher = better compression but slower. */
  compressionQuality?: number;
}

/**
 * Result of an export operation with compression metadata.
 *
 * Provides the exported content along with compression statistics
 * when compression is applied.
 *
 * @example
 * ```typescript
 * const result: ExportResult = {
 *   format: 'json',
 *   content: 'base64-encoded-data...',
 *   entityCount: 150,
 *   relationCount: 320,
 *   compressed: true,
 *   encoding: 'base64',
 *   originalSize: 125000,
 *   compressedSize: 37500,
 *   compressionRatio: 0.3
 * };
 * ```
 */
export interface ExportResult {
  /** The export format used */
  format: string;
  /** The exported content (string if uncompressed, base64 if compressed) */
  content: string;
  /** Number of entities in the export */
  entityCount: number;
  /** Number of relations in the export */
  relationCount: number;
  /** Whether the content is compressed */
  compressed: boolean;
  /** Content encoding: 'utf-8' for plain text, 'base64' for compressed */
  encoding: 'utf-8' | 'base64';
  /** Original size in bytes before compression */
  originalSize: number;
  /** Size after compression in bytes (same as original if not compressed) */
  compressedSize: number;
  /** Compression ratio (compressedSize / originalSize). Lower is better. */
  compressionRatio: number;
}

// ==================== Archive Types ====================

/**
 * Extended archive result with compression information.
 *
 * Used when archiving entities to compressed storage.
 *
 * @example
 * ```typescript
 * const result: ArchiveResultExtended = {
 *   archived: 50,
 *   entityNames: ['Entity1', 'Entity2', ...],
 *   archivePath: '/path/to/.archives/archive_2024-01-01.jsonl.br',
 *   originalSize: 125000,
 *   compressedSize: 37500,
 *   compressionRatio: 0.3
 * };
 * ```
 */
export interface ArchiveResultExtended {
  /** Number of entities archived */
  archived: number;
  /** Names of archived entities */
  entityNames: string[];
  /** Path to the archive file (if created) */
  archivePath?: string;
  /** Original size of archive data in bytes */
  originalSize?: number;
  /** Compressed size in bytes */
  compressedSize?: number;
  /** Compression ratio (compressedSize / originalSize). Lower is better. */
  compressionRatio?: number;
}

/**
 * Cache compression statistics.
 *
 * Provides information about the compressed cache state for memory optimization.
 */
export interface CacheCompressionStats {
  /** Total number of entries in the cache */
  totalEntries: number;
  /** Number of compressed entries */
  compressedEntries: number;
  /** Number of uncompressed (hot) entries */
  uncompressedEntries: number;
  /** Estimated memory saved by compression in bytes */
  estimatedMemorySaved: number;
}

// ==================== Tag Types ====================

/**
 * Represents a tag alias (synonym) mapping.
 *
 * Tag aliases allow multiple tag names to map to a canonical tag,
 * enabling synonym support and tag normalization.
 *
 * @example
 * ```typescript
 * const alias: TagAlias = {
 *   alias: "dev",
 *   canonical: "developer",
 *   description: "Short form of developer",
 *   createdAt: "2024-01-01T00:00:00Z"
 * };
 * ```
 */
export interface TagAlias {
  /** The alias (synonym) tag name */
  alias: string;

  /** The canonical (official) tag name this maps to */
  canonical: string;

  /** Optional description of the alias relationship */
  description?: string;

  /** ISO 8601 timestamp when alias was created */
  createdAt: string;
}

// ==================== Storage Types ====================

/**
 * Pre-computed lowercase data for search optimization.
 * Avoids repeated toLowerCase() calls during search operations.
 */
export interface LowercaseData {
  /** Entity name in lowercase */
  name: string;
  /** Entity type in lowercase */
  entityType: string;
  /** Array of observations in lowercase */
  observations: string[];
  /** Array of tags in lowercase */
  tags: string[];
}

/**
 * Storage configuration options.
 */
export interface StorageConfig {
  /** Storage type: 'jsonl' or 'sqlite' */
  type: 'jsonl' | 'sqlite';
  /** Path to storage file */
  path: string;
}

/**
 * Interface for graph storage implementations.
 *
 * This abstraction allows for different storage backends:
 * - JSONLStorage (current implementation)
 * - SQLiteStorage (future implementation)
 * - MemoryStorage (for testing)
 *
 * All implementations must maintain the same semantics for
 * data persistence and retrieval.
 */
export interface IGraphStorage {
  // ==================== Read Operations ====================

  /**
   * Load the knowledge graph from storage (read-only access).
   *
   * @returns Promise resolving to read-only knowledge graph reference
   */
  loadGraph(): Promise<ReadonlyKnowledgeGraph>;

  /**
   * Get a mutable copy of the graph for write operations.
   *
   * @returns Promise resolving to mutable knowledge graph copy
   */
  getGraphForMutation(): Promise<KnowledgeGraph>;

  /**
   * Ensure the storage is loaded/initialized.
   *
   * @returns Promise resolving when ready
   */
  ensureLoaded(): Promise<void>;

  // ==================== Write Operations ====================

  /**
   * Save the entire knowledge graph to storage.
   *
   * @param graph - The knowledge graph to save
   * @returns Promise resolving when save is complete
   */
  saveGraph(graph: KnowledgeGraph): Promise<void>;

  /**
   * Append a single entity to storage (O(1) write operation).
   *
   * @param entity - The entity to append
   * @returns Promise resolving when append is complete
   */
  appendEntity(entity: Entity): Promise<void>;

  /**
   * Append a single relation to storage (O(1) write operation).
   *
   * @param relation - The relation to append
   * @returns Promise resolving when append is complete
   */
  appendRelation(relation: Relation): Promise<void>;

  /**
   * Update an entity in storage.
   *
   * @param entityName - Name of the entity to update
   * @param updates - Partial entity updates to apply
   * @returns Promise resolving to true if found and updated
   */
  updateEntity(entityName: string, updates: Partial<Entity>): Promise<boolean>;

  /**
   * Compact the storage by removing duplicates.
   *
   * @returns Promise resolving when compaction is complete
   */
  compact(): Promise<void>;

  /**
   * Clear any in-memory cache.
   */
  clearCache(): void;

  // ==================== Index Operations ====================

  /**
   * Get an entity by name in O(1) time.
   *
   * @param name - Entity name to look up
   * @returns Entity if found, undefined otherwise
   */
  getEntityByName(name: string): Entity | undefined;

  /**
   * Check if an entity exists by name.
   *
   * @param name - Entity name to check
   * @returns True if entity exists
   */
  hasEntity(name: string): boolean;

  /**
   * Get all entities of a given type.
   *
   * @param entityType - Entity type to filter by
   * @returns Array of entities with the given type
   */
  getEntitiesByType(entityType: string): Entity[];

  /**
   * Get all unique entity types in the storage.
   *
   * @returns Array of unique entity types
   */
  getEntityTypes(): string[];

  /**
   * Get pre-computed lowercase data for an entity.
   *
   * @param entityName - Entity name to get lowercase data for
   * @returns LowercaseData if entity exists, undefined otherwise
   */
  getLowercased(entityName: string): LowercaseData | undefined;

  // ==================== Relation Index Operations ====================

  /**
   * Get all relations where the entity is the source (outgoing relations) in O(1) time.
   *
   * @param entityName - Entity name to look up outgoing relations for
   * @returns Array of relations where entity is the source
   */
  getRelationsFrom(entityName: string): Relation[];

  /**
   * Get all relations where the entity is the target (incoming relations) in O(1) time.
   *
   * @param entityName - Entity name to look up incoming relations for
   * @returns Array of relations where entity is the target
   */
  getRelationsTo(entityName: string): Relation[];

  /**
   * Get all relations involving the entity (both incoming and outgoing) in O(1) time.
   *
   * @param entityName - Entity name to look up all relations for
   * @returns Array of all relations involving the entity
   */
  getRelationsFor(entityName: string): Relation[];

  /**
   * Check if an entity has any relations.
   *
   * @param entityName - Entity name to check
   * @returns True if entity has any relations
   */
  hasRelations(entityName: string): boolean;

  // ==================== Utility Operations ====================

  /**
   * Get the storage path/location.
   *
   * @returns The storage path
   */
  getFilePath(): string;

  /**
   * Get the current pending appends count.
   *
   * @returns Number of pending appends since last compaction
   */
  getPendingAppends(): number;
}
