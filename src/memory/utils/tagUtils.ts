/**
 * Tag Normalization and Matching Utilities
 *
 * Centralizes tag operations to eliminate duplicate normalization logic
 * across the codebase. All tags are normalized to lowercase for consistent matching.
 */

/**
 * Normalizes a single tag to lowercase and trimmed.
 *
 * @param tag - Tag to normalize
 * @returns Normalized tag
 */
export function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim();
}

/**
 * Normalizes an array of tags to lowercase.
 * Handles undefined/null input gracefully.
 *
 * @param tags - Array of tags to normalize, or undefined
 * @returns Normalized tags array, or empty array if input is undefined/null
 */
export function normalizeTags(tags: string[] | undefined | null): string[] {
  if (!tags || tags.length === 0) return [];
  return tags.map(tag => tag.toLowerCase());
}

/**
 * Checks if an entity's tags include any of the specified search tags.
 * Both inputs are normalized before comparison.
 *
 * @param entityTags - Tags on the entity (may be undefined)
 * @param searchTags - Tags to search for (may be undefined)
 * @returns true if any search tag matches any entity tag, false if no match or either is empty
 */
export function hasMatchingTag(
  entityTags: string[] | undefined,
  searchTags: string[] | undefined
): boolean {
  if (!entityTags || entityTags.length === 0) return false;
  if (!searchTags || searchTags.length === 0) return false;

  const normalizedEntity = normalizeTags(entityTags);
  const normalizedSearch = normalizeTags(searchTags);

  return normalizedSearch.some(tag => normalizedEntity.includes(tag));
}

/**
 * Checks if entity tags include ALL of the specified required tags.
 *
 * @param entityTags - Tags on the entity (may be undefined)
 * @param requiredTags - All tags that must be present
 * @returns true if all required tags are present
 */
export function hasAllTags(
  entityTags: string[] | undefined,
  requiredTags: string[]
): boolean {
  if (!entityTags || entityTags.length === 0) return false;
  if (requiredTags.length === 0) return true;

  const normalizedEntity = normalizeTags(entityTags);
  return normalizeTags(requiredTags).every(tag => normalizedEntity.includes(tag));
}

/**
 * Filters entities by tag match.
 * Returns all entities if searchTags is empty or undefined.
 *
 * @param entities - Array of entities with optional tags property
 * @param searchTags - Tags to filter by
 * @returns Filtered entities that have at least one matching tag
 */
export function filterByTags<T extends { tags?: string[] }>(
  entities: T[],
  searchTags: string[] | undefined
): T[] {
  if (!searchTags || searchTags.length === 0) {
    return entities;
  }

  const normalizedSearch = normalizeTags(searchTags);

  return entities.filter(entity => {
    if (!entity.tags || entity.tags.length === 0) return false;
    const normalizedEntity = normalizeTags(entity.tags);
    return normalizedSearch.some(tag => normalizedEntity.includes(tag));
  });
}

/**
 * Adds new tags to an existing tag array, avoiding duplicates.
 * All tags are normalized to lowercase.
 *
 * @param existingTags - Current tags (may be undefined)
 * @param newTags - Tags to add
 * @returns Combined tags array with no duplicates
 */
export function addUniqueTags(
  existingTags: string[] | undefined,
  newTags: string[]
): string[] {
  const existing = normalizeTags(existingTags);
  const toAdd = normalizeTags(newTags);

  const uniqueNew = toAdd.filter(tag => !existing.includes(tag));
  return [...existing, ...uniqueNew];
}

/**
 * Removes specified tags from an existing tag array.
 * Comparison is case-insensitive.
 *
 * @param existingTags - Current tags (may be undefined)
 * @param tagsToRemove - Tags to remove
 * @returns Tags array with specified tags removed
 */
export function removeTags(
  existingTags: string[] | undefined,
  tagsToRemove: string[]
): string[] {
  if (!existingTags || existingTags.length === 0) return [];

  const toRemoveNormalized = normalizeTags(tagsToRemove);
  return existingTags.filter(tag => !toRemoveNormalized.includes(tag.toLowerCase()));
}
