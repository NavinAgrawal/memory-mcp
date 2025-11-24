/**
 * Knowledge Graph Manager
 *
 * Main orchestrator that coordinates all knowledge graph operations.
 *
 * @module core/KnowledgeGraphManager
 */

import * as path from 'path';
import { GraphStorage } from './GraphStorage.js';
import { EntityManager } from './EntityManager.js';
import { RelationManager } from './RelationManager.js';
import { ObservationManager } from './ObservationManager.js';
import { SearchManager } from '../search/SearchManager.js';
import { BasicSearch } from '../search/BasicSearch.js';
import { TagManager } from '../features/TagManager.js';
import { HierarchyManager } from '../features/HierarchyManager.js';
import { AnalyticsManager } from '../features/AnalyticsManager.js';
import { CompressionManager } from '../features/CompressionManager.js';
import { ArchiveManager } from '../features/ArchiveManager.js';
import { ExportManager } from '../features/ExportManager.js';
import { ImportManager } from '../features/ImportManager.js';
import { ImportExportManager } from '../features/ImportExportManager.js';

/**
 * Main orchestrator for all knowledge graph operations.
 *
 * Coordinates between core managers, search, features, and import/export.
 */
export class KnowledgeGraphManager {
  // Core storage and managers
  private storage: GraphStorage;
  private entityManager: EntityManager;
  private relationManager: RelationManager;
  private observationManager: ObservationManager;

  // Search
  private searchManager: SearchManager;

  // Features
  private tagManager: TagManager;
  private hierarchyManager: HierarchyManager;
  private analyticsManager: AnalyticsManager;
  private compressionManager: CompressionManager;
  private archiveManager: ArchiveManager;

  // Import/Export
  private importExportManager: ImportExportManager;

  constructor(memoryFilePath: string) {
    // Initialize storage
    this.storage = new GraphStorage(memoryFilePath);

    // Initialize core managers
    this.entityManager = new EntityManager(this.storage);
    this.relationManager = new RelationManager(this.storage);
    this.observationManager = new ObservationManager(this.storage);

    // Initialize search with saved searches file
    const dir = path.dirname(memoryFilePath);
    const basename = path.basename(memoryFilePath, path.extname(memoryFilePath));
    const savedSearchesFilePath = path.join(dir, `${basename}-saved-searches.jsonl`);
    this.searchManager = new SearchManager(this.storage, savedSearchesFilePath);

    // Initialize feature managers
    const tagAliasesFilePath = path.join(dir, `${basename}-tag-aliases.jsonl`);
    this.tagManager = new TagManager(tagAliasesFilePath);
    this.hierarchyManager = new HierarchyManager(this.storage);
    this.analyticsManager = new AnalyticsManager(this.storage);
    this.compressionManager = new CompressionManager(this.storage);
    this.archiveManager = new ArchiveManager(this.storage);

    // Initialize import/export
    const exportManager = new ExportManager();
    const importManager = new ImportManager(this.storage);
    // Create BasicSearch instance for import/export filtering
    const basicSearch = new BasicSearch(this.storage);
    this.importExportManager = new ImportExportManager(
      exportManager,
      importManager,
      basicSearch
    );
  }

  // ==================== Entity Operations ====================

  /**
   * Access entity management operations.
   *
   * Provides CRUD operations for entities including:
   * - createEntities(entities): Create new entities
   * - getEntity(name): Retrieve entity by name
   * - updateEntity(name, updates): Update entity fields
   * - deleteEntities(names): Delete entities
   *
   * @returns EntityManager instance
   * @example
   * ```typescript
   * const entity = await manager.entities.getEntity('Alice');
   * await manager.entities.updateEntity('Alice', { importance: 8 });
   * ```
   */
  get entities() {
    return this.entityManager;
  }

  // ==================== Relation Operations ====================

  /**
   * Access relation management operations.
   *
   * Provides CRUD operations for relations including:
   * - createRelations(relations): Create new relations
   * - getRelation(from, to, type): Retrieve specific relation
   * - deleteRelations(relations): Delete relations
   * - getRelationsForEntity(name): Get all relations for an entity
   *
   * @returns RelationManager instance
   * @example
   * ```typescript
   * await manager.relations.createRelations([
   *   { from: 'Alice', to: 'Bob', relationType: 'knows' }
   * ]);
   * ```
   */
  get relations() {
    return this.relationManager;
  }

  // ==================== Observation Operations ====================

  /**
   * Access observation management operations.
   *
   * Provides operations for managing observations on entities:
   * - addObservations(observations): Add observations to entities
   * - deleteObservations(deletions): Remove observations from entities
   *
   * @returns ObservationManager instance
   * @example
   * ```typescript
   * await manager.observations.addObservations([
   *   { entityName: 'Alice', contents: ['likes programming', 'works at startup'] }
   * ]);
   * ```
   */
  get observations() {
    return this.observationManager;
  }

