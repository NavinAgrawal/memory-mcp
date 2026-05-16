/**
 * Heuristic Guidelines Tools E2E Tests (Phase 16)
 *
 * Tests add_heuristic, get_heuristic, list_heuristics, heuristic_count,
 * match_heuristics, reinforce_heuristic, record_heuristic_contradiction,
 * detect_heuristic_conflicts, remove_heuristic, clear_heuristics.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ManagerContext as KnowledgeGraphManager } from '@danielsimonjr/memoryjs';
import { handleToolCall } from '../../../src/server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Heuristic Tools E2E', () => {
  let manager: KnowledgeGraphManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `heuristic-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new KnowledgeGraphManager(join(testDir, 'graph.jsonl'));
  });

  afterEach(async () => {
    try { await fs.rm(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  const parse = (r: { content: Array<{ type: string; text: string }> }) => JSON.parse(r.content[0].text);

  const addH = async (condition: string, action: string, extra: Record<string, unknown> = {}) =>
    parse(await handleToolCall('add_heuristic', { condition, action, ...extra }, manager));

  describe('add_heuristic + get_heuristic', () => {
    it('adds and retrieves a heuristic', async () => {
      const { id } = await addH('on TypeScript file', 'run typecheck before commit');
      expect(id).toBeDefined();

      const retrieved = parse(await handleToolCall('get_heuristic', { id }, manager));
      expect(retrieved.heuristic).not.toBeNull();
    });

    it('rejects empty condition', async () => {
      const result = await handleToolCall('add_heuristic', { condition: '', action: 'x' }, manager);
      expect(result.isError).toBe(true);
    });

    it('rejects empty action', async () => {
      const result = await handleToolCall('add_heuristic', { condition: 'c', action: '' }, manager);
      expect(result.isError).toBe(true);
    });

    it('returns null heuristic for unknown id', async () => {
      const result = parse(await handleToolCall('get_heuristic', { id: 'nope' }, manager));
      expect(result.heuristic).toBeNull();
    });
  });

  describe('list_heuristics + heuristic_count', () => {
    it('lists added heuristics and reports count', async () => {
      await addH('a', 'do-a');
      await addH('b', 'do-b');
      const list = parse(await handleToolCall('list_heuristics', {}, manager));
      expect(list.count).toBe(2);
      const count = parse(await handleToolCall('heuristic_count', {}, manager));
      expect(count.count).toBe(2);
    });
  });

  describe('match_heuristics', () => {
    it('returns matches for an input', async () => {
      await addH('on TypeScript file', 'run typecheck');
      const result = parse(await handleToolCall('match_heuristics', {
        input: 'editing a TypeScript file', limit: 5,
      }, manager));
      expect(result.input).toBe('editing a TypeScript file');
      expect(Array.isArray(result.matches)).toBe(true);
    });

    it('rejects empty input', async () => {
      const result = await handleToolCall('match_heuristics', { input: '' }, manager);
      expect(result.isError).toBe(true);
    });
  });

  describe('reinforce_heuristic + record_heuristic_contradiction', () => {
    it('reinforce returns a result for a known id', async () => {
      const { id } = await addH('c', 'd');
      const result = parse(await handleToolCall('reinforce_heuristic', { id }, manager));
      expect(result.id).toBe(id);
      expect(result.result).toBeDefined();
    });

    it('record_heuristic_contradiction returns a result', async () => {
      const { id } = await addH('e', 'f');
      const result = parse(await handleToolCall('record_heuristic_contradiction', { id }, manager));
      expect(result.id).toBe(id);
      expect(result.result).toBeDefined();
    });
  });

  describe('detect_heuristic_conflicts', () => {
    it('returns conflicts array', async () => {
      await addH('on save', 'lint');
      await addH('on save', 'do not lint');
      const result = parse(await handleToolCall('detect_heuristic_conflicts', {}, manager));
      expect(Array.isArray(result.conflicts)).toBe(true);
      expect(typeof result.count).toBe('number');
    });
  });

  describe('remove_heuristic + clear_heuristics', () => {
    it('removes a single heuristic', async () => {
      const { id } = await addH('g', 'h');
      const result = parse(await handleToolCall('remove_heuristic', { id }, manager));
      expect(typeof result.removed).toBe('boolean');
    });

    it('clears all heuristics', async () => {
      await addH('i', 'j');
      await addH('k', 'l');
      const result = parse(await handleToolCall('clear_heuristics', {}, manager));
      expect(result.cleared).toBe(true);
      const after = parse(await handleToolCall('heuristic_count', {}, manager));
      expect(after.count).toBe(0);
    });
  });
});
