/**
 * Validation Utilities
 *
 * Helper functions for validating entities, relations, and other data structures.
 *
 * @module utils/validationUtils
 */

// Validation utilities - uses any for flexible validation

/**
 * Validation result with status and error messages.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate an entity object.
 *
 * Checks required fields and data types.
 *
 * @param entity - Entity to validate
 * @returns Validation result
 */
export function validateEntity(entity: any): ValidationResult {
  const errors: string[] = [];

  if (!entity || typeof entity !== 'object') {
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
  } else if (!entity.observations.every((o: any) => typeof o === 'string')) {
    errors.push('All observations must be strings');
  }

  if (entity.tags !== undefined) {
    if (!Array.isArray(entity.tags)) {
      errors.push('Tags must be an array');
    } else if (!entity.tags.every((t: any) => typeof t === 'string')) {
      errors.push('All tags must be strings');
    }
  }

  if (entity.importance !== undefined) {
    const importanceValid = validateImportance(entity.importance);
    if (!importanceValid) {
      errors.push('Importance must be a number between 0 and 10');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a relation object.
 *
 * Checks required fields and data types.
 *
 * @param relation - Relation to validate
 * @returns Validation result
 */
export function validateRelation(relation: any): ValidationResult {
  const errors: string[] = [];

  if (!relation || typeof relation !== 'object') {
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
    && importance >= 0
    && importance <= 10;
}

/**
 * Validate an array of tags.
 *
 * @param tags - Tags array to validate
 * @returns Validation result
 */
export function validateTags(tags: any): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(tags)) {
    return { valid: false, errors: ['Tags must be an array'] };
  }

  if (!tags.every(t => typeof t === 'string' && t.trim() !== '')) {
    errors.push('All tags must be non-empty strings');
  }

  return { valid: errors.length === 0, errors };
}
