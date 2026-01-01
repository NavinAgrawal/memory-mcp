/**
 * Entity Manager
 *
 * Handles CRUD operations for entities in the knowledge graph.
 * Also includes archive functionality (merged from ArchiveManager in Sprint 11.3).
 *
 * @module core/EntityManager
 */

import type { Entity } from '../types/index.js';
import type { GraphStorage } from './GraphStorage.js';
import { EntityNotFoundError, InvalidImportanceError, ValidationError, CycleDetectedError } from '../utils/errors.js';
import type { KnowledgeGraph, ReadonlyKnowledgeGraph } from '../types/index.js';
import { BatchCreateEntitiesSchema, UpdateEntitySchema, EntityNamesSchema } from '../utils/index.js';
import { GRAPH_LIMITS } from '../utils/constants.js';

/**
 * Criteria for archiving entities.
 */
export interface ArchiveCriteria {
  /** Entities older than this date (ISO 8601) */
  olderThan?: string;
  /** Entities with importance less than this value */
  importanceLessThan?: number;
  /** Entities with any of these tags */
  tags?: string[];
}

/**
 * Result of archive operation.
 */
export interface ArchiveResult {
  /** Number of entities archived */
  archived: number;
  /** Names of archived entities */
  entityNames: string[];
}

/**
 * Minimum importance value (least important).
 */
export const MIN_IMPORTANCE = 0;

/**
 * Maximum importance value (most important).
 */
export const MAX_IMPORTANCE = 10;

/**
 * Manages entity operations with automatic timestamp handling.
 */
export class EntityManager {
  constructor(private storage: GraphStorage) {}

  /**
   * Create multiple entities in a single batch operation.
   *
   * This method performs the following operations:
   * - Filters out entities that already exist (duplicate names)
   * - Automatically adds createdAt and lastModified timestamps
   * - Normalizes all tags to lowercase for consistent searching
   * - Validates importance values (must be between 0-10)
   *
   * @param entities - Array of entities to create. Each entity must have a unique name.
   * @returns Promise resolving to array of newly created entities (excludes duplicates)
   * @throws {InvalidImportanceError} If any entity has importance outside the valid range [0-10]
   *
   * @example
   * ```typescript
   * const manager = new EntityManager(storage);
   *
   * // Create single entity
   * const results = await manager.createEntities([{
   *   name: 'Alice',
   *   entityType: 'person',
   *   observations: ['Works as engineer', 'Lives in Seattle'],
   *   importance: 7,
   *   tags: ['Team', 'Engineering']
   * }]);
   *
   * // Create multiple entities at once
   * const users = await manager.createEntities([
   *   { name: 'Bob', entityType: 'person', observations: [] },
   *   { name: 'Charlie', entityType: 'person', observations: [] }
   * ]);
   * ```
   */
  async createEntities(entities: Entity[]): Promise<Entity[]> {
    // Validate input
    const validation = BatchCreateEntitiesSchema.safeParse(entities);
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
      throw new ValidationError('Invalid entity data', errors);
    }

    // Use read-only graph for checking existing entities
    const readGraph = await this.storage.loadGraph();
    const timestamp = new Date().toISOString();

    // Check graph size limits
    const entitiesToAdd = entities.filter(e => !readGraph.entities.some(existing => existing.name === e.name));
    if (readGraph.entities.length + entitiesToAdd.length > GRAPH_LIMITS.MAX_ENTITIES) {
      throw new ValidationError(
        'Graph size limit exceeded',
        [`Adding ${entitiesToAdd.length} entities would exceed maximum of ${GRAPH_LIMITS.MAX_ENTITIES} entities`]
      );
    }

