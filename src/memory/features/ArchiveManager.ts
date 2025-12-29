/**
 * Archive Manager
 *
 * Archives old or low-importance entities to reduce active graph size.
 *
 * @module features/ArchiveManager
 */

import type { Entity } from '../types/index.js';
import type { GraphStorage } from '../core/GraphStorage.js';

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
 * Manages entity archival based on age, importance, and tags.
 */
export class ArchiveManager {
  constructor(private storage: GraphStorage) {}

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
