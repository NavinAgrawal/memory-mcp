/**
 * Knowledge Graph Manager
 *
 * Central manager coordinating all knowledge graph operations.
 * Delegates to specialized managers for different concerns.
 *
 * @module core/KnowledgeGraphManager
 */

import path from 'path';
import {
  DEFAULT_DUPLICATE_THRESHOLD,
  SEARCH_LIMITS
} from '../utils/constants.js';
import { GraphStorage } from './GraphStorage.js';
import { EntityManager } from './EntityManager.js';
import { RelationManager } from './RelationManager.js';
import { SearchManager } from '../search/SearchManager.js';
import { IOManager } from '../features/IOManager.js';
import { TagManager } from '../features/TagManager.js';
import type {
  Entity,
  Relation,
  KnowledgeGraph,
  ReadonlyKnowledgeGraph,
  GraphStats,
  ValidationReport,
  SavedSearch,
  TagAlias,
  SearchResult,
  ImportResult,
  CompressionResult,
} from '../types/index.js';

/**
 * Central manager coordinating all knowledge graph operations.
 *
 * This class serves as the main facade for interacting with the knowledge graph,
 * delegating to specialized managers for different concerns:
 * - EntityManager: Entity CRUD, observations, tags, hierarchy, and archive operations
 * - RelationManager: Relation CRUD operations
 * - SearchManager: All search operations + compression + analytics
 * - IOManager: Import, export, and backup operations (Sprint 11.4)
 * - TagManager: Tag alias management
 */
export class KnowledgeGraphManager {
  private readonly savedSearchesFilePath: string;
  private readonly tagAliasesFilePath: string;
  private readonly storage: GraphStorage;

  // Lazy-initialized managers for improved startup performance
  private _entityManager?: EntityManager;
  private _relationManager?: RelationManager;
  private _searchManager?: SearchManager;
  private _ioManager?: IOManager;
  private _tagManager?: TagManager;

  constructor(memoryFilePath: string) {
    // Saved searches file is stored alongside the memory file
    const dir = path.dirname(memoryFilePath);
    const basename = path.basename(memoryFilePath, path.extname(memoryFilePath));
    this.savedSearchesFilePath = path.join(dir, `${basename}-saved-searches.jsonl`);
    this.tagAliasesFilePath = path.join(dir, `${basename}-tag-aliases.jsonl`);
    this.storage = new GraphStorage(memoryFilePath);
    // Managers are now initialized lazily via getters
  }

  // Lazy getters for managers - instantiated on first access
  private get entityManager(): EntityManager {
    return (this._entityManager ??= new EntityManager(this.storage));
  }

  private get relationManager(): RelationManager {
    return (this._relationManager ??= new RelationManager(this.storage));
  }

  private get searchManager(): SearchManager {
    return (this._searchManager ??= new SearchManager(this.storage, this.savedSearchesFilePath));
  }

  private get ioManager(): IOManager {
    return (this._ioManager ??= new IOManager(this.storage));
  }

  private get tagManager(): TagManager {
    return (this._tagManager ??= new TagManager(this.tagAliasesFilePath));
  }

  private async loadGraph(): Promise<ReadonlyKnowledgeGraph> {
    return this.storage.loadGraph();
  }

  /**
   * Phase 4: Create multiple entities in a single batch operation.
   * Batch optimization: All entities are processed and saved in a single saveGraph() call,
   * minimizing disk I/O. This is significantly more efficient than creating entities one at a time.
   */
  async createEntities(entities: Entity[]): Promise<Entity[]> {
    return this.entityManager.createEntities(entities);
  }

  /**
   * Phase 4: Create multiple relations in a single batch operation.
   * Batch optimization: All relations are processed and saved in a single saveGraph() call,
   * minimizing disk I/O. This is significantly more efficient than creating relations one at a time.
   */
  async createRelations(relations: Relation[]): Promise<Relation[]> {
    return this.relationManager.createRelations(relations);
  }

  async addObservations(observations: { entityName: string; contents: string[] }[]): Promise<{ entityName: string; addedObservations: string[] }[]> {
    return this.entityManager.addObservations(observations);
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    return this.entityManager.deleteEntities(entityNames);
  }

  async deleteObservations(deletions: { entityName: string; observations: string[] }[]): Promise<void> {
    return this.entityManager.deleteObservations(deletions);
  }

