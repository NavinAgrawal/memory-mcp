/**
 * Validation Helper Unit Tests
 *
 * Tests for Zod schema validation helper functions.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  formatZodErrors,
  validateWithSchema,
  validateSafe,
  validateArrayWithSchema,
  ValidationError,
} from '../../../utils/index.js';

describe('validationHelper', () => {
  // Sample schemas for testing
  const personSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    age: z.number().min(0, 'Age must be non-negative'),
    email: z.string().email('Invalid email format').optional(),
  });

  const simpleStringSchema = z.string().min(1, 'String is required');

  describe('formatZodErrors', () => {
    it('should format simple error', () => {
      const result = personSchema.safeParse({ name: '', age: -1 });
      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        expect(formatted.length).toBeGreaterThan(0);
      }
    });

    it('should include path in error message', () => {
      const result = personSchema.safeParse({ name: 'Test', age: -5 });
      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        expect(formatted.some(e => e.includes('age'))).toBe(true);
      }
    });

    it('should format multiple errors', () => {
      const result = personSchema.safeParse({ name: '', age: -1 });
      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        expect(formatted.length).toBeGreaterThan(1);
      }
    });

    it('should handle nested path', () => {
      const nestedSchema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string().min(1),
          }),
        }),
      });

      const result = nestedSchema.safeParse({ user: { profile: { name: '' } } });
      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        expect(formatted.some(e => e.includes('user.profile.name'))).toBe(true);
      }
    });

    it('should handle error without path', () => {
      const result = simpleStringSchema.safeParse('');
      if (!result.success) {
        const formatted = formatZodErrors(result.error);
        expect(formatted.length).toBe(1);
        // No path prefix when path is empty
        expect(formatted[0]).not.toContain(':');
      }
    });
  });

  describe('validateWithSchema', () => {
    it('should return validated data for valid input', () => {
      const data = { name: 'John', age: 30 };
      const result = validateWithSchema(data, personSchema);
      expect(result.name).toBe('John');
      expect(result.age).toBe(30);
    });

    it('should throw ValidationError for invalid input', () => {
      const data = { name: '', age: -1 };
      expect(() => validateWithSchema(data, personSchema)).toThrow(ValidationError);
    });

    it('should use custom error message', () => {
      const data = { name: '', age: -1 };
      try {
        validateWithSchema(data, personSchema, 'Custom error');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toBe('Custom error');
      }
    });

    it('should include validation details in error', () => {
      const data = { name: '', age: -1 };
      try {
        validateWithSchema(data, personSchema);
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as ValidationError).errors.length).toBeGreaterThan(0);
      }
    });

    it('should transform data according to schema', () => {
      const transformSchema = z.object({
        value: z.string().transform(s => s.toUpperCase()),
      });
      const result = validateWithSchema({ value: 'test' }, transformSchema);
      expect(result.value).toBe('TEST');
    });

    it('should apply default values', () => {
      const defaultSchema = z.object({
        name: z.string(),
        active: z.boolean().default(true),
      });
      const result = validateWithSchema({ name: 'Test' }, defaultSchema);
      expect(result.active).toBe(true);
    });
  });

  describe('validateSafe', () => {
    it('should return success result for valid data', () => {
      const data = { name: 'John', age: 30 };
      const result = validateSafe(data, personSchema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John');
      }
    });

    it('should return error result for invalid data', () => {
      const data = { name: '', age: -1 };
      const result = validateSafe(data, personSchema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('should not throw on invalid data', () => {
      const data = { name: '', age: -1 };
      expect(() => validateSafe(data, personSchema)).not.toThrow();
    });

    it('should include all error messages', () => {
      const data = { name: '', age: -1, email: 'invalid' };
      const result = validateSafe(data, personSchema);

      if (!result.success) {
        expect(result.errors.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('validateArrayWithSchema', () => {
    it('should validate all items in array', () => {
      const items = [
        { name: 'John', age: 30 },
        { name: 'Jane', age: 25 },
      ];
      const result = validateArrayWithSchema(items, personSchema);
      expect(result).toHaveLength(2);
    });

    it('should throw ValidationError if any item fails', () => {
      const items = [
        { name: 'John', age: 30 },
        { name: '', age: -1 }, // Invalid
      ];
      expect(() => validateArrayWithSchema(items, personSchema)).toThrow(ValidationError);
    });

    it('should include index in error messages', () => {
      const items = [
        { name: 'John', age: 30 },
        { name: '', age: -1 }, // Invalid at index 1
      ];
      try {
        validateArrayWithSchema(items, personSchema);
        expect.fail('Should have thrown');
      } catch (error) {
        const errors = (error as ValidationError).errors;
        expect(errors.some(e => e.includes('[1]'))).toBe(true);
      }
    });

    it('should use custom error message', () => {
      const items = [{ name: '', age: -1 }];
      try {
        validateArrayWithSchema(items, personSchema, 'Array validation error');
        expect.fail('Should have thrown');
      } catch (error) {
        expect((error as ValidationError).message).toBe('Array validation error');
      }
    });

    it('should handle empty array', () => {
      const result = validateArrayWithSchema([], personSchema);
      expect(result).toEqual([]);
    });

    it('should collect errors from multiple invalid items', () => {
      const items = [
        { name: '', age: -1 }, // Invalid at index 0
        { name: 'Valid', age: 30 },
        { name: '', age: -1 }, // Invalid at index 2
      ];
      try {
        validateArrayWithSchema(items, personSchema);
        expect.fail('Should have thrown');
      } catch (error) {
        const errors = (error as ValidationError).errors;
        expect(errors.some(e => e.includes('[0]'))).toBe(true);
        expect(errors.some(e => e.includes('[2]'))).toBe(true);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle null input', () => {
      expect(() => validateWithSchema(null, personSchema)).toThrow(ValidationError);
    });

    it('should handle undefined input', () => {
      expect(() => validateWithSchema(undefined, personSchema)).toThrow(ValidationError);
    });

    it('should handle complex nested schemas', () => {
      const complexSchema = z.object({
        users: z.array(
          z.object({
            name: z.string(),
            roles: z.array(z.string()),
          })
        ),
      });

      const data = {
        users: [
          { name: 'Admin', roles: ['admin', 'user'] },
          { name: 'Guest', roles: ['guest'] },
        ],
      };

      const result = validateWithSchema(data, complexSchema);
      expect(result.users).toHaveLength(2);
    });

    it('should handle optional fields', () => {
      const data = { name: 'John', age: 30 }; // email is optional
      const result = validateWithSchema(data, personSchema);
      expect(result.email).toBeUndefined();
    });

    it('should validate email format when provided', () => {
      const data = { name: 'John', age: 30, email: 'invalid' };
      const result = validateSafe(data, personSchema);
      expect(result.success).toBe(false);
    });
  });
});
