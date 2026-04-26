/**
 * Decay & Salience Tools E2E Tests
 *
 * Tests for run_decay_cycle, get_decayed_memories, forget_weak_memories,
 * reinforce_memory, and score_salience tools.
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
  testDir = await fs.mkdtemp(join(tmpdir(), 'decay-salience-tools-'));
  memoryPath = join(testDir, 'memory.jsonl');
  await fs.writeFile(memoryPath, '');
  manager = new KnowledgeGraphManager(memoryPath);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

async function seedGraph() {
  await handleToolCall('create_entities', {
    entities: [
      { name: 'Alice', entityType: 'person', observations: ['software engineer', 'works at Acme'] },
      { name: 'Bob', entityType: 'person', observations: ['product manager', 'works at Acme'] },
    ],
  }, manager);
}

const parseResponse = (result: { content: Array<{ type: string; text: string }> }) => {
  return JSON.parse(result.content[0].text);
};

describe('Decay & Salience Tools E2E', () => {
  // ==================== run_decay_cycle ====================
  describe('run_decay_cycle tool', () => {
    it('should run decay cycle with no args', async () => {
      const result = await handleToolCall('run_decay_cycle', {}, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should run decay cycle on empty graph', async () => {
      const result = await handleToolCall('run_decay_cycle', {}, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data).toBeDefined();
    });

    it('should run decay cycle on seeded graph', async () => {
      await seedGraph();
      const result = await handleToolCall('run_decay_cycle', {}, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== get_decayed_memories ====================
  describe('get_decayed_memories tool', () => {
    it('should return memories with no args', async () => {
      const result = await handleToolCall('get_decayed_memories', {}, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data).toHaveProperty('memories');
      expect(data).toHaveProperty('count');
    });

    it('should accept threshold parameter', async () => {
      await seedGraph();
      const result = await handleToolCall('get_decayed_memories', { threshold: 0.5 }, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(Array.isArray(data.memories)).toBe(true);
    });

    it('should return empty list on empty graph', async () => {
      const result = await handleToolCall('get_decayed_memories', { threshold: 0.9 }, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data.count).toBe(0);
    });
  });

  // ==================== forget_weak_memories ====================
  describe('forget_weak_memories tool', () => {
    it('should run with dryRun=true', async () => {
      await seedGraph();
      const result = await handleToolCall('forget_weak_memories', { dryRun: true }, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data).toBeDefined();
    });

    it('should accept threshold parameter', async () => {
      const result = await handleToolCall('forget_weak_memories', { threshold: 0.5 }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept maxCount parameter', async () => {
      await seedGraph();
      const result = await handleToolCall('forget_weak_memories', {
        threshold: 0.01,
        maxCount: 1,
        dryRun: true,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should run on empty graph without error', async () => {
      const result = await handleToolCall('forget_weak_memories', { dryRun: true }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== reinforce_memory ====================
  describe('reinforce_memory tool', () => {
    it('should reinforce a valid memory', async () => {
      await seedGraph();
      const result = await handleToolCall('reinforce_memory', { memoryName: 'Alice' }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('reinforced');
    });

    it('should accept confirmationBoost', async () => {
      await seedGraph();
      const result = await handleToolCall('reinforce_memory', {
        memoryName: 'Alice',
        confirmationBoost: 2,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept confidenceBoost', async () => {
      await seedGraph();
      const result = await handleToolCall('reinforce_memory', {
        memoryName: 'Bob',
        confidenceBoost: 0.3,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should require memoryName', async () => {
      const result = await handleToolCall('reinforce_memory', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject empty memoryName', async () => {
      const result = await handleToolCall('reinforce_memory', { memoryName: '' }, manager);
      expect(result.isError).toBe(true);
    });
  });

  // ==================== score_salience ====================
  describe('score_salience tool', () => {
    it('should score salience for an existing entity', async () => {
      await seedGraph();
      const result = await handleToolCall('score_salience', { entityName: 'Alice' }, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data).toBeDefined();
    });

    it('should accept optional queryText', async () => {
      await seedGraph();
      const result = await handleToolCall('score_salience', {
        entityName: 'Alice',
        queryText: 'software engineer',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept optional taskDescription', async () => {
      await seedGraph();
      const result = await handleToolCall('score_salience', {
        entityName: 'Bob',
        taskDescription: 'find product managers',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should error for missing entity', async () => {
      const result = await handleToolCall('score_salience', { entityName: 'NonExistent' }, manager);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('should require entityName', async () => {
      const result = await handleToolCall('score_salience', {}, manager);
      expect(result.isError).toBe(true);
    });
  });
});
