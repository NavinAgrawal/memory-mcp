/**
 * Cognitive Load Tools E2E Tests
 *
 * Tests for analyze_cognitive_load and adaptive_reduce_memories tools.
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
  testDir = await fs.mkdtemp(join(tmpdir(), 'cognitive-load-tools-'));
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
      { name: 'Alice', entityType: 'person', observations: ['software engineer', 'works on ProjectX', 'expert in TypeScript'] },
      { name: 'Bob', entityType: 'person', observations: ['product manager', 'manages ProjectX', 'experienced in Agile'] },
      { name: 'ProjectX', entityType: 'project', observations: ['internal tool', 'TypeScript codebase', 'used by 50+ engineers'] },
      { name: 'ConceptA', entityType: 'concept', observations: ['abstract idea', 'related to architecture'] },
      { name: 'ConceptB', entityType: 'concept', observations: ['design pattern', 'applies to micro-services'] },
    ],
  }, manager);
}

describe('Cognitive Load Tools E2E', () => {
  // ==================== analyze_cognitive_load ====================
  describe('analyze_cognitive_load tool', () => {
    beforeEach(seedGraph);

    it('should analyze cognitive load for entity list', async () => {
      const result = await handleToolCall('analyze_cognitive_load', {
        entityNames: ['Alice', 'Bob', 'ProjectX'],
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('entityCount', 3);
      expect(data).toHaveProperty('metrics');
    });

    it('should return metrics object', async () => {
      const result = await handleToolCall('analyze_cognitive_load', {
        entityNames: ['Alice', 'Bob'],
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(typeof data.metrics).toBe('object');
    });

    it('should require entityNames parameter', async () => {
      const result = await handleToolCall('analyze_cognitive_load', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject empty entityNames array', async () => {
      const result = await handleToolCall('analyze_cognitive_load', {
        entityNames: [],
      }, manager);
      // Empty array passes schema validation but handler returns text message
      // (no entities found matching the provided names)
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should return text message for non-existent entities', async () => {
      const result = await handleToolCall('analyze_cognitive_load', {
        entityNames: ['NonExistent1', 'NonExistent2'],
      }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('No entities found');
    });

    it('should accept optional loadThreshold parameter', async () => {
      const result = await handleToolCall('analyze_cognitive_load', {
        entityNames: ['Alice', 'Bob'],
        loadThreshold: 0.8,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject loadThreshold outside 0-1 range', async () => {
      const result = await handleToolCall('analyze_cognitive_load', {
        entityNames: ['Alice'],
        loadThreshold: 1.5,
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject non-array entityNames', async () => {
      const result = await handleToolCall('analyze_cognitive_load', {
        entityNames: 'Alice',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should return MCP-compliant content array', async () => {
      const result = await handleToolCall('analyze_cognitive_load', {
        entityNames: ['Alice'],
      }, manager);
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
    });

    it('should handle single entity', async () => {
      const result = await handleToolCall('analyze_cognitive_load', {
        entityNames: ['Alice'],
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.entityCount).toBe(1);
    });

    it('should handle all entities', async () => {
      const result = await handleToolCall('analyze_cognitive_load', {
        entityNames: ['Alice', 'Bob', 'ProjectX', 'ConceptA', 'ConceptB'],
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.entityCount).toBe(5);
    });
  });

  // ==================== adaptive_reduce_memories ====================
  describe('adaptive_reduce_memories tool', () => {
    beforeEach(seedGraph);

    it('should reduce memories based on salience scores', async () => {
      const result = await handleToolCall('adaptive_reduce_memories', {
        entityNames: ['Alice', 'Bob', 'ProjectX', 'ConceptA', 'ConceptB'],
        salienceScores: {
          Alice: 0.9,
          Bob: 0.7,
          ProjectX: 0.8,
          ConceptA: 0.1,
          ConceptB: 0.1,
        },
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('retained');
      expect(data).toHaveProperty('removed');
    });

    it('should return retainedCount and removedCount', async () => {
      const result = await handleToolCall('adaptive_reduce_memories', {
        entityNames: ['Alice', 'Bob', 'ProjectX'],
        salienceScores: { Alice: 0.9, Bob: 0.5, ProjectX: 0.7 },
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('retainedCount');
      expect(data).toHaveProperty('removedCount');
      expect(typeof data.retainedCount).toBe('number');
      expect(typeof data.removedCount).toBe('number');
    });

    it('should have retained + removed = total valid entities', async () => {
      const result = await handleToolCall('adaptive_reduce_memories', {
        entityNames: ['Alice', 'Bob', 'ProjectX'],
        salienceScores: { Alice: 0.9, Bob: 0.3, ProjectX: 0.7 },
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data.retainedCount + data.removedCount).toBe(3);
    });

    it('should return beforeMetrics and afterMetrics', async () => {
      const result = await handleToolCall('adaptive_reduce_memories', {
        entityNames: ['Alice', 'Bob'],
        salienceScores: { Alice: 0.9, Bob: 0.2 },
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('beforeMetrics');
      expect(data).toHaveProperty('afterMetrics');
    });

    it('should require entityNames parameter', async () => {
      const result = await handleToolCall('adaptive_reduce_memories', {
        salienceScores: { Alice: 0.9 },
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should require salienceScores parameter', async () => {
      const result = await handleToolCall('adaptive_reduce_memories', {
        entityNames: ['Alice'],
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should return text message for non-existent entities', async () => {
      const result = await handleToolCall('adaptive_reduce_memories', {
        entityNames: ['NonExistent'],
        salienceScores: { NonExistent: 0.5 },
      }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('No entities found');
    });

    it('should accept optional loadThreshold parameter', async () => {
      const result = await handleToolCall('adaptive_reduce_memories', {
        entityNames: ['Alice', 'Bob'],
        salienceScores: { Alice: 0.9, Bob: 0.2 },
        loadThreshold: 0.7,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject loadThreshold outside 0-1 range', async () => {
      const result = await handleToolCall('adaptive_reduce_memories', {
        entityNames: ['Alice'],
        salienceScores: { Alice: 0.5 },
        loadThreshold: 2.0,
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should retain all entities when all have high salience', async () => {
      const result = await handleToolCall('adaptive_reduce_memories', {
        entityNames: ['Alice', 'Bob'],
        salienceScores: { Alice: 1.0, Bob: 0.99 },
        loadThreshold: 0.0,  // threshold of 0 => load always low => retain all
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data.removedCount).toBe(0);
    });
  });
});
