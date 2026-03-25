/**
 * Entropy Filter Tools E2E Tests
 *
 * Tests for enable_entropy_filter and compute_entropy tools.
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
  testDir = await fs.mkdtemp(join(tmpdir(), 'entropy-tools-'));
  memoryPath = join(testDir, 'memory.jsonl');
  await fs.writeFile(memoryPath, '');
  manager = new KnowledgeGraphManager(memoryPath);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

describe('Entropy Filter Tools E2E', () => {
  // ==================== enable_entropy_filter ====================
  describe('enable_entropy_filter tool', () => {
    it('should enable entropy filter', async () => {
      const result = await handleToolCall('enable_entropy_filter', {
        enabled: true,
      }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('enabled');
    });

    it('should disable entropy filter', async () => {
      const result = await handleToolCall('enable_entropy_filter', {
        enabled: false,
      }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('disabled');
    });

    it('should require enabled parameter', async () => {
      const result = await handleToolCall('enable_entropy_filter', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject non-boolean enabled', async () => {
      const result = await handleToolCall('enable_entropy_filter', { enabled: 'yes' }, manager);
      expect(result.isError).toBe(true);
    });

    it('should accept optional minEntropy parameter', async () => {
      const result = await handleToolCall('enable_entropy_filter', {
        enabled: true,
        minEntropy: 2.0,
      }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('2');
    });

    it('should accept optional minLength parameter', async () => {
      const result = await handleToolCall('enable_entropy_filter', {
        enabled: true,
        minLength: 20,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject negative minEntropy', async () => {
      const result = await handleToolCall('enable_entropy_filter', {
        enabled: true,
        minEntropy: -1,
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject negative minLength', async () => {
      const result = await handleToolCall('enable_entropy_filter', {
        enabled: true,
        minLength: -5,
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should include minEntropy in success message when enabling', async () => {
      const result = await handleToolCall('enable_entropy_filter', {
        enabled: true,
        minEntropy: 1.5,
        minLength: 10,
      }, manager);
      expect(result.content[0].text).toContain('1.5');
    });

    it('should return text response', async () => {
      const result = await handleToolCall('enable_entropy_filter', { enabled: true }, manager);
      expect(result.content[0].type).toBe('text');
    });
  });

  // ==================== compute_entropy ====================
  describe('compute_entropy tool', () => {
    it('should compute entropy for a text string', async () => {
      const result = await handleToolCall('compute_entropy', {
        text: 'Hello, World! This is a test string with varied characters.',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('entropy');
      expect(typeof data.entropy).toBe('number');
    });

    it('should return entropy >= 0', async () => {
      const result = await handleToolCall('compute_entropy', {
        text: 'test text',
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data.entropy).toBeGreaterThanOrEqual(0);
    });

    it('should return higher entropy for more varied text', async () => {
      const highEntropyResult = await handleToolCall('compute_entropy', {
        text: 'abcdefghijklmnopqrstuvwxyz0123456789!@#$%',
      }, manager);
      const lowEntropyResult = await handleToolCall('compute_entropy', {
        text: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }, manager);

      const highData = JSON.parse(highEntropyResult.content[0].text);
      const lowData = JSON.parse(lowEntropyResult.content[0].text);
      expect(highData.entropy).toBeGreaterThan(lowData.entropy);
    });

    it('should return near-zero entropy for uniform text', async () => {
      const result = await handleToolCall('compute_entropy', {
        text: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data.entropy).toBeLessThan(0.5);
    });

    it('should require text parameter', async () => {
      const result = await handleToolCall('compute_entropy', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should accept empty string (returns 0 entropy)', async () => {
      const result = await handleToolCall('compute_entropy', { text: '' }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.entropy).toBe(0);
    });

    it('should include passes field when minEntropy is provided', async () => {
      const result = await handleToolCall('compute_entropy', {
        text: 'Hello World this is test text',
        minEntropy: 1.5,
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('passes');
      expect(typeof data.passes).toBe('boolean');
    });

    it('should not include passes field without minEntropy', async () => {
      const result = await handleToolCall('compute_entropy', {
        text: 'some text here',
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data).not.toHaveProperty('passes');
    });

    it('should report passes=true when entropy exceeds minEntropy', async () => {
      // High entropy text
      const result = await handleToolCall('compute_entropy', {
        text: 'The quick brown fox jumps over the lazy dog',
        minEntropy: 0.1,
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data.passes).toBe(true);
    });

    it('should report passes=false when entropy below minEntropy', async () => {
      // Low entropy text: long string of all same char (length >= default minLength of 10)
      // passesEntropyFilter skips short texts (< minLength), so we need 10+ chars
      const result = await handleToolCall('compute_entropy', {
        text: 'aaaaaaaaaaaaaaaa',  // 16 chars, all same (entropy ~0)
        minEntropy: 1.0,
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data.entropy).toBeLessThan(0.1);
      expect(data.passes).toBe(false);
    });

    it('should truncate long text in response', async () => {
      const longText = 'a'.repeat(500);
      const result = await handleToolCall('compute_entropy', { text: longText }, manager);
      const data = JSON.parse(result.content[0].text);
      // text field in response should be truncated to <=100 chars + '...'
      expect(data.text.length).toBeLessThanOrEqual(103);
    });

    it('should return MCP-compliant content array', async () => {
      const result = await handleToolCall('compute_entropy', { text: 'test' }, manager);
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
    });
  });
});
