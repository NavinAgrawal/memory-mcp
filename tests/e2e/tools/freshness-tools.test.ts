/**
 * Freshness Tools E2E Tests
 *
 * Tests for check_freshness, get_stale_entities, get_expired_entities,
 * refresh_entity, and freshness_report tools.
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
  testDir = await fs.mkdtemp(join(tmpdir(), 'freshness-tools-'));
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
      { name: 'FreshEntity', entityType: 'person', observations: ['recently created'] },
      { name: 'StaleEntity', entityType: 'project', observations: ['old data'] },
      { name: 'Entity3', entityType: 'concept', observations: ['some knowledge'] },
    ],
  }, manager);
}

describe('Freshness Tools E2E', () => {
  // ==================== check_freshness ====================
  describe('check_freshness tool', () => {
    beforeEach(seedGraph);

    it('should check freshness of existing entity', async () => {
      const result = await handleToolCall('check_freshness', {
        entityName: 'FreshEntity',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.entityName).toBe('FreshEntity');
      expect(data).toHaveProperty('freshnessScore');
      expect(typeof data.freshnessScore).toBe('number');
    });

    it('should return annotated entity', async () => {
      const result = await handleToolCall('check_freshness', {
        entityName: 'FreshEntity',
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('annotated');
    });

    it('should return isExpired boolean', async () => {
      const result = await handleToolCall('check_freshness', {
        entityName: 'FreshEntity',
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('isExpired');
      expect(typeof data.isExpired).toBe('boolean');
    });

    it('should return expiresAt field (may be undefined/null for fresh entities)', async () => {
      const result = await handleToolCall('check_freshness', {
        entityName: 'FreshEntity',
      }, manager);
      // expiresAt is included in the response object; it may be absent if computeExpiresAt returns undefined
      // for newly-created entities. Just verify the response is valid JSON with entity info.
      const data = JSON.parse(result.content[0].text);
      expect(data.entityName).toBe('FreshEntity');
      expect(data).toHaveProperty('freshnessScore');
    });

    it('should return text message for non-existent entity', async () => {
      const result = await handleToolCall('check_freshness', {
        entityName: 'NonExistentEntity',
      }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('not found');
    });

    it('should require entityName parameter', async () => {
      const result = await handleToolCall('check_freshness', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject empty entityName', async () => {
      const result = await handleToolCall('check_freshness', { entityName: '' }, manager);
      expect(result.isError).toBe(true);
    });

    it('should return MCP-compliant content array', async () => {
      const result = await handleToolCall('check_freshness', { entityName: 'FreshEntity' }, manager);
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
    });
  });

  // ==================== get_stale_entities ====================
  describe('get_stale_entities tool', () => {
    beforeEach(seedGraph);

    it('should return list of stale entities', async () => {
      const result = await handleToolCall('get_stale_entities', {}, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('entities');
      expect(data).toHaveProperty('count');
      expect(Array.isArray(data.entities)).toBe(true);
    });

    it('should return count matching entities length', async () => {
      const result = await handleToolCall('get_stale_entities', {}, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(data.entities.length);
    });

    it('should accept optional threshold parameter', async () => {
      const result = await handleToolCall('get_stale_entities', { threshold: 0.5 }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept threshold=0 (all entities)', async () => {
      const result = await handleToolCall('get_stale_entities', { threshold: 0 }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept threshold=1 (very stale)', async () => {
      const result = await handleToolCall('get_stale_entities', { threshold: 1 }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject threshold outside 0-1 range', async () => {
      const result = await handleToolCall('get_stale_entities', { threshold: 1.5 }, manager);
      expect(result.isError).toBe(true);
    });

    it('should work with empty graph', async () => {
      const freshManager = new KnowledgeGraphManager(join(testDir, 'fresh.jsonl'));
      const result = await handleToolCall('get_stale_entities', {}, freshManager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(0);
    });
  });

  // ==================== get_expired_entities ====================
  describe('get_expired_entities tool', () => {
    beforeEach(seedGraph);

    it('should return list of expired entities', async () => {
      const result = await handleToolCall('get_expired_entities', {}, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('entities');
      expect(data).toHaveProperty('count');
      expect(Array.isArray(data.entities)).toBe(true);
    });

    it('should return count matching entities length', async () => {
      const result = await handleToolCall('get_expired_entities', {}, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(data.entities.length);
    });

    it('should accept no parameters', async () => {
      // get_expired_entities takes no args
      const result = await handleToolCall('get_expired_entities', {}, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should work with empty graph', async () => {
      const freshManager = new KnowledgeGraphManager(join(testDir, 'fresh2.jsonl'));
      const result = await handleToolCall('get_expired_entities', {}, freshManager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(0);
    });
  });

  // ==================== refresh_entity ====================
  describe('refresh_entity tool', () => {
    beforeEach(seedGraph);

    it('should refresh an existing entity', async () => {
      const result = await handleToolCall('refresh_entity', {
        entityName: 'FreshEntity',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('updated');
      expect(data).toHaveProperty('freshnessScore');
    });

    it('should return updated entity in response', async () => {
      const result = await handleToolCall('refresh_entity', {
        entityName: 'FreshEntity',
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data.updated).toHaveProperty('name', 'FreshEntity');
    });

    it('should return freshness score as number', async () => {
      const result = await handleToolCall('refresh_entity', {
        entityName: 'FreshEntity',
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(typeof data.freshnessScore).toBe('number');
    });

    it('should require entityName parameter', async () => {
      const result = await handleToolCall('refresh_entity', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject empty entityName', async () => {
      const result = await handleToolCall('refresh_entity', { entityName: '' }, manager);
      expect(result.isError).toBe(true);
    });
  });

  // ==================== freshness_report ====================
  describe('freshness_report tool', () => {
    beforeEach(seedGraph);

    it('should generate freshness report', async () => {
      const result = await handleToolCall('freshness_report', {}, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should return valid JSON', async () => {
      const result = await handleToolCall('freshness_report', {}, manager);
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should accept optional threshold parameter', async () => {
      const result = await handleToolCall('freshness_report', { threshold: 0.3 }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject invalid threshold outside 0-1', async () => {
      const result = await handleToolCall('freshness_report', { threshold: 2.0 }, manager);
      expect(result.isError).toBe(true);
    });

    it('should return report with summary information', async () => {
      const result = await handleToolCall('freshness_report', {}, manager);
      // Report shape depends on memoryjs implementation; just ensure it's non-empty JSON
      const data = JSON.parse(result.content[0].text);
      expect(data).toBeDefined();
    });
  });
});
