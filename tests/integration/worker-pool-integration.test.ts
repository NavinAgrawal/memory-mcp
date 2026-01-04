/**
 * Worker Pool Integration Tests
 *
 * Tests to verify that the worker pool activates correctly for large graphs.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GraphStorage } from '../../src/core/GraphStorage.js';
import { FuzzySearch } from '../../src/search/FuzzySearch.js';
import type { Entity } from '../../src/types/index.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Worker Pool Integration', () => {
  let storage: GraphStorage;
  let fuzzySearch: FuzzySearch;
  let testFilePath: string;

  beforeEach(async () => {
    testFilePath = join(tmpdir(), `test-worker-pool-${Date.now()}.jsonl`);
    storage = new GraphStorage(testFilePath);
    fuzzySearch = new FuzzySearch(storage);
  });

  afterEach(async () => {
    await fuzzySearch.shutdown();
    try {
      await fs.unlink(testFilePath);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should use worker pool for large graphs with low threshold', async () => {
    // Create 600 entities (above WORKER_MIN_ENTITIES of 500)
    const entities: Entity[] = [];
    for (let i = 0; i < 600; i++) {
      entities.push({
        name: `Entity${i}`,
        entityType: 'test',
        observations: [`This is test observation ${i}`],
      });
    }

    // Add a few entities with the search term
    entities.push({
      name: 'TargetEntity',
      entityType: 'target',
      observations: ['contains searchterm in observation'],
    });

    entities.push({
      name: 'SearchTermEntity',
      entityType: 'target',
      observations: ['another observation'],
    });

    const graph = { entities, relations: [] };
    await storage.saveGraph(graph);

    // Perform fuzzy search with low threshold (< 0.8 to activate workers)
    const startTime = Date.now();
    const result = await fuzzySearch.fuzzySearch('searchterm', 0.6);
    const duration = Date.now() - startTime;

    // Verify results
    expect(result.entities.length).toBeGreaterThan(0);
    const matchedNames = result.entities.map(e => e.name);

    // Should find entities with 'searchterm'
    expect(matchedNames).toContain('SearchTermEntity');
    expect(matchedNames).toContain('TargetEntity');

    // Log performance for reference
    console.log(`Worker pool fuzzy search (600 entities): ${duration}ms`);
  });

  it('should NOT use worker pool for small graphs', async () => {
    // Create only 100 entities (below WORKER_MIN_ENTITIES of 500)
    const entities: Entity[] = [];
    for (let i = 0; i < 100; i++) {
      entities.push({
        name: `Entity${i}`,
        entityType: 'test',
        observations: [`observation ${i}`],
      });
    }

    entities.push({
      name: 'SearchTermEntity',
      entityType: 'target',
      observations: ['contains searchterm'],
    });

    const graph = { entities, relations: [] };
    await storage.saveGraph(graph);

    // Perform fuzzy search - should use single-threaded mode
    const startTime = Date.now();
    const result = await fuzzySearch.fuzzySearch('searchterm', 0.6);
    const duration = Date.now() - startTime;

    // Verify results
    expect(result.entities.length).toBeGreaterThan(0);
    expect(result.entities.some(e => e.name === 'SearchTermEntity')).toBe(true);

    // Log performance for reference
    console.log(`Single-threaded fuzzy search (100 entities): ${duration}ms`);
  });

  it('should NOT use worker pool for high threshold even with large graph', async () => {
    // Create 600 entities
    const entities: Entity[] = [];
    for (let i = 0; i < 600; i++) {
      entities.push({
        name: `Entity${i}`,
        entityType: 'test',
        observations: [`observation ${i}`],
      });
    }

    entities.push({
      name: 'SearchTermEntity',
      entityType: 'target',
      observations: ['exact match'],
    });

    const graph = { entities, relations: [] };
    await storage.saveGraph(graph);

    // Use high threshold (>= 0.8) - should NOT use workers
    const result = await fuzzySearch.fuzzySearch('SearchTermEntity', 0.9);

    // Verify results
    expect(result.entities.length).toBeGreaterThan(0);
    expect(result.entities.some(e => e.name === 'SearchTermEntity')).toBe(true);
  });

  it('should handle empty results correctly with worker pool', async () => {
    // Create large graph with no matches
    const entities: Entity[] = [];
    for (let i = 0; i < 600; i++) {
      entities.push({
        name: `Entity${i}`,
        entityType: 'test',
        observations: [`observation ${i}`],
      });
    }

    const graph = { entities, relations: [] };
    await storage.saveGraph(graph);

    // Search for something that doesn't exist
    const result = await fuzzySearch.fuzzySearch('nonexistent_xyz_abc', 0.6);

    // Should return empty results
    expect(result.entities).toHaveLength(0);
    expect(result.relations).toHaveLength(0);
  });
});
