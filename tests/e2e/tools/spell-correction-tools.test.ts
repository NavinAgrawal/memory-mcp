/**
 * Spell Correction Tools E2E Tests (Phase 16)
 *
 * Tests spell_suggest, spell_rebuild_vocabulary, spell_vocabulary_size.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ManagerContext as KnowledgeGraphManager } from '@danielsimonjr/memoryjs';
import { handleToolCall } from '../../../src/server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Spell Correction Tools E2E', () => {
  let manager: KnowledgeGraphManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `spell-tools-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new KnowledgeGraphManager(join(testDir, 'graph.jsonl'));
    // Seed entities so the spell checker has a vocabulary to learn from.
    await handleToolCall('create_entities', {
      entities: [
        { name: 'Authentication', entityType: 'concept', observations: ['handles user login flows'] },
        { name: 'Authorization', entityType: 'concept', observations: ['controls access permissions'] },
      ],
    }, manager);
  });

  afterEach(async () => {
    try { await fs.rm(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  const parse = (r: { content: Array<{ type: string; text: string }> }) => JSON.parse(r.content[0].text);

  describe('spell_rebuild_vocabulary', () => {
    it('rebuilds and reports vocabulary size', async () => {
      const result = await handleToolCall('spell_rebuild_vocabulary', {}, manager);
      const data = parse(result);
      expect(data.rebuilt).toBe(true);
      expect(typeof data.vocabularySize).toBe('number');
      expect(data.vocabularySize).toBeGreaterThan(0);
    });
  });

  describe('spell_vocabulary_size', () => {
    it('returns current vocabulary size', async () => {
      await handleToolCall('spell_rebuild_vocabulary', {}, manager);
      const result = await handleToolCall('spell_vocabulary_size', {}, manager);
      const data = parse(result);
      expect(typeof data.vocabularySize).toBe('number');
    });
  });

  describe('spell_suggest', () => {
    it('returns suggestions for a misspelled query', async () => {
      await handleToolCall('spell_rebuild_vocabulary', {}, manager);
      const result = await handleToolCall('spell_suggest', { query: 'Authentcation' }, manager);
      const data = parse(result);
      expect(data.query).toBe('Authentcation');
      expect(Array.isArray(data.suggestions)).toBe(true);
      expect(typeof data.count).toBe('number');
    });

    it('honors limit and minScore options', async () => {
      await handleToolCall('spell_rebuild_vocabulary', {}, manager);
      const result = await handleToolCall('spell_suggest', {
        query: 'Authz', limit: 2, minScore: 0.1, maxDistance: 5,
      }, manager);
      const data = parse(result);
      expect(data.suggestions.length).toBeLessThanOrEqual(2);
    });

    it('rejects empty query', async () => {
      const result = await handleToolCall('spell_suggest', { query: '' }, manager);
      expect(result.isError).toBe(true);
    });

    it('rejects missing query', async () => {
      const result = await handleToolCall('spell_suggest', {}, manager);
      expect(result.isError).toBe(true);
    });
  });
});
