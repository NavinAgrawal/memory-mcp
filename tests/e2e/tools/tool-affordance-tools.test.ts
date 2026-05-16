/**
 * Tool Affordance + Observer Tools E2E Tests (Phase 16)
 *
 * Tests record_tool_outcome, get_tool_affordance_stats, suggest_tool,
 * list_tool_affordances, remove_tool_affordance, and the 5 observe_tool_*
 * lifecycle tools plus tool_observer_in_flight_count.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ManagerContext as KnowledgeGraphManager } from '@danielsimonjr/memoryjs';
import { handleToolCall } from '../../../src/server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Tool Affordance + Observer Tools E2E', () => {
  let manager: KnowledgeGraphManager;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `affordance-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    manager = new KnowledgeGraphManager(join(testDir, 'graph.jsonl'));
  });

  afterEach(async () => {
    try { await fs.rm(testDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  const parse = (r: { content: Array<{ type: string; text: string }> }) => JSON.parse(r.content[0].text);

  describe('record_tool_outcome', () => {
    it('records a success outcome', async () => {
      const result = await handleToolCall('record_tool_outcome', {
        toolName: 'my_tool', outcome: 'success', durationMs: 12,
      }, manager);
      const data = parse(result);
      expect(data.record).toBeDefined();
    });

    it('records a failure outcome with error message', async () => {
      const result = await handleToolCall('record_tool_outcome', {
        toolName: 'my_tool', outcome: 'failure', errorMessage: 'boom',
      }, manager);
      const data = parse(result);
      expect(data.record).toBeDefined();
    });

    it('rejects unknown outcome', async () => {
      const result = await handleToolCall('record_tool_outcome', {
        toolName: 'my_tool', outcome: 'maybe',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('rejects empty toolName', async () => {
      const result = await handleToolCall('record_tool_outcome', {
        toolName: '', outcome: 'success',
      }, manager);
      expect(result.isError).toBe(true);
    });
  });

  describe('get_tool_affordance_stats', () => {
    it('returns null stats for an unseen tool', async () => {
      const result = await handleToolCall('get_tool_affordance_stats', { toolName: 'unseen' }, manager);
      const data = parse(result);
      expect(data.toolName).toBe('unseen');
      expect(data.stats).toBeNull();
    });

    it('returns stats after recording outcomes', async () => {
      await handleToolCall('record_tool_outcome', { toolName: 'A', outcome: 'success' }, manager);
      await handleToolCall('record_tool_outcome', { toolName: 'A', outcome: 'failure', errorMessage: 'x' }, manager);
      const result = await handleToolCall('get_tool_affordance_stats', { toolName: 'A' }, manager);
      const data = parse(result);
      expect(data.stats).not.toBeNull();
    });
  });

  describe('list_tool_affordances', () => {
    it('returns the recorded affordances', async () => {
      await handleToolCall('record_tool_outcome', { toolName: 'A', outcome: 'success' }, manager);
      await handleToolCall('record_tool_outcome', { toolName: 'B', outcome: 'success' }, manager);
      const result = await handleToolCall('list_tool_affordances', {}, manager);
      const data = parse(result);
      expect(typeof data.count).toBe('number');
      expect(Array.isArray(data.records)).toBe(true);
    });
  });

  describe('suggest_tool', () => {
    it('returns suggestions for a task hint', async () => {
      await handleToolCall('record_tool_outcome', { toolName: 'searcher', outcome: 'success' }, manager);
      const result = await handleToolCall('suggest_tool', { taskHint: 'search', limit: 5 }, manager);
      const data = parse(result);
      expect(data.taskHint).toBe('search');
      expect(Array.isArray(data.suggestions)).toBe(true);
    });

    it('rejects empty taskHint', async () => {
      const result = await handleToolCall('suggest_tool', { taskHint: '' }, manager);
      expect(result.isError).toBe(true);
    });
  });

  describe('remove_tool_affordance', () => {
    it('removes a recorded affordance', async () => {
      await handleToolCall('record_tool_outcome', { toolName: 'gone', outcome: 'success' }, manager);
      const result = await handleToolCall('remove_tool_affordance', { toolName: 'gone' }, manager);
      const data = parse(result);
      expect(typeof data.removed).toBe('boolean');
    });
  });

  describe('observe_tool_* lifecycle', () => {
    it('start → complete records a call', async () => {
      const startRes = parse(await handleToolCall('observe_tool_start', {
        toolName: 'workflow', args: { foo: 'bar' },
      }, manager));
      expect(startRes.callId).toBeDefined();

      const completeRes = parse(await handleToolCall('observe_tool_complete', {
        callId: startRes.callId, result: 'ok',
      }, manager));
      expect(completeRes.recorded).toBe('success');
    });

    it('start → error records a failure', async () => {
      const startRes = parse(await handleToolCall('observe_tool_start', { toolName: 't' }, manager));
      const errRes = parse(await handleToolCall('observe_tool_error', {
        callId: startRes.callId, errorMessage: 'kaboom',
      }, manager));
      expect(errRes.recorded).toBe('failure');
    });

    it('start → partial records a partial outcome', async () => {
      const startRes = parse(await handleToolCall('observe_tool_start', { toolName: 't' }, manager));
      const partial = parse(await handleToolCall('observe_tool_partial', {
        callId: startRes.callId, reason: 'truncated',
      }, manager));
      expect(partial.recorded).toBe('partial');
    });

    it('start → cancel records a cancellation', async () => {
      const startRes = parse(await handleToolCall('observe_tool_start', { toolName: 't' }, manager));
      const cancel = parse(await handleToolCall('observe_tool_cancel', {
        callId: startRes.callId,
      }, manager));
      expect(cancel.cancelled).toBe(true);
    });

    it('rejects non-object args on start', async () => {
      const result = await handleToolCall('observe_tool_start', {
        toolName: 'x', args: 'not-an-object',
      }, manager);
      expect(result.isError).toBe(true);
    });
  });

  describe('tool_observer_in_flight_count', () => {
    it('returns inFlightCount as a number', async () => {
      const result = await handleToolCall('tool_observer_in_flight_count', {}, manager);
      const data = parse(result);
      expect(typeof data.inFlightCount).toBe('number');
    });
  });
});
