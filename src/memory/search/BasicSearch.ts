/**
 * Basic Search
 *
 * Simple text-based search with tag, importance, and date filters.
 *
 * @module search/BasicSearch
 */

import type { KnowledgeGraph } from '../types/index.js';
import type { GraphStorage } from '../core/GraphStorage.js';
import { isWithinDateRange } from '../utils/dateUtils.js';

/**
 * Performs basic text search with optional filters.
 */
export class BasicSearch {
  constructor(private storage: GraphStorage) {}

  /**
   * Search nodes by text query with optional filters.
   *
   * Searches across entity names, types, and observations.
   *
   * @param query - Text to search for (case-insensitive)
   * @param tags - Optional tags to filter by
   * @param minImportance - Optional minimum importance (0-10)
   * @param maxImportance - Optional maximum importance (0-10)
   * @returns Filtered knowledge graph
   */
  async searchNodes(
    query: string,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number
  ): Promise<KnowledgeGraph> {
    const graph = await this.storage.loadGraph();
    const normalizedTags = tags?.map(tag => tag.toLowerCase());

    const filteredEntities = graph.entities.filter(e => {
      // Text search
      const matchesQuery =
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        e.entityType.toLowerCase().includes(query.toLowerCase()) ||
        e.observations.some(o => o.toLowerCase().includes(query.toLowerCase()));

      if (!matchesQuery) return false;

      // Tag filter
      if (normalizedTags && normalizedTags.length > 0) {
        if (!e.tags || e.tags.length === 0) return false;
        const entityTags = e.tags.map(tag => tag.toLowerCase());
        const hasMatchingTag = normalizedTags.some(tag => entityTags.includes(tag));
        if (!hasMatchingTag) return false;
      }

      // Importance filter
      if (minImportance !== undefined && (e.importance === undefined || e.importance < minImportance)) {
        return false;
      }
      if (maxImportance !== undefined && (e.importance === undefined || e.importance > maxImportance)) {
        return false;
      }

      return true;
    });

    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));
    const filteredRelations = graph.relations.filter(
      r => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    return { entities: filteredEntities, relations: filteredRelations };
  }

  /**
   * Open specific nodes by name.
   *
   * @param names - Array of entity names to retrieve
   * @returns Knowledge graph with specified entities and their relations
   */
  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    const graph = await this.storage.loadGraph();

    const filteredEntities = graph.entities.filter(e => names.includes(e.name));
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));
    const filteredRelations = graph.relations.filter(
      r => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    return { entities: filteredEntities, relations: filteredRelations };
  }

  /**
   * Search by date range.
   *
   * @param startDate - Optional start date (ISO 8601)
   * @param endDate - Optional end date (ISO 8601)
   * @param entityType - Optional entity type filter
   * @param tags - Optional tags filter
   * @returns Filtered knowledge graph
   */
  async searchByDateRange(
    startDate?: string,
    endDate?: string,
    entityType?: string,
    tags?: string[]
  ): Promise<KnowledgeGraph> {
    const graph = await this.storage.loadGraph();
    const normalizedTags = tags?.map(tag => tag.toLowerCase());

    const filteredEntities = graph.entities.filter(e => {
      // Date filter (use createdAt or lastModified)
      const dateToCheck = e.createdAt || e.lastModified;
      if (dateToCheck && !isWithinDateRange(dateToCheck, startDate, endDate)) {
        return false;
      }

      // Entity type filter
      if (entityType && e.entityType !== entityType) {
        return false;
      }

      // Tags filter
      if (normalizedTags && normalizedTags.length > 0) {
        if (!e.tags || e.tags.length === 0) return false;
        const entityTags = e.tags.map(tag => tag.toLowerCase());
        const hasMatchingTag = normalizedTags.some(tag => entityTags.includes(tag));
        if (!hasMatchingTag) return false;
      }

      return true;
    });

    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));
    const filteredRelations = graph.relations.filter(r => {
      const dateToCheck = r.createdAt || r.lastModified;
      const inDateRange = !dateToCheck || isWithinDateRange(dateToCheck, startDate, endDate);
      const involvesFilteredEntities =
        filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to);

      return inDateRange && involvesFilteredEntities;
    });

    return { entities: filteredEntities, relations: filteredRelations };
  }
}
