/**
 * Validation Schemas
 *
 * Zod schemas for input validation across the memory system.
 * Provides runtime type safety and data validation.
 *
 * @module utils/schemas
 */

import { z } from 'zod';
import { IMPORTANCE_RANGE } from './constants.js';

/**
 * Importance range constants (imported from centralized constants).
 */
const MIN_IMPORTANCE = IMPORTANCE_RANGE.MIN;
const MAX_IMPORTANCE = IMPORTANCE_RANGE.MAX;

/**
 * ISO 8601 date string validation.
 * Accepts standard ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
 */
const isoDateSchema = z.string().datetime({ message: 'Must be a valid ISO 8601 date string' });

/**
 * Entity name validation.
 * Must be a non-empty string with reasonable length constraints.
 */
const entityNameSchema = z.string()
  .min(1, 'Entity name cannot be empty')
  .max(500, 'Entity name cannot exceed 500 characters')
  .trim();

/**
 * Entity type validation.
 * Must be a non-empty string (e.g., "person", "project", "concept").
 */
const entityTypeSchema = z.string()
  .min(1, 'Entity type cannot be empty')
  .max(100, 'Entity type cannot exceed 100 characters')
  .trim();

/**
 * Observation validation.
 * Each observation must be a non-empty string.
 */
const observationSchema = z.string()
  .min(1, 'Observation cannot be empty')
  .max(5000, 'Observation cannot exceed 5000 characters');

/**
 * Tag validation.
 * Tags are normalized to lowercase and must be non-empty.
 */
const tagSchema = z.string()
  .min(1, 'Tag cannot be empty')
  .max(100, 'Tag cannot exceed 100 characters')
  .trim()
  .toLowerCase();

/**
 * Importance validation.
 * Must be a number between MIN_IMPORTANCE and MAX_IMPORTANCE (0-10).
 */
const importanceSchema = z.number()
  .int('Importance must be an integer')
  .min(MIN_IMPORTANCE, `Importance must be at least ${MIN_IMPORTANCE}`)
  .max(MAX_IMPORTANCE, `Importance must be at most ${MAX_IMPORTANCE}`);

/**
 * Relation type validation.
 * Should be in snake_case format (e.g., "works_at", "manages").
 */
const relationTypeSchema = z.string()
  .min(1, 'Relation type cannot be empty')
  .max(100, 'Relation type cannot exceed 100 characters')
  .trim();

/**
 * Complete Entity schema with all fields.
 * Used for validating full entity objects including timestamps.
 */
export const EntitySchema = z.object({
  name: entityNameSchema,
  entityType: entityTypeSchema,
  observations: z.array(observationSchema),
  createdAt: isoDateSchema.optional(),
  lastModified: isoDateSchema.optional(),
  tags: z.array(tagSchema).optional(),
  importance: importanceSchema.optional(),
  parentId: entityNameSchema.optional(),
}).strict();

/**
 * Entity creation input schema.
 * Used for validating user input when creating new entities.
 * Timestamps are optional and will be auto-generated if not provided.
 */
export const CreateEntitySchema = z.object({
  name: entityNameSchema,
  entityType: entityTypeSchema,
  observations: z.array(observationSchema),
  tags: z.array(tagSchema).optional(),
  importance: importanceSchema.optional(),
  parentId: entityNameSchema.optional(),
  createdAt: isoDateSchema.optional(),
  lastModified: isoDateSchema.optional(),
});

/**
 * Entity update input schema.
 * All fields are optional for partial updates.
 * Name cannot be updated (it's the unique identifier).
 */
export const UpdateEntitySchema = z.object({
  entityType: entityTypeSchema.optional(),
  observations: z.array(observationSchema).optional(),
  tags: z.array(tagSchema).optional(),
  importance: importanceSchema.optional(),
  parentId: entityNameSchema.optional(),
});

/**
 * Complete Relation schema with all fields.
 * Used for validating full relation objects including timestamps.
 */
export const RelationSchema = z.object({
  from: entityNameSchema,
  to: entityNameSchema,
  relationType: relationTypeSchema,
  createdAt: isoDateSchema.optional(),
  lastModified: isoDateSchema.optional(),
}).strict();

/**
 * Relation creation input schema.
 * Used for validating user input when creating new relations.
 * Timestamps are optional and will be auto-generated if not provided.
 */
export const CreateRelationSchema = z.object({
  from: entityNameSchema,
  to: entityNameSchema,
  relationType: relationTypeSchema,
  createdAt: isoDateSchema.optional(),
  lastModified: isoDateSchema.optional(),
});

/**
 * Search query validation.
 * Validates text search queries with reasonable length constraints.
 */
export const SearchQuerySchema = z.string()
  .min(1, 'Search query cannot be empty')
  .max(1000, 'Search query cannot exceed 1000 characters')
  .trim();

/**
 * Date range validation for search filters.
 */
export const DateRangeSchema = z.object({
  start: isoDateSchema,
  end: isoDateSchema,
}).refine(
  (data) => new Date(data.start) <= new Date(data.end),
  { message: 'Start date must be before or equal to end date' }
);

/**
 * Tag alias validation for TagManager.
 */
export const TagAliasSchema = z.object({
  canonical: tagSchema,
  aliases: z.array(tagSchema).min(1, 'Must have at least one alias'),
});

/**
 * Export format validation.
 */
export const ExportFormatSchema = z.enum(['json', 'graphml', 'csv']);

/**
 * Batch entity creation validation.
 * Validates array of entities with minimum/maximum constraints.
 */
export const BatchCreateEntitiesSchema = z.array(CreateEntitySchema)
  .min(1, 'Must create at least one entity')
  .max(1000, 'Cannot create more than 1000 entities in a single batch');

/**
 * Batch relation creation validation.
 * Validates array of relations with minimum/maximum constraints.
 */
export const BatchCreateRelationsSchema = z.array(CreateRelationSchema)
  .min(1, 'Must create at least one relation')
  .max(1000, 'Cannot create more than 1000 relations in a single batch');

/**
 * Entity name array validation for batch deletion.
 */
export const EntityNamesSchema = z.array(entityNameSchema)
  .min(1, 'Must specify at least one entity name')
  .max(1000, 'Cannot delete more than 1000 entities in a single batch');

/**
 * Relation array validation for batch deletion.
 */
export const DeleteRelationsSchema = z.array(CreateRelationSchema)
  .min(1, 'Must specify at least one relation')
  .max(1000, 'Cannot delete more than 1000 relations in a single batch');

// Type exports for TypeScript inference
export type EntityInput = z.infer<typeof EntitySchema>;
export type CreateEntityInput = z.infer<typeof CreateEntitySchema>;
export type UpdateEntityInput = z.infer<typeof UpdateEntitySchema>;
export type RelationInput = z.infer<typeof RelationSchema>;
export type CreateRelationInput = z.infer<typeof CreateRelationSchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type DateRange = z.infer<typeof DateRangeSchema>;
export type TagAlias = z.infer<typeof TagAliasSchema>;
export type ExportFormat = z.infer<typeof ExportFormatSchema>;
