/**
 * Search Types
 *
 * Type definitions for search operations, including search results,
 * saved searches, and boolean query AST structures.
 */

import type { Entity } from './entity.types.js';

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
