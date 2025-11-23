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
      console.error('DETECTED: Found legacy memory.json file, migrating to memory.jsonl for JSONL format compatibility');
      await fs.rename(oldMemoryPath, newMemoryPath);
      console.error('COMPLETED: Successfully migrated memory.json to memory.jsonl');
      return newMemoryPath;
    }
  } catch {
    // Old file doesn't exist, use new path
    return newMemoryPath;
  }
}

// Initialize memory file path (will be set during startup)
let MEMORY_FILE_PATH: string;

// We are storing our memory using entities, relations, and observations in a graph structure
export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  createdAt?: string;
  lastModified?: string;
  tags?: string[];
  importance?: number;
  parentId?: string;  // Phase 2: Hierarchical nesting - references parent entity name
}

export interface Relation {
  from: string;
  to: string;
  relationType: string;
  createdAt?: string;
  lastModified?: string;
}

export interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

export interface GraphStats {
  totalEntities: number;
  totalRelations: number;
  entityTypesCounts: Record<string, number>;
  relationTypesCounts: Record<string, number>;
  oldestEntity?: { name: string; date: string };
  newestEntity?: { name: string; date: string };
  oldestRelation?: { from: string; to: string; relationType: string; date: string };
  newestRelation?: { from: string; to: string; relationType: string; date: string };
  entityDateRange?: { earliest: string; latest: string };
  relationDateRange?: { earliest: string; latest: string };
}

export interface ValidationReport {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: {
    totalErrors: number;
    totalWarnings: number;
    orphanedRelationsCount: number;
    entitiesWithoutRelationsCount: number;
  };
}

export interface ValidationError {
  type: 'orphaned_relation' | 'duplicate_entity' | 'invalid_data';
  message: string;
  details?: any;
}

export interface ValidationWarning {
  type: 'isolated_entity' | 'empty_observations' | 'missing_metadata';
  message: string;
  details?: any;
}

export interface SavedSearch {
  name: string;
  description?: string;
  query: string;
  tags?: string[];
  minImportance?: number;
  maxImportance?: number;
  entityType?: string;
  createdAt: string;
  lastUsed?: string;
  useCount: number;
}

export interface TagAlias {
  alias: string;
  canonical: string;
  description?: string;
  createdAt: string;
}

export interface SearchResult {
  entity: Entity;
  score: number;
  matchedFields: {
    name?: boolean;
    entityType?: boolean;
    observations?: string[];
  };
}

// Boolean search query AST types
export type BooleanQueryNode =
  | { type: 'AND'; children: BooleanQueryNode[] }
  | { type: 'OR'; children: BooleanQueryNode[] }
  | { type: 'NOT'; child: BooleanQueryNode }
  | { type: 'TERM'; field?: string; value: string };

// Import result type
export interface ImportResult {
  entitiesAdded: number;
  entitiesSkipped: number;
  entitiesUpdated: number;
  relationsAdded: number;
  relationsSkipped: number;
  errors: string[];
}

// Phase 3: Compression result type
export interface CompressionResult {
  duplicatesFound: number;
  entitiesMerged: number;
  observationsCompressed: number;
  relationsConsolidated: number;
  spaceFreed: number;  // Approximate character count saved
  mergedEntities: Array<{ kept: string; merged: string[] }>;
}

// The KnowledgeGraphManager class contains all operations to interact with the knowledge graph
export class KnowledgeGraphManager {
  private savedSearchesFilePath: string;
  private tagAliasesFilePath: string;

  constructor(private memoryFilePath: string) {
    // Saved searches file is stored alongside the memory file
    const dir = path.dirname(memoryFilePath);
    const basename = path.basename(memoryFilePath, path.extname(memoryFilePath));
    this.savedSearchesFilePath = path.join(dir, `${basename}-saved-searches.jsonl`);
    this.tagAliasesFilePath = path.join(dir, `${basename}-tag-aliases.jsonl`);
  }

  // Tier 0 C2: Fuzzy search utilities using Levenshtein distance
  /**
   * Calculate Levenshtein distance between two strings
   * Returns the minimum number of single-character edits needed to change one word into another
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,    // deletion
            dp[i][j - 1] + 1,    // insertion
            dp[i - 1][j - 1] + 1 // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Check if two strings are fuzzy matches based on similarity threshold
   * @param str1 - First string to compare
   * @param str2 - Second string to compare
   * @param threshold - Similarity threshold (0.0 to 1.0), default 0.7
   * @returns true if strings are similar enough
   */
  private isFuzzyMatch(str1: string, str2: string, threshold: number = 0.7): boolean {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    // Exact match
    if (s1 === s2) return true;

    // One contains the other
    if (s1.includes(s2) || s2.includes(s1)) return true;

    // Calculate similarity using Levenshtein distance
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    const similarity = 1 - (distance / maxLength);

    return similarity >= threshold;
  }

