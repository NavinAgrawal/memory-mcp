/**
 * Observation Dedup Tools E2E Tests (Phase 16)
 *
 * Tests find_duplicate_observations, find_jaccard_duplicate_observations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ManagerContext as KnowledgeGraphManager } from '@danielsimonjr/memoryjs';
import { handleToolCall } from '../../../src/server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Observation Dedup Tools E2E', () => {
  let manager: KnowledgeGraphManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `obs-dedup-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new KnowledgeGraphManager(join(testDir, 'graph.jsonl'));
    // Seed two entities sharing an identical observation so dedup has something to find.
    await handleToolCall('create_entities', {
      entities: [
        { name: 'Alpha', entityType: 'service', observations: ['the duplicate fact', 'unique alpha note'] },
        { name: 'Beta', entityType: 'service', observations: ['the duplicate fact', 'unique beta note'] },
        { name: 'Gamma', entityType: 'doc', observations: ['unrelated content here'] },
      ],
    }, manager);
  });

  afterEach(async () => {
    try { await fs.rm(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  const parse = (r: { content: Array<{ type: string; text: string }> }) => JSON.parse(r.content[0].text);

  describe('find_duplicate_observations', () => {
    it('finds exact duplicate observations across entities', async () => {
      const result = await handleToolCall('find_duplicate_observations', {}, manager);
      const data = parse(result);
      expect(Array.isArray(data.groups)).toBe(true);
      expect(typeof data.count).toBe('number');
      // The seeded duplicate should appear.
      const hasDuplicate = data.groups.some((g: { occurrences: unknown[] }) => g.occurrences.length >= 2);
      expect(hasDuplicate).toBe(true);
    });

    it('respects entityType filter (string)', async () => {
      const result = await handleToolCall('find_duplicate_observations', { entityType: 'service' }, manager);
      const data = parse(result);
      expect(data.filter.entityType).toBe('service');
    });

    it('respects entityType filter (array)', async () => {
      const result = await handleToolCall('find_duplicate_observations', { entityType: ['service', 'doc'] }, manager);
      const data = parse(result);
      expect(Array.isArray(data.filter.entityType)).toBe(true);
    });

    it('ignores minOccurrences below 2', async () => {
      const result = await handleToolCall('find_duplicate_observations', { minOccurrences: 1 }, manager);
      const data = parse(result);
      // Filter helper drops invalid values silently.
      expect(data.filter.minOccurrences).toBeUndefined();
    });
  });

  describe('find_jaccard_duplicate_observations', () => {
    it('runs without errors on seeded data', async () => {
      const result = await handleToolCall('find_jaccard_duplicate_observations', {}, manager);
      const data = parse(result);
      expect(Array.isArray(data.groups)).toBe(true);
      expect(typeof data.count).toBe('number');
    });
  });
});
