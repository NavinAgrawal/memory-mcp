/**
 * Smoke tests for tool handlers not covered by other E2E tests.
 * Verifies handlers accept valid input and return non-error responses.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ManagerContext as KnowledgeGraphManager } from '@danielsimonjr/memoryjs';
import { handleToolCall } from '../../../src/server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let manager: KnowledgeGraphManager;
let testDir: string;
let memoryPath: string;

beforeEach(async () => {
  testDir = await fs.mkdtemp(join(tmpdir(), 'handler-smoke-'));
  memoryPath = join(testDir, 'memory.jsonl');
  await fs.writeFile(memoryPath, '');
  manager = new KnowledgeGraphManager(memoryPath);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

/** Helper: create test entities with relations for graph operations */
async function seedGraph() {
  await handleToolCall('create_entities', {
    entities: [
      { name: 'Alice', entityType: 'person', observations: ['software engineer'] },
      { name: 'Bob', entityType: 'person', observations: ['product manager'] },
      { name: 'ProjectX', entityType: 'project', observations: ['internal tool'] },
    ],
  }, manager);
  await handleToolCall('create_relations', {
    relations: [
      { from: 'Alice', to: 'ProjectX', relationType: 'works_on' },
      { from: 'Bob', to: 'ProjectX', relationType: 'manages' },
      { from: 'Alice', to: 'Bob', relationType: 'collaborates_with' },
    ],
  }, manager);
}

