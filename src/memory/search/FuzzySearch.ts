/**
 * Fuzzy Search
 *
 * Search with typo tolerance using Levenshtein distance similarity.
 *
 * @module search/FuzzySearch
 */

import type { KnowledgeGraph } from '../types/index.js';
import type { GraphStorage } from '../core/GraphStorage.js';
import { levenshteinDistance } from '../utils/levenshtein.js';
import { SEARCH_LIMITS } from '../utils/constants.js';

/**
 * Default fuzzy search similarity threshold (70% match required).
 * Lower values are more permissive (more typos tolerated).
 * Higher values are stricter (fewer typos tolerated).
 */
export const DEFAULT_FUZZY_THRESHOLD = 0.7;

/**
 * Performs fuzzy search with configurable similarity threshold.
 */
export class FuzzySearch {
  constructor(private storage: GraphStorage) {}

  /**
   * Fuzzy search for entities with typo tolerance and pagination.
   *
   * Uses Levenshtein distance to calculate similarity between strings.
   * Matches if similarity >= threshold (0.0 to 1.0).
   *
   * @param query - Search query
   * @param threshold - Similarity threshold (0.0 to 1.0), default DEFAULT_FUZZY_THRESHOLD
   * @param tags - Optional tags filter
   * @param minImportance - Optional minimum importance
   * @param maxImportance - Optional maximum importance
   * @param offset - Number of results to skip (default: 0)
   * @param limit - Maximum number of results (default: 50, max: 200)
   * @returns Filtered knowledge graph with fuzzy matches and pagination applied
   */
  async fuzzySearch(
    query: string,
    threshold: number = DEFAULT_FUZZY_THRESHOLD,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number,
    offset: number = 0,
    limit: number = SEARCH_LIMITS.DEFAULT
  ): Promise<KnowledgeGraph> {
    const graph = await this.storage.loadGraph();
    const normalizedTags = tags?.map(tag => tag.toLowerCase());

    // Validate pagination parameters
    const validatedOffset = Math.max(0, offset);
    const validatedLimit = Math.min(Math.max(SEARCH_LIMITS.MIN, limit), SEARCH_LIMITS.MAX);

    // Filter entities using fuzzy matching
    const filteredEntities = graph.entities.filter(e => {
      // Fuzzy text search
      const matchesQuery =
        this.isFuzzyMatch(e.name, query, threshold) ||
        this.isFuzzyMatch(e.entityType, query, threshold) ||
        e.observations.some(
          o =>
            // For observations, split into words and check each word
            o
              .toLowerCase()
              .split(/\s+/)
              .some(word => this.isFuzzyMatch(word, query, threshold)) ||
            // Also check if the observation contains the query
            this.isFuzzyMatch(o, query, threshold)
        );

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

    // Apply pagination
    const paginatedEntities = filteredEntities.slice(validatedOffset, validatedOffset + validatedLimit);

    const filteredEntityNames = new Set(paginatedEntities.map(e => e.name));
    const filteredRelations = graph.relations.filter(
      r => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    return {
      entities: paginatedEntities,
      relations: filteredRelations,
    };
  }

  /**
   * Check if two strings match with fuzzy logic.
   *
   * Returns true if:
   * - Strings are identical
   * - One contains the other
   * - Levenshtein similarity >= threshold
   *
   * @param str1 - First string
   * @param str2 - Second string
   * @param threshold - Similarity threshold (0.0 to 1.0)
   * @returns True if strings match fuzzily
   */
  private isFuzzyMatch(str1: string, str2: string, threshold: number = 0.7): boolean {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    // Exact match
    if (s1 === s2) return true;

    // One contains the other
    if (s1.includes(s2) || s2.includes(s1)) return true;

    // Calculate similarity using Levenshtein distance
    const distance = levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    const similarity = 1 - distance / maxLength;

    return similarity >= threshold;
  }
}
