/**
 * Exclusion (do_not_remember) Tools E2E Tests (Phase 16)
 *
 * Tests add_exclusion_rule, list_exclusion_rules, remove_exclusion_rule,
 * check_exclusion, find_matching_memories_for_rule.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ManagerContext as KnowledgeGraphManager } from '@danielsimonjr/memoryjs';
import { handleToolCall } from '../../../src/server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Exclusion Tools E2E', () => {
  let manager: KnowledgeGraphManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `exclusion-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new KnowledgeGraphManager(join(testDir, 'graph.jsonl'));
  });

  afterEach(async () => {
    try { await fs.rm(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  const parse = (r: { content: Array<{ type: string; text: string }> }) => JSON.parse(r.content[0].text);

  describe('add_exclusion_rule', () => {
    it('adds a rule with a pattern only', async () => {
      const result = await handleToolCall('add_exclusion_rule', { pattern: 'super-secret' }, manager);
      const data = parse(result);
      expect(data.rule).toBeDefined();
      expect(data.rule.pattern).toBe('super-secret');
    });

    it('accepts optional scope, entityType, reason', async () => {
      const result = await handleToolCall('add_exclusion_rule', {
        pattern: 'pii-block',
        scope: 'future-only',
        entityType: 'note',
        reason: 'PII compliance',
      }, manager);
      const data = parse(result);
      expect(data.rule.scope).toBe('future-only');
      expect(data.rule.entityType).toBe('note');
    });

    it('rejects empty pattern', async () => {
      const result = await handleToolCall('add_exclusion_rule', { pattern: '' }, manager);
      expect(result.isError).toBe(true);
    });

    it('rejects invalid scope', async () => {
      const result = await handleToolCall('add_exclusion_rule', {
        pattern: 'x', scope: 'invalid-scope',
      }, manager);
      expect(result.isError).toBe(true);
    });
  });

  describe('list_exclusion_rules', () => {
    it('lists added rules', async () => {
      await handleToolCall('add_exclusion_rule', { pattern: 'foo' }, manager);
      await handleToolCall('add_exclusion_rule', { pattern: 'bar' }, manager);
      const result = await handleToolCall('list_exclusion_rules', {}, manager);
      const data = parse(result);
      expect(data.count).toBe(2);
      expect(data.rules).toHaveLength(2);
    });
  });

  describe('check_exclusion', () => {
    it('returns blocked verdict for matching content', async () => {
      await handleToolCall('add_exclusion_rule', { pattern: 'secret' }, manager);
      const result = await handleToolCall('check_exclusion', {
        content: 'this contains a secret token',
      }, manager);
      const data = parse(result);
      expect(data.blocked).toBe(true);
    });

    it('returns unblocked for non-matching content', async () => {
      await handleToolCall('add_exclusion_rule', { pattern: 'secret' }, manager);
      const result = await handleToolCall('check_exclusion', {
        content: 'innocuous string',
      }, manager);
      const data = parse(result);
      expect(data.blocked).toBe(false);
    });
  });

  describe('remove_exclusion_rule', () => {
    it('removes a rule by id', async () => {
      const added = parse(await handleToolCall('add_exclusion_rule', { pattern: 'temp' }, manager));
      const result = await handleToolCall('remove_exclusion_rule', { id: added.rule.id }, manager);
      const data = parse(result);
      expect(data.removed).toBe(true);
    });

    it('returns removed=false for unknown id', async () => {
      const result = await handleToolCall('remove_exclusion_rule', { id: 'nonexistent-id' }, manager);
      const data = parse(result);
      expect(data.removed).toBe(false);
    });
  });

  describe('find_matching_memories_for_rule', () => {
    beforeEach(async () => {
      await handleToolCall('create_entities', {
        entities: [
          { name: 'SecretDoc', entityType: 'note', observations: ['this contains a secret token'] },
          { name: 'PublicDoc', entityType: 'note', observations: ['this is public info'] },
        ],
      }, manager);
    });

    it('finds entities whose observations match the pattern', async () => {
      const result = await handleToolCall('find_matching_memories_for_rule', { pattern: 'secret' }, manager);
      const data = parse(result);
      expect(data.pattern).toBe('secret');
      expect(typeof data.count).toBe('number');
      expect(Array.isArray(data.matches)).toBe(true);
    });
  });
});