  private async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const data = await fs.readFile(this.memoryFilePath, "utf-8");
      const lines = data.split("\n").filter(line => line.trim() !== "");
      return lines.reduce((graph: KnowledgeGraph, line) => {
        const item = JSON.parse(line);
        if (item.type === "entity") {
        // Add createdAt if missing for backward compatibility
        if (!item.createdAt) item.createdAt = new Date().toISOString();
        // Add lastModified if missing for backward compatibility
        if (!item.lastModified) item.lastModified = item.createdAt;
        // Phase 3: Backward compatibility for tags and importance
        // These fields are optional and will be undefined if not present
        graph.entities.push(item as Entity);
      }
        if (item.type === "relation") {
        // Add createdAt if missing for backward compatibility
        if (!item.createdAt) item.createdAt = new Date().toISOString();
        // Add lastModified if missing for backward compatibility
        if (!item.lastModified) item.lastModified = item.createdAt;
        graph.relations.push(item as Relation);
      }
        return graph;
      }, { entities: [], relations: [] });
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === "ENOENT") {
        return { entities: [], relations: [] };
      }
      throw error;
    }
  }

  private async saveGraph(graph: KnowledgeGraph): Promise<void> {
    const lines = [
      ...graph.entities.map(e => {
        const entityData: any = {
          type: "entity",
          name: e.name,
          entityType: e.entityType,
          observations: e.observations,
          createdAt: e.createdAt,
          lastModified: e.lastModified
        };
        // Phase 3: Only include tags and importance if they exist
        if (e.tags !== undefined) entityData.tags = e.tags;
        if (e.importance !== undefined) entityData.importance = e.importance;
        return JSON.stringify(entityData);
      }),
      ...graph.relations.map(r => JSON.stringify({
        type: "relation",
        from: r.from,
        to: r.to,
        relationType: r.relationType,
        createdAt: r.createdAt,
        lastModified: r.lastModified
      })),
    ];
    await fs.writeFile(this.memoryFilePath, lines.join("\n"));
  }

  /**
   * Phase 4: Create multiple entities in a single batch operation.
   * Batch optimization: All entities are processed and saved in a single saveGraph() call,
   * minimizing disk I/O. This is significantly more efficient than creating entities one at a time.
   */
  async createEntities(entities: Entity[]): Promise<Entity[]> {
    const graph = await this.loadGraph();
    const timestamp = new Date().toISOString();
    const newEntities = entities
      .filter(e => !graph.entities.some(existingEntity => existingEntity.name === e.name))
      .map(e => {
        const entity: Entity = {
          ...e,
          createdAt: e.createdAt || timestamp,
          lastModified: e.lastModified || timestamp
        };
        // Phase 3: Normalize tags to lowercase if provided
        if (e.tags) {
          entity.tags = e.tags.map(tag => tag.toLowerCase());
        }
        // Phase 3: Validate importance if provided
        if (e.importance !== undefined) {
          if (e.importance < 0 || e.importance > 10) {
            throw new Error(`Importance must be between 0 and 10, got ${e.importance}`);
          }
          entity.importance = e.importance;
        }
        return entity;
      });
    graph.entities.push(...newEntities);
    // Phase 4: Single save operation for all entities ensures batch efficiency
    await this.saveGraph(graph);
    return newEntities;
  }

  /**
   * Phase 4: Create multiple relations in a single batch operation.
   * Batch optimization: All relations are processed and saved in a single saveGraph() call,
   * minimizing disk I/O. This is significantly more efficient than creating relations one at a time.
   */
  async createRelations(relations: Relation[]): Promise<Relation[]> {
    const graph = await this.loadGraph();
    const timestamp = new Date().toISOString();
    const newRelations = relations
      .filter(r => !graph.relations.some(existingRelation =>
        existingRelation.from === r.from &&
        existingRelation.to === r.to &&
        existingRelation.relationType === r.relationType
      ))
      .map(r => ({ ...r, createdAt: r.createdAt || timestamp, lastModified: r.lastModified || timestamp }));
    graph.relations.push(...newRelations);
    // Phase 4: Single save operation for all relations ensures batch efficiency
    await this.saveGraph(graph);
    return newRelations;
  }

  async addObservations(observations: { entityName: string; contents: string[] }[]): Promise<{ entityName: string; addedObservations: string[] }[]> {
    const graph = await this.loadGraph();
    const timestamp = new Date().toISOString();
    const results = observations.map(o => {
      const entity = graph.entities.find(e => e.name === o.entityName);
      if (!entity) {
        throw new Error(`Entity with name ${o.entityName} not found`);
      }
      const newObservations = o.contents.filter(content => !entity.observations.includes(content));
      entity.observations.push(...newObservations);
      // Update lastModified timestamp if observations were added
      if (newObservations.length > 0) {
        entity.lastModified = timestamp;
      }
      return { entityName: o.entityName, addedObservations: newObservations };
    });
    await this.saveGraph(graph);
    return results;
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    const graph = await this.loadGraph();
    graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
    graph.relations = graph.relations.filter(r => !entityNames.includes(r.from) && !entityNames.includes(r.to));
    await this.saveGraph(graph);
  }

  async deleteObservations(deletions: { entityName: string; observations: string[] }[]): Promise<void> {
    const graph = await this.loadGraph();
    const timestamp = new Date().toISOString();
    deletions.forEach(d => {
      const entity = graph.entities.find(e => e.name === d.entityName);
      if (entity) {
        const originalLength = entity.observations.length;
        entity.observations = entity.observations.filter(o => !d.observations.includes(o));
        // Update lastModified timestamp if observations were deleted
        if (entity.observations.length < originalLength) {
          entity.lastModified = timestamp;
        }
      }
    });
    await this.saveGraph(graph);
  }

  async deleteRelations(relations: Relation[]): Promise<void> {
    const graph = await this.loadGraph();
    const timestamp = new Date().toISOString();

    // Track which entities are affected by relation deletions
    const affectedEntityNames = new Set<string>();
    relations.forEach(rel => {
      affectedEntityNames.add(rel.from);
      affectedEntityNames.add(rel.to);
    });

    graph.relations = graph.relations.filter(r => !relations.some(delRelation =>
      r.from === delRelation.from &&
      r.to === delRelation.to &&
      r.relationType === delRelation.relationType
    ));

    // Update lastModified for affected entities
    graph.entities.forEach(entity => {
      if (affectedEntityNames.has(entity.name)) {
        entity.lastModified = timestamp;
      }
    });

    await this.saveGraph(graph);
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
    const graph = await this.loadGraph();
    
    // Normalize tags to lowercase for case-insensitive matching
    const normalizedTags = tags?.map(tag => tag.toLowerCase());
    
    // Filter entities
    const filteredEntities = graph.entities.filter(e => {
      // Text search
      const matchesQuery = 
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        e.entityType.toLowerCase().includes(query.toLowerCase()) ||
        e.observations.some(o => o.toLowerCase().includes(query.toLowerCase()));
      
      if (!matchesQuery) return false;
      
      // Phase 3: Tag filter
      if (normalizedTags && normalizedTags.length > 0) {
        if (!e.tags || e.tags.length === 0) return false;
        const entityTags = e.tags.map(tag => tag.toLowerCase());
        const hasMatchingTag = normalizedTags.some(tag => entityTags.includes(tag));
        if (!hasMatchingTag) return false;
      }
      
      // Phase 3: Importance filter
      if (minImportance !== undefined && (e.importance === undefined || e.importance < minImportance)) {
        return false;
      }
      if (maxImportance !== undefined && (e.importance === undefined || e.importance > maxImportance)) {
        return false;
      }
      
      return true;
    });
  
    // Create a Set of filtered entity names for quick lookup
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));
  
    // Filter relations to only include those between filtered entities
    const filteredRelations = graph.relations.filter(r => 
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );
  
    const filteredGraph: KnowledgeGraph = {
      entities: filteredEntities,
      relations: filteredRelations,
    };
  
    return filteredGraph;
  }

  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    
    // Filter entities
    const filteredEntities = graph.entities.filter(e => names.includes(e.name));
  
    // Create a Set of filtered entity names for quick lookup
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));
  
    // Filter relations to only include those between filtered entities
    const filteredRelations = graph.relations.filter(r => 
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );
  
    const filteredGraph: KnowledgeGraph = {
      entities: filteredEntities,
      relations: filteredRelations,
    };
  
    return filteredGraph;
  }

  // Phase 3: Enhanced searchByDateRange with tags filter
  async searchByDateRange(
    startDate?: string,
    endDate?: string,
    entityType?: string,
    tags?: string[]
  ): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    // Normalize tags to lowercase for case-insensitive matching
    const normalizedTags = tags?.map(tag => tag.toLowerCase());

    // Filter entities by date range and optionally by entity type and tags
    const filteredEntities = graph.entities.filter(e => {
      // Check entity type filter
      if (entityType && e.entityType !== entityType) {
        return false;
      }

      // Phase 3: Tag filter
      if (normalizedTags && normalizedTags.length > 0) {
        if (!e.tags || e.tags.length === 0) return false;
        const entityTags = e.tags.map(tag => tag.toLowerCase());
        const hasMatchingTag = normalizedTags.some(tag => entityTags.includes(tag));
        if (!hasMatchingTag) return false;
      }

      // Check date range using createdAt or lastModified
      const entityDate = new Date(e.lastModified || e.createdAt || '');

      if (start && entityDate < start) {
        return false;
      }
      if (end && entityDate > end) {
        return false;
      }

      return true;
    });

    // Create a Set of filtered entity names for quick lookup
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));

    // Filter relations by date range and only include those between filtered entities
    const filteredRelations = graph.relations.filter(r => {
      // Must be between filtered entities
      if (!filteredEntityNames.has(r.from) || !filteredEntityNames.has(r.to)) {
        return false;
      }

      // Check date range using createdAt or lastModified
      const relationDate = new Date(r.lastModified || r.createdAt || '');

      if (start && relationDate < start) {
        return false;
      }
      if (end && relationDate > end) {
        return false;
      }

      return true;
    });

    return {
      entities: filteredEntities,
      relations: filteredRelations,
    };
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
    if (importance < 0 || importance > 10) {
      throw new Error(`Importance must be between 0 and 10, got ${importance}`);
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
    const graph = await this.loadGraph();

    // Normalize tags to lowercase for case-insensitive matching
    const normalizedTags = tags?.map(tag => tag.toLowerCase());

    // Filter entities using fuzzy matching
    const filteredEntities = graph.entities.filter(e => {
      // Fuzzy text search
      const matchesQuery =
        this.isFuzzyMatch(e.name, query, threshold) ||
        this.isFuzzyMatch(e.entityType, query, threshold) ||
        e.observations.some(o =>
          // For observations, split into words and check each word
          o.toLowerCase().split(/\s+/).some(word =>
            this.isFuzzyMatch(word, query, threshold)
          ) ||
          // Also check if the observation contains the query
          this.isFuzzyMatch(o, query, threshold)
        );

      if (!matchesQuery) return false;

      // Tag filter
      if (normalizedTags && normalizedTags.length > 0) {
        if (!e.tags || e.tags.length === 0) return false;
        const entityTags = e.tags.map(tag => tag.toLowerCase());
        const hasMatchingTag = normalizedTags.some(tag => entityTags.includes(tag));
        if (!hasMatchingTag) return false;
      }

      // Importance filter
      if (minImportance !== undefined && (e.importance === undefined || e.importance < minImportance)) {
        return false;
      }
      if (maxImportance !== undefined && (e.importance === undefined || e.importance > maxImportance)) {
        return false;
      }

      return true;
    });

    // Create a Set of filtered entity names for quick lookup
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));

    // Filter relations to only include those between filtered entities
    const filteredRelations = graph.relations.filter(r =>
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    return {
      entities: filteredEntities,
      relations: filteredRelations,
    };
  }

  /**
   * Get "did you mean?" suggestions for a query
   * @param query - The search query
   * @param maxSuggestions - Maximum number of suggestions to return
   * @returns Array of suggested entity/type names
   */
  async getSearchSuggestions(query: string, maxSuggestions: number = 5): Promise<string[]> {
    const graph = await this.loadGraph();
    const queryLower = query.toLowerCase();

    interface Suggestion {
      text: string;
      similarity: number;
    }

    const suggestions: Suggestion[] = [];

    // Check entity names
    for (const entity of graph.entities) {
      const distance = this.levenshteinDistance(queryLower, entity.name.toLowerCase());
      const maxLength = Math.max(queryLower.length, entity.name.length);
      const similarity = 1 - (distance / maxLength);

      if (similarity > 0.5 && similarity < 1.0) { // Not exact match but similar
        suggestions.push({ text: entity.name, similarity });
      }
    }

    // Check entity types
    const uniqueTypes = [...new Set(graph.entities.map(e => e.entityType))];
    for (const type of uniqueTypes) {
      const distance = this.levenshteinDistance(queryLower, type.toLowerCase());
      const maxLength = Math.max(queryLower.length, type.length);
      const similarity = 1 - (distance / maxLength);

      if (similarity > 0.5 && similarity < 1.0) {
        suggestions.push({ text: type, similarity });
      }
    }

    // Sort by similarity and return top suggestions
    return suggestions
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxSuggestions)
      .map(s => s.text);
  }

  // Tier 0 C1: Full-text search with TF-IDF ranking
  /**
   * Tokenize text into lowercase words, removing punctuation
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  /**
   * Calculate term frequency (TF) for a term in a document
   * TF = (number of times term appears) / (total terms in document)
   */
  private calculateTF(term: string, document: string[]): number {
    const termCount = document.filter(word => word === term).length;
    return document.length > 0 ? termCount / document.length : 0;
  }

  /**
   * Calculate inverse document frequency (IDF) for a term across all documents
   * IDF = log(total documents / documents containing term)
   */
  private calculateIDF(term: string, documents: string[][]): number {
    const docsWithTerm = documents.filter(doc => doc.includes(term)).length;
    if (docsWithTerm === 0) return 0;
    return Math.log(documents.length / docsWithTerm);
  }

  /**
   * Calculate TF-IDF score for a term in a document
   * TF-IDF = TF * IDF
   */
  private calculateTFIDF(term: string, document: string[], allDocuments: string[][]): number {
    const tf = this.calculateTF(term, document);
    const idf = this.calculateIDF(term, allDocuments);
    return tf * idf;
  }

  /**
   * Convert an entity to a searchable document (concatenated text)
   */
  private entityToDocument(entity: Entity): string {
    return [
      entity.name,
      entity.entityType,
      ...entity.observations
    ].join(' ');
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
    limit: number = 50
  ): Promise<SearchResult[]> {
    const graph = await this.loadGraph();

    // Normalize tags to lowercase for case-insensitive matching
    const normalizedTags = tags?.map(tag => tag.toLowerCase());

    // Tokenize query
    const queryTerms = this.tokenize(query);

    if (queryTerms.length === 0) {
      return [];
    }

    // Convert all entities to tokenized documents
    const allDocuments = graph.entities.map(e => this.tokenize(this.entityToDocument(e)));

    // Calculate scores for each entity
    const results: SearchResult[] = [];

    for (let i = 0; i < graph.entities.length; i++) {
      const entity = graph.entities[i];
      const document = allDocuments[i];

      // Apply tag filter
      if (normalizedTags && normalizedTags.length > 0) {
        if (!entity.tags || entity.tags.length === 0) continue;
        const entityTags = entity.tags.map(tag => tag.toLowerCase());
        const hasMatchingTag = normalizedTags.some(tag => entityTags.includes(tag));
        if (!hasMatchingTag) continue;
      }

      // Apply importance filter
      if (minImportance !== undefined && (entity.importance === undefined || entity.importance < minImportance)) {
        continue;
      }
      if (maxImportance !== undefined && (entity.importance === undefined || entity.importance > maxImportance)) {
        continue;
      }

      // Calculate TF-IDF score for each query term
      let totalScore = 0;
      const matchedFields: SearchResult['matchedFields'] = {};

      for (const term of queryTerms) {
        const tfidf = this.calculateTFIDF(term, document, allDocuments);
        totalScore += tfidf;

        // Track which fields matched
        const nameLower = entity.name.toLowerCase();
        const typeLower = entity.entityType.toLowerCase();

        if (nameLower.includes(term)) {
          matchedFields.name = true;
        }
        if (typeLower.includes(term)) {
          matchedFields.entityType = true;
        }

        const matchedObs = entity.observations.filter(obs =>
          obs.toLowerCase().includes(term)
        );
        if (matchedObs.length > 0) {
          if (!matchedFields.observations) {
            matchedFields.observations = [];
          }
          matchedFields.observations.push(...matchedObs);
        }
      }

      // Only include entities with non-zero scores
      if (totalScore > 0) {
        results.push({
          entity,
          score: totalScore,
          matchedFields
        });
      }
    }

    // Sort by score (descending) and apply limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // Tier 0 C3: Boolean search with query parser
  /**
   * Tokenize a boolean search query into tokens
   */
  private tokenizeBooleanQuery(query: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < query.length; i++) {
      const char = query[i];

      if (char === '"') {
        if (inQuotes) {
          // End of quoted string
          tokens.push(current);
          current = '';
          inQuotes = false;
        } else {
          // Start of quoted string
          if (current.trim()) {
            tokens.push(current.trim());
            current = '';
          }
          inQuotes = true;
        }
      } else if (!inQuotes && (char === '(' || char === ')')) {
        // Parentheses are separate tokens
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        tokens.push(char);
      } else if (!inQuotes && /\s/.test(char)) {
        // Whitespace outside quotes
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      tokens.push(current.trim());
    }

    return tokens;
  }

  /**
   * Parse a boolean search query into an AST
   * Supports: AND, OR, NOT, parentheses, field-specific queries (field:value)
   */
  private parseBooleanQuery(query: string): BooleanQueryNode {
    const tokens = this.tokenizeBooleanQuery(query);
    let position = 0;

    const peek = (): string | undefined => tokens[position];
    const consume = (): string | undefined => tokens[position++];

    // Parse OR expressions (lowest precedence)
    const parseOr = (): BooleanQueryNode => {
      let left = parseAnd();

      while (peek()?.toUpperCase() === 'OR') {
        consume(); // consume 'OR'
        const right = parseAnd();
        left = { type: 'OR', children: [left, right] };
      }

      return left;
    };

    // Parse AND expressions
    const parseAnd = (): BooleanQueryNode => {
      let left = parseNot();

      while (peek() && peek()?.toUpperCase() !== 'OR' && peek() !== ')') {
        // Implicit AND if next token is not OR or )
        if (peek()?.toUpperCase() === 'AND') {
          consume(); // consume 'AND'
        }
        const right = parseNot();
        left = { type: 'AND', children: [left, right] };
      }

      return left;
    };

    // Parse NOT expressions
    const parseNot = (): BooleanQueryNode => {
      if (peek()?.toUpperCase() === 'NOT') {
        consume(); // consume 'NOT'
        const child = parseNot();
        return { type: 'NOT', child };
      }
      return parsePrimary();
    };

    // Parse primary expressions (terms, field queries, parentheses)
    const parsePrimary = (): BooleanQueryNode => {
      const token = peek();

      if (!token) {
        throw new Error('Unexpected end of query');
      }

      // Parentheses
      if (token === '(') {
        consume(); // consume '('
        const node = parseOr();
        if (consume() !== ')') {
          throw new Error('Expected closing parenthesis');
        }
        return node;
      }

      // Field-specific query (field:value)
      if (token.includes(':')) {
        consume();
        const [field, ...valueParts] = token.split(':');
        const value = valueParts.join(':'); // Handle colons in value
        return { type: 'TERM', field: field.toLowerCase(), value: value.toLowerCase() };
      }

      // Regular term
      consume();
      return { type: 'TERM', value: token.toLowerCase() };
    };

    const result = parseOr();

    // Check for unconsumed tokens
    if (position < tokens.length) {
      throw new Error(`Unexpected token: ${tokens[position]}`);
    }

    return result;
  }

  /**
   * Evaluate a boolean query AST against an entity
   */
  private evaluateBooleanQuery(node: BooleanQueryNode, entity: Entity): boolean {
    switch (node.type) {
      case 'AND':
        return node.children.every(child => this.evaluateBooleanQuery(child, entity));

      case 'OR':
        return node.children.some(child => this.evaluateBooleanQuery(child, entity));

      case 'NOT':
        return !this.evaluateBooleanQuery(node.child, entity);

      case 'TERM': {
        const value = node.value;

        // Field-specific search
        if (node.field) {
          switch (node.field) {
            case 'name':
              return entity.name.toLowerCase().includes(value);
            case 'type':
            case 'entitytype':
              return entity.entityType.toLowerCase().includes(value);
            case 'observation':
            case 'observations':
              return entity.observations.some(obs => obs.toLowerCase().includes(value));
            case 'tag':
            case 'tags':
              return entity.tags ? entity.tags.some(tag => tag.toLowerCase().includes(value)) : false;
            default:
              // Unknown field, search all text fields
              return this.entityMatchesTerm(entity, value);
          }
        }

        // General search across all fields
        return this.entityMatchesTerm(entity, value);
      }
    }
  }

  /**
   * Check if entity matches a search term in any text field
   */
  private entityMatchesTerm(entity: Entity, term: string): boolean {
    const termLower = term.toLowerCase();

    return (
      entity.name.toLowerCase().includes(termLower) ||
      entity.entityType.toLowerCase().includes(termLower) ||
      entity.observations.some(obs => obs.toLowerCase().includes(termLower)) ||
      (entity.tags?.some(tag => tag.toLowerCase().includes(termLower)) || false)
    );
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
    const graph = await this.loadGraph();

    // Parse the query into an AST
    let queryAst: BooleanQueryNode;
    try {
      queryAst = this.parseBooleanQuery(query);
    } catch (error) {
      throw new Error(`Failed to parse boolean query: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Normalize tags to lowercase for case-insensitive matching
    const normalizedTags = tags?.map(tag => tag.toLowerCase());

    // Filter entities
    const filteredEntities = graph.entities.filter(e => {
      // Evaluate boolean query
      if (!this.evaluateBooleanQuery(queryAst, e)) {
        return false;
      }

      // Apply tag filter
      if (normalizedTags && normalizedTags.length > 0) {
        if (!e.tags || e.tags.length === 0) return false;
        const entityTags = e.tags.map(tag => tag.toLowerCase());
        const hasMatchingTag = normalizedTags.some(tag => entityTags.includes(tag));
        if (!hasMatchingTag) return false;
      }

      // Apply importance filter
      if (minImportance !== undefined && (e.importance === undefined || e.importance < minImportance)) {
        return false;
      }
      if (maxImportance !== undefined && (e.importance === undefined || e.importance > maxImportance)) {
        return false;
      }

      return true;
    });

    // Create a Set of filtered entity names for quick lookup
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));

    // Filter relations to only include those between filtered entities
    const filteredRelations = graph.relations.filter(r =>
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    return {
      entities: filteredEntities,
      relations: filteredRelations,
    };
  }

  // Phase 2: Hierarchical nesting - hierarchy navigation methods
  /**
   * Set the parent of an entity (creates hierarchy relationship)
   * @param entityName - Name of the entity to set parent for
   * @param parentName - Name of the parent entity (or null to remove parent)
   * @returns Updated entity
   */
  async setEntityParent(entityName: string, parentName: string | null): Promise<Entity> {
    const graph = await this.loadGraph();
    const entity = graph.entities.find(e => e.name === entityName);

    if (!entity) {
      throw new Error(`Entity "${entityName}" not found`);
    }

    // If setting a parent, validate it exists and doesn't create a cycle
    if (parentName !== null) {
      const parent = graph.entities.find(e => e.name === parentName);
      if (!parent) {
        throw new Error(`Parent entity "${parentName}" not found`);
      }

      // Check for cycles
      if (this.wouldCreateCycle(graph, entityName, parentName)) {
        throw new Error(`Setting parent "${parentName}" for entity "${entityName}" would create a cycle`);
      }
    }

    entity.parentId = parentName || undefined;
    entity.lastModified = new Date().toISOString();

    await this.saveGraph(graph);
    return entity;
  }

  /**
   * Check if setting a parent would create a cycle in the hierarchy
   */
  private wouldCreateCycle(graph: KnowledgeGraph, entityName: string, parentName: string): boolean {
    const visited = new Set<string>();
    let current: string | undefined = parentName;

    while (current) {
      if (visited.has(current)) {
        return true; // Cycle detected in existing hierarchy
      }
      if (current === entityName) {
        return true; // Would create a cycle
      }
      visited.add(current);

      const currentEntity = graph.entities.find(e => e.name === current);
      current = currentEntity?.parentId;
    }

    return false;
  }

  /**
   * Get the immediate children of an entity
   */
  async getChildren(entityName: string): Promise<Entity[]> {
    const graph = await this.loadGraph();

    // Verify entity exists
    if (!graph.entities.find(e => e.name === entityName)) {
      throw new Error(`Entity "${entityName}" not found`);
    }

    return graph.entities.filter(e => e.parentId === entityName);
  }

  /**
   * Get the parent of an entity
   */
  async getParent(entityName: string): Promise<Entity | null> {
    const graph = await this.loadGraph();
    const entity = graph.entities.find(e => e.name === entityName);

    if (!entity) {
      throw new Error(`Entity "${entityName}" not found`);
    }

    if (!entity.parentId) {
      return null;
    }

    const parent = graph.entities.find(e => e.name === entity.parentId);
    return parent || null;
  }

  /**
   * Get all ancestors of an entity (parent, grandparent, etc.)
   */
  async getAncestors(entityName: string): Promise<Entity[]> {
    const graph = await this.loadGraph();
    const ancestors: Entity[] = [];

    let current = graph.entities.find(e => e.name === entityName);
    if (!current) {
      throw new Error(`Entity "${entityName}" not found`);
    }

    while (current.parentId) {
      const parent = graph.entities.find(e => e.name === current!.parentId);
      if (!parent) break;
      ancestors.push(parent);
      current = parent;
    }

    return ancestors;
  }

  /**
   * Get all descendants of an entity (children, grandchildren, etc.)
   */
  async getDescendants(entityName: string): Promise<Entity[]> {
    const graph = await this.loadGraph();

    // Verify entity exists
    if (!graph.entities.find(e => e.name === entityName)) {
      throw new Error(`Entity "${entityName}" not found`);
    }

    const descendants: Entity[] = [];
    const toProcess = [entityName];

    while (toProcess.length > 0) {
      const current = toProcess.shift()!;
      const children = graph.entities.filter(e => e.parentId === current);

      for (const child of children) {
        descendants.push(child);
        toProcess.push(child.name);
      }
    }

    return descendants;
  }

  /**
   * Get the entire subtree rooted at an entity (entity + all descendants)
   */
  async getSubtree(entityName: string): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    const entity = graph.entities.find(e => e.name === entityName);

    if (!entity) {
      throw new Error(`Entity "${entityName}" not found`);
    }

    const descendants = await this.getDescendants(entityName);
    const subtreeEntities = [entity, ...descendants];
    const subtreeEntityNames = new Set(subtreeEntities.map(e => e.name));

    // Include relations between entities in the subtree
    const subtreeRelations = graph.relations.filter(r =>
      subtreeEntityNames.has(r.from) && subtreeEntityNames.has(r.to)
    );

    return {
      entities: subtreeEntities,
      relations: subtreeRelations
    };
  }

  /**
   * Get root entities (entities with no parent)
   */
  async getRootEntities(): Promise<Entity[]> {
    const graph = await this.loadGraph();
    return graph.entities.filter(e => !e.parentId);
  }

  /**
   * Get the depth of an entity in the hierarchy (0 for root, 1 for child of root, etc.)
   */
  async getEntityDepth(entityName: string): Promise<number> {
    const ancestors = await this.getAncestors(entityName);
    return ancestors.length;
  }

  /**
   * Move an entity to a new parent (maintaining its descendants)
   */
  async moveEntity(entityName: string, newParentName: string | null): Promise<Entity> {
    return await this.setEntityParent(entityName, newParentName);
  }

  // Phase 3: Memory compression - duplicate detection and merging
  /**
   * Calculate similarity between two entities using multiple heuristics
   * Returns a score from 0 (completely different) to 1 (identical)
   */
  private calculateEntitySimilarity(e1: Entity, e2: Entity): number {
    let score = 0;
    let factors = 0;

    // Name similarity (Levenshtein-based)
    const nameDistance = this.levenshteinDistance(e1.name.toLowerCase(), e2.name.toLowerCase());
    const maxNameLength = Math.max(e1.name.length, e2.name.length);
    const nameSimilarity = 1 - (nameDistance / maxNameLength);
    score += nameSimilarity * 0.4;  // 40% weight
    factors += 0.4;

    // Type similarity (exact match)
    if (e1.entityType.toLowerCase() === e2.entityType.toLowerCase()) {
      score += 0.2;  // 20% weight
    }
    factors += 0.2;

    // Observation overlap
    const obs1Set = new Set(e1.observations.map(o => o.toLowerCase()));
    const obs2Set = new Set(e2.observations.map(o => o.toLowerCase()));
    const intersection = new Set([...obs1Set].filter(x => obs2Set.has(x)));
    const union = new Set([...obs1Set, ...obs2Set]);
    const observationSimilarity = union.size > 0 ? intersection.size / union.size : 0;
    score += observationSimilarity * 0.3;  // 30% weight
    factors += 0.3;

    // Tag overlap
    if (e1.tags && e2.tags && (e1.tags.length > 0 || e2.tags.length > 0)) {
      const tags1Set = new Set(e1.tags.map(t => t.toLowerCase()));
      const tags2Set = new Set(e2.tags.map(t => t.toLowerCase()));
      const tagIntersection = new Set([...tags1Set].filter(x => tags2Set.has(x)));
      const tagUnion = new Set([...tags1Set, ...tags2Set]);
      const tagSimilarity = tagUnion.size > 0 ? tagIntersection.size / tagUnion.size : 0;
      score += tagSimilarity * 0.1;  // 10% weight
      factors += 0.1;
    }

    return factors > 0 ? score / factors : 0;
  }

  /**
   * Find duplicate entities in the graph based on similarity threshold
   * @param threshold - Similarity threshold (0.0 to 1.0), default 0.8
   * @returns Array of duplicate groups (each group has similar entities)
   */
  async findDuplicates(threshold: number = 0.8): Promise<string[][]> {
    const graph = await this.loadGraph();
    const duplicateGroups: string[][] = [];
    const processed = new Set<string>();

    for (let i = 0; i < graph.entities.length; i++) {
      const entity1 = graph.entities[i];
      if (processed.has(entity1.name)) continue;

      const group: string[] = [entity1.name];

      for (let j = i + 1; j < graph.entities.length; j++) {
        const entity2 = graph.entities[j];
        if (processed.has(entity2.name)) continue;

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

    return duplicateGroups;
  }

  /**
   * Merge a group of entities into a single entity
   * @param entityNames - Names of entities to merge (first one is kept)
   * @param targetName - Optional new name for merged entity (default: first entity name)
   * @returns The merged entity
   */
  async mergeEntities(entityNames: string[], targetName?: string): Promise<Entity> {
    if (entityNames.length < 2) {
      throw new Error('At least 2 entities required for merging');
    }

    const graph = await this.loadGraph();
    const entitiesToMerge = entityNames.map(name => {
      const entity = graph.entities.find(e => e.name === name);
      if (!entity) {
        throw new Error(`Entity "${name}" not found`);
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

    await this.saveGraph(graph);
    return keepEntity;
  }

  /**
   * Compress the knowledge graph by finding and merging duplicates
   * @param threshold - Similarity threshold for duplicate detection (0.0 to 1.0)
   * @param dryRun - If true, only report what would be compressed without applying changes
   * @returns Compression result with statistics
   */
  async compressGraph(threshold: number = 0.8, dryRun: boolean = false): Promise<CompressionResult> {
    const initialGraph = await this.loadGraph();
    const initialSize = JSON.stringify(initialGraph).length;

    const duplicateGroups = await this.findDuplicates(threshold);
    const result: CompressionResult = {
      duplicatesFound: duplicateGroups.reduce((sum, group) => sum + group.length, 0),
      entitiesMerged: 0,
      observationsCompressed: 0,
      relationsConsolidated: 0,
      spaceFreed: 0,
      mergedEntities: []
    };

    if (dryRun) {
      // Just report what would happen
      for (const group of duplicateGroups) {
        result.mergedEntities.push({
          kept: group[0],
          merged: group.slice(1)
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
          merged: group.slice(1)
        });
        result.entitiesMerged += group.length - 1;
      } catch (error) {
        // Skip groups that fail to merge
        console.error(`Failed to merge group ${group}:`, error);
      }
    }

    // Calculate space saved
    const finalGraph = await this.loadGraph();
    const finalSize = JSON.stringify(finalGraph).length;
    result.spaceFreed = initialSize - finalSize;

    // Count compressed observations (removed duplicates)
    result.observationsCompressed = result.entitiesMerged; // Approximation

    return result;
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

    switch (format) {
      case 'json':
        return this.exportAsJson(graph);
      case 'csv':
        return this.exportAsCsv(graph);
      case 'graphml':
        return this.exportAsGraphML(graph);
      case 'gexf':
        return this.exportAsGEXF(graph);
      case 'dot':
        return this.exportAsDOT(graph);
      case 'markdown':
        return this.exportAsMarkdown(graph);
      case 'mermaid':
        return this.exportAsMermaid(graph);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export graph as pretty-printed JSON with all entity and relation data
   */
  private exportAsJson(graph: KnowledgeGraph): string {
    return JSON.stringify(graph, null, 2);
  }

  /**
   * Export graph as CSV with two sections: entities and relations
   * Uses proper escaping for fields containing commas, quotes, and newlines
   */
  private exportAsCsv(graph: KnowledgeGraph): string {
    const lines: string[] = [];

    // Helper function to escape CSV fields
    const escapeCsvField = (field: string | undefined | null): string => {
      if (field === undefined || field === null) return '';
      const str = String(field);
      // Escape quotes by doubling them and wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Entities section
    lines.push('# ENTITIES');
    lines.push('name,entityType,observations,createdAt,lastModified,tags,importance');

    for (const entity of graph.entities) {
      const observationsStr = entity.observations.join('; ');
      const tagsStr = entity.tags ? entity.tags.join('; ') : '';
      const importanceStr = entity.importance !== undefined ? String(entity.importance) : '';

      lines.push([
        escapeCsvField(entity.name),
        escapeCsvField(entity.entityType),
        escapeCsvField(observationsStr),
        escapeCsvField(entity.createdAt),
        escapeCsvField(entity.lastModified),
        escapeCsvField(tagsStr),
        escapeCsvField(importanceStr)
      ].join(','));
    }

    // Relations section
    lines.push('');
    lines.push('# RELATIONS');
    lines.push('from,to,relationType,createdAt,lastModified');

    for (const relation of graph.relations) {
      lines.push([
        escapeCsvField(relation.from),
        escapeCsvField(relation.to),
        escapeCsvField(relation.relationType),
        escapeCsvField(relation.createdAt),
        escapeCsvField(relation.lastModified)
      ].join(','));
    }

    return lines.join('\n');
  }

  /**
   * Export graph as GraphML XML format for graph visualization tools
   * Compatible with Gephi, Cytoscape, yEd, and other graph analysis tools
   */
  private exportAsGraphML(graph: KnowledgeGraph): string {
    const lines: string[] = [];

    // Helper function to escape XML special characters
    const escapeXml = (str: string | undefined | null): string => {
      if (str === undefined || str === null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    // GraphML header
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<graphml xmlns="http://graphml.graphdrawing.org/xmlns"');
    lines.push('         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
    lines.push('         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns');
    lines.push('         http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">');

    // Define node attributes (keys)
    lines.push('  <!-- Node attributes -->');
    lines.push('  <key id="d0" for="node" attr.name="entityType" attr.type="string"/>');
    lines.push('  <key id="d1" for="node" attr.name="observations" attr.type="string"/>');
    lines.push('  <key id="d2" for="node" attr.name="createdAt" attr.type="string"/>');
    lines.push('  <key id="d3" for="node" attr.name="lastModified" attr.type="string"/>');
    lines.push('  <key id="d4" for="node" attr.name="tags" attr.type="string"/>');
    lines.push('  <key id="d5" for="node" attr.name="importance" attr.type="double"/>');

    // Define edge attributes (keys)
    lines.push('  <!-- Edge attributes -->');
    lines.push('  <key id="e0" for="edge" attr.name="relationType" attr.type="string"/>');
    lines.push('  <key id="e1" for="edge" attr.name="createdAt" attr.type="string"/>');
    lines.push('  <key id="e2" for="edge" attr.name="lastModified" attr.type="string"/>');

    // Start graph (directed graph)
    lines.push('  <graph id="G" edgedefault="directed">');

    // Add nodes (entities)
    for (const entity of graph.entities) {
      // Use entity name as node ID (escape for XML attribute)
      const nodeId = escapeXml(entity.name);
      lines.push(`    <node id="${nodeId}">`);
      lines.push(`      <data key="d0">${escapeXml(entity.entityType)}</data>`);
      lines.push(`      <data key="d1">${escapeXml(entity.observations.join('; '))}</data>`);
      if (entity.createdAt) {
        lines.push(`      <data key="d2">${escapeXml(entity.createdAt)}</data>`);
      }
      if (entity.lastModified) {
        lines.push(`      <data key="d3">${escapeXml(entity.lastModified)}</data>`);
      }
      if (entity.tags && entity.tags.length > 0) {
        lines.push(`      <data key="d4">${escapeXml(entity.tags.join('; '))}</data>`);
      }
      if (entity.importance !== undefined) {
        lines.push(`      <data key="d5">${entity.importance}</data>`);
      }
      lines.push('    </node>');
    }

    // Add edges (relations)
    let edgeId = 0;
    for (const relation of graph.relations) {
      const sourceId = escapeXml(relation.from);
      const targetId = escapeXml(relation.to);
      lines.push(`    <edge id="e${edgeId}" source="${sourceId}" target="${targetId}">`);
      lines.push(`      <data key="e0">${escapeXml(relation.relationType)}</data>`);
      if (relation.createdAt) {
        lines.push(`      <data key="e1">${escapeXml(relation.createdAt)}</data>`);
      }
      if (relation.lastModified) {
        lines.push(`      <data key="e2">${escapeXml(relation.lastModified)}</data>`);
      }
      lines.push('    </edge>');
      edgeId++;
    }

    // Close graph and graphml
    lines.push('  </graph>');
    lines.push('</graphml>');

    return lines.join('\n');
  }

  /**
   * Export graph as GEXF (Graph Exchange XML Format) for Gephi
   * GEXF is the native format for Gephi and supports dynamic graphs
   */
  private exportAsGEXF(graph: KnowledgeGraph): string {
    const lines: string[] = [];

    // Helper function to escape XML special characters
    const escapeXml = (str: string | undefined | null): string => {
      if (str === undefined || str === null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    // GEXF header
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<gexf xmlns="http://www.gexf.net/1.2draft" version="1.2">');
    lines.push('  <meta>');
    lines.push(`    <creator>Memory MCP Server</creator>`);
    lines.push(`    <description>Knowledge Graph Export</description>`);
    lines.push('  </meta>');
    lines.push('  <graph mode="static" defaultedgetype="directed">');

    // Define node attributes
    lines.push('    <attributes class="node">');
    lines.push('      <attribute id="0" title="entityType" type="string"/>');
    lines.push('      <attribute id="1" title="observations" type="string"/>');
    lines.push('      <attribute id="2" title="createdAt" type="string"/>');
    lines.push('      <attribute id="3" title="lastModified" type="string"/>');
    lines.push('      <attribute id="4" title="tags" type="string"/>');
    lines.push('      <attribute id="5" title="importance" type="double"/>');
    lines.push('    </attributes>');

    // Define edge attributes
    lines.push('    <attributes class="edge">');
    lines.push('      <attribute id="0" title="relationType" type="string"/>');
    lines.push('      <attribute id="1" title="createdAt" type="string"/>');
    lines.push('      <attribute id="2" title="lastModified" type="string"/>');
    lines.push('    </attributes>');

    // Add nodes
    lines.push('    <nodes>');
    for (const entity of graph.entities) {
      const nodeId = escapeXml(entity.name);
      lines.push(`      <node id="${nodeId}" label="${nodeId}">`);
      lines.push('        <attvalues>');
      lines.push(`          <attvalue for="0" value="${escapeXml(entity.entityType)}"/>`);
      lines.push(`          <attvalue for="1" value="${escapeXml(entity.observations.join('; '))}"/>`);
      if (entity.createdAt) {
        lines.push(`          <attvalue for="2" value="${escapeXml(entity.createdAt)}"/>`);
      }
      if (entity.lastModified) {
        lines.push(`          <attvalue for="3" value="${escapeXml(entity.lastModified)}"/>`);
      }
      if (entity.tags && entity.tags.length > 0) {
        lines.push(`          <attvalue for="4" value="${escapeXml(entity.tags.join('; '))}"/>`);
      }
      if (entity.importance !== undefined) {
        lines.push(`          <attvalue for="5" value="${entity.importance}"/>`);
      }
      lines.push('        </attvalues>');
      lines.push('      </node>');
    }
    lines.push('    </nodes>');

    // Add edges
    lines.push('    <edges>');
    let edgeId = 0;
    for (const relation of graph.relations) {
      const sourceId = escapeXml(relation.from);
      const targetId = escapeXml(relation.to);
      lines.push(`      <edge id="${edgeId}" source="${sourceId}" target="${targetId}">`);
      lines.push('        <attvalues>');
      lines.push(`          <attvalue for="0" value="${escapeXml(relation.relationType)}"/>`);
      if (relation.createdAt) {
        lines.push(`          <attvalue for="1" value="${escapeXml(relation.createdAt)}"/>`);
      }
      if (relation.lastModified) {
        lines.push(`          <attvalue for="2" value="${escapeXml(relation.lastModified)}"/>`);
      }
      lines.push('        </attvalues>');
      lines.push('      </edge>');
      edgeId++;
    }
    lines.push('    </edges>');

    lines.push('  </graph>');
    lines.push('</gexf>');

    return lines.join('\n');
  }

  /**
   * Export graph as DOT format for GraphViz
   * DOT is a plain text graph description language
   */
  private exportAsDOT(graph: KnowledgeGraph): string {
    const lines: string[] = [];

    // Helper function to escape DOT identifiers and strings
    const escapeDot = (str: string): string => {
      return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
    };

    // DOT header
    lines.push('digraph KnowledgeGraph {');
    lines.push('  rankdir=LR;');
    lines.push('  node [shape=box, style=rounded];');
    lines.push('');

    // Add nodes
    for (const entity of graph.entities) {
      const nodeId = escapeDot(entity.name);
      const label = [
        `${entity.name}`,
        `Type: ${entity.entityType}`,
      ];

      if (entity.tags && entity.tags.length > 0) {
        label.push(`Tags: ${entity.tags.join(', ')}`);
      }
      if (entity.importance !== undefined) {
        label.push(`Importance: ${entity.importance}`);
      }
      if (entity.observations.length > 0) {
        label.push(`Observations: ${entity.observations.length}`);
      }

      const labelStr = escapeDot(label.join('\\n'));
      lines.push(`  ${nodeId} [label=${labelStr}];`);
    }

    lines.push('');

    // Add edges
    for (const relation of graph.relations) {
      const fromId = escapeDot(relation.from);
      const toId = escapeDot(relation.to);
      const label = escapeDot(relation.relationType);
      lines.push(`  ${fromId} -> ${toId} [label=${label}];`);
    }

    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Export graph as Markdown for human-readable documentation
   */
  private exportAsMarkdown(graph: KnowledgeGraph): string {
    const lines: string[] = [];

    lines.push('# Knowledge Graph Export');
    lines.push('');
    lines.push(`**Exported:** ${new Date().toISOString()}`);
    lines.push(`**Entities:** ${graph.entities.length}`);
    lines.push(`**Relations:** ${graph.relations.length}`);
    lines.push('');

    // Entities section
    lines.push('## Entities');
    lines.push('');

    for (const entity of graph.entities) {
      lines.push(`### ${entity.name}`);
      lines.push('');
      lines.push(`- **Type:** ${entity.entityType}`);

      if (entity.tags && entity.tags.length > 0) {
        lines.push(`- **Tags:** ${entity.tags.map(t => `\`${t}\``).join(', ')}`);
      }

      if (entity.importance !== undefined) {
        lines.push(`- **Importance:** ${entity.importance}/10`);
      }

      if (entity.createdAt) {
        lines.push(`- **Created:** ${entity.createdAt}`);
      }

      if (entity.lastModified) {
        lines.push(`- **Modified:** ${entity.lastModified}`);
      }

      if (entity.observations.length > 0) {
        lines.push('');
        lines.push('**Observations:**');
        for (const obs of entity.observations) {
          lines.push(`- ${obs}`);
        }
      }

      lines.push('');
    }

    // Relations section
    if (graph.relations.length > 0) {
      lines.push('## Relations');
      lines.push('');

      for (const relation of graph.relations) {
        lines.push(`- **${relation.from}** → *${relation.relationType}* → **${relation.to}**`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Export graph as Mermaid diagram syntax
   * Can be rendered in GitHub, GitLab, and many documentation tools
   */
  private exportAsMermaid(graph: KnowledgeGraph): string {
    const lines: string[] = [];

    // Helper to sanitize node IDs for Mermaid
    const sanitizeId = (str: string): string => {
      return str.replace(/[^a-zA-Z0-9_]/g, '_');
    };

    // Helper to escape text in labels
    const escapeLabel = (str: string): string => {
      return str.replace(/"/g, '#quot;');
    };

    lines.push('graph LR');
    lines.push('  %% Knowledge Graph');
    lines.push('');

    // Create node ID mapping
    const nodeIds = new Map<string, string>();
    for (const entity of graph.entities) {
      nodeIds.set(entity.name, sanitizeId(entity.name));
    }

    // Add nodes with labels
    for (const entity of graph.entities) {
      const nodeId = nodeIds.get(entity.name)!;
      const labelParts: string[] = [entity.name];

      if (entity.entityType) {
        labelParts.push(`Type: ${entity.entityType}`);
      }

      if (entity.tags && entity.tags.length > 0) {
        labelParts.push(`Tags: ${entity.tags.join(', ')}`);
      }

      const label = escapeLabel(labelParts.join('<br/>'));
      lines.push(`  ${nodeId}["${label}"]`);

      // Add styling based on importance
      if (entity.importance !== undefined) {
        if (entity.importance >= 7) {
          lines.push(`  style ${nodeId} fill:#ff6b6b,stroke:#c92a2a`);
        } else if (entity.importance >= 4) {
          lines.push(`  style ${nodeId} fill:#ffd43b,stroke:#fab005`);
        } else {
          lines.push(`  style ${nodeId} fill:#a9e34b,stroke:#74b816`);
        }
      }
    }

    lines.push('');

    // Add relations
    for (const relation of graph.relations) {
      const fromId = nodeIds.get(relation.from);
      const toId = nodeIds.get(relation.to);

      if (fromId && toId) {
        const label = escapeLabel(relation.relationType);
        lines.push(`  ${fromId} -->|"${label}"| ${toId}`);
      }
    }

    return lines.join('\n');
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
    let importedGraph: KnowledgeGraph;

    // Parse the input data based on format
    try {
      switch (format) {
        case 'json':
          importedGraph = this.parseJsonImport(data);
          break;
        case 'csv':
          importedGraph = this.parseCsvImport(data);
          break;
        case 'graphml':
          importedGraph = this.parseGraphMLImport(data);
          break;
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }
    } catch (error) {
      return {
        entitiesAdded: 0,
        entitiesSkipped: 0,
        entitiesUpdated: 0,
        relationsAdded: 0,
        relationsSkipped: 0,
        errors: [`Failed to parse ${format} data: ${error instanceof Error ? error.message : String(error)}`]
      };
    }

    // Merge with existing graph
    return await this.mergeImportedGraph(importedGraph, mergeStrategy, dryRun);
  }

  /**
   * Parse JSON format import data
   */
  private parseJsonImport(data: string): KnowledgeGraph {
    const parsed = JSON.parse(data);

    // Validate structure
    if (!parsed.entities || !Array.isArray(parsed.entities)) {
      throw new Error('Invalid JSON: missing or invalid entities array');
    }
    if (!parsed.relations || !Array.isArray(parsed.relations)) {
      throw new Error('Invalid JSON: missing or invalid relations array');
    }

    return {
      entities: parsed.entities as Entity[],
      relations: parsed.relations as Relation[]
    };
  }

  /**
   * Parse CSV format import data
   * Expects format: # ENTITIES section with header, then # RELATIONS section with header
   */
  private parseCsvImport(data: string): KnowledgeGraph {
    const lines = data.split('\n').map(line => line.trim()).filter(line => line);
    const entities: Entity[] = [];
    const relations: Relation[] = [];

    let section: 'entities' | 'relations' | null = null;
    let headerParsed = false;

    // Helper to parse CSV line (handles quoted fields)
    const parseCsvLine = (line: string): string[] => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            // Escaped quote
            current += '"';
            i++;
          } else {
            // Toggle quotes
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          fields.push(current);
          current = '';
        } else {
          current += char;
        }
      }

      fields.push(current);
      return fields;
    };

    for (const line of lines) {
      // Section markers
      if (line.startsWith('# ENTITIES')) {
        section = 'entities';
        headerParsed = false;
        continue;
      } else if (line.startsWith('# RELATIONS')) {
        section = 'relations';
        headerParsed = false;
        continue;
      }

      // Skip comments
      if (line.startsWith('#')) {
        continue;
      }

      // Parse based on current section
      if (section === 'entities') {
        if (!headerParsed) {
          headerParsed = true; // Skip header line
          continue;
        }

        const fields = parseCsvLine(line);
        if (fields.length >= 2) {
          const entity: Entity = {
            name: fields[0],
            entityType: fields[1],
            observations: fields[2] ? fields[2].split(';').map(s => s.trim()).filter(s => s) : [],
            createdAt: fields[3] || undefined,
            lastModified: fields[4] || undefined,
            tags: fields[5] ? fields[5].split(';').map(s => s.trim().toLowerCase()).filter(s => s) : undefined,
            importance: fields[6] ? parseFloat(fields[6]) : undefined
          };
          entities.push(entity);
        }
      } else if (section === 'relations') {
        if (!headerParsed) {
          headerParsed = true; // Skip header line
          continue;
        }

        const fields = parseCsvLine(line);
        if (fields.length >= 3) {
          const relation: Relation = {
            from: fields[0],
            to: fields[1],
            relationType: fields[2],
            createdAt: fields[3] || undefined,
            lastModified: fields[4] || undefined
          };
          relations.push(relation);
        }
      }
    }

    return { entities, relations };
  }

  /**
   * Parse GraphML format import data
   */
  private parseGraphMLImport(data: string): KnowledgeGraph {
    const entities: Entity[] = [];
    const relations: Relation[] = [];

    // Simple XML parsing using regex (for basic GraphML structure)
    // Note: This is a simplified parser. For production, consider using a proper XML parser.

    // Extract nodes
    const nodeRegex = /<node\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/node>/g;
    let nodeMatch;

    while ((nodeMatch = nodeRegex.exec(data)) !== null) {
      const nodeId = nodeMatch[1];
      const nodeContent = nodeMatch[2];

      // Extract attributes
      const getDataValue = (key: string): string | undefined => {
        const dataRegex = new RegExp(`<data\\s+key="${key}">([^<]*)<\/data>`);
        const match = dataRegex.exec(nodeContent);
        return match ? match[1] : undefined;
      };

      const entity: Entity = {
        name: nodeId,
        entityType: getDataValue('d0') || getDataValue('entityType') || 'unknown',
        observations: (getDataValue('d1') || getDataValue('observations') || '').split(';').map(s => s.trim()).filter(s => s),
        createdAt: getDataValue('d2') || getDataValue('createdAt'),
        lastModified: getDataValue('d3') || getDataValue('lastModified'),
        tags: (getDataValue('d4') || getDataValue('tags') || '').split(';').map(s => s.trim().toLowerCase()).filter(s => s),
        importance: getDataValue('d5') || getDataValue('importance') ? parseFloat(getDataValue('d5') || getDataValue('importance') || '0') : undefined
      };

      entities.push(entity);
    }

    // Extract edges
    const edgeRegex = /<edge\s+[^>]*source="([^"]+)"\s+target="([^"]+)"[^>]*>([\s\S]*?)<\/edge>/g;
    let edgeMatch;

    while ((edgeMatch = edgeRegex.exec(data)) !== null) {
      const source = edgeMatch[1];
      const target = edgeMatch[2];
      const edgeContent = edgeMatch[3];

      // Extract attributes
      const getDataValue = (key: string): string | undefined => {
        const dataRegex = new RegExp(`<data\\s+key="${key}">([^<]*)<\/data>`);
        const match = dataRegex.exec(edgeContent);
        return match ? match[1] : undefined;
      };

      const relation: Relation = {
        from: source,
        to: target,
        relationType: getDataValue('e0') || getDataValue('relationType') || 'related_to',
        createdAt: getDataValue('e1') || getDataValue('createdAt'),
        lastModified: getDataValue('e2') || getDataValue('lastModified')
      };

      relations.push(relation);
    }

    return { entities, relations };
  }

  /**
   * Merge imported graph with existing graph based on strategy
   */
  private async mergeImportedGraph(
    importedGraph: KnowledgeGraph,
    mergeStrategy: 'replace' | 'skip' | 'merge' | 'fail',
    dryRun: boolean
  ): Promise<ImportResult> {
    const existingGraph = await this.loadGraph();
    const result: ImportResult = {
      entitiesAdded: 0,
      entitiesSkipped: 0,
      entitiesUpdated: 0,
      relationsAdded: 0,
      relationsSkipped: 0,
      errors: []
    };

    // Create maps for quick lookup
    const existingEntitiesMap = new Map<string, Entity>();
    for (const entity of existingGraph.entities) {
      existingEntitiesMap.set(entity.name, entity);
    }

    const existingRelationsSet = new Set<string>();
    for (const relation of existingGraph.relations) {
      existingRelationsSet.add(`${relation.from}|${relation.to}|${relation.relationType}`);
    }

    // Process entities
    for (const importedEntity of importedGraph.entities) {
      const existing = existingEntitiesMap.get(importedEntity.name);

      if (!existing) {
        // New entity - always add
        result.entitiesAdded++;
        if (!dryRun) {
          existingGraph.entities.push(importedEntity);
          existingEntitiesMap.set(importedEntity.name, importedEntity);
        }
      } else {
        // Entity exists - apply strategy
        switch (mergeStrategy) {
          case 'replace':
            result.entitiesUpdated++;
            if (!dryRun) {
              Object.assign(existing, importedEntity);
            }
            break;

          case 'skip':
            result.entitiesSkipped++;
            break;

          case 'merge':
            result.entitiesUpdated++;
            if (!dryRun) {
              // Merge observations (unique)
              const combinedObs = [...new Set([...existing.observations, ...importedEntity.observations])];
              existing.observations = combinedObs;

              // Merge tags (unique)
              if (importedEntity.tags) {
                existing.tags = existing.tags || [];
                existing.tags = [...new Set([...existing.tags, ...importedEntity.tags])];
              }

              // Use imported importance if present
              if (importedEntity.importance !== undefined) {
                existing.importance = importedEntity.importance;
              }

              // Update timestamps
              existing.lastModified = new Date().toISOString();
            }
            break;

          case 'fail':
            result.errors.push(`Entity "${importedEntity.name}" already exists`);
            break;
        }
      }
    }

    // Process relations
    for (const importedRelation of importedGraph.relations) {
      const relationKey = `${importedRelation.from}|${importedRelation.to}|${importedRelation.relationType}`;

      // Check if both entities exist
      if (!existingEntitiesMap.has(importedRelation.from)) {
        result.errors.push(`Relation source entity "${importedRelation.from}" does not exist`);
        continue;
      }
      if (!existingEntitiesMap.has(importedRelation.to)) {
        result.errors.push(`Relation target entity "${importedRelation.to}" does not exist`);
        continue;
      }

      if (!existingRelationsSet.has(relationKey)) {
        // New relation - always add
        result.relationsAdded++;
        if (!dryRun) {
          existingGraph.relations.push(importedRelation);
          existingRelationsSet.add(relationKey);
        }
      } else {
        // Relation exists
        if (mergeStrategy === 'fail') {
          result.errors.push(`Relation "${relationKey}" already exists`);
        } else {
          result.relationsSkipped++;
        }
      }
    }

    // Save if not dry run and no errors
    if (!dryRun && (mergeStrategy !== 'fail' || result.errors.length === 0)) {
      await this.saveGraph(existingGraph);
    }

    return result;
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
  console.error("Knowledge Graph MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
