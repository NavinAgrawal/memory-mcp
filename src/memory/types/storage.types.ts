/**
 * Storage Types
 *
 * Type definitions for the storage abstraction layer.
 * Enables swappable storage backends (JSONL, SQLite, etc.)
 *
 * @module types/storage.types
 */

import type { Entity, Relation, KnowledgeGraph, ReadonlyKnowledgeGraph } from './entity.types.js';

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
