/**
 * Relation Manager
 *
 * Handles CRUD operations for relations in the knowledge graph.
 *
 * @module core/RelationManager
 */

import type { Relation } from '../types/index.js';
import type { GraphStorage } from './GraphStorage.js';

/**
 * Manages relation operations with automatic timestamp handling.
 */
export class RelationManager {
  constructor(private storage: GraphStorage) {}

  /**
   * Create multiple relations in a single batch operation.
   *
   * Filters out duplicates and adds timestamps automatically.
   *
   * @param relations - Array of relations to create
   * @returns Promise resolving to newly created relations
   */
  async createRelations(relations: Relation[]): Promise<Relation[]> {
    const graph = await this.storage.loadGraph();
    const timestamp = new Date().toISOString();

    const newRelations = relations
      .filter(r => !graph.relations.some(existing =>
        existing.from === r.from &&
        existing.to === r.to &&
        existing.relationType === r.relationType
      ))
      .map(r => ({
        ...r,
        createdAt: r.createdAt || timestamp,
        lastModified: r.lastModified || timestamp,
      }));

    graph.relations.push(...newRelations);
    await this.storage.saveGraph(graph);

    return newRelations;
  }

  /**
   * Delete multiple relations.
   *
   * Updates lastModified timestamp on affected entities.
   *
   * @param relations - Array of relations to delete
   */
  async deleteRelations(relations: Relation[]): Promise<void> {
    const graph = await this.storage.loadGraph();
    const timestamp = new Date().toISOString();

    // Track affected entities
    const affectedEntityNames = new Set<string>();
    relations.forEach(rel => {
      affectedEntityNames.add(rel.from);
      affectedEntityNames.add(rel.to);
    });

    // Remove relations
    graph.relations = graph.relations.filter(r =>
      !relations.some(delRelation =>
        r.from === delRelation.from &&
        r.to === delRelation.to &&
        r.relationType === delRelation.relationType
      )
    );

    // Update lastModified for affected entities
    graph.entities.forEach(entity => {
      if (affectedEntityNames.has(entity.name)) {
        entity.lastModified = timestamp;
      }
    });

    await this.storage.saveGraph(graph);
  }

  /**
   * Get all relations involving an entity.
   *
   * @param entityName - Entity name
   * @returns Promise resolving to array of relations
   */
  async getRelations(entityName: string): Promise<Relation[]> {
    const graph = await this.storage.loadGraph();
    return graph.relations.filter(
      r => r.from === entityName || r.to === entityName
    );
  }
}
