/**
 * Project Scope Tools E2E Tests (Phase 13 backport — v12.3.2)
 *
 * Tests set_project_scope and get_project_scope. The active scope is stored in a
 * WeakMap keyed on the ManagerContext, so each test's fresh manager starts with
 * no active scope.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ManagerContext as KnowledgeGraphManager } from '@danielsimonjr/memoryjs';
import { handleToolCall } from '../../../src/server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Project Scope Tools E2E', () => {
  let manager: KnowledgeGraphManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `scope-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new KnowledgeGraphManager(join(testDir, 'graph.jsonl'));
  });

  afterEach(async () => {
    try { await fs.rm(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  const parse = (r: { content: Array<{ type: string; text: string }> }) => JSON.parse(r.content[0].text);

  it('starts with no active scope', async () => {
    const result = parse(await handleToolCall('get_project_scope', {}, manager));
    expect(result.projectId).toBeNull();
  });

  it('set_project_scope stores the scope and get_project_scope reads it back', async () => {
    const setRes = parse(await handleToolCall('set_project_scope', {
      projectId: 'my-project',
    }, manager));
    expect(setRes.projectId).toBe('my-project');

    const getRes = parse(await handleToolCall('get_project_scope', {}, manager));
    expect(getRes.projectId).toBe('my-project');
  });

  it('empty string clears the active scope', async () => {
    await handleToolCall('set_project_scope', { projectId: 'temp' }, manager);
    const clearRes = parse(await handleToolCall('set_project_scope', {
      projectId: '',
    }, manager));
    expect(clearRes.projectId).toBeNull();

    const getRes = parse(await handleToolCall('get_project_scope', {}, manager));
    expect(getRes.projectId).toBeNull();
  });

  it('scope is per-ManagerContext — different managers do not share state', async () => {
    await handleToolCall('set_project_scope', { projectId: 'A' }, manager);

    const otherDir = join(tmpdir(), `scope-other-${Date.now()}-${Math.random()}`);
    await fs.mkdir(otherDir, { recursive: true });
    const other = new KnowledgeGraphManager(join(otherDir, 'graph.jsonl'));

    const otherRes = parse(await handleToolCall('get_project_scope', {}, other));
    expect(otherRes.projectId).toBeNull();

    await fs.rm(otherDir, { recursive: true, force: true });
  });

  it('rejects non-string projectId', async () => {
    const result = await handleToolCall('set_project_scope', {
      projectId: 42,
    }, manager);
    expect(result.isError).toBe(true);
  });

  it('rejects missing projectId', async () => {
    const result = await handleToolCall('set_project_scope', {}, manager);
    expect(result.isError).toBe(true);
  });
});
