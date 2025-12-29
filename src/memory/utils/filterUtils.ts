/**
 * Entity Filtering Utilities
 *
 * Centralizes common filtering logic for importance, date ranges, and other
 * entity properties to eliminate duplicate patterns across search implementations.
 */

import type { Entity } from '../types/entity.types.js';
import { isWithinDateRange } from './dateUtils.js';

/**
 * Checks if an entity's importance is within the specified range.
 * Entities without importance are treated as not matching if any filter is set.
 *
 * @param importance - The entity's importance value (may be undefined)
 * @param minImportance - Minimum importance filter (inclusive)
 * @param maxImportance - Maximum importance filter (inclusive)
 * @returns true if importance is within range or no filters are set
 *
 * @example
 * ```typescript
 * // Check if entity passes importance filter
 * if (isWithinImportanceRange(entity.importance, 5, 10)) {
 *   // Entity has importance between 5 and 10
 * }
 * ```
 */
export function isWithinImportanceRange(
  importance: number | undefined,
  minImportance?: number,
  maxImportance?: number
): boolean {
  // If no filters set, always pass
  if (minImportance === undefined && maxImportance === undefined) {
    return true;
  }

  // Check minimum importance
  if (minImportance !== undefined) {
    if (importance === undefined || importance < minImportance) {
      return false;
    }
  }

  // Check maximum importance
  if (maxImportance !== undefined) {
    if (importance === undefined || importance > maxImportance) {
      return false;
    }
  }

  return true;
}

/**
 * Filters entities by importance range.
 * Returns all entities if no importance filters are specified.
 *
 * @param entities - Array of entities to filter
 * @param minImportance - Minimum importance filter (inclusive)
 * @param maxImportance - Maximum importance filter (inclusive)
 * @returns Filtered entities within the importance range
 */
export function filterByImportance(
  entities: Entity[],
  minImportance?: number,
  maxImportance?: number
): Entity[] {
  if (minImportance === undefined && maxImportance === undefined) {
    return entities;
  }
  return entities.filter(e =>
    isWithinImportanceRange(e.importance, minImportance, maxImportance)
  );
}

/**
 * Filters entities by creation date range.
 *
 * @param entities - Array of entities to filter
 * @param startDate - Start of date range (inclusive)
 * @param endDate - End of date range (inclusive)
 * @returns Filtered entities created within the date range
 */
export function filterByCreatedDate(
  entities: Entity[],
  startDate?: string,
  endDate?: string
): Entity[] {
  if (!startDate && !endDate) {
    return entities;
  }
  return entities.filter(e =>
    isWithinDateRange(e.createdAt, startDate, endDate)
  );
}

/**
 * Filters entities by last modified date range.
 *
 * @param entities - Array of entities to filter
 * @param startDate - Start of date range (inclusive)
 * @param endDate - End of date range (inclusive)
 * @returns Filtered entities modified within the date range
 */
export function filterByModifiedDate(
  entities: Entity[],
  startDate?: string,
  endDate?: string
): Entity[] {
  if (!startDate && !endDate) {
    return entities;
  }
  return entities.filter(e =>
    isWithinDateRange(e.lastModified, startDate, endDate)
  );
}

/**
 * Filters entities by entity type.
 *
 * @param entities - Array of entities to filter
 * @param entityType - Entity type to filter by (case-sensitive)
 * @returns Filtered entities of the specified type
 */
export function filterByEntityType(
  entities: Entity[],
  entityType?: string
): Entity[] {
  if (!entityType) {
    return entities;
  }
  return entities.filter(e => e.entityType === entityType);
}

/**
 * Common search filters that can be applied to entities.
 */
export interface CommonSearchFilters {
  tags?: string[];
  minImportance?: number;
  maxImportance?: number;
  entityType?: string;
  createdAfter?: string;
  createdBefore?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
}

/**
 * Checks if an entity passes all the specified filters.
 * Short-circuits on first failing filter for performance.
 *
 * Note: Tag filtering should be handled separately using tagUtils.hasMatchingTag
 * as it requires special normalization logic.
 *
 * @param entity - Entity to check
 * @param filters - Filters to apply
 * @returns true if entity passes all filters
 */
export function entityPassesFilters(
  entity: Entity,
  filters: Omit<CommonSearchFilters, 'tags'>
): boolean {
  // Importance filter
  if (!isWithinImportanceRange(entity.importance, filters.minImportance, filters.maxImportance)) {
    return false;
  }

  // Entity type filter
  if (filters.entityType && entity.entityType !== filters.entityType) {
    return false;
  }

  // Created date filter
  if (!isWithinDateRange(entity.createdAt, filters.createdAfter, filters.createdBefore)) {
    return false;
  }

  // Modified date filter
  if (!isWithinDateRange(entity.lastModified, filters.modifiedAfter, filters.modifiedBefore)) {
    return false;
  }

  return true;
}
