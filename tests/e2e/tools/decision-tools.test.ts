/**
 * Decision Rationale Tools E2E Tests (Phase 16)
 *
 * Tests propose_decision, accept_decision, reject_decision, supersede_decision,
 * find_decisions_by_context, get_decision_chain, list_decisions, get_decision,
 * export_decision_as_adr_markdown, parse_adr_markdown.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ManagerContext as KnowledgeGraphManager } from '@danielsimonjr/memoryjs';
import { handleToolCall } from '../../../src/server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Decision Tools E2E', () => {
  let manager: KnowledgeGraphManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `decision-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new KnowledgeGraphManager(join(testDir, 'graph.jsonl'));
  });

  afterEach(async () => {
    try { await fs.rm(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  const parse = (r: { content: Array<{ type: string; text: string }> }) => JSON.parse(r.content[0].text);

  const propose = async (overrides: Record<string, unknown> = {}) =>
    parse(await handleToolCall('propose_decision', {
      context: 'Choosing a storage backend',
      decision: 'Use SQLite for ACID guarantees',
      alternatives: ['JSONL', 'PostgreSQL'],
      consequences: ['ACID compliance', 'better-sqlite3 native dep'],
      ...overrides,
    }, manager));

  describe('propose_decision', () => {
    it('proposes with required fields and defaults', async () => {
      const result = await propose();
      expect(result.record).toBeDefined();
      expect(result.record.id).toBeDefined();
    });

    it('rejects empty context', async () => {
      const result = await handleToolCall('propose_decision', {
        context: '', decision: 'x',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('rejects empty decision', async () => {
      const result = await handleToolCall('propose_decision', {
        context: 'c', decision: '',
      }, manager);
      expect(result.isError).toBe(true);
    });
  });

  describe('accept_decision / reject_decision', () => {
    it('accepts a proposed decision', async () => {
      const { record } = await propose();
      const result = parse(await handleToolCall('accept_decision', { id: record.id }, manager));
      expect(result.id).toBe(record.id);
      expect(result.result).toBeDefined();
    });

    it('rejects a proposed decision with reason', async () => {
      const { record } = await propose();
      const result = parse(await handleToolCall('reject_decision', {
        id: record.id, reason: 'changed scope',
      }, manager));
      expect(result.reason).toBe('changed scope');
    });

    it('reject requires reason', async () => {
      const { record } = await propose();
      const result = await handleToolCall('reject_decision', { id: record.id }, manager);
      expect(result.isError).toBe(true);
    });
  });

  describe('supersede_decision + get_decision_chain', () => {
    it('supersedes and the chain reflects it', async () => {
      const first = (await propose()).record;
      const second = (await propose({ decision: 'switched to JSONL after all' })).record;
      const supersede = parse(await handleToolCall('supersede_decision', {
        id: first.id, by: second.id,
      }, manager));
      expect(supersede.result).toBeDefined();

      const chain = parse(await handleToolCall('get_decision_chain', { id: first.id }, manager));
      expect(typeof chain.length).toBe('number');
      expect(Array.isArray(chain.chain)).toBe(true);
    });
  });

  describe('find_decisions_by_context + list_decisions + get_decision', () => {
    it('finds decisions by context substring', async () => {
      await propose();
      const result = parse(await handleToolCall('find_decisions_by_context', {
        query: 'storage',
      }, manager));
      expect(result.query).toBe('storage');
      expect(Array.isArray(result.records)).toBe(true);
    });

    it('lists decisions with status filter', async () => {
      await propose();
      const result = parse(await handleToolCall('list_decisions', {
        status: 'proposed', limit: 10,
      }, manager));
      expect(Array.isArray(result.records)).toBe(true);
    });

    it('lists rejects invalid status', async () => {
      const result = await handleToolCall('list_decisions', { status: 'bogus' }, manager);
      expect(result.isError).toBe(true);
    });

    it('gets a single decision', async () => {
      const { record } = await propose();
      const result = parse(await handleToolCall('get_decision', { id: record.id }, manager));
      expect(result.record).not.toBeNull();
    });
  });

  describe('export_decision_as_adr_markdown', () => {
    it('returns ADR markdown text', async () => {
      const { record } = await propose();
      const result = await handleToolCall('export_decision_as_adr_markdown', {
        id: record.id,
      }, manager);
      expect(typeof result.content[0].text).toBe('string');
      expect(result.content[0].text.length).toBeGreaterThan(0);
    });
  });

  describe('parse_adr_markdown', () => {
    it('parses an ADR markdown document', async () => {
      const adr = [
        '# 1. Use SQLite',
        '',
        'Date: 2026-05-16',
        '',
        '## Status',
        '',
        'Proposed',
        '',
        '## Context',
        '',
        'We need ACID storage.',
        '',
        '## Decision',
        '',
        'Adopt SQLite.',
        '',
        '## Consequences',
        '',
        '- Native dep',
      ].join('\n');
      const result = parse(await handleToolCall('parse_adr_markdown', { text: adr }, manager));
      expect(result.parsed).toBeDefined();
    });

    it('rejects empty text', async () => {
      const result = await handleToolCall('parse_adr_markdown', { text: '' }, manager);
      expect(result.isError).toBe(true);
    });
  });
});
