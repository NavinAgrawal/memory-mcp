/**
 * Ranked Search
 *
 * TF-IDF relevance-based search with scoring.
 *
 * @module search/RankedSearch
 */

import type { SearchResult } from '../types/index.js';
import type { GraphStorage } from '../core/GraphStorage.js';
import { calculateTFIDF, tokenize } from '../utils/tfidf.js';

/**
 * Performs TF-IDF ranked search.
 */
export class RankedSearch {
  constructor(private storage: GraphStorage) {}

  /**
   * Search with TF-IDF relevance ranking.
   *
   * @param query - Search query
   * @param tags - Optional tags filter
   * @param minImportance - Optional minimum importance
   * @param maxImportance - Optional maximum importance
   * @param limit - Maximum results to return (default 50)
   * @returns Array of search results sorted by relevance
   */
  async searchNodesRanked(
    query: string,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number,
    limit: number = 50
  ): Promise<SearchResult[]> {
    const graph = await this.storage.loadGraph();
    const normalizedTags = tags?.map(tag => tag.toLowerCase());

    // Filter entities by tags and importance
    let filteredEntities = graph.entities.filter(e => {
      // Tag filter
      if (normalizedTags && normalizedTags.length > 0) {
        if (!e.tags || e.tags.length === 0) return false;
        const entityTags = e.tags.map(tag => tag.toLowerCase());
        if (!normalizedTags.some(tag => entityTags.includes(tag))) return false;
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

    // Calculate TF-IDF scores
    const results: SearchResult[] = [];
    const queryTerms = tokenize(query);
    const documents = filteredEntities.map(e =>
      [e.name, e.entityType, ...e.observations].join(' ')
    );

    for (let i = 0; i < filteredEntities.length; i++) {
      const entity = filteredEntities[i];
      const document = documents[i];

      // Calculate score for each query term
      let totalScore = 0;
      const matchedFields: SearchResult['matchedFields'] = {};

      for (const term of queryTerms) {
        const score = calculateTFIDF(term, document, documents);
        totalScore += score;

        // Track which fields matched
        if (entity.name.toLowerCase().includes(term)) {
          matchedFields.name = true;
        }
        if (entity.entityType.toLowerCase().includes(term)) {
          matchedFields.entityType = true;
        }
        const matchedObs = entity.observations.filter(o =>
          o.toLowerCase().includes(term)
        );
        if (matchedObs.length > 0) {
          matchedFields.observations = matchedObs;
        }
      }

      // Only include entities with non-zero scores
      if (totalScore > 0) {
        results.push({
          entity,
          score: totalScore,
          matchedFields,
        });
      }
    }

    // Sort by score descending and apply limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
