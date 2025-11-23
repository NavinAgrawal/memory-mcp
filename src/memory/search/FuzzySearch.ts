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

/**
 * Performs fuzzy search with configurable similarity threshold.
 */
export class FuzzySearch {
  constructor(private storage: GraphStorage) {}

  /**
   * Fuzzy search for entities with typo tolerance.
   *
   * Uses Levenshtein distance to calculate similarity between strings.
   * Matches if similarity >= threshold (0.0 to 1.0).
   *
   * @param query - Search query
   * @param threshold - Similarity threshold (0.0 to 1.0), default 0.7
   * @param tags - Optional tags filter
   * @param minImportance - Optional minimum importance
   * @param maxImportance - Optional maximum importance
   * @returns Filtered knowledge graph with fuzzy matches
   */
  async fuzzySearch(
    query: string,
    threshold: number = 0.7,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number
  ): Promise<KnowledgeGraph> {
    const graph = await this.storage.loadGraph();
    const normalizedTags = tags?.map(tag => tag.toLowerCase());

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

    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));
    const filteredRelations = graph.relations.filter(
      r => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    return {
      entities: filteredEntities,
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
