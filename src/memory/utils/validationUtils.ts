/**
 * Validation Utilities
 *
 * Helper functions for validating entities, relations, and other data structures.
 *
 * @module utils/validationUtils
 */

import { IMPORTANCE_RANGE } from './constants.js';

/**
 * Validation result with status and error messages.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Type guard to check if value is a non-null object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate an entity object.
 *
 * Checks required fields and data types.
 *
 * @param entity - Entity to validate (unknown type for runtime validation)
 * @returns Validation result
 */
export function validateEntity(entity: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(entity)) {
    return { valid: false, errors: ['Entity must be an object'] };
  }

  if (!entity.name || typeof entity.name !== 'string' || entity.name.trim() === '') {
    errors.push('Entity name is required and must be a non-empty string');
  }

  if (!entity.entityType || typeof entity.entityType !== 'string' || entity.entityType.trim() === '') {
    errors.push('Entity type is required and must be a non-empty string');
  }

  if (!Array.isArray(entity.observations)) {
    errors.push('Observations must be an array');
  } else if (!entity.observations.every((o: unknown) => typeof o === 'string')) {
    errors.push('All observations must be strings');
  }

  if (entity.tags !== undefined) {
    if (!Array.isArray(entity.tags)) {
      errors.push('Tags must be an array');
    } else if (!entity.tags.every((t: unknown) => typeof t === 'string')) {
      errors.push('All tags must be strings');
    }
  }

  if (entity.importance !== undefined) {
    if (typeof entity.importance !== 'number') {
      errors.push('Importance must be a number');
    } else if (!validateImportance(entity.importance)) {
      errors.push('Importance must be between 0 and 10');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a relation object.
 *
 * Checks required fields and data types.
 *
 * @param relation - Relation to validate (unknown type for runtime validation)
 * @returns Validation result
 */
export function validateRelation(relation: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(relation)) {
    return { valid: false, errors: ['Relation must be an object'] };
  }

  if (!relation.from || typeof relation.from !== 'string' || relation.from.trim() === '') {
    errors.push('Relation "from" is required and must be a non-empty string');
  }

  if (!relation.to || typeof relation.to !== 'string' || relation.to.trim() === '') {
    errors.push('Relation "to" is required and must be a non-empty string');
  }

  if (!relation.relationType || typeof relation.relationType !== 'string' || relation.relationType.trim() === '') {
    errors.push('Relation type is required and must be a non-empty string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate importance level (must be 0-10).
 *
 * @param importance - Importance value to validate
 * @returns True if valid
 */
export function validateImportance(importance: number): boolean {
  return typeof importance === 'number'
    && !isNaN(importance)
    && importance >= IMPORTANCE_RANGE.MIN
    && importance <= IMPORTANCE_RANGE.MAX;
}

/**
 * Validate an array of tags.
 *
 * @param tags - Tags array to validate (unknown type for runtime validation)
 * @returns Validation result
 */
export function validateTags(tags: unknown): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(tags)) {
    return { valid: false, errors: ['Tags must be an array'] };
  }

  if (!tags.every((t: unknown) => typeof t === 'string' && t.trim() !== '')) {
    errors.push('All tags must be non-empty strings');
  }

  return { valid: errors.length === 0, errors };
}
