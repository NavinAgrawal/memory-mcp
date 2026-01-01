/**
 * Search Manager
 *
 * Orchestrates all search types (basic, ranked, boolean, fuzzy).
 * Also handles compression operations (duplicate detection, entity merging).
 *
 * @module search/SearchManager
 */

import type { Entity, Relation, KnowledgeGraph, SearchResult, SavedSearch, CompressionResult, ValidationReport, ValidationIssue, ValidationWarning, GraphStats } from '../types/index.js';
import type { GraphStorage } from '../core/GraphStorage.js';
import { BasicSearch } from './BasicSearch.js';
import { RankedSearch } from './RankedSearch.js';
import { BooleanSearch } from './BooleanSearch.js';
import { FuzzySearch } from './FuzzySearch.js';
import { SearchSuggestions } from './SearchSuggestions.js';
import { SavedSearchManager } from './SavedSearchManager.js';
import { levenshteinDistance } from '../utils/index.js';
import { EntityNotFoundError, InsufficientEntitiesError } from '../utils/errors.js';
import { SIMILARITY_WEIGHTS, DEFAULT_DUPLICATE_THRESHOLD } from '../utils/constants.js';

/**
 * Unified search manager providing access to all search types.
 * Also handles compression operations (duplicate detection, entity merging).
 */
export class SearchManager {
  private storage: GraphStorage;
  private basicSearch: BasicSearch;
  private rankedSearch: RankedSearch;
  private booleanSearcher: BooleanSearch;
  private fuzzySearcher: FuzzySearch;
  private searchSuggestions: SearchSuggestions;
  private savedSearchManager: SavedSearchManager;

  constructor(storage: GraphStorage, savedSearchesFilePath: string) {
    this.storage = storage;
    this.basicSearch = new BasicSearch(storage);
    this.rankedSearch = new RankedSearch(storage);
    this.booleanSearcher = new BooleanSearch(storage);
    this.fuzzySearcher = new FuzzySearch(storage);
    this.searchSuggestions = new SearchSuggestions(storage);
    this.savedSearchManager = new SavedSearchManager(savedSearchesFilePath, this.basicSearch);
  }

  // ==================== Basic Search ====================

  /**
   * Perform a simple text-based search across entity names and observations.
   *
   * This is the primary search method that searches through entity names,
   * observations, and types using case-insensitive substring matching.
   * Optionally filter by tags and importance range.
   *
   * @param query - Text to search for (case-insensitive, searches names/observations/types)
   * @param tags - Optional array of tags to filter results (lowercase)
   * @param minImportance - Optional minimum importance value (0-10)
   * @param maxImportance - Optional maximum importance value (0-10)
   * @returns KnowledgeGraph containing matching entities and their relations
   *
   * @example
   * ```typescript
   * const manager = new SearchManager(storage, savedSearchesPath);
   *
   * // Simple text search
   * const results = await manager.searchNodes('Alice');
   *
   * // Search with tag filter
   * const engineeringResults = await manager.searchNodes('project', ['engineering']);
   *
   * // Search with importance range
   * const importantResults = await manager.searchNodes('critical', undefined, 8, 10);
   *
   * // Combined filters
   * const filtered = await manager.searchNodes('bug', ['backend'], 5, 10);
   * ```
   */
  async searchNodes(
    query: string,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number
  ): Promise<KnowledgeGraph> {
    return this.basicSearch.searchNodes(query, tags, minImportance, maxImportance);
  }

