# Memory MCP - Component Reference

**Version**: 0.47.0
**Last Updated**: 2025-11-26

---

## Table of Contents

1. [Overview](#overview)
2. [Server Components](#server-components)
3. [Core Components](#core-components)
4. [Search Components](#search-components)
5. [Feature Components](#feature-components)
6. [Utility Components](#utility-components)
7. [Type Definitions](#type-definitions)
8. [Component Dependencies](#component-dependencies)

---

## Overview

Memory MCP follows a layered architecture with specialized components:

```
┌─────────────────────────────────────────────────────────────┐
│  server/           │  MCP protocol handling                 │
├─────────────────────────────────────────────────────────────┤
│  core/             │  Central managers and storage          │
├─────────────────────────────────────────────────────────────┤
│  search/           │  Search implementations                │
├─────────────────────────────────────────────────────────────┤
│  features/         │  Advanced capabilities                 │
├─────────────────────────────────────────────────────────────┤
│  utils/            │  Shared utilities                      │
├─────────────────────────────────────────────────────────────┤
│  types/            │  TypeScript definitions                │
└─────────────────────────────────────────────────────────────┘
```

---

## Server Components

### MCPServer (`server/MCPServer.ts`)

**Purpose**: MCP protocol handling and request routing

**Lines**: 67 (reduced from 907 in v0.41.0)

```typescript
export class MCPServer {
  constructor(manager: KnowledgeGraphManager)
  async start(): Promise<void>
}
```

**Responsibilities**:
- Initialize MCP SDK server
- Register tool list handler (delegates to `toolDefinitions`)
- Register tool call handler (delegates to `toolHandlers`)
- Start stdio transport

**Dependencies**: `toolDefinitions`, `toolHandlers`, `KnowledgeGraphManager`

---

### toolDefinitions (`server/toolDefinitions.ts`)

**Purpose**: Schema definitions for all 45 MCP tools

**Lines**: ~400

```typescript
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const toolDefinitions: ToolDefinition[]
```

**Tool Categories**:

| Category | Count | Tools |
|----------|-------|-------|
| Entity | 4 | create_entities, delete_entities, read_graph, open_nodes |
| Relation | 2 | create_relations, delete_relations |
| Observation | 2 | add_observations, delete_observations |
| Search | 5 | search_nodes, search_nodes_ranked, boolean_search, fuzzy_search, search_by_date_range |
| Hierarchy | 8 | set_entity_parent, get_children, get_parent, get_ancestors, get_descendants, get_subtree, get_root_entities, get_entity_depth |
| Compression | 3 | find_duplicates, merge_entities, compress_graph |
| Tags | 8 | add_tags, remove_tags, set_importance, add_tags_to_multiple_entities, replace_tag, merge_tags, add_tag_alias, resolve_tag |
| Saved Searches | 6 | save_search, list_saved_searches, get_saved_search, execute_saved_search, delete_saved_search, update_saved_search |
| Import/Export | 2 | export_graph, import_graph |
| Analytics | 3 | get_graph_stats, validate_graph, archive_entities |
| Tag Aliases | 2 | list_tag_aliases, remove_tag_alias |

---

### toolHandlers (`server/toolHandlers.ts`)

**Purpose**: Handler implementations for all 45 tools

**Lines**: ~200

```typescript
export type ToolHandler = (
  manager: KnowledgeGraphManager,
  args: Record<string, unknown>
) => Promise<ToolResponse>;

export const toolHandlers: Record<string, ToolHandler>

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  manager: KnowledgeGraphManager
): Promise<ToolResponse>
```

**Pattern**: Registry pattern - handlers registered by tool name

**Response Format**: All handlers use `formatToolResponse()` for consistent output

---

## Core Components

### KnowledgeGraphManager (`core/KnowledgeGraphManager.ts`)

**Purpose**: Central facade coordinating all graph operations

**Pattern**: Facade Pattern with Lazy Initialization

```typescript
export class KnowledgeGraphManager {
  constructor(memoryFilePath: string)

  // Entity operations
  async createEntities(entities: Entity[]): Promise<Entity[]>
  async deleteEntities(entityNames: string[]): Promise<void>
  async addObservations(...): Promise<...>
  async deleteObservations(...): Promise<void>

  // Relation operations
  async createRelations(relations: Relation[]): Promise<Relation[]>
  async deleteRelations(relations: Relation[]): Promise<void>

  // Search operations
  async searchNodes(query, tags?, minImportance?, maxImportance?): Promise<KnowledgeGraph>
  async searchNodesRanked(...): Promise<SearchResult[]>
  async booleanSearch(...): Promise<KnowledgeGraph>
  async fuzzySearch(...): Promise<KnowledgeGraph>

  // Hierarchy operations
  async setEntityParent(entityName, parentName): Promise<Entity>
  async getChildren(entityName): Promise<Entity[]>
  async getAncestors(entityName): Promise<Entity[]>
  async getDescendants(entityName): Promise<Entity[]>

  // Compression operations
  async findDuplicates(threshold?): Promise<string[][]>
  async mergeEntities(entityNames, targetName?): Promise<Entity>
  async compressGraph(threshold?, dryRun?): Promise<CompressionResult>

  // Import/Export
  async exportGraph(format, filter?): Promise<string>
  async importGraph(format, data, mergeStrategy?, dryRun?): Promise<ImportResult>

  // Analytics
  async getGraphStats(): Promise<GraphStats>
  async validateGraph(): Promise<ValidationReport>
}
```

**Lazy Initialization**:
```typescript
// Managers created on first access using ??= operator
private get entityManager(): EntityManager {
  return (this._entityManager ??= new EntityManager(this.storage));
}
```

**Managed Components** (10 total):
- EntityManager, RelationManager
- SearchManager, CompressionManager
- HierarchyManager, ExportManager, ImportManager
- AnalyticsManager, TagManager, ArchiveManager

---

### EntityManager (`core/EntityManager.ts`)

**Purpose**: Entity CRUD operations with validation

```typescript
export class EntityManager {
  constructor(storage: GraphStorage)

  async createEntities(entities: Entity[]): Promise<Entity[]>
  async deleteEntities(entityNames: string[]): Promise<void>
  async addObservations(observations: {...}[]): Promise<{...}[]>
  async deleteObservations(deletions: {...}[]): Promise<void>
  async addTags(entityName, tags): Promise<{...}>
  async removeTags(entityName, tags): Promise<{...}>
  async setImportance(entityName, importance): Promise<{...}>
  async addTagsToMultipleEntities(entityNames, tags): Promise<{...}[]>
  async replaceTag(oldTag, newTag): Promise<{...}>
  async mergeTags(tag1, tag2, targetTag): Promise<{...}>
}
```

**Key Features**:
- Automatic timestamp management (createdAt, lastModified)
- Tag normalization (lowercase)
- Importance validation (0-10 range)
- Batch operations (single I/O)
- Zod schema validation

**Constants**:
- `MIN_IMPORTANCE = 0`
- `MAX_IMPORTANCE = 10`

---

### RelationManager (`core/RelationManager.ts`)

**Purpose**: Relation CRUD operations

```typescript
export class RelationManager {
  constructor(storage: GraphStorage)

  async createRelations(relations: Relation[]): Promise<Relation[]>
  async deleteRelations(relations: Relation[]): Promise<void>
}
```

**Key Features**:
- Automatic timestamp management
- Duplicate relation prevention
- Deferred integrity (relations to non-existent entities allowed)

---

### GraphStorage (`core/GraphStorage.ts`)

**Purpose**: File I/O with in-memory caching

```typescript
export class GraphStorage {
  constructor(memoryFilePath: string)

  async loadGraph(): Promise<KnowledgeGraph>
  async saveGraph(graph: KnowledgeGraph): Promise<void>
  invalidateCache(): void
}
```

**Key Features**:
- JSONL format (line-delimited JSON)
- In-memory cache with write-through invalidation
- Deep copy on cache reads (prevents mutation)
- Backward compatibility for missing timestamps

**Cache Behavior**:
- `loadGraph()`: Returns cached copy if available, else reads from disk
- `saveGraph()`: Writes to disk and invalidates cache
- Cache cleared on every write for consistency

---

## Search Components

### SearchManager (`search/SearchManager.ts`)

**Purpose**: Orchestrates all search types

```typescript
export class SearchManager {
  constructor(storage: GraphStorage, savedSearchesFilePath: string)

  // Basic search
  async searchNodes(query, tags?, minImportance?, maxImportance?): Promise<KnowledgeGraph>
  async openNodes(names): Promise<KnowledgeGraph>
  async searchByDateRange(startDate?, endDate?, entityType?, tags?): Promise<KnowledgeGraph>

  // Advanced search
  async searchNodesRanked(query, tags?, min?, max?, limit?): Promise<SearchResult[]>
  async booleanSearch(query, tags?, min?, max?): Promise<KnowledgeGraph>
  async fuzzySearch(query, threshold?, tags?, min?, max?): Promise<KnowledgeGraph>

  // Suggestions
  async getSearchSuggestions(query, maxSuggestions?): Promise<string[]>

  // Saved searches
  async saveSearch(search): Promise<SavedSearch>
  async listSavedSearches(): Promise<SavedSearch[]>
  async executeSavedSearch(name): Promise<KnowledgeGraph>
  async deleteSavedSearch(name): Promise<boolean>
}
```

**Composed Components**:
- BasicSearch, RankedSearch, BooleanSearch, FuzzySearch
- SearchSuggestions, SavedSearchManager

---

### BasicSearch (`search/BasicSearch.ts`)

**Purpose**: Simple text matching with filters

**Algorithm**: Case-insensitive substring matching across name, entityType, observations

```typescript
export class BasicSearch {
  constructor(storage: GraphStorage)

  async searchNodes(query, tags?, minImportance?, maxImportance?): Promise<KnowledgeGraph>
  async openNodes(names): Promise<KnowledgeGraph>
  async searchByDateRange(startDate?, endDate?, entityType?, tags?): Promise<KnowledgeGraph>
}
```

---

### RankedSearch (`search/RankedSearch.ts`)

**Purpose**: TF-IDF relevance scoring

**Algorithm**: Term Frequency-Inverse Document Frequency

```typescript
export class RankedSearch {
  constructor(storage: GraphStorage)

  async searchNodesRanked(
    query: string,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number,
    limit?: number
  ): Promise<SearchResult[]>
}
```

**Scoring**:
- Tokenizes query and entity content
- Calculates TF-IDF score per entity
- Returns sorted results with scores

---

### BooleanSearch (`search/BooleanSearch.ts`)

**Purpose**: Boolean query parsing and evaluation

**Syntax**: `AND`, `OR`, `NOT`, parentheses, field prefixes

```typescript
export class BooleanSearch {
  constructor(storage: GraphStorage)

  async booleanSearch(
    query: string,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number
  ): Promise<KnowledgeGraph>
}
```

**Query Examples**:
- `Alice AND Bob`
- `name:Alice OR type:person`
- `NOT archived AND (project OR task)`

---

### FuzzySearch (`search/FuzzySearch.ts`)

**Purpose**: Typo-tolerant search using Levenshtein distance

```typescript
export class FuzzySearch {
  constructor(storage: GraphStorage)

  async fuzzySearch(
    query: string,
    threshold?: number,  // 0.0-1.0, default 0.7
    tags?: string[],
    minImportance?: number,
    maxImportance?: number
  ): Promise<KnowledgeGraph>
}
```

**Algorithm**: Levenshtein distance normalized to similarity score

---

### SearchFilterChain (`search/SearchFilterChain.ts`)

**Purpose**: Unified filter logic for all search implementations

```typescript
export interface SearchFilters {
  tags?: string[];
  minImportance?: number;
  maxImportance?: number;
  entityType?: string;
  createdAfter?: string;
  createdBefore?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
}

export class SearchFilterChain {
  static applyFilters(entities: Entity[], filters: SearchFilters): Entity[]
  static entityPassesFilters(entity: Entity, filters: SearchFilters): boolean
  static hasActiveFilters(filters: SearchFilters): boolean
  static filterAndPaginate(entities, filters, offset?, limit?): Entity[]
  static filterByTags(entities, tags?): Entity[]
  static filterByImportance(entities, min?, max?): Entity[]
}
```

**Benefits**:
- Eliminates ~65 lines of duplicate filter code per search implementation
- Consistent filtering behavior across all search types
- Short-circuit evaluation for performance
- Pre-normalizes tags once per filter operation

---

## Feature Components

### HierarchyManager (`features/HierarchyManager.ts`)

**Purpose**: Parent-child relationships and tree navigation

```typescript
export class HierarchyManager {
  constructor(storage: GraphStorage)

  async setEntityParent(entityName, parentName): Promise<Entity>
  async getChildren(entityName): Promise<Entity[]>
  async getParent(entityName): Promise<Entity | null>
  async getAncestors(entityName): Promise<Entity[]>
  async getDescendants(entityName): Promise<Entity[]>
  async getSubtree(entityName): Promise<KnowledgeGraph>
  async getRootEntities(): Promise<Entity[]>
  async getEntityDepth(entityName): Promise<number>
  async moveEntity(entityName, newParentName): Promise<Entity>
}
```

**Safety**: Cycle detection prevents invalid parent assignments

---

### CompressionManager (`features/CompressionManager.ts`)

**Purpose**: Duplicate detection and entity merging

```typescript
export class CompressionManager {
  constructor(storage: GraphStorage)

  async findDuplicates(threshold?: number): Promise<string[][]>
  async mergeEntities(entityNames, targetName?): Promise<Entity>
  async compressGraph(threshold?, dryRun?): Promise<CompressionResult>
}
```

**Similarity Algorithm**:
- **Name**: Levenshtein distance (weight: 0.4)
- **Type**: Exact match (weight: 0.3)
- **Observations**: Jaccard similarity (weight: 0.2)
- **Tags**: Jaccard similarity (weight: 0.1)

**Optimization**: Two-level bucketing by entityType reduces O(n²) to O(n²/k)

---

### ExportManager (`features/ExportManager.ts`)

**Purpose**: Multi-format graph export

```typescript
export type ExportFormat = 'json' | 'csv' | 'graphml' | 'gexf' | 'dot' | 'markdown' | 'mermaid';

export class ExportManager {
  exportGraph(graph: KnowledgeGraph, format: ExportFormat): string
}
```

**Supported Formats**:
| Format | Description |
|--------|-------------|
| json | Pretty-printed JSON |
| csv | Comma-separated values |
| graphml | XML-based graph format |
| gexf | Graph Exchange XML Format |
| dot | Graphviz DOT language |
| markdown | Human-readable markdown |
| mermaid | Mermaid diagram syntax |

---

### ImportManager (`features/ImportManager.ts`)

**Purpose**: Multi-format graph import with merge strategies

```typescript
export class ImportManager {
  constructor(storage: GraphStorage)

  async importGraph(
    format: 'json' | 'csv' | 'graphml',
    data: string,
    mergeStrategy?: 'replace' | 'skip' | 'merge' | 'fail',
    dryRun?: boolean
  ): Promise<ImportResult>
}
```

**Merge Strategies**:
- `replace`: Overwrite existing entities
- `skip`: Skip entities that exist
- `merge`: Combine observations and tags
- `fail`: Error if any conflicts

---

### AnalyticsManager (`features/AnalyticsManager.ts`)

**Purpose**: Graph statistics and validation

```typescript
export class AnalyticsManager {
  constructor(storage: GraphStorage)

  async getGraphStats(): Promise<GraphStats>
  async validateGraph(): Promise<ValidationReport>
}
```

**GraphStats** includes:
- Entity/relation counts
- Entity types distribution
- Tag usage statistics
- Importance distribution
- Date range of content

**ValidationReport** checks:
- Orphaned relations (references to non-existent entities)
- Duplicate entity names
- Invalid importance values
- Circular hierarchy references

---

### TagManager (`features/TagManager.ts`)

**Purpose**: Tag aliases and synonyms

```typescript
export class TagManager {
  constructor(tagAliasesFilePath: string)

  async resolveTag(tag: string): Promise<string>
  async addTagAlias(alias, canonical, description?): Promise<TagAlias>
  async listTagAliases(): Promise<TagAlias[]>
  async removeTagAlias(alias): Promise<boolean>
  async getAliasesForTag(canonicalTag): Promise<string[]>
}
```

**Use Case**: Map synonyms to canonical tags (e.g., "js" → "javascript")

---

### ArchiveManager (`features/ArchiveManager.ts`)

**Purpose**: Archive old/low-importance entities

```typescript
export class ArchiveManager {
  constructor(storage: GraphStorage)

  async archiveEntities(
    criteria: {
      olderThan?: string;      // ISO date
      importanceLessThan?: number;
      tags?: string[];
    },
    dryRun?: boolean
  ): Promise<{ archived: number; entityNames: string[] }>
}
```

---

## Utility Components

### schemas (`utils/schemas.ts`)

**Purpose**: Zod validation schemas

**Key Schemas**:
- `EntitySchema`, `CreateEntitySchema`, `UpdateEntitySchema`
- `RelationSchema`, `CreateRelationSchema`
- `BatchCreateEntitiesSchema` (max 1000 items)
- `SearchQuerySchema`, `DateRangeSchema`
- `ImportanceSchema` (0-10)

---

### constants (`utils/constants.ts`)

**Purpose**: Centralized configuration values

```typescript
export const SIMILARITY_WEIGHTS = {
  NAME: 0.4,
  TYPE: 0.3,
  OBSERVATIONS: 0.2,
  TAGS: 0.1,
};

export const DEFAULT_DUPLICATE_THRESHOLD = 0.8;

export const SEARCH_LIMITS = {
  DEFAULT: 50,
  MAX: 1000,
};

export const GRAPH_LIMITS = {
  MAX_ENTITIES: 10000,
  MAX_RELATIONS: 50000,
};
```

---

### responseFormatter (`utils/responseFormatter.ts`)

**Purpose**: Consistent MCP tool response formatting

```typescript
export function formatToolResponse(data: unknown): ToolResponse
export function formatTextResponse(text: string): ToolResponse
export function formatRawResponse(content: unknown): ToolResponse
```

---

### levenshtein (`utils/levenshtein.ts`)

**Purpose**: Levenshtein distance calculation for fuzzy matching

```typescript
export function levenshteinDistance(s1: string, s2: string): number
```

---

### tfidf (`utils/tfidf.ts`)

**Purpose**: TF-IDF scoring for ranked search

```typescript
export function calculateTF(term: string, document: string): number
export function calculateIDF(term: string, documents: string[]): number
export function calculateTFIDF(term: string, document: string, documents: string[]): number
```

---

## Type Definitions

### Entity Types (`types/entity.types.ts`)

```typescript
interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  parentId?: string;
  tags?: string[];
  importance?: number;
  createdAt?: string;
  lastModified?: string;
}

interface Relation {
  from: string;
  to: string;
  relationType: string;
  createdAt?: string;
  lastModified?: string;
}

interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}
```

### Search Types (`types/search.types.ts`)

```typescript
interface SearchResult {
  entity: Entity;
  score: number;
  matchedFields: string[];
}

interface SavedSearch {
  name: string;
  query: string;
  searchType: 'basic' | 'ranked' | 'boolean' | 'fuzzy';
  filters?: SearchFilters;
  createdAt: string;
  lastUsed?: string;
  useCount: number;
}
```

### Analytics Types (`types/analytics.types.ts`)

```typescript
interface GraphStats {
  entityCount: number;
  relationCount: number;
  entityTypes: Record<string, number>;
  tagCounts: Record<string, number>;
  importanceDistribution: Record<number, number>;
}

interface ValidationReport {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
```

---

## Component Dependencies

```
┌──────────────────────────────────────────────────────────────┐
│  MCPServer                                                   │
│    └── KnowledgeGraphManager (facade)                        │
│          ├── EntityManager ────────┐                         │
│          ├── RelationManager ──────┤                         │
│          ├── SearchManager ────────┤                         │
│          │     ├── BasicSearch ────┤                         │
│          │     ├── RankedSearch ───┤                         │
│          │     ├── BooleanSearch ──┼──► GraphStorage         │
│          │     ├── FuzzySearch ────┤        │                │
│          │     └── SavedSearchMgr ─┤        ▼                │
│          ├── HierarchyManager ─────┤   memory.jsonl          │
│          ├── CompressionManager ───┤                         │
│          ├── ExportManager ────────┘                         │
│          ├── ImportManager ────────► GraphStorage            │
│          ├── AnalyticsManager ─────► GraphStorage            │
│          ├── TagManager ───────────► tag-aliases.jsonl       │
│          └── ArchiveManager ───────► GraphStorage            │
└──────────────────────────────────────────────────────────────┘
```

**Shared Dependencies**:
- All managers receive `GraphStorage` via dependency injection
- `SearchFilterChain` used by all search implementations
- `utils/schemas.ts` used for input validation across managers
- `utils/constants.ts` provides shared configuration

---

**Document Version**: 1.0
**Last Updated**: 2025-11-26
**Maintained By**: Daniel Simon Jr.
