/**
 * Manager Context
 *
 * Central context holding all manager instances with lazy initialization.
 * Replaces KnowledgeGraphManager by providing both direct manager access
 * and convenience methods for backward compatibility.
 *
 * @module core/ManagerContext
 */

import path from 'path';
import { GraphStorage } from './GraphStorage.js';
import { EntityManager, type ArchiveCriteria, type ArchiveResult } from './EntityManager.js';
import { RelationManager } from './RelationManager.js';
import { SearchManager } from '../search/SearchManager.js';
import { IOManager } from '../features/IOManager.js';
import { TagManager } from '../features/TagManager.js';
import { DEFAULT_DUPLICATE_THRESHOLD, SEARCH_LIMITS } from '../utils/constants.js';
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
 * Context holding all manager instances with lazy initialization.
 * Provides both direct manager access (for toolHandlers) and convenience
 * methods (for backward compatibility with KnowledgeGraphManager API).
 */
export class ManagerContext {
  readonly storage: GraphStorage;
  private readonly savedSearchesFilePath: string;
  private readonly tagAliasesFilePath: string;

  // Lazy-initialized managers
  private _entityManager?: EntityManager;
  private _relationManager?: RelationManager;
  private _searchManager?: SearchManager;
  private _ioManager?: IOManager;
  private _tagManager?: TagManager;

  constructor(memoryFilePath: string) {
    // Derive paths for saved searches and tag aliases
    const dir = path.dirname(memoryFilePath);
    const basename = path.basename(memoryFilePath, path.extname(memoryFilePath));
    this.savedSearchesFilePath = path.join(dir, `${basename}-saved-searches.jsonl`);
    this.tagAliasesFilePath = path.join(dir, `${basename}-tag-aliases.jsonl`);
    this.storage = new GraphStorage(memoryFilePath);
  }

  // ==================== MANAGER ACCESSORS ====================
  // Use these for direct manager access (preferred in toolHandlers)

  /** EntityManager - Entity CRUD, observations, tags, hierarchy, archive */
  get entityManager(): EntityManager {
    return (this._entityManager ??= new EntityManager(this.storage));
  }

  /** RelationManager - Relation CRUD */
  get relationManager(): RelationManager {
    return (this._relationManager ??= new RelationManager(this.storage));
  }

  /** SearchManager - All search operations + compression + analytics */
  get searchManager(): SearchManager {
    return (this._searchManager ??= new SearchManager(this.storage, this.savedSearchesFilePath));
  }

  /** IOManager - Import, export, and backup operations */
  get ioManager(): IOManager {
    return (this._ioManager ??= new IOManager(this.storage));
  }

  /** TagManager - Tag alias management */
  get tagManager(): TagManager {
    return (this._tagManager ??= new TagManager(this.tagAliasesFilePath));
  }

  // ==================== CONVENIENCE METHODS ====================
  // These maintain backward compatibility with the old KnowledgeGraphManager API

  // Entity operations
  async createEntities(entities: Entity[]): Promise<Entity[]> {
    return this.entityManager.createEntities(entities);
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    return this.entityManager.deleteEntities(entityNames);
  }

  async readGraph(): Promise<ReadonlyKnowledgeGraph> {
    return this.storage.loadGraph();
  }

  // Relation operations
  async createRelations(relations: Relation[]): Promise<Relation[]> {
    return this.relationManager.createRelations(relations);
  }

  async deleteRelations(relations: Relation[]): Promise<void> {
    return this.relationManager.deleteRelations(relations);
  }

  // Observation operations
  async addObservations(observations: { entityName: string; contents: string[] }[]): Promise<{ entityName: string; addedObservations: string[] }[]> {
    return this.entityManager.addObservations(observations);
  }

  async deleteObservations(deletions: { entityName: string; observations: string[] }[]): Promise<void> {
    return this.entityManager.deleteObservations(deletions);
  }

