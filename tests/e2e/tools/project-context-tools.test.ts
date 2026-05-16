/**
 * Project Context Tools E2E Tests (Phase 16)
 *
 * Tests upsert_project_context, get_project_context, the four append_project_*
 * tools, the four remove_project_* tools, clear_project_context, and
 * format_project_context_for_llm.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ManagerContext as KnowledgeGraphManager } from '@danielsimonjr/memoryjs';
import { handleToolCall } from '../../../src/server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Project Context Tools E2E', () => {
  let manager: KnowledgeGraphManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `projctx-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new KnowledgeGraphManager(join(testDir, 'graph.jsonl'));
  });

  afterEach(async () => {
    try { await fs.rm(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  const parse = (r: { content: Array<{ type: string; text: string }> }) => JSON.parse(r.content[0].text);

  describe('upsert_project_context', () => {
    it('creates a project context with all fields', async () => {
      const result = parse(await handleToolCall('upsert_project_context', {
        projectId: 'memory-mcp',
        facts: ['MCP server'],
        conventions: ['Co-Authored-By footer'],
        commands: [{ name: 'test', command: 'npm test', purpose: 'run tests' }],
        glossary: [{ term: 'MCP', definition: 'Model Context Protocol' }],
      }, manager));
      expect(result.record).toBeDefined();
    });

    it('creates with projectId only', async () => {
      const result = parse(await handleToolCall('upsert_project_context', {
        projectId: 'empty',
      }, manager));
      expect(result.record).toBeDefined();
    });

    it('rejects empty projectId', async () => {
      const result = await handleToolCall('upsert_project_context', { projectId: '' }, manager);
      expect(result.isError).toBe(true);
    });
  });

  describe('get_project_context', () => {
    it('returns null for unknown projectId', async () => {
      const result = parse(await handleToolCall('get_project_context', {
        projectId: 'unknown',
      }, manager));
      expect(result.record).toBeNull();
    });

    it('returns record after upsert', async () => {
      await handleToolCall('upsert_project_context', {
        projectId: 'p', facts: ['fact-a'],
      }, manager);
      const result = parse(await handleToolCall('get_project_context', { projectId: 'p' }, manager));
      expect(result.record).not.toBeNull();
    });
  });

  describe('append_project_* tools', () => {
    beforeEach(async () => {
      await handleToolCall('upsert_project_context', { projectId: 'p' }, manager);
    });

    it('appends a fact', async () => {
      const result = parse(await handleToolCall('append_project_fact', {
        projectId: 'p', fact: 'new fact',
      }, manager));
      expect(result.record).toBeDefined();
    });

    it('appends a convention', async () => {
      const result = parse(await handleToolCall('append_project_convention', {
        projectId: 'p', convention: 'a convention',
      }, manager));
      expect(result.record).toBeDefined();
    });

    it('appends a command', async () => {
      const result = parse(await handleToolCall('append_project_command', {
        projectId: 'p', name: 'build', command: 'npm run build', purpose: 'compile',
      }, manager));
      expect(result.record).toBeDefined();
    });

    it('appends a glossary term', async () => {
      const result = parse(await handleToolCall('append_project_glossary_term', {
        projectId: 'p', term: 'KG', definition: 'Knowledge Graph',
      }, manager));
      expect(result.record).toBeDefined();
    });

    it('rejects missing required fields', async () => {
      const result = await handleToolCall('append_project_command', {
        projectId: 'p', name: 'build',
      }, manager);
      expect(result.isError).toBe(true);
    });
  });

  describe('remove_project_* tools', () => {
    beforeEach(async () => {
      await handleToolCall('upsert_project_context', {
        projectId: 'p',
        facts: ['f1'],
        conventions: ['c1'],
        commands: [{ name: 'cmd1', command: 'echo', purpose: 'noop' }],
        glossary: [{ term: 't1', definition: 'd1' }],
      }, manager);
    });

    it('removes a fact', async () => {
      const result = parse(await handleToolCall('remove_project_fact', {
        projectId: 'p', fact: 'f1',
      }, manager));
      expect(typeof result.removed).toBe('boolean');
    });

    it('removes a convention', async () => {
      const result = parse(await handleToolCall('remove_project_convention', {
        projectId: 'p', convention: 'c1',
      }, manager));
      expect(typeof result.removed).toBe('boolean');
    });

    it('removes a command by name', async () => {
      const result = parse(await handleToolCall('remove_project_command', {
        projectId: 'p', commandName: 'cmd1',
      }, manager));
      expect(typeof result.removed).toBe('boolean');
    });

    it('removes a glossary term', async () => {
      const result = parse(await handleToolCall('remove_project_glossary_term', {
        projectId: 'p', term: 't1',
      }, manager));
      expect(typeof result.removed).toBe('boolean');
    });
  });

  describe('clear_project_context', () => {
    it('clears an existing project context', async () => {
      await handleToolCall('upsert_project_context', { projectId: 'p', facts: ['x'] }, manager);
      const result = parse(await handleToolCall('clear_project_context', { projectId: 'p' }, manager));
      expect(typeof result.cleared).toBe('boolean');
    });
  });

  describe('format_project_context_for_llm', () => {
    it('returns prose text for an existing context', async () => {
      await handleToolCall('upsert_project_context', {
        projectId: 'p', facts: ['demo fact'],
      }, manager);
      const result = await handleToolCall('format_project_context_for_llm', {
        projectId: 'p', budgetChars: 500,
      }, manager);
      expect(typeof result.content[0].text).toBe('string');
    });

    it('rejects non-positive budgetChars', async () => {
      const result = await handleToolCall('format_project_context_for_llm', {
        projectId: 'p', budgetChars: 0,
      }, manager);
      expect(result.isError).toBe(true);
    });
  });
});
