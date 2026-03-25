/**
 * Temporal Search Tools E2E Tests
 *
 * Tests for search_by_time tool.
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
  testDir = await fs.mkdtemp(join(tmpdir(), 'temporal-search-tools-'));
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
      { name: 'Alice', entityType: 'person', observations: ['software engineer', 'created in 2024'] },
      { name: 'Bob', entityType: 'person', observations: ['product manager', 'updated recently'] },
      { name: 'ProjectX', entityType: 'project', observations: ['internal tool', 'last modified today'] },
    ],
  }, manager);
}

describe('Temporal Search Tools E2E', () => {
  describe('search_by_time tool', () => {
    describe('Required Parameters', () => {
      it('should require query parameter', async () => {
        const result = await handleToolCall('search_by_time', {}, manager);
        expect(result.isError).toBe(true);
      });

      it('should reject empty query string', async () => {
        const result = await handleToolCall('search_by_time', { query: '' }, manager);
        expect(result.isError).toBe(true);
      });
    });

    describe('Basic Functionality', () => {
      beforeEach(seedGraph);

      it('should search by time with a query string', async () => {
        const result = await handleToolCall('search_by_time', {
          query: 'today',
        }, manager);
        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveProperty('query', 'today');
        expect(data).toHaveProperty('entities');
        expect(data).toHaveProperty('count');
      });

      it('should return entities array in response', async () => {
        const result = await handleToolCall('search_by_time', {
          query: 'last week',
        }, manager);
        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0].text);
        expect(Array.isArray(data.entities)).toBe(true);
      });

      it('should return count matching entities length', async () => {
        const result = await handleToolCall('search_by_time', {
          query: 'recently',
        }, manager);
        const data = JSON.parse(result.content[0].text);
        expect(data.count).toBe(data.entities.length);
      });

      it('should echo query in response', async () => {
        const result = await handleToolCall('search_by_time', {
          query: 'last 7 days',
        }, manager);
        const data = JSON.parse(result.content[0].text);
        expect(data.query).toBe('last 7 days');
      });
    });

    describe('Optional field parameter', () => {
      beforeEach(seedGraph);

      it('should accept field=createdAt', async () => {
        const result = await handleToolCall('search_by_time', {
          query: 'today',
          field: 'createdAt',
        }, manager);
        expect(result.isError).toBeUndefined();
      });

      it('should accept field=lastModified', async () => {
        const result = await handleToolCall('search_by_time', {
          query: 'today',
          field: 'lastModified',
        }, manager);
        expect(result.isError).toBeUndefined();
      });

      it('should accept field=any', async () => {
        const result = await handleToolCall('search_by_time', {
          query: 'today',
          field: 'any',
        }, manager);
        expect(result.isError).toBeUndefined();
      });

      it('should reject invalid field value', async () => {
        const result = await handleToolCall('search_by_time', {
          query: 'today',
          field: 'invalid_field',
        }, manager);
        expect(result.isError).toBe(true);
      });
    });

    describe('Optional includeUndated parameter', () => {
      beforeEach(seedGraph);

      it('should accept includeUndated=true', async () => {
        const result = await handleToolCall('search_by_time', {
          query: 'recent',
          includeUndated: true,
        }, manager);
        expect(result.isError).toBeUndefined();
      });

      it('should accept includeUndated=false', async () => {
        const result = await handleToolCall('search_by_time', {
          query: 'recent',
          includeUndated: false,
        }, manager);
        expect(result.isError).toBeUndefined();
      });
    });

    describe('Response Format', () => {
      it('should return MCP-compliant content array', async () => {
        const result = await handleToolCall('search_by_time', { query: 'today' }, manager);
        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0]).toHaveProperty('text');
      });

      it('should return valid JSON', async () => {
        const result = await handleToolCall('search_by_time', { query: 'today' }, manager);
        expect(() => JSON.parse(result.content[0].text)).not.toThrow();
      });
    });

    describe('Empty graph', () => {
      it('should return empty entities for empty graph', async () => {
        const result = await handleToolCall('search_by_time', { query: 'today' }, manager);
        expect(result.isError).toBeUndefined();
        const data = JSON.parse(result.content[0].text);
        expect(data.count).toBe(0);
        expect(data.entities).toEqual([]);
      });
    });
  });
});
