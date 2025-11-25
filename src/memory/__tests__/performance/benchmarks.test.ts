/**
 * Performance Benchmarks
 *
 * Tests for performance budgets and benchmarks across all operations.
 * Validates that operations complete within acceptable time limits.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GraphStorage } from '../../core/GraphStorage.js';
import { EntityManager } from '../../core/EntityManager.js';
import { RelationManager } from '../../core/RelationManager.js';
import { CompressionManager } from '../../features/CompressionManager.js';
import { BasicSearch } from '../../search/BasicSearch.js';
import { RankedSearch } from '../../search/RankedSearch.js';
import { BooleanSearch } from '../../search/BooleanSearch.js';
import { FuzzySearch } from '../../search/FuzzySearch.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Performance Benchmarks', () => {
  let storage: GraphStorage;
  let entityManager: EntityManager;
  let relationManager: RelationManager;
  let compressionManager: CompressionManager;
  let basicSearch: BasicSearch;
  let rankedSearch: RankedSearch;
  let booleanSearch: BooleanSearch;
  let fuzzySearch: FuzzySearch;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `perf-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'test-graph.jsonl');

    storage = new GraphStorage(testFilePath);
    entityManager = new EntityManager(storage);
    relationManager = new RelationManager(storage);
    compressionManager = new CompressionManager(storage);
    basicSearch = new BasicSearch(storage);
    rankedSearch = new RankedSearch(storage);
    booleanSearch = new BooleanSearch(storage);
    fuzzySearch = new FuzzySearch(storage);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Entity Creation Performance', () => {
    it('should create 1 entity in < 50ms', async () => {
      const startTime = Date.now();

      await entityManager.createEntities([
        { name: 'Entity1', entityType: 'test', observations: ['Test observation'] },
      ]);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50);
    });

    it('should create 100 entities in < 200ms', async () => {
      const entities = Array.from({ length: 100 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'test',
        observations: [`Observation ${i}`],
        importance: (i % 10) + 1,
      }));

      const startTime = Date.now();
      await entityManager.createEntities(entities);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    it('should create 1000 entities in < 1500ms', async () => {
      const entities = Array.from({ length: 1000 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'test',
        observations: [`Observation ${i}`],
      }));

      const startTime = Date.now();
      await entityManager.createEntities(entities);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1500);
    });

    it('should batch update 100 entities in < 200ms', async () => {
      // Create entities first
      const entities = Array.from({ length: 100 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'test',
        observations: [`Observation ${i}`],
      }));
      await entityManager.createEntities(entities);

      // Batch update
      const updates = Array.from({ length: 100 }, (_, i) => ({
        name: `Entity${i}`,
        updates: { importance: 5 },
      }));

      const startTime = Date.now();
      await entityManager.batchUpdate(updates);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });
  });

  describe('Relation Creation Performance', () => {
    it('should create 100 relations in < 200ms', async () => {
      // Create entities first
      const entities = Array.from({ length: 50 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'test',
        observations: ['Test'],
      }));
      await entityManager.createEntities(entities);

      // Create relations
      const relations = Array.from({ length: 100 }, (_, i) => ({
        from: `Entity${i % 50}`,
        to: `Entity${(i + 1) % 50}`,
        relationType: 'connects',
      }));

      const startTime = Date.now();
      await relationManager.createRelations(relations);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    it('should create 1000 relations in < 1500ms', async () => {
      // Create entities first
      const entities = Array.from({ length: 100 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'test',
        observations: ['Test'],
      }));
      await entityManager.createEntities(entities);

      // Create relations
      const relations = Array.from({ length: 1000 }, (_, i) => ({
        from: `Entity${i % 100}`,
        to: `Entity${(i + 1) % 100}`,
        relationType: 'connects',
      }));

      const startTime = Date.now();
      await relationManager.createRelations(relations);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1500);
    });
  });

  describe('Search Performance', () => {
    beforeEach(async () => {
      // Create a moderate-sized graph
      const entities = Array.from({ length: 500 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: i % 5 === 0 ? 'person' : 'project',
        observations: [`This is observation ${i} with some searchable text`],
        tags: i % 3 === 0 ? ['tagged', 'test'] : undefined,
        importance: (i % 10) + 1,
      }));
      await entityManager.createEntities(entities);
    });

    it('should perform basic search in < 100ms', async () => {
      const startTime = Date.now();
      await basicSearch.searchNodes('Entity');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should perform ranked search in < 600ms', async () => {
      const startTime = Date.now();
      await rankedSearch.searchNodesRanked('searchable text');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(600);
    });

    it('should perform boolean search in < 150ms', async () => {
      const startTime = Date.now();
      await booleanSearch.booleanSearch('person AND observation');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(150);
    });

    it('should perform fuzzy search in < 200ms', async () => {
      const startTime = Date.now();
      await fuzzySearch.fuzzySearch('Entty', 0.7);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(200);
    });

    it('should search with filters in < 150ms', async () => {
      const startTime = Date.now();
      await basicSearch.searchNodes('Entity', ['tagged'], 5, 8);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(150);
    });

    it('should open 50 nodes in < 100ms', async () => {
      const nodeNames = Array.from({ length: 50 }, (_, i) => `Entity${i}`);

      const startTime = Date.now();
      await basicSearch.openNodes(nodeNames);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });
  });

  describe('Compression Performance', () => {
    it('should detect duplicates in 100 entities in < 300ms', async () => {
      // Create entities with some duplicates
      const entities = Array.from({ length: 100 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'person',
        observations: [i % 10 === 0 ? 'Duplicate observation' : `Unique observation ${i}`],
      }));
      await entityManager.createEntities(entities);

      const startTime = Date.now();
      await compressionManager.findDuplicates(0.8);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(300);
    });

    it('should detect duplicates in 500 entities in < 1500ms', async () => {
      // Create entities with some duplicates
      const entities = Array.from({ length: 500 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'person',
        observations: [i % 20 === 0 ? 'Duplicate observation' : `Unique observation ${i}`],
      }));
      await entityManager.createEntities(entities);

      const startTime = Date.now();
      await compressionManager.findDuplicates(0.8);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1500);
    });

    it('should compress duplicates in 100 entities in < 400ms', async () => {
      // Create similar entities
      const entities = Array.from({ length: 100 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'person',
        observations: [i % 10 === 0 ? 'Similar observation' : `Observation ${i}`],
      }));
      await entityManager.createEntities(entities);

      const startTime = Date.now();
      await compressionManager.compressGraph(0.8, false);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(400);
    });
  });

  describe('Graph Loading/Saving Performance', () => {
    it('should load graph with 100 entities in < 100ms', async () => {
      // Create entities
      const entities = Array.from({ length: 100 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'test',
        observations: [`Observation ${i}`],
      }));
      await entityManager.createEntities(entities);

      const startTime = Date.now();
      await storage.loadGraph();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should load graph with 1000 entities in < 500ms', async () => {
      // Create entities
      const entities = Array.from({ length: 1000 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'test',
        observations: [`Observation ${i}`],
      }));
      await entityManager.createEntities(entities);

      const startTime = Date.now();
      await storage.loadGraph();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
    });

    it('should save graph with 100 entities in < 150ms', async () => {
      // Create entities
      const entities = Array.from({ length: 100 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'test',
        observations: [`Observation ${i}`],
      }));
      const graph = await storage.loadGraph();
      graph.entities = entities.map(e => ({
        ...e,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      }));

      const startTime = Date.now();
      await storage.saveGraph(graph);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(150);
    });

    it('should save graph with 1000 entities in < 800ms', async () => {
      // Create entities
      const entities = Array.from({ length: 1000 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'test',
        observations: [`Observation ${i}`],
      }));
      const graph = await storage.loadGraph();
      graph.entities = entities.map(e => ({
        ...e,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      }));

      const startTime = Date.now();
      await storage.saveGraph(graph);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(800);
    });
  });

  describe('Complex Workflow Performance', () => {
    it('should complete full CRUD workflow in < 300ms', async () => {
      const startTime = Date.now();

      // Create
      await entityManager.createEntities([
        { name: 'Entity1', entityType: 'test', observations: ['Test 1'] },
        { name: 'Entity2', entityType: 'test', observations: ['Test 2'] },
      ]);

      // Read
      await entityManager.getEntity('Entity1');

      // Update
      await entityManager.updateEntity('Entity1', { importance: 5 });

      // Search
      await basicSearch.searchNodes('Entity');

      // Delete
      await entityManager.deleteEntities(['Entity2']);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(300);
    });

    it('should handle bulk workflow (create, relate, search) in < 500ms', async () => {
      const startTime = Date.now();

      // Bulk create
      const entities = Array.from({ length: 50 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'test',
        observations: [`Observation ${i}`],
      }));
      await entityManager.createEntities(entities);

      // Bulk relate
      const relations = Array.from({ length: 50 }, (_, i) => ({
        from: `Entity${i}`,
        to: `Entity${(i + 1) % 50}`,
        relationType: 'connects',
      }));
      await relationManager.createRelations(relations);

      // Search
      await basicSearch.searchNodes('Entity');

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500);
    });

    it('should handle complex query workflow in < 400ms', async () => {
      // Setup
      const entities = Array.from({ length: 100 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: i % 2 === 0 ? 'person' : 'project',
        observations: [`Observation ${i}`],
        tags: i % 3 === 0 ? ['important'] : undefined,
        importance: (i % 10) + 1,
      }));
      await entityManager.createEntities(entities);

      const startTime = Date.now();

      // Multiple complex queries
      await rankedSearch.searchNodesRanked('Observation', ['important'], 5);
      await booleanSearch.booleanSearch('person AND (important OR project)');
      await fuzzySearch.fuzzySearch('Observatn', 0.7);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(400);
    });
  });

  describe('Memory Efficiency', () => {
    it('should handle 2000 entities without excessive memory', async () => {
      // Create in batches due to 1000 entity limit
      const batch1 = Array.from({ length: 1000 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'test',
        observations: [`Observation ${i}`],
      }));
      const batch2 = Array.from({ length: 1000 }, (_, i) => ({
        name: `Entity${i + 1000}`,
        entityType: 'test',
        observations: [`Observation ${i + 1000}`],
      }));

      await entityManager.createEntities(batch1);
      await entityManager.createEntities(batch2);

      const graph = await storage.loadGraph();
      expect(graph.entities).toHaveLength(2000);
    });

    it('should handle graph with 5000 total elements (entities + relations)', async () => {
      // Create 1000 entities
      const entities = Array.from({ length: 1000 }, (_, i) => ({
        name: `Entity${i}`,
        entityType: 'test',
        observations: [`Observation ${i}`],
      }));
      await entityManager.createEntities(entities);

      // Create 4000 relations in batches due to 1000 relation limit
      const batch1 = Array.from({ length: 1000 }, (_, i) => ({
        from: `Entity${i % 1000}`,
        to: `Entity${(i + 1) % 1000}`,
        relationType: i % 2 === 0 ? 'connects' : 'relates',
      }));
      const batch2 = Array.from({ length: 1000 }, (_, i) => ({
        from: `Entity${(i + 1) % 1000}`,
        to: `Entity${(i + 2) % 1000}`,
        relationType: i % 2 === 0 ? 'links' : 'relates_to',
      }));
      const batch3 = Array.from({ length: 1000 }, (_, i) => ({
        from: `Entity${(i + 2) % 1000}`,
        to: `Entity${(i + 3) % 1000}`,
        relationType: i % 2 === 0 ? 'connects_to' : 'associates',
      }));
      const batch4 = Array.from({ length: 1000 }, (_, i) => ({
        from: `Entity${(i + 3) % 1000}`,
        to: `Entity${(i + 4) % 1000}`,
        relationType: i % 2 === 0 ? 'joins' : 'interacts',
      }));

      await relationManager.createRelations(batch1);
      await relationManager.createRelations(batch2);
      await relationManager.createRelations(batch3);
      await relationManager.createRelations(batch4);

      const graph = await storage.loadGraph();
      expect(graph.entities.length + graph.relations.length).toBe(5000);
    });
  });
});
