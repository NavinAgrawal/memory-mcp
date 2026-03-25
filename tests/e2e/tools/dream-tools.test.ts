/**
 * Dream Engine Tools E2E Tests
 *
 * Tests for dream_start, dream_stop, and dream_run_now tools.
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
  testDir = await fs.mkdtemp(join(tmpdir(), 'dream-tools-'));
  memoryPath = join(testDir, 'memory.jsonl');
  await fs.writeFile(memoryPath, '');
  manager = new KnowledgeGraphManager(memoryPath);
});

afterEach(async () => {
  // Stop any running dream engine before cleanup
  try {
    await handleToolCall('dream_stop', {}, manager);
  } catch {
    // Ignore — engine may not be running
  }
  await fs.rm(testDir, { recursive: true, force: true });
});

async function seedGraph() {
  await handleToolCall('create_entities', {
    entities: [
      { name: 'Alice', entityType: 'person', observations: ['software engineer'] },
      { name: 'Bob', entityType: 'person', observations: ['product manager'] },
    ],
  }, manager);
}

describe('Dream Engine Tools E2E', () => {
  // ==================== dream_start ====================
  describe('dream_start tool', () => {
    it('should start the dream engine', async () => {
      const result = await handleToolCall('dream_start', {}, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('DreamEngine started');
    });

    it('should accept optional intervalMs parameter', async () => {
      const result = await handleToolCall('dream_start', {
        intervalMs: 60000,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject intervalMs below 1000ms', async () => {
      const result = await handleToolCall('dream_start', {
        intervalMs: 500,
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should accept optional runOnSessionEnd parameter', async () => {
      const result = await handleToolCall('dream_start', {
        runOnSessionEnd: false,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject non-boolean runOnSessionEnd', async () => {
      const result = await handleToolCall('dream_start', {
        runOnSessionEnd: 'yes',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should accept optional maxDurationMs parameter', async () => {
      const result = await handleToolCall('dream_start', {
        maxDurationMs: 30000,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept phases configuration object', async () => {
      const result = await handleToolCall('dream_start', {
        phases: {
          temporalAnchoring: true,
          freshnessSweep: false,
          entropyPruning: true,
          consolidation: false,
          compression: false,
          entityEnrichment: false,
          patternPromotion: false,
          graphHygiene: true,
        },
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept partial phases configuration', async () => {
      const result = await handleToolCall('dream_start', {
        phases: {
          graphHygiene: false,
        },
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should return text response', async () => {
      const result = await handleToolCall('dream_start', {}, manager);
      expect(result.content[0].type).toBe('text');
    });

    it('should return MCP-compliant content array', async () => {
      const result = await handleToolCall('dream_start', {}, manager);
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
    });
  });

  // ==================== dream_stop ====================
  describe('dream_stop tool', () => {
    it('should return message when no active engine', async () => {
      const result = await handleToolCall('dream_stop', {}, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text.length).toBeGreaterThan(0);
    });

    it('should stop after start', async () => {
      await handleToolCall('dream_start', {}, manager);
      const result = await handleToolCall('dream_stop', {}, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('stopped');
    });

    it('should accept no parameters', async () => {
      await handleToolCall('dream_start', {}, manager);
      const result = await handleToolCall('dream_stop', {}, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should return text response', async () => {
      const result = await handleToolCall('dream_stop', {}, manager);
      expect(result.content[0].type).toBe('text');
    });
  });

  // ==================== dream_run_now ====================
  describe('dream_run_now tool', () => {
    it('should run a dream cycle immediately', async () => {
      await seedGraph();
      const result = await handleToolCall('dream_run_now', {}, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should return cycle result JSON', async () => {
      await seedGraph();
      const result = await handleToolCall('dream_run_now', {}, manager);
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should include cycleId in result', async () => {
      await seedGraph();
      const result = await handleToolCall('dream_run_now', {}, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('cycleId');
    });

    it('should include phases array in result', async () => {
      await seedGraph();
      const result = await handleToolCall('dream_run_now', {}, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('phases');
      expect(Array.isArray(data.phases)).toBe(true);
    });

    it('should work on empty graph', async () => {
      const result = await handleToolCall('dream_run_now', {}, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept optional phases parameter', async () => {
      const result = await handleToolCall('dream_run_now', {
        phases: {
          graphHygiene: true,
          compression: false,
        },
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should return MCP-compliant content array', async () => {
      const result = await handleToolCall('dream_run_now', {}, manager);
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
    });

    it('should include timing information', async () => {
      const result = await handleToolCall('dream_run_now', {}, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('durationMs');
      expect(typeof data.durationMs).toBe('number');
    });

    it('should include startedAt and completedAt timestamps', async () => {
      const result = await handleToolCall('dream_run_now', {}, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('startedAt');
      expect(data).toHaveProperty('completedAt');
    });
  });
});
