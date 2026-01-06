/**
 * Query Cost Estimator
 *
 * Phase 10 Sprint 4: Estimates the cost of different search methods
 * and recommends the optimal method based on query characteristics
 * and graph size.
 *
 * @module search/QueryCostEstimator
 */

import type {
  SearchMethod,
  QueryCostEstimate,
  QueryCostEstimatorOptions,
} from '../types/index.js';

/**
 * Default options for the QueryCostEstimator.
 */
const DEFAULT_OPTIONS: Required<QueryCostEstimatorOptions> = {
  basicTimePerEntity: 0.01,
  rankedTimePerEntity: 0.05,
  booleanTimePerEntity: 0.02,
  fuzzyTimePerEntity: 0.1,
  semanticTimePerEntity: 0.5,
  lowComplexityThreshold: 100,
  highComplexityThreshold: 1000,
};

/**
 * Phase 10 Sprint 4: Estimates search query costs and recommends optimal methods.
 *
 * Analyzes query characteristics and graph size to estimate execution time
 * and recommend the most appropriate search method.
 *
 * @example
 * ```typescript
 * const estimator = new QueryCostEstimator();
 *
 * // Get estimate for a specific method
 * const estimate = estimator.estimateMethod('ranked', 'test query', 1000);
 *
 * // Get the recommended method for a query
 * const recommendation = estimator.recommendMethod('test query', 1000);
 *
 * // Get estimates for all methods
 * const allEstimates = estimator.estimateAllMethods('test query', 1000);
 * ```
 */
export class QueryCostEstimator {
  private options: Required<QueryCostEstimatorOptions>;

  /**
   * Create a new QueryCostEstimator instance.
   *
   * @param options - Optional configuration overrides
   */
  constructor(options?: QueryCostEstimatorOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Estimate the cost of a specific search method.
   *
   * @param method - The search method to estimate
   * @param query - The search query
   * @param entityCount - Number of entities in the graph
   * @returns Cost estimate for the method
   */
  estimateMethod(
    method: SearchMethod,
    query: string,
    entityCount: number
  ): QueryCostEstimate {
    // Get the recommended method first to determine isRecommended
    const recommendedMethod = this.getRecommendedMethodOnly(query, entityCount);
    return this.estimateMethodInternal(method, query, entityCount, method === recommendedMethod);
  }

  /**
   * Internal method to estimate without triggering recursion.
   * @private
   */
  private estimateMethodInternal(
    method: SearchMethod,
    query: string,
    entityCount: number,
    isRecommended: boolean
  ): QueryCostEstimate {
    const baseTime = this.getBaseTimeForMethod(method);
    const queryComplexityFactor = this.getQueryComplexityFactor(query, method);
    const estimatedTimeMs = baseTime * entityCount * queryComplexityFactor;
    const complexity = this.getComplexity(entityCount);
    const recommendation = this.getRecommendation(method, query, entityCount, complexity);

    return {
      method,
      estimatedTimeMs: Math.round(estimatedTimeMs * 100) / 100,
      complexity,
      entityCount,
      recommendation,
      isRecommended,
    };
  }

  /**
   * Get just the recommended method without full estimate (avoids recursion).
   * @private
   */
  private getRecommendedMethodOnly(
    query: string,
    entityCount: number,
    preferredMethods?: SearchMethod[]
  ): SearchMethod {
    const methods = preferredMethods ?? (['basic', 'ranked', 'boolean', 'fuzzy', 'semantic'] as SearchMethod[]);

    // Score each method and find the best
    let bestMethod = methods[0];
    let bestScore = this.scoreMethod(methods[0], query, entityCount);

    for (let i = 1; i < methods.length; i++) {
      const score = this.scoreMethod(methods[i], query, entityCount);
      if (score > bestScore) {
        bestScore = score;
        bestMethod = methods[i];
      }
    }

    return bestMethod;
  }

  /**
   * Get estimates for all available search methods.
   *
   * @param query - The search query
   * @param entityCount - Number of entities in the graph
   * @returns Array of estimates for all methods
   */
  estimateAllMethods(query: string, entityCount: number): QueryCostEstimate[] {
    const methods: SearchMethod[] = ['basic', 'ranked', 'boolean', 'fuzzy', 'semantic'];
    const recommendedMethod = this.getRecommendedMethodOnly(query, entityCount);
    return methods.map(method =>
      this.estimateMethodInternal(method, query, entityCount, method === recommendedMethod)
    );
  }

  /**
   * Recommend the best search method for a query.
   *
   * @param query - The search query
   * @param entityCount - Number of entities in the graph
   * @param preferredMethods - Optional array of methods to consider (default: all)
   * @returns The recommended method and reason
   */
  recommendMethod(
    query: string,
    entityCount: number,
    preferredMethods?: SearchMethod[]
  ): { method: SearchMethod; reason: string; estimate: QueryCostEstimate } {
    const methods = preferredMethods ?? (['basic', 'ranked', 'boolean', 'fuzzy', 'semantic'] as SearchMethod[]);

    // Score each method based on query characteristics and cost
    const scores = methods.map(method => ({
      method,
      score: this.scoreMethod(method, query, entityCount),
      estimate: this.estimateMethod(method, query, entityCount),
    }));

    // Sort by score (higher is better)
    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];
    const reason = this.getSelectionReason(best.method, query, entityCount);

    return {
      method: best.method,
      reason,
      estimate: best.estimate,
    };
  }

