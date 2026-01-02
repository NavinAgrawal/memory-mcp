/**
 * Response Compressor Unit Tests
 *
 * Tests for MCP response compression functionality.
 * Validates automatic compression threshold behavior, roundtrip correctness,
 * and compression metadata accuracy.
 */

import { describe, it, expect } from 'vitest';
import {
  maybeCompressResponse,
  decompressResponse,
  isCompressedResponse,
  estimateCompressionRatio,
  type CompressedResponse,
} from '../../../server/responseCompressor.js';
import { COMPRESSION_CONFIG } from '../../../utils/constants.js';

describe('responseCompressor', () => {
  describe('maybeCompressResponse', () => {
    it('should not compress small responses below threshold', async () => {
      const smallContent = JSON.stringify({ message: 'Hello, World!' });
      const result = await maybeCompressResponse(smallContent);

      expect(result.compressed).toBe(false);
      expect(result.compressionFormat).toBe('none');
      expect(result.encoding).toBe('utf-8');
      expect(result.data).toBe(smallContent);
      expect(result.originalSize).toBeUndefined();
      expect(result.compressedSize).toBeUndefined();
    });

    it('should compress responses above threshold', async () => {
      // Create a large response (>256KB)
      const largeData = {
        entities: Array.from({ length: 5000 }, (_, i) => ({
          name: `Entity_${i}`,
          entityType: 'test',
          observations: [`Observation ${i} with some additional text to make it longer`],
          tags: ['tag1', 'tag2', 'tag3'],
          importance: i % 10,
          createdAt: new Date().toISOString(),
          lastModified: new Date().toISOString(),
        })),
      };
      const largeContent = JSON.stringify(largeData);

      // Verify content is above threshold
      expect(Buffer.byteLength(largeContent, 'utf-8')).toBeGreaterThan(
        COMPRESSION_CONFIG.AUTO_COMPRESS_RESPONSE_SIZE
      );

      const result = await maybeCompressResponse(largeContent);

      expect(result.compressed).toBe(true);
      expect(result.compressionFormat).toBe('brotli');
      expect(result.encoding).toBe('base64');
      expect(result.originalSize).toBe(Buffer.byteLength(largeContent, 'utf-8'));
      expect(result.compressedSize).toBeDefined();
      expect(result.compressedSize).toBeLessThan(result.originalSize!);
      // Data should be base64 encoded
      expect(() => Buffer.from(result.data, 'base64')).not.toThrow();
    });

    it('should respect forceCompress option for small responses', async () => {
      const smallContent = JSON.stringify({ message: 'Small but force compress' });
      const result = await maybeCompressResponse(smallContent, { forceCompress: true });

      expect(result.compressed).toBe(true);
      expect(result.compressionFormat).toBe('brotli');
      expect(result.encoding).toBe('base64');
      expect(result.originalSize).toBe(Buffer.byteLength(smallContent, 'utf-8'));
    });

    it('should respect custom threshold option', async () => {
      // Content that is 500 bytes
      const content = JSON.stringify({
        data: 'x'.repeat(450),
      });

      // With default threshold (256KB), should not compress
      const resultDefault = await maybeCompressResponse(content);
      expect(resultDefault.compressed).toBe(false);

      // With custom threshold below content size, should compress
      const resultCustom = await maybeCompressResponse(content, {
        threshold: 100,
      });
      expect(resultCustom.compressed).toBe(true);
    });

    it('should handle empty string', async () => {
      const result = await maybeCompressResponse('');
      expect(result.compressed).toBe(false);
      expect(result.data).toBe('');
    });

    it('should handle UTF-8 content correctly', async () => {
      const unicodeContent = JSON.stringify({
        message: '你好世界 🌍 مرحبا العالم',
        emoji: '🎉🎊🎁',
        japanese: 'こんにちは',
      });

      // Force compress to test encoding
      const result = await maybeCompressResponse(unicodeContent, { forceCompress: true });

      expect(result.compressed).toBe(true);

      // Verify roundtrip
      const decompressed = await decompressResponse(result);
      expect(decompressed).toBe(unicodeContent);
    });

    it('should include compression metadata when compressed', async () => {
      const content = 'x'.repeat(1000);
      const result = await maybeCompressResponse(content, { forceCompress: true });

      expect(result.compressed).toBe(true);
      expect(result.compressionFormat).toBe('brotli');
      expect(result.encoding).toBe('base64');
      expect(typeof result.originalSize).toBe('number');
      expect(typeof result.compressedSize).toBe('number');
      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.compressedSize).toBeGreaterThan(0);
    });

    it('should achieve good compression ratio on JSON data', async () => {
      // Create repetitive JSON (compresses very well)
      const jsonData = JSON.stringify({
        entities: Array.from({ length: 1000 }, (_, i) => ({
          name: `Entity_${i}`,
          entityType: 'person',
          observations: ['observation'],
        })),
      });

      const result = await maybeCompressResponse(jsonData, { forceCompress: true });

      expect(result.compressed).toBe(true);
      // JSON with repetitive patterns should compress at least 50%
      const compressionRatio = result.compressedSize! / result.originalSize!;
      expect(compressionRatio).toBeLessThan(0.5);
    });
  });

  describe('decompressResponse', () => {
    it('should decompress compressed response correctly', async () => {
      const originalContent = JSON.stringify({
        test: 'data',
        nested: { value: 123, array: [1, 2, 3] },
      });

      const compressed = await maybeCompressResponse(originalContent, { forceCompress: true });
      const decompressed = await decompressResponse(compressed);

      expect(decompressed).toBe(originalContent);
    });

    it('should return data unchanged for uncompressed response', async () => {
      const content = 'uncompressed content';
      const uncompressedResponse: CompressedResponse = {
        compressed: false,
        compressionFormat: 'none',
        encoding: 'utf-8',
        data: content,
      };

      const result = await decompressResponse(uncompressedResponse);
      expect(result).toBe(content);
    });

    it('should handle large decompression correctly', async () => {
      // Create large content
      const largeContent = JSON.stringify({
        data: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          value: `value_${i}`.repeat(10),
        })),
      });

      const compressed = await maybeCompressResponse(largeContent, { forceCompress: true });
      const decompressed = await decompressResponse(compressed);

      expect(decompressed).toBe(largeContent);
    });

    it('should preserve JSON structure through roundtrip', async () => {
      const originalData = {
        entities: [
          { name: 'Entity1', type: 'test', value: null },
          { name: 'Entity2', type: 'test', value: [1, 2, 3] },
        ],
        relations: [],
        metadata: { count: 2 },
      };

      const originalContent = JSON.stringify(originalData);
      const compressed = await maybeCompressResponse(originalContent, { forceCompress: true });
      const decompressed = await decompressResponse(compressed);
      const parsedData = JSON.parse(decompressed);

      expect(parsedData).toEqual(originalData);
    });
  });

  describe('isCompressedResponse', () => {
    it('should return true for valid compressed response', () => {
      const response: CompressedResponse = {
        compressed: true,
        compressionFormat: 'brotli',
        encoding: 'base64',
        originalSize: 1000,
        compressedSize: 300,
        data: 'base64data',
      };

      expect(isCompressedResponse(response)).toBe(true);
    });

    it('should return true for valid uncompressed response', () => {
      const response: CompressedResponse = {
        compressed: false,
        compressionFormat: 'none',
        encoding: 'utf-8',
        data: 'plain text',
      };

      expect(isCompressedResponse(response)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isCompressedResponse(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isCompressedResponse(undefined)).toBe(false);
    });

    it('should return false for primitive values', () => {
      expect(isCompressedResponse('string')).toBe(false);
      expect(isCompressedResponse(123)).toBe(false);
      expect(isCompressedResponse(true)).toBe(false);
    });

    it('should return false for objects missing required fields', () => {
      expect(isCompressedResponse({})).toBe(false);
      expect(isCompressedResponse({ compressed: true })).toBe(false);
      expect(
        isCompressedResponse({
          compressed: true,
          compressionFormat: 'brotli',
        })
      ).toBe(false);
    });

    it('should return false for invalid field values', () => {
      expect(
        isCompressedResponse({
          compressed: 'true', // should be boolean
          compressionFormat: 'brotli',
          encoding: 'base64',
          data: 'test',
        })
      ).toBe(false);

      expect(
        isCompressedResponse({
          compressed: true,
          compressionFormat: 'gzip', // should be 'brotli' or 'none'
          encoding: 'base64',
          data: 'test',
        })
      ).toBe(false);
    });
  });

  describe('estimateCompressionRatio', () => {
    it('should return 1.0 for very small content', () => {
      const ratio = estimateCompressionRatio('tiny');
      expect(ratio).toBe(1.0);
    });

    it('should estimate good compression for JSON-like content', () => {
      const jsonContent = JSON.stringify({
        entities: Array.from({ length: 100 }, (_, i) => ({ id: i, type: 'test' })),
      });

      const ratio = estimateCompressionRatio(jsonContent);
      // JSON should estimate as highly compressible (0.25-0.45)
      expect(ratio).toBeLessThan(0.5);
    });

    it('should return value between 0 and 1', () => {
      const contents = [
        'plain text content here',
        JSON.stringify({ key: 'value' }),
        'x'.repeat(2000),
        'random: ' + Math.random().toString(),
      ];

      for (const content of contents) {
        const ratio = estimateCompressionRatio(content);
        expect(ratio).toBeGreaterThanOrEqual(0);
        expect(ratio).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('integration scenarios', () => {
    it('should handle typical MCP graph response', async () => {
      // Simulate a typical read_graph response
      const graphData = {
        entities: Array.from({ length: 500 }, (_, i) => ({
          name: `Entity_${i}`,
          entityType: i % 5 === 0 ? 'person' : 'concept',
          observations: [
            `Observation 1 for entity ${i}`,
            `Observation 2 for entity ${i}`,
          ],
          tags: ['tag1', 'tag2'],
          importance: i % 10,
          createdAt: '2024-01-01T00:00:00.000Z',
          lastModified: '2024-01-15T12:00:00.000Z',
        })),
        relations: Array.from({ length: 200 }, (_, i) => ({
          from: `Entity_${i}`,
          to: `Entity_${i + 1}`,
          relationType: 'relates_to',
        })),
      };

      const content = JSON.stringify(graphData);
      const compressed = await maybeCompressResponse(content, { forceCompress: true });
      const decompressed = await decompressResponse(compressed);
      const parsed = JSON.parse(decompressed);

      expect(parsed.entities.length).toBe(500);
      expect(parsed.relations.length).toBe(200);
      expect(parsed.entities[0].name).toBe('Entity_0');
    });

    it('should handle search results with many entities', async () => {
      const searchResults = Array.from({ length: 100 }, (_, i) => ({
        name: `SearchResult_${i}`,
        entityType: 'result',
        observations: [`Found in search for query ${i}`],
        relevanceScore: 1 - i * 0.01,
      }));

      const content = JSON.stringify(searchResults);
      const compressed = await maybeCompressResponse(content, { forceCompress: true });
      const decompressed = await decompressResponse(compressed);
      const parsed = JSON.parse(decompressed);

      expect(parsed.length).toBe(100);
      expect(parsed[0].name).toBe('SearchResult_0');
    });

    it('should maintain threshold behavior across multiple calls', async () => {
      const smallContent = JSON.stringify({ small: true });
      const largeContent = JSON.stringify({
        data: 'x'.repeat(COMPRESSION_CONFIG.AUTO_COMPRESS_RESPONSE_SIZE + 1000),
      });

      // Small - not compressed
      const result1 = await maybeCompressResponse(smallContent);
      expect(result1.compressed).toBe(false);

      // Large - compressed
      const result2 = await maybeCompressResponse(largeContent);
      expect(result2.compressed).toBe(true);

      // Small again - still not compressed (no state bleeding)
      const result3 = await maybeCompressResponse(smallContent);
      expect(result3.compressed).toBe(false);
    });
  });
});
