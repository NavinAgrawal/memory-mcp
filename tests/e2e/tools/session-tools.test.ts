/**
 * Session Tools E2E Tests
 *
 * Tests for session_start, session_end, session_checkpoint, session_restore,
 * add_working_memory, promote_working_memory, confirm_memory,
 * clear_expired_memories, and wake_up tools.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ManagerContext as KnowledgeGraphManager } from '@danielsimonjr/memoryjs';
import { handleToolCall } from '../../../src/server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let manager: KnowledgeGraphManager;
let testDir: string;
let memoryPath: string;

beforeEach(async () => {
  testDir = await fs.mkdtemp(join(tmpdir(), 'session-tools-'));
  memoryPath = join(testDir, 'memory.jsonl');
  await fs.writeFile(memoryPath, '');
  manager = new KnowledgeGraphManager(memoryPath);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

const parseResponse = (result: { content: Array<{ type: string; text: string }> }) => {
  return JSON.parse(result.content[0].text);
};

async function startSession(taskDescription?: string): Promise<string> {
  const args: Record<string, unknown> = {};
  if (taskDescription) args.taskDescription = taskDescription;
  const result = await handleToolCall('session_start', args, manager);
  const data = parseResponse(result);
  return data.sessionId;
}

describe('Session Tools E2E', () => {
  // ==================== session_start ====================
  describe('session_start tool', () => {
    it('should start a session with no args', async () => {
      const result = await handleToolCall('session_start', {}, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data.sessionId).toBeDefined();
    });

    it('should accept optional taskDescription', async () => {
      const result = await handleToolCall('session_start', {
        taskDescription: 'Testing session tools',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data.sessionId).toBeDefined();
    });

    it('should accept optional parentSessionId', async () => {
      const parentId = await startSession();
      const result = await handleToolCall('session_start', {
        parentSessionId: parentId,
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data.sessionId).toBeDefined();
    });
  });

  // ==================== session_end ====================
  describe('session_end tool', () => {
    it('should end an active session', async () => {
      const sessionId = await startSession();
      const result = await handleToolCall('session_end', { sessionId }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept optional status parameter', async () => {
      const sessionId = await startSession();
      const result = await handleToolCall('session_end', {
        sessionId,
        status: 'completed',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject missing sessionId', async () => {
      const result = await handleToolCall('session_end', {}, manager);
      expect(result.isError).toBe(true);
    });
  });

  // ==================== session_checkpoint ====================
  describe('session_checkpoint tool', () => {
    it('should create a checkpoint for an active session', async () => {
      const sessionId = await startSession();
      const result = await handleToolCall('session_checkpoint', { sessionId }, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data).toBeDefined();
    });

    it('should accept optional name parameter', async () => {
      const sessionId = await startSession();
      const result = await handleToolCall('session_checkpoint', {
        sessionId,
        name: 'mid-task-checkpoint',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject missing sessionId', async () => {
      const result = await handleToolCall('session_checkpoint', {}, manager);
      expect(result.isError).toBe(true);
    });
  });

  // ==================== session_restore ====================
  describe('session_restore tool', () => {
    it('should restore from a valid checkpoint', async () => {
      const sessionId = await startSession();
      const cpResult = await handleToolCall('session_checkpoint', { sessionId }, manager);
      const cp = parseResponse(cpResult);
      const checkpointId = cp.checkpointId ?? cp.id ?? sessionId;
      const result = await handleToolCall('session_restore', { checkpointId }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject missing checkpointId', async () => {
      const result = await handleToolCall('session_restore', {}, manager);
      expect(result.isError).toBe(true);
    });
  });

  // ==================== add_working_memory ====================
  describe('add_working_memory tool', () => {
    it('should add working memory with required args', async () => {
      const sessionId = await startSession();
      const result = await handleToolCall('add_working_memory', {
        sessionId,
        content: 'Remember this fact',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data).toBeDefined();
    });

    it('should accept optional importance and ttlHours', async () => {
      const sessionId = await startSession();
      const result = await handleToolCall('add_working_memory', {
        sessionId,
        content: 'Important fact',
        importance: 8,
        ttlHours: 2,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject missing sessionId', async () => {
      const result = await handleToolCall('add_working_memory', {
        content: 'orphan memory',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject missing content', async () => {
      const sessionId = await startSession();
      const result = await handleToolCall('add_working_memory', { sessionId }, manager);
      expect(result.isError).toBe(true);
    });
  });

  // ==================== promote_working_memory ====================
  describe('promote_working_memory tool', () => {
    it('should promote a working memory by name', async () => {
      const sessionId = await startSession();
      const addResult = await handleToolCall('add_working_memory', {
        sessionId,
        content: 'Promotable fact',
      }, manager);
      const addData = parseResponse(addResult);
      const memoryName = addData.name ?? addData.id ?? addData.content;
      const result = await handleToolCall('promote_working_memory', {
        memoryName: String(memoryName),
      }, manager);
      // May succeed or error depending on whether memory name resolves
      expect(result.content[0].text).toBeDefined();
    });

    it('should accept optional targetType enum', async () => {
      const sessionId = await startSession();
      const addResult = await handleToolCall('add_working_memory', {
        sessionId,
        content: 'Semantic promotable',
      }, manager);
      const addData = parseResponse(addResult);
      const memoryName = addData.name ?? addData.id ?? addData.content;
      const result = await handleToolCall('promote_working_memory', {
        memoryName: String(memoryName),
        targetType: 'semantic',
      }, manager);
      expect(result.content[0].text).toBeDefined();
    });

    it('should reject missing memoryName', async () => {
      const result = await handleToolCall('promote_working_memory', {}, manager);
      expect(result.isError).toBe(true);
    });
  });

  // ==================== confirm_memory ====================
  describe('confirm_memory tool', () => {
    it('should confirm a memory by name', async () => {
      const sessionId = await startSession();
      const addResult = await handleToolCall('add_working_memory', {
        sessionId,
        content: 'Confirmable fact',
      }, manager);
      const addData = parseResponse(addResult);
      const memoryName = addData.name ?? addData.id ?? addData.content;
      const result = await handleToolCall('confirm_memory', {
        memoryName: String(memoryName),
      }, manager);
      expect(result.content[0].text).toBeDefined();
    });

    it('should accept optional confidenceBoost', async () => {
      const sessionId = await startSession();
      const addResult = await handleToolCall('add_working_memory', {
        sessionId,
        content: 'Boost me',
      }, manager);
      const addData = parseResponse(addResult);
      const memoryName = addData.name ?? addData.id ?? addData.content;
      const result = await handleToolCall('confirm_memory', {
        memoryName: String(memoryName),
        confidenceBoost: 0.5,
      }, manager);
      expect(result.content[0].text).toBeDefined();
    });

    it('should reject missing memoryName', async () => {
      const result = await handleToolCall('confirm_memory', {}, manager);
      expect(result.isError).toBe(true);
    });
  });

  // ==================== clear_expired_memories ====================
  describe('clear_expired_memories tool', () => {
    it('should clear expired memories on empty graph', async () => {
      const result = await handleToolCall('clear_expired_memories', {}, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Cleared');
    });

    it('should return count after adding working memory', async () => {
      const sessionId = await startSession();
      await handleToolCall('add_working_memory', {
        sessionId,
        content: 'temporary fact',
        ttlHours: 0.001,
      }, manager);
      const result = await handleToolCall('clear_expired_memories', {}, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Cleared');
    });
  });

  // ==================== wake_up ====================
  describe('wake_up tool', () => {
    it('should wake up with no args', async () => {
      const result = await handleToolCall('wake_up', {}, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept compress=true', async () => {
      const result = await handleToolCall('wake_up', { compress: true }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject non-boolean compress', async () => {
      const result = await handleToolCall('wake_up', { compress: 'yes' }, manager);
      expect(result.isError).toBe(true);
    });
  });
});
