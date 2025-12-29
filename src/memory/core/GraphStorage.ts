/**
 * Graph Storage
 *
 * Handles file I/O operations for the knowledge graph using JSONL format.
 * Provides persistence layer abstraction for graph data.
 *
 * @module core/GraphStorage
 */

import { promises as fs } from 'fs';
import type { KnowledgeGraph, Entity, Relation, ReadonlyKnowledgeGraph } from '../types/index.js';
import { clearAllSearchCaches } from '../utils/searchCache.js';

/**
 * GraphStorage manages persistence of the knowledge graph to disk.
 *
 * Uses JSONL (JSON Lines) format where each line is a separate JSON object
 * representing either an entity or a relation.
 *
 * OPTIMIZED: Implements in-memory caching to avoid repeated disk reads.
 * Cache is invalidated on every write operation to ensure consistency.
 *
 * @example
 * ```typescript
 * const storage = new GraphStorage('/path/to/memory.jsonl');
 * const graph = await storage.loadGraph();
 * graph.entities.push(newEntity);
 * await storage.saveGraph(graph);
 * ```
 */
export class GraphStorage {
  /**
   * In-memory cache of the knowledge graph.
   * Null when cache is empty or invalidated.
   */
  private cache: KnowledgeGraph | null = null;

  /**
   * Number of pending append operations since last compaction.
   * Used to trigger automatic compaction when threshold is reached.
   */
  private pendingAppends: number = 0;

  /**
   * Threshold for automatic compaction.
   * After this many appends, the file is rewritten to remove duplicates.
   */
  private readonly compactionThreshold: number = 100;

  /**
   * Create a new GraphStorage instance.
   *
   * @param memoryFilePath - Absolute path to the JSONL file
   */
  constructor(private memoryFilePath: string) {}

  /**
   * Load the knowledge graph from disk (read-only access).
   *
   * OPTIMIZED: Returns cached reference directly without copying.
   * This is O(1) regardless of graph size. For mutation operations,
   * use getGraphForMutation() instead.
   *
   * @returns Promise resolving to read-only knowledge graph reference
   * @throws Error if file exists but cannot be read or parsed
   */
  async loadGraph(): Promise<ReadonlyKnowledgeGraph> {
    // Return cached graph directly (no copying - O(1))
    if (this.cache !== null) {
      return this.cache;
    }

    // Cache miss - load from disk
    await this.loadFromDisk();
    return this.cache!;
  }

  /**
   * Get a mutable copy of the graph for write operations.
   *
   * Creates deep copies of entity and relation arrays to allow
   * safe mutation without affecting the cached data.
   *
   * @returns Promise resolving to mutable knowledge graph copy
   */
  async getGraphForMutation(): Promise<KnowledgeGraph> {
    await this.ensureLoaded();
    return {
      entities: this.cache!.entities.map(e => ({
        ...e,
        observations: [...e.observations],
        tags: e.tags ? [...e.tags] : undefined,
      })),
      relations: this.cache!.relations.map(r => ({ ...r })),
    };
  }

  /**
   * Ensure the cache is loaded from disk.
   *
   * @returns Promise resolving when cache is populated
   */
  async ensureLoaded(): Promise<void> {
    if (this.cache === null) {
      await this.loadFromDisk();
    }
  }

