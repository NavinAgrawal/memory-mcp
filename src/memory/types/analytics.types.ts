/**
 * Analytics Types
 *
 * Type definitions for graph statistics, validation reports, and analytics data.
 */

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
 *   entityDateRange: { earliest: "2024-01-01T00:00:00Z", latest: "2024-12-31T23:59:59Z" }
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
 *   errors: [
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
  /** True if graph has no errors (warnings are acceptable) */
  isValid: boolean;

  /** Array of critical errors found */
  errors: ValidationError[];

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
 * Represents a critical error found during graph validation.
 */
export interface ValidationError {
  /** Type of error */
  type: 'orphaned_relation' | 'duplicate_entity' | 'invalid_data';

  /** Human-readable error message */
  message: string;

  /** Additional details about the error */
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
