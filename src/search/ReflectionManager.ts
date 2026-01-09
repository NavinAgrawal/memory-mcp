/**
 * Reflection Manager
 *
 * Phase 11: Implements reflection-based iterative retrieval
 * that refines results until adequate.
 *
 * @module search/ReflectionManager
 */

import type {
  ReadonlyKnowledgeGraph,
  QueryAnalysis,
  HybridSearchResult,
  HybridSearchOptions,
} from '../types/index.js';
import type { HybridSearchManager } from './HybridSearchManager.js';
import type { QueryAnalyzer } from './QueryAnalyzer.js';

/**
 * Options for reflection-based retrieval.
 */
export interface ReflectionOptions {
  /** Maximum number of reflection iterations (default: 3) */
  maxIterations?: number;
  /** Adequacy threshold 0-1 (default: 0.7) */
  adequacyThreshold?: number;
  /** Minimum results required (default: 3) */
  minResults?: number;
  /** Hybrid search options */
  searchOptions?: Partial<HybridSearchOptions>;
}

/**
 * Result of reflection-based retrieval.
 */
export interface ReflectionResult {
  results: HybridSearchResult[];
  iterations: number;
  adequate: boolean;
  refinements: string[];
  adequacyScore: number;
}

/**
 * Reflection Manager for iterative retrieval refinement.
 *
 * Implements the SimpleMem-inspired reflection loop:
 * 1. Execute initial search
 * 2. Check result adequacy
 * 3. If inadequate, refine query and repeat
 * 4. Combine results from all iterations
 *
 * @example
 * ```typescript
 * const reflection = new ReflectionManager(hybridSearch, analyzer);
 * const result = await reflection.retrieveWithReflection(
 *   graph,
 *   'What projects did Alice work on?',
 *   { maxIterations: 3 }
 * );
 * ```
 */
export class ReflectionManager {
  constructor(
    private hybridSearch: HybridSearchManager,
    private analyzer: QueryAnalyzer
  ) {}

  /**
   * Perform retrieval with reflection-based refinement.
   */
  async retrieveWithReflection(
    graph: ReadonlyKnowledgeGraph,
    query: string,
    options: ReflectionOptions = {}
  ): Promise<ReflectionResult> {
    const {
      maxIterations = 3,
      adequacyThreshold = 0.7,
      minResults = 3,
      searchOptions = {},
    } = options;

    const allResults: HybridSearchResult[] = [];
    const refinements: string[] = [];
    let currentQuery = query;
    let iteration = 0;
    let adequacyScore = 0;

    while (iteration < maxIterations) {
      iteration++;

      // Execute search
      const results = await this.hybridSearch.searchWithEntities(
        graph,
        currentQuery,
        searchOptions
      );

      // Add new results (deduplicated)
      for (const result of results) {
        if (!allResults.some(r => r.entity.name === result.entity.name)) {
          allResults.push(result);
        }
      }

      // Check adequacy
      const analysis = this.analyzer.analyze(query);
      adequacyScore = this.calculateAdequacy(allResults, analysis, minResults);

      if (adequacyScore >= adequacyThreshold) {
        break;
      }

      // Refine query if not adequate
      const refinedQuery = this.refineQuery(currentQuery, allResults, analysis);
      if (refinedQuery === currentQuery) {
        // No refinement possible
        break;
      }

      refinements.push(refinedQuery);
      currentQuery = refinedQuery;
    }

    return {
      results: allResults.sort((a, b) => b.scores.combined - a.scores.combined),
      iterations: iteration,
      adequate: adequacyScore >= adequacyThreshold,
      refinements,
      adequacyScore,
    };
  }

  /**
   * Calculate result adequacy score.
   */
  private calculateAdequacy(
    results: HybridSearchResult[],
    analysis: QueryAnalysis,
    minResults: number
  ): number {
    let score = 0;
    const weights = { quantity: 0.4, diversity: 0.3, relevance: 0.3 };

    // Quantity: Do we have enough results?
    const quantityScore = Math.min(results.length / minResults, 1);
    score += quantityScore * weights.quantity;

    // Diversity: Do results cover different entity types?
    const types = new Set(results.map(r => r.entity.entityType));
    const diversityScore = Math.min(types.size / 3, 1);
    score += diversityScore * weights.diversity;

    // Relevance: Average combined score
    const avgScore = results.length > 0
      ? results.reduce((sum, r) => sum + r.scores.combined, 0) / results.length
      : 0;
    score += avgScore * weights.relevance;

    // Suppress unused parameter warning - analysis reserved for future enhancements
    void analysis;

    return score;
  }

  /**
   * Refine query based on current results and analysis.
   */
  private refineQuery(
    query: string,
    results: HybridSearchResult[],
    analysis: QueryAnalysis
  ): string {
    // Check what information types are missing
    const coveredTypes = new Set<string>();
    for (const result of results) {
      coveredTypes.add(result.entity.entityType.toLowerCase());
    }

    // If looking for persons but no person results, refine
    if (analysis.requiredInfoTypes.includes('person') && !coveredTypes.has('person')) {
      return `${query} person people`;
    }

    // If temporal query but no temporal context, add time hint
    if (analysis.temporalRange && results.length < 3) {
      return `${query} recent history timeline`;
    }

    // Broaden query by removing constraints
    const broader = query.replace(/\b(only|just|exactly|specific)\b/gi, '');
    if (broader !== query) {
      return broader.trim();
    }

    return query;
  }
}
