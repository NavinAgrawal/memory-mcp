/**
 * Analytics Manager
 *
 * Provides graph validation and analytics capabilities.
 *
 * @module features/AnalyticsManager
 */

import type { ValidationReport, ValidationError, ValidationWarning } from '../types/index.js';
import type { GraphStorage } from '../core/GraphStorage.js';

/**
 * Performs validation and analytics on the knowledge graph.
 */
export class AnalyticsManager {
  constructor(private storage: GraphStorage) {}

  /**
   * Validate the knowledge graph structure and data integrity.
   *
   * Checks for:
   * - Orphaned relations (pointing to non-existent entities)
   * - Duplicate entity names
   * - Invalid entity data (missing name/type, invalid observations)
   * - Isolated entities (no relations)
   * - Empty observations
   * - Missing metadata (createdAt, lastModified)
   *
   * @returns Validation report with errors, warnings, and summary
   */
  async validateGraph(): Promise<ValidationReport> {
    const graph = await this.storage.loadGraph();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Create a set of all entity names for fast lookup
    const entityNames = new Set(graph.entities.map(e => e.name));

    // Check for orphaned relations (relations pointing to non-existent entities)
    for (const relation of graph.relations) {
      if (!entityNames.has(relation.from)) {
        errors.push({
          type: 'orphaned_relation',
          message: `Relation has non-existent source entity: "${relation.from}"`,
          details: { relation, missingEntity: relation.from },
        });
      }
      if (!entityNames.has(relation.to)) {
        errors.push({
          type: 'orphaned_relation',
          message: `Relation has non-existent target entity: "${relation.to}"`,
          details: { relation, missingEntity: relation.to },
        });
      }
    }

    // Check for duplicate entity names
    const entityNameCounts = new Map<string, number>();
    for (const entity of graph.entities) {
      const count = entityNameCounts.get(entity.name) || 0;
      entityNameCounts.set(entity.name, count + 1);
    }
    for (const [name, count] of entityNameCounts.entries()) {
      if (count > 1) {
        errors.push({
          type: 'duplicate_entity',
          message: `Duplicate entity name found: "${name}" (${count} instances)`,
          details: { entityName: name, count },
        });
      }
    }

    // Check for entities with invalid data
    for (const entity of graph.entities) {
      if (!entity.name || entity.name.trim() === '') {
        errors.push({
          type: 'invalid_data',
          message: 'Entity has empty or missing name',
          details: { entity },
        });
      }
      if (!entity.entityType || entity.entityType.trim() === '') {
        errors.push({
          type: 'invalid_data',
          message: `Entity "${entity.name}" has empty or missing entityType`,
          details: { entity },
        });
      }
      if (!Array.isArray(entity.observations)) {
        errors.push({
          type: 'invalid_data',
          message: `Entity "${entity.name}" has invalid observations (not an array)`,
          details: { entity },
        });
      }
    }

    // Warnings: Check for isolated entities (no relations)
    const entitiesInRelations = new Set<string>();
    for (const relation of graph.relations) {
      entitiesInRelations.add(relation.from);
      entitiesInRelations.add(relation.to);
    }
    for (const entity of graph.entities) {
      if (!entitiesInRelations.has(entity.name) && graph.relations.length > 0) {
        warnings.push({
          type: 'isolated_entity',
          message: `Entity "${entity.name}" has no relations to other entities`,
          details: { entityName: entity.name },
        });
      }
    }

    // Warnings: Check for entities with empty observations
    for (const entity of graph.entities) {
      if (entity.observations.length === 0) {
        warnings.push({
          type: 'empty_observations',
          message: `Entity "${entity.name}" has no observations`,
          details: { entityName: entity.name },
        });
      }
    }

    // Warnings: Check for missing metadata (createdAt, lastModified)
    for (const entity of graph.entities) {
      if (!entity.createdAt) {
        warnings.push({
          type: 'missing_metadata',
          message: `Entity "${entity.name}" is missing createdAt timestamp`,
          details: { entityName: entity.name, field: 'createdAt' },
        });
      }
      if (!entity.lastModified) {
        warnings.push({
          type: 'missing_metadata',
          message: `Entity "${entity.name}" is missing lastModified timestamp`,
          details: { entityName: entity.name, field: 'lastModified' },
        });
      }
    }

    // Count specific issues
    const orphanedRelationsCount = errors.filter(e => e.type === 'orphaned_relation').length;
    const entitiesWithoutRelationsCount = warnings.filter(
      w => w.type === 'isolated_entity'
    ).length;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
        orphanedRelationsCount,
        entitiesWithoutRelationsCount,
      },
    };
  }
}