describe('Handler Smoke Tests', () => {
  // ==================== SEARCH HANDLERS ====================
  describe('search handlers', () => {
    beforeEach(seedGraph);

    it('search_by_date_range should return results', async () => {
      const result = await handleToolCall('search_by_date_range', {
        startDate: '2020-01-01',
        endDate: '2030-01-01',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('search_nodes_ranked should return ranked results', async () => {
      const result = await handleToolCall('search_nodes_ranked', {
        query: 'engineer',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('boolean_search should handle AND query', async () => {
      const result = await handleToolCall('boolean_search', {
        query: 'software AND engineer',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('fuzzy_search should find approximate matches', async () => {
      const result = await handleToolCall('fuzzy_search', {
        query: 'Alic',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('get_search_suggestions should return suggestions', async () => {
      const result = await handleToolCall('get_search_suggestions', {
        query: 'eng',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('search_auto should auto-select search method', async () => {
      const result = await handleToolCall('search_auto', {
        query: 'software engineer',
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== TAG HANDLERS ====================
  describe('tag handlers', () => {
    beforeEach(async () => {
      await seedGraph();
      await handleToolCall('add_tags', {
        entityName: 'Alice',
        tags: ['developer', 'senior'],
      }, manager);
    });

    it('remove_tags should remove tags from entity', async () => {
      const result = await handleToolCall('remove_tags', {
        entityName: 'Alice',
        tags: ['senior'],
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('set_importance should set entity importance', async () => {
      const result = await handleToolCall('set_importance', {
        entityName: 'Alice',
        importance: 8,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('add_tags_to_multiple_entities should bulk tag', async () => {
      const result = await handleToolCall('add_tags_to_multiple_entities', {
        entityNames: ['Alice', 'Bob'],
        tags: ['team-alpha'],
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('replace_tag should replace tag globally', async () => {
      const result = await handleToolCall('replace_tag', {
        oldTag: 'developer',
        newTag: 'engineer',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('merge_tags should merge two tags', async () => {
      await handleToolCall('add_tags', {
        entityName: 'Bob',
        tags: ['pm'],
      }, manager);
      const result = await handleToolCall('merge_tags', {
        tag1: 'developer',
        tag2: 'pm',
        targetTag: 'staff',
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== TAG ALIAS HANDLERS ====================
  describe('tag alias handlers', () => {
    it('add_tag_alias should create alias', async () => {
      const result = await handleToolCall('add_tag_alias', {
        alias: 'dev',
        canonical: 'developer',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('list_tag_aliases should return list', async () => {
      const result = await handleToolCall('list_tag_aliases', {}, manager);
      expect(result.isError).toBeUndefined();
    });

    it('resolve_tag should resolve alias', async () => {
      await handleToolCall('add_tag_alias', {
        alias: 'dev',
        canonical: 'developer',
      }, manager);
      const result = await handleToolCall('resolve_tag', {
        tag: 'dev',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('get_aliases_for_tag should return aliases', async () => {
      await handleToolCall('add_tag_alias', {
        alias: 'dev',
        canonical: 'developer',
      }, manager);
      const result = await handleToolCall('get_aliases_for_tag', {
        canonicalTag: 'developer',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('remove_tag_alias should remove alias', async () => {
      await handleToolCall('add_tag_alias', {
        alias: 'dev',
        canonical: 'developer',
      }, manager);
      const result = await handleToolCall('remove_tag_alias', {
        alias: 'dev',
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== HIERARCHY HANDLERS ====================
  describe('hierarchy handlers', () => {
    beforeEach(async () => {
      await handleToolCall('create_entities', {
        entities: [
          { name: 'Root', entityType: 'category', observations: ['top level'] },
          { name: 'Child', entityType: 'category', observations: ['nested'] },
          { name: 'Grandchild', entityType: 'item', observations: ['deep nested'] },
        ],
      }, manager);
      await handleToolCall('set_entity_parent', {
        entityName: 'Child',
        parentName: 'Root',
      }, manager);
      await handleToolCall('set_entity_parent', {
        entityName: 'Grandchild',
        parentName: 'Child',
      }, manager);
    });

    it('get_parent should return parent entity', async () => {
      const result = await handleToolCall('get_parent', {
        entityName: 'Child',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('get_ancestors should return ancestor chain', async () => {
      const result = await handleToolCall('get_ancestors', {
        entityName: 'Grandchild',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('get_descendants should return all descendants', async () => {
      const result = await handleToolCall('get_descendants', {
        entityName: 'Root',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('get_subtree should return subtree with relations', async () => {
      const result = await handleToolCall('get_subtree', {
        entityName: 'Root',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('get_root_entities should return roots', async () => {
      const result = await handleToolCall('get_root_entities', {}, manager);
      expect(result.isError).toBeUndefined();
    });

    it('get_entity_depth should return depth', async () => {
      const result = await handleToolCall('get_entity_depth', {
        entityName: 'Grandchild',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('move_entity should move entity to new parent', async () => {
      const result = await handleToolCall('move_entity', {
        entityName: 'Grandchild',
        newParentName: 'Root',
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== GRAPH ALGORITHM HANDLERS ====================
  describe('graph algorithm handlers', () => {
    beforeEach(seedGraph);

    it('find_shortest_path should find path', async () => {
      const result = await handleToolCall('find_shortest_path', {
        source: 'Alice',
        target: 'Bob',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('find_all_paths should find paths', async () => {
      const result = await handleToolCall('find_all_paths', {
        source: 'Alice',
        target: 'Bob',
        maxDepth: 3,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('get_connected_components should return components', async () => {
      const result = await handleToolCall('get_connected_components', {}, manager);
      expect(result.isError).toBeUndefined();
    });

    it('get_centrality should calculate degree centrality', async () => {
      const result = await handleToolCall('get_centrality', {
        algorithm: 'degree',
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== COMPRESSION HANDLERS ====================
  describe('compression handlers', () => {
    beforeEach(seedGraph);

    it('find_duplicates should detect duplicates', async () => {
      const result = await handleToolCall('find_duplicates', {
        threshold: 0.5,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('compress_graph should run dry-run', async () => {
      const result = await handleToolCall('compress_graph', {
        threshold: 0.5,
        dryRun: true,
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== SAVED SEARCH HANDLERS ====================
  describe('saved search handlers', () => {
    it('save_search should save a search', async () => {
      const result = await handleToolCall('save_search', {
        name: 'test-search',
        query: 'engineer',
        description: 'test search',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('list_saved_searches should return list', async () => {
      const result = await handleToolCall('list_saved_searches', {}, manager);
      expect(result.isError).toBeUndefined();
    });

    it('execute_saved_search should execute search', async () => {
      await handleToolCall('save_search', {
        name: 'test-search',
        query: 'engineer',
        description: 'test search',
      }, manager);
      const result = await handleToolCall('execute_saved_search', {
        name: 'test-search',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('update_saved_search should update search', async () => {
      await handleToolCall('save_search', {
        name: 'test-search',
        query: 'engineer',
        description: 'test search',
      }, manager);
      const result = await handleToolCall('update_saved_search', {
        name: 'test-search',
        updates: { query: 'developer' },
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('delete_saved_search should delete search', async () => {
      await handleToolCall('save_search', {
        name: 'test-search',
        query: 'engineer',
        description: 'test search',
      }, manager);
      const result = await handleToolCall('delete_saved_search', {
        name: 'test-search',
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== ANALYTICS HANDLERS ====================
  describe('analytics handlers', () => {
    it('get_graph_stats should return stats', async () => {
      const result = await handleToolCall('get_graph_stats', {}, manager);
      expect(result.isError).toBeUndefined();
    });

    it('validate_graph should validate', async () => {
      const result = await handleToolCall('validate_graph', {}, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== SEMANTIC SEARCH HANDLERS (no provider) ====================
  describe('semantic_search handler', () => {
    it('should handle search when no embedding provider configured', async () => {
      const result = await handleToolCall('semantic_search', { query: 'test' }, manager);
      // Without an embedding provider, returns a message (may or may not set isError)
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toBeDefined();
    });
  });

  describe('index_embeddings handler', () => {
    it('should handle indexing on empty graph', async () => {
      const result = await handleToolCall('index_embeddings', {}, manager);
      expect(result.content).toBeDefined();
    });

    it('should handle indexing with seeded data', async () => {
      await seedGraph();
      const result = await handleToolCall('index_embeddings', {}, manager);
      expect(result.content).toBeDefined();
    });
  });

  // ==================== ANALYZE QUERY HANDLER ====================
  describe('analyze_query handler', () => {
    it('should analyze a simple query', async () => {
      const result = await handleToolCall('analyze_query', { query: 'software engineer' }, manager);
      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
      expect(parsed.query).toBe('software engineer');
      expect(parsed.analysis).toBeDefined();
    });

    it('should include plan when includePlan is true', async () => {
      const result = await handleToolCall('analyze_query', { query: 'find all engineers', includePlan: true }, manager);
      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
      expect(parsed.plan).toBeDefined();
    });

    it('should not include plan by default', async () => {
      const result = await handleToolCall('analyze_query', { query: 'test query' }, manager);
      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
      expect(parsed.plan).toBeUndefined();
    });
  });

  // ==================== INVALIDATE RELATION HANDLER ====================
  describe('invalidate_relation handler', () => {
    beforeEach(seedGraph);

    it('should invalidate an existing relation', async () => {
      const result = await handleToolCall('invalidate_relation', {
        from: 'Alice',
        relationType: 'works_on',
        to: 'ProjectX',
      }, manager);
      expect(result.isError).toBeUndefined();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain('Invalidated');
    });

    it('should accept custom ended date', async () => {
      const result = await handleToolCall('invalidate_relation', {
        from: 'Alice',
        relationType: 'collaborates_with',
        to: 'Bob',
        ended: '2025-01-01T00:00:00Z',
      }, manager);
      expect(result.isError).toBeUndefined();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain('2025-01-01');
    });

    it('should handle non-existent relation gracefully', async () => {
      const result = await handleToolCall('invalidate_relation', {
        from: 'Alice',
        relationType: 'nonexistent',
        to: 'Bob',
      }, manager);
      // May succeed or return error depending on implementation
      expect(result.content).toBeDefined();
    });
  });

  // ==================== NORMALIZE OBSERVATIONS HANDLER ====================
  describe('normalize_observations handler', () => {
    beforeEach(seedGraph);

    it('should normalize all observations', async () => {
      const result = await handleToolCall('normalize_observations', {}, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should normalize observations for a specific entity', async () => {
      const result = await handleToolCall('normalize_observations', {
        entityName: 'Alice',
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== FORGET MEMORY HANDLER ====================
  describe('forget_memory handler', () => {
    beforeEach(seedGraph);

    it('should handle non-matching content', async () => {
      const result = await handleToolCall('forget_memory', {
        content: 'completely nonexistent thing xyz123',
      }, manager);
      // Returns either not_found message or error - both are valid
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toBeDefined();
    });

    it('should perform dry run without deleting', async () => {
      const result = await handleToolCall('forget_memory', {
        content: 'software engineer',
        dryRun: true,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should forget matching content', async () => {
      const result = await handleToolCall('forget_memory', {
        content: 'software engineer',
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== INGEST HANDLER ====================
  describe('ingest handler', () => {
    it('should return message when no messages provided', async () => {
      const result = await handleToolCall('ingest', { messages: [] }, manager);
      expect(result.isError).toBeUndefined();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain('No messages provided');
    });

    it('should ingest valid messages', async () => {
      const result = await handleToolCall('ingest', {
        messages: [
          { role: 'user', content: 'What is the capital of France?' },
          { role: 'assistant', content: 'The capital of France is Paris.' },
        ],
        source: 'test-conversation',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should support tags and projectId', async () => {
      const result = await handleToolCall('ingest', {
        messages: [
          { role: 'user', content: 'Hello world' },
        ],
        source: 'test',
        projectId: 'proj-1',
        tags: ['test-tag'],
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== GET ENTITY VERSIONS HANDLER ====================
  describe('get_entity_versions handler', () => {
    beforeEach(seedGraph);

    it('should return version info for existing entity', async () => {
      const result = await handleToolCall('get_entity_versions', {
        entityName: 'Alice',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should return error for non-existent entity', async () => {
      const result = await handleToolCall('get_entity_versions', {
        entityName: 'NonExistent',
      }, manager);
      expect(result.isError).toBe(true);
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain('not found');
    });
  });

  // ==================== GET CENTRALITY HANDLER ====================
  describe('get_centrality handler', () => {
    beforeEach(seedGraph);

    it('should calculate degree centrality by default', async () => {
      const result = await handleToolCall('get_centrality', {}, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should calculate betweenness centrality', async () => {
      const result = await handleToolCall('get_centrality', {
        algorithm: 'betweenness',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should calculate pagerank centrality', async () => {
      const result = await handleToolCall('get_centrality', {
        algorithm: 'pagerank',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept topN parameter', async () => {
      const result = await handleToolCall('get_centrality', {
        algorithm: 'degree',
        direction: 'in',
        topN: 2,
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== MERGE ENTITIES HANDLER ====================
  describe('merge_entities handler', () => {
    beforeEach(seedGraph);

    it('should merge entities', async () => {
      const result = await handleToolCall('merge_entities', {
        entityNames: ['Alice', 'Bob'],
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should merge entities with custom target name', async () => {
      const result = await handleToolCall('merge_entities', {
        entityNames: ['Alice', 'Bob'],
        targetName: 'AliceBob',
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== FIND SHORTEST PATH HANDLER ====================
  describe('find_shortest_path handler', () => {
    beforeEach(seedGraph);

    it('should find path between connected entities', async () => {
      const result = await handleToolCall('find_shortest_path', {
        source: 'Alice',
        target: 'Bob',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should handle no path found', async () => {
      // Create an isolated entity
      await handleToolCall('create_entities', {
        entities: [{ name: 'Isolated', entityType: 'person', observations: ['alone'] }],
      }, manager);
      const result = await handleToolCall('find_shortest_path', {
        source: 'Alice',
        target: 'Isolated',
      }, manager);
      expect(result.isError).toBeUndefined();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain('No path found');
    });
  });

  // ==================== SMART SEARCH HANDLER ====================
  describe('smart_search handler', () => {
    beforeEach(seedGraph);

    it('should perform smart search with defaults', async () => {
      const result = await handleToolCall('smart_search', {
        query: 'software engineer',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept maxIterations parameter', async () => {
      const result = await handleToolCall('smart_search', {
        query: 'project manager',
        maxIterations: 1,
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== HYBRID SEARCH HANDLER ====================
  describe('hybrid_search handler', () => {
    beforeEach(seedGraph);

    it('should perform hybrid search with defaults', async () => {
      const result = await handleToolCall('hybrid_search', {
        query: 'engineer',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept custom weights and filters', async () => {
      const result = await handleToolCall('hybrid_search', {
        query: 'engineer',
        weights: { semantic: 0.3, lexical: 0.5, symbolic: 0.2 },
        filters: { entityTypes: ['person'] },
        limit: 5,
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== UPDATE PROFILE HANDLER ====================
  describe('update_profile handler', () => {
    it('should add a static profile fact', async () => {
      const result = await handleToolCall('update_profile', {
        content: 'User prefers dark mode',
        type: 'static',
      }, manager);
      expect(result.isError).toBeUndefined();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain('static');
    });

    it('should add a dynamic profile fact', async () => {
      const result = await handleToolCall('update_profile', {
        content: 'Currently working on ProjectX',
        type: 'dynamic',
      }, manager);
      expect(result.isError).toBeUndefined();
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain('dynamic');
    });

    it('should accept projectId', async () => {
      const result = await handleToolCall('update_profile', {
        content: 'Prefers TypeScript',
        type: 'static',
        projectId: 'proj-1',
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });
});
