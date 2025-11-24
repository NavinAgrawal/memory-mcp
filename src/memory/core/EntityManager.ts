/**
 * Entity Manager
 *
 * Handles CRUD operations for entities in the knowledge graph.
 *
 * @module core/EntityManager
 */

import type { Entity } from '../types/index.js';
import type { GraphStorage } from './GraphStorage.js';
import { EntityNotFoundError, InvalidImportanceError } from '../utils/errors.js';

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
    const graph = await this.storage.loadGraph();
    const timestamp = new Date().toISOString();

    const newEntities = entities
      .filter(e => !graph.entities.some(existing => existing.name === e.name))
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

    graph.entities.push(...newEntities);
    await this.storage.saveGraph(graph);

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
    const graph = await this.storage.loadGraph();

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
    const graph = await this.storage.loadGraph();
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
}
