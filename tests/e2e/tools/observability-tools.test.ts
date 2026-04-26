/**
 * Observability Tools E2E Tests
 *
 * Tests for visualize_graph, split_transcript, estimate_query_cost,
 * and get_context_profile tools.
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
  testDir = await fs.mkdtemp(join(tmpdir(), 'observability-tools-'));
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
  await handleToolCall('create_relations', {
    relations: [
      { from: 'Alice', to: 'Bob', relationType: 'works_with' },
    ],
  }, manager);
}

const parseResponse = (result: { content: Array<{ type: string; text: string }> }) => {
  return JSON.parse(result.content[0].text);
};

describe('Observability Tools E2E', () => {
  // ==================== visualize_graph ====================
  describe('visualize_graph tool', () => {
    it('should visualize empty graph', async () => {
      const result = await handleToolCall('visualize_graph', {}, manager);
      expect(result.isError).toBeUndefined();
      // Returns raw HTML
      expect(result.content[0].text).toContain('<');
    });

    it('should accept maxEntities parameter', async () => {
      await seedGraph();
      const result = await handleToolCall('visualize_graph', { maxEntities: 1 }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBeDefined();
    });

    it('should visualize seeded graph', async () => {
      await seedGraph();
      const result = await handleToolCall('visualize_graph', {}, manager);
      expect(result.isError).toBeUndefined();
      const html = result.content[0].text;
      expect(html).toContain('Alice');
    });

    it('should accept title parameter', async () => {
      const result = await handleToolCall('visualize_graph', { title: 'Test Graph' }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('Test Graph');
    });
  });

  // ==================== split_transcript ====================
  describe('split_transcript tool', () => {
    it('should split multi-session text with delimiter', async () => {
      const text = 'Session 1 content here.\n---\nSession 2 content here.\n---\nSession 3 content here.';
      const result = await handleToolCall('split_transcript', { text }, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data).toBeDefined();
    });

    it('should handle single session text', async () => {
      const text = 'This is a single session with no delimiters.';
      const result = await handleToolCall('split_transcript', { text }, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data).toBeDefined();
    });

    it('should require text parameter', async () => {
      const result = await handleToolCall('split_transcript', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject empty text', async () => {
      const result = await handleToolCall('split_transcript', { text: '' }, manager);
      expect(result.isError).toBe(true);
    });
  });

  // ==================== estimate_query_cost ====================
  describe('estimate_query_cost tool', () => {
    it('should estimate cost for a query string', async () => {
      const result = await handleToolCall('estimate_query_cost', { query: 'software engineer' }, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data).toHaveProperty('query');
      expect(data).toHaveProperty('estimates');
    });

    it('should return entityCount in response', async () => {
      await seedGraph();
      const result = await handleToolCall('estimate_query_cost', { query: 'Acme' }, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data).toHaveProperty('entityCount');
      expect(data.entityCount).toBeGreaterThan(0);
    });

    it('should work on empty graph', async () => {
      const result = await handleToolCall('estimate_query_cost', { query: 'anything' }, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data.entityCount).toBe(0);
    });

    it('should require query parameter', async () => {
      const result = await handleToolCall('estimate_query_cost', {}, manager);
      expect(result.isError).toBe(true);
    });
  });

  // ==================== get_context_profile ====================
  describe('get_context_profile tool', () => {
    it('should get a context profile by name', async () => {
      const result = await handleToolCall('get_context_profile', { name: 'default' }, manager);
      expect(result.isError).toBeUndefined();
      const data = parseResponse(result);
      expect(data).toBeDefined();
    });

    it('should handle non-existent profile name', async () => {
      const result = await handleToolCall('get_context_profile', { name: 'nonexistent-profile' }, manager);
      // May return null/undefined profile or error depending on implementation
      expect(result.content[0].text).toBeDefined();
    });

    it('should require name parameter', async () => {
      const result = await handleToolCall('get_context_profile', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject empty name', async () => {
      const result = await handleToolCall('get_context_profile', { name: '' }, manager);
      expect(result.isError).toBe(true);
    });
  });
});
