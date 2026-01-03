/**
 * validationUtils Unit Tests
 *
 * Tests for entity, relation, importance, and tag validation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  validateEntity,
  validateRelation,
  validateImportance,
  validateTags,
} from '../../../src/utils/index.js';

describe('validationUtils', () => {
  describe('validateEntity', () => {
    it('should validate a valid entity', () => {
      const entity = {
        name: 'Alice',
        entityType: 'person',
        observations: ['Developer'],
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate entity with optional fields', () => {
      const entity = {
        name: 'Alice',
        entityType: 'person',
        observations: ['Developer'],
        tags: ['team-a'],
        importance: 8,
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(true);
    });

    it('should reject non-object input', () => {
      expect(validateEntity(null).valid).toBe(false);
      expect(validateEntity(undefined).valid).toBe(false);
      expect(validateEntity('string').valid).toBe(false);
      expect(validateEntity(123).valid).toBe(false);
      expect(validateEntity([]).valid).toBe(false);
    });

    it('should reject entity with missing name', () => {
      const entity = {
        entityType: 'person',
        observations: [],
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('should reject entity with empty name', () => {
      const entity = {
        name: '',
        entityType: 'person',
        observations: [],
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('should reject entity with whitespace-only name', () => {
      const entity = {
        name: '   ',
        entityType: 'person',
        observations: [],
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(false);
    });

    it('should reject entity with non-string name', () => {
      const entity = {
        name: 123,
        entityType: 'person',
        observations: [],
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(false);
    });

    it('should reject entity with missing entityType', () => {
      const entity = {
        name: 'Test',
        observations: [],
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('type'))).toBe(true);
    });

    it('should reject entity with empty entityType', () => {
      const entity = {
        name: 'Test',
        entityType: '',
        observations: [],
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(false);
    });

    it('should reject entity with non-array observations', () => {
      const entity = {
        name: 'Test',
        entityType: 'person',
        observations: 'not an array',
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('array'))).toBe(true);
    });

    it('should reject entity with non-string observations', () => {
      const entity = {
        name: 'Test',
        entityType: 'person',
        observations: [123, 456],
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('observations') && e.includes('strings'))).toBe(true);
    });

    it('should allow empty observations array', () => {
      const entity = {
        name: 'Test',
        entityType: 'person',
        observations: [],
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(true);
    });

    it('should reject entity with non-array tags', () => {
      const entity = {
        name: 'Test',
        entityType: 'person',
        observations: [],
        tags: 'not an array',
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Tags'))).toBe(true);
    });

    it('should reject entity with non-string tags', () => {
      const entity = {
        name: 'Test',
        entityType: 'person',
        observations: [],
        tags: [123, 456],
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(false);
    });

    it('should reject entity with non-number importance', () => {
      const entity = {
        name: 'Test',
        entityType: 'person',
        observations: [],
        importance: 'high',
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Importance'))).toBe(true);
    });

    it('should reject entity with out-of-range importance', () => {
      const entity = {
        name: 'Test',
        entityType: 'person',
        observations: [],
        importance: 15,
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('0') && e.includes('10'))).toBe(true);
    });

    it('should reject entity with negative importance', () => {
      const entity = {
        name: 'Test',
        entityType: 'person',
        observations: [],
        importance: -1,
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(false);
    });

    it('should collect multiple errors', () => {
      const entity = {
        name: '',
        entityType: '',
        observations: 'invalid',
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateRelation', () => {
    it('should validate a valid relation', () => {
      const relation = {
        from: 'Alice',
        to: 'Bob',
        relationType: 'knows',
      };

      const result = validateRelation(relation);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object input', () => {
      expect(validateRelation(null).valid).toBe(false);
      expect(validateRelation(undefined).valid).toBe(false);
      expect(validateRelation('string').valid).toBe(false);
      expect(validateRelation(123).valid).toBe(false);
      expect(validateRelation([]).valid).toBe(false);
    });

    it('should reject relation with missing from', () => {
      const relation = {
        to: 'Bob',
        relationType: 'knows',
      };

      const result = validateRelation(relation);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('from'))).toBe(true);
    });

    it('should reject relation with empty from', () => {
      const relation = {
        from: '',
        to: 'Bob',
        relationType: 'knows',
      };

      const result = validateRelation(relation);

      expect(result.valid).toBe(false);
    });

    it('should reject relation with whitespace-only from', () => {
      const relation = {
        from: '   ',
        to: 'Bob',
        relationType: 'knows',
      };

      const result = validateRelation(relation);

      expect(result.valid).toBe(false);
    });

    it('should reject relation with missing to', () => {
      const relation = {
        from: 'Alice',
        relationType: 'knows',
      };

      const result = validateRelation(relation);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('to'))).toBe(true);
    });

    it('should reject relation with empty to', () => {
      const relation = {
        from: 'Alice',
        to: '',
        relationType: 'knows',
      };

      const result = validateRelation(relation);

      expect(result.valid).toBe(false);
    });

    it('should reject relation with missing relationType', () => {
      const relation = {
        from: 'Alice',
        to: 'Bob',
      };

      const result = validateRelation(relation);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('type'))).toBe(true);
    });

    it('should reject relation with empty relationType', () => {
      const relation = {
        from: 'Alice',
        to: 'Bob',
        relationType: '',
      };

      const result = validateRelation(relation);

      expect(result.valid).toBe(false);
    });

    it('should reject relation with non-string fields', () => {
      const relation = {
        from: 123,
        to: 456,
        relationType: 789,
      };

      const result = validateRelation(relation);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });

    it('should collect multiple errors', () => {
      const relation = {
        from: '',
        to: '',
        relationType: '',
      };

      const result = validateRelation(relation);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });

  describe('validateImportance', () => {
    it('should accept valid importance values', () => {
      expect(validateImportance(0)).toBe(true);
      expect(validateImportance(5)).toBe(true);
      expect(validateImportance(10)).toBe(true);
    });

    it('should accept decimal importance values in range', () => {
      expect(validateImportance(5.5)).toBe(true);
      expect(validateImportance(0.1)).toBe(true);
      expect(validateImportance(9.9)).toBe(true);
    });

    it('should reject importance below 0', () => {
      expect(validateImportance(-1)).toBe(false);
      expect(validateImportance(-0.1)).toBe(false);
    });

    it('should reject importance above 10', () => {
      expect(validateImportance(11)).toBe(false);
      expect(validateImportance(10.1)).toBe(false);
      expect(validateImportance(100)).toBe(false);
    });

    it('should reject NaN', () => {
      expect(validateImportance(NaN)).toBe(false);
    });

    it('should reject Infinity', () => {
      expect(validateImportance(Infinity)).toBe(false);
      expect(validateImportance(-Infinity)).toBe(false);
    });
  });

  describe('validateTags', () => {
    it('should accept valid tags array', () => {
      const result = validateTags(['tag1', 'tag2', 'tag3']);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept empty tags array', () => {
      const result = validateTags([]);

      expect(result.valid).toBe(true);
    });

    it('should accept single tag', () => {
      const result = validateTags(['single']);

      expect(result.valid).toBe(true);
    });

    it('should reject non-array input', () => {
      expect(validateTags(null).valid).toBe(false);
      expect(validateTags(undefined).valid).toBe(false);
      expect(validateTags('string').valid).toBe(false);
      expect(validateTags(123).valid).toBe(false);
      expect(validateTags({}).valid).toBe(false);
    });

    it('should reject tags with non-string elements', () => {
      const result = validateTags([123, 456]);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('strings'))).toBe(true);
    });

    it('should reject tags with mixed types', () => {
      const result = validateTags(['valid', 123, 'also-valid']);

      expect(result.valid).toBe(false);
    });

    it('should reject tags with empty strings', () => {
      const result = validateTags(['valid', '', 'also-valid']);

      expect(result.valid).toBe(false);
    });

    it('should reject tags with whitespace-only strings', () => {
      const result = validateTags(['valid', '   ', 'also-valid']);

      expect(result.valid).toBe(false);
    });

    it('should accept tags with special characters', () => {
      const result = validateTags(['tag-with-dash', 'tag_with_underscore', 'tag.with.dot']);

      expect(result.valid).toBe(true);
    });

    it('should accept unicode tags', () => {
      const result = validateTags(['日本語', 'emoji-🏷️', 'مرحبا']);

      expect(result.valid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle object with prototype pollution attempt', () => {
      const entity = {
        name: 'Test',
        entityType: 'person',
        observations: [],
        __proto__: { admin: true },
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(true);
    });

    it('should handle entity with extra unknown fields', () => {
      const entity = {
        name: 'Test',
        entityType: 'person',
        observations: [],
        unknownField: 'ignored',
        anotherField: 123,
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(true);
    });

    it('should handle very long entity names', () => {
      const entity = {
        name: 'a'.repeat(10000),
        entityType: 'person',
        observations: [],
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(true);
    });

    it('should handle entity with many observations', () => {
      const entity = {
        name: 'Test',
        entityType: 'person',
        observations: Array(1000).fill('observation'),
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(true);
    });

    it('should handle entity with many tags', () => {
      const entity = {
        name: 'Test',
        entityType: 'person',
        observations: [],
        tags: Array(1000).fill(0).map((_, i) => `tag${i}`),
      };

      const result = validateEntity(entity);

      expect(result.valid).toBe(true);
    });
  });
});
