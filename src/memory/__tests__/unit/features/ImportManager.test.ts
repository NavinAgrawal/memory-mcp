/**
 * ImportManager Unit Tests
 *
 * Tests for JSON, CSV, and GraphML imports with merge strategies.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ImportManager } from '../../../features/ImportManager.js';
import { GraphStorage } from '../../../core/GraphStorage.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ImportManager', () => {
  let storage: GraphStorage;
  let manager: ImportManager;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `import-manager-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'test-memory.jsonl');
    storage = new GraphStorage(testFilePath);
    manager = new ImportManager(storage);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('JSON Import', () => {
    it('should import valid JSON', async () => {
      const jsonData = JSON.stringify({
        entities: [{ name: 'Test', entityType: 'test', observations: ['data'] }],
        relations: [],
      });

      const result = await manager.importGraph('json', jsonData);

      expect(result.entitiesAdded).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should import entities and relations', async () => {
      const jsonData = JSON.stringify({
        entities: [
          { name: 'Alice', entityType: 'person', observations: [] },
          { name: 'Bob', entityType: 'person', observations: [] },
        ],
        relations: [
          { from: 'Alice', to: 'Bob', relationType: 'knows' },
        ],
      });

      const result = await manager.importGraph('json', jsonData);

      expect(result.entitiesAdded).toBe(2);
      expect(result.relationsAdded).toBe(1);
    });

    it('should handle malformed JSON', async () => {
      const result = await manager.importGraph('json', 'not valid json');

      expect(result.entitiesAdded).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to parse');
    });

    it('should handle missing entities array', async () => {
      const result = await manager.importGraph('json', '{"relations": []}');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('missing or invalid entities');
    });

    it('should handle missing relations array', async () => {
      const result = await manager.importGraph('json', '{"entities": []}');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('missing or invalid relations');
    });
  });

  describe('CSV Import', () => {
    it('should import valid CSV', async () => {
      const csvData = `# ENTITIES
name,entityType,observations,createdAt,lastModified,tags,importance
Alice,person,Programmer,,,backend;coding,7

# RELATIONS
from,to,relationType,createdAt,lastModified`;

      const result = await manager.importGraph('csv', csvData);

      expect(result.entitiesAdded).toBe(1);
    });

    it('should parse multiple entities and relations', async () => {
      const csvData = `# ENTITIES
name,entityType,observations,createdAt,lastModified,tags,importance
Alice,person,Dev,,,,
Bob,person,Manager,,,,

# RELATIONS
from,to,relationType,createdAt,lastModified
Alice,Bob,reports_to,,`;

      const result = await manager.importGraph('csv', csvData);

      expect(result.entitiesAdded).toBe(2);
      expect(result.relationsAdded).toBe(1);
    });

    it('should handle semicolon-separated observations', async () => {
      const csvData = `# ENTITIES
name,entityType,observations,createdAt,lastModified,tags,importance
Test,test,obs1; obs2; obs3,,,,

# RELATIONS
from,to,relationType,createdAt,lastModified`;

      await manager.importGraph('csv', csvData);
      const graph = await storage.loadGraph();

      expect(graph.entities[0].observations).toHaveLength(3);
    });

    it('should handle escaped CSV fields', async () => {
      const csvData = `# ENTITIES
name,entityType,observations,createdAt,lastModified,tags,importance
"Name, with comma",test,"Obs ""quoted""",,,

# RELATIONS
from,to,relationType,createdAt,lastModified`;

      await manager.importGraph('csv', csvData);
      const graph = await storage.loadGraph();

      expect(graph.entities[0].name).toBe('Name, with comma');
    });

    it('should handle empty CSV sections', async () => {
      const csvData = `# ENTITIES
name,entityType,observations,createdAt,lastModified,tags,importance

# RELATIONS
from,to,relationType,createdAt,lastModified`;

      const result = await manager.importGraph('csv', csvData);

      expect(result.entitiesAdded).toBe(0);
      expect(result.relationsAdded).toBe(0);
    });
  });

  describe('GraphML Import', () => {
    it('should import valid GraphML', async () => {
      const graphmlData = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <graph id="G" edgedefault="directed">
    <node id="Alice">
      <data key="d0">person</data>
      <data key="d1">Developer</data>
    </node>
  </graph>
</graphml>`;

      const result = await manager.importGraph('graphml', graphmlData);

      expect(result.entitiesAdded).toBe(1);
    });

    it('should import nodes and edges', async () => {
      const graphmlData = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <graph id="G" edgedefault="directed">
    <node id="Alice">
      <data key="d0">person</data>
      <data key="d1"></data>
    </node>
    <node id="Bob">
      <data key="d0">person</data>
      <data key="d1"></data>
    </node>
    <edge id="e1" source="Alice" target="Bob">
      <data key="e0">knows</data>
    </edge>
  </graph>
</graphml>`;

      const result = await manager.importGraph('graphml', graphmlData);

      expect(result.entitiesAdded).toBe(2);
      expect(result.relationsAdded).toBe(1);
    });

    it('should handle GraphML with multiple data keys', async () => {
      const graphmlData = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <graph id="G" edgedefault="directed">
    <node id="Test">
      <data key="d0">test</data>
      <data key="d1">obs1; obs2</data>
      <data key="d4">tag1; tag2</data>
      <data key="d5">8</data>
    </node>
  </graph>
</graphml>`;

      await manager.importGraph('graphml', graphmlData);
      const graph = await storage.loadGraph();

      expect(graph.entities[0].observations).toContain('obs1');
      expect(graph.entities[0].tags).toContain('tag1');
    });
  });

  describe('Merge Strategies', () => {
    beforeEach(async () => {
      await storage.saveGraph({
        entities: [{ name: 'Existing', entityType: 'test', observations: ['original'] }],
        relations: [],
      });
    });

    describe('skip strategy', () => {
      it('should skip existing entities', async () => {
        const jsonData = JSON.stringify({
          entities: [{ name: 'Existing', entityType: 'test', observations: ['new'] }],
          relations: [],
        });

        const result = await manager.importGraph('json', jsonData, 'skip');

        expect(result.entitiesSkipped).toBe(1);
        expect(result.entitiesUpdated).toBe(0);

        const graph = await storage.loadGraph();
        expect(graph.entities[0].observations).toEqual(['original']);
      });
    });

    describe('replace strategy', () => {
      it('should replace existing entities', async () => {
        const jsonData = JSON.stringify({
          entities: [{ name: 'Existing', entityType: 'replaced', observations: ['new'] }],
          relations: [],
        });

        const result = await manager.importGraph('json', jsonData, 'replace');

        expect(result.entitiesUpdated).toBe(1);

        const graph = await storage.loadGraph();
        expect(graph.entities[0].entityType).toBe('replaced');
        expect(graph.entities[0].observations).toEqual(['new']);
      });
    });

    describe('merge strategy', () => {
      it('should merge observations', async () => {
        const jsonData = JSON.stringify({
          entities: [{ name: 'Existing', entityType: 'test', observations: ['new'] }],
          relations: [],
        });

        const result = await manager.importGraph('json', jsonData, 'merge');

        expect(result.entitiesUpdated).toBe(1);

        const graph = await storage.loadGraph();
        expect(graph.entities[0].observations).toContain('original');
        expect(graph.entities[0].observations).toContain('new');
      });

      it('should merge tags', async () => {
        await storage.saveGraph({
          entities: [{ name: 'Existing', entityType: 'test', observations: [], tags: ['tag1'] }],
          relations: [],
        });

        const jsonData = JSON.stringify({
          entities: [{ name: 'Existing', entityType: 'test', observations: [], tags: ['tag2'] }],
          relations: [],
        });

        await manager.importGraph('json', jsonData, 'merge');

        const graph = await storage.loadGraph();
        expect(graph.entities[0].tags).toContain('tag1');
        expect(graph.entities[0].tags).toContain('tag2');
      });

      it('should update importance', async () => {
        const jsonData = JSON.stringify({
          entities: [{ name: 'Existing', entityType: 'test', observations: [], importance: 9 }],
          relations: [],
        });

        await manager.importGraph('json', jsonData, 'merge');

        const graph = await storage.loadGraph();
        expect(graph.entities[0].importance).toBe(9);
      });
    });

    describe('fail strategy', () => {
      it('should add errors for existing entities', async () => {
        const jsonData = JSON.stringify({
          entities: [{ name: 'Existing', entityType: 'test', observations: [] }],
          relations: [],
        });

        const result = await manager.importGraph('json', jsonData, 'fail');

        expect(result.errors).toContain('Entity "Existing" already exists');
      });

      it('should not apply changes with errors', async () => {
        const jsonData = JSON.stringify({
          entities: [
            { name: 'Existing', entityType: 'test', observations: ['changed'] },
            { name: 'New', entityType: 'test', observations: [] },
          ],
          relations: [],
        });

        await manager.importGraph('json', jsonData, 'fail');

        const graph = await storage.loadGraph();
        expect(graph.entities).toHaveLength(1);
        expect(graph.entities[0].observations).toEqual(['original']);
      });
    });
  });

  describe('Relation Validation', () => {
    it('should report error for missing source entity', async () => {
      const jsonData = JSON.stringify({
        entities: [{ name: 'Bob', entityType: 'person', observations: [] }],
        relations: [{ from: 'Alice', to: 'Bob', relationType: 'knows' }],
      });

      const result = await manager.importGraph('json', jsonData);

      expect(result.errors).toContain('Relation source entity "Alice" does not exist');
    });

    it('should report error for missing target entity', async () => {
      const jsonData = JSON.stringify({
        entities: [{ name: 'Alice', entityType: 'person', observations: [] }],
        relations: [{ from: 'Alice', to: 'Bob', relationType: 'knows' }],
      });

      const result = await manager.importGraph('json', jsonData);

      expect(result.errors).toContain('Relation target entity "Bob" does not exist');
    });

    it('should skip duplicate relations', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'Alice', entityType: 'person', observations: [] },
          { name: 'Bob', entityType: 'person', observations: [] },
        ],
        relations: [{ from: 'Alice', to: 'Bob', relationType: 'knows' }],
      });

      const jsonData = JSON.stringify({
        entities: [],
        relations: [{ from: 'Alice', to: 'Bob', relationType: 'knows' }],
      });

      const result = await manager.importGraph('json', jsonData);

      expect(result.relationsSkipped).toBe(1);
    });
  });

  describe('Dry Run', () => {
    it('should not apply changes in dry run mode', async () => {
      const jsonData = JSON.stringify({
        entities: [{ name: 'DryRun', entityType: 'test', observations: [] }],
        relations: [],
      });

      const result = await manager.importGraph('json', jsonData, 'skip', true);

      expect(result.entitiesAdded).toBe(1);

      const graph = await storage.loadGraph();
      expect(graph.entities).toHaveLength(0);
    });

    it('should report what would be imported', async () => {
      await storage.saveGraph({
        entities: [{ name: 'Existing', entityType: 'test', observations: [] }],
        relations: [],
      });

      const jsonData = JSON.stringify({
        entities: [
          { name: 'Existing', entityType: 'test', observations: [] },
          { name: 'New', entityType: 'test', observations: [] },
        ],
        relations: [],
      });

      const result = await manager.importGraph('json', jsonData, 'skip', true);

      expect(result.entitiesAdded).toBe(1);
      expect(result.entitiesSkipped).toBe(1);
    });
  });

  describe('Unsupported Format', () => {
    it('should handle unsupported format', async () => {
      const result = await manager.importGraph('yaml' as any, 'data');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Unsupported');
    });
  });
});
