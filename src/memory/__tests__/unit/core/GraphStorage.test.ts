/**
 * GraphStorage Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GraphStorage } from '../../../core/GraphStorage.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('GraphStorage', () => {
  let storage: GraphStorage;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `graph-storage-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'test-graph.jsonl');
    storage = new GraphStorage(testFilePath);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('loadGraph', () => {
    it('should return empty graph when file does not exist', async () => {
      const graph = await storage.loadGraph();

      expect(graph.entities).toEqual([]);
      expect(graph.relations).toEqual([]);
    });

    it('should load entities and relations from file', async () => {
      // Write test data
      const testData = [
        JSON.stringify({
          type: 'entity',
          name: 'Alice',
          entityType: 'person',
          observations: ['Engineer'],
          createdAt: '2024-01-01T00:00:00.000Z',
          lastModified: '2024-01-01T00:00:00.000Z',
        }),
        JSON.stringify({
          type: 'relation',
          from: 'Alice',
          to: 'Bob',
          relationType: 'knows',
          createdAt: '2024-01-01T00:00:00.000Z',
          lastModified: '2024-01-01T00:00:00.000Z',
        }),
      ].join('\n');

      await fs.writeFile(testFilePath, testData);

      const graph = await storage.loadGraph();

      expect(graph.entities).toHaveLength(1);
      expect(graph.entities[0].name).toBe('Alice');
      expect(graph.relations).toHaveLength(1);
      expect(graph.relations[0].from).toBe('Alice');
    });

    it('should add missing timestamps for backward compatibility', async () => {
      const testData = JSON.stringify({
        type: 'entity',
        name: 'Alice',
        entityType: 'person',
        observations: [],
      });

      await fs.writeFile(testFilePath, testData);

      const graph = await storage.loadGraph();

      expect(graph.entities[0].createdAt).toBeDefined();
      expect(graph.entities[0].lastModified).toBeDefined();
    });

    it('should use cache on second load', async () => {
      // First load - populates cache
      await storage.loadGraph();

      // Modify file directly
      await fs.writeFile(testFilePath, JSON.stringify({
        type: 'entity',
        name: 'Modified',
        entityType: 'test',
        observations: [],
      }));

      // Second load - should return cached data (not modified data)
      const graph = await storage.loadGraph();

      expect(graph.entities).toHaveLength(0); // Empty from first load
    });

    it('should return deep copy of cached data', async () => {
      const graph1 = await storage.loadGraph();
      graph1.entities.push({
        name: 'Mutated',
        entityType: 'test',
        observations: [],
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      });

      const graph2 = await storage.loadGraph();

      expect(graph2.entities).toHaveLength(0); // Not affected by mutation
    });
  });

  describe('saveGraph', () => {
    it('should save entities and relations to JSONL format', async () => {
      const graph = {
        entities: [
          {
            name: 'Alice',
            entityType: 'person',
            observations: ['Engineer'],
            createdAt: '2024-01-01T00:00:00.000Z',
            lastModified: '2024-01-01T00:00:00.000Z',
          },
        ],
        relations: [
          {
            from: 'Alice',
            to: 'Bob',
            relationType: 'knows',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastModified: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      await storage.saveGraph(graph);

      const content = await fs.readFile(testFilePath, 'utf-8');
      const lines = content.split('\n');

      expect(lines).toHaveLength(2);

      const entity = JSON.parse(lines[0]);
      expect(entity.type).toBe('entity');
      expect(entity.name).toBe('Alice');

      const relation = JSON.parse(lines[1]);
      expect(relation.type).toBe('relation');
      expect(relation.from).toBe('Alice');
    });

    it('should include optional entity fields', async () => {
      const graph = {
        entities: [
          {
            name: 'Alice',
            entityType: 'person',
            observations: [],
            tags: ['team'],
            importance: 8,
            parentId: 'Company',
            createdAt: '2024-01-01T00:00:00.000Z',
            lastModified: '2024-01-01T00:00:00.000Z',
          },
        ],
        relations: [],
      };

      await storage.saveGraph(graph);

      const content = await fs.readFile(testFilePath, 'utf-8');
      const entity = JSON.parse(content);

      expect(entity.tags).toEqual(['team']);
      expect(entity.importance).toBe(8);
      expect(entity.parentId).toBe('Company');
    });

    it('should invalidate cache after save', async () => {
      // Load to populate cache
      await storage.loadGraph();

      // Save new data
      const graph = {
        entities: [{
          name: 'Alice',
          entityType: 'person',
          observations: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          lastModified: '2024-01-01T00:00:00.000Z',
        }],
        relations: [],
      };
      await storage.saveGraph(graph);

      // Load again - should read from disk (cache invalidated)
      const loaded = await storage.loadGraph();

      expect(loaded.entities).toHaveLength(1);
      expect(loaded.entities[0].name).toBe('Alice');
    });
  });

  describe('clearCache', () => {
    it('should clear the in-memory cache', async () => {
      // Load to populate cache
      await storage.loadGraph();

      // Modify file
      const graph = {
        entities: [{
          name: 'NewEntity',
          entityType: 'test',
          observations: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          lastModified: '2024-01-01T00:00:00.000Z',
        }],
        relations: [],
      };
      await storage.saveGraph(graph);

      // Clear cache manually
      storage.clearCache();

      // Load - should read from disk
      const loaded = await storage.loadGraph();

      expect(loaded.entities).toHaveLength(1);
      expect(loaded.entities[0].name).toBe('NewEntity');
    });
  });

  describe('getFilePath', () => {
    it('should return the file path', () => {
      expect(storage.getFilePath()).toBe(testFilePath);
    });
  });
});
