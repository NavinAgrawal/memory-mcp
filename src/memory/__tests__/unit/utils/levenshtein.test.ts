import { describe, it, expect } from 'vitest';
import { levenshteinDistance } from '../../../utils/levenshtein.js';

describe('levenshteinDistance', () => {
  describe('identical strings', () => {
    it('should return 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
      expect(levenshteinDistance('test', 'test')).toBe(0);
      expect(levenshteinDistance('', '')).toBe(0);
    });
  });

  describe('empty strings', () => {
    it('should return length when one string is empty', () => {
      expect(levenshteinDistance('', 'hello')).toBe(5);
      expect(levenshteinDistance('world', '')).toBe(5);
      expect(levenshteinDistance('', '')).toBe(0);
    });
  });

  describe('single character difference', () => {
    it('should return 1 for single insertion', () => {
      expect(levenshteinDistance('cat', 'cats')).toBe(1);
    });

    it('should return 1 for single deletion', () => {
      expect(levenshteinDistance('cats', 'cat')).toBe(1);
    });

    it('should return 1 for single substitution', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
    });
  });

  describe('multiple edits', () => {
    it('should calculate distance for multiple edits', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
      expect(levenshteinDistance('book', 'back')).toBe(2);
    });
  });

  describe('completely different strings', () => {
    it('should handle completely different strings', () => {
      expect(levenshteinDistance('abc', 'xyz')).toBe(3);
      expect(levenshteinDistance('hello', 'world')).toBe(4);
    });
  });

  describe('different lengths', () => {
    it('should handle strings of different lengths', () => {
      expect(levenshteinDistance('short', 'muchlonger')).toBe(8);
      expect(levenshteinDistance('a', 'abc')).toBe(2);
    });
  });

  describe('case sensitivity', () => {
    it('should be case-sensitive', () => {
      expect(levenshteinDistance('Hello', 'hello')).toBe(1);
      expect(levenshteinDistance('WORLD', 'world')).toBe(5);
    });
  });

  describe('unicode characters', () => {
    it('should handle unicode characters', () => {
      expect(levenshteinDistance('café', 'cafe')).toBe(1);
      expect(levenshteinDistance('🙂', '🙃')).toBe(1);
      expect(levenshteinDistance('test', 'tëst')).toBe(1);
    });
  });

  describe('performance edge cases', () => {
    it('should handle long strings efficiently', () => {
      const longStr1 = 'a'.repeat(100);
      const longStr2 = 'b'.repeat(100);

      // Should complete without timeout
      const distance = levenshteinDistance(longStr1, longStr2);
      expect(distance).toBe(100);
    });

    it('should handle moderately long similar strings', () => {
      const str1 = 'abcdefghij'.repeat(10);
      const str2 = 'abcdefghik'.repeat(10);

      // Last char different in each repeat
      const distance = levenshteinDistance(str1, str2);
      expect(distance).toBe(10);
    });
  });
});
