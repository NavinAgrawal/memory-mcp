/**
 * Compression Manager
 *
 * Detects and merges duplicate entities to compress the knowledge graph.
 *
 * @module features/CompressionManager
 */

import type { Entity, Relation, CompressionResult } from '../types/index.js';
import type { GraphStorage } from '../core/GraphStorage.js';
import { levenshteinDistance } from '../utils/levenshtein.js';
import { EntityNotFoundError, InsufficientEntitiesError } from '../utils/errors.js';

/**
 * Default threshold for duplicate detection (80% similarity).
 */
export const DEFAULT_DUPLICATE_THRESHOLD = 0.8;

/**
 * Similarity scoring weights for entity comparison.
 * These values determine the relative importance of each factor when calculating
 * entity similarity. Higher weights give more importance to that factor.
 * Total weights must sum to 1.0 (100%).
 */
export const SIMILARITY_WEIGHTS = {
  /** Weight for name similarity using Levenshtein distance (40%) */
  NAME: 0.4,
  /** Weight for exact entity type match (20%) */
  TYPE: 0.2,
  /** Weight for observation overlap using Jaccard similarity (30%) */
  OBSERVATIONS: 0.3,
  /** Weight for tag overlap using Jaccard similarity (10%) */
  TAGS: 0.1,
} as const;

/**
 * Manages graph compression through duplicate detection and merging.
 */
export class CompressionManager {
  constructor(private storage: GraphStorage) {}

