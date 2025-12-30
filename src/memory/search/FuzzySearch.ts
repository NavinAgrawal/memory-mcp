/**
 * Fuzzy Search
 *
 * Search with typo tolerance using Levenshtein distance similarity.
 *
 * @module search/FuzzySearch
 */

import type { KnowledgeGraph } from '../types/index.js';
import type { GraphStorage } from '../core/GraphStorage.js';
import { levenshteinDistance } from '../utils/index.js';
import { SEARCH_LIMITS } from '../utils/constants.js';
import { SearchFilterChain, type SearchFilters } from './SearchFilterChain.js';

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
    const queryLower = query.toLowerCase();

    // First filter by fuzzy text match (search-specific)
    // OPTIMIZED: Uses pre-computed lowercase cache where applicable
    const fuzzyMatched = graph.entities.filter(e => {
      const lowercased = this.storage.getLowercased(e.name);

      // Check name match (use pre-computed lowercase)
      const nameLower = lowercased?.name ?? e.name.toLowerCase();
      if (this.isFuzzyMatchLower(nameLower, queryLower, threshold)) return true;

      // Check type match (use pre-computed lowercase)
      const typeLower = lowercased?.entityType ?? e.entityType.toLowerCase();
      if (this.isFuzzyMatchLower(typeLower, queryLower, threshold)) return true;

      // Check observations (use pre-computed lowercase array)
      const obsLower = lowercased?.observations ?? e.observations.map(o => o.toLowerCase());
      return obsLower.some(
        o =>
          // For observations, split into words and check each word
          o
            .split(/\s+/)
            .some(word => this.isFuzzyMatchLower(word, queryLower, threshold)) ||
          // Also check if the observation contains the query
          this.isFuzzyMatchLower(o, queryLower, threshold)
      );
    });

    // Apply tag and importance filters using SearchFilterChain
    const filters: SearchFilters = { tags, minImportance, maxImportance };
    const filteredEntities = SearchFilterChain.applyFilters(fuzzyMatched, filters);

    // Apply pagination using SearchFilterChain
    const pagination = SearchFilterChain.validatePagination(offset, limit);
    const paginatedEntities = SearchFilterChain.paginate(filteredEntities, pagination);

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
   * Check if two already-lowercase strings match with fuzzy logic.
   *
   * OPTIMIZED: Skips toLowerCase() calls when strings are already lowercase.
   *
   * @param s1 - First string (already lowercase)
   * @param s2 - Second string (already lowercase)
   * @param threshold - Similarity threshold (0.0 to 1.0)
   * @returns True if strings match fuzzily
   */
  private isFuzzyMatchLower(s1: string, s2: string, threshold: number = 0.7): boolean {
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
