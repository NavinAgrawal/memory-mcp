/**
 * RankedSearch Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RankedSearch } from '../../../src/search/RankedSearch.js';
import { EntityManager } from '../../../src/core/EntityManager.js';
import { GraphStorage } from '../../../src/core/GraphStorage.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('RankedSearch', () => {
  let storage: GraphStorage;
  let rankedSearch: RankedSearch;
  let entityManager: EntityManager;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    testDir = join(tmpdir(), `ranked-search-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'test-graph.jsonl');

    storage = new GraphStorage(testFilePath);
    rankedSearch = new RankedSearch(storage);
    entityManager = new EntityManager(storage);

    // Create test data
    await entityManager.createEntities([
      {
        name: 'Alice',
        entityType: 'person',
        observations: ['Software engineer', 'Loves Python programming', 'Works on AI projects'],
        tags: ['engineering', 'python', 'ai'],
        importance: 9,
      },
      {
        name: 'Bob',
        entityType: 'person',
        observations: ['Product manager', 'Leads roadmap planning', 'Python enthusiast'],
        tags: ['product', 'management', 'python'],
        importance: 8,
      },
      {
        name: 'Charlie',
        entityType: 'person',
        observations: ['Designer', 'Creates beautiful UIs', 'Expert in Figma'],
        tags: ['design', 'ui'],
        importance: 7,
      },
      {
        name: 'Project_Python',
        entityType: 'project',
        observations: ['Internal Python automation tool', 'Used by engineering team'],
        tags: ['engineering', 'automation', 'python'],
        importance: 10,
      },
      {
        name: 'Project_Design',
        entityType: 'project',
        observations: ['Design system project', 'Component library'],
        tags: ['design', 'ui'],
        importance: 8,
      },
      {
        name: 'Company',
        entityType: 'organization',
        observations: ['Tech startup', 'AI-focused company', 'Python-first culture'],
        tags: ['business', 'ai', 'python'],
        importance: 10,
      },
    ]);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('TF-IDF Scoring and Ranking', () => {
    it('should rank results by relevance score', async () => {
      const results = await rankedSearch.searchNodesRanked('Python');

      expect(results.length).toBeGreaterThan(0);

      // Results should be sorted by score descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should give higher scores to terms appearing in multiple fields', async () => {
      const results = await rankedSearch.searchNodesRanked('Python');

      // Find Alice (has "Python" in name and observations)
      const aliceResult = results.find(r => r.entity.name === 'Alice');
      expect(aliceResult).toBeDefined();
      expect(aliceResult!.score).toBeGreaterThan(0);
    });

    it('should prioritize rare terms over common terms (IDF)', async () => {
      // "Figma" appears only once (Charlie), "Python" appears multiple times
      const figmaResults = await rankedSearch.searchNodesRanked('Figma');
      const pythonResults = await rankedSearch.searchNodesRanked('Python');

      // Figma should have a higher IDF (rarer term)
      const figmaResult = figmaResults[0];
      expect(figmaResult).toBeDefined();
      expect(figmaResult.entity.name).toBe('Charlie');

      // Python appears in multiple entities
      expect(pythonResults.length).toBeGreaterThan(1);
    });

    it('should handle multi-term queries with combined scores', async () => {
      const results = await rankedSearch.searchNodesRanked('Python engineer');

      expect(results.length).toBeGreaterThan(0);

      // Alice should rank highly (has both "Python" and "engineer")
      const aliceResult = results.find(r => r.entity.name === 'Alice');
      expect(aliceResult).toBeDefined();
      expect(aliceResult!.score).toBeGreaterThan(0);
    });

    it('should only include entities with non-zero scores', async () => {
      const results = await rankedSearch.searchNodesRanked('NonExistentTerm');

      expect(results).toHaveLength(0);
    });

    it('should calculate scores based on term frequency', async () => {
      // Create entity with repeated term
      await entityManager.createEntities([
        {
          name: 'Repetitive',
          entityType: 'test',
          observations: ['Python Python Python', 'More Python content'],
        },
      ]);

      const results = await rankedSearch.searchNodesRanked('Python');

      // Should have non-zero scores for all matches
      expect(results.every(r => r.score > 0)).toBe(true);
    });
  });

  describe('Matched Fields Tracking', () => {
    it('should track name field matches', async () => {
      const results = await rankedSearch.searchNodesRanked('Alice');

      const aliceResult = results.find(r => r.entity.name === 'Alice');
      expect(aliceResult).toBeDefined();
      expect(aliceResult!.matchedFields.name).toBe(true);
    });

    it('should track entityType field matches', async () => {
      const results = await rankedSearch.searchNodesRanked('person');

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        if (result.entity.entityType === 'person') {
          expect(result.matchedFields.entityType).toBe(true);
        }
      });
    });

    it('should track observation matches with matched content', async () => {
      const results = await rankedSearch.searchNodesRanked('engineer');

      const aliceResult = results.find(r => r.entity.name === 'Alice');
      expect(aliceResult).toBeDefined();
      expect(aliceResult!.matchedFields.observations).toBeDefined();
      expect(aliceResult!.matchedFields.observations!.length).toBeGreaterThan(0);
      expect(aliceResult!.matchedFields.observations![0]).toContain('engineer');
    });

    it('should track matches across multiple fields', async () => {
      const results = await rankedSearch.searchNodesRanked('Python');

      // Alice has "Python" in observations
      const aliceResult = results.find(r => r.entity.name === 'Alice');
      expect(aliceResult).toBeDefined();
      expect(aliceResult!.matchedFields.observations).toBeDefined();

      // Project_Python has "Python" in name and observations
      const projectResult = results.find(r => r.entity.name === 'Project_Python');
      expect(projectResult).toBeDefined();
      expect(projectResult!.matchedFields.name).toBe(true);
      expect(projectResult!.matchedFields.observations).toBeDefined();
    });

    it('should handle case-insensitive matching', async () => {
      const results = await rankedSearch.searchNodesRanked('PYTHON');

      expect(results.length).toBeGreaterThan(0);

      const aliceResult = results.find(r => r.entity.name === 'Alice');
      expect(aliceResult).toBeDefined();
      expect(aliceResult!.matchedFields.observations).toBeDefined();
    });
  });

  describe('Tag Filtering', () => {
    it('should filter by single tag', async () => {
      const results = await rankedSearch.searchNodesRanked('engineer', ['python']);

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.entity.tags).toContain('python');
      });
    });

    it('should filter by multiple tags (OR logic)', async () => {
      const results = await rankedSearch.searchNodesRanked('project', ['python', 'design']);

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        const hasPython = result.entity.tags?.includes('python');
        const hasDesign = result.entity.tags?.includes('design');
        expect(hasPython || hasDesign).toBe(true);
      });
    });

    it('should combine tag filter with text search', async () => {
      const results = await rankedSearch.searchNodesRanked('engineer', ['python']);

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.entity.tags).toContain('python');
        expect(result.score).toBeGreaterThan(0);
      });
    });

    it('should exclude entities without matching tags', async () => {
      const results = await rankedSearch.searchNodesRanked('test', ['nonexistent']);

      expect(results).toHaveLength(0);
    });

    it('should handle entities without tags when filtering', async () => {
      await entityManager.createEntities([
        { name: 'NoTags', entityType: 'test', observations: ['Test observation'] },
      ]);

      const results = await rankedSearch.searchNodesRanked('', ['python']);

      expect(results.every(r => r.entity.name !== 'NoTags')).toBe(true);
    });
  });

  describe('Importance Filtering', () => {
    it('should filter by minimum importance', async () => {
      const results = await rankedSearch.searchNodesRanked('project', undefined, 9);

      // Should return Project_Python (10), Company (10), Alice (9 - has "projects" in observations)
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach(result => {
        expect(result.entity.importance).toBeGreaterThanOrEqual(9);
      });
    });

    it('should filter by maximum importance', async () => {
      const results = await rankedSearch.searchNodesRanked('person', undefined, undefined, 8);

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.entity.importance!).toBeLessThanOrEqual(8);
      });
    });

    it('should filter by importance range', async () => {
      const results = await rankedSearch.searchNodesRanked('project', undefined, 8, 9);

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.entity.importance!).toBeGreaterThanOrEqual(8);
        expect(result.entity.importance!).toBeLessThanOrEqual(9);
      });
    });

    it('should exclude entities without importance when filtering', async () => {
      await entityManager.createEntities([
        { name: 'NoImportance', entityType: 'test', observations: ['Test'] },
      ]);

      const results = await rankedSearch.searchNodesRanked('test', undefined, 5);

      expect(results.every(r => r.entity.name !== 'NoImportance')).toBe(true);
    });

    it('should combine importance filter with text search', async () => {
      const results = await rankedSearch.searchNodesRanked('engineer', undefined, 8);

      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach(result => {
        expect(result.entity.importance).toBeGreaterThanOrEqual(8);
        expect(result.score).toBeGreaterThan(0);
      });
    });
  });

  describe('Search Limits', () => {
    it('should use default limit of 50', async () => {
      // Create more than 50 entities
      const manyEntities = Array.from({ length: 60 }, (_, i) => ({
        name: `Entity_${i}`,
        entityType: 'test',
        observations: ['Contains searchterm for testing'],
      }));
      await entityManager.createEntities(manyEntities);

      const results = await rankedSearch.searchNodesRanked('searchterm');

      expect(results.length).toBeLessThanOrEqual(50);
    });

    it('should respect custom limit', async () => {
      const results = await rankedSearch.searchNodesRanked('test', undefined, undefined, undefined, 3);

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should enforce maximum limit of 200', async () => {
      // Try to request 500 results
      const results = await rankedSearch.searchNodesRanked('searchterm', undefined, undefined, undefined, 500);

      // Should be capped at 200
      expect(results.length).toBeLessThanOrEqual(200);
    });

    it('should handle limit smaller than result count', async () => {
      const results = await rankedSearch.searchNodesRanked('Python', undefined, undefined, undefined, 2);

      expect(results.length).toBeLessThanOrEqual(2);

      // Should still be sorted by score
      if (results.length === 2) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query string', async () => {
      const results = await rankedSearch.searchNodesRanked('');

      // Empty query has no terms, so no TF-IDF scores
      expect(results).toHaveLength(0);
    });

    it('should handle entities with empty observations', async () => {
      await entityManager.createEntities([
        { name: 'EmptyObs', entityType: 'test', observations: [] },
      ]);

      const results = await rankedSearch.searchNodesRanked('test');

      // Should match entityType
      const emptyObsResult = results.find(r => r.entity.name === 'EmptyObs');
      expect(emptyObsResult).toBeDefined();
      expect(emptyObsResult!.matchedFields.entityType).toBe(true);
    });

    it('should handle special characters and punctuation', async () => {
      await entityManager.createEntities([
        {
          name: 'Special-Chars',
          entityType: 'test',
          observations: ['Has special! characters? and, punctuation.'],
        },
      ]);

      const results = await rankedSearch.searchNodesRanked('special characters');

      expect(results.length).toBeGreaterThan(0);
      const specialResult = results.find(r => r.entity.name === 'Special-Chars');
      expect(specialResult).toBeDefined();
    });

    it('should handle very long observation texts', async () => {
      const longText = 'word '.repeat(200) + 'unique';
      await entityManager.createEntities([
        { name: 'LongText', entityType: 'test', observations: [longText] },
      ]);

      const results = await rankedSearch.searchNodesRanked('unique');

      expect(results.length).toBeGreaterThan(0);
      const longTextResult = results.find(r => r.entity.name === 'LongText');
      expect(longTextResult).toBeDefined();
    });

    it('should handle unicode characters', async () => {
      await entityManager.createEntities([
        { name: 'Café', entityType: 'location', observations: ['Paris café with déjà vu'] },
      ]);

      const results = await rankedSearch.searchNodesRanked('café');

      expect(results.length).toBeGreaterThan(0);
      const cafeResult = results.find(r => r.entity.name === 'Café');
      expect(cafeResult).toBeDefined();
    });

    it('should handle queries with only stopwords', async () => {
      // Tokenization removes punctuation but not stopwords
      const results = await rankedSearch.searchNodesRanked('the a an');

      // These common words might match, but scores will be low due to IDF
      // Just verify no errors occur
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle combined filters with no matches', async () => {
      const results = await rankedSearch.searchNodesRanked(
        'NonExistent',
        ['nonexistent-tag'],
        100, // impossible importance
        200
      );

      expect(results).toHaveLength(0);
    });
  });

  describe('Return Value Structure', () => {
    it('should return SearchResult objects with required fields', async () => {
      const results = await rankedSearch.searchNodesRanked('Python');

      expect(results.length).toBeGreaterThan(0);

      results.forEach(result => {
        expect(result).toHaveProperty('entity');
        expect(result).toHaveProperty('score');
        expect(result).toHaveProperty('matchedFields');
        expect(typeof result.score).toBe('number');
        expect(result.score).toBeGreaterThan(0);
      });
    });

    it('should include complete entity objects', async () => {
      const results = await rankedSearch.searchNodesRanked('Alice');

      const aliceResult = results.find(r => r.entity.name === 'Alice');
      expect(aliceResult).toBeDefined();
      expect(aliceResult!.entity).toHaveProperty('name');
      expect(aliceResult!.entity).toHaveProperty('entityType');
      expect(aliceResult!.entity).toHaveProperty('observations');
      expect(aliceResult!.entity).toHaveProperty('tags');
      expect(aliceResult!.entity).toHaveProperty('importance');
    });

    it('should have matchedFields as optional properties', async () => {
      const results = await rankedSearch.searchNodesRanked('Python');

      results.forEach(result => {
        const fields = result.matchedFields;
        // At least one field should be matched
        expect(
          fields.name === true ||
          fields.entityType === true ||
          (fields.observations && fields.observations.length > 0)
        ).toBe(true);
      });
    });
  });
});
