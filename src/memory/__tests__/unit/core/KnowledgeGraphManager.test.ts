/**
 * KnowledgeGraphManager Unit Tests
 *
 * Tests for the central facade pattern implementation, lazy initialization,
 * path derivation, and manager delegation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KnowledgeGraphManager } from '../../../core/KnowledgeGraphManager.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('KnowledgeGraphManager', () => {
  let manager: KnowledgeGraphManager;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `kgm-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'test-memory.jsonl');
    manager = new KnowledgeGraphManager(testFilePath);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Constructor and File Path Derivation', () => {
    it('should create manager with file path', () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(KnowledgeGraphManager);
    });

    it('should derive saved-searches file path correctly', async () => {
      // Create a saved search to trigger file creation
      await manager.saveSearch({ name: 'test', query: 'test' });

      const expectedPath = join(testDir, 'test-memory-saved-searches.jsonl');
      const exists = await fs.access(expectedPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should derive tag-aliases file path correctly', async () => {
      // Create a tag alias to trigger file creation
      await manager.addTagAlias('js', 'javascript');

      const expectedPath = join(testDir, 'test-memory-tag-aliases.jsonl');
      const exists = await fs.access(expectedPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle paths with different extensions', async () => {
      const customPath = join(testDir, 'custom-graph.json');
      const customManager = new KnowledgeGraphManager(customPath);

      await customManager.saveSearch({ name: 'test', query: 'custom' });

      const expectedPath = join(testDir, 'custom-graph-saved-searches.jsonl');
      const exists = await fs.access(expectedPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle paths without extension', async () => {
      const noExtPath = join(testDir, 'no-ext-memory');
      const noExtManager = new KnowledgeGraphManager(noExtPath);

      await noExtManager.createEntities([{ name: 'Test', entityType: 'test', observations: [] }]);
      const graph = await noExtManager.readGraph();
      expect(graph.entities).toHaveLength(1);
    });
  });

  describe('Lazy Manager Initialization', () => {
    it('should not create files until operations are performed', async () => {
      // Just creating manager shouldn't create any files
      const lazyManager = new KnowledgeGraphManager(join(testDir, 'lazy-test.jsonl'));

      const mainExists = await fs.access(join(testDir, 'lazy-test.jsonl')).then(() => true).catch(() => false);
      const savedSearchesExists = await fs.access(join(testDir, 'lazy-test-saved-searches.jsonl')).then(() => true).catch(() => false);

      expect(mainExists).toBe(false);
      expect(savedSearchesExists).toBe(false);

      // Now do an operation
      await lazyManager.readGraph();

      // Main file still may not exist if empty, but manager is now initialized
      expect(lazyManager).toBeDefined();
    });

    it('should initialize entity manager on first entity operation', async () => {
      const result = await manager.createEntities([
        { name: 'Test', entityType: 'test', observations: ['data'] }
      ]);
      expect(result).toHaveLength(1);
    });

    it('should initialize search manager on first search operation', async () => {
      const result = await manager.searchNodes('test');
      expect(result.entities).toBeDefined();
    });

    it('should initialize compression manager on first compression operation', async () => {
      const duplicates = await manager.findDuplicates();
      expect(Array.isArray(duplicates)).toBe(true);
    });

    it('should initialize analytics manager on first analytics operation', async () => {
      const stats = await manager.getGraphStats();
      expect(stats.totalEntities).toBeDefined();
    });
  });

  describe('Entity Operations Delegation', () => {
    it('should delegate createEntities to EntityManager', async () => {
      const entities = await manager.createEntities([
        { name: 'Alice', entityType: 'person', observations: ['Engineer'] }
      ]);
      expect(entities[0].name).toBe('Alice');
      expect(entities[0].createdAt).toBeDefined();
    });

    it('should delegate deleteEntities to EntityManager', async () => {
      await manager.createEntities([
        { name: 'ToDelete', entityType: 'test', observations: [] }
      ]);

      await manager.deleteEntities(['ToDelete']);

      const graph = await manager.readGraph();
      expect(graph.entities).toHaveLength(0);
    });

    it('should delegate addObservations to EntityManager', async () => {
      await manager.createEntities([
        { name: 'Entity', entityType: 'test', observations: [] }
      ]);

      const result = await manager.addObservations([
        { entityName: 'Entity', contents: ['new observation'] }
      ]);

      expect(result[0].addedObservations).toContain('new observation');
    });

    it('should delegate deleteObservations to EntityManager', async () => {
      await manager.createEntities([
        { name: 'Entity', entityType: 'test', observations: ['obs1', 'obs2'] }
      ]);

      await manager.deleteObservations([
        { entityName: 'Entity', observations: ['obs1'] }
      ]);

      const graph = await manager.readGraph();
      expect(graph.entities[0].observations).toEqual(['obs2']);
    });

    it('should delegate addTags to EntityManager', async () => {
      await manager.createEntities([
        { name: 'Entity', entityType: 'test', observations: [] }
      ]);

      const result = await manager.addTags('Entity', ['tag1', 'tag2']);
      expect(result.addedTags).toContain('tag1');
      expect(result.addedTags).toContain('tag2');
    });

    it('should delegate removeTags to EntityManager', async () => {
      await manager.createEntities([
        { name: 'Entity', entityType: 'test', observations: [], tags: ['a', 'b', 'c'] }
      ]);

      const result = await manager.removeTags('Entity', ['b']);
      expect(result.removedTags).toContain('b');
    });

    it('should delegate setImportance to EntityManager', async () => {
      await manager.createEntities([
        { name: 'Entity', entityType: 'test', observations: [] }
      ]);

      const result = await manager.setImportance('Entity', 8);
      expect(result.importance).toBe(8);
    });
  });

  describe('Relation Operations Delegation', () => {
    beforeEach(async () => {
      await manager.createEntities([
        { name: 'Alice', entityType: 'person', observations: [] },
        { name: 'Bob', entityType: 'person', observations: [] }
      ]);
    });

    it('should delegate createRelations to RelationManager', async () => {
      const relations = await manager.createRelations([
        { from: 'Alice', to: 'Bob', relationType: 'knows' }
      ]);

      expect(relations).toHaveLength(1);
      expect(relations[0].from).toBe('Alice');
    });

    it('should delegate deleteRelations to RelationManager', async () => {
      await manager.createRelations([
        { from: 'Alice', to: 'Bob', relationType: 'knows' }
      ]);

      await manager.deleteRelations([
        { from: 'Alice', to: 'Bob', relationType: 'knows' }
      ]);

      const graph = await manager.readGraph();
      expect(graph.relations).toHaveLength(0);
    });
  });

  describe('Search Operations Delegation', () => {
    beforeEach(async () => {
      await manager.createEntities([
        { name: 'JavaScript', entityType: 'language', observations: ['Web development'], tags: ['programming'] },
        { name: 'Python', entityType: 'language', observations: ['Data science'], tags: ['programming', 'ai'] },
        { name: 'TypeScript', entityType: 'language', observations: ['Typed JavaScript'], tags: ['programming'] }
      ]);
    });

    it('should delegate searchNodes to SearchManager', async () => {
      const result = await manager.searchNodes('JavaScript');
      expect(result.entities.length).toBeGreaterThanOrEqual(1);
    });

    it('should delegate searchByDateRange to SearchManager', async () => {
      const result = await manager.searchByDateRange(undefined, undefined, 'language');
      expect(result.entities.length).toBe(3);
    });

    it('should delegate openNodes to SearchManager', async () => {
      const result = await manager.openNodes(['JavaScript', 'Python']);
      expect(result.entities.length).toBe(2);
    });

    it('should delegate searchNodesRanked to SearchManager', async () => {
      const results = await manager.searchNodesRanked('programming');
      expect(Array.isArray(results)).toBe(true);
    });

    it('should delegate booleanSearch to SearchManager', async () => {
      const result = await manager.booleanSearch('type:language AND observation:development');
      expect(result.entities.length).toBeGreaterThanOrEqual(1);
    });

    it('should delegate fuzzySearch to SearchManager', async () => {
      const result = await manager.fuzzySearch('Javscript', 0.7); // typo
      expect(result.entities.length).toBeGreaterThanOrEqual(1);
    });

    it('should delegate getSearchSuggestions to SearchManager', async () => {
      const suggestions = await manager.getSearchSuggestions('Java');
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Saved Search Delegation', () => {
    it('should delegate saveSearch to SearchManager', async () => {
      const saved = await manager.saveSearch({ name: 'mySearch', query: 'test' });
      expect(saved.name).toBe('mySearch');
      expect(saved.createdAt).toBeDefined();
    });

    it('should delegate listSavedSearches to SearchManager', async () => {
      await manager.saveSearch({ name: 's1', query: 'q1' });
      await manager.saveSearch({ name: 's2', query: 'q2' });

      const searches = await manager.listSavedSearches();
      expect(searches.length).toBe(2);
    });

    it('should delegate getSavedSearch to SearchManager', async () => {
      await manager.saveSearch({ name: 'findme', query: 'query' });

      const found = await manager.getSavedSearch('findme');
      expect(found?.name).toBe('findme');
    });

    it('should delegate executeSavedSearch to SearchManager', async () => {
      await manager.saveSearch({ name: 'execSearch', query: 'test' });

      const result = await manager.executeSavedSearch('execSearch');
      expect(result.entities).toBeDefined();
    });

    it('should delegate updateSavedSearch to SearchManager', async () => {
      await manager.saveSearch({ name: 'toUpdate', query: 'original' });

      const updated = await manager.updateSavedSearch('toUpdate', { query: 'updated' });
      expect(updated.query).toBe('updated');
    });

    it('should delegate deleteSavedSearch to SearchManager', async () => {
      await manager.saveSearch({ name: 'toDelete', query: 'test' });

      const deleted = await manager.deleteSavedSearch('toDelete');
      expect(deleted).toBe(true);

      const searches = await manager.listSavedSearches();
      expect(searches.length).toBe(0);
    });
  });

  describe('Hierarchy Operations Delegation', () => {
    beforeEach(async () => {
      await manager.createEntities([
        { name: 'Root', entityType: 'folder', observations: [] },
        { name: 'Child', entityType: 'folder', observations: [] },
        { name: 'Grandchild', entityType: 'file', observations: [] }
      ]);
    });

    it('should delegate setEntityParent to EntityManager', async () => {
      const result = await manager.setEntityParent('Child', 'Root');
      expect(result.parentId).toBe('Root');
    });

    it('should delegate getChildren to EntityManager', async () => {
      await manager.setEntityParent('Child', 'Root');

      const children = await manager.getChildren('Root');
      expect(children.length).toBe(1);
      expect(children[0].name).toBe('Child');
    });

    it('should delegate getParent to EntityManager', async () => {
      await manager.setEntityParent('Child', 'Root');

      const parent = await manager.getParent('Child');
      expect(parent?.name).toBe('Root');
    });

    it('should delegate getAncestors to EntityManager', async () => {
      await manager.setEntityParent('Child', 'Root');
      await manager.setEntityParent('Grandchild', 'Child');

      const ancestors = await manager.getAncestors('Grandchild');
      expect(ancestors.length).toBe(2);
    });

    it('should delegate getDescendants to EntityManager', async () => {
      await manager.setEntityParent('Child', 'Root');
      await manager.setEntityParent('Grandchild', 'Child');

      const descendants = await manager.getDescendants('Root');
      expect(descendants.length).toBe(2);
    });

    it('should delegate getSubtree to EntityManager', async () => {
      await manager.setEntityParent('Child', 'Root');
      await manager.setEntityParent('Grandchild', 'Child');

      const subtree = await manager.getSubtree('Root');
      expect(subtree.entities.length).toBe(3);
    });

    it('should delegate getRootEntities to EntityManager', async () => {
      await manager.setEntityParent('Child', 'Root');

      const roots = await manager.getRootEntities();
      expect(roots.length).toBe(2); // Root and Grandchild
    });

    it('should delegate getEntityDepth to EntityManager', async () => {
      await manager.setEntityParent('Child', 'Root');
      await manager.setEntityParent('Grandchild', 'Child');

      const depth = await manager.getEntityDepth('Grandchild');
      expect(depth).toBe(2);
    });

    it('should delegate moveEntity to EntityManager', async () => {
      await manager.setEntityParent('Child', 'Root');
      await manager.setEntityParent('Grandchild', 'Child');

      const moved = await manager.moveEntity('Grandchild', 'Root');
      expect(moved.parentId).toBe('Root');
    });
  });

  describe('Compression Operations Delegation', () => {
    it('should delegate findDuplicates to CompressionManager', async () => {
      await manager.createEntities([
        { name: 'Item1', entityType: 'test', observations: ['same data'] },
        { name: 'Item2', entityType: 'test', observations: ['same data'] }
      ]);

      const duplicates = await manager.findDuplicates(0.8);
      expect(Array.isArray(duplicates)).toBe(true);
    });

    it('should delegate mergeEntities to CompressionManager', async () => {
      await manager.createEntities([
        { name: 'Entity1', entityType: 'test', observations: ['obs1'] },
        { name: 'Entity2', entityType: 'test', observations: ['obs2'] }
      ]);

      const merged = await manager.mergeEntities(['Entity1', 'Entity2']);
      expect(merged.name).toBe('Entity1');
      expect(merged.observations).toContain('obs1');
      expect(merged.observations).toContain('obs2');
    });

    it('should delegate compressGraph to CompressionManager', async () => {
      const result = await manager.compressGraph(0.8, true);
      expect(result.duplicatesFound).toBeDefined();
      expect(result.entitiesMerged).toBeDefined();
    });
  });

  describe('Analytics Operations Delegation', () => {
    it('should delegate getGraphStats to SearchManager', async () => {
      await manager.createEntities([
        { name: 'A', entityType: 'type1', observations: [] },
        { name: 'B', entityType: 'type2', observations: [] }
      ]);

      const stats = await manager.getGraphStats();
      expect(stats.totalEntities).toBe(2);
      expect(stats.totalRelations).toBe(0);
    });

    it('should delegate validateGraph to SearchManager', async () => {
      const report = await manager.validateGraph();
      expect(report.isValid).toBeDefined();
      expect(report.issues).toBeDefined();
    });
  });

  describe('Tag Alias Operations Delegation', () => {
    it('should delegate addTagAlias to TagManager', async () => {
      const alias = await manager.addTagAlias('js', 'javascript');
      expect(alias.alias).toBe('js');
      expect(alias.canonical).toBe('javascript');
    });

    it('should delegate listTagAliases to TagManager', async () => {
      await manager.addTagAlias('py', 'python');
      await manager.addTagAlias('ts', 'typescript');

      const aliases = await manager.listTagAliases();
      expect(aliases.length).toBe(2);
    });

    it('should delegate removeTagAlias to TagManager', async () => {
      await manager.addTagAlias('js', 'javascript');

      const removed = await manager.removeTagAlias('js');
      expect(removed).toBe(true);
    });

    it('should delegate getAliasesForTag to TagManager', async () => {
      await manager.addTagAlias('js', 'javascript');
      await manager.addTagAlias('ecmascript', 'javascript');

      const aliases = await manager.getAliasesForTag('javascript');
      expect(aliases.length).toBe(2);
    });

    it('should delegate resolveTag to TagManager', async () => {
      await manager.addTagAlias('js', 'javascript');

      const resolved = await manager.resolveTag('js');
      expect(resolved).toBe('javascript');
    });
  });

  describe('Archive Operations Delegation', () => {
    it('should delegate archiveEntities to EntityManager', async () => {
      await manager.createEntities([
        { name: 'Old', entityType: 'test', observations: [] }
      ]);

      const result = await manager.archiveEntities(
        { importanceLessThan: 5 },
        true // dry run
      );

      expect(result.archived).toBeDefined();
      expect(result.entityNames).toBeDefined();
    });
  });

  describe('Import/Export Operations Delegation', () => {
    it('should delegate exportGraph to IOManager', async () => {
      await manager.createEntities([
        { name: 'Export', entityType: 'test', observations: ['data'] }
      ]);

      const json = await manager.exportGraph('json');
      expect(json).toContain('Export');
    });

    it('should support all export formats', async () => {
      await manager.createEntities([
        { name: 'Test', entityType: 'test', observations: [] }
      ]);

      const formats: Array<'json' | 'csv' | 'graphml' | 'gexf' | 'dot' | 'markdown' | 'mermaid'> =
        ['json', 'csv', 'graphml', 'gexf', 'dot', 'markdown', 'mermaid'];

      for (const format of formats) {
        const exported = await manager.exportGraph(format);
        expect(exported.length).toBeGreaterThan(0);
      }
    });

    it('should delegate importGraph to IOManager', async () => {
      const jsonData = JSON.stringify({
        entities: [{ name: 'Imported', entityType: 'test', observations: [] }],
        relations: []
      });

      const result = await manager.importGraph('json', jsonData, 'merge');
      expect(result.entitiesAdded).toBeGreaterThanOrEqual(0);
      expect(result.entitiesSkipped).toBeDefined();
    });

    it('should export with filter', async () => {
      await manager.createEntities([
        { name: 'Include', entityType: 'target', observations: [] },
        { name: 'Exclude', entityType: 'other', observations: [] }
      ]);

      const exported = await manager.exportGraph('json', { entityType: 'target' });
      expect(exported).toContain('Include');
      expect(exported).not.toContain('Exclude');
    });
  });

  describe('Bulk Tag Operations Delegation', () => {
    beforeEach(async () => {
      await manager.createEntities([
        { name: 'E1', entityType: 'test', observations: [], tags: ['old'] },
        { name: 'E2', entityType: 'test', observations: [], tags: ['old'] },
        { name: 'E3', entityType: 'test', observations: [], tags: ['other'] }
      ]);
    });

    it('should delegate addTagsToMultipleEntities to EntityManager', async () => {
      const result = await manager.addTagsToMultipleEntities(['E1', 'E2'], ['new']);
      expect(result.length).toBe(2);
      expect(result[0].addedTags).toContain('new');
    });

    it('should delegate replaceTag to EntityManager', async () => {
      const result = await manager.replaceTag('old', 'renamed');
      expect(result.affectedEntities.length).toBe(2);
      expect(result.count).toBe(2);
    });

    it('should delegate mergeTags to EntityManager', async () => {
      // Add another tag to merge
      await manager.addTags('E3', ['another']);

      const result = await manager.mergeTags('old', 'other', 'merged');
      expect(result.affectedEntities.length).toBeGreaterThan(0);
    });
  });

  describe('Integration: Cross-Manager Operations', () => {
    it('should handle workflow across multiple managers', async () => {
      // Create entities (EntityManager)
      await manager.createEntities([
        { name: 'Project', entityType: 'project', observations: ['Main project'] },
        { name: 'Task1', entityType: 'task', observations: ['First task'] },
        { name: 'Task2', entityType: 'task', observations: ['Second task'] }
      ]);

      // Create hierarchy (EntityManager)
      await manager.setEntityParent('Task1', 'Project');
      await manager.setEntityParent('Task2', 'Project');

      // Create relations (RelationManager)
      await manager.createRelations([
        { from: 'Task1', to: 'Task2', relationType: 'depends_on' }
      ]);

      // Add tags (EntityManager)
      await manager.addTags('Project', ['active']);

      // Search (SearchManager)
      const results = await manager.searchNodes('task');
      expect(results.entities.length).toBe(2);

      // Get stats (SearchManager)
      const stats = await manager.getGraphStats();
      expect(stats.totalEntities).toBe(3);
      expect(stats.totalRelations).toBe(1);

      // Export (IOManager)
      const exported = await manager.exportGraph('json');
      expect(exported).toContain('Project');

      // Validate (SearchManager)
      const validation = await manager.validateGraph();
      expect(validation.isValid).toBe(true);
    });

    it('should maintain consistency across operations', async () => {
      // Create
      await manager.createEntities([{ name: 'Consistent', entityType: 'test', observations: [] }]);

      // Modify via different managers
      await manager.addTags('Consistent', ['tag1']);
      await manager.setImportance('Consistent', 7);
      await manager.addObservations([{ entityName: 'Consistent', contents: ['obs'] }]);

      // Verify via different read paths
      const bySearch = await manager.searchNodes('Consistent');
      const byOpen = await manager.openNodes(['Consistent']);
      const byGraph = await manager.readGraph();

      expect(bySearch.entities[0].tags).toContain('tag1');
      expect(byOpen.entities[0].importance).toBe(7);
      expect(byGraph.entities[0].observations).toContain('obs');
    });
  });
});