  /**
   * Open specific nodes by name.
   *
   * @param names - Array of entity names
   * @returns Knowledge graph with specified entities
   */
  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    return this.basicSearch.openNodes(names);
  }

  /**
   * Search by date range.
   *
   * @param startDate - Optional start date (ISO 8601)
   * @param endDate - Optional end date (ISO 8601)
   * @param entityType - Optional entity type filter
   * @param tags - Optional tags filter
   * @returns Filtered knowledge graph
   */
  async searchByDateRange(
    startDate?: string,
    endDate?: string,
    entityType?: string,
    tags?: string[]
  ): Promise<KnowledgeGraph> {
    return this.basicSearch.searchByDateRange(startDate, endDate, entityType, tags);
  }

  // ==================== Ranked Search ====================

  /**
   * Perform TF-IDF ranked search with relevance scoring.
   *
   * Uses Term Frequency-Inverse Document Frequency algorithm to rank results
   * by relevance to the query. Results are sorted by score (highest first).
   * This is ideal for finding the most relevant entities for a search query.
   *
   * @param query - Search query (analyzed for term frequency)
   * @param tags - Optional array of tags to filter results (lowercase)
   * @param minImportance - Optional minimum importance value (0-10)
   * @param maxImportance - Optional maximum importance value (0-10)
   * @param limit - Maximum number of results to return (default: 50, max: 200)
   * @returns Array of SearchResult objects sorted by relevance score (descending)
   *
   * @example
   * ```typescript
   * const manager = new SearchManager(storage, savedSearchesPath);
   *
   * // Basic ranked search
   * const results = await manager.searchNodesRanked('machine learning algorithms');
   * results.forEach(r => {
   *   console.log(`${r.entity.name} (score: ${r.score})`);
   * });
   *
   * // Limit to top 10 most relevant results
   * const top10 = await manager.searchNodesRanked('database optimization', undefined, undefined, undefined, 10);
   *
   * // Ranked search with filters
   * const relevantImportant = await manager.searchNodesRanked(
   *   'security vulnerability',
   *   ['security', 'critical'],
   *   8,
   *   10,
   *   20
   * );
   * ```
   */
  async searchNodesRanked(
    query: string,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number,
    limit?: number
  ): Promise<SearchResult[]> {
    return this.rankedSearch.searchNodesRanked(query, tags, minImportance, maxImportance, limit);
  }

  // ==================== Boolean Search ====================

  /**
   * Perform boolean search with AND, OR, NOT operators.
   *
   * Supports complex boolean logic for precise search queries.
   * Use AND/OR/NOT operators (case-insensitive) to combine search terms.
   * Parentheses are supported for grouping.
   *
   * @param query - Boolean query string (e.g., "alice AND bob", "frontend OR backend NOT legacy")
   * @param tags - Optional array of tags to filter results (lowercase)
   * @param minImportance - Optional minimum importance value (0-10)
   * @param maxImportance - Optional maximum importance value (0-10)
   * @returns KnowledgeGraph containing entities matching the boolean expression
   *
   * @example
   * ```typescript
   * const manager = new SearchManager(storage, savedSearchesPath);
   *
   * // AND operator - entities matching all terms
   * const both = await manager.booleanSearch('database AND performance');
   *
   * // OR operator - entities matching any term
   * const either = await manager.booleanSearch('frontend OR backend');
   *
   * // NOT operator - exclude terms
   * const excluding = await manager.booleanSearch('API NOT deprecated');
   *
   * // Complex queries with grouping
   * const complex = await manager.booleanSearch('(react OR vue) AND (component OR hook) NOT legacy');
   * ```
   */
  async booleanSearch(
    query: string,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number
  ): Promise<KnowledgeGraph> {
    return this.booleanSearcher.booleanSearch(query, tags, minImportance, maxImportance);
  }

  // ==================== Fuzzy Search ====================

  /**
   * Perform fuzzy search with typo tolerance.
   *
   * Uses Levenshtein distance to find entities that approximately match the query,
   * making it ideal for handling typos and variations in spelling.
   * Higher threshold values require closer matches.
   *
   * @param query - Search query (will match approximate spellings)
   * @param threshold - Similarity threshold from 0.0 (very lenient) to 1.0 (exact match). Default: 0.7
   * @param tags - Optional array of tags to filter results (lowercase)
   * @param minImportance - Optional minimum importance value (0-10)
   * @param maxImportance - Optional maximum importance value (0-10)
   * @returns KnowledgeGraph containing entities with similar names/observations
   *
   * @example
   * ```typescript
   * const manager = new SearchManager(storage, savedSearchesPath);
   *
   * // Find entities even with typos
   * const results = await manager.fuzzySearch('databse'); // Will match "database"
   *
   * // Adjust threshold for strictness
   * const strict = await manager.fuzzySearch('optmization', 0.9); // Requires very close match
   * const lenient = await manager.fuzzySearch('optmization', 0.6); // More tolerant of differences
   *
   * // Fuzzy search with filters
   * const filtered = await manager.fuzzySearch('secrity', 0.7, ['important'], 7, 10);
   * ```
   */
  async fuzzySearch(
    query: string,
    threshold?: number,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number
  ): Promise<KnowledgeGraph> {
    return this.fuzzySearcher.fuzzySearch(query, threshold, tags, minImportance, maxImportance);
  }

  // ==================== Search Suggestions ====================

  /**
   * Get search suggestions for a query.
   *
   * @param query - Search query
   * @param maxSuggestions - Maximum suggestions to return
   * @returns Array of suggested terms
   */
  async getSearchSuggestions(query: string, maxSuggestions?: number): Promise<string[]> {
    return this.searchSuggestions.getSearchSuggestions(query, maxSuggestions);
  }

  // ==================== Saved Searches ====================

  /**
   * Save a search query for later reuse.
   *
   * Saved searches store query parameters and can be re-executed later.
   * The system tracks usage count and last used timestamp automatically.
   *
   * @param search - Search parameters (name, query, and optional filters)
   * @returns Newly created SavedSearch object with metadata
   *
   * @example
   * ```typescript
   * const manager = new SearchManager(storage, savedSearchesPath);
   *
   * // Save a simple search
   * const saved = await manager.saveSearch({
   *   name: 'High Priority Bugs',
   *   query: 'bug',
   *   tags: ['critical'],
   *   minImportance: 8
   * });
   *
   * // Save a complex search
   * await manager.saveSearch({
   *   name: 'Recent Frontend Work',
   *   query: 'component OR hook',
   *   tags: ['frontend', 'react'],
   *   searchType: 'boolean'
   * });
   * ```
   */
  async saveSearch(
    search: Omit<SavedSearch, 'createdAt' | 'useCount' | 'lastUsed'>
  ): Promise<SavedSearch> {
    return this.savedSearchManager.saveSearch(search);
  }

  /**
   * List all saved searches.
   *
   * @returns Array of saved searches
   */
  async listSavedSearches(): Promise<SavedSearch[]> {
    return this.savedSearchManager.listSavedSearches();
  }

  /**
   * Get a saved search by name.
   *
   * @param name - Search name
   * @returns Saved search or null
   */
  async getSavedSearch(name: string): Promise<SavedSearch | null> {
    return this.savedSearchManager.getSavedSearch(name);
  }

  /**
   * Execute a saved search by name.
   *
   * Runs a previously saved search with its stored parameters.
   * Automatically updates the search's useCount and lastUsed timestamp.
   *
   * @param name - The unique name of the saved search to execute
   * @returns KnowledgeGraph containing the search results
   * @throws Error if saved search not found
   *
   * @example
   * ```typescript
   * const manager = new SearchManager(storage, savedSearchesPath);
   *
   * // Execute a saved search
   * const results = await manager.executeSavedSearch('High Priority Bugs');
   * console.log(`Found ${results.entities.length} high priority bugs`);
   *
   * // Handle missing saved search
   * try {
   *   await manager.executeSavedSearch('NonExistent');
   * } catch (error) {
   *   console.error('Search not found');
   * }
   * ```
   */
  async executeSavedSearch(name: string): Promise<KnowledgeGraph> {
    return this.savedSearchManager.executeSavedSearch(name);
  }

  /**
   * Delete a saved search.
   *
   * @param name - Search name
   * @returns True if deleted
   */
  async deleteSavedSearch(name: string): Promise<boolean> {
    return this.savedSearchManager.deleteSavedSearch(name);
  }

  /**
   * Update a saved search.
   *
   * @param name - Search name
   * @param updates - Fields to update
   * @returns Updated saved search
   */
  async updateSavedSearch(
    name: string,
    updates: Partial<Omit<SavedSearch, 'name' | 'createdAt' | 'useCount' | 'lastUsed'>>
  ): Promise<SavedSearch> {
    return this.savedSearchManager.updateSavedSearch(name, updates);
  }

  // ==================== Compression Operations ====================

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

    const graph = await this.storage.getGraphForMutation();
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
        // Count total observations across all entities in group BEFORE merging
        const preGraph = await this.storage.loadGraph();
        let totalObservationsBefore = 0;
        for (const name of group) {
          const entity = preGraph.entities.find(e => e.name === name);
          if (entity) {
            totalObservationsBefore += entity.observations.length;
          }
        }

        const mergedEntity = await this.mergeEntities(group);

        // Count unique observations AFTER merging (deduplicated)
        const observationsAfter = mergedEntity.observations.length;

        // The difference is the number of duplicate observations removed
        result.observationsCompressed += totalObservationsBefore - observationsAfter;

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

    return result;
  }

  // ==================== Analytics Operations ====================

  /**
   * Validate the knowledge graph structure and data integrity.
   *
   * Checks for:
   * - Orphaned relations (pointing to non-existent entities)
   * - Duplicate entity names
   * - Invalid entity data (missing name/type, invalid observations)
   * - Isolated entities (no relations)
   * - Empty observations
   * - Missing metadata (createdAt, lastModified)
   *
   * @returns Validation report with errors, warnings, and summary
   */
  async validateGraph(): Promise<ValidationReport> {
    const graph = await this.storage.loadGraph();
    const issues: ValidationIssue[] = [];
    const warnings: ValidationWarning[] = [];

    // Create a set of all entity names for fast lookup
    const entityNames = new Set(graph.entities.map(e => e.name));

    // Check for orphaned relations (relations pointing to non-existent entities)
    for (const relation of graph.relations) {
      if (!entityNames.has(relation.from)) {
        issues.push({
          type: 'orphaned_relation',
          message: `Relation has non-existent source entity: "${relation.from}"`,
          details: { relation, missingEntity: relation.from },
        });
      }
      if (!entityNames.has(relation.to)) {
        issues.push({
          type: 'orphaned_relation',
          message: `Relation has non-existent target entity: "${relation.to}"`,
          details: { relation, missingEntity: relation.to },
        });
      }
    }

    // Check for duplicate entity names
    const entityNameCounts = new Map<string, number>();
    for (const entity of graph.entities) {
      const count = entityNameCounts.get(entity.name) || 0;
      entityNameCounts.set(entity.name, count + 1);
    }
    for (const [name, count] of entityNameCounts.entries()) {
      if (count > 1) {
        issues.push({
          type: 'duplicate_entity',
          message: `Duplicate entity name found: "${name}" (${count} instances)`,
          details: { entityName: name, count },
        });
      }
    }

    // Check for entities with invalid data
    for (const entity of graph.entities) {
      if (!entity.name || entity.name.trim() === '') {
        issues.push({
          type: 'invalid_data',
          message: 'Entity has empty or missing name',
          details: { entity },
        });
      }
      if (!entity.entityType || entity.entityType.trim() === '') {
        issues.push({
          type: 'invalid_data',
          message: `Entity "${entity.name}" has empty or missing entityType`,
          details: { entity },
        });
      }
      if (!Array.isArray(entity.observations)) {
        issues.push({
          type: 'invalid_data',
          message: `Entity "${entity.name}" has invalid observations (not an array)`,
          details: { entity },
        });
      }
    }

    // Warnings: Check for isolated entities (no relations)
    const entitiesInRelations = new Set<string>();
    for (const relation of graph.relations) {
      entitiesInRelations.add(relation.from);
      entitiesInRelations.add(relation.to);
    }
    for (const entity of graph.entities) {
      if (!entitiesInRelations.has(entity.name) && graph.relations.length > 0) {
        warnings.push({
          type: 'isolated_entity',
          message: `Entity "${entity.name}" has no relations to other entities`,
          details: { entityName: entity.name },
        });
      }
    }

    // Warnings: Check for entities with empty observations
    for (const entity of graph.entities) {
      if (entity.observations.length === 0) {
        warnings.push({
          type: 'empty_observations',
          message: `Entity "${entity.name}" has no observations`,
          details: { entityName: entity.name },
        });
      }
    }

    // Warnings: Check for missing metadata (createdAt, lastModified)
    for (const entity of graph.entities) {
      if (!entity.createdAt) {
        warnings.push({
          type: 'missing_metadata',
          message: `Entity "${entity.name}" is missing createdAt timestamp`,
          details: { entityName: entity.name, field: 'createdAt' },
        });
      }
      if (!entity.lastModified) {
        warnings.push({
          type: 'missing_metadata',
          message: `Entity "${entity.name}" is missing lastModified timestamp`,
          details: { entityName: entity.name, field: 'lastModified' },
        });
      }
    }

    // Count specific issues
    const orphanedRelationsCount = issues.filter(e => e.type === 'orphaned_relation').length;
    const entitiesWithoutRelationsCount = warnings.filter(
      w => w.type === 'isolated_entity'
    ).length;

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      summary: {
        totalErrors: issues.length,
        totalWarnings: warnings.length,
        orphanedRelationsCount,
        entitiesWithoutRelationsCount,
      },
    };
  }

  /**
   * Get comprehensive statistics about the knowledge graph.
   *
   * Provides metrics including:
   * - Total counts of entities and relations
   * - Entity and relation type distributions
   * - Oldest and newest entities/relations
   * - Date ranges for entities and relations
   *
   * @returns Graph statistics object
   */
  async getGraphStats(): Promise<GraphStats> {
    const graph = await this.storage.loadGraph();

    // Calculate entity type counts
    const entityTypesCounts: Record<string, number> = {};
    graph.entities.forEach(e => {
      entityTypesCounts[e.entityType] = (entityTypesCounts[e.entityType] || 0) + 1;
    });

    // Calculate relation type counts
    const relationTypesCounts: Record<string, number> = {};
    graph.relations.forEach(r => {
      relationTypesCounts[r.relationType] = (relationTypesCounts[r.relationType] || 0) + 1;
    });

    // Find oldest and newest entities
    let oldestEntity: { name: string; date: string } | undefined;
    let newestEntity: { name: string; date: string } | undefined;
    let earliestEntityDate: Date | null = null;
    let latestEntityDate: Date | null = null;

    graph.entities.forEach(e => {
      const date = new Date(e.createdAt || '');
      if (!earliestEntityDate || date < earliestEntityDate) {
        earliestEntityDate = date;
        oldestEntity = { name: e.name, date: e.createdAt || '' };
      }
      if (!latestEntityDate || date > latestEntityDate) {
        latestEntityDate = date;
        newestEntity = { name: e.name, date: e.createdAt || '' };
      }
    });

    // Find oldest and newest relations
    let oldestRelation: { from: string; to: string; relationType: string; date: string } | undefined;
    let newestRelation: { from: string; to: string; relationType: string; date: string } | undefined;
    let earliestRelationDate: Date | null = null;
    let latestRelationDate: Date | null = null;

    graph.relations.forEach(r => {
      const date = new Date(r.createdAt || '');
      if (!earliestRelationDate || date < earliestRelationDate) {
        earliestRelationDate = date;
        oldestRelation = { from: r.from, to: r.to, relationType: r.relationType, date: r.createdAt || '' };
      }
      if (!latestRelationDate || date > latestRelationDate) {
        latestRelationDate = date;
        newestRelation = { from: r.from, to: r.to, relationType: r.relationType, date: r.createdAt || '' };
      }
    });

    return {
      totalEntities: graph.entities.length,
      totalRelations: graph.relations.length,
      entityTypesCounts,
      relationTypesCounts,
      oldestEntity,
      newestEntity,
      oldestRelation,
      newestRelation,
      entityDateRange: earliestEntityDate && latestEntityDate ? {
        earliest: (earliestEntityDate as Date).toISOString(),
        latest: (latestEntityDate as Date).toISOString()
      } : undefined,
      relationDateRange: earliestRelationDate && latestRelationDate ? {
        earliest: (earliestRelationDate as Date).toISOString(),
        latest: (latestRelationDate as Date).toISOString()
      } : undefined,
    };
  }
}
