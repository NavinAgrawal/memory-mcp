/**
 * Observation Manager
 *
 * Handles CRUD operations for observations within entities.
 *
 * @module core/ObservationManager
 */

import type { GraphStorage } from './GraphStorage.js';
import { EntityNotFoundError } from '../utils/errors.js';

/**
 * Result of adding observations to an entity.
 */
export interface AddObservationsResult {
  entityName: string;
  addedObservations: string[];
}

/**
 * Manages observation operations with automatic timestamp handling.
 */
export class ObservationManager {
  constructor(private storage: GraphStorage) {}

  /**
   * Add observations to multiple entities in a single batch operation.
   *
   * This method performs the following operations:
   * - Validates that all specified entities exist
   * - Filters out duplicate observations (observations already present)
   * - Adds new observations to each entity
   * - Automatically updates lastModified timestamp for modified entities
   *
   * @param observations - Array of objects, each containing entityName and array of observation contents
   * @returns Promise resolving to array of results showing added observations per entity
   * @throws {EntityNotFoundError} If any specified entity does not exist
   *
   * @example
   * ```typescript
   * const manager = new ObservationManager(storage);
   *
   * // Add observations to single entity
   * const results = await manager.addObservations([
   *   {
   *     entityName: 'Alice',
   *     contents: ['Works on frontend', 'Expertise in React']
   *   }
   * ]);
   * console.log(results[0].addedObservations); // ['Works on frontend', 'Expertise in React']
   *
   * // Add observations to multiple entities at once
   * await manager.addObservations([
   *   { entityName: 'Bob', contents: ['Team lead', 'Experienced in Node.js'] },
   *   { entityName: 'Charlie', contents: ['New hire', 'Learning the codebase'] }
   * ]);
   *
   * // Duplicate observations are filtered out
   * await manager.addObservations([
   *   { entityName: 'Alice', contents: ['Works on frontend'] } // Already exists, won't be added
   * ]);
   * ```
   */
  async addObservations(
    observations: { entityName: string; contents: string[] }[]
  ): Promise<AddObservationsResult[]> {
    const graph = await this.storage.loadGraph();
    const timestamp = new Date().toISOString();

    const results = observations.map(o => {
      const entity = graph.entities.find(e => e.name === o.entityName);

      if (!entity) {
        throw new EntityNotFoundError(o.entityName);
      }

      const newObservations = o.contents.filter(
        content => !entity.observations.includes(content)
      );

      entity.observations.push(...newObservations);

      // Update lastModified if observations were added
      if (newObservations.length > 0) {
        entity.lastModified = timestamp;
      }

      return {
        entityName: o.entityName,
        addedObservations: newObservations,
      };
    });

    await this.storage.saveGraph(graph);
    return results;
  }

  /**
   * Delete specific observations from multiple entities in a single batch operation.
   *
   * This method performs the following operations:
   * - Removes specified observations from each entity
   * - Silently ignores entities that don't exist (no error thrown)
   * - Silently ignores observations that don't exist in the entity
   * - Automatically updates lastModified timestamp for modified entities
   *
   * @param deletions - Array of objects, each containing entityName and array of observations to delete
   * @returns Promise that resolves when deletion is complete
   *
   * @example
   * ```typescript
   * const manager = new ObservationManager(storage);
   *
   * // Delete specific observations from single entity
   * await manager.deleteObservations([
   *   {
   *     entityName: 'Alice',
   *     observations: ['Works on frontend', 'Expertise in React']
   *   }
   * ]);
   *
   * // Delete observations from multiple entities at once
   * await manager.deleteObservations([
   *   { entityName: 'Bob', observations: ['Team lead'] },
   *   { entityName: 'Charlie', observations: ['New hire', 'Learning the codebase'] }
   * ]);
   *
   * // Safe to delete non-existent observations or from non-existent entities
   * await manager.deleteObservations([
   *   { entityName: 'NonExistent', observations: ['Some observation'] } // No error
   * ]);
   * ```
   */
  async deleteObservations(
    deletions: { entityName: string; observations: string[] }[]
  ): Promise<void> {
    const graph = await this.storage.loadGraph();
    const timestamp = new Date().toISOString();

    deletions.forEach(d => {
      const entity = graph.entities.find(e => e.name === d.entityName);

      if (entity) {
        const originalLength = entity.observations.length;
        entity.observations = entity.observations.filter(
          o => !d.observations.includes(o)
        );

        // Update lastModified if observations were deleted
        if (entity.observations.length < originalLength) {
          entity.lastModified = timestamp;
        }
      }
    });

    await this.storage.saveGraph(graph);
  }
}