  /**
   * Calculate similarity between two entities using multiple heuristics.
   *
   * Uses configurable weights defined in SIMILARITY_WEIGHTS constant.
   * See SIMILARITY_WEIGHTS for the breakdown of scoring factors.
   *
   * @param e1 - First entity
   * @param e2 - Second entity
   * @returns Similarity score from 0 (completely different) to 1 (identical)
   */
  private calculateEntitySimilarity(e1: Entity, e2: Entity): number {
    let score = 0;
    let factors = 0;

    // Name similarity (Levenshtein-based)
    const nameDistance = levenshteinDistance(e1.name.toLowerCase(), e2.name.toLowerCase());
    const maxNameLength = Math.max(e1.name.length, e2.name.length);
    const nameSimilarity = 1 - nameDistance / maxNameLength;
    score += nameSimilarity * SIMILARITY_WEIGHTS.NAME;
    factors += SIMILARITY_WEIGHTS.NAME;

    // Type similarity (exact match)
    if (e1.entityType.toLowerCase() === e2.entityType.toLowerCase()) {
      score += SIMILARITY_WEIGHTS.TYPE;
    }
    factors += SIMILARITY_WEIGHTS.TYPE;

    // Observation overlap (Jaccard similarity)
    const obs1Set = new Set(e1.observations.map(o => o.toLowerCase()));
    const obs2Set = new Set(e2.observations.map(o => o.toLowerCase()));
    const intersection = new Set([...obs1Set].filter(x => obs2Set.has(x)));
    const union = new Set([...obs1Set, ...obs2Set]);
    const observationSimilarity = union.size > 0 ? intersection.size / union.size : 0;
    score += observationSimilarity * SIMILARITY_WEIGHTS.OBSERVATIONS;
    factors += SIMILARITY_WEIGHTS.OBSERVATIONS;

    // Tag overlap (Jaccard similarity)
    if (e1.tags && e2.tags && (e1.tags.length > 0 || e2.tags.length > 0)) {
      const tags1Set = new Set(e1.tags.map(t => t.toLowerCase()));
      const tags2Set = new Set(e2.tags.map(t => t.toLowerCase()));
      const tagIntersection = new Set([...tags1Set].filter(x => tags2Set.has(x)));
      const tagUnion = new Set([...tags1Set, ...tags2Set]);
      const tagSimilarity = tagUnion.size > 0 ? tagIntersection.size / tagUnion.size : 0;
      score += tagSimilarity * SIMILARITY_WEIGHTS.TAGS;
      factors += SIMILARITY_WEIGHTS.TAGS;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Find duplicate entities in the graph based on similarity threshold.
   *
   * OPTIMIZED: Uses bucketing strategies to reduce O(n²) comparisons:
   * 1. Buckets entities by entityType (only compare same types)
   * 2. Within each type, buckets by name prefix (first 2 chars normalized)
   * 3. Only compares entities within same or adjacent buckets
   *
   * Complexity: O(n·k) where k is average bucket size (typically << n)
   *
   * @param threshold - Similarity threshold (0.0 to 1.0), default DEFAULT_DUPLICATE_THRESHOLD
   * @returns Array of duplicate groups (each group has similar entities)
   */
  async findDuplicates(threshold: number = DEFAULT_DUPLICATE_THRESHOLD): Promise<string[][]> {
    const graph = await this.storage.loadGraph();
    const duplicateGroups: string[][] = [];
    const processed = new Set<string>();

    // Step 1: Bucket entities by type (reduces comparisons drastically)
    const typeMap = new Map<string, Entity[]>();
    for (const entity of graph.entities) {
      const normalizedType = entity.entityType.toLowerCase();
      if (!typeMap.has(normalizedType)) {
        typeMap.set(normalizedType, []);
      }
      typeMap.get(normalizedType)!.push(entity);
    }

    // Step 2: For each type bucket, sub-bucket by name prefix
    for (const entities of typeMap.values()) {
      // Skip single-entity types (no duplicates possible)
      if (entities.length < 2) continue;

      // Create name prefix buckets (first 2 chars, normalized)
      const prefixMap = new Map<string, Entity[]>();
      for (const entity of entities) {
        const prefix = entity.name.toLowerCase().slice(0, 2);
        if (!prefixMap.has(prefix)) {
          prefixMap.set(prefix, []);
        }
        prefixMap.get(prefix)!.push(entity);
      }

      // Step 3: Compare only within buckets (or adjacent buckets for fuzzy matching)
      const prefixKeys = Array.from(prefixMap.keys()).sort();

      for (let bucketIdx = 0; bucketIdx < prefixKeys.length; bucketIdx++) {
        const currentPrefix = prefixKeys[bucketIdx];
        const currentBucket = prefixMap.get(currentPrefix)!;

        // Collect entities to compare: current bucket + adjacent buckets
        const candidateEntities: Entity[] = [...currentBucket];

        // Add next bucket if exists (handles fuzzy prefix matching)
        if (bucketIdx + 1 < prefixKeys.length) {
          candidateEntities.push(...prefixMap.get(prefixKeys[bucketIdx + 1])!);
        }

        // Compare entities within candidate pool
        for (let i = 0; i < currentBucket.length; i++) {
          const entity1 = currentBucket[i];
          if (processed.has(entity1.name)) continue;

          const group: string[] = [entity1.name];

          for (let j = 0; j < candidateEntities.length; j++) {
            const entity2 = candidateEntities[j];
            if (entity1.name === entity2.name || processed.has(entity2.name)) continue;

            const similarity = this.calculateEntitySimilarity(entity1, entity2);
            if (similarity >= threshold) {
              group.push(entity2.name);
              processed.add(entity2.name);
            }
          }

          if (group.length > 1) {
            duplicateGroups.push(group);
            processed.add(entity1.name);
          }
        }
      }
    }

    return duplicateGroups;
  }

  /**
   * Merge a group of entities into a single entity.
   *
   * Merging strategy:
   * - First entity is kept (or renamed to targetName)
   * - Observations: Union of all observations
   * - Tags: Union of all tags
   * - Importance: Maximum importance value
   * - createdAt: Earliest date
   * - lastModified: Current timestamp
   * - Relations: Redirected to kept entity, duplicates removed
   *
   * @param entityNames - Names of entities to merge (first one is kept)
   * @param targetName - Optional new name for merged entity (default: first entity name)
   * @returns The merged entity
   * @throws {InsufficientEntitiesError} If less than 2 entities provided
   * @throws {EntityNotFoundError} If any entity not found
   */
  async mergeEntities(entityNames: string[], targetName?: string): Promise<Entity> {
    if (entityNames.length < 2) {
      throw new InsufficientEntitiesError('merging', 2, entityNames.length);
    }

    const graph = await this.storage.loadGraph();
    const entitiesToMerge = entityNames.map(name => {
      const entity = graph.entities.find(e => e.name === name);
      if (!entity) {
        throw new EntityNotFoundError(name);
      }
      return entity;
    });

    const keepEntity = entitiesToMerge[0];
    const mergeEntities = entitiesToMerge.slice(1);

    // Merge observations (unique)
    const allObservations = new Set<string>();
    for (const entity of entitiesToMerge) {
      entity.observations.forEach(obs => allObservations.add(obs));
    }
    keepEntity.observations = Array.from(allObservations);

    // Merge tags (unique)
    const allTags = new Set<string>();
    for (const entity of entitiesToMerge) {
      if (entity.tags) {
        entity.tags.forEach(tag => allTags.add(tag));
      }
    }
    if (allTags.size > 0) {
      keepEntity.tags = Array.from(allTags);
    }

    // Use highest importance
    const importances = entitiesToMerge
      .map(e => e.importance)
      .filter(imp => imp !== undefined) as number[];
    if (importances.length > 0) {
      keepEntity.importance = Math.max(...importances);
    }

    // Use earliest createdAt
    const createdDates = entitiesToMerge
      .map(e => e.createdAt)
      .filter(date => date !== undefined) as string[];
    if (createdDates.length > 0) {
      keepEntity.createdAt = createdDates.sort()[0];
    }

    // Update lastModified
    keepEntity.lastModified = new Date().toISOString();

    // Rename if requested
    if (targetName && targetName !== keepEntity.name) {
      // Update all relations pointing to old name
      graph.relations.forEach(rel => {
        if (rel.from === keepEntity.name) rel.from = targetName;
        if (rel.to === keepEntity.name) rel.to = targetName;
      });
      keepEntity.name = targetName;
    }

    // Update relations from merged entities to point to kept entity
    for (const mergeEntity of mergeEntities) {
      graph.relations.forEach(rel => {
        if (rel.from === mergeEntity.name) rel.from = keepEntity.name;
        if (rel.to === mergeEntity.name) rel.to = keepEntity.name;
      });
    }

    // Remove duplicate relations
    const uniqueRelations = new Map<string, Relation>();
    for (const relation of graph.relations) {
      const key = `${relation.from}|${relation.to}|${relation.relationType}`;
      if (!uniqueRelations.has(key)) {
        uniqueRelations.set(key, relation);
      }
    }
    graph.relations = Array.from(uniqueRelations.values());

    // Remove merged entities
    const mergeNames = new Set(mergeEntities.map(e => e.name));
    graph.entities = graph.entities.filter(e => !mergeNames.has(e.name));

    await this.storage.saveGraph(graph);
    return keepEntity;
  }

  /**
   * Compress the knowledge graph by finding and merging duplicates.
   *
   * @param threshold - Similarity threshold for duplicate detection (0.0 to 1.0), default DEFAULT_DUPLICATE_THRESHOLD
   * @param dryRun - If true, only report what would be compressed without applying changes
   * @returns Compression result with statistics
   */
  async compressGraph(threshold: number = DEFAULT_DUPLICATE_THRESHOLD, dryRun: boolean = false): Promise<CompressionResult> {
    const initialGraph = await this.storage.loadGraph();
    const initialSize = JSON.stringify(initialGraph).length;

    const duplicateGroups = await this.findDuplicates(threshold);
    const result: CompressionResult = {
      duplicatesFound: duplicateGroups.reduce((sum, group) => sum + group.length, 0),
      entitiesMerged: 0,
      observationsCompressed: 0,
      relationsConsolidated: 0,
      spaceFreed: 0,
      mergedEntities: [],
    };

    if (dryRun) {
      // Just report what would happen
      for (const group of duplicateGroups) {
        result.mergedEntities.push({
          kept: group[0],
          merged: group.slice(1),
        });
        result.entitiesMerged += group.length - 1;
      }
      return result;
    }

    // Actually merge duplicates
    for (const group of duplicateGroups) {
      try {
        await this.mergeEntities(group);
        result.mergedEntities.push({
          kept: group[0],
          merged: group.slice(1),
        });
        result.entitiesMerged += group.length - 1;
      } catch (error) {
        // Skip groups that fail to merge
        console.error(`Failed to merge group ${group}:`, error);
      }
    }

    // Calculate space saved
    const finalGraph = await this.storage.loadGraph();
    const finalSize = JSON.stringify(finalGraph).length;
    result.spaceFreed = initialSize - finalSize;

    // Count compressed observations (approximation)
    result.observationsCompressed = result.entitiesMerged;

    return result;
  }
}
