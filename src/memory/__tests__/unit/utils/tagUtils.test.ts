/**
 * Tag Utilities Unit Tests
 *
 * Tests for tag normalization and matching functions.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeTag,
  normalizeTags,
  hasMatchingTag,
  hasAllTags,
  filterByTags,
  addUniqueTags,
  removeTags,
} from '../../../utils/tagUtils.js';

describe('tagUtils', () => {
  describe('normalizeTag', () => {
    it('should convert to lowercase', () => {
      expect(normalizeTag('TEST')).toBe('test');
      expect(normalizeTag('TeSt')).toBe('test');
    });

    it('should trim whitespace', () => {
      expect(normalizeTag('  test  ')).toBe('test');
      expect(normalizeTag('\ttest\n')).toBe('test');
    });

    it('should handle already normalized tag', () => {
      expect(normalizeTag('test')).toBe('test');
    });

    it('should handle empty string', () => {
      expect(normalizeTag('')).toBe('');
    });

    it('should preserve special characters', () => {
      expect(normalizeTag('C++')).toBe('c++');
      expect(normalizeTag('node.js')).toBe('node.js');
    });
  });

  describe('normalizeTags', () => {
    it('should normalize all tags in array', () => {
      const result = normalizeTags(['TEST', 'Hello', 'WORLD']);
      expect(result).toEqual(['test', 'hello', 'world']);
    });

    it('should return empty array for undefined', () => {
      expect(normalizeTags(undefined)).toEqual([]);
    });

    it('should return empty array for null', () => {
      expect(normalizeTags(null)).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(normalizeTags([])).toEqual([]);
    });

    it('should handle mixed case tags', () => {
      const result = normalizeTags(['Backend', 'FrontEnd', 'API']);
      expect(result).toEqual(['backend', 'frontend', 'api']);
    });
  });

  describe('hasMatchingTag', () => {
    it('should return true when there is a matching tag', () => {
      expect(hasMatchingTag(['backend', 'frontend'], ['backend'])).toBe(true);
    });

    it('should return true when any tag matches', () => {
      expect(hasMatchingTag(['backend', 'frontend'], ['api', 'frontend'])).toBe(true);
    });

    it('should return false when no tags match', () => {
      expect(hasMatchingTag(['backend', 'frontend'], ['api', 'database'])).toBe(false);
    });

    it('should return false for undefined entity tags', () => {
      expect(hasMatchingTag(undefined, ['test'])).toBe(false);
    });

    it('should return false for empty entity tags', () => {
      expect(hasMatchingTag([], ['test'])).toBe(false);
    });

    it('should return false for undefined search tags', () => {
      expect(hasMatchingTag(['test'], undefined)).toBe(false);
    });

    it('should return false for empty search tags', () => {
      expect(hasMatchingTag(['test'], [])).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(hasMatchingTag(['BACKEND'], ['backend'])).toBe(true);
      expect(hasMatchingTag(['backend'], ['BACKEND'])).toBe(true);
    });
  });

  describe('hasAllTags', () => {
    it('should return true when all required tags are present', () => {
      expect(hasAllTags(['backend', 'frontend', 'api'], ['backend', 'api'])).toBe(true);
    });

    it('should return false when some required tags are missing', () => {
      expect(hasAllTags(['backend'], ['backend', 'frontend'])).toBe(false);
    });

    it('should return true for empty required tags', () => {
      expect(hasAllTags(['backend'], [])).toBe(true);
    });

    it('should return false for undefined entity tags', () => {
      expect(hasAllTags(undefined, ['test'])).toBe(false);
    });

    it('should return false for empty entity tags', () => {
      expect(hasAllTags([], ['test'])).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(hasAllTags(['BACKEND', 'FRONTEND'], ['backend', 'frontend'])).toBe(true);
    });
  });

  describe('filterByTags', () => {
    const entities = [
      { name: 'A', tags: ['backend', 'senior'] },
      { name: 'B', tags: ['frontend'] },
      { name: 'C', tags: ['backend', 'junior'] },
      { name: 'D', tags: undefined },
      { name: 'E', tags: [] },
    ];

    it('should filter entities by matching tags', () => {
      const result = filterByTags(entities, ['backend']);
      expect(result).toHaveLength(2);
      expect(result.map(e => e.name)).toContain('A');
      expect(result.map(e => e.name)).toContain('C');
    });

    it('should return all entities for undefined search tags', () => {
      const result = filterByTags(entities, undefined);
      expect(result).toHaveLength(5);
    });

    it('should return all entities for empty search tags', () => {
      const result = filterByTags(entities, []);
      expect(result).toHaveLength(5);
    });

    it('should exclude entities without tags', () => {
      const result = filterByTags(entities, ['test']);
      expect(result.map(e => e.name)).not.toContain('D');
      expect(result.map(e => e.name)).not.toContain('E');
    });

    it('should match any of multiple search tags (OR)', () => {
      const result = filterByTags(entities, ['backend', 'frontend']);
      expect(result).toHaveLength(3);
    });

    it('should be case-insensitive', () => {
      const result = filterByTags(entities, ['BACKEND']);
      expect(result).toHaveLength(2);
    });
  });

  describe('addUniqueTags', () => {
    it('should add new tags to existing', () => {
      const result = addUniqueTags(['a', 'b'], ['c', 'd']);
      expect(result).toEqual(['a', 'b', 'c', 'd']);
    });

    it('should not add duplicate tags', () => {
      const result = addUniqueTags(['a', 'b'], ['b', 'c']);
      expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle undefined existing tags', () => {
      const result = addUniqueTags(undefined, ['a', 'b']);
      expect(result).toEqual(['a', 'b']);
    });

    it('should normalize tags to lowercase', () => {
      const result = addUniqueTags(['A'], ['B']);
      expect(result).toEqual(['a', 'b']);
    });

    it('should handle case-insensitive duplicates', () => {
      const result = addUniqueTags(['backend'], ['BACKEND', 'frontend']);
      expect(result).toEqual(['backend', 'frontend']);
    });

    it('should handle empty new tags', () => {
      const result = addUniqueTags(['a', 'b'], []);
      expect(result).toEqual(['a', 'b']);
    });
  });

  describe('removeTags', () => {
    it('should remove specified tags', () => {
      const result = removeTags(['a', 'b', 'c'], ['b']);
      expect(result).toEqual(['a', 'c']);
    });

    it('should handle undefined existing tags', () => {
      const result = removeTags(undefined, ['a']);
      expect(result).toEqual([]);
    });

    it('should handle empty existing tags', () => {
      const result = removeTags([], ['a']);
      expect(result).toEqual([]);
    });

    it('should be case-insensitive for removal', () => {
      const result = removeTags(['Backend', 'Frontend'], ['backend']);
      expect(result).toEqual(['Frontend']);
    });

    it('should preserve original case of remaining tags', () => {
      const result = removeTags(['Backend', 'Frontend', 'API'], ['frontend']);
      expect(result).toContain('Backend');
      expect(result).toContain('API');
    });

    it('should handle removing non-existent tags', () => {
      const result = removeTags(['a', 'b'], ['c', 'd']);
      expect(result).toEqual(['a', 'b']);
    });

    it('should remove all matching tags', () => {
      const result = removeTags(['a', 'b', 'c'], ['a', 'b', 'c']);
      expect(result).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle tags with special characters', () => {
      const result = hasMatchingTag(['c++', 'c#'], ['c++']);
      expect(result).toBe(true);
    });

    it('should handle tags with unicode', () => {
      const result = hasMatchingTag(['日本語', 'tag'], ['日本語']);
      expect(result).toBe(true);
    });

    it('should handle tags with whitespace', () => {
      // Note: normalizeTags only lowercases, doesn't trim individual array elements
      const result = normalizeTags(['  tag  ']);
      expect(result).toEqual(['  tag  ']);
    });

    it('should handle very long tag names', () => {
      const longTag = 'a'.repeat(1000);
      const result = hasMatchingTag([longTag], [longTag]);
      expect(result).toBe(true);
    });

    it('should handle large number of tags', () => {
      const manyTags = Array.from({ length: 1000 }, (_, i) => `tag${i}`);
      const result = filterByTags([{ name: 'test', tags: manyTags }], ['tag500']);
      expect(result).toHaveLength(1);
    });
  });
});
