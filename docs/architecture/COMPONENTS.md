# Memory MCP - Component Reference

**Version**: 0.58.0
**Last Updated**: 2025-12-30

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
  constructor(ctx: ManagerContext)
  async start(): Promise<void>
}
```

**Responsibilities**:
- Initialize MCP SDK server
- Register tool list handler (delegates to `toolDefinitions`)
- Register tool call handler (delegates to `toolHandlers`)
- Start stdio transport

**Dependencies**: `toolDefinitions`, `toolHandlers`, `ManagerContext`

---

### toolDefinitions (`server/toolDefinitions.ts`)

**Purpose**: Schema definitions for all 55 MCP tools

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
| Search | 7 | search_nodes, search_nodes_ranked, boolean_search, fuzzy_search, search_by_date_range, get_search_suggestions, search_auto |
| Semantic Search | 3 | semantic_search, find_similar_entities, index_embeddings |
| Saved Searches | 5 | save_search, execute_saved_search, list_saved_searches, delete_saved_search, update_saved_search |
| Tag Management | 6 | add_tags, remove_tags, set_importance, add_tags_to_multiple_entities, replace_tag, merge_tags |
| Tag Aliases | 5 | add_tag_alias, list_tag_aliases, remove_tag_alias, get_aliases_for_tag, resolve_tag |
| Hierarchy | 9 | set_entity_parent, get_children, get_parent, get_ancestors, get_descendants, get_subtree, get_root_entities, get_entity_depth, move_entity |
| Graph Algorithms | 4 | find_shortest_path, find_all_paths, get_connected_components, get_centrality |
| Analytics | 2 | get_graph_stats, validate_graph |
| Compression | 4 | find_duplicates, merge_entities, compress_graph, archive_entities |
| Import/Export | 2 | export_graph, import_graph |

---

### toolHandlers (`server/toolHandlers.ts`)

**Purpose**: Handler implementations for all 55 tools

**Lines**: ~301

```typescript
export type ToolHandler = (
  ctx: ManagerContext,
  args: Record<string, unknown>
) => Promise<ToolResponse>;

export const toolHandlers: Record<string, ToolHandler>

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  ctx: ManagerContext
): Promise<ToolResponse>
```

**Pattern**: Registry pattern - handlers registered by tool name

**Response Format**: All handlers use `formatToolResponse()` for consistent output

---

## Core Components

### ManagerContext (`core/ManagerContext.ts`)

**Purpose**: Central context holding all managers with lazy initialization

**Pattern**: Context Pattern with Lazy Initialization

**Alias**: Exported as `KnowledgeGraphManager` for backward compatibility

```typescript
export class ManagerContext {
  constructor(memoryFilePath: string)

  // Manager accessors (lazy-initialized via getters)
  get entityManager(): EntityManager
  get relationManager(): RelationManager
  get searchManager(): SearchManager
  get ioManager(): IOManager
  get tagManager(): TagManager

  // Direct storage access
  get storage(): GraphStorage
}

// Backward compatibility alias
export { ManagerContext as KnowledgeGraphManager }
```

**Lazy Initialization**:
```typescript
// Managers created on first access using ??= operator
private _entityManager?: EntityManager;
get entityManager(): EntityManager {
  return (this._entityManager ??= new EntityManager(this.storage));
}
```

**Managed Components** (5 total, consolidated from 10):
- **EntityManager**: Entity CRUD + hierarchy + archive functionality
- **RelationManager**: Relation CRUD operations
- **SearchManager**: Search + compression + analytics functionality
- **IOManager**: Import + export + backup functionality
- **TagManager**: Tag aliases and management

---

### EntityManager (`core/EntityManager.ts`)

**Purpose**: Entity CRUD operations with validation, hierarchy, and archive functionality

**Note**: Consolidated from EntityManager + HierarchyManager + ArchiveManager in Sprint 11

```typescript
export class EntityManager {
  constructor(storage: GraphStorage)

  // Entity CRUD
  async createEntities(entities: Entity[]): Promise<Entity[]>
  async deleteEntities(entityNames: string[]): Promise<void>
  async addObservations(observations: {...}[]): Promise<{...}[]>
  async deleteObservations(deletions: {...}[]): Promise<void>

  // Tag operations
  async addTags(entityName, tags): Promise<{...}>
  async removeTags(entityName, tags): Promise<{...}>
  async setImportance(entityName, importance): Promise<{...}>
  async addTagsToMultipleEntities(entityNames, tags): Promise<{...}[]>
  async replaceTag(oldTag, newTag): Promise<{...}>
  async mergeTags(tag1, tag2, targetTag): Promise<{...}>

  // Hierarchy operations (merged from HierarchyManager)
  async setEntityParent(entityName, parentName): Promise<Entity>
  async getChildren(entityName): Promise<Entity[]>
  async getParent(entityName): Promise<Entity | null>
  async getAncestors(entityName): Promise<Entity[]>
  async getDescendants(entityName): Promise<Entity[]>
  async getSubtree(entityName): Promise<KnowledgeGraph>
  async getRootEntities(): Promise<Entity[]>
  async getEntityDepth(entityName): Promise<number>
  async moveEntity(entityName, newParentName): Promise<Entity>

