#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/logger.js';
import {
  DEFAULT_DUPLICATE_THRESHOLD,
  SEARCH_LIMITS,
  IMPORTANCE_RANGE
} from './utils/constants.js';
import { GraphStorage } from './core/GraphStorage.js';
import { EntityManager } from './core/EntityManager.js';
import { RelationManager } from './core/RelationManager.js';
import { SearchManager } from './search/SearchManager.js';
import { CompressionManager } from './features/CompressionManager.js';
import { HierarchyManager } from './features/HierarchyManager.js';
import { ExportManager } from './features/ExportManager.js';
import { ImportManager } from './features/ImportManager.js';
import type {
  Entity,
  Relation,
  KnowledgeGraph,
  GraphStats,
  ValidationReport,
  ValidationError,
  ValidationWarning,
  SavedSearch,
  TagAlias,
  SearchResult,
  BooleanQueryNode,
  ImportResult,
  CompressionResult,
} from './types/index.js';

// Define memory file path using environment variable with fallback
export const defaultMemoryPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'memory.jsonl');

// Handle backward compatibility: migrate memory.json to memory.jsonl if needed
export async function ensureMemoryFilePath(): Promise<string> {
  if (process.env.MEMORY_FILE_PATH) {
    // Custom path provided, use it as-is (with absolute path resolution)
    return path.isAbsolute(process.env.MEMORY_FILE_PATH)
      ? process.env.MEMORY_FILE_PATH
      : path.join(path.dirname(fileURLToPath(import.meta.url)), process.env.MEMORY_FILE_PATH);
  }
  
  // No custom path set, check for backward compatibility migration
  const oldMemoryPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'memory.json');
  const newMemoryPath = defaultMemoryPath;
  
  try {
    // Check if old file exists and new file doesn't
    await fs.access(oldMemoryPath);
    try {
      await fs.access(newMemoryPath);
      // Both files exist, use new one (no migration needed)
      return newMemoryPath;
    } catch {
      // Old file exists, new file doesn't - migrate
      logger.info('Found legacy memory.json file, migrating to memory.jsonl for JSONL format compatibility');
      await fs.rename(oldMemoryPath, newMemoryPath);
      logger.info('Successfully migrated memory.json to memory.jsonl');
      return newMemoryPath;
    }
  } catch {
    // Old file doesn't exist, use new path
    return newMemoryPath;
  }
}

// Initialize memory file path (will be set during startup)
let MEMORY_FILE_PATH: string;

// Re-export types for backward compatibility
export type {
  Entity,
  Relation,
  KnowledgeGraph,
  GraphStats,
  ValidationReport,
  ValidationError,
  ValidationWarning,
  SavedSearch,
  TagAlias,
  SearchResult,
  BooleanQueryNode,
  ImportResult,
  CompressionResult,
};

// The KnowledgeGraphManager class contains all operations to interact with the knowledge graph
export class KnowledgeGraphManager {
  private savedSearchesFilePath: string;
  private tagAliasesFilePath: string;
  private storage: GraphStorage;
  private entityManager: EntityManager;
  private relationManager: RelationManager;
  private searchManager: SearchManager;
  private compressionManager: CompressionManager;
  private hierarchyManager: HierarchyManager;
  private exportManager: ExportManager;
  private importManager: ImportManager;

  constructor(memoryFilePath: string) {
    // Saved searches file is stored alongside the memory file
    const dir = path.dirname(memoryFilePath);
    const basename = path.basename(memoryFilePath, path.extname(memoryFilePath));
    this.savedSearchesFilePath = path.join(dir, `${basename}-saved-searches.jsonl`);
    this.tagAliasesFilePath = path.join(dir, `${basename}-tag-aliases.jsonl`);
    this.storage = new GraphStorage(memoryFilePath);
    this.entityManager = new EntityManager(this.storage);
    this.relationManager = new RelationManager(this.storage);
    this.searchManager = new SearchManager(this.storage, this.savedSearchesFilePath);
    this.compressionManager = new CompressionManager(this.storage);
    this.hierarchyManager = new HierarchyManager(this.storage);
    this.exportManager = new ExportManager();
    this.importManager = new ImportManager(this.storage);
  }

  private async loadGraph(): Promise<KnowledgeGraph> {
    return this.storage.loadGraph();
  }