  // Search operations
  async searchNodes(query: string, tags?: string[], minImportance?: number, maxImportance?: number): Promise<KnowledgeGraph> {
    return this.searchManager.searchNodes(query, tags, minImportance, maxImportance);
  }

  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    return this.searchManager.openNodes(names);
  }

  async searchByDateRange(startDate?: string, endDate?: string, entityType?: string, tags?: string[]): Promise<KnowledgeGraph> {
    return this.searchManager.searchByDateRange(startDate, endDate, entityType, tags);
  }

  async searchNodesRanked(query: string, tags?: string[], minImportance?: number, maxImportance?: number, limit: number = SEARCH_LIMITS.DEFAULT): Promise<SearchResult[]> {
    return this.searchManager.searchNodesRanked(query, tags, minImportance, maxImportance, limit);
  }

  async booleanSearch(query: string, tags?: string[], minImportance?: number, maxImportance?: number): Promise<KnowledgeGraph> {
    return this.searchManager.booleanSearch(query, tags, minImportance, maxImportance);
  }

  async fuzzySearch(query: string, threshold: number = 0.7, tags?: string[], minImportance?: number, maxImportance?: number): Promise<KnowledgeGraph> {
    return this.searchManager.fuzzySearch(query, threshold, tags, minImportance, maxImportance);
  }

  async getSearchSuggestions(query: string, maxSuggestions: number = 5): Promise<string[]> {
    return this.searchManager.getSearchSuggestions(query, maxSuggestions);
  }

  // Saved search operations
  async saveSearch(search: Omit<SavedSearch, 'createdAt' | 'useCount' | 'lastUsed'>): Promise<SavedSearch> {
    return this.searchManager.saveSearch(search);
  }

  async listSavedSearches(): Promise<SavedSearch[]> {
    return this.searchManager.listSavedSearches();
  }

  async getSavedSearch(name: string): Promise<SavedSearch | null> {
    return this.searchManager.getSavedSearch(name);
  }

  async executeSavedSearch(name: string): Promise<KnowledgeGraph> {
    return this.searchManager.executeSavedSearch(name);
  }

  async deleteSavedSearch(name: string): Promise<boolean> {
    return this.searchManager.deleteSavedSearch(name);
  }

  async updateSavedSearch(name: string, updates: Partial<Omit<SavedSearch, 'name' | 'createdAt' | 'useCount' | 'lastUsed'>>): Promise<SavedSearch> {
    return this.searchManager.updateSavedSearch(name, updates);
  }

  // Tag operations
  async addTags(entityName: string, tags: string[]): Promise<{ entityName: string; addedTags: string[] }> {
    return this.entityManager.addTags(entityName, tags);
  }

  async removeTags(entityName: string, tags: string[]): Promise<{ entityName: string; removedTags: string[] }> {
    return this.entityManager.removeTags(entityName, tags);
  }

  async setImportance(entityName: string, importance: number): Promise<{ entityName: string; importance: number }> {
    return this.entityManager.setImportance(entityName, importance);
  }

  async addTagsToMultipleEntities(entityNames: string[], tags: string[]): Promise<{ entityName: string; addedTags: string[] }[]> {
    return this.entityManager.addTagsToMultipleEntities(entityNames, tags);
  }

  async replaceTag(oldTag: string, newTag: string): Promise<{ affectedEntities: string[]; count: number }> {
    return this.entityManager.replaceTag(oldTag, newTag);
  }

  async mergeTags(tag1: string, tag2: string, targetTag: string): Promise<{ affectedEntities: string[]; count: number }> {
    return this.entityManager.mergeTags(tag1, tag2, targetTag);
  }

  // Tag alias operations
  async resolveTag(tag: string): Promise<string> {
    return this.tagManager.resolveTag(tag);
  }

  async addTagAlias(alias: string, canonical: string, description?: string): Promise<TagAlias> {
    return this.tagManager.addTagAlias(alias, canonical, description);
  }

  async listTagAliases(): Promise<TagAlias[]> {
    return this.tagManager.listTagAliases();
  }

  async removeTagAlias(alias: string): Promise<boolean> {
    return this.tagManager.removeTagAlias(alias);
  }

  async getAliasesForTag(canonicalTag: string): Promise<string[]> {
    return this.tagManager.getAliasesForTag(canonicalTag);
  }

  // Hierarchy operations
  async setEntityParent(entityName: string, parentName: string | null): Promise<Entity> {
    return this.entityManager.setEntityParent(entityName, parentName);
  }

  async getChildren(entityName: string): Promise<Entity[]> {
    return this.entityManager.getChildren(entityName);
  }

  async getParent(entityName: string): Promise<Entity | null> {
    return this.entityManager.getParent(entityName);
  }

  async getAncestors(entityName: string): Promise<Entity[]> {
    return this.entityManager.getAncestors(entityName);
  }

  async getDescendants(entityName: string): Promise<Entity[]> {
    return this.entityManager.getDescendants(entityName);
  }

  async getSubtree(entityName: string): Promise<KnowledgeGraph> {
    return this.entityManager.getSubtree(entityName);
  }

  async getRootEntities(): Promise<Entity[]> {
    return this.entityManager.getRootEntities();
  }

  async getEntityDepth(entityName: string): Promise<number> {
    return this.entityManager.getEntityDepth(entityName);
  }

  async moveEntity(entityName: string, newParentName: string | null): Promise<Entity> {
    return this.entityManager.moveEntity(entityName, newParentName);
  }

  // Analytics operations
  async getGraphStats(): Promise<GraphStats> {
    return this.searchManager.getGraphStats();
  }

  async validateGraph(): Promise<ValidationReport> {
    return this.searchManager.validateGraph();
  }

  // Compression operations
  async findDuplicates(threshold: number = DEFAULT_DUPLICATE_THRESHOLD): Promise<string[][]> {
    return this.searchManager.findDuplicates(threshold);
  }

  async mergeEntities(entityNames: string[], targetName?: string): Promise<Entity> {
    return this.searchManager.mergeEntities(entityNames, targetName);
  }

  async compressGraph(threshold: number = 0.8, dryRun: boolean = false): Promise<CompressionResult> {
    return this.searchManager.compressGraph(threshold, dryRun);
  }

  // Archive operations
  async archiveEntities(criteria: ArchiveCriteria, dryRun: boolean = false): Promise<ArchiveResult> {
    return this.entityManager.archiveEntities(criteria, dryRun);
  }

  // Import/Export operations
  async exportGraph(
    format: 'json' | 'csv' | 'graphml' | 'gexf' | 'dot' | 'markdown' | 'mermaid',
    filter?: { startDate?: string; endDate?: string; entityType?: string; tags?: string[] }
  ): Promise<string> {
    let graph: ReadonlyKnowledgeGraph;
    if (filter) {
      graph = await this.searchByDateRange(filter.startDate, filter.endDate, filter.entityType, filter.tags);
    } else {
      graph = await this.storage.loadGraph();
    }
    return this.ioManager.exportGraph(graph, format);
  }

  async importGraph(
    format: 'json' | 'csv' | 'graphml',
    data: string,
    mergeStrategy: 'replace' | 'skip' | 'merge' | 'fail' = 'skip',
    dryRun: boolean = false
  ): Promise<ImportResult> {
    return this.ioManager.importGraph(format, data, mergeStrategy, dryRun);
  }
}