  // Archive operations (merged from ArchiveManager)
  async archiveEntities(criteria: ArchiveCriteria, dryRun?): Promise<ArchiveResult>
}
```

**Key Features**:
- Automatic timestamp management (createdAt, lastModified)
- Tag normalization (lowercase)
- Importance validation (0-10 range)
- Batch operations (single I/O)
- Zod schema validation
- Cycle detection for hierarchy operations
- Cascading delete for children (optional)

**Constants** (internal, use `IMPORTANCE_RANGE` from `utils/constants.ts` externally):
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

**Purpose**: Orchestrates all search types + compression + analytics

**Note**: Consolidated from SearchManager + CompressionManager + AnalyticsManager in Sprint 11

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
  async updateSavedSearch(name, updates): Promise<SavedSearch>

  // Compression operations (merged from CompressionManager)
  async findDuplicates(threshold?): Promise<string[][]>
  async mergeEntities(entityNames, targetName?): Promise<Entity>
  async compressGraph(threshold?, dryRun?): Promise<CompressionResult>

  // Analytics operations (merged from AnalyticsManager)
  async getGraphStats(): Promise<GraphStats>
  async validateGraph(): Promise<ValidationReport>
}
```

**Composed Components**:
- BasicSearch, RankedSearch, BooleanSearch, FuzzySearch
- SearchSuggestions, SavedSearchManager, TFIDFIndexManager
- SearchFilterChain (unified filter logic)

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

### IOManager (`features/IOManager.ts`)

**Purpose**: Import, export, and backup functionality (consolidated)

**Note**: Consolidated from ExportManager + ImportManager + BackupManager in Sprint 11

```typescript
export class IOManager {
  constructor(storage: GraphStorage, backupDir?: string)

  // Export operations (from ExportManager)
  async exportGraph(format: ExportFormat, filter?): Promise<string>

  // Import operations (from ImportManager)
  async importGraph(
    format: 'json' | 'csv' | 'graphml',
    data: string,
    mergeStrategy?: 'replace' | 'skip' | 'merge' | 'fail',
    dryRun?: boolean
  ): Promise<ImportResult>

  // Backup operations (from BackupManager)
  async createBackup(): Promise<BackupInfo>
  async restoreBackup(backupId: string): Promise<void>
  async listBackups(): Promise<BackupInfo[]>
  async deleteBackup(backupId: string): Promise<void>
}

export type ExportFormat = 'json' | 'csv' | 'graphml' | 'gexf' | 'dot' | 'markdown' | 'mermaid';
```

**Supported Export Formats**:
| Format | Description |
|--------|-------------|
| json | Pretty-printed JSON |
| csv | Comma-separated values |
| graphml | XML-based graph format |
| gexf | Graph Exchange XML Format |
| dot | Graphviz DOT language |
| markdown | Human-readable markdown |
| mermaid | Mermaid diagram syntax |

**Merge Strategies** (for import):
- `replace`: Overwrite existing entities
- `skip`: Skip entities that exist
- `merge`: Combine observations and tags
- `fail`: Error if any conflicts

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

### Merged Managers (Historical Reference)

The following managers have been consolidated in Sprint 11:
- **HierarchyManager** → merged into EntityManager
- **ArchiveManager** → merged into EntityManager
- **CompressionManager** → merged into SearchManager
- **AnalyticsManager** → merged into SearchManager
- **ExportManager** → merged into IOManager
- **ImportManager** → merged into IOManager
- **BackupManager** → merged into IOManager

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

### searchAlgorithms (`utils/searchAlgorithms.ts`)

**Purpose**: Search algorithms (consolidated from levenshtein.ts + tfidf.ts in Sprint 14)

```typescript
// Levenshtein distance for fuzzy matching
export function levenshteinDistance(s1: string, s2: string): number

// TF-IDF scoring for ranked search
export function calculateTF(term: string, document: string): number
export function calculateIDF(term: string, documents: string[]): number
export function calculateTFIDF(term: string, document: string, documents: string[]): number
export function tokenize(text: string): string[]
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
│    └── ManagerContext (aliased as KnowledgeGraphManager)     │
│          ├── EntityManager ────────┐  (CRUD + hierarchy +    │
│          │                         │   archive)              │
│          ├── RelationManager ──────┤                         │
│          ├── SearchManager ────────┤  (search + compression  │
│          │     ├── BasicSearch ────┤   + analytics)          │
│          │     ├── RankedSearch ───┤                         │
│          │     ├── BooleanSearch ──┼──► GraphStorage         │
│          │     ├── FuzzySearch ────┤        │                │
│          │     ├── SavedSearchMgr ─┤        ▼                │
│          │     └── TFIDFIndexMgr ──┤   memory.jsonl          │
│          ├── IOManager ────────────┤  (import + export +     │
│          │                         │   backup)               │
│          └── TagManager ───────────► tag-aliases.jsonl       │
└──────────────────────────────────────────────────────────────┘
```

**Shared Dependencies**:
- All managers receive `GraphStorage` via dependency injection
- `SearchFilterChain` used by all search implementations
- `utils/schemas.ts` used for input validation across managers
- `utils/constants.ts` provides shared configuration (SIMILARITY_WEIGHTS)
- `utils/searchAlgorithms.ts` provides Levenshtein + TF-IDF algorithms

---

**Document Version**: 2.0
**Last Updated**: 2025-12-30
**Maintained By**: Daniel Simon Jr.