  private async saveGraph(graph: KnowledgeGraph): Promise<void> {
    return this.storage.saveGraph(graph);
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

  async readGraph(): Promise<KnowledgeGraph> {
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
    const graph = await this.loadGraph();

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
  // Phase 3: Add tags to an entity
  async addTags(entityName: string, tags: string[]): Promise<{ entityName: string; addedTags: string[] }> {
    const graph = await this.loadGraph();
    const timestamp = new Date().toISOString();

    const entity = graph.entities.find(e => e.name === entityName);
    if (!entity) {
      throw new Error(`Entity with name ${entityName} not found`);
    }

    // Initialize tags array if it doesn't exist
    if (!entity.tags) {
      entity.tags = [];
    }

    // Normalize tags to lowercase and filter out duplicates
    const normalizedTags = tags.map(tag => tag.toLowerCase());
    const newTags = normalizedTags.filter(tag => !entity.tags!.includes(tag));

    entity.tags.push(...newTags);

    // Update lastModified timestamp if tags were added
    if (newTags.length > 0) {
      entity.lastModified = timestamp;
    }

    await this.saveGraph(graph);

    return { entityName, addedTags: newTags };
  }

  // Phase 3: Remove tags from an entity
  async removeTags(entityName: string, tags: string[]): Promise<{ entityName: string; removedTags: string[] }> {
    const graph = await this.loadGraph();
    const timestamp = new Date().toISOString();

    const entity = graph.entities.find(e => e.name === entityName);
    if (!entity) {
      throw new Error(`Entity with name ${entityName} not found`);
    }

    if (!entity.tags) {
      return { entityName, removedTags: [] };
    }

    // Normalize tags to lowercase
    const normalizedTags = tags.map(tag => tag.toLowerCase());
    const originalLength = entity.tags.length;

    // Filter out the tags to remove
    entity.tags = entity.tags.filter(tag => !normalizedTags.includes(tag.toLowerCase()));

    const removedTags = normalizedTags.filter(tag => 
      originalLength > entity.tags!.length || 
      !entity.tags!.map(t => t.toLowerCase()).includes(tag)
    );

    // Update lastModified timestamp if tags were removed
    if (entity.tags.length < originalLength) {
      entity.lastModified = timestamp;
    }

    await this.saveGraph(graph);

    return { entityName, removedTags };
  }

  // Phase 3: Set importance level for an entity
  async setImportance(entityName: string, importance: number): Promise<{ entityName: string; importance: number }> {
    const graph = await this.loadGraph();
    const timestamp = new Date().toISOString();

    // Validate importance range
    if (importance < IMPORTANCE_RANGE.MIN || importance > IMPORTANCE_RANGE.MAX) {
      throw new Error(`Importance must be between ${IMPORTANCE_RANGE.MIN} and ${IMPORTANCE_RANGE.MAX}, got ${importance}`);
    }

    const entity = graph.entities.find(e => e.name === entityName);
    if (!entity) {
      throw new Error(`Entity with name ${entityName} not found`);
    }

    entity.importance = importance;
    entity.lastModified = timestamp;

    await this.saveGraph(graph);

    return { entityName, importance };
  }

  // Tier 0 B5: Bulk tag operations for efficient tag management
  /**
   * Add tags to multiple entities in a single operation
   */
  async addTagsToMultipleEntities(entityNames: string[], tags: string[]): Promise<{ entityName: string; addedTags: string[] }[]> {
    const graph = await this.loadGraph();
    const timestamp = new Date().toISOString();
    const normalizedTags = tags.map(tag => tag.toLowerCase());
    const results: { entityName: string; addedTags: string[] }[] = [];

    for (const entityName of entityNames) {
      const entity = graph.entities.find(e => e.name === entityName);
      if (!entity) {
        continue; // Skip non-existent entities
      }

      // Initialize tags array if it doesn't exist
      if (!entity.tags) {
        entity.tags = [];
      }

      // Filter out duplicates
      const newTags = normalizedTags.filter(tag => !entity.tags!.includes(tag));
      entity.tags.push(...newTags);

      // Update lastModified timestamp if tags were added
      if (newTags.length > 0) {
        entity.lastModified = timestamp;
      }

      results.push({ entityName, addedTags: newTags });
    }

    await this.saveGraph(graph);
    return results;
  }

  /**
   * Replace a tag with a new tag across all entities (rename tag)
   */
  async replaceTag(oldTag: string, newTag: string): Promise<{ affectedEntities: string[]; count: number }> {
    const graph = await this.loadGraph();
    const timestamp = new Date().toISOString();
    const normalizedOldTag = oldTag.toLowerCase();
    const normalizedNewTag = newTag.toLowerCase();
    const affectedEntities: string[] = [];

    for (const entity of graph.entities) {
      if (!entity.tags || !entity.tags.includes(normalizedOldTag)) {
        continue;
      }

      // Replace old tag with new tag
      const index = entity.tags.indexOf(normalizedOldTag);
      entity.tags[index] = normalizedNewTag;
      entity.lastModified = timestamp;
      affectedEntities.push(entity.name);
    }

    await this.saveGraph(graph);
    return { affectedEntities, count: affectedEntities.length };
  }

  /**
   * Merge two tags into one (combine tag1 and tag2 into targetTag)
   */
  async mergeTags(tag1: string, tag2: string, targetTag: string): Promise<{ affectedEntities: string[]; count: number }> {
    const graph = await this.loadGraph();
    const timestamp = new Date().toISOString();
    const normalizedTag1 = tag1.toLowerCase();
    const normalizedTag2 = tag2.toLowerCase();
    const normalizedTargetTag = targetTag.toLowerCase();
    const affectedEntities: string[] = [];

    for (const entity of graph.entities) {
      if (!entity.tags) {
        continue;
      }

      const hasTag1 = entity.tags.includes(normalizedTag1);
      const hasTag2 = entity.tags.includes(normalizedTag2);

      if (!hasTag1 && !hasTag2) {
        continue;
      }

      // Remove both tags
      entity.tags = entity.tags.filter(tag => tag !== normalizedTag1 && tag !== normalizedTag2);

      // Add target tag if not already present
      if (!entity.tags.includes(normalizedTargetTag)) {
        entity.tags.push(normalizedTargetTag);
      }

      entity.lastModified = timestamp;
      affectedEntities.push(entity.name);
    }

    await this.saveGraph(graph);
    return { affectedEntities, count: affectedEntities.length };
  }

  // Tier 0 A1: Graph validation for data integrity
  /**
   * Validate the knowledge graph for integrity issues and provide a detailed report
   */
  async validateGraph(): Promise<ValidationReport> {
    const graph = await this.loadGraph();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Create a set of all entity names for fast lookup
    const entityNames = new Set(graph.entities.map(e => e.name));

    // Check for orphaned relations (relations pointing to non-existent entities)
    for (const relation of graph.relations) {
      if (!entityNames.has(relation.from)) {
        errors.push({
          type: 'orphaned_relation',
          message: `Relation has non-existent source entity: "${relation.from}"`,
          details: { relation, missingEntity: relation.from }
        });
      }
      if (!entityNames.has(relation.to)) {
        errors.push({
          type: 'orphaned_relation',
          message: `Relation has non-existent target entity: "${relation.to}"`,
          details: { relation, missingEntity: relation.to }
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
        errors.push({
          type: 'duplicate_entity',
          message: `Duplicate entity name found: "${name}" (${count} instances)`,
          details: { entityName: name, count }
        });
      }
    }

    // Check for entities with invalid data
    for (const entity of graph.entities) {
      if (!entity.name || entity.name.trim() === '') {
        errors.push({
          type: 'invalid_data',
          message: 'Entity has empty or missing name',
          details: { entity }
        });
      }
      if (!entity.entityType || entity.entityType.trim() === '') {
        errors.push({
          type: 'invalid_data',
          message: `Entity "${entity.name}" has empty or missing entityType`,
          details: { entity }
        });
      }
      if (!Array.isArray(entity.observations)) {
        errors.push({
          type: 'invalid_data',
          message: `Entity "${entity.name}" has invalid observations (not an array)`,
          details: { entity }
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
          details: { entityName: entity.name }
        });
      }
    }

    // Warnings: Check for entities with empty observations
    for (const entity of graph.entities) {
      if (entity.observations.length === 0) {
        warnings.push({
          type: 'empty_observations',
          message: `Entity "${entity.name}" has no observations`,
          details: { entityName: entity.name }
        });
      }
    }

    // Warnings: Check for missing metadata (createdAt, lastModified)
    for (const entity of graph.entities) {
      if (!entity.createdAt) {
        warnings.push({
          type: 'missing_metadata',
          message: `Entity "${entity.name}" is missing createdAt timestamp`,
          details: { entityName: entity.name, field: 'createdAt' }
        });
      }
      if (!entity.lastModified) {
        warnings.push({
          type: 'missing_metadata',
          message: `Entity "${entity.name}" is missing lastModified timestamp`,
          details: { entityName: entity.name, field: 'lastModified' }
        });
      }
    }

    // Count specific issues
    const orphanedRelationsCount = errors.filter(e => e.type === 'orphaned_relation').length;
    const entitiesWithoutRelationsCount = warnings.filter(w => w.type === 'isolated_entity').length;

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary: {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
        orphanedRelationsCount,
        entitiesWithoutRelationsCount
      }
    };
  }

  // Tier 0 C4: Saved searches for efficient query management
  private async loadSavedSearches(): Promise<SavedSearch[]> {
    try {
      const data = await fs.readFile(this.savedSearchesFilePath, "utf-8");
      const lines = data.split("\n").filter(line => line.trim() !== "");
      return lines.map(line => JSON.parse(line) as SavedSearch);
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private async saveSavedSearches(searches: SavedSearch[]): Promise<void> {
    const lines = searches.map(s => JSON.stringify(s));
    await fs.writeFile(this.savedSearchesFilePath, lines.join("\n"));
  }

  /**
   * Save a search query for later reuse
   */
  async saveSearch(search: Omit<SavedSearch, 'createdAt' | 'useCount' | 'lastUsed'>): Promise<SavedSearch> {
    const searches = await this.loadSavedSearches();

    // Check if name already exists
    if (searches.some(s => s.name === search.name)) {
      throw new Error(`Saved search with name "${search.name}" already exists`);
    }

    const newSearch: SavedSearch = {
      ...search,
      createdAt: new Date().toISOString(),
      useCount: 0
    };

    searches.push(newSearch);
    await this.saveSavedSearches(searches);

    return newSearch;
  }

  /**
   * List all saved searches
   */
  async listSavedSearches(): Promise<SavedSearch[]> {
    return await this.loadSavedSearches();
  }

  /**
   * Get a specific saved search by name
   */
  async getSavedSearch(name: string): Promise<SavedSearch | null> {
    const searches = await this.loadSavedSearches();
    return searches.find(s => s.name === name) || null;
  }

  /**
   * Execute a saved search by name
   */
  async executeSavedSearch(name: string): Promise<KnowledgeGraph> {
    const searches = await this.loadSavedSearches();
    const search = searches.find(s => s.name === name);

    if (!search) {
      throw new Error(`Saved search "${name}" not found`);
    }

    // Update usage statistics
    search.lastUsed = new Date().toISOString();
    search.useCount++;
    await this.saveSavedSearches(searches);

    // Execute the search
    return await this.searchNodes(
      search.query,
      search.tags,
      search.minImportance,
      search.maxImportance
    );
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(name: string): Promise<boolean> {
    const searches = await this.loadSavedSearches();
    const initialLength = searches.length;
    const filtered = searches.filter(s => s.name !== name);

    if (filtered.length === initialLength) {
      return false; // Search not found
    }

    await this.saveSavedSearches(filtered);
    return true;
  }

  /**
   * Update a saved search
   */
  async updateSavedSearch(name: string, updates: Partial<Omit<SavedSearch, 'name' | 'createdAt' | 'useCount' | 'lastUsed'>>): Promise<SavedSearch> {
    const searches = await this.loadSavedSearches();
    const search = searches.find(s => s.name === name);

    if (!search) {
      throw new Error(`Saved search "${name}" not found`);
    }

    // Apply updates
    Object.assign(search, updates);

    await this.saveSavedSearches(searches);
    return search;
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
    return this.hierarchyManager.setEntityParent(entityName, parentName);
  }

  /**
   * Get the immediate children of an entity
   */
  async getChildren(entityName: string): Promise<Entity[]> {
    return this.hierarchyManager.getChildren(entityName);
  }

  /**
   * Get the parent of an entity
   */
  async getParent(entityName: string): Promise<Entity | null> {
    return this.hierarchyManager.getParent(entityName);
  }

  /**
   * Get all ancestors of an entity (parent, grandparent, etc.)
   */
  async getAncestors(entityName: string): Promise<Entity[]> {
    return this.hierarchyManager.getAncestors(entityName);
  }

  /**
   * Get all descendants of an entity (children, grandchildren, etc.)
   */
  async getDescendants(entityName: string): Promise<Entity[]> {
    return this.hierarchyManager.getDescendants(entityName);
  }

  /**
   * Get the entire subtree rooted at an entity (entity + all descendants)
   */
  async getSubtree(entityName: string): Promise<KnowledgeGraph> {
    return this.hierarchyManager.getSubtree(entityName);
  }

  /**
   * Get root entities (entities with no parent)
   */
  async getRootEntities(): Promise<Entity[]> {
    return this.hierarchyManager.getRootEntities();
  }

  /**
   * Get the depth of an entity in the hierarchy (0 for root, 1 for child of root, etc.)
   */
  async getEntityDepth(entityName: string): Promise<number> {
    return this.hierarchyManager.getEntityDepth(entityName);
  }

  /**
   * Move an entity to a new parent (maintaining its descendants)
   */
  async moveEntity(entityName: string, newParentName: string | null): Promise<Entity> {
    return this.hierarchyManager.moveEntity(entityName, newParentName);
  }

  // Phase 3: Memory compression - duplicate detection and merging
  /**
   * Find duplicate entities in the graph based on similarity threshold
   * @param threshold - Similarity threshold (0.0 to 1.0), default 0.8
   * @returns Array of duplicate groups (each group has similar entities)
   */
  async findDuplicates(threshold: number = DEFAULT_DUPLICATE_THRESHOLD): Promise<string[][]> {
    return this.compressionManager.findDuplicates(threshold);
  }

  /**
   * Merge a group of entities into a single entity
   * @param entityNames - Names of entities to merge (first one is kept)
   * @param targetName - Optional new name for merged entity (default: first entity name)
   * @returns The merged entity
   */
  async mergeEntities(entityNames: string[], targetName?: string): Promise<Entity> {
    return this.compressionManager.mergeEntities(entityNames, targetName);
  }

  /**
   * Compress the knowledge graph by finding and merging duplicates
   * @param threshold - Similarity threshold for duplicate detection (0.0 to 1.0)
   * @param dryRun - If true, only report what would be compressed without applying changes
   * @returns Compression result with statistics
   */
  async compressGraph(threshold: number = 0.8, dryRun: boolean = false): Promise<CompressionResult> {
    return this.compressionManager.compressGraph(threshold, dryRun);
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
    const graph = await this.loadGraph();
    const toArchive: Entity[] = [];

    for (const entity of graph.entities) {
      let shouldArchive = false;

      // Check age criteria
      if (criteria.olderThan && entity.lastModified) {
        const entityDate = new Date(entity.lastModified);
        const cutoffDate = new Date(criteria.olderThan);
        if (entityDate < cutoffDate) {
          shouldArchive = true;
        }
      }

      // Check importance criteria
      if (criteria.importanceLessThan !== undefined) {
        if (entity.importance === undefined || entity.importance < criteria.importanceLessThan) {
          shouldArchive = true;
        }
      }

      // Check tag criteria (must have at least one matching tag)
      if (criteria.tags && criteria.tags.length > 0) {
        const normalizedCriteriaTags = criteria.tags.map(t => t.toLowerCase());
        const entityTags = (entity.tags || []).map(t => t.toLowerCase());
        const hasMatchingTag = normalizedCriteriaTags.some(tag => entityTags.includes(tag));
        if (hasMatchingTag) {
          shouldArchive = true;
        }
      }

      if (shouldArchive) {
        toArchive.push(entity);
      }
    }

    if (!dryRun && toArchive.length > 0) {
      // Remove archived entities from main graph
      const archiveNames = new Set(toArchive.map(e => e.name));
      graph.entities = graph.entities.filter(e => !archiveNames.has(e.name));
      graph.relations = graph.relations.filter(r =>
        !archiveNames.has(r.from) && !archiveNames.has(r.to)
      );
      await this.saveGraph(graph);
    }

    return {
      archived: toArchive.length,
      entityNames: toArchive.map(e => e.name)
    };
  }

  // Tier 0 B2: Tag aliases for synonym management
  private async loadTagAliases(): Promise<TagAlias[]> {
    try {
      const data = await fs.readFile(this.tagAliasesFilePath, "utf-8");
      const lines = data.split("\n").filter(line => line.trim() !== "");
      return lines.map(line => JSON.parse(line) as TagAlias);
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private async saveTagAliases(aliases: TagAlias[]): Promise<void> {
    const lines = aliases.map(a => JSON.stringify(a));
    await fs.writeFile(this.tagAliasesFilePath, lines.join("\n"));
  }

  /**
   * Resolve a tag through aliases to get its canonical form
   * @param tag - Tag to resolve (can be alias or canonical)
   * @returns Canonical tag name
   */
  async resolveTag(tag: string): Promise<string> {
    const aliases = await this.loadTagAliases();
    const normalized = tag.toLowerCase();

    // Check if this tag is an alias
    const alias = aliases.find(a => a.alias === normalized);
    if (alias) {
      return alias.canonical;
    }

    // Return as-is (might be canonical or unaliased tag)
    return normalized;
  }

  /**
   * Add a tag alias (synonym mapping)
   * @param alias - The alias/synonym
   * @param canonical - The canonical (main) tag name
   * @param description - Optional description of the alias
   */
  async addTagAlias(alias: string, canonical: string, description?: string): Promise<TagAlias> {
    const aliases = await this.loadTagAliases();
    const normalizedAlias = alias.toLowerCase();
    const normalizedCanonical = canonical.toLowerCase();

    // Check if alias already exists
    if (aliases.some(a => a.alias === normalizedAlias)) {
      throw new Error(`Tag alias "${alias}" already exists`);
    }

    // Prevent aliasing to another alias (aliases should point to canonical tags)
    if (aliases.some(a => a.canonical === normalizedAlias)) {
      throw new Error(`Cannot create alias to "${alias}" because it is a canonical tag with existing aliases`);
    }

    const newAlias: TagAlias = {
      alias: normalizedAlias,
      canonical: normalizedCanonical,
      description,
      createdAt: new Date().toISOString()
    };

    aliases.push(newAlias);
    await this.saveTagAliases(aliases);

    return newAlias;
  }

  /**
   * List all tag aliases
   */
  async listTagAliases(): Promise<TagAlias[]> {
    return await this.loadTagAliases();
  }

  /**
   * Remove a tag alias
   */
  async removeTagAlias(alias: string): Promise<boolean> {
    const aliases = await this.loadTagAliases();
    const normalizedAlias = alias.toLowerCase();
    const initialLength = aliases.length;
    const filtered = aliases.filter(a => a.alias !== normalizedAlias);

    if (filtered.length === initialLength) {
      return false; // Alias not found
    }

    await this.saveTagAliases(filtered);
    return true;
  }

  /**
   * Get all aliases for a canonical tag
   */
  async getAliasesForTag(canonicalTag: string): Promise<string[]> {
    const aliases = await this.loadTagAliases();
    const normalized = canonicalTag.toLowerCase();
    return aliases
      .filter(a => a.canonical === normalized)
      .map(a => a.alias);
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
    let graph: KnowledgeGraph;
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

    return this.exportManager.exportGraph(graph, format);
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
    return this.importManager.importGraph(format, data, mergeStrategy, dryRun);
  }
}

let knowledgeGraphManager: KnowledgeGraphManager;


// The server instance and tools exposed to Claude
const server = new Server({
  name: "memory-server",
  version: "0.8.0",
},    {
    capabilities: {
      tools: {},
    },
  },);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_entities",
        description: "Create multiple new entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            entities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "The name of the entity" },
                  entityType: { type: "string", description: "The type of the entity" },
                  observations: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "An array of observation contents associated with the entity"
                  },
                },
                required: ["name", "entityType", "observations"],
                additionalProperties: false,
              },
            },
          },
          required: ["entities"],
          additionalProperties: false,
        },
      },
      {
        name: "create_relations",
        description: "Create multiple new relations between entities in the knowledge graph. Relations should be in active voice",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "The name of the entity where the relation starts" },
                  to: { type: "string", description: "The name of the entity where the relation ends" },
                  relationType: { type: "string", description: "The type of the relation" },
                },
                required: ["from", "to", "relationType"],
                additionalProperties: false,
              },
            },
          },
          required: ["relations"],
          additionalProperties: false,
        },
      },
      {
        name: "add_observations",
        description: "Add new observations to existing entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            observations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity to add the observations to" },
                  contents: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "An array of observation contents to add"
                  },
                },
                required: ["entityName", "contents"],
                additionalProperties: false,
              },
            },
          },
          required: ["observations"],
          additionalProperties: false,
        },
      },
      {
        name: "delete_entities",
        description: "Delete multiple entities and their associated relations from the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            entityNames: { 
              type: "array", 
              items: { type: "string" },
              description: "An array of entity names to delete" 
            },
          },
          required: ["entityNames"],
          additionalProperties: false,
        },
      },
      {
        name: "delete_observations",
        description: "Delete specific observations from entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            deletions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity containing the observations" },
                  observations: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "An array of observations to delete"
                  },
                },
                required: ["entityName", "observations"],
                additionalProperties: false,
              },
            },
          },
          required: ["deletions"],
          additionalProperties: false,
        },
      },
      {
        name: "delete_relations",
        description: "Delete multiple relations from the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            relations: { 
              type: "array", 
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "The name of the entity where the relation starts" },
                  to: { type: "string", description: "The name of the entity where the relation ends" },
                  relationType: { type: "string", description: "The type of the relation" },
                },
                required: ["from", "to", "relationType"],
                additionalProperties: false,
              },
              description: "An array of relations to delete" 
            },
          },
          required: ["relations"],
          additionalProperties: false,
        },
      },
      {
        name: "read_graph",
        description: "Read the entire knowledge graph",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "search_nodes",
        description: "Search for nodes in the knowledge graph based on a query, with optional filters for tags and importance",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query to match against entity names, types, and observation content" },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional array of tags to filter by (case-insensitive)"
            },
            minImportance: {
              type: "number",
              description: "Optional minimum importance level (0-10)"
            },
            maxImportance: {
              type: "number",
              description: "Optional maximum importance level (0-10)"
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
      {
        name: "search_nodes_ranked",
        description: "Search for nodes with TF-IDF relevance ranking. Returns results sorted by relevance score with match details. Better than basic search for finding the most relevant results.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query. Multiple terms will be analyzed for relevance using TF-IDF algorithm."
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional array of tags to filter by (case-insensitive)"
            },
            minImportance: {
              type: "number",
              description: "Optional minimum importance level (0-10)"
            },
            maxImportance: {
              type: "number",
              description: "Optional maximum importance level (0-10)"
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default 50)",
              minimum: 1,
              maximum: 200
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
      {
        name: "open_nodes",
        description: "Open specific nodes in the knowledge graph by their names",
        inputSchema: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: { type: "string" },
              description: "An array of entity names to retrieve",
            },
          },
          required: ["names"],
          additionalProperties: false,
        },
      },
      {
        name: "search_by_date_range",
        description: "Search for entities and relations within a specific date range, optionally filtered by entity type and tags. Uses createdAt or lastModified timestamps.",
        inputSchema: {
          type: "object",
          properties: {
            startDate: {
              type: "string",
              description: "ISO 8601 start date (optional). If not provided, no lower bound is applied."
            },
            endDate: {
              type: "string",
              description: "ISO 8601 end date (optional). If not provided, no upper bound is applied."
            },
            entityType: {
              type: "string",
              description: "Filter by specific entity type (optional)"
            },
            tags: { 
              type: "array", 
              items: { type: "string" },
              description: "Optional array of tags to filter by (case-insensitive)"
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "get_graph_stats",
        description: "Get comprehensive statistics about the knowledge graph including counts, types, and date ranges",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "add_tags",
        description: "Add tags to an existing entity in the knowledge graph. Tags are stored as lowercase for case-insensitive matching.",
        inputSchema: {
          type: "object",
          properties: {
            entityName: {
              type: "string",
              description: "The name of the entity to add tags to"
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "An array of tags to add to the entity"
            },
          },
          required: ["entityName", "tags"],
          additionalProperties: false,
        },
      },
      {
        name: "remove_tags",
        description: "Remove tags from an existing entity in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            entityName: {
              type: "string",
              description: "The name of the entity to remove tags from"
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "An array of tags to remove from the entity"
            },
          },
          required: ["entityName", "tags"],
          additionalProperties: false,
        },
      },
      {
        name: "set_importance",
        description: "Set the importance level for an entity. Importance must be a number between 0 and 10.",
        inputSchema: {
          type: "object",
          properties: {
            entityName: {
              type: "string",
              description: "The name of the entity to set importance for"
            },
            importance: {
              type: "number",
              description: "The importance level (0-10, where 0 is least important and 10 is most important)",
              minimum: 0,
              maximum: 10
            },
          },
          required: ["entityName", "importance"],
          additionalProperties: false,
        },
      },
      {
        name: "add_tags_to_multiple_entities",
        description: "Add tags to multiple entities in a single operation. Efficient bulk operation for tag management.",
        inputSchema: {
          type: "object",
          properties: {
            entityNames: {
              type: "array",
              items: { type: "string" },
              description: "Array of entity names to add tags to"
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Array of tags to add to all specified entities"
            },
          },
          required: ["entityNames", "tags"],
          additionalProperties: false,
        },
      },
      {
        name: "replace_tag",
        description: "Replace (rename) a tag across all entities in the knowledge graph. All instances of the old tag will be replaced with the new tag.",
        inputSchema: {
          type: "object",
          properties: {
            oldTag: {
              type: "string",
              description: "The tag to be replaced"
            },
            newTag: {
              type: "string",
              description: "The new tag to replace it with"
            },
          },
          required: ["oldTag", "newTag"],
          additionalProperties: false,
        },
      },
      {
        name: "merge_tags",
        description: "Merge two tags into a single target tag across all entities. Entities with either tag1 or tag2 (or both) will end up with only the target tag.",
        inputSchema: {
          type: "object",
          properties: {
            tag1: {
              type: "string",
              description: "First tag to merge"
            },
            tag2: {
              type: "string",
              description: "Second tag to merge"
            },
            targetTag: {
              type: "string",
              description: "The resulting tag after merging"
            },
          },
          required: ["tag1", "tag2", "targetTag"],
          additionalProperties: false,
        },
      },
      {
        name: "validate_graph",
        description: "Validate the knowledge graph for integrity issues. Checks for orphaned relations, duplicate entities, invalid data, isolated entities, and missing metadata. Returns a detailed validation report.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "save_search",
        description: "Save a search query for later reuse. Allows saving complex search parameters with a name and optional description.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Unique name for the saved search"
            },
            description: {
              type: "string",
              description: "Optional description of what this search is for"
            },
            query: {
              type: "string",
              description: "The search query text"
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional tags to filter by"
            },
            minImportance: {
              type: "number",
              description: "Optional minimum importance level (0-10)"
            },
            maxImportance: {
              type: "number",
              description: "Optional maximum importance level (0-10)"
            },
            entityType: {
              type: "string",
              description: "Optional entity type to filter by"
            },
          },
          required: ["name", "query"],
          additionalProperties: false,
        },
      },
      {
        name: "list_saved_searches",
        description: "List all saved searches with their metadata, including usage statistics.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "execute_saved_search",
        description: "Execute a previously saved search by name. Automatically tracks usage statistics (last used time and use count).",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the saved search to execute"
            },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
      {
        name: "delete_saved_search",
        description: "Delete a saved search by name.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the saved search to delete"
            },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
      {
        name: "update_saved_search",
        description: "Update the parameters of a saved search. Can update query, description, tags, importance levels, and entity type.",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the saved search to update"
            },
            updates: {
              type: "object",
              properties: {
                description: {
                  type: "string",
                  description: "New description"
                },
                query: {
                  type: "string",
                  description: "New search query"
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "New tags filter"
                },
                minImportance: {
                  type: "number",
                  description: "New minimum importance"
                },
                maxImportance: {
                  type: "number",
                  description: "New maximum importance"
                },
                entityType: {
                  type: "string",
                  description: "New entity type filter"
                },
              },
              description: "Fields to update in the saved search"
            },
          },
          required: ["name", "updates"],
          additionalProperties: false,
        },
      },
      {
        name: "boolean_search",
        description: "Advanced boolean search with AND, OR, NOT operators and field-specific queries. Supports parentheses for grouping and quoted strings for exact phrases. Field prefixes: name:, type:, observation:, tag:. Example: 'name:Alice AND (type:person OR observation:\"likes programming\") NOT tag:archived'",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Boolean query string with operators (AND, OR, NOT) and optional field prefixes (name:, type:, observation:, tag:)"
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional additional tags to filter by"
            },
            minImportance: {
              type: "number",
              description: "Optional minimum importance level (0-10)"
            },
            maxImportance: {
              type: "number",
              description: "Optional maximum importance level (0-10)"
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
      {
        name: "fuzzy_search",
        description: "Search with typo tolerance using Levenshtein distance algorithm. Finds entities even when query has typos or slight variations.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query (can have typos)"
            },
            threshold: {
              type: "number",
              description: "Similarity threshold (0.0 to 1.0). Default 0.7. Higher = stricter matching",
              minimum: 0.0,
              maximum: 1.0
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional tags to filter by"
            },
            minImportance: {
              type: "number",
              description: "Optional minimum importance level (0-10)"
            },
            maxImportance: {
              type: "number",
              description: "Optional maximum importance level (0-10)"
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
      {
        name: "get_search_suggestions",
        description: "Get 'did you mean?' suggestions for a search query. Returns similar entity names and types based on fuzzy matching.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query to get suggestions for"
            },
            maxSuggestions: {
              type: "number",
              description: "Maximum number of suggestions to return (default 5)",
              minimum: 1,
              maximum: 20
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
      {
        name: "add_tag_alias",
        description: "Add a tag alias (synonym). When searching or filtering by the alias, it will automatically resolve to the canonical tag.",
        inputSchema: {
          type: "object",
          properties: {
            alias: {
              type: "string",
              description: "The alias/synonym (e.g., 'ai')"
            },
            canonical: {
              type: "string",
              description: "The canonical tag name (e.g., 'artificial-intelligence')"
            },
            description: {
              type: "string",
              description: "Optional description of this alias mapping"
            },
          },
          required: ["alias", "canonical"],
          additionalProperties: false,
        },
      },
      {
        name: "list_tag_aliases",
        description: "List all tag aliases with their canonical mappings.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "remove_tag_alias",
        description: "Remove a tag alias. The canonical tag remains unchanged.",
        inputSchema: {
          type: "object",
          properties: {
            alias: {
              type: "string",
              description: "The alias to remove"
            },
          },
          required: ["alias"],
          additionalProperties: false,
        },
      },
      {
        name: "get_aliases_for_tag",
        description: "Get all aliases that point to a specific canonical tag.",
        inputSchema: {
          type: "object",
          properties: {
            canonicalTag: {
              type: "string",
              description: "The canonical tag to get aliases for"
            },
          },
          required: ["canonicalTag"],
          additionalProperties: false,
        },
      },
      {
        name: "resolve_tag",
        description: "Resolve a tag (which may be an alias) to its canonical form.",
        inputSchema: {
          type: "object",
          properties: {
            tag: {
              type: "string",
              description: "The tag to resolve"
            },
          },
          required: ["tag"],
          additionalProperties: false,
        },
      },
      {
        name: "set_entity_parent",
        description: "Set or remove the parent of an entity to create hierarchical relationships. Validates against cycles.",
        inputSchema: {
          type: "object",
          properties: {
            entityName: {
              type: "string",
              description: "Name of the entity to set parent for"
            },
            parentName: {
              type: ["string", "null"],
              description: "Name of the parent entity (or null to remove parent)"
            },
          },
          required: ["entityName", "parentName"],
          additionalProperties: false,
        },
      },
      {
        name: "get_children",
        description: "Get the immediate children of an entity in the hierarchy.",
        inputSchema: {
          type: "object",
          properties: {
            entityName: {
              type: "string",
              description: "Name of the entity to get children for"
            },
          },
          required: ["entityName"],
          additionalProperties: false,
        },
      },
      {
        name: "get_parent",
        description: "Get the parent of an entity in the hierarchy.",
        inputSchema: {
          type: "object",
          properties: {
            entityName: {
              type: "string",
              description: "Name of the entity to get parent for"
            },
          },
          required: ["entityName"],
          additionalProperties: false,
        },
      },
      {
        name: "get_ancestors",
        description: "Get all ancestors of an entity (parent, grandparent, etc.) from closest to furthest.",
        inputSchema: {
          type: "object",
          properties: {
            entityName: {
              type: "string",
              description: "Name of the entity to get ancestors for"
            },
          },
          required: ["entityName"],
          additionalProperties: false,
        },
      },
      {
        name: "get_descendants",
        description: "Get all descendants of an entity (children, grandchildren, etc.).",
        inputSchema: {
          type: "object",
          properties: {
            entityName: {
              type: "string",
              description: "Name of the entity to get descendants for"
            },
          },
          required: ["entityName"],
          additionalProperties: false,
        },
      },
      {
        name: "get_subtree",
        description: "Get the entire subtree rooted at an entity (entity + all descendants) with relations.",
        inputSchema: {
          type: "object",
          properties: {
            entityName: {
              type: "string",
              description: "Name of the root entity of the subtree"
            },
          },
          required: ["entityName"],
          additionalProperties: false,
        },
      },
      {
        name: "get_root_entities",
        description: "Get all root entities (entities with no parent).",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "get_entity_depth",
        description: "Get the depth of an entity in the hierarchy (0 for root, 1 for child of root, etc.).",
        inputSchema: {
          type: "object",
          properties: {
            entityName: {
              type: "string",
              description: "Name of the entity to get depth for"
            },
          },
          required: ["entityName"],
          additionalProperties: false,
        },
      },
      {
        name: "find_duplicates",
        description: "Find potential duplicate entities based on similarity threshold. Returns groups of similar entities.",
        inputSchema: {
          type: "object",
          properties: {
            threshold: {
              type: "number",
              description: "Similarity threshold (0.0 to 1.0), default 0.8. Higher = stricter matching",
              minimum: 0.0,
              maximum: 1.0
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "merge_entities",
        description: "Merge multiple entities into one, combining observations, tags, and relations. First entity in list is kept.",
        inputSchema: {
          type: "object",
          properties: {
            entityNames: {
              type: "array",
              items: { type: "string" },
              description: "Array of entity names to merge (minimum 2)"
            },
            targetName: {
              type: "string",
              description: "Optional new name for the merged entity"
            },
          },
          required: ["entityNames"],
          additionalProperties: false,
        },
      },
      {
        name: "compress_graph",
        description: "Automatically find and merge duplicate entities to compress the knowledge graph. Supports dry-run mode.",
        inputSchema: {
          type: "object",
          properties: {
            threshold: {
              type: "number",
              description: "Similarity threshold for duplicate detection (0.0 to 1.0), default 0.8",
              minimum: 0.0,
              maximum: 1.0
            },
            dryRun: {
              type: "boolean",
              description: "If true, preview changes without applying them. Default: false"
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "archive_entities",
        description: "Archive old or low-importance entities based on criteria. Removes them from active graph.",
        inputSchema: {
          type: "object",
          properties: {
            olderThan: {
              type: "string",
              description: "Archive entities last modified before this ISO date"
            },
            importanceLessThan: {
              type: "number",
              description: "Archive entities with importance less than this value (0-10)"
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Archive entities with any of these tags"
            },
            dryRun: {
              type: "boolean",
              description: "If true, preview what would be archived without applying. Default: false"
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "import_graph",
        description: "Import knowledge graph from JSON, CSV, or GraphML formats with configurable merge strategies. Supports dry-run mode for previewing changes before applying them.",
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["json", "csv", "graphml"],
              description: "Import format: 'json' (JSON data), 'csv' (spreadsheet with sections), 'graphml' (GraphML XML)"
            },
            data: {
              type: "string",
              description: "The import data as a string in the specified format"
            },
            mergeStrategy: {
              type: "string",
              enum: ["replace", "skip", "merge", "fail"],
              description: "How to handle existing entities: 'replace' (overwrite), 'skip' (keep existing), 'merge' (combine data), 'fail' (error on conflict). Default: 'skip'"
            },
            dryRun: {
              type: "boolean",
              description: "If true, preview changes without applying them. Default: false"
            },
          },
          required: ["format", "data"],
          additionalProperties: false,
        },
      },
      {
        name: "export_graph",
        description: "Export the knowledge graph in various formats (JSON, CSV, GraphML, GEXF, DOT, Markdown, Mermaid) with optional filtering. Multiple formats support different visualization and documentation tools.",
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["json", "csv", "graphml", "gexf", "dot", "markdown", "mermaid"],
              description: "Export format: 'json' (JSON data), 'csv' (spreadsheet), 'graphml' (Gephi/Cytoscape), 'gexf' (Gephi native), 'dot' (GraphViz), 'markdown' (documentation), 'mermaid' (diagrams)"
            },
            filter: {
              type: "object",
              properties: {
                startDate: {
                  type: "string",
                  description: "ISO 8601 start date for filtering (optional)"
                },
                endDate: {
                  type: "string",
                  description: "ISO 8601 end date for filtering (optional)"
                },
                entityType: {
                  type: "string",
                  description: "Filter by specific entity type (optional)"
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Filter by tags (optional, case-insensitive)"
                }
              },
              description: "Optional filter to export a subset of the graph"
            }
          },
          required: ["format"],
          additionalProperties: false,
        },
      }
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "read_graph") {
    return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.readGraph(), null, 2) }] };
  }

  if (name === "get_graph_stats") {
    return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getGraphStats(), null, 2) }] };
  }

  if (name === "validate_graph") {
    return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.validateGraph(), null, 2) }] };
  }

  if (name === "list_saved_searches") {
    return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.listSavedSearches(), null, 2) }] };
  }

  if (name === "list_tag_aliases") {
    return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.listTagAliases(), null, 2) }] };
  }

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  switch (name) {
    case "create_entities":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.createEntities(args.entities as Entity[]), null, 2) }] };
    case "create_relations":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.createRelations(args.relations as Relation[]), null, 2) }] };
    case "add_observations":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.addObservations(args.observations as { entityName: string; contents: string[] }[]), null, 2) }] };
    case "delete_entities":
      await knowledgeGraphManager.deleteEntities(args.entityNames as string[]);
      return { content: [{ type: "text", text: "Entities deleted successfully" }] };
    case "delete_observations":
      await knowledgeGraphManager.deleteObservations(args.deletions as { entityName: string; observations: string[] }[]);
      return { content: [{ type: "text", text: "Observations deleted successfully" }] };
    case "delete_relations":
      await knowledgeGraphManager.deleteRelations(args.relations as Relation[]);
      return { content: [{ type: "text", text: "Relations deleted successfully" }] };
    case "search_nodes":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.searchNodes(args.query as string, args.tags as string[] | undefined, args.minImportance as number | undefined, args.maxImportance as number | undefined), null, 2) }] };
    case "search_nodes_ranked":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.searchNodesRanked(args.query as string, args.tags as string[] | undefined, args.minImportance as number | undefined, args.maxImportance as number | undefined, args.limit as number | undefined), null, 2) }] };
    case "open_nodes":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.openNodes(args.names as string[]), null, 2) }] };
    case "search_by_date_range":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.searchByDateRange(args.startDate as string | undefined, args.endDate as string | undefined, args.entityType as string | undefined, args.tags as string[] | undefined), null, 2) }] };
    case "add_tags":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.addTags(args.entityName as string, args.tags as string[]), null, 2) }] };
    case "remove_tags":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.removeTags(args.entityName as string, args.tags as string[]), null, 2) }] };
    case "set_importance":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.setImportance(args.entityName as string, args.importance as number), null, 2) }] };
    case "add_tags_to_multiple_entities":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.addTagsToMultipleEntities(args.entityNames as string[], args.tags as string[]), null, 2) }] };
    case "replace_tag":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.replaceTag(args.oldTag as string, args.newTag as string), null, 2) }] };
    case "merge_tags":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.mergeTags(args.tag1 as string, args.tag2 as string, args.targetTag as string), null, 2) }] };
    case "save_search":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.saveSearch(args as Omit<SavedSearch, 'createdAt' | 'useCount' | 'lastUsed'>), null, 2) }] };
    case "execute_saved_search":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.executeSavedSearch(args.name as string), null, 2) }] };
    case "delete_saved_search":
      const deleted = await knowledgeGraphManager.deleteSavedSearch(args.name as string);
      return { content: [{ type: "text", text: deleted ? `Saved search "${args.name}" deleted successfully` : `Saved search "${args.name}" not found` }] };
    case "update_saved_search":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.updateSavedSearch(args.name as string, args.updates as any), null, 2) }] };
    case "boolean_search":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.booleanSearch(args.query as string, args.tags as string[] | undefined, args.minImportance as number | undefined, args.maxImportance as number | undefined), null, 2) }] };
    case "fuzzy_search":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.fuzzySearch(args.query as string, args.threshold as number | undefined, args.tags as string[] | undefined, args.minImportance as number | undefined, args.maxImportance as number | undefined), null, 2) }] };
    case "get_search_suggestions":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getSearchSuggestions(args.query as string, args.maxSuggestions as number | undefined), null, 2) }] };
    case "add_tag_alias":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.addTagAlias(args.alias as string, args.canonical as string, args.description as string | undefined), null, 2) }] };
    case "remove_tag_alias":
      const removed = await knowledgeGraphManager.removeTagAlias(args.alias as string);
      return { content: [{ type: "text", text: removed ? `Tag alias "${args.alias}" removed successfully` : `Tag alias "${args.alias}" not found` }] };
    case "get_aliases_for_tag":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getAliasesForTag(args.canonicalTag as string), null, 2) }] };
    case "resolve_tag":
      return { content: [{ type: "text", text: JSON.stringify({ tag: args.tag, resolved: await knowledgeGraphManager.resolveTag(args.tag as string) }, null, 2) }] };
    case "set_entity_parent":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.setEntityParent(args.entityName as string, args.parentName as string | null), null, 2) }] };
    case "get_children":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getChildren(args.entityName as string), null, 2) }] };
    case "get_parent":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getParent(args.entityName as string), null, 2) }] };
    case "get_ancestors":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getAncestors(args.entityName as string), null, 2) }] };
    case "get_descendants":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getDescendants(args.entityName as string), null, 2) }] };
    case "get_subtree":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getSubtree(args.entityName as string), null, 2) }] };
    case "get_root_entities":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.getRootEntities(), null, 2) }] };
    case "get_entity_depth":
      return { content: [{ type: "text", text: JSON.stringify({ entityName: args.entityName, depth: await knowledgeGraphManager.getEntityDepth(args.entityName as string) }, null, 2) }] };
    case "find_duplicates":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.findDuplicates(args.threshold as number | undefined), null, 2) }] };
    case "merge_entities":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.mergeEntities(args.entityNames as string[], args.targetName as string | undefined), null, 2) }] };
    case "compress_graph":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.compressGraph(args.threshold as number | undefined, args.dryRun as boolean | undefined), null, 2) }] };
    case "archive_entities":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.archiveEntities({ olderThan: args.olderThan as string | undefined, importanceLessThan: args.importanceLessThan as number | undefined, tags: args.tags as string[] | undefined }, args.dryRun as boolean | undefined), null, 2) }] };
    case "import_graph":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphManager.importGraph(args.format as 'json' | 'csv' | 'graphml', args.data as string, args.mergeStrategy as 'replace' | 'skip' | 'merge' | 'fail' | undefined, args.dryRun as boolean | undefined), null, 2) }] };
    case "export_graph":
      return { content: [{ type: "text", text: await knowledgeGraphManager.exportGraph(args.format as 'json' | 'csv' | 'graphml' | 'gexf' | 'dot' | 'markdown' | 'mermaid', args.filter as { startDate?: string; endDate?: string; entityType?: string; tags?: string[] } | undefined) }] };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  // Initialize memory file path with backward compatibility
  MEMORY_FILE_PATH = await ensureMemoryFilePath();

  // Initialize knowledge graph manager with the memory file path
  knowledgeGraphManager = new KnowledgeGraphManager(MEMORY_FILE_PATH);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Knowledge Graph MCP Server running on stdio');
}

main().catch((error) => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
