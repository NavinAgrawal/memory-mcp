/**
 * Entity Manager
 *
 * Handles CRUD operations for entities in the knowledge graph.
 *
 * @module core/EntityManager
 */

import type { Entity } from '../types/index.js';
import type { GraphStorage } from './GraphStorage.js';

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
   * Filters out duplicates and adds timestamps automatically.
   *
   * @param entities - Array of entities to create
   * @returns Promise resolving to newly created entities
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
            throw new Error(`Importance must be between ${MIN_IMPORTANCE} and ${MAX_IMPORTANCE}, got ${e.importance}`);
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
   * Delete multiple entities by name.
   *
   * Also removes all relations involving these entities.
   *
   * @param entityNames - Array of entity names to delete
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
   * Get an entity by name.
   *
   * @param name - Entity name
   * @returns Promise resolving to entity or null if not found
   */
  async getEntity(name: string): Promise<Entity | null> {
    const graph = await this.storage.loadGraph();
    return graph.entities.find(e => e.name === name) || null;
  }

  /**
   * Update an entity's fields.
   *
   * @param name - Entity name
   * @param updates - Partial entity with fields to update
   * @returns Promise resolving to updated entity
   */
  async updateEntity(name: string, updates: Partial<Entity>): Promise<Entity> {
    const graph = await this.storage.loadGraph();
    const entity = graph.entities.find(e => e.name === name);

    if (!entity) {
      throw new Error(`Entity with name ${name} not found`);
    }

    // Apply updates
    Object.assign(entity, updates);
    entity.lastModified = new Date().toISOString();

    await this.storage.saveGraph(graph);
    return entity;
  }
}