    const newEntities = entitiesToAdd
      .map(e => {
        const entity: Entity = {
          ...e,
          createdAt: e.createdAt || timestamp,
          lastModified: e.lastModified || timestamp,
        };

        // Normalize tags to lowercase
        if (e.tags) {
          entity.tags = e.tags.map(tag => tag.toLowerCase());
        }

        // Validate importance
        if (e.importance !== undefined) {
          if (e.importance < MIN_IMPORTANCE || e.importance > MAX_IMPORTANCE) {
            throw new InvalidImportanceError(e.importance, MIN_IMPORTANCE, MAX_IMPORTANCE);
          }
          entity.importance = e.importance;
        }

        return entity;
      });

    // OPTIMIZED: Use append for single entity, bulk save for multiple
    // (N individual appends is slower than one bulk write)
    if (newEntities.length === 1) {
      await this.storage.appendEntity(newEntities[0]);
    } else if (newEntities.length > 1) {
      const graph = await this.storage.getGraphForMutation();
      graph.entities.push(...newEntities);
      await this.storage.saveGraph(graph);
    }

    return newEntities;
  }

  /**
   * Delete multiple entities by name in a single batch operation.
   *
   * This method performs cascading deletion:
   * - Removes all specified entities from the graph
   * - Automatically removes all relations where these entities are source or target
   * - Silently ignores entity names that don't exist (no error thrown)
   *
   * @param entityNames - Array of entity names to delete
   * @returns Promise that resolves when deletion is complete
   *
   * @example
   * ```typescript
   * const manager = new EntityManager(storage);
   *
   * // Delete single entity
   * await manager.deleteEntities(['Alice']);
   *
   * // Delete multiple entities at once
   * await manager.deleteEntities(['Bob', 'Charlie', 'Dave']);
   *
   * // Safe to delete non-existent entities (no error)
   * await manager.deleteEntities(['NonExistent']); // No error thrown
   * ```
   */
  async deleteEntities(entityNames: string[]): Promise<void> {
    // Validate input
    const validation = EntityNamesSchema.safeParse(entityNames);
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
      throw new ValidationError('Invalid entity names', errors);
    }

    const graph = await this.storage.getGraphForMutation();

    graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
    graph.relations = graph.relations.filter(
      r => !entityNames.includes(r.from) && !entityNames.includes(r.to)
    );

    await this.storage.saveGraph(graph);
  }

  /**
   * Retrieve a single entity by its unique name.
   *
   * This is a read-only operation that does not modify the graph.
   * Entity names are case-sensitive.
   *
   * @param name - The unique name of the entity to retrieve
   * @returns Promise resolving to the Entity object if found, or null if not found
   *
   * @example
   * ```typescript
   * const manager = new EntityManager(storage);
   *
   * // Get an existing entity
   * const alice = await manager.getEntity('Alice');
   * if (alice) {
   *   console.log(alice.observations);
   *   console.log(alice.importance);
   * }
   *
   * // Handle non-existent entity
   * const missing = await manager.getEntity('NonExistent');
   * console.log(missing); // null
   * ```
   */
  async getEntity(name: string): Promise<Entity | null> {
    const graph = await this.storage.loadGraph();
    return graph.entities.find(e => e.name === name) || null;
  }

  /**
   * Update one or more fields of an existing entity.
   *
   * This method allows partial updates - only the fields specified in the updates
   * object will be changed. All other fields remain unchanged.
   * The lastModified timestamp is automatically updated.
   *
   * @param name - The unique name of the entity to update
   * @param updates - Partial entity object containing only the fields to update
   * @returns Promise resolving to the fully updated Entity object
   * @throws {EntityNotFoundError} If no entity with the given name exists
   *
   * @example
   * ```typescript
   * const manager = new EntityManager(storage);
   *
   * // Update importance only
   * const updated = await manager.updateEntity('Alice', {
   *   importance: 9
   * });
   *
   * // Update multiple fields
   * await manager.updateEntity('Bob', {
   *   entityType: 'senior_engineer',
   *   tags: ['leadership', 'architecture'],
   *   observations: ['Led project X', 'Designed system Y']
   * });
   *
   * // Add observations (requires reading existing entity first)
   * const entity = await manager.getEntity('Charlie');
   * if (entity) {
   *   await manager.updateEntity('Charlie', {
   *     observations: [...entity.observations, 'New observation']
   *   });
   * }
   * ```
   */
  async updateEntity(name: string, updates: Partial<Entity>): Promise<Entity> {
    // Validate input
    const validation = UpdateEntitySchema.safeParse(updates);
    if (!validation.success) {
      const errors = validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
      throw new ValidationError('Invalid update data', errors);
    }

    const graph = await this.storage.getGraphForMutation();
    const entity = graph.entities.find(e => e.name === name);

    if (!entity) {
      throw new EntityNotFoundError(name);
    }

    // Apply updates
    Object.assign(entity, updates);
    entity.lastModified = new Date().toISOString();

    await this.storage.saveGraph(graph);
    return entity;
  }

  /**
   * Update multiple entities in a single batch operation.
   *
   * This method is more efficient than calling updateEntity multiple times
   * as it loads and saves the graph only once. All updates are applied atomically.
   * The lastModified timestamp is automatically updated for all entities.
   *
   * @param updates - Array of updates, each containing entity name and changes
   * @returns Promise resolving to array of updated entities
   * @throws {EntityNotFoundError} If any entity is not found
   * @throws {ValidationError} If any update data is invalid
   *
   * @example
   * ```typescript
   * const manager = new EntityManager(storage);
   *
   * // Update multiple entities at once
   * const updated = await manager.batchUpdate([
   *   { name: 'Alice', updates: { importance: 9 } },
   *   { name: 'Bob', updates: { importance: 8, tags: ['senior'] } },
   *   { name: 'Charlie', updates: { entityType: 'lead_engineer' } }
   * ]);
   *
   * console.log(`Updated ${updated.length} entities`);
   *
   * // Efficiently update many entities (single graph load/save)
   * const massUpdate = employees.map(name => ({
   *   name,
   *   updates: { tags: ['team-2024'] }
   * }));
   * await manager.batchUpdate(massUpdate);
   * ```
   */
  async batchUpdate(
    updates: Array<{ name: string; updates: Partial<Entity> }>
  ): Promise<Entity[]> {
    // Validate all updates first
    for (const { updates: updateData } of updates) {
      const validation = UpdateEntitySchema.safeParse(updateData);
      if (!validation.success) {
        const errors = validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
        throw new ValidationError('Invalid update data', errors);
      }
    }

    const graph = await this.storage.getGraphForMutation();
    const timestamp = new Date().toISOString();
    const updatedEntities: Entity[] = [];

    for (const { name, updates: updateData } of updates) {
      const entity = graph.entities.find(e => e.name === name);

      if (!entity) {
        throw new EntityNotFoundError(name);
      }

      // Apply updates
      Object.assign(entity, updateData);
      entity.lastModified = timestamp;
      updatedEntities.push(entity);
    }

    await this.storage.saveGraph(graph);
    return updatedEntities;
  }

  /**
   * Add observations to multiple entities in a single batch operation.
   *
   * This method performs the following operations:
   * - Adds new observations to specified entities
   * - Filters out duplicate observations (already present)
   * - Updates lastModified timestamp only if new observations were added
   *
   * @param observations - Array of entity names and observations to add
   * @returns Promise resolving to array of results showing which observations were added
   * @throws {EntityNotFoundError} If any entity is not found
   *
   * @example
   * ```typescript
   * const manager = new EntityManager(storage);
   *
   * // Add observations to multiple entities
   * const results = await manager.addObservations([
   *   { entityName: 'Alice', contents: ['Completed project X', 'Started project Y'] },
   *   { entityName: 'Bob', contents: ['Joined team meeting'] }
   * ]);
   *
   * // Check what was added (duplicates are filtered out)
   * results.forEach(r => {
   *   console.log(`${r.entityName}: added ${r.addedObservations.length} new observations`);
   * });
   * ```
   */
  async addObservations(
    observations: { entityName: string; contents: string[] }[]
  ): Promise<{ entityName: string; addedObservations: string[] }[]> {
    // Use read-only graph for validation
    const readGraph = await this.storage.loadGraph();
    const results: { entityName: string; addedObservations: string[] }[] = [];

    for (const o of observations) {
      const entity = readGraph.entities.find(e => e.name === o.entityName);
      if (!entity) {
        throw new EntityNotFoundError(o.entityName);
      }

      const newObservations = o.contents.filter(content => !entity.observations.includes(content));

      if (newObservations.length > 0) {
        // OPTIMIZED: Use updateEntity for in-place update + append
        const updatedObservations = [...entity.observations, ...newObservations];
        await this.storage.updateEntity(o.entityName, { observations: updatedObservations });
      }

      results.push({ entityName: o.entityName, addedObservations: newObservations });
    }

    return results;
  }

  /**
   * Delete observations from multiple entities in a single batch operation.
   *
   * This method performs the following operations:
   * - Removes specified observations from entities
   * - Updates lastModified timestamp only if observations were deleted
   * - Silently ignores entities that don't exist (no error thrown)
   *
   * @param deletions - Array of entity names and observations to delete
   * @returns Promise that resolves when deletion is complete
   *
   * @example
   * ```typescript
   * const manager = new EntityManager(storage);
   *
   * // Delete observations from multiple entities
   * await manager.deleteObservations([
   *   { entityName: 'Alice', observations: ['Old observation 1', 'Old observation 2'] },
   *   { entityName: 'Bob', observations: ['Outdated info'] }
   * ]);
   *
   * // Safe to delete from non-existent entities (no error)
   * await manager.deleteObservations([
   *   { entityName: 'NonExistent', observations: ['Some text'] }
   * ]); // No error thrown
   * ```
   */
  async deleteObservations(
    deletions: { entityName: string; observations: string[] }[]
  ): Promise<void> {
    const graph = await this.storage.getGraphForMutation();
    const timestamp = new Date().toISOString();

    deletions.forEach(d => {
      const entity = graph.entities.find(e => e.name === d.entityName);
      if (entity) {
        const originalLength = entity.observations.length;
        entity.observations = entity.observations.filter(o => !d.observations.includes(o));

        // Update lastModified timestamp if observations were deleted
        if (entity.observations.length < originalLength) {
          entity.lastModified = timestamp;
        }
      }
    });

    await this.storage.saveGraph(graph);
  }

  /**
   * Add tags to an entity.
   *
   * Tags are normalized to lowercase and duplicates are filtered out.
   *
   * @param entityName - Name of the entity
   * @param tags - Tags to add
   * @returns Result with entity name and added tags
   * @throws {EntityNotFoundError} If entity is not found
   */
  async addTags(entityName: string, tags: string[]): Promise<{ entityName: string; addedTags: string[] }> {
    // Check entity exists using read-only graph
    const readGraph = await this.storage.loadGraph();
    const entity = readGraph.entities.find(e => e.name === entityName);
    if (!entity) {
      throw new EntityNotFoundError(entityName);
    }

    // Initialize tags array if it doesn't exist
    const existingTags = entity.tags || [];

    // Normalize tags to lowercase and filter out duplicates
    const normalizedTags = tags.map(tag => tag.toLowerCase());
    const newTags = normalizedTags.filter(tag => !existingTags.includes(tag));

    if (newTags.length > 0) {
      // OPTIMIZED: Use updateEntity for in-place update + append
      await this.storage.updateEntity(entityName, { tags: [...existingTags, ...newTags] });
    }

    return { entityName, addedTags: newTags };
  }

  /**
   * Remove tags from an entity.
   *
   * @param entityName - Name of the entity
   * @param tags - Tags to remove
   * @returns Result with entity name and removed tags
   * @throws {EntityNotFoundError} If entity is not found
   */
  async removeTags(entityName: string, tags: string[]): Promise<{ entityName: string; removedTags: string[] }> {
    const graph = await this.storage.getGraphForMutation();
    const timestamp = new Date().toISOString();

    const entity = graph.entities.find(e => e.name === entityName);
    if (!entity) {
      throw new EntityNotFoundError(entityName);
    }

    if (!entity.tags) {
      return { entityName, removedTags: [] };
    }

    // Normalize tags to lowercase
    const normalizedTags = tags.map(tag => tag.toLowerCase());
    const originalLength = entity.tags.length;

    // Capture existing tags (lowercase) BEFORE filtering to accurately track removals
    const existingTagsLower = entity.tags.map(t => t.toLowerCase());

    // Filter out the tags to remove
    entity.tags = entity.tags.filter(tag => !normalizedTags.includes(tag.toLowerCase()));

    // A tag was removed if it existed in the original tags
    const removedTags = normalizedTags.filter(tag => existingTagsLower.includes(tag));

    // Update lastModified timestamp if tags were removed
    if (entity.tags.length < originalLength) {
      entity.lastModified = timestamp;
    }

    await this.storage.saveGraph(graph);

    return { entityName, removedTags };
  }

  /**
   * Set importance level for an entity.
   *
   * @param entityName - Name of the entity
   * @param importance - Importance level (0-10)
   * @returns Result with entity name and importance
   * @throws {EntityNotFoundError} If entity is not found
   * @throws {Error} If importance is out of range
   */
  async setImportance(entityName: string, importance: number): Promise<{ entityName: string; importance: number }> {
    // Validate importance range (0-10)
    if (importance < 0 || importance > 10) {
      throw new Error(`Importance must be between 0 and 10, got ${importance}`);
    }

    // Check entity exists using read-only graph
    const readGraph = await this.storage.loadGraph();
    const entity = readGraph.entities.find(e => e.name === entityName);
    if (!entity) {
      throw new EntityNotFoundError(entityName);
    }

    // OPTIMIZED: Use updateEntity for in-place update + append
    await this.storage.updateEntity(entityName, { importance });

    return { entityName, importance };
  }

  /**
   * Add tags to multiple entities in a single operation.
   *
   * @param entityNames - Names of entities to tag
   * @param tags - Tags to add to each entity
   * @returns Array of results showing which tags were added to each entity
   */
  async addTagsToMultipleEntities(entityNames: string[], tags: string[]): Promise<{ entityName: string; addedTags: string[] }[]> {
    const graph = await this.storage.getGraphForMutation();
    const timestamp = new Date().toISOString();
    const normalizedTags = tags.map(tag => tag.toLowerCase());
    const results: { entityName: string; addedTags: string[] }[] = [];

    for (const entityName of entityNames) {
      const entity = graph.entities.find(e => e.name === entityName);
      if (!entity) {
        continue; // Skip non-existent entities
      }

      // Initialize tags array if it doesn't exist
      if (!entity.tags) {
        entity.tags = [];
      }

      // Filter out duplicates
      const newTags = normalizedTags.filter(tag => !entity.tags!.includes(tag));
      entity.tags.push(...newTags);

      // Update lastModified timestamp if tags were added
      if (newTags.length > 0) {
        entity.lastModified = timestamp;
      }

      results.push({ entityName, addedTags: newTags });
    }

    await this.storage.saveGraph(graph);
    return results;
  }

  /**
   * Replace a tag with a new tag across all entities (rename tag).
   *
   * @param oldTag - Tag to replace
   * @param newTag - New tag value
   * @returns Result with affected entities and count
   */
  async replaceTag(oldTag: string, newTag: string): Promise<{ affectedEntities: string[]; count: number }> {
    const graph = await this.storage.getGraphForMutation();
    const timestamp = new Date().toISOString();
    const normalizedOldTag = oldTag.toLowerCase();
    const normalizedNewTag = newTag.toLowerCase();
    const affectedEntities: string[] = [];

    for (const entity of graph.entities) {
      if (!entity.tags || !entity.tags.includes(normalizedOldTag)) {
        continue;
      }

      // Replace old tag with new tag
      const index = entity.tags.indexOf(normalizedOldTag);
      entity.tags[index] = normalizedNewTag;
      entity.lastModified = timestamp;
      affectedEntities.push(entity.name);
    }

    await this.storage.saveGraph(graph);
    return { affectedEntities, count: affectedEntities.length };
  }

  /**
   * Merge two tags into one target tag across all entities.
   *
   * Combines tag1 and tag2 into targetTag. Any entity with either tag1 or tag2
   * will have both removed and targetTag added (if not already present).
   *
   * @param tag1 - First tag to merge
   * @param tag2 - Second tag to merge
   * @param targetTag - Target tag to merge into
   * @returns Object with affected entity names and count
   */
  async mergeTags(tag1: string, tag2: string, targetTag: string): Promise<{ affectedEntities: string[]; count: number }> {
    const graph = await this.storage.getGraphForMutation();
    const timestamp = new Date().toISOString();
    const normalizedTag1 = tag1.toLowerCase();
    const normalizedTag2 = tag2.toLowerCase();
    const normalizedTargetTag = targetTag.toLowerCase();
    const affectedEntities: string[] = [];

    for (const entity of graph.entities) {
      if (!entity.tags) {
        continue;
      }

      const hasTag1 = entity.tags.includes(normalizedTag1);
      const hasTag2 = entity.tags.includes(normalizedTag2);

      if (!hasTag1 && !hasTag2) {
        continue;
      }

      // Remove both tags
      entity.tags = entity.tags.filter(tag => tag !== normalizedTag1 && tag !== normalizedTag2);

      // Add target tag if not already present
      if (!entity.tags.includes(normalizedTargetTag)) {
        entity.tags.push(normalizedTargetTag);
      }

      entity.lastModified = timestamp;
      affectedEntities.push(entity.name);
    }

    await this.storage.saveGraph(graph);
    return { affectedEntities, count: affectedEntities.length };
  }

  // ============================================================
  // HIERARCHY OPERATIONS
  // ============================================================

  /**
   * Set the parent of an entity.
   *
   * Validates:
   * - Entity and parent exist
   * - Setting parent won't create a cycle
   *
   * @param entityName - Entity to set parent for
   * @param parentName - Parent entity name (null to remove parent)
   * @returns Updated entity
   * @throws {EntityNotFoundError} If entity or parent not found
   * @throws {CycleDetectedError} If setting parent would create a cycle
   */
  async setEntityParent(entityName: string, parentName: string | null): Promise<Entity> {
    // Use read-only graph for validation checks
    const readGraph = await this.storage.loadGraph();
    const entityExists = readGraph.entities.find(e => e.name === entityName);

    if (!entityExists) {
      throw new EntityNotFoundError(entityName);
    }

    // If setting a parent, validate it exists and doesn't create a cycle
    if (parentName !== null) {
      const parent = readGraph.entities.find(e => e.name === parentName);
      if (!parent) {
        throw new EntityNotFoundError(parentName);
      }

      // Check for cycles
      if (this.wouldCreateCycle(readGraph, entityName, parentName)) {
        throw new CycleDetectedError(entityName, parentName);
      }
    }

    // Get mutable copy for write operation
    const graph = await this.storage.getGraphForMutation();
    const entity = graph.entities.find(e => e.name === entityName)!;
    entity.parentId = parentName || undefined;
    entity.lastModified = new Date().toISOString();

    await this.storage.saveGraph(graph);
    return entity;
  }

  /**
   * Check if setting a parent would create a cycle in the hierarchy.
   *
   * @param graph - Knowledge graph
   * @param entityName - Entity to set parent for
   * @param parentName - Proposed parent
   * @returns True if cycle would be created
   */
  private wouldCreateCycle(
    graph: ReadonlyKnowledgeGraph,
    entityName: string,
    parentName: string
  ): boolean {
    const visited = new Set<string>();
    let current: string | undefined = parentName;

    while (current) {
      if (visited.has(current)) {
        return true; // Cycle detected in existing hierarchy
      }
      if (current === entityName) {
        return true; // Would create a cycle
      }
      visited.add(current);

      const currentEntity = graph.entities.find(e => e.name === current);
      current = currentEntity?.parentId;
    }

    return false;
  }

  /**
   * Get the immediate children of an entity.
   *
   * @param entityName - Parent entity name
   * @returns Array of child entities
   * @throws {EntityNotFoundError} If entity not found
   */
  async getChildren(entityName: string): Promise<Entity[]> {
    const graph = await this.storage.loadGraph();

    // Verify entity exists
    if (!graph.entities.find(e => e.name === entityName)) {
      throw new EntityNotFoundError(entityName);
    }

    return graph.entities.filter(e => e.parentId === entityName);
  }

  /**
   * Get the parent of an entity.
   *
   * @param entityName - Entity name
   * @returns Parent entity or null if no parent
   * @throws {EntityNotFoundError} If entity not found
   */
  async getParent(entityName: string): Promise<Entity | null> {
    const graph = await this.storage.loadGraph();
    const entity = graph.entities.find(e => e.name === entityName);

    if (!entity) {
      throw new EntityNotFoundError(entityName);
    }

    if (!entity.parentId) {
      return null;
    }

    const parent = graph.entities.find(e => e.name === entity.parentId);
    return parent || null;
  }

  /**
   * Get all ancestors of an entity (parent, grandparent, etc.).
   *
   * @param entityName - Entity name
   * @returns Array of ancestor entities (ordered from immediate parent to root)
   * @throws {EntityNotFoundError} If entity not found
   */
  async getAncestors(entityName: string): Promise<Entity[]> {
    const graph = await this.storage.loadGraph();
    const ancestors: Entity[] = [];

    let current = graph.entities.find(e => e.name === entityName);
    if (!current) {
      throw new EntityNotFoundError(entityName);
    }

    while (current.parentId) {
      const parent = graph.entities.find(e => e.name === current!.parentId);
      if (!parent) break;
      ancestors.push(parent);
      current = parent;
    }

    return ancestors;
  }

  /**
   * Get all descendants of an entity (children, grandchildren, etc.).
   *
   * Uses breadth-first traversal.
   *
   * @param entityName - Entity name
   * @returns Array of descendant entities
   * @throws {EntityNotFoundError} If entity not found
   */
  async getDescendants(entityName: string): Promise<Entity[]> {
    const graph = await this.storage.loadGraph();

    // Verify entity exists
    if (!graph.entities.find(e => e.name === entityName)) {
      throw new EntityNotFoundError(entityName);
    }

    const descendants: Entity[] = [];
    const toProcess = [entityName];

    while (toProcess.length > 0) {
      const current = toProcess.shift()!;
      const children = graph.entities.filter(e => e.parentId === current);

      for (const child of children) {
        descendants.push(child);
        toProcess.push(child.name);
      }
    }

    return descendants;
  }

  /**
   * Get the entire subtree rooted at an entity (entity + all descendants).
   *
   * Includes relations between entities in the subtree.
   *
   * @param entityName - Root entity name
   * @returns Knowledge graph containing subtree
   * @throws {EntityNotFoundError} If entity not found
   */
  async getSubtree(entityName: string): Promise<KnowledgeGraph> {
    const graph = await this.storage.loadGraph();
    const entity = graph.entities.find(e => e.name === entityName);

    if (!entity) {
      throw new EntityNotFoundError(entityName);
    }

    const descendants = await this.getDescendants(entityName);
    const subtreeEntities = [entity, ...descendants];
    const subtreeEntityNames = new Set(subtreeEntities.map(e => e.name));

    // Include relations between entities in the subtree
    const subtreeRelations = graph.relations.filter(
      r => subtreeEntityNames.has(r.from) && subtreeEntityNames.has(r.to)
    );

    return {
      entities: subtreeEntities,
      relations: subtreeRelations,
    };
  }

  /**
   * Get root entities (entities with no parent).
   *
   * @returns Array of root entities
   */
  async getRootEntities(): Promise<Entity[]> {
    const graph = await this.storage.loadGraph();
    return graph.entities.filter(e => !e.parentId);
  }

  /**
   * Get the depth of an entity in the hierarchy.
   *
   * Root entities have depth 0, their children depth 1, etc.
   *
   * @param entityName - Entity name
   * @returns Depth (number of ancestors)
   * @throws {EntityNotFoundError} If entity not found
   */
  async getEntityDepth(entityName: string): Promise<number> {
    const ancestors = await this.getAncestors(entityName);
    return ancestors.length;
  }

  /**
   * Move an entity to a new parent (maintaining its descendants).
   *
   * Alias for setEntityParent.
   *
   * @param entityName - Entity to move
   * @param newParentName - New parent name (null to make root)
   * @returns Updated entity
   */
  async moveEntity(entityName: string, newParentName: string | null): Promise<Entity> {
    return await this.setEntityParent(entityName, newParentName);
  }

  // ============================================================
  // ARCHIVE OPERATIONS (merged from ArchiveManager, Sprint 11.3)
  // ============================================================

  /**
   * Archive old or low-importance entities.
   *
   * Entities matching ANY of the criteria are archived:
   * - lastModified older than olderThan date
   * - importance less than importanceLessThan
   * - has at least one tag from tags array
   *
   * Archived entities and their relations are removed from the graph.
   *
   * @param criteria - Archiving criteria
   * @param dryRun - If true, preview what would be archived without making changes
   * @returns Archive result with count and entity names
   */
  async archiveEntities(criteria: ArchiveCriteria, dryRun: boolean = false): Promise<ArchiveResult> {
    // Use read-only graph for analysis
    const readGraph = await this.storage.loadGraph();
    const toArchive: Entity[] = [];

    for (const entity of readGraph.entities) {
      let shouldArchive = false;

      // Check age criteria
      if (criteria.olderThan && entity.lastModified) {
        const entityDate = new Date(entity.lastModified);
        const cutoffDate = new Date(criteria.olderThan);
        if (entityDate < cutoffDate) {
          shouldArchive = true;
        }
      }

      // Check importance criteria
      if (criteria.importanceLessThan !== undefined) {
        if (entity.importance === undefined || entity.importance < criteria.importanceLessThan) {
          shouldArchive = true;
        }
      }

      // Check tag criteria (must have at least one matching tag)
      if (criteria.tags && criteria.tags.length > 0) {
        const normalizedCriteriaTags = criteria.tags.map(t => t.toLowerCase());
        const entityTags = (entity.tags || []).map(t => t.toLowerCase());
        const hasMatchingTag = normalizedCriteriaTags.some(tag => entityTags.includes(tag));
        if (hasMatchingTag) {
          shouldArchive = true;
        }
      }

      if (shouldArchive) {
        toArchive.push(entity);
      }
    }

    if (!dryRun && toArchive.length > 0) {
      // Get mutable copy for write operation
      const graph = await this.storage.getGraphForMutation();
      // Remove archived entities from main graph
      const archiveNames = new Set(toArchive.map(e => e.name));
      graph.entities = graph.entities.filter(e => !archiveNames.has(e.name));
      graph.relations = graph.relations.filter(
        r => !archiveNames.has(r.from) && !archiveNames.has(r.to)
      );
      await this.storage.saveGraph(graph);
    }

    return {
      archived: toArchive.length,
      entityNames: toArchive.map(e => e.name),
    };
  }
}
