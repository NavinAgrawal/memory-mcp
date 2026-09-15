/**
 * loadGraph() read-only borrowed-view contract (memoryjs 4.2.0).
 *
 * memoryjs 4.2.0 changed `loadGraph()` to return a READ-ONLY borrowed view.
 * Outside production the view is a deep-frozen copy, so any consumer that
 * mutates the result throws a TypeError instead of silently corrupting the
 * live cache. Every `ctx.storage.loadGraph()` call site in `toolHandlers.ts`
 * reads the graph and never writes to it; this test pins that contract so a
 * future handler that mutates a borrowed view fails here rather than in
 * production, where the view IS the live cache and the mutation would land.
 *
 * On memoryjs 4.0.0 this test fails: the result was not frozen.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ManagerContext as KnowledgeGraphManager } from '@danielsimonjr/memoryjs';
import { handleToolCall } from '../../src/server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let manager: KnowledgeGraphManager;
let testDir: string;
let memoryPath: string;

beforeEach(async () => {
  testDir = await fs.mkdtemp(join(tmpdir(), 'readonly-contract-'));
  memoryPath = join(testDir, 'memory.jsonl');
  await fs.writeFile(memoryPath, '');
  manager = new KnowledgeGraphManager(memoryPath);
  await handleToolCall('create_entities', {
    entities: [
      { name: 'Alice', entityType: 'person', observations: ['software engineer'] },
    ],
  }, manager);
});

afterEach(async () => {
  manager.close();
  await fs.rm(testDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
});

describe('loadGraph() read-only borrowed view', () => {
  it('returns a deep-frozen graph outside production', async () => {
    const graph = await manager.storage.loadGraph();

    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.entities)).toBe(true);
    expect(Object.isFrozen(graph.relations)).toBe(true);
    expect(Object.isFrozen(graph.entities[0])).toBe(true);
  });

  it('throws TypeError when a caller mutates the borrowed view', async () => {
    const graph = await manager.storage.loadGraph();

    expect(() => {
      (graph.entities as unknown as unknown[]).push({ name: 'Mallory' });
    }).toThrow(TypeError);

    expect(() => {
      (graph.entities[0] as unknown as { name: string }).name = 'Renamed';
    }).toThrow(TypeError);
  });

  it('leaves the stored graph unchanged after a rejected mutation', async () => {
    const before = await manager.storage.loadGraph();
    expect(() => {
      (before.entities as unknown as unknown[]).push({ name: 'Mallory' });
    }).toThrow(TypeError);

    const after = await manager.storage.loadGraph();
    expect(after.entities.map(e => e.name)).toEqual(['Alice']);
  });
});