  async deleteRelations(relations: Relation[]): Promise<void> {
    return this.relationManager.deleteRelations(relations);
  }

  async readGraph(): Promise<ReadonlyKnowledgeGraph> {
    return this.loadGraph();
  }

  // Phase 3: Enhanced search function with tags and importance filters
  async searchNodes(
    query: string,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number
  ): Promise<KnowledgeGraph> {
    return this.searchManager.searchNodes(query, tags, minImportance, maxImportance);
  }

  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    return this.searchManager.openNodes(names);
  }

  // Phase 3: Enhanced searchByDateRange with tags filter
  async searchByDateRange(
    startDate?: string,
    endDate?: string,
    entityType?: string,
    tags?: string[]
  ): Promise<KnowledgeGraph> {
    return this.searchManager.searchByDateRange(startDate, endDate, entityType, tags);
  }

  async getGraphStats(): Promise<GraphStats> {
    return this.searchManager.getGraphStats();
  }
  // Phase 3: Add tags to an entity
  async addTags(entityName: string, tags: string[]): Promise<{ entityName: string; addedTags: string[] }> {
    return this.entityManager.addTags(entityName, tags);
  }

  // Phase 3: Remove tags from an entity
  async removeTags(entityName: string, tags: string[]): Promise<{ entityName: string; removedTags: string[] }> {
    return this.entityManager.removeTags(entityName, tags);
  }

  // Phase 3: Set importance level for an entity
  async setImportance(entityName: string, importance: number): Promise<{ entityName: string; importance: number }> {
    return this.entityManager.setImportance(entityName, importance);
  }

  // Tier 0 B5: Bulk tag operations for efficient tag management
  /**
   * Add tags to multiple entities in a single operation
   */
  async addTagsToMultipleEntities(entityNames: string[], tags: string[]): Promise<{ entityName: string; addedTags: string[] }[]> {
    return this.entityManager.addTagsToMultipleEntities(entityNames, tags);
  }

  /**
   * Replace a tag with a new tag across all entities (rename tag)
   */
  async replaceTag(oldTag: string, newTag: string): Promise<{ affectedEntities: string[]; count: number }> {
    return this.entityManager.replaceTag(oldTag, newTag);
  }

  /**
   * Merge two tags into one (combine tag1 and tag2 into targetTag)
   */
  async mergeTags(tag1: string, tag2: string, targetTag: string): Promise<{ affectedEntities: string[]; count: number }> {
    return this.entityManager.mergeTags(tag1, tag2, targetTag);
  }

  // Tier 0 A1: Graph validation for data integrity
  /**
   * Validate the knowledge graph for integrity issues and provide a detailed report
   */
  async validateGraph(): Promise<ValidationReport> {
    return this.searchManager.validateGraph();
  }

  // Tier 0 C4: Saved searches for efficient query management
  /**
   * Save a search query for later reuse
   */
  async saveSearch(search: Omit<SavedSearch, 'createdAt' | 'useCount' | 'lastUsed'>): Promise<SavedSearch> {
    return this.searchManager.saveSearch(search);
  }

  /**
   * List all saved searches
   */
  async listSavedSearches(): Promise<SavedSearch[]> {
    return this.searchManager.listSavedSearches();
  }

  /**
   * Get a specific saved search by name
   */
  async getSavedSearch(name: string): Promise<SavedSearch | null> {
    return this.searchManager.getSavedSearch(name);
  }

  /**
   * Execute a saved search by name
   */
  async executeSavedSearch(name: string): Promise<KnowledgeGraph> {
    return this.searchManager.executeSavedSearch(name);
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(name: string): Promise<boolean> {
    return this.searchManager.deleteSavedSearch(name);
  }

  /**
   * Update a saved search
   */
  async updateSavedSearch(name: string, updates: Partial<Omit<SavedSearch, 'name' | 'createdAt' | 'useCount' | 'lastUsed'>>): Promise<SavedSearch> {
    return this.searchManager.updateSavedSearch(name, updates);
  }

  /**
   * Fuzzy search for entities with typo tolerance
   * @param query - Search query
   * @param threshold - Similarity threshold (0.0 to 1.0), default 0.7
   * @param tags - Optional tags filter
   * @param minImportance - Optional minimum importance
   * @param maxImportance - Optional maximum importance
   * @returns Filtered knowledge graph with fuzzy matches
   */
  async fuzzySearch(
    query: string,
    threshold: number = 0.7,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number
  ): Promise<KnowledgeGraph> {
    return this.searchManager.fuzzySearch(query, threshold, tags, minImportance, maxImportance);
  }

  /**
   * Get "did you mean?" suggestions for a query
   * @param query - The search query
   * @param maxSuggestions - Maximum number of suggestions to return
   * @returns Array of suggested entity/type names
   */
  async getSearchSuggestions(query: string, maxSuggestions: number = 5): Promise<string[]> {
    return this.searchManager.getSearchSuggestions(query, maxSuggestions);
  }

  /**
   * Search nodes with TF-IDF ranking for relevance scoring
   * @param query - Search query
   * @param tags - Optional tags filter
   * @param minImportance - Optional minimum importance
   * @param maxImportance - Optional maximum importance
   * @param limit - Optional maximum number of results (default 50)
   * @returns Array of search results with scores, sorted by relevance
   */
  async searchNodesRanked(
    query: string,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number,
    limit: number = SEARCH_LIMITS.DEFAULT
  ): Promise<SearchResult[]> {
    return this.searchManager.searchNodesRanked(query, tags, minImportance, maxImportance, limit);
  }

  /**
   * Boolean search with support for AND, OR, NOT operators and field-specific queries
   * @param query - Boolean query string (e.g., "name:Alice AND (type:person OR observation:programming)")
   * @param tags - Optional tags filter
   * @param minImportance - Optional minimum importance
   * @param maxImportance - Optional maximum importance
   * @returns Filtered knowledge graph matching the boolean query
   */
  async booleanSearch(
    query: string,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number
  ): Promise<KnowledgeGraph> {
    return this.searchManager.booleanSearch(query, tags, minImportance, maxImportance);
  }

  // Phase 2: Hierarchical nesting - hierarchy navigation methods
  /**
   * Set the parent of an entity (creates hierarchy relationship)
   * @param entityName - Name of the entity to set parent for
   * @param parentName - Name of the parent entity (or null to remove parent)
   * @returns Updated entity
   */
  async setEntityParent(entityName: string, parentName: string | null): Promise<Entity> {
    return this.entityManager.setEntityParent(entityName, parentName);
  }

  /**
   * Get the immediate children of an entity
   */
  async getChildren(entityName: string): Promise<Entity[]> {
    return this.entityManager.getChildren(entityName);
  }

  /**
   * Get the parent of an entity
   */
  async getParent(entityName: string): Promise<Entity | null> {
    return this.entityManager.getParent(entityName);
  }

  /**
   * Get all ancestors of an entity (parent, grandparent, etc.)
   */
  async getAncestors(entityName: string): Promise<Entity[]> {
    return this.entityManager.getAncestors(entityName);
  }

  /**
   * Get all descendants of an entity (children, grandchildren, etc.)
   */
  async getDescendants(entityName: string): Promise<Entity[]> {
    return this.entityManager.getDescendants(entityName);
  }

  /**
   * Get the entire subtree rooted at an entity (entity + all descendants)
   */
  async getSubtree(entityName: string): Promise<KnowledgeGraph> {
    return this.entityManager.getSubtree(entityName);
  }

  /**
   * Get root entities (entities with no parent)
   */
  async getRootEntities(): Promise<Entity[]> {
    return this.entityManager.getRootEntities();
  }

  /**
   * Get the depth of an entity in the hierarchy (0 for root, 1 for child of root, etc.)
   */
  async getEntityDepth(entityName: string): Promise<number> {
    return this.entityManager.getEntityDepth(entityName);
  }

  /**
   * Move an entity to a new parent (maintaining its descendants)
   */
  async moveEntity(entityName: string, newParentName: string | null): Promise<Entity> {
    return this.entityManager.moveEntity(entityName, newParentName);
  }

  // Phase 3: Memory compression - duplicate detection and merging
  /**
   * Find duplicate entities in the graph based on similarity threshold
   * @param threshold - Similarity threshold (0.0 to 1.0), default 0.8
   * @returns Array of duplicate groups (each group has similar entities)
   */
  async findDuplicates(threshold: number = DEFAULT_DUPLICATE_THRESHOLD): Promise<string[][]> {
    return this.searchManager.findDuplicates(threshold);
  }

  /**
   * Merge a group of entities into a single entity
   * @param entityNames - Names of entities to merge (first one is kept)
   * @param targetName - Optional new name for merged entity (default: first entity name)
   * @returns The merged entity
   */
  async mergeEntities(entityNames: string[], targetName?: string): Promise<Entity> {
    return this.searchManager.mergeEntities(entityNames, targetName);
  }

  /**
   * Compress the knowledge graph by finding and merging duplicates
   * @param threshold - Similarity threshold for duplicate detection (0.0 to 1.0)
   * @param dryRun - If true, only report what would be compressed without applying changes
   * @returns Compression result with statistics
   */
  async compressGraph(threshold: number = 0.8, dryRun: boolean = false): Promise<CompressionResult> {
    return this.searchManager.compressGraph(threshold, dryRun);
  }

  // Phase 4: Memory archiving system
  /**
   * Archive old or low-importance entities to a separate storage
   * @param criteria - Criteria for archiving (age, importance, tags)
   * @param dryRun - If true, preview what would be archived
   * @returns Number of entities archived
   */
  async archiveEntities(
    criteria: {
      olderThan?: string;  // ISO date
      importanceLessThan?: number;
      tags?: string[];
    },
    dryRun: boolean = false
  ): Promise<{ archived: number; entityNames: string[] }> {
    return this.entityManager.archiveEntities(criteria, dryRun);
  }

  // Tier 0 B2: Tag aliases for synonym management
  /**
   * Resolve a tag through aliases to get its canonical form
   * @param tag - Tag to resolve (can be alias or canonical)
   * @returns Canonical tag name
   */
  async resolveTag(tag: string): Promise<string> {
    return this.tagManager.resolveTag(tag);
  }

  /**
   * Add a tag alias (synonym mapping)
   * @param alias - The alias/synonym
   * @param canonical - The canonical (main) tag name
   * @param description - Optional description of the alias
   */
  async addTagAlias(alias: string, canonical: string, description?: string): Promise<TagAlias> {
    return this.tagManager.addTagAlias(alias, canonical, description);
  }

  /**
   * List all tag aliases
   */
  async listTagAliases(): Promise<TagAlias[]> {
    return this.tagManager.listTagAliases();
  }

  /**
   * Remove a tag alias
   */
  async removeTagAlias(alias: string): Promise<boolean> {
    return this.tagManager.removeTagAlias(alias);
  }

  /**
   * Get all aliases for a canonical tag
   */
  async getAliasesForTag(canonicalTag: string): Promise<string[]> {
    return this.tagManager.getAliasesForTag(canonicalTag);
  }

  // Phase 4 & Tier 0 D1: Export graph in various formats
  /**
   * Export the knowledge graph in the specified format with optional filtering.
   * Supports JSON, CSV, GraphML, GEXF, DOT, Markdown, and Mermaid formats.
   *
   * @param format - Export format: 'json', 'csv', 'graphml', 'gexf', 'dot', 'markdown', 'mermaid'
   * @param filter - Optional filter object with same structure as searchByDateRange
   * @returns Exported graph data as a formatted string
   */
  async exportGraph(
    format: 'json' | 'csv' | 'graphml' | 'gexf' | 'dot' | 'markdown' | 'mermaid',
    filter?: {
      startDate?: string;
      endDate?: string;
      entityType?: string;
      tags?: string[];
    }
  ): Promise<string> {
    // Get filtered or full graph based on filter parameter
    let graph: ReadonlyKnowledgeGraph;
    if (filter) {
      graph = await this.searchByDateRange(
        filter.startDate,
        filter.endDate,
        filter.entityType,
        filter.tags
      );
    } else {
      graph = await this.loadGraph();
    }

    return this.ioManager.exportGraph(graph, format);
  }

  // Tier 0 D2: Import capabilities with merge strategies
  /**
   * Import knowledge graph from various formats
   * @param format - Import format: 'json', 'csv', or 'graphml'
   * @param data - The import data as a string
   * @param mergeStrategy - How to handle conflicts: 'replace', 'skip', 'merge', 'fail'
   * @param dryRun - If true, preview changes without applying them
   * @returns Import result with statistics
   */
  async importGraph(
    format: 'json' | 'csv' | 'graphml',
    data: string,
    mergeStrategy: 'replace' | 'skip' | 'merge' | 'fail' = 'skip',
    dryRun: boolean = false
  ): Promise<ImportResult> {
    return this.ioManager.importGraph(format, data, mergeStrategy, dryRun);
  }
}