  /**
   * Internal method to load graph from disk into cache.
   */
  private async loadFromDisk(): Promise<void> {
    try {
      const data = await fs.readFile(this.memoryFilePath, 'utf-8');
      const lines = data.split('\n').filter((line: string) => line.trim() !== '');

      // Use Maps to deduplicate - later entries override earlier ones
      // This supports append-only updates where new versions are appended
      const entityMap = new Map<string, Entity>();
      const relationMap = new Map<string, Relation>();

      for (const line of lines) {
        const item = JSON.parse(line);

        if (item.type === 'entity') {
          // Add createdAt if missing for backward compatibility
          if (!item.createdAt) item.createdAt = new Date().toISOString();
          // Add lastModified if missing for backward compatibility
          if (!item.lastModified) item.lastModified = item.createdAt;

          // Use name as key - later entries override earlier ones
          entityMap.set(item.name, item as Entity);
        }

        if (item.type === 'relation') {
          // Add createdAt if missing for backward compatibility
          if (!item.createdAt) item.createdAt = new Date().toISOString();
          // Add lastModified if missing for backward compatibility
          if (!item.lastModified) item.lastModified = item.createdAt;

          // Use composite key for relations
          const key = `${item.from}:${item.to}:${item.relationType}`;
          relationMap.set(key, item as Relation);
        }
      }

      // Convert maps to arrays
      const graph: KnowledgeGraph = {
        entities: Array.from(entityMap.values()),
        relations: Array.from(relationMap.values()),
      };

      // Populate cache
      this.cache = graph;
    } catch (error) {
      // File doesn't exist - create empty graph
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        this.cache = { entities: [], relations: [] };
        return;
      }
      throw error;
    }
  }

  /**
   * Save the knowledge graph to disk.
   *
   * OPTIMIZED: Updates cache directly after write to avoid re-reading.
   *
   * Writes the graph to JSONL format, with one JSON object per line.
   *
   * @param graph - The knowledge graph to save
   * @returns Promise resolving when save is complete
   * @throws Error if file cannot be written
   */
  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    const lines = [
      ...graph.entities.map(e => {
        const entityData: any = {
          type: 'entity',
          name: e.name,
          entityType: e.entityType,
          observations: e.observations,
          createdAt: e.createdAt,
          lastModified: e.lastModified,
        };

        // Only include optional fields if they exist
        if (e.tags !== undefined) entityData.tags = e.tags;
        if (e.importance !== undefined) entityData.importance = e.importance;
        if (e.parentId !== undefined) entityData.parentId = e.parentId;

        return JSON.stringify(entityData);
      }),
      ...graph.relations.map(r =>
        JSON.stringify({
          type: 'relation',
          from: r.from,
          to: r.to,
          relationType: r.relationType,
          createdAt: r.createdAt,
          lastModified: r.lastModified,
        })
      ),
    ];

    await fs.writeFile(this.memoryFilePath, lines.join('\n'));

    // Update cache directly with the saved graph (avoid re-reading from disk)
    this.cache = graph;

    // Reset pending appends since file is now clean
    this.pendingAppends = 0;

    // Clear all search caches since graph data has changed
    clearAllSearchCaches();
  }

  /**
   * Append a single entity to the file (O(1) write operation).
   *
   * OPTIMIZED: Uses file append instead of full rewrite.
   * Updates cache in-place and triggers compaction when threshold is reached.
   *
   * @param entity - The entity to append
   * @returns Promise resolving when append is complete
   */
  async appendEntity(entity: Entity): Promise<void> {
    await this.ensureLoaded();

    const entityData: Record<string, unknown> = {
      type: 'entity',
      name: entity.name,
      entityType: entity.entityType,
      observations: entity.observations,
      createdAt: entity.createdAt,
      lastModified: entity.lastModified,
    };

    // Only include optional fields if they exist
    if (entity.tags !== undefined) entityData.tags = entity.tags;
    if (entity.importance !== undefined) entityData.importance = entity.importance;
    if (entity.parentId !== undefined) entityData.parentId = entity.parentId;

    const line = JSON.stringify(entityData);

    // Append to file (prepend newline if file exists and has content)
    try {
      const stat = await fs.stat(this.memoryFilePath);
      if (stat.size > 0) {
        await fs.appendFile(this.memoryFilePath, '\n' + line);
      } else {
        await fs.writeFile(this.memoryFilePath, line);
      }
    } catch (error) {
      // File doesn't exist - create it
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        await fs.writeFile(this.memoryFilePath, line);
      } else {
        throw error;
      }
    }

    // Update cache in-place
    this.cache!.entities.push(entity);
    this.pendingAppends++;

    // Clear search caches
    clearAllSearchCaches();

    // Trigger compaction if threshold reached
    if (this.pendingAppends >= this.compactionThreshold) {
      await this.compact();
    }
  }

  /**
   * Append a single relation to the file (O(1) write operation).
   *
   * OPTIMIZED: Uses file append instead of full rewrite.
   * Updates cache in-place and triggers compaction when threshold is reached.
   *
   * @param relation - The relation to append
   * @returns Promise resolving when append is complete
   */
  async appendRelation(relation: Relation): Promise<void> {
    await this.ensureLoaded();

    const line = JSON.stringify({
      type: 'relation',
      from: relation.from,
      to: relation.to,
      relationType: relation.relationType,
      createdAt: relation.createdAt,
      lastModified: relation.lastModified,
    });

    // Append to file (prepend newline if file exists and has content)
    try {
      const stat = await fs.stat(this.memoryFilePath);
      if (stat.size > 0) {
        await fs.appendFile(this.memoryFilePath, '\n' + line);
      } else {
        await fs.writeFile(this.memoryFilePath, line);
      }
    } catch (error) {
      // File doesn't exist - create it
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        await fs.writeFile(this.memoryFilePath, line);
      } else {
        throw error;
      }
    }

    // Update cache in-place
    this.cache!.relations.push(relation);
    this.pendingAppends++;

    // Clear search caches
    clearAllSearchCaches();

    // Trigger compaction if threshold reached
    if (this.pendingAppends >= this.compactionThreshold) {
      await this.compact();
    }
  }

  /**
   * Compact the file by rewriting it with only current cache contents.
   *
   * Removes duplicate entries and cleans up the file.
   * Resets pending appends counter.
   *
   * @returns Promise resolving when compaction is complete
   */
  async compact(): Promise<void> {
    if (this.cache === null) {
      return;
    }

    // Rewrite file with current cache (removes duplicates/updates)
    await this.saveGraph(this.cache);
    this.pendingAppends = 0;
  }

  /**
   * Get the current pending appends count.
   *
   * Useful for testing compaction behavior.
   *
   * @returns Number of pending appends since last compaction
   */
  getPendingAppends(): number {
    return this.pendingAppends;
  }

  /**
   * Update an entity in-place in the cache and append to file.
   *
   * OPTIMIZED: Modifies cache directly and appends updated version to file.
   * Does not rewrite the entire file - compaction handles deduplication later.
   *
   * @param entityName - Name of the entity to update
   * @param updates - Partial entity updates to apply
   * @returns Promise resolving to true if entity was found and updated, false otherwise
   */
  async updateEntity(entityName: string, updates: Partial<Entity>): Promise<boolean> {
    await this.ensureLoaded();

    const entityIndex = this.cache!.entities.findIndex(e => e.name === entityName);
    if (entityIndex === -1) {
      return false;
    }

    // Update cache in-place
    const entity = this.cache!.entities[entityIndex];
    Object.assign(entity, updates);
    entity.lastModified = new Date().toISOString();

    // Append updated version to file
    const entityData: Record<string, unknown> = {
      type: 'entity',
      name: entity.name,
      entityType: entity.entityType,
      observations: entity.observations,
      createdAt: entity.createdAt,
      lastModified: entity.lastModified,
    };

    if (entity.tags !== undefined) entityData.tags = entity.tags;
    if (entity.importance !== undefined) entityData.importance = entity.importance;
    if (entity.parentId !== undefined) entityData.parentId = entity.parentId;

    const line = JSON.stringify(entityData);

    // Append to file
    try {
      const stat = await fs.stat(this.memoryFilePath);
      if (stat.size > 0) {
        await fs.appendFile(this.memoryFilePath, '\n' + line);
      } else {
        await fs.writeFile(this.memoryFilePath, line);
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        await fs.writeFile(this.memoryFilePath, line);
      } else {
        throw error;
      }
    }

    this.pendingAppends++;

    // Clear search caches
    clearAllSearchCaches();

    // Trigger compaction if threshold reached
    if (this.pendingAppends >= this.compactionThreshold) {
      await this.compact();
    }

    return true;
  }

  /**
   * Manually clear the cache.
   *
   * Useful for testing or when external processes modify the file.
   *
   * @returns void
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Get the file path being used for storage.
   *
   * @returns The memory file path
   */
  getFilePath(): string {
    return this.memoryFilePath;
  }
}