  // ==================== Search Operations ====================

  /**
   * Access all search operations.
   *
   * Provides multiple search types:
   * - searchNodes(query): Basic text search
   * - searchNodesRanked(query): TF-IDF ranked search
   * - booleanSearch(query): Boolean search with AND/OR/NOT
   * - fuzzySearch(query): Fuzzy search with typo tolerance
   * - searchByDateRange(start, end): Search by date range
   * - getSearchSuggestions(query): Get search suggestions
   *
   * @returns SearchManager instance
   * @example
   * ```typescript
   * const results = await manager.search.searchNodesRanked('programming', undefined, undefined, undefined, 10);
   * ```
   */
  get search() {
    return this.searchManager;
  }

  // ==================== Tag Operations ====================

  /**
   * Access tag management operations.
   *
   * Provides tag operations including:
   * - addTags(entityName, tags): Add tags to entity
   * - removeTags(entityName, tags): Remove tags from entity
   * - replaceTag(old, new): Replace tag across all entities
   * - mergeTags(tag1, tag2, target): Merge two tags
   * - addTagAlias(alias, canonical): Create tag alias
   * - resolveTag(tag): Resolve tag alias to canonical
   *
   * @returns TagManager instance
   * @example
   * ```typescript
   * await manager.tags.addTags('Alice', ['developer', 'javascript']);
   * const canonical = await manager.tags.resolveTag('js'); // returns 'javascript'
   * ```
   */
  get tags() {
    return this.tagManager;
  }

  // ==================== Hierarchy Operations ====================

  /**
   * Access hierarchical relationship operations.
   *
   * Provides parent-child hierarchy management:
   * - setEntityParent(entity, parent): Set parent for entity
   * - getChildren(entity): Get immediate children
   * - getParent(entity): Get parent entity
   * - getAncestors(entity): Get all ancestors
   * - getDescendants(entity): Get all descendants
   * - getSubtree(entity): Get entire subtree
   * - getRootEntities(): Get all root entities
   *
   * @returns HierarchyManager instance
   * @example
   * ```typescript
   * await manager.hierarchy.setEntityParent('task-1', 'project-alpha');
   * const children = await manager.hierarchy.getChildren('project-alpha');
   * ```
   */
  get hierarchy() {
    return this.hierarchyManager;
  }

  // ==================== Analytics Operations ====================

  /**
   * Access graph analytics and statistics operations.
   *
   * Provides analytics including:
   * - getGraphStats(): Get comprehensive graph statistics
   * - validateGraph(): Validate graph integrity
   *
   * @returns AnalyticsManager instance
   * @example
   * ```typescript
   * const stats = await manager.analytics.getGraphStats();
   * console.log(`Total entities: ${stats.totalEntities}`);
   * const validation = await manager.analytics.validateGraph();
   * ```
   */
  get analytics() {
    return this.analyticsManager;
  }

  // ==================== Compression Operations ====================

  /**
   * Access graph compression operations.
   *
   * Provides duplicate detection and merging:
   * - findDuplicates(threshold): Find similar entities
   * - mergeEntities(names, target): Merge entities into one
   * - compressGraph(threshold, dryRun): Auto-compress duplicates
   *
   * @returns CompressionManager instance
   * @example
   * ```typescript
   * const duplicates = await manager.compression.findDuplicates(0.8);
   * const result = await manager.compression.compressGraph(0.8, true); // dry run
   * ```
   */
  get compression() {
    return this.compressionManager;
  }

  // ==================== Archive Operations ====================

  /**
   * Access entity archiving operations.
   *
   * Provides archiving based on age, importance, or tags:
   * - archiveEntities(criteria, dryRun): Archive entities matching criteria
   *
   * @returns ArchiveManager instance
   * @example
   * ```typescript
   * const archived = await manager.archive.archiveEntities({
   *   olderThan: '2023-01-01',
   *   importanceLessThan: 3
   * }, true); // dry run
   * ```
   */
  get archive() {
    return this.archiveManager;
  }

  // ==================== Import/Export Operations ====================

  /**
   * Access graph import and export operations.
   *
   * Provides import/export in multiple formats:
   * - exportGraph(format, filter): Export to JSON, CSV, GraphML, GEXF, DOT, Markdown, Mermaid
   * - importGraph(format, data, strategy, dryRun): Import from JSON, CSV, GraphML
   *
   * @returns ImportExportManager instance
   * @example
   * ```typescript
   * const graphml = await manager.importExport.exportGraph('graphml');
   * const result = await manager.importExport.importGraph('json', data, 'merge', true);
   * ```
   */
  get importExport() {
    return this.importExportManager;
  }
}