  /**
   * Get the base time per entity for a search method.
   * @private
   */
  private getBaseTimeForMethod(method: SearchMethod): number {
    switch (method) {
      case 'basic':
        return this.options.basicTimePerEntity;
      case 'ranked':
        return this.options.rankedTimePerEntity;
      case 'boolean':
        return this.options.booleanTimePerEntity;
      case 'fuzzy':
        return this.options.fuzzyTimePerEntity;
      case 'semantic':
        return this.options.semanticTimePerEntity;
    }
  }

  /**
   * Calculate a complexity factor based on query characteristics.
   * @private
   */
  private getQueryComplexityFactor(query: string, method: SearchMethod): number {
    const words = query.trim().split(/\s+/).length;
    const hasOperators = /\b(AND|OR|NOT)\b/.test(query);
    const hasWildcard = query.includes('*');
    const hasQuotes = query.includes('"');

    let factor = 1.0;

    // More words = slightly more complex
    factor += (words - 1) * 0.1;

    // Boolean operators increase boolean search cost, decrease others
    if (hasOperators) {
      if (method === 'boolean') {
        factor *= 0.8; // Boolean search is optimized for operators
      } else {
        factor *= 1.5; // Other methods struggle with operators
      }
    }

    // Wildcards increase fuzzy search efficiency
    if (hasWildcard) {
      if (method === 'fuzzy') {
        factor *= 0.9;
      } else {
        factor *= 1.3;
      }
    }

    // Quoted phrases benefit ranked search
    if (hasQuotes) {
      if (method === 'ranked') {
        factor *= 0.9;
      } else {
        factor *= 1.1;
      }
    }

    return Math.max(0.5, Math.min(factor, 3.0)); // Clamp between 0.5 and 3.0
  }

  /**
   * Get the complexity level based on entity count.
   * @private
   */
  private getComplexity(entityCount: number): 'low' | 'medium' | 'high' {
    if (entityCount <= this.options.lowComplexityThreshold) {
      return 'low';
    }
    if (entityCount >= this.options.highComplexityThreshold) {
      return 'high';
    }
    return 'medium';
  }

  /**
   * Generate a human-readable recommendation.
   * @private
   */
  private getRecommendation(
    method: SearchMethod,
    _query: string,
    _entityCount: number,
    complexity: 'low' | 'medium' | 'high'
  ): string {
    const recommendations: Record<SearchMethod, string> = {
      basic: 'Fast substring matching, best for simple queries',
      ranked: 'TF-IDF relevance ranking, best for finding most relevant results',
      boolean: 'Boolean operators (AND/OR/NOT), best for precise filtering',
      fuzzy: 'Tolerant of typos and misspellings, best for uncertain queries',
      semantic: 'Meaning-based search using embeddings, best for conceptual queries',
    };

    let recommendation = recommendations[method];

    if (complexity === 'high' && method === 'semantic') {
      recommendation += ' - may be slow for large graphs';
    }

    if (complexity === 'low') {
      recommendation += ' - fast for small graphs';
    }

    return recommendation;
  }

