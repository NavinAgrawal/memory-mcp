/**
 * Unit tests for responseCompressor module.
 */

import { describe, it, expect } from 'vitest';
import {
  maybeCompressResponse,
  decompressResponse,
  isCompressedResponse,
  estimateCompressionRatio,
} from '../../src/server/responseCompressor.js';

describe('responseCompressor', () => {
  describe('maybeCompressResponse', () => {
    it('should not compress small content', async () => {
      const result = await maybeCompressResponse('hello world');
      expect(result.compressed).toBe(false);
      expect(result.compressionFormat).toBe('none');
      expect(result.encoding).toBe('utf-8');
      expect(result.data).toBe('hello world');
      expect(result.originalSize).toBeUndefined();
      expect(result.compressedSize).toBeUndefined();
    });

    it('should compress content exceeding threshold', async () => {
      // Create content larger than default threshold (256KB)
      const largeContent = 'x'.repeat(300_000);
      const result = await maybeCompressResponse(largeContent);
      expect(result.compressed).toBe(true);
      expect(result.compressionFormat).toBe('brotli');
      expect(result.encoding).toBe('base64');
      expect(result.originalSize).toBe(300_000);
      expect(result.compressedSize).toBeDefined();
      expect(result.compressedSize!).toBeLessThan(result.originalSize!);
    });

    it('should compress when forceCompress is true regardless of size', async () => {
      const result = await maybeCompressResponse('tiny', { forceCompress: true });
      expect(result.compressed).toBe(true);
      expect(result.compressionFormat).toBe('brotli');
      expect(result.encoding).toBe('base64');
    });

    it('should respect custom threshold', async () => {
      const content = 'x'.repeat(500);
      const result = await maybeCompressResponse(content, { threshold: 100 });
      expect(result.compressed).toBe(true);
    });

    it('should not compress when below custom threshold', async () => {
      const content = 'x'.repeat(50);
      const result = await maybeCompressResponse(content, { threshold: 100 });
      expect(result.compressed).toBe(false);
    });
  });

  describe('decompressResponse', () => {
    it('should return data unchanged for uncompressed responses', async () => {
      const response = {
        compressed: false as const,
        compressionFormat: 'none' as const,
        encoding: 'utf-8' as const,
        data: 'hello world',
      };
      const result = await decompressResponse(response);
      expect(result).toBe('hello world');
    });

    it('should decompress compressed responses', async () => {
      const original = 'x'.repeat(300_000);
      const compressed = await maybeCompressResponse(original);
      expect(compressed.compressed).toBe(true);

      const decompressed = await decompressResponse(compressed);
      expect(decompressed).toBe(original);
    });

    it('should round-trip JSON content correctly', async () => {
      const data = JSON.stringify({
        entities: Array.from({ length: 1000 }, (_, i) => ({
          name: `entity_${i}`,
          type: 'test',
          observations: [`observation ${i}`],
        })),
      });
      const compressed = await maybeCompressResponse(data, { forceCompress: true });
      const decompressed = await decompressResponse(compressed);
      expect(decompressed).toBe(data);
    });
  });

  describe('isCompressedResponse', () => {
    it('should return true for valid uncompressed response', () => {
      expect(isCompressedResponse({
        compressed: false,
        compressionFormat: 'none',
        encoding: 'utf-8',
        data: 'hello',
      })).toBe(true);
    });

    it('should return true for valid compressed response', () => {
      expect(isCompressedResponse({
        compressed: true,
        compressionFormat: 'brotli',
        encoding: 'base64',
        data: 'abc123==',
        originalSize: 1000,
        compressedSize: 500,
      })).toBe(true);
    });

    it('should return false for null', () => {
      expect(isCompressedResponse(null)).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isCompressedResponse('string')).toBe(false);
      expect(isCompressedResponse(42)).toBe(false);
      expect(isCompressedResponse(undefined)).toBe(false);
    });

    it('should return false for objects missing required fields', () => {
      expect(isCompressedResponse({ compressed: true })).toBe(false);
      expect(isCompressedResponse({ compressionFormat: 'brotli' })).toBe(false);
    });

    it('should return false for invalid field values', () => {
      expect(isCompressedResponse({
        compressed: 'yes',
        compressionFormat: 'brotli',
        encoding: 'base64',
        data: 'abc',
      })).toBe(false);

      expect(isCompressedResponse({
        compressed: true,
        compressionFormat: 'gzip',
        encoding: 'base64',
        data: 'abc',
      })).toBe(false);
    });
  });

  describe('estimateCompressionRatio', () => {
    it('should return 1.0 for very small content', () => {
      expect(estimateCompressionRatio('tiny')).toBe(1.0);
    });

    it('should return 0.3 for JSON-like content', () => {
      const json = JSON.stringify(
        Array.from({ length: 100 }, (_, i) => ({ id: i, name: `item_${i}` }))
      );
      expect(estimateCompressionRatio(json)).toBe(0.3);
    });

    it('should return 0.4 for highly repetitive content', () => {
      // Create content with very few unique characters but > 1000 bytes
      const repetitive = 'ab'.repeat(1000);
      expect(estimateCompressionRatio(repetitive)).toBe(0.4);
    });

    it('should return 0.6 for mixed content', () => {
      // Create content with many unique chars (>30% of 256) that isn't JSON-like
      // Need uniqueChars/min(size,256) >= 0.3 and jsonRatio <= 0.1
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_+=~`|\\/<>.?;: \t\n';
      let mixed = '';
      for (let i = 0; i < 2000; i++) {
        mixed += chars[Math.floor(Math.random() * chars.length)];
      }
      // Verify our content has enough unique chars and isn't JSON-like
      const uniqueChars = new Set(mixed).size;
      const jsonIndicators = (mixed.match(/[{}\[\]":,]/g) || []).length;
      expect(uniqueChars / 256).toBeGreaterThanOrEqual(0.3);
      expect(jsonIndicators / 2000).toBeLessThanOrEqual(0.1);
      expect(estimateCompressionRatio(mixed)).toBe(0.6);
    });

    it('should be deterministic (same input = same output)', () => {
      const content = 'x'.repeat(2000);
      const result1 = estimateCompressionRatio(content);
      const result2 = estimateCompressionRatio(content);
      expect(result1).toBe(result2);
    });
  });
});
