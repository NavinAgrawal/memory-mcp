/**
 * Zod Schema Validation Helper
 *
 * Centralizes Zod validation patterns to eliminate redundant error formatting
 * and validation logic across the codebase.
 */

import { type ZodSchema, type ZodError } from 'zod';
import { ValidationError } from './errors.js';

/**
 * Formats Zod errors into human-readable strings.
 *
 * @param error - Zod error object
 * @returns Array of formatted error messages
 */
export function formatZodErrors(error: ZodError): string[] {
  return error.issues.map(issue => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });
}

/**
 * Validates data against a Zod schema and returns the typed result.
 * Throws ValidationError with formatted error messages on failure.
 *
 * @param data - The data to validate
 * @param schema - The Zod schema to validate against
 * @param errorMessage - Custom error message prefix (default: 'Validation failed')
 * @returns The validated and typed data
 * @throws ValidationError if validation fails
 *
 * @example
 * ```typescript
 * const entities = validateWithSchema(
 *   input,
 *   BatchCreateEntitiesSchema,
 *   'Invalid entity data'
 * );
 * ```
 */
export function validateWithSchema<T>(
  data: unknown,
  schema: ZodSchema<T>,
  errorMessage: string = 'Validation failed'
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = formatZodErrors(result.error);
    throw new ValidationError(errorMessage, errors);
  }
  return result.data;
}

/**
 * Validates data and returns a result object instead of throwing.
 * Useful when you want to handle validation errors gracefully.
 *
 * @param data - The data to validate
 * @param schema - The Zod schema to validate against
 * @returns Result object with success status and either data or errors
 *
 * @example
 * ```typescript
 * const result = validateSafe(input, EntitySchema);
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.errors);
 * }
 * ```
 */
export function validateSafe<T>(
  data: unknown,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}

/**
 * Validates an array of items against a schema.
 * Returns detailed information about which items failed validation.
 *
 * @param items - Array of items to validate
 * @param schema - Zod schema for individual items
 * @param errorMessage - Custom error message prefix
 * @returns Array of validated items
 * @throws ValidationError if any item fails validation
 */
export function validateArrayWithSchema<T>(
  items: unknown[],
  schema: ZodSchema<T>,
  errorMessage: string = 'Array validation failed'
): T[] {
  const errors: string[] = [];
  const validated: T[] = [];

  for (let i = 0; i < items.length; i++) {
    const result = schema.safeParse(items[i]);
    if (result.success) {
      validated.push(result.data);
    } else {
      const itemErrors = formatZodErrors(result.error);
      errors.push(...itemErrors.map(e => `[${i}] ${e}`));
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(errorMessage, errors);
  }

  return validated;
}
