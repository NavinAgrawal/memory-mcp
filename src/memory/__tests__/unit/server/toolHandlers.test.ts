/**
 * toolHandlers Unit Tests
 *
 * Tests for all 45 tool handler functions and the handleToolCall dispatcher.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { toolHandlers, handleToolCall } from '../../../server/toolHandlers.js';
import { KnowledgeGraphManager } from '../../../core/KnowledgeGraphManager.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('toolHandlers', () => {
  let manager: KnowledgeGraphManager;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tool-handlers-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'test-graph.jsonl');

    manager = new KnowledgeGraphManager(testFilePath);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('handleToolCall', () => {
    it('should dispatch to correct handler', async () => {
      const result = await handleToolCall('read_graph', {}, manager);
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should throw error for unknown tool', async () => {
      await expect(handleToolCall('unknown_tool', {}, manager)).rejects.toThrow('Unknown tool: unknown_tool');
    });

    it('should pass arguments to handler', async () => {
      const result = await handleToolCall('create_entities', {
        entities: [{ name: 'Test', entityType: 'test', observations: [] }]
      }, manager);
      expect(result.content[0].text).toContain('Test');
    });
  });

  describe('Entity Handlers', () => {
    describe('create_entities', () => {
      it('should create entities and return formatted response', async () => {
        const result = await toolHandlers.create_entities(manager, {
          entities: [
            { name: 'Alice', entityType: 'person', observations: ['Developer'] }
          ]
        });

        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveLength(1);
        expect(data[0].name).toBe('Alice');
      });

      it('should handle multiple entities', async () => {
        const result = await toolHandlers.create_entities(manager, {
          entities: [
            { name: 'Alice', entityType: 'person', observations: [] },
            { name: 'Bob', entityType: 'person', observations: [] }
          ]
        });

        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveLength(2);
      });

      it('should handle empty entities array', async () => {
        const result = await toolHandlers.create_entities(manager, { entities: [] });
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveLength(0);
      });
    });

    describe('delete_entities', () => {
      it('should delete entities and return confirmation', async () => {
        await toolHandlers.create_entities(manager, {
          entities: [{ name: 'Alice', entityType: 'person', observations: [] }]
        });

        const result = await toolHandlers.delete_entities(manager, {
          entityNames: ['Alice']
        });

        expect(result.content[0].text).toBe('Deleted 1 entities');
      });

      it('should handle multiple deletions', async () => {
        await toolHandlers.create_entities(manager, {
          entities: [
            { name: 'Alice', entityType: 'person', observations: [] },
            { name: 'Bob', entityType: 'person', observations: [] }
          ]
        });

        const result = await toolHandlers.delete_entities(manager, {
          entityNames: ['Alice', 'Bob']
        });

        expect(result.content[0].text).toBe('Deleted 2 entities');
      });
    });

    describe('read_graph', () => {
      it('should return entire graph as JSON', async () => {
        await toolHandlers.create_entities(manager, {
          entities: [{ name: 'Test', entityType: 'test', observations: [] }]
        });

        const result = await toolHandlers.read_graph(manager, {});
        const data = JSON.parse(result.content[0].text);
        expect(data.entities).toBeDefined();
        expect(data.relations).toBeDefined();
      });

      it('should return empty graph structure when no data', async () => {
        const result = await toolHandlers.read_graph(manager, {});
        const data = JSON.parse(result.content[0].text);
        expect(data.entities).toHaveLength(0);
        expect(data.relations).toHaveLength(0);
      });
    });

    describe('open_nodes', () => {
      it('should return specified entities', async () => {
        await toolHandlers.create_entities(manager, {
          entities: [
            { name: 'Alice', entityType: 'person', observations: [] },
            { name: 'Bob', entityType: 'person', observations: [] }
          ]
        });

        const result = await toolHandlers.open_nodes(manager, { names: ['Alice'] });
        const data = JSON.parse(result.content[0].text);
        expect(data.entities).toHaveLength(1);
        expect(data.entities[0].name).toBe('Alice');
      });

      it('should return empty array for non-existent names', async () => {
        const result = await toolHandlers.open_nodes(manager, { names: ['NonExistent'] });
        const data = JSON.parse(result.content[0].text);
        expect(data.entities).toHaveLength(0);
      });
    });
  });

  describe('Relation Handlers', () => {
    beforeEach(async () => {
      await toolHandlers.create_entities(manager, {
        entities: [
          { name: 'Alice', entityType: 'person', observations: [] },
          { name: 'Bob', entityType: 'person', observations: [] }
        ]
      });
    });

    describe('create_relations', () => {
      it('should create relations and return formatted response', async () => {
        const result = await toolHandlers.create_relations(manager, {
          relations: [{ from: 'Alice', to: 'Bob', relationType: 'knows' }]
        });

        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveLength(1);
        expect(data[0].from).toBe('Alice');
        expect(data[0].to).toBe('Bob');
      });

      it('should handle multiple relations', async () => {
        const result = await toolHandlers.create_relations(manager, {
          relations: [
            { from: 'Alice', to: 'Bob', relationType: 'knows' },
            { from: 'Bob', to: 'Alice', relationType: 'knows' }
          ]
        });

        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveLength(2);
      });
    });

    describe('delete_relations', () => {
      it('should delete relations and return confirmation', async () => {
        await toolHandlers.create_relations(manager, {
          relations: [{ from: 'Alice', to: 'Bob', relationType: 'knows' }]
        });

        const result = await toolHandlers.delete_relations(manager, {
          relations: [{ from: 'Alice', to: 'Bob', relationType: 'knows' }]
        });

        expect(result.content[0].text).toBe('Deleted 1 relations');
      });
    });
  });

  describe('Observation Handlers', () => {
    beforeEach(async () => {
      await toolHandlers.create_entities(manager, {
        entities: [{ name: 'Alice', entityType: 'person', observations: ['Initial'] }]
      });
    });

    describe('add_observations', () => {
      it('should add observations and return result', async () => {
        const result = await toolHandlers.add_observations(manager, {
          observations: [{ entityName: 'Alice', contents: ['New observation'] }]
        });

        const data = JSON.parse(result.content[0].text);
        expect(data).toBeDefined();
      });
    });

    describe('delete_observations', () => {
      it('should delete observations and return confirmation', async () => {
        const result = await toolHandlers.delete_observations(manager, {
          deletions: [{ entityName: 'Alice', observations: ['Initial'] }]
        });

        expect(result.content[0].text).toBe('Observations deleted successfully');
      });
    });
  });

  describe('Search Handlers', () => {
    beforeEach(async () => {
      await toolHandlers.create_entities(manager, {
        entities: [
          { name: 'Alice Developer', entityType: 'person', observations: ['Software engineer'] },
          { name: 'Bob Manager', entityType: 'person', observations: ['Project manager'] }
        ]
      });
    });

    describe('search_nodes', () => {
      it('should search and return matching entities', async () => {
        const result = await toolHandlers.search_nodes(manager, { query: 'Alice' });
        const data = JSON.parse(result.content[0].text);
        expect(data.entities.length).toBeGreaterThanOrEqual(1);
      });

      it('should support tag filtering', async () => {
        await toolHandlers.add_tags(manager, { entityName: 'Alice Developer', tags: ['dev'] });
        const result = await toolHandlers.search_nodes(manager, { query: 'Alice', tags: ['dev'] });
        const data = JSON.parse(result.content[0].text);
        expect(data.entities.length).toBeGreaterThanOrEqual(1);
      });

      it('should support importance filtering', async () => {
        await toolHandlers.set_importance(manager, { entityName: 'Alice Developer', importance: 8 });
        const result = await toolHandlers.search_nodes(manager, {
          query: 'Alice',
          minImportance: 7,
          maxImportance: 10
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.entities.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('boolean_search', () => {
      it('should support AND operator', async () => {
        const result = await toolHandlers.boolean_search(manager, { query: 'Alice AND Developer' });
        expect(result.content[0].type).toBe('text');
      });

      it('should support OR operator', async () => {
        const result = await toolHandlers.boolean_search(manager, { query: 'Alice OR Bob' });
        const data = JSON.parse(result.content[0].text);
        expect(data.entities.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('fuzzy_search', () => {
      it('should find similar matches', async () => {
        const result = await toolHandlers.fuzzy_search(manager, { query: 'Alce', threshold: 0.6 });
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('search_nodes_ranked', () => {
      it('should return ranked results', async () => {
        const result = await toolHandlers.search_nodes_ranked(manager, { query: 'developer' });
        expect(result.content[0].type).toBe('text');
      });

      it('should respect limit parameter', async () => {
        const result = await toolHandlers.search_nodes_ranked(manager, { query: 'person', limit: 1 });
        const data = JSON.parse(result.content[0].text);
        expect(data.length).toBeLessThanOrEqual(1);
      });
    });

    describe('search_by_date_range', () => {
      it('should filter by date range', async () => {
        const result = await toolHandlers.search_by_date_range(manager, {
          startDate: '2020-01-01T00:00:00Z',
          endDate: '2030-12-31T23:59:59Z'
        });
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('get_search_suggestions', () => {
      it('should return suggestions', async () => {
        const result = await toolHandlers.get_search_suggestions(manager, { query: 'Al' });
        expect(result.content[0].type).toBe('text');
      });
    });
  });

  describe('Saved Search Handlers', () => {
    describe('save_search', () => {
      it('should save a search', async () => {
        const result = await toolHandlers.save_search(manager, {
          name: 'my-search',
          query: 'test query',
          searchType: 'basic'
        });
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('list_saved_searches', () => {
      it('should list saved searches', async () => {
        await toolHandlers.save_search(manager, {
          name: 'test-search',
          query: 'test',
          searchType: 'basic'
        });
        const result = await toolHandlers.list_saved_searches(manager, {});
        const data = JSON.parse(result.content[0].text);
        expect(Array.isArray(data)).toBe(true);
      });
    });

    describe('execute_saved_search', () => {
      it('should execute a saved search', async () => {
        await toolHandlers.create_entities(manager, {
          entities: [{ name: 'TestEntity', entityType: 'test', observations: [] }]
        });
        await toolHandlers.save_search(manager, {
          name: 'exec-test',
          query: 'Test',
          searchType: 'basic'
        });
        const result = await toolHandlers.execute_saved_search(manager, { name: 'exec-test' });
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('delete_saved_search', () => {
      it('should delete existing search', async () => {
        await toolHandlers.save_search(manager, {
          name: 'to-delete',
          query: 'test',
          searchType: 'basic'
        });
        const result = await toolHandlers.delete_saved_search(manager, { name: 'to-delete' });
        expect(result.content[0].text).toContain('deleted successfully');
      });

      it('should handle non-existent search', async () => {
        const result = await toolHandlers.delete_saved_search(manager, { name: 'non-existent' });
        expect(result.content[0].text).toContain('not found');
      });
    });

    describe('update_saved_search', () => {
      it('should update saved search', async () => {
        await toolHandlers.save_search(manager, {
          name: 'to-update',
          query: 'original',
          searchType: 'basic'
        });
        const result = await toolHandlers.update_saved_search(manager, {
          name: 'to-update',
          updates: { query: 'updated' }
        });
        expect(result.content[0].type).toBe('text');
      });
    });
  });

  describe('Tag Handlers', () => {
    beforeEach(async () => {
      await toolHandlers.create_entities(manager, {
        entities: [{ name: 'TestEntity', entityType: 'test', observations: [] }]
      });
    });

    describe('add_tags', () => {
      it('should add tags to entity', async () => {
        const result = await toolHandlers.add_tags(manager, {
          entityName: 'TestEntity',
          tags: ['tag1', 'tag2']
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.addedTags).toContain('tag1');
        expect(data.addedTags).toContain('tag2');
      });
    });

    describe('remove_tags', () => {
      it('should remove tags from entity', async () => {
        await toolHandlers.add_tags(manager, { entityName: 'TestEntity', tags: ['remove-me'] });
        const result = await toolHandlers.remove_tags(manager, {
          entityName: 'TestEntity',
          tags: ['remove-me']
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.removedTags).toContain('remove-me');
      });
    });

    describe('set_importance', () => {
      it('should set entity importance', async () => {
        const result = await toolHandlers.set_importance(manager, {
          entityName: 'TestEntity',
          importance: 7
        });
        const data = JSON.parse(result.content[0].text);
        expect(data.importance).toBe(7);
      });
    });

    describe('add_tags_to_multiple_entities', () => {
      it('should add tags to multiple entities', async () => {
        await toolHandlers.create_entities(manager, {
          entities: [{ name: 'Entity2', entityType: 'test', observations: [] }]
        });
        const result = await toolHandlers.add_tags_to_multiple_entities(manager, {
          entityNames: ['TestEntity', 'Entity2'],
          tags: ['shared-tag']
        });
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveLength(2);
      });
    });

    describe('replace_tag', () => {
      it('should replace tag across entities', async () => {
        await toolHandlers.add_tags(manager, { entityName: 'TestEntity', tags: ['old-tag'] });
        const result = await toolHandlers.replace_tag(manager, {
          oldTag: 'old-tag',
          newTag: 'new-tag'
        });
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('merge_tags', () => {
      it('should merge two tags into target', async () => {
        await toolHandlers.add_tags(manager, { entityName: 'TestEntity', tags: ['tag1', 'tag2'] });
        const result = await toolHandlers.merge_tags(manager, {
          tag1: 'tag1',
          tag2: 'tag2',
          targetTag: 'merged'
        });
        expect(result.content[0].type).toBe('text');
      });
    });
  });

  describe('Tag Alias Handlers', () => {
    describe('add_tag_alias', () => {
      it('should add tag alias', async () => {
        const result = await toolHandlers.add_tag_alias(manager, {
          alias: 'js',
          canonical: 'javascript'
        });
        expect(result.content[0].type).toBe('text');
      });

      it('should include description if provided', async () => {
        const result = await toolHandlers.add_tag_alias(manager, {
          alias: 'ts',
          canonical: 'typescript',
          description: 'TypeScript language'
        });
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('list_tag_aliases', () => {
      it('should list all aliases', async () => {
        await toolHandlers.add_tag_alias(manager, { alias: 'test-alias', canonical: 'test' });
        const result = await toolHandlers.list_tag_aliases(manager, {});
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('remove_tag_alias', () => {
      it('should remove existing alias', async () => {
        await toolHandlers.add_tag_alias(manager, { alias: 'remove-me', canonical: 'test' });
        const result = await toolHandlers.remove_tag_alias(manager, { alias: 'remove-me' });
        expect(result.content[0].text).toContain('removed successfully');
      });

      it('should handle non-existent alias', async () => {
        const result = await toolHandlers.remove_tag_alias(manager, { alias: 'non-existent' });
        expect(result.content[0].text).toContain('not found');
      });
    });

    describe('get_aliases_for_tag', () => {
      it('should get aliases for canonical tag', async () => {
        await toolHandlers.add_tag_alias(manager, { alias: 'alias1', canonical: 'canonical' });
        const result = await toolHandlers.get_aliases_for_tag(manager, { canonicalTag: 'canonical' });
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('resolve_tag', () => {
      it('should resolve alias to canonical', async () => {
        await toolHandlers.add_tag_alias(manager, { alias: 'short', canonical: 'canonical-form' });
        const result = await toolHandlers.resolve_tag(manager, { tag: 'short' });
        const data = JSON.parse(result.content[0].text);
        expect(data.resolved).toBe('canonical-form');
      });

      it('should return same tag if no alias', async () => {
        const result = await toolHandlers.resolve_tag(manager, { tag: 'no-alias' });
        const data = JSON.parse(result.content[0].text);
        expect(data.resolved).toBe('no-alias');
      });
    });
  });

  describe('Hierarchy Handlers', () => {
    beforeEach(async () => {
      await toolHandlers.create_entities(manager, {
        entities: [
          { name: 'Parent', entityType: 'node', observations: [] },
          { name: 'Child', entityType: 'node', observations: [] },
          { name: 'Grandchild', entityType: 'node', observations: [] }
        ]
      });
    });

    describe('set_entity_parent', () => {
      it('should set parent for entity', async () => {
        const result = await toolHandlers.set_entity_parent(manager, {
          entityName: 'Child',
          parentName: 'Parent'
        });
        expect(result.content[0].type).toBe('text');
      });

      it('should allow null parent to remove hierarchy', async () => {
        await toolHandlers.set_entity_parent(manager, { entityName: 'Child', parentName: 'Parent' });
        const result = await toolHandlers.set_entity_parent(manager, {
          entityName: 'Child',
          parentName: null
        });
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('get_children', () => {
      it('should return children of entity', async () => {
        await toolHandlers.set_entity_parent(manager, { entityName: 'Child', parentName: 'Parent' });
        const result = await toolHandlers.get_children(manager, { entityName: 'Parent' });
        const data = JSON.parse(result.content[0].text);
        expect(data.length).toBeGreaterThanOrEqual(1);
      });

      it('should return empty for leaf nodes', async () => {
        const result = await toolHandlers.get_children(manager, { entityName: 'Child' });
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveLength(0);
      });
    });

    describe('get_parent', () => {
      it('should return parent entity', async () => {
        await toolHandlers.set_entity_parent(manager, { entityName: 'Child', parentName: 'Parent' });
        const result = await toolHandlers.get_parent(manager, { entityName: 'Child' });
        const data = JSON.parse(result.content[0].text);
        expect(data.name).toBe('Parent');
      });

      it('should return null for root entities', async () => {
        const result = await toolHandlers.get_parent(manager, { entityName: 'Parent' });
        const data = JSON.parse(result.content[0].text);
        expect(data).toBeNull();
      });
    });

    describe('get_ancestors', () => {
      it('should return all ancestors', async () => {
        await toolHandlers.set_entity_parent(manager, { entityName: 'Child', parentName: 'Parent' });
        await toolHandlers.set_entity_parent(manager, { entityName: 'Grandchild', parentName: 'Child' });
        const result = await toolHandlers.get_ancestors(manager, { entityName: 'Grandchild' });
        const data = JSON.parse(result.content[0].text);
        expect(data.length).toBe(2);
      });
    });

    describe('get_descendants', () => {
      it('should return all descendants', async () => {
        await toolHandlers.set_entity_parent(manager, { entityName: 'Child', parentName: 'Parent' });
        await toolHandlers.set_entity_parent(manager, { entityName: 'Grandchild', parentName: 'Child' });
        const result = await toolHandlers.get_descendants(manager, { entityName: 'Parent' });
        const data = JSON.parse(result.content[0].text);
        expect(data.length).toBe(2);
      });
    });

    describe('get_subtree', () => {
      it('should return entity with all descendants', async () => {
        await toolHandlers.set_entity_parent(manager, { entityName: 'Child', parentName: 'Parent' });
        const result = await toolHandlers.get_subtree(manager, { entityName: 'Parent' });
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('get_root_entities', () => {
      it('should return entities without parents', async () => {
        const result = await toolHandlers.get_root_entities(manager, {});
        const data = JSON.parse(result.content[0].text);
        expect(data.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('get_entity_depth', () => {
      it('should return depth in hierarchy', async () => {
        await toolHandlers.set_entity_parent(manager, { entityName: 'Child', parentName: 'Parent' });
        const result = await toolHandlers.get_entity_depth(manager, { entityName: 'Child' });
        const data = JSON.parse(result.content[0].text);
        expect(data.depth).toBe(1);
      });
    });

    describe('move_entity', () => {
      it('should move entity to new parent', async () => {
        await toolHandlers.create_entities(manager, {
          entities: [{ name: 'NewParent', entityType: 'node', observations: [] }]
        });
        await toolHandlers.set_entity_parent(manager, { entityName: 'Child', parentName: 'Parent' });
        const result = await toolHandlers.move_entity(manager, {
          entityName: 'Child',
          newParentName: 'NewParent'
        });
        expect(result.content[0].type).toBe('text');
      });
    });
  });

  describe('Analytics Handlers', () => {
    describe('get_graph_stats', () => {
      it('should return graph statistics', async () => {
        await toolHandlers.create_entities(manager, {
          entities: [{ name: 'Test', entityType: 'test', observations: [] }]
        });
        const result = await toolHandlers.get_graph_stats(manager, {});
        const data = JSON.parse(result.content[0].text);
        expect(data.totalEntities).toBeGreaterThanOrEqual(1);
      });
    });

    describe('validate_graph', () => {
      it('should validate graph integrity', async () => {
        const result = await toolHandlers.validate_graph(manager, {});
        const data = JSON.parse(result.content[0].text);
        expect(data.isValid).toBeDefined();
      });
    });
  });

  describe('Compression Handlers', () => {
    describe('find_duplicates', () => {
      it('should find similar entities', async () => {
        await toolHandlers.create_entities(manager, {
          entities: [
            { name: 'TestOne', entityType: 'test', observations: ['same observation'] },
            { name: 'TestTwo', entityType: 'test', observations: ['same observation'] }
          ]
        });
        const result = await toolHandlers.find_duplicates(manager, { threshold: 0.8 });
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('merge_entities', () => {
      it('should merge entities into target', async () => {
        await toolHandlers.create_entities(manager, {
          entities: [
            { name: 'Entity1', entityType: 'test', observations: ['obs1'] },
            { name: 'Entity2', entityType: 'test', observations: ['obs2'] }
          ]
        });
        const result = await toolHandlers.merge_entities(manager, {
          entityNames: ['Entity1', 'Entity2'],
          targetName: 'MergedEntity'
        });
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('compress_graph', () => {
      it('should compress graph with dry run', async () => {
        const result = await toolHandlers.compress_graph(manager, { threshold: 0.8, dryRun: true });
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('archive_entities', () => {
      it('should archive entities by criteria', async () => {
        const result = await toolHandlers.archive_entities(manager, {
          importanceLessThan: 3,
          dryRun: true
        });
        expect(result.content[0].type).toBe('text');
      });
    });
  });

  describe('Import/Export Handlers', () => {
    describe('import_graph', () => {
      it('should import JSON format', async () => {
        const jsonData = JSON.stringify({
          entities: [{ name: 'Imported', entityType: 'test', observations: [] }],
          relations: []
        });
        const result = await toolHandlers.import_graph(manager, {
          format: 'json',
          data: jsonData,
          mergeStrategy: 'merge'
        });
        expect(result.content[0].type).toBe('text');
      });

      it('should support dry run', async () => {
        const jsonData = JSON.stringify({
          entities: [{ name: 'DryRun', entityType: 'test', observations: [] }],
          relations: []
        });
        const result = await toolHandlers.import_graph(manager, {
          format: 'json',
          data: jsonData,
          dryRun: true
        });
        expect(result.content[0].type).toBe('text');
      });
    });

    describe('export_graph', () => {
      it('should export as JSON', async () => {
        await toolHandlers.create_entities(manager, {
          entities: [{ name: 'ExportTest', entityType: 'test', observations: [] }]
        });
        const result = await toolHandlers.export_graph(manager, { format: 'json' });
        expect(result.content[0].type).toBe('text');
      });

      it('should export as markdown', async () => {
        await toolHandlers.create_entities(manager, {
          entities: [{ name: 'MarkdownTest', entityType: 'test', observations: [] }]
        });
        const result = await toolHandlers.export_graph(manager, { format: 'markdown' });
        expect(result.content[0].type).toBe('text');
      });

      it('should support filtering', async () => {
        const result = await toolHandlers.export_graph(manager, {
          format: 'json',
          filter: { entityType: 'test' }
        });
        expect(result.content[0].type).toBe('text');
      });
    });
  });

  describe('Handler Registry Completeness', () => {
    it('should have all 45 expected handlers', () => {
      const expectedHandlers = [
        'create_entities', 'delete_entities', 'read_graph', 'open_nodes',
        'create_relations', 'delete_relations',
        'add_observations', 'delete_observations',
        'search_nodes', 'search_by_date_range', 'search_nodes_ranked', 'boolean_search', 'fuzzy_search', 'get_search_suggestions',
        'save_search', 'execute_saved_search', 'list_saved_searches', 'delete_saved_search', 'update_saved_search',
        'add_tags', 'remove_tags', 'set_importance', 'add_tags_to_multiple_entities', 'replace_tag', 'merge_tags',
        'add_tag_alias', 'list_tag_aliases', 'remove_tag_alias', 'get_aliases_for_tag', 'resolve_tag',
        'set_entity_parent', 'get_children', 'get_parent', 'get_ancestors', 'get_descendants', 'get_subtree', 'get_root_entities', 'get_entity_depth', 'move_entity',
        'get_graph_stats', 'validate_graph',
        'find_duplicates', 'merge_entities', 'compress_graph', 'archive_entities',
        'import_graph', 'export_graph'
      ];

      for (const handler of expectedHandlers) {
        expect(toolHandlers[handler]).toBeDefined();
        expect(typeof toolHandlers[handler]).toBe('function');
      }
    });

    it('should have handlers that return proper response format', async () => {
      const result = await toolHandlers.read_graph(manager, {});
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type');
      expect(result.content[0]).toHaveProperty('text');
    });
  });
});
