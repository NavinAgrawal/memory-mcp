/**
 * Import/Export Types
 *
 * Type definitions for import and export operations, including
 * result summaries and compression results.
 */

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
