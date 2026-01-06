/**
 * Query Cost Estimator Tests
 *
 * Phase 10 Sprint 4: Tests for query cost estimation and method recommendation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { QueryCostEstimator } from '../../../src/search/QueryCostEstimator.js';
import type { SearchMethod } from '../../../src/types/index.js';

describe('QueryCostEstimator', () => {
  let estimator: QueryCostEstimator;

  beforeEach(() => {
    estimator = new QueryCostEstimator();
  });

  describe('estimateMethod', () => {
    it('should return estimate for basic search', () => {
      const estimate = estimator.estimateMethod('basic', 'test', 100);

      expect(estimate.method).toBe('basic');
      expect(estimate.estimatedTimeMs).toBeGreaterThan(0);
      expect(estimate.complexity).toBe('low');
      expect(estimate.entityCount).toBe(100);
      expect(estimate.recommendation).toContain('substring');
      expect(typeof estimate.isRecommended).toBe('boolean');
    });

    it('should return estimate for ranked search', () => {
      const estimate = estimator.estimateMethod('ranked', 'test query', 500);

      expect(estimate.method).toBe('ranked');
      expect(estimate.estimatedTimeMs).toBeGreaterThan(0);
      expect(estimate.complexity).toBe('medium');
      expect(estimate.recommendation).toContain('TF-IDF');
    });

    it('should return estimate for boolean search', () => {
      const estimate = estimator.estimateMethod('boolean', 'test AND query', 100);

      expect(estimate.method).toBe('boolean');
      expect(estimate.estimatedTimeMs).toBeGreaterThan(0);
      expect(estimate.recommendation).toContain('Boolean');
    });

    it('should return estimate for fuzzy search', () => {
      const estimate = estimator.estimateMethod('fuzzy', 'tset', 100);

      expect(estimate.method).toBe('fuzzy');
      expect(estimate.estimatedTimeMs).toBeGreaterThan(0);
      expect(estimate.recommendation).toContain('typo');
    });

    it('should return estimate for semantic search', () => {
      const estimate = estimator.estimateMethod('semantic', 'conceptual query', 100);

      expect(estimate.method).toBe('semantic');
      expect(estimate.estimatedTimeMs).toBeGreaterThan(0);
      expect(estimate.recommendation).toContain('Meaning');
    });

    it('should classify low complexity for small graphs', () => {
      const estimate = estimator.estimateMethod('basic', 'test', 50);
      expect(estimate.complexity).toBe('low');
    });

    it('should classify medium complexity for medium graphs', () => {
      const estimate = estimator.estimateMethod('basic', 'test', 500);
      expect(estimate.complexity).toBe('medium');
    });

    it('should classify high complexity for large graphs', () => {
      const estimate = estimator.estimateMethod('basic', 'test', 2000);
      expect(estimate.complexity).toBe('high');
    });

    it('should increase estimated time with entity count', () => {
      const small = estimator.estimateMethod('basic', 'test', 100);
      const large = estimator.estimateMethod('basic', 'test', 1000);

      expect(large.estimatedTimeMs).toBeGreaterThan(small.estimatedTimeMs);
    });

    it('should adjust time based on query complexity', () => {
      const simple = estimator.estimateMethod('basic', 'test', 100);
      const complex = estimator.estimateMethod('basic', 'test query with many words', 100);

      expect(complex.estimatedTimeMs).toBeGreaterThan(simple.estimatedTimeMs);
    });
  });

  describe('estimateAllMethods', () => {
    it('should return estimates for all 5 search methods', () => {
      const estimates = estimator.estimateAllMethods('test', 100);

      expect(estimates).toHaveLength(5);

      const methods = estimates.map(e => e.method);
      expect(methods).toContain('basic');
      expect(methods).toContain('ranked');
      expect(methods).toContain('boolean');
      expect(methods).toContain('fuzzy');
      expect(methods).toContain('semantic');
    });

    it('should mark exactly one method as recommended', () => {
      const estimates = estimator.estimateAllMethods('test', 100);

      const recommended = estimates.filter(e => e.isRecommended);
      expect(recommended).toHaveLength(1);
    });

    it('should have consistent entity counts', () => {
      const estimates = estimator.estimateAllMethods('test', 500);

      for (const estimate of estimates) {
        expect(estimate.entityCount).toBe(500);
      }
    });
  });

  describe('recommendMethod', () => {
    it('should recommend basic for simple short queries on small graphs', () => {
      const result = estimator.recommendMethod('test', 50);

      expect(result.method).toBe('basic');
      expect(result.reason).toContain('small graph');
    });

    it('should recommend boolean for queries with AND operator', () => {
      const result = estimator.recommendMethod('alice AND bob', 500);

      expect(result.method).toBe('boolean');
      expect(result.reason).toContain('logical operators');
    });

    it('should recommend boolean for queries with OR operator', () => {
      const result = estimator.recommendMethod('frontend OR backend', 500);

      expect(result.method).toBe('boolean');
      expect(result.reason).toContain('logical operators');
    });

    it('should recommend boolean for queries with NOT operator', () => {
      const result = estimator.recommendMethod('api NOT deprecated', 500);

      expect(result.method).toBe('boolean');
      expect(result.reason).toContain('logical operators');
    });

    it('should recommend ranked for multi-word queries', () => {
      const result = estimator.recommendMethod('machine learning algorithms', 500);

      expect(result.method).toBe('ranked');
      expect(result.reason).toContain('multi-word');
    });

    it('should recommend fuzzy for wildcard queries', () => {
      const result = estimator.recommendMethod('test*', 500);

      expect(result.method).toBe('fuzzy');
      expect(result.reason).toContain('wildcard');
    });

    it('should recommend ranked for long natural language queries', () => {
      // Note: Ranked search provides best balance of speed and relevance
      // for multi-word queries, so it's preferred over semantic
      const result = estimator.recommendMethod(
        'find all entities related to software engineering best practices',
        500
      );

      expect(result.method).toBe('ranked');
      expect(result.reason).toContain('multi-word');
    });

    it('should include estimate in result', () => {
      const result = estimator.recommendMethod('test', 100);

      expect(result.estimate).toBeDefined();
      expect(result.estimate.method).toBe(result.method);
      expect(result.estimate.estimatedTimeMs).toBeGreaterThan(0);
    });

    it('should respect preferredMethods filter', () => {
      const preferredMethods: SearchMethod[] = ['basic', 'fuzzy'];
      const result = estimator.recommendMethod('alice AND bob', 500, preferredMethods);

      expect(preferredMethods).toContain(result.method);
    });

    it('should not recommend boolean when not in preferred methods', () => {
      const preferredMethods: SearchMethod[] = ['basic', 'ranked'];
      const result = estimator.recommendMethod('test AND query', 500, preferredMethods);

      expect(result.method).not.toBe('boolean');
    });
  });

  describe('query complexity factors', () => {
    it('should reduce complexity factor for boolean search with operators', () => {
      // Boolean search should be more efficient for queries with operators
      const withOperator = estimator.estimateMethod('boolean', 'test AND query', 100);
      const withoutOperator = estimator.estimateMethod('boolean', 'test query', 100);

      // The one with operators should have lower estimated time (more efficient)
      expect(withOperator.estimatedTimeMs).toBeLessThan(withoutOperator.estimatedTimeMs);
    });

    it('should reduce complexity factor for fuzzy search with wildcards', () => {
      const withWildcard = estimator.estimateMethod('fuzzy', 'test*', 100);
      const withoutWildcard = estimator.estimateMethod('fuzzy', 'test', 100);

      expect(withWildcard.estimatedTimeMs).toBeLessThan(withoutWildcard.estimatedTimeMs);
    });

    it('should reduce complexity factor for ranked search with quotes', () => {
      const withQuotes = estimator.estimateMethod('ranked', '"exact phrase"', 100);
      const withoutQuotes = estimator.estimateMethod('ranked', 'exact phrase', 100);

      expect(withQuotes.estimatedTimeMs).toBeLessThan(withoutQuotes.estimatedTimeMs);
    });
  });

  describe('custom options', () => {
    it('should accept custom time per entity options', () => {
      const customEstimator = new QueryCostEstimator({
        basicTimePerEntity: 0.1,
        rankedTimePerEntity: 0.5,
      });

      const defaultBasic = estimator.estimateMethod('basic', 'test', 100);
      const customBasic = customEstimator.estimateMethod('basic', 'test', 100);

      // Custom should be 10x slower
      expect(customBasic.estimatedTimeMs).toBeGreaterThan(defaultBasic.estimatedTimeMs);
    });

    it('should accept custom complexity thresholds', () => {
      const customEstimator = new QueryCostEstimator({
        lowComplexityThreshold: 50,
        highComplexityThreshold: 200,
      });

      // 100 entities should be medium with custom thresholds
      const estimate = customEstimator.estimateMethod('basic', 'test', 100);
      expect(estimate.complexity).toBe('medium');

      // 100 entities should be low with default thresholds
      const defaultEstimate = estimator.estimateMethod('basic', 'test', 100);
      expect(defaultEstimate.complexity).toBe('low');
    });
  });

  describe('recommendations include graph size context', () => {
    it('should warn about slow performance for semantic on large graphs', () => {
      const estimate = estimator.estimateMethod('semantic', 'test', 2000);
      expect(estimate.recommendation).toContain('may be slow');
    });

    it('should mention fast performance for small graphs', () => {
      const estimate = estimator.estimateMethod('basic', 'test', 50);
      expect(estimate.recommendation).toContain('fast');
    });
  });
});
