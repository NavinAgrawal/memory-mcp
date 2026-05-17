/**
 * Engineering / diagnostic MCP tools (v12.5.0).
 *
 * Tests the 10 new tools that mirror the memoryjs CLI engineering surface:
 *   diag, health, check_graph (with apply), reindex (with --ranked/--spell),
 *   cache_stats, cache_clear, graph_size, inspect_entity, hierarchy_tree,
 *   entity_neighbors.
 *
 * Verifies the JSON contract of each handler against a seeded multi-entity
 * graph (parent/child hierarchy + relations). Also includes a deliberately-
 * broken graph for check_graph dry-run vs --apply repair paths.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ManagerContext as KnowledgeGraphManager } from '@danielsimonjr/memoryjs';
import { handleToolCall } from '../../../src/server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Engineering Tools E2E', () => {
  let manager: KnowledgeGraphManager;
  let testDir: string;
  let storagePath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `eng-tools-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    storagePath = join(testDir, 'graph.jsonl');
    manager = new KnowledgeGraphManager(storagePath);
    await handleToolCall('create_entities', {
      entities: [
        { name: 'Root', entityType: 'service', observations: ['root note'], tags: ['core'], importance: 8 },
        { name: 'Child1', entityType: 'service', observations: ['c1 note'] },
        { name: 'Child2', entityType: 'service', observations: ['c2 note'] },
        { name: 'Grandkid', entityType: 'service', observations: [] },
        { name: 'Unrelated', entityType: 'doc', observations: ['standalone'] },
      ],
    }, manager);
    await handleToolCall('set_entity_parent', { entityName: 'Child1', parentName: 'Root' }, manager);
    await handleToolCall('set_entity_parent', { entityName: 'Child2', parentName: 'Root' }, manager);
    await handleToolCall('set_entity_parent', { entityName: 'Grandkid', parentName: 'Child1' }, manager);
    await handleToolCall('create_relations', {
      relations: [{ from: 'Root', to: 'Unrelated', relationType: 'references' }],
    }, manager);
  });

  afterEach(async () => {
    try { await fs.rm(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  const parse = (r: { content: Array<{ type: string; text: string }> }) => JSON.parse(r.content[0].text);

  describe('diag', () => {
    it('returns runtime + storage + counts', async () => {
      const result = parse(await handleToolCall('diag', {}, manager));
      expect(result.runtime.node).toMatch(/^v\d+/);
      expect(result.storage.path).toContain('graph.jsonl');
      expect(result.storage.exists).toBe(true);
      expect(result.storage.entities).toBe(5);
      expect(result.storage.relations).toBe(1);
      expect(typeof result.loadedAt).toBe('string');
    });
  });

  describe('health', () => {
    it('reports ok=true on a clean graph', async () => {
      const result = parse(await handleToolCall('health', {}, manager));
      expect(result.ok).toBe(true);
      expect(result.failed).toBe(0);
      expect(result.checks.map((c: { name: string }) => c.name)).toContain('storage:loadGraph');
      expect(result.checks.map((c: { name: string }) => c.name)).toContain('relations:no-orphans');
    });
  });

  describe('check_graph', () => {
    it('dry-run on a clean graph returns ok=true with no actions', async () => {
      const result = parse(await handleToolCall('check_graph', {}, manager));
      expect(result.ok).toBe(true);
      expect(result.applied).toBe(false);
      expect(result.orphanRelations).toHaveLength(0);
      expect(result.actions).toBeUndefined();
    });

    it('apply=true on a clean graph stays a no-op', async () => {
      const result = parse(await handleToolCall('check_graph', { apply: true }, manager));
      expect(result.ok).toBe(true);
      expect(result.applied).toBe(true);
      expect(result.actions).toBeUndefined();
    });

    it('detects orphan relation when graph has dangling reference', async () => {
      // Hand-write a broken JSONL with an orphan relation so we don't have to coerce
      // the manager into creating one (it would reject during createRelations).
      const dir2 = join(tmpdir(), `eng-broken-${Date.now()}-${Math.random()}`);
      await fs.mkdir(dir2, { recursive: true });
      const brokenPath = join(dir2, 'broken.jsonl');
      await fs.writeFile(brokenPath, [
        JSON.stringify({ type: 'entity', name: 'A', entityType: 't', observations: [] }),
        JSON.stringify({ type: 'relation', from: 'A', to: 'GHOST', relationType: 'dangling' }),
      ].join('\n') + '\n');
      const m2 = new KnowledgeGraphManager(brokenPath);

      const result = parse(await handleToolCall('check_graph', {}, m2));
      expect(result.ok).toBe(false);
      expect(result.orphanRelations).toHaveLength(1);
      expect(result.orphanRelations[0]).toMatchObject({ from: 'A', to: 'GHOST', reason: 'to-missing' });

      const apply = parse(await handleToolCall('check_graph', { apply: true }, m2));
      expect(apply.applied).toBe(true);
      expect(apply.actions.orphanRelationsDeleted).toBe(1);

      try { await fs.rm(dir2, { recursive: true, force: true }); } catch { /* ignore */ }
    });
  });

  describe('reindex', () => {
    it('rebuilds both targets by default', async () => {
      const result = parse(await handleToolCall('reindex', {}, manager));
      expect(result.ok).toBe(true);
      expect(result.result.ranked.ok).toBe(true);
      expect(result.result.spell.ok).toBe(true);
    });

    it('ranked=false rebuilds only spell', async () => {
      const result = parse(await handleToolCall('reindex', { ranked: false }, manager));
      expect(result.result.spell).toBeDefined();
      expect(result.result.ranked).toBeUndefined();
    });
  });

  describe('cache_stats + cache_clear', () => {
    it('stats returns the four-tier shape', async () => {
      const result = parse(await handleToolCall('cache_stats', {}, manager));
      expect(Object.keys(result.stats).sort()).toEqual(['basic', 'boolean', 'fuzzy', 'ranked']);
    });

    it('clear reports cleared=true', async () => {
      const result = parse(await handleToolCall('cache_clear', {}, manager));
      expect(result.cleared).toBe(true);
      expect(result.caches).toContain('ranked');
    });
  });

  describe('graph_size', () => {
    it('reports counts + storage footprint', async () => {
      const result = parse(await handleToolCall('graph_size', {}, manager));
      expect(result.graph.entities).toBe(5);
      expect(result.graph.relations).toBe(1);
      expect(result.graph.observations).toBeGreaterThanOrEqual(4);
      expect(result.storage.exists).toBe(true);
      expect(result.storage.sizeBytes).toBeGreaterThan(0);
      expect(result.storage.lineCount).toBeGreaterThan(0);
    });
  });

  describe('inspect_entity', () => {
    it('returns observations + relations + hierarchy', async () => {
      const result = parse(await handleToolCall('inspect_entity', { name: 'Root' }, manager));
      expect(result.name).toBe('Root');
      expect(result.observations).toContain('root note');
      expect(result.tags).toContain('core');
      expect(result.children.sort()).toEqual(['Child1', 'Child2']);
      expect(result.relations.outgoing[0].to).toBe('Unrelated');
    });

    it('errors on unknown entity', async () => {
      const result = await handleToolCall('inspect_entity', { name: 'NoSuch' }, manager);
      expect(result.isError).toBe(true);
    });
  });

  describe('hierarchy_tree', () => {
    it('returns the subtree rooted at an explicit name', async () => {
      const result = parse(await handleToolCall('hierarchy_tree', { root: 'Root' }, manager));
      expect(result.trees).toHaveLength(1);
      expect(result.trees[0].name).toBe('Root');
      expect(result.trees[0].children.map((c: { name: string }) => c.name).sort()).toEqual(['Child1', 'Child2']);
    });

    it('returns all root entities when root omitted', async () => {
      const result = parse(await handleToolCall('hierarchy_tree', {}, manager));
      expect(Array.isArray(result.trees)).toBe(true);
      // Root + Unrelated have no parent — both qualify as roots.
      const rootNames = result.trees.map((t: { name: string }) => t.name).sort();
      expect(rootNames).toContain('Root');
      expect(rootNames).toContain('Unrelated');
    });
  });

  describe('entity_neighbors', () => {
    it('reports degree counts and edges', async () => {
      const result = parse(await handleToolCall('entity_neighbors', { name: 'Root' }, manager));
      expect(result.outDegree).toBe(1);
      expect(result.inDegree).toBe(0);
      expect(result.outgoing[0].to).toBe('Unrelated');
    });
  });
});