  /**
   * Score a method based on query characteristics and graph size.
   * Higher score = better fit.
   * @private
   */
  private scoreMethod(method: SearchMethod, query: string, entityCount: number): number {
    let score = 50; // Base score

    const hasOperators = /\b(AND|OR|NOT)\b/.test(query);
    const hasWildcard = query.includes('*');
    const hasQuotes = query.includes('"');
    const words = query.trim().split(/\s+/).length;
    const isShortQuery = words <= 2;
    const isLongQuery = words >= 5;
    const complexity = this.getComplexity(entityCount);

    switch (method) {
      case 'basic':
        // Basic is good for simple, short queries on any size graph
        if (isShortQuery && !hasOperators && !hasWildcard) {
          score += 30;
        }
        if (complexity === 'low') {
          score += 20;
        }
        // Basic is fastest, give bonus for speed
        score += 10;
        break;

      case 'ranked':
        // Ranked is good for relevance-focused queries
        if (words >= 2) {
          score += 25; // Better for multi-word queries
        }
        if (hasQuotes) {
          score += 15; // Good for phrase matching
        }
        if (!hasOperators) {
          score += 10; // Not optimized for boolean
        }
        // Good balance of speed and quality
        score += 15;
        break;

      case 'boolean':
        // Boolean is best for queries with operators
        if (hasOperators) {
          score += 40;
        }
        if (!hasOperators) {
          score -= 20; // Not useful without operators
        }
        // Fast for filtering
        score += 10;
        break;

      case 'fuzzy':
        // Fuzzy is good for typo-tolerant search
        if (hasWildcard) {
          score += 25;
        }
        if (isShortQuery) {
          score += 15; // Works best on shorter queries
        }
        if (isLongQuery) {
          score -= 15; // Slow on long queries
        }
        if (complexity === 'high') {
          score -= 20; // Slow on large graphs
        }
        break;

      case 'semantic':
        // Semantic is good for conceptual/meaning-based queries
        if (isLongQuery) {
          score += 30; // Better for longer, more descriptive queries
        }
        if (!hasOperators && !hasWildcard) {
          score += 15; // Natural language queries
        }
        // Penalize for large graphs (slow)
        if (complexity === 'high') {
          score -= 30;
        }
        if (complexity === 'medium') {
          score -= 10;
        }
        break;
    }

    return score;
  }

  /**
   * Get a human-readable reason for why a method was selected.
   * @private
   */
  private getSelectionReason(method: SearchMethod, query: string, entityCount: number): string {
    const hasOperators = /\b(AND|OR|NOT)\b/.test(query);
    const hasWildcard = query.includes('*');
    const words = query.trim().split(/\s+/).length;
    const complexity = this.getComplexity(entityCount);

    switch (method) {
      case 'basic':
        if (complexity === 'low') {
          return 'Basic search selected for small graph size - fast and efficient';
        }
        return 'Basic search selected for simple query pattern';

      case 'ranked':
        if (words >= 2) {
          return 'Ranked search selected for multi-word query - provides relevance ordering';
        }
        return 'Ranked search selected for best balance of speed and relevance';

      case 'boolean':
        if (hasOperators) {
          return 'Boolean search selected - query contains logical operators (AND/OR/NOT)';
        }
        return 'Boolean search selected for precise filtering';

      case 'fuzzy':
        if (hasWildcard) {
          return 'Fuzzy search selected - query contains wildcard patterns';
        }
        return 'Fuzzy search selected for typo-tolerant matching';

      case 'semantic':
        if (words >= 5) {
          return 'Semantic search selected - longer natural language query benefits from meaning-based matching';
        }
        return 'Semantic search selected for conceptual/meaning-based matching';
    }
  }
}
