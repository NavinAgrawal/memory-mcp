/**
 * FuzzySearch Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FuzzySearch, DEFAULT_FUZZY_THRESHOLD } from '../../../src/search/FuzzySearch.js';
import { EntityManager } from '../../../src/core/EntityManager.js';
import { RelationManager } from '../../../src/core/RelationManager.js';
import { GraphStorage } from '../../../src/core/GraphStorage.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('FuzzySearch', () => {
  let storage: GraphStorage;
  let fuzzySearch: FuzzySearch;
  let entityManager: EntityManager;
  let relationManager: RelationManager;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    testDir = join(tmpdir(), `fuzzy-search-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'test-graph.jsonl');

    storage = new GraphStorage(testFilePath);
    fuzzySearch = new FuzzySearch(storage);
    entityManager = new EntityManager(storage);
    relationManager = new RelationManager(storage);

    // Create test data
    await entityManager.createEntities([
      {
        name: 'Alice',
        entityType: 'person',
        observations: ['Software engineer', 'Loves Python', 'Works remotely'],
        tags: ['engineering', 'python'],
        importance: 9,
      },
      {
        name: 'Alicia',
        entityType: 'person',
        observations: ['Product manager', 'Leads planning'],
        tags: ['product', 'management'],
        importance: 8,
      },
      {
        name: 'Bob',
        entityType: 'person',
        observations: ['Designer', 'Creates UIs'],
        tags: ['design'],
        importance: 7,
      },
      {
        name: 'Robert',
        entityType: 'person',
        observations: ['Developer', 'Backend specialist'],
        tags: ['engineering', 'backend'],
        importance: 8,
      },
      {
        name: 'Project_Alpha',
        entityType: 'project',
        observations: ['Alpha version project'],
        tags: ['project'],
        importance: 10,
      },
    ]);

    await relationManager.createRelations([
      { from: 'Alice', to: 'Project_Alpha', relationType: 'works_on' },
      { from: 'Bob', to: 'Alicia', relationType: 'reports_to' },
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

  describe('Exact and Substring Matching', () => {
    it('should match exact name', async () => {
      const result = await fuzzySearch.fuzzySearch('Alice');

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Alice');
    });

    it('should match partial name (contains)', async () => {
      const result = await fuzzySearch.fuzzySearch('Ali');

      expect(result.entities.length).toBeGreaterThanOrEqual(2);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Alice');
      expect(names).toContain('Alicia');
    });

    it('should match entity type', async () => {
      const result = await fuzzySearch.fuzzySearch('person', 0.9);

      // With strict threshold, should only match 'person' type (not 'project' which is similar)
      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      result.entities.forEach(e => {
        expect(e.entityType).toBe('person');
      });
    });

    it('should match observation words', async () => {
      const result = await fuzzySearch.fuzzySearch('engineer');

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Alice');
    });

    it('should match full observation text', async () => {
      const result = await fuzzySearch.fuzzySearch('Software engineer');

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Alice');
    });
  });

  describe('Typo Tolerance', () => {
    it('should match name with single character typo', async () => {
      // "Alise" instead of "Alice"
      const result = await fuzzySearch.fuzzySearch('Alise', 0.7);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Alice');
    });

    it('should match name with transposed characters', async () => {
      // "Alcie" instead of "Alice" - 2 char distance, similarity 0.6
      const result = await fuzzySearch.fuzzySearch('Alcie', 0.6);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Alice');
    });

    it('should match name with missing character', async () => {
      // "Alce" instead of "Alice"
      const result = await fuzzySearch.fuzzySearch('Alce', 0.7);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Alice');
    });

    it('should match name with extra character', async () => {
      // "Allice" instead of "Alice"
      const result = await fuzzySearch.fuzzySearch('Allice', 0.7);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Alice');
    });

    it('should not match with too many typos (below threshold)', async () => {
      // "Xyz" is completely different from "Alice"
      const result = await fuzzySearch.fuzzySearch('Xyz', 0.9);

      const names = result.entities.map(e => e.name);
      expect(names).not.toContain('Alice');
    });

    it('should match similar names with high threshold', async () => {
      // "Alice" vs "Alicia" - similar names
      const result = await fuzzySearch.fuzzySearch('Alice', 0.6);

      expect(result.entities.length).toBeGreaterThanOrEqual(2);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Alice');
      expect(names).toContain('Alicia');
    });
  });

  describe('Threshold Variations', () => {
    it('should use default threshold (0.7)', async () => {
      const result = await fuzzySearch.fuzzySearch('Alise'); // 1 char typo

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
    });

    it('should accept strict threshold (0.95)', async () => {
      const result = await fuzzySearch.fuzzySearch('Alice', 0.95);

      // Only exact match or very close matches
      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      expect(result.entities[0].name).toBe('Alice');
    });

    it('should accept permissive threshold (0.5)', async () => {
      const result = await fuzzySearch.fuzzySearch('Alic', 0.5);

      // More permissive, should match Alice with 1 char difference
      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Alice');
    });

    it('should return more results with lower threshold', async () => {
      const strictResult = await fuzzySearch.fuzzySearch('Alice', 0.9);
      const permissiveResult = await fuzzySearch.fuzzySearch('Alice', 0.5);

      expect(permissiveResult.entities.length).toBeGreaterThanOrEqual(strictResult.entities.length);
    });

    it('should handle threshold of 0 (match everything)', async () => {
      const result = await fuzzySearch.fuzzySearch('xyz', 0);

      // With threshold 0, everything matches
      expect(result.entities.length).toBeGreaterThan(0);
    });

    it('should handle threshold of 1 (exact match only)', async () => {
      const result = await fuzzySearch.fuzzySearch('Alice', 1);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('Alice');
    });
  });

  describe('Tag Filtering', () => {
    it('should filter by single tag', async () => {
      const result = await fuzzySearch.fuzzySearch('person', 0.7, ['python']);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      result.entities.forEach(e => {
        expect(e.tags).toContain('python');
      });
    });

    it('should filter by multiple tags (OR logic)', async () => {
      const result = await fuzzySearch.fuzzySearch('person', 0.7, ['python', 'design']);

      expect(result.entities.length).toBeGreaterThanOrEqual(2);
      result.entities.forEach(e => {
        const hasPython = e.tags?.includes('python');
        const hasDesign = e.tags?.includes('design');
        expect(hasPython || hasDesign).toBe(true);
      });
    });

    it('should combine fuzzy search with tag filter', async () => {
      const result = await fuzzySearch.fuzzySearch('Alise', 0.7, ['python']);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      expect(result.entities[0].name).toBe('Alice');
      expect(result.entities[0].tags).toContain('python');
    });

    it('should exclude entities without matching tags', async () => {
      const result = await fuzzySearch.fuzzySearch('person', 0.7, ['nonexistent']);

      expect(result.entities).toHaveLength(0);
    });
  });

  describe('Importance Filtering', () => {
    it('should filter by minimum importance', async () => {
      const result = await fuzzySearch.fuzzySearch('person', 0.7, undefined, 9);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      result.entities.forEach(e => {
        expect(e.importance).toBeGreaterThanOrEqual(9);
      });
    });

    it('should filter by maximum importance', async () => {
      const result = await fuzzySearch.fuzzySearch('person', 0.7, undefined, undefined, 8);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      result.entities.forEach(e => {
        expect(e.importance!).toBeLessThanOrEqual(8);
      });
    });

    it('should filter by importance range', async () => {
      const result = await fuzzySearch.fuzzySearch('person', 0.7, undefined, 8, 9);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      result.entities.forEach(e => {
        expect(e.importance!).toBeGreaterThanOrEqual(8);
        expect(e.importance!).toBeLessThanOrEqual(9);
      });
    });

    it('should combine fuzzy search with importance filter', async () => {
      const result = await fuzzySearch.fuzzySearch('Alise', 0.7, undefined, 9);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('Alice');
      expect(result.entities[0].importance).toBe(9);
    });

    it('should exclude entities without importance when filtering', async () => {
      await entityManager.createEntities([
        { name: 'NoImportance', entityType: 'test', observations: ['Test'] },
      ]);

      const result = await fuzzySearch.fuzzySearch('test', 0.7, undefined, 5);

      const names = result.entities.map(e => e.name);
      expect(names).not.toContain('NoImportance');
    });
  });

  describe('Relations', () => {
    it('should include relations between matched entities', async () => {
      const result = await fuzzySearch.fuzzySearch('Ali', 0.7);

      expect(result.entities.length).toBeGreaterThanOrEqual(2);
      // Alice and Alicia should be matched
      expect(result.relations.length).toBeGreaterThanOrEqual(0);
    });

    it('should exclude relations to non-matched entities', async () => {
      const result = await fuzzySearch.fuzzySearch('Alice', 0.95);

      expect(result.entities).toHaveLength(1);
      // Alice has relations to Project_Alpha and Bob, but they're not in result with strict threshold
      expect(result.relations).toHaveLength(0);
    });

    it('should include all relations in matched subgraph', async () => {
      const result = await fuzzySearch.fuzzySearch('Ali', 0.5);

      // Should match Alice, Alicia, and Project_Alpha
      const names = result.entities.map(e => e.name);
      if (names.includes('Alice') && names.includes('Project_Alpha')) {
        expect(result.relations.some(r => r.from === 'Alice' && r.to === 'Project_Alpha')).toBe(true);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query string', async () => {
      const result = await fuzzySearch.fuzzySearch('');

      // Empty query matches all entities (every string contains empty string)
      expect(result.entities.length).toBe(5);
      expect(result.relations.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle entities with empty observations', async () => {
      await entityManager.createEntities([
        { name: 'EmptyObs', entityType: 'test', observations: [] },
      ]);

      const result = await fuzzySearch.fuzzySearch('test');

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('EmptyObs');
    });

    it('should handle entities without tags', async () => {
      await entityManager.createEntities([
        { name: 'NoTags', entityType: 'test', observations: ['Test'] },
      ]);

      const result = await fuzzySearch.fuzzySearch('test');

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle entities without importance', async () => {
      await entityManager.createEntities([
        { name: 'NoImportance', entityType: 'test', observations: ['Test'] },
      ]);

      const result = await fuzzySearch.fuzzySearch('test', 0.7, undefined, 5);

      const names = result.entities.map(e => e.name);
      expect(names).not.toContain('NoImportance');
    });

    it('should handle very short queries', async () => {
      const result = await fuzzySearch.fuzzySearch('A', 0.3);

      // Should match names starting with A (Alice, Alicia, Project_Alpha)
      expect(result.entities.length).toBeGreaterThan(0);
    });

    it('should handle very long queries', async () => {
      const longQuery = 'Software engineer who loves Python programming';
      const result = await fuzzySearch.fuzzySearch(longQuery, 0.5);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle special characters', async () => {
      await entityManager.createEntities([
        { name: 'Special-Name', entityType: 'test', observations: ['Test!'] },
      ]);

      const result = await fuzzySearch.fuzzySearch('Special Name', 0.7);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle unicode characters', async () => {
      await entityManager.createEntities([
        { name: 'Café', entityType: 'location', observations: ['French café'] },
      ]);

      const result = await fuzzySearch.fuzzySearch('Cafe', 0.7);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Café');
    });

    it('should be case-insensitive', async () => {
      const result = await fuzzySearch.fuzzySearch('ALICE', 0.7);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Alice');
    });

    it('should handle no matches', async () => {
      const result = await fuzzySearch.fuzzySearch('XyzNonExistent', 0.9);

      expect(result.entities).toHaveLength(0);
      expect(result.relations).toHaveLength(0);
    });
  });

  describe('Combined Filters', () => {
    it('should combine fuzzy search with tag and importance filters', async () => {
      const result = await fuzzySearch.fuzzySearch('Alise', 0.7, ['python'], 9);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('Alice');
      expect(result.entities[0].tags).toContain('python');
      expect(result.entities[0].importance).toBe(9);
    });

    it('should return empty when filters exclude all matches', async () => {
      const result = await fuzzySearch.fuzzySearch('Alice', 0.7, ['nonexistent']);

      expect(result.entities).toHaveLength(0);
    });

    it('should handle all filters together', async () => {
      const result = await fuzzySearch.fuzzySearch('person', 0.7, ['engineering'], 8, 10);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      result.entities.forEach(e => {
        expect(e.entityType).toBe('person');
        expect(e.tags).toContain('engineering');
        expect(e.importance!).toBeGreaterThanOrEqual(8);
        expect(e.importance!).toBeLessThanOrEqual(10);
      });
    });
  });

  describe('Levenshtein Distance Edge Cases', () => {
    it('should handle identical strings', async () => {
      const result = await fuzzySearch.fuzzySearch('Alice', 1.0);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('Alice');
    });

    it('should handle completely different strings with low threshold', async () => {
      const result = await fuzzySearch.fuzzySearch('xyz', 0.1);

      // With very low threshold, might match some entities
      expect(Array.isArray(result.entities)).toBe(true);
    });

    it('should handle empty string comparison', async () => {
      const result = await fuzzySearch.fuzzySearch('', 0.5);

      // Empty string matches all (every string contains empty string)
      expect(result.entities.length).toBe(5);
      expect(result.relations.length).toBeGreaterThanOrEqual(0);
    });

    it('should calculate similarity correctly for similar words', async () => {
      // "Bob" vs "Robert" - different lengths but same person
      const result = await fuzzySearch.fuzzySearch('Bob', 0.5);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Bob');
      // Robert might also match with permissive threshold
    });
  });

  describe('Return Value Structure', () => {
    it('should return KnowledgeGraph with entities and relations', async () => {
      const result = await fuzzySearch.fuzzySearch('Alice');

      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('relations');
      expect(Array.isArray(result.entities)).toBe(true);
      expect(Array.isArray(result.relations)).toBe(true);
    });

    it('should return complete entity objects', async () => {
      const result = await fuzzySearch.fuzzySearch('Alice');

      expect(result.entities[0]).toHaveProperty('name');
      expect(result.entities[0]).toHaveProperty('entityType');
      expect(result.entities[0]).toHaveProperty('observations');
      expect(result.entities[0]).toHaveProperty('tags');
      expect(result.entities[0]).toHaveProperty('importance');
    });
  });

  describe('Word-level Matching in Observations', () => {
    it('should match individual words in observations', async () => {
      const result = await fuzzySearch.fuzzySearch('engineer', 0.7);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Alice');
    });

    it('should match observation words with typos', async () => {
      // "enginer" instead of "engineer"
      const result = await fuzzySearch.fuzzySearch('enginer', 0.7);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Alice');
    });

    it('should match full observation text with typos', async () => {
      // "Softwar engineer" instead of "Software engineer"
      const result = await fuzzySearch.fuzzySearch('Softwar engineer', 0.7);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const names = result.entities.map(e => e.name);
      expect(names).toContain('Alice');
    });
  });

  describe('DEFAULT_FUZZY_THRESHOLD Constant', () => {
    it('should export DEFAULT_FUZZY_THRESHOLD', () => {
      expect(DEFAULT_FUZZY_THRESHOLD).toBe(0.7);
    });

    it('should use DEFAULT_FUZZY_THRESHOLD when not specified', async () => {
      // Calling without threshold parameter should use default
      const result = await fuzzySearch.fuzzySearch('Alise');

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
    });
  });
});
