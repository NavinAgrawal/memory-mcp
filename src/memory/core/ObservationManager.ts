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
   * Add observations to multiple entities.
   *
   * Filters out duplicate observations and updates timestamps.
   *
   * @param observations - Array of {entityName, contents} objects
   * @returns Promise resolving to results for each entity
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
   * Delete observations from multiple entities.
   *
   * Updates timestamps when observations are removed.
   *
   * @param deletions - Array of {entityName, observations} objects
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
