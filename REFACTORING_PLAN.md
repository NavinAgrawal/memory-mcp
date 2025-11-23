# Index.ts Refactoring Plan

## Executive Summary

This document outlines a comprehensive plan to refactor the monolithic `src/memory/index.ts` file (4,187 lines) into a modular, maintainable architecture. The refactoring will improve code organization, testability, maintainability, and developer experience while preserving all existing functionality.

**Current State**: Single 4,187-line file containing:
- 13 TypeScript interfaces and types
- 1 massive KnowledgeGraphManager class with 59 methods
- 45 MCP tool definitions
- 41 tool request handlers
- Server initialization and bootstrapping code

**Target State**: Modular architecture with 15-20 focused files organized by functional domain.

---

## Current State Analysis

### File Statistics
- **Total Lines**: 4,187
- **Interfaces/Types**: 13
- **Class Methods**: 59 async methods
- **MCP Tools**: 45 tools (309% more than official MCP memory server)
- **Code Complexity**: Very High
- **Maintainability**: Low
- **Test Coverage**: Limited (only 2 test files)

### Pain Points
1. **Navigation Difficulty**: Finding specific functionality requires extensive scrolling
2. **Merge Conflicts**: High probability in team environments
3. **Testing Challenges**: Difficult to isolate and test individual components
4. **Code Reuse**: Hard to extract and reuse utility functions
5. **Onboarding**: New developers face steep learning curve
6. **IDE Performance**: Large files can slow down IntelliSense and linting
7. **Circular Dependencies**: Risk increases with monolithic structure
8. **Version Control**: Difficult to track changes to specific features

### Functional Breakdown

The file contains the following functional domains:

| Domain | Methods | Complexity | Lines (est) |
|--------|---------|------------|-------------|
| Core CRUD | 8 | Medium | 400 |
| Search Operations | 6 | High | 800 |
| Tag Management | 9 | Medium | 500 |
| Hierarchy Operations | 9 | High | 600 |
| Analytics & Validation | 2 | Medium | 300 |
| Saved Searches | 6 | Medium | 300 |
| Compression & Deduplication | 3 | High | 400 |
| Archiving | 1 | Medium | 150 |
| Import/Export | 2 | Very High | 850 |
| Search Utilities | 10+ | High | 500 |
| Server & Tools | - | Medium | 1200 |
| Types & Interfaces | - | Low | 187 |

---

## Proposed Architecture

### Design Principles
1. **Single Responsibility**: Each module handles one functional domain
2. **Separation of Concerns**: Types, business logic, and API layer separated
3. **Dependency Injection**: Manager classes receive dependencies via constructor
4. **Testability**: Pure functions and mockable dependencies
5. **Gradual Migration**: Refactor incrementally without breaking changes
6. **Backward Compatibility**: Maintain all existing APIs

### Module Organization Strategy

```
src/memory/
├── index.ts                      # Entry point - server initialization (100 lines)
├── types/                        # TypeScript types and interfaces
│   ├── index.ts                 # Re-exports all types
│   ├── entity.types.ts          # Entity, Relation, KnowledgeGraph
│   ├── search.types.ts          # SearchResult, SavedSearch, BooleanQueryNode
│   ├── analytics.types.ts       # GraphStats, ValidationReport, ValidationError
│   ├── import-export.types.ts   # ImportResult, CompressionResult
│   └── tag.types.ts             # TagAlias
├── core/                         # Core business logic
│   ├── KnowledgeGraphManager.ts # Main manager (facade pattern)
│   ├── GraphStorage.ts          # File I/O operations (loadGraph, saveGraph)
│   ├── EntityManager.ts         # CRUD for entities
│   ├── RelationManager.ts       # CRUD for relations
│   └── ObservationManager.ts    # CRUD for observations
├── search/                       # Search functionality
│   ├── SearchManager.ts         # Orchestrates all search operations
│   ├── BasicSearch.ts           # searchNodes, openNodes
│   ├── RankedSearch.ts          # TF-IDF ranking algorithm
│   ├── BooleanSearch.ts         # Boolean query parsing and evaluation
│   ├── FuzzySearch.ts           # Fuzzy matching with Levenshtein
│   ├── SearchSuggestions.ts     # Auto-complete suggestions
│   └── SavedSearchManager.ts    # Saved search operations
├── features/                     # Feature-specific managers
│   ├── TagManager.ts            # Tag operations and aliases
│   ├── ImportanceManager.ts     # Importance level operations
│   ├── HierarchyManager.ts      # Parent-child relationships
│   ├── AnalyticsManager.ts      # Statistics and validation
│   ├── CompressionManager.ts    # Deduplication and merging
│   ├── ArchiveManager.ts        # Archiving operations
│   └── ImportExportManager.ts   # Multi-format import/export
├── utils/                        # Utility functions
│   ├── levenshtein.ts           # String distance calculations
│   ├── tfidf.ts                 # TF-IDF algorithms
│   ├── dateUtils.ts             # Date range filtering
│   ├── validationUtils.ts       # Data validation helpers
│   └── pathUtils.ts             # File path management
├── mcp/                          # MCP Server setup
│   ├── server.ts                # Server initialization
│   ├── tools/                   # Tool definitions
│   │   ├── index.ts             # Tool registry
│   │   ├── entity.tools.ts      # Entity CRUD tool definitions
│   │   ├── search.tools.ts      # Search tool definitions
│   │   ├── tag.tools.ts         # Tag tool definitions
│   │   ├── hierarchy.tools.ts   # Hierarchy tool definitions
│   │   ├── analytics.tools.ts   # Analytics tool definitions
│   │   └── import-export.tools.ts # Import/Export tool definitions
│   └── handlers/                # Tool request handlers
│       ├── index.ts             # Handler registry
│       ├── entity.handlers.ts   # Entity tool handlers
│       ├── search.handlers.ts   # Search tool handlers
│       ├── tag.handlers.ts      # Tag tool handlers
│       ├── hierarchy.handlers.ts # Hierarchy tool handlers
│       ├── analytics.handlers.ts # Analytics tool handlers
│       └── import-export.handlers.ts # Import/Export tool handlers
├── __tests__/                    # Tests (existing)
│   ├── file-path.test.ts
│   ├── knowledge-graph.test.ts
│   ├── entity.test.ts           # NEW: Entity operations tests
│   ├── search.test.ts           # NEW: Search tests
│   ├── hierarchy.test.ts        # NEW: Hierarchy tests
│   └── compression.test.ts      # NEW: Compression tests
└── config/                       # Configuration
    └── constants.ts             # Constants and defaults
```

---

## Detailed Module Breakdown

### 1. Types Module (`src/memory/types/`)

**Purpose**: Centralize all TypeScript type definitions

**Files**:

#### `entity.types.ts`
```typescript
export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  createdAt?: string;
  lastModified?: string;
  tags?: string[];
  importance?: number;
  parentId?: string;
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
```

#### `search.types.ts`
```typescript
export interface SearchResult {
  entity: Entity;
  score: number;
  matchedFields: {
    name?: boolean;
    entityType?: boolean;
    observations?: string[];
  };
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

export type BooleanQueryNode =
  | { type: 'AND'; children: BooleanQueryNode[] }
  | { type: 'OR'; children: BooleanQueryNode[] }
  | { type: 'NOT'; child: BooleanQueryNode }
  | { type: 'TERM'; field?: string; value: string };
```

#### `analytics.types.ts`
```typescript
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
```

#### `import-export.types.ts`
```typescript
export interface ImportResult {
  entitiesAdded: number;
  entitiesSkipped: number;
  entitiesUpdated: number;
  relationsAdded: number;
  relationsSkipped: number;
  errors: string[];
}

export interface CompressionResult {
  duplicatesFound: number;
  entitiesMerged: number;
  observationsCompressed: number;
  relationsConsolidated: number;
  spaceFreed: number;
  mergedEntities: Array<{ kept: string; merged: string[] }>;
}
```

#### `tag.types.ts`
```typescript
export interface TagAlias {
  alias: string;
  canonical: string;
  description?: string;
  createdAt: string;
}
```

**Benefits**:
- Single source of truth for types
- Easy to import and reuse
- Better IDE autocomplete
- Simpler type refactoring

---

### 2. Core Module (`src/memory/core/`)

**Purpose**: Handle core business logic and data persistence

#### `GraphStorage.ts`
**Responsibility**: File I/O operations, backward compatibility

**Methods**:
- `loadGraph(): Promise<KnowledgeGraph>`
- `saveGraph(graph: KnowledgeGraph): Promise<void>`
- `ensureMemoryFilePath(): Promise<string>`

**Size**: ~150 lines

**Dependencies**: fs, path, types

#### `EntityManager.ts`
**Responsibility**: Entity CRUD operations

**Methods**:
- `createEntities(entities: Entity[]): Promise<Entity[]>`
- `deleteEntities(entityNames: string[]): Promise<void>`
- `getEntity(name: string): Promise<Entity | null>`
- `updateEntity(name: string, updates: Partial<Entity>): Promise<Entity>`

**Size**: ~200 lines

**Dependencies**: GraphStorage, types

#### `RelationManager.ts`
**Responsibility**: Relation CRUD operations

**Methods**:
- `createRelations(relations: Relation[]): Promise<Relation[]>`
- `deleteRelations(relations: Relation[]): Promise<void>`
- `getRelations(entityName: string): Promise<Relation[]>`

**Size**: ~150 lines

**Dependencies**: GraphStorage, types

#### `ObservationManager.ts`
**Responsibility**: Observation CRUD operations

**Methods**:
- `addObservations(observations: {...}[]): Promise<{...}[]>`
- `deleteObservations(deletions: {...}[]): Promise<void>`

**Size**: ~100 lines

**Dependencies**: GraphStorage, types

#### `KnowledgeGraphManager.ts`
**Responsibility**: Facade pattern - orchestrates all managers

**Methods**: Delegates to specialized managers

**Size**: ~300 lines (much smaller than current 3000+)

**Dependencies**: All managers

**Pattern**: Composition over inheritance
```typescript
export class KnowledgeGraphManager {
  private storage: GraphStorage;
  private entityManager: EntityManager;
  private relationManager: RelationManager;
  private observationManager: ObservationManager;
  private searchManager: SearchManager;
  private tagManager: TagManager;
  private hierarchyManager: HierarchyManager;
  // ... other managers

  constructor(memoryFilePath: string) {
    this.storage = new GraphStorage(memoryFilePath);
    this.entityManager = new EntityManager(this.storage);
    this.relationManager = new RelationManager(this.storage);
    // ... initialize other managers
  }

  // Delegate methods to appropriate managers
  async createEntities(entities: Entity[]): Promise<Entity[]> {
    return this.entityManager.createEntities(entities);
  }

  async searchNodes(query: string, ...): Promise<KnowledgeGraph> {
    return this.searchManager.searchNodes(query, ...);
  }

  // ... etc
}
```

---

### 3. Search Module (`src/memory/search/`)

**Purpose**: All search-related functionality

#### `SearchManager.ts`
**Responsibility**: Orchestrate search operations

**Methods**:
- `searchNodes(query, tags?, ...): Promise<KnowledgeGraph>`
- `openNodes(names: string[]): Promise<KnowledgeGraph>`
- `searchByDateRange(...): Promise<KnowledgeGraph>`

**Size**: ~200 lines

#### `RankedSearch.ts`
**Responsibility**: TF-IDF ranking algorithm

**Methods**:
- `searchNodesRanked(query, ...): Promise<SearchResult[]>`
- `calculateTFIDF(query: string, entities: Entity[]): Map<Entity, number>`
- `calculateIDF(term: string, entities: Entity[]): number`
- `calculateTF(term: string, entity: Entity): number`

**Size**: ~300 lines

#### `BooleanSearch.ts`
**Responsibility**: Boolean query parsing and evaluation

**Methods**:
- `booleanSearch(query: string, ...): Promise<KnowledgeGraph>`
- `parseBooleanQuery(query: string): BooleanQueryNode`
- `evaluateBooleanQuery(node: BooleanQueryNode, entity: Entity): boolean`
- `tokenize(query: string): Token[]`

**Size**: ~350 lines

#### `FuzzySearch.ts`
**Responsibility**: Fuzzy matching with Levenshtein distance

**Methods**:
- `fuzzySearch(query: string, threshold?: number, ...): Promise<KnowledgeGraph>`
- `isFuzzyMatch(str1: string, str2: string, threshold: number): boolean`

**Size**: ~150 lines

**Dependencies**: utils/levenshtein.ts

#### `SearchSuggestions.ts`
**Responsibility**: Auto-complete and search suggestions

**Methods**:
- `getSearchSuggestions(query: string, maxSuggestions?: number): Promise<string[]>`
- `generateTriGrams(text: string): Set<string>`
- `triGramSimilarity(text1: string, text2: string): number`

**Size**: ~150 lines

#### `SavedSearchManager.ts`
**Responsibility**: Saved search operations

**Methods**:
- `saveSearch(search: Omit<SavedSearch, ...>): Promise<SavedSearch>`
- `listSavedSearches(): Promise<SavedSearch[]>`
- `getSavedSearch(name: string): Promise<SavedSearch | null>`
- `executeSavedSearch(name: string): Promise<KnowledgeGraph>`
- `deleteSavedSearch(name: string): Promise<boolean>`
- `updateSavedSearch(name: string, updates: ...): Promise<SavedSearch>`

**Size**: ~200 lines

---

### 4. Features Module (`src/memory/features/`)

**Purpose**: Feature-specific managers for advanced functionality

#### `TagManager.ts`
**Responsibility**: Tag operations and aliases

**Methods**:
- `addTags(entityName: string, tags: string[]): Promise<{...}>`
- `removeTags(entityName: string, tags: string[]): Promise<{...}>`
- `addTagsToMultipleEntities(entityNames: string[], tags: string[]): Promise<{...}[]>`
- `replaceTag(oldTag: string, newTag: string): Promise<{...}>`
- `mergeTags(tag1: string, tag2: string, targetTag: string): Promise<{...}>`
- `resolveTag(tag: string): Promise<string>`
- `addTagAlias(alias: string, canonical: string, description?: string): Promise<TagAlias>`
- `listTagAliases(): Promise<TagAlias[]>`
- `removeTagAlias(alias: string): Promise<boolean>`
- `getAliasesForTag(canonicalTag: string): Promise<string[]>`

**Size**: ~400 lines

#### `ImportanceManager.ts`
**Responsibility**: Importance level operations

**Methods**:
- `setImportance(entityName: string, importance: number): Promise<{...}>`

**Size**: ~50 lines

#### `HierarchyManager.ts`
**Responsibility**: Parent-child relationships

**Methods**:
- `setEntityParent(entityName: string, parentName: string | null): Promise<Entity>`
- `getChildren(entityName: string): Promise<Entity[]>`
- `getParent(entityName: string): Promise<Entity | null>`
- `getAncestors(entityName: string): Promise<Entity[]>`
- `getDescendants(entityName: string): Promise<Entity[]>`
- `getSubtree(entityName: string): Promise<KnowledgeGraph>`
- `getRootEntities(): Promise<Entity[]>`
- `getEntityDepth(entityName: string): Promise<number>`
- `moveEntity(entityName: string, newParentName: string | null): Promise<Entity>`

**Size**: ~500 lines

#### `AnalyticsManager.ts`
**Responsibility**: Statistics and validation

**Methods**:
- `getGraphStats(): Promise<GraphStats>`
- `validateGraph(): Promise<ValidationReport>`

**Size**: ~300 lines

#### `CompressionManager.ts`
**Responsibility**: Deduplication and merging

**Methods**:
- `findDuplicates(threshold?: number): Promise<string[][]>`
- `mergeEntities(entityNames: string[], targetName?: string): Promise<Entity>`
- `compressGraph(threshold?: number, dryRun?: boolean): Promise<CompressionResult>`
- `calculateSimilarity(e1: Entity, e2: Entity): number`

**Size**: ~400 lines

**Dependencies**: utils/levenshtein.ts

#### `ArchiveManager.ts`
**Responsibility**: Archiving operations

**Methods**:
- `archiveEntities(criteria: {...}, dryRun?: boolean): Promise<ImportResult>`

**Size**: ~150 lines

#### `ImportExportManager.ts`
**Responsibility**: Multi-format import/export

**Methods**:
- `exportGraph(format: '...', filter?: {...}): Promise<string>`
- `importGraph(format: '...', data: string, mergeStrategy?: '...', dryRun?: boolean): Promise<ImportResult>`
- `exportJSON(graph: KnowledgeGraph): string`
- `exportCSV(graph: KnowledgeGraph): string`
- `exportGraphML(graph: KnowledgeGraph): string`
- `exportGEXF(graph: KnowledgeGraph): string`
- `exportDOT(graph: KnowledgeGraph): string`
- `exportMarkdown(graph: KnowledgeGraph): string`
- `exportMermaid(graph: KnowledgeGraph): string`
- `importJSON(data: string): KnowledgeGraph`
- `importCSV(data: string): KnowledgeGraph`
- `importGraphML(data: string): KnowledgeGraph`

**Size**: ~850 lines (largest complex module)

---

### 5. Utils Module (`src/memory/utils/`)

**Purpose**: Reusable utility functions

#### `levenshtein.ts`
```typescript
export function levenshteinDistance(str1: string, str2: string): number {
  // Implementation
}
```
**Size**: ~30 lines

#### `tfidf.ts`
```typescript
export function calculateTF(term: string, document: string): number {
  // Implementation
}

export function calculateIDF(term: string, documents: string[]): number {
  // Implementation
}

export function calculateTFIDF(term: string, document: string, documents: string[]): number {
  // Implementation
}
```
**Size**: ~100 lines

#### `dateUtils.ts`
```typescript
export function isWithinDateRange(date: string, start?: string, end?: string): boolean {
  // Implementation
}

export function parseDateRange(startDate?: string, endDate?: string): { start: Date | null; end: Date | null } {
  // Implementation
}
```
**Size**: ~50 lines

#### `validationUtils.ts`
```typescript
export function validateEntity(entity: Entity): { valid: boolean; errors: string[] } {
  // Implementation
}

export function validateImportance(importance: number): boolean {
  // Implementation
}
```
**Size**: ~100 lines

#### `pathUtils.ts`
```typescript
export async function ensureMemoryFilePath(): Promise<string> {
  // Current implementation from index.ts
}

export const defaultMemoryPath: string;
```
**Size**: ~80 lines

---

### 6. MCP Module (`src/memory/mcp/`)

**Purpose**: MCP Server configuration, tool definitions, and handlers

#### `server.ts`
**Responsibility**: Server initialization and lifecycle

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { toolRegistry } from './tools/index.js';
import { handlerRegistry } from './handlers/index.js';

export async function createServer(knowledgeGraphManager: KnowledgeGraphManager): Promise<Server> {
  const server = new Server({
    name: "memory-server",
    version: "0.8.0",
  }, {
    capabilities: {
      tools: {},
    },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: toolRegistry.getAllTools() };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handlerRegistry.handleRequest(request, knowledgeGraphManager);
  });

  return server;
}
```

**Size**: ~50 lines

#### `tools/index.ts`
**Responsibility**: Tool registry

```typescript
import { entityTools } from './entity.tools.js';
import { searchTools } from './search.tools.js';
import { tagTools } from './tag.tools.js';
// ... other tool imports

export class ToolRegistry {
  getAllTools() {
    return [
      ...entityTools,
      ...searchTools,
      ...tagTools,
      // ... other tools
    ];
  }
}

export const toolRegistry = new ToolRegistry();
```

**Size**: ~50 lines

#### `tools/entity.tools.ts`
**Responsibility**: Entity CRUD tool definitions

**Tools**: create_entities, delete_entities, delete_observations

**Size**: ~150 lines

#### `tools/search.tools.ts`
**Responsibility**: Search tool definitions

**Tools**: search_nodes, search_nodes_ranked, open_nodes, search_by_date_range, boolean_search, fuzzy_search, get_search_suggestions

**Size**: ~250 lines

#### `tools/tag.tools.ts`
**Responsibility**: Tag tool definitions

**Tools**: add_tags, remove_tags, add_tags_to_multiple_entities, replace_tag, merge_tags, add_tag_alias, list_tag_aliases, remove_tag_alias, get_aliases_for_tag, resolve_tag

**Size**: ~300 lines

#### `tools/hierarchy.tools.ts`
**Responsibility**: Hierarchy tool definitions

**Tools**: set_entity_parent, get_children, get_parent, get_ancestors, get_descendants, get_subtree, get_root_entities, get_entity_depth

**Size**: ~250 lines

#### `tools/analytics.tools.ts`
**Responsibility**: Analytics tool definitions

**Tools**: get_graph_stats, validate_graph

**Size**: ~80 lines

#### `tools/import-export.tools.ts`
**Responsibility**: Import/Export tool definitions

**Tools**: import_graph, export_graph, find_duplicates, merge_entities, compress_graph, archive_entities

**Size**: ~250 lines

#### `handlers/index.ts`
**Responsibility**: Handler registry and routing

```typescript
import { entityHandlers } from './entity.handlers.js';
import { searchHandlers } from './search.handlers.js';
// ... other handler imports

export class HandlerRegistry {
  async handleRequest(request: any, manager: KnowledgeGraphManager) {
    const { name, arguments: args } = request.params;

    // Simple tools without args
    if (name === "read_graph") {
      return { content: [{ type: "text", text: JSON.stringify(await manager.readGraph(), null, 2) }] };
    }

    if (!args) {
      throw new Error(`No arguments provided for tool: ${name}`);
    }

    // Route to appropriate handler
    if (entityHandlers[name]) {
      return entityHandlers[name](args, manager);
    }
    if (searchHandlers[name]) {
      return searchHandlers[name](args, manager);
    }
    // ... other handler routing

    throw new Error(`Unknown tool: ${name}`);
  }
}

export const handlerRegistry = new HandlerRegistry();
```

**Size**: ~100 lines

#### `handlers/entity.handlers.ts`
**Responsibility**: Entity tool handlers

```typescript
export const entityHandlers = {
  create_entities: async (args: any, manager: KnowledgeGraphManager) => {
    return { content: [{ type: "text", text: JSON.stringify(await manager.createEntities(args.entities), null, 2) }] };
  },
  delete_entities: async (args: any, manager: KnowledgeGraphManager) => {
    await manager.deleteEntities(args.entityNames);
    return { content: [{ type: "text", text: "Entities deleted successfully" }] };
  },
  // ... other entity handlers
};
```

**Size**: ~150 lines

#### `handlers/search.handlers.ts`
**Responsibility**: Search tool handlers

**Size**: ~250 lines

#### `handlers/tag.handlers.ts`
**Responsibility**: Tag tool handlers

**Size**: ~250 lines

#### `handlers/hierarchy.handlers.ts`
**Responsibility**: Hierarchy tool handlers

**Size**: ~200 lines

#### `handlers/analytics.handlers.ts`
**Responsibility**: Analytics tool handlers

**Size**: ~80 lines

#### `handlers/import-export.handlers.ts`
**Responsibility**: Import/Export tool handlers

**Size**: ~150 lines

---

### 7. Main Entry Point (`src/memory/index.ts`)

**Responsibility**: Application bootstrapping and initialization

```typescript
#!/usr/bin/env node

import { KnowledgeGraphManager } from './core/KnowledgeGraphManager.js';
import { ensureMemoryFilePath } from './utils/pathUtils.js';
import { createServer } from './mcp/server.js';

async function main() {
  // Initialize memory file path with backward compatibility
  const memoryFilePath = await ensureMemoryFilePath();

  // Initialize knowledge graph manager
  const knowledgeGraphManager = new KnowledgeGraphManager(memoryFilePath);

  // Create and start MCP server
  const server = await createServer(knowledgeGraphManager);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Knowledge Graph MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
```

**Size**: ~30 lines (down from 4,187!)

---

## Implementation Strategy

### Phase 1: Foundation (Week 1)
**Goal**: Establish new structure without breaking existing code

1. **Create Directory Structure**
   - Create all new directories: types/, core/, search/, features/, utils/, mcp/
   - Keep existing index.ts untouched

2. **Extract Types**
   - Create all type files in types/ directory
   - Export from types/index.ts
   - No code changes to index.ts yet

3. **Setup Tests**
   - Create test files for each new module
   - Copy existing tests as baseline

**Deliverables**:
- ✅ New directory structure
- ✅ Types extracted and organized
- ✅ Test infrastructure ready

**Risk**: Low - No existing code modified

---

### Phase 2: Extract Utilities (Week 1-2)
**Goal**: Move pure utility functions to separate files

1. **Extract String Utilities**
   - Move Levenshtein distance to utils/levenshtein.ts
   - Move TF-IDF functions to utils/tfidf.ts
   - Add comprehensive tests

2. **Extract Validation Utilities**
   - Move validation logic to utils/validationUtils.ts
   - Move date utilities to utils/dateUtils.ts

3. **Extract Path Utilities**
   - Move ensureMemoryFilePath to utils/pathUtils.ts

4. **Update index.ts**
   - Import utilities from new locations
   - Verify all tests pass

**Deliverables**:
- ✅ All utilities extracted
- ✅ 100% test coverage for utils
- ✅ index.ts imports from utils/

**Risk**: Low - Pure functions, easy to test

---

### Phase 3: Extract Storage Layer (Week 2)
**Goal**: Separate file I/O from business logic

1. **Create GraphStorage.ts**
   - Extract loadGraph() method
   - Extract saveGraph() method
   - Add file path management

2. **Update KnowledgeGraphManager**
   - Replace direct file I/O with GraphStorage
   - Inject GraphStorage via constructor

3. **Test Storage Layer**
   - Mock file system operations
   - Test backward compatibility
   - Test JSONL format handling

**Deliverables**:
- ✅ GraphStorage.ts with tests
- ✅ KnowledgeGraphManager uses GraphStorage
- ✅ All existing tests pass

**Risk**: Medium - Core functionality, needs careful testing

---

### Phase 4: Extract Core Managers (Week 3)
**Goal**: Separate CRUD operations by domain

1. **Create EntityManager.ts**
   - Extract entity CRUD methods
   - Inject GraphStorage dependency

2. **Create RelationManager.ts**
   - Extract relation CRUD methods
   - Inject GraphStorage dependency

3. **Create ObservationManager.ts**
   - Extract observation CRUD methods
   - Inject GraphStorage dependency

4. **Update KnowledgeGraphManager**
   - Use composition pattern
   - Delegate to specialized managers
   - Maintain existing public API

**Deliverables**:
- ✅ EntityManager.ts with tests
- ✅ RelationManager.ts with tests
- ✅ ObservationManager.ts with tests
- ✅ KnowledgeGraphManager delegates correctly

**Risk**: Medium - Business logic changes, thorough testing needed

---

### Phase 5: Extract Search Module (Week 4)
**Goal**: Modularize complex search functionality

1. **Create Search Managers**
   - SearchManager.ts (basic search)
   - RankedSearch.ts (TF-IDF)
   - BooleanSearch.ts (query parsing)
   - FuzzySearch.ts (Levenshtein-based)
   - SearchSuggestions.ts (trigrams)
   - SavedSearchManager.ts (saved searches)

2. **Test Search Functionality**
   - Unit tests for each search type
   - Integration tests for SearchManager
   - Performance benchmarks

**Deliverables**:
- ✅ All search modules extracted
- ✅ Comprehensive test coverage
- ✅ Search performance maintained or improved

**Risk**: High - Complex algorithms, needs extensive testing

---

### Phase 6: Extract Feature Managers (Week 5)
**Goal**: Separate advanced features

1. **Create Feature Managers**
   - TagManager.ts
   - ImportanceManager.ts
   - HierarchyManager.ts
   - AnalyticsManager.ts
   - CompressionManager.ts
   - ArchiveManager.ts
   - ImportExportManager.ts

2. **Test Features**
   - Unit tests for each manager
   - Integration tests
   - Edge case testing

**Deliverables**:
- ✅ All feature managers extracted
- ✅ Test coverage > 80%
- ✅ All features working correctly

**Risk**: Medium-High - Many interdependencies

---

### Phase 7: Extract MCP Layer (Week 6)
**Goal**: Separate API definitions from business logic

1. **Create MCP Structure**
   - server.ts
   - tools/ directory with tool definitions
   - handlers/ directory with request handlers

2. **Extract Tool Definitions**
   - Split into domain-specific files
   - Create tool registry

3. **Extract Handlers**
   - Split into domain-specific files
   - Create handler registry
   - Implement routing logic

4. **Update index.ts**
   - Simplify to just bootstrapping
   - Import and wire up components

**Deliverables**:
- ✅ MCP layer fully modularized
- ✅ Clean separation of concerns
- ✅ index.ts < 50 lines

**Risk**: Medium - API layer, needs compatibility testing

---

### Phase 8: Final Integration & Testing (Week 7)
**Goal**: Ensure everything works together

1. **Integration Testing**
   - End-to-end tests
   - All 45 tools tested
   - Performance testing

2. **Documentation**
   - Update README with new structure
   - Add architecture documentation
   - Create migration guide

3. **Code Review**
   - Review all changes
   - Check for code smells
   - Ensure consistency

4. **Release Preparation**
   - Version bump
   - Changelog update
   - Release notes

**Deliverables**:
- ✅ All tests passing
- ✅ Documentation updated
- ✅ Ready for release

**Risk**: Low - Final validation phase

---

## Migration Path

### Backward Compatibility

**Guarantee**: All existing code using the current API will continue to work without changes.

**Strategy**:
1. Keep KnowledgeGraphManager as the main public API
2. Maintain all existing method signatures
3. Use composition pattern internally
4. Export all public types from main index.ts

### Example Migration

**Before** (current):
```typescript
import { KnowledgeGraphManager } from '@danielsimonjr/memory-mcp';

const manager = new KnowledgeGraphManager('/path/to/memory.jsonl');
await manager.createEntities([{ name: 'Alice', entityType: 'person', observations: [] }]);
```

**After** (refactored):
```typescript
import { KnowledgeGraphManager } from '@danielsimonjr/memory-mcp';

const manager = new KnowledgeGraphManager('/path/to/memory.jsonl');
await manager.createEntities([{ name: 'Alice', entityType: 'person', observations: [] }]);
```

**No changes required!** The internal implementation uses managers, but the public API remains identical.

### Advanced Usage (Optional)

For users who want finer-grained control:

```typescript
import { EntityManager, GraphStorage } from '@danielsimonjr/memory-mcp/core';
import { RankedSearch } from '@danielsimonjr/memory-mcp/search';

const storage = new GraphStorage('/path/to/memory.jsonl');
const entityManager = new EntityManager(storage);
const rankedSearch = new RankedSearch(storage);

// Use specific managers directly
```

---

## Testing Strategy

### Current Test Coverage
- Only 2 test files exist
- Limited coverage of core functionality
- No coverage of advanced features

### Target Test Coverage
- **Overall**: > 85%
- **Core Modules**: > 95%
- **Search Modules**: > 90%
- **Feature Modules**: > 80%
- **Utils**: 100%

### Test Types

1. **Unit Tests**
   - Test each module in isolation
   - Mock dependencies
   - Fast execution (< 100ms per test)

2. **Integration Tests**
   - Test module interactions
   - Use real file system (temp directories)
   - Verify end-to-end workflows

3. **Performance Tests**
   - Benchmark search operations
   - Test with large graphs (10k+ entities)
   - Ensure no regressions

4. **Compatibility Tests**
   - Test backward compatibility
   - Verify JSONL format handling
   - Test migration scenarios

### Test Organization

```
src/memory/__tests__/
├── unit/
│   ├── core/
│   │   ├── EntityManager.test.ts
│   │   ├── RelationManager.test.ts
│   │   └── GraphStorage.test.ts
│   ├── search/
│   │   ├── RankedSearch.test.ts
│   │   ├── BooleanSearch.test.ts
│   │   └── FuzzySearch.test.ts
│   ├── features/
│   │   ├── TagManager.test.ts
│   │   ├── HierarchyManager.test.ts
│   │   └── CompressionManager.test.ts
│   └── utils/
│       ├── levenshtein.test.ts
│       └── tfidf.test.ts
├── integration/
│   ├── entity-operations.test.ts
│   ├── search-operations.test.ts
│   ├── hierarchy-operations.test.ts
│   └── import-export.test.ts
├── performance/
│   ├── search-benchmark.test.ts
│   └── large-graph.test.ts
└── compatibility/
    ├── backward-compat.test.ts
    └── migration.test.ts
```

---

## Benefits

### 1. Maintainability
- **Easier Navigation**: Find code faster with logical organization
- **Smaller Files**: Each file < 500 lines (vs 4,187)
- **Clear Responsibilities**: Each module has one job
- **Reduced Cognitive Load**: Understand one module at a time

### 2. Testability
- **Unit Testing**: Test modules in isolation
- **Mocking**: Easy to mock dependencies
- **Test Coverage**: Achieve > 85% coverage
- **TDD**: Enable test-driven development

### 3. Team Collaboration
- **Reduced Merge Conflicts**: Changes isolated to specific files
- **Parallel Development**: Multiple developers work simultaneously
- **Code Reviews**: Smaller, focused PRs
- **Onboarding**: New developers understand structure faster

### 4. Performance
- **Better Tree Shaking**: Import only needed modules
- **Faster Builds**: Incremental compilation
- **Optimized Loading**: Lazy loading potential
- **IDE Performance**: Faster IntelliSense and linting

### 5. Extensibility
- **Easy to Add Features**: Create new manager in features/
- **Plugin Architecture**: Potential for plugin system
- **Custom Implementations**: Override specific managers
- **Third-party Integration**: Export individual modules

### 6. Code Quality
- **Single Responsibility Principle**: Each module has one job
- **Dependency Injection**: Testable and flexible
- **Separation of Concerns**: Clear boundaries
- **DRY**: Shared utilities in utils/

---

## Risks and Mitigation

### Risk 1: Breaking Changes
**Probability**: Medium
**Impact**: High
**Mitigation**:
- Maintain backward compatibility in KnowledgeGraphManager
- Comprehensive integration tests
- Beta release with deprecation warnings
- Clear migration documentation

### Risk 2: Performance Regression
**Probability**: Low
**Impact**: Medium
**Mitigation**:
- Performance benchmarks before/after
- Profile critical paths
- Optimize hot paths
- Monitor in production

### Risk 3: Increased Complexity
**Probability**: Medium
**Impact**: Low
**Mitigation**:
- Clear documentation
- Architecture diagrams
- Code examples
- Developer guide

### Risk 4: Test Coverage Gaps
**Probability**: Medium
**Impact**: Medium
**Mitigation**:
- Test-driven development
- Code coverage reports
- Mandatory review of test coverage
- Integration test suite

### Risk 5: Migration Effort
**Probability**: Low
**Impact**: Medium
**Mitigation**:
- Maintain public API compatibility
- Provide migration guide
- Support both old/new patterns temporarily
- Clear deprecation timeline

---

## Success Criteria

### Code Quality Metrics
- ✅ Average file size < 500 lines
- ✅ No file > 1000 lines
- ✅ Test coverage > 85%
- ✅ Cyclomatic complexity < 10 per function
- ✅ Zero ESLint errors
- ✅ Zero TypeScript errors

### Functional Metrics
- ✅ All 45 tools working
- ✅ All existing tests passing
- ✅ New tests for all modules
- ✅ Backward compatibility maintained
- ✅ Performance within 5% of baseline

### Developer Experience Metrics
- ✅ Onboarding time reduced by 50%
- ✅ Code review time reduced by 30%
- ✅ Feature development time reduced by 20%
- ✅ Build time < 10 seconds
- ✅ Test suite runs in < 30 seconds

---

## Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Foundation | Week 1 | Directory structure, types extracted |
| Phase 2: Utilities | Week 1-2 | All utils extracted and tested |
| Phase 3: Storage | Week 2 | GraphStorage module |
| Phase 4: Core Managers | Week 3 | Entity, Relation, Observation managers |
| Phase 5: Search | Week 4 | All search modules |
| Phase 6: Features | Week 5 | All feature managers |
| Phase 7: MCP Layer | Week 6 | Server, tools, handlers |
| Phase 8: Integration | Week 7 | Testing, docs, release |

**Total Duration**: 7 weeks

**Effort**: ~140-175 hours

---

## Next Steps

1. **Review and Approve Plan**
   - Get stakeholder feedback
   - Adjust timeline if needed
   - Assign resources

2. **Create Tracking Issues**
   - One issue per phase
   - Break down into tasks
   - Set up project board

3. **Setup Branch**
   - Create `refactor/modular-architecture` branch
   - Setup CI/CD for branch
   - Configure test coverage reporting

4. **Begin Phase 1**
   - Create directory structure
   - Extract types
   - Setup test infrastructure

5. **Regular Check-ins**
   - Weekly progress reviews
   - Address blockers
   - Adjust plan as needed

---

## Conclusion

This refactoring plan transforms the monolithic 4,187-line `index.ts` into a modular, maintainable architecture with 15-20 focused modules. The phased approach ensures minimal risk while delivering significant improvements in code quality, testability, and developer experience.

The refactoring maintains 100% backward compatibility while positioning the codebase for future enhancements. With clear phases, success criteria, and risk mitigation strategies, this plan provides a roadmap for sustainable growth of the memory MCP server.

**Recommendation**: Proceed with Phase 1 to establish the foundation and validate the approach before committing to the full refactoring.

---

## Appendix A: File Size Comparison

| Module | Current (lines) | Target (lines) | Reduction |
|--------|----------------|----------------|-----------|
| index.ts | 4,187 | 30 | -99.3% |
| Types | (in index.ts) | 187 | N/A |
| Core Managers | (in index.ts) | 800 | N/A |
| Search Modules | (in index.ts) | 1,350 | N/A |
| Feature Managers | (in index.ts) | 2,300 | N/A |
| Utils | (in index.ts) | 360 | N/A |
| MCP Layer | (in index.ts) | 2,000 | N/A |
| **Total** | **4,187** | **7,027** | +68% |

**Note**: Total line count increases due to:
- Module boundaries (imports/exports)
- Better separation of concerns
- More comprehensive error handling
- Additional documentation
- More extensive tests

This is a **positive trade-off** - we exchange raw line count for dramatically improved maintainability, testability, and code organization.

---

## Appendix B: Dependency Graph

```
index.ts (entry point)
  ├─> utils/pathUtils.ts
  ├─> core/KnowledgeGraphManager.ts
  │     ├─> core/GraphStorage.ts
  │     │     ├─> types/entity.types.ts
  │     │     └─> utils/pathUtils.ts
  │     ├─> core/EntityManager.ts
  │     │     ├─> core/GraphStorage.ts
  │     │     └─> types/entity.types.ts
  │     ├─> core/RelationManager.ts
  │     │     ├─> core/GraphStorage.ts
  │     │     └─> types/entity.types.ts
  │     ├─> core/ObservationManager.ts
  │     │     ├─> core/GraphStorage.ts
  │     │     └─> types/entity.types.ts
  │     ├─> search/SearchManager.ts
  │     │     ├─> search/BasicSearch.ts
  │     │     ├─> search/RankedSearch.ts
  │     │     │     └─> utils/tfidf.ts
  │     │     ├─> search/BooleanSearch.ts
  │     │     ├─> search/FuzzySearch.ts
  │     │     │     └─> utils/levenshtein.ts
  │     │     └─> search/SearchSuggestions.ts
  │     ├─> features/TagManager.ts
  │     ├─> features/HierarchyManager.ts
  │     ├─> features/CompressionManager.ts
  │     │     └─> utils/levenshtein.ts
  │     ├─> features/AnalyticsManager.ts
  │     └─> features/ImportExportManager.ts
  └─> mcp/server.ts
        ├─> mcp/tools/*.ts
        └─> mcp/handlers/*.ts
```

---

## Appendix C: Example PR Sequence

### PR #1: Extract Types (Phase 1)
**Files Changed**: 6 files added
**Lines Changed**: +200, -0
**Risk**: Very Low
**Review Time**: 30 minutes

### PR #2: Extract Utilities (Phase 2)
**Files Changed**: 6 files added, 1 modified
**Lines Changed**: +400, -300
**Risk**: Low
**Review Time**: 1 hour

### PR #3: Extract Storage Layer (Phase 3)
**Files Changed**: 2 files added, 1 modified
**Lines Changed**: +200, -150
**Risk**: Medium
**Review Time**: 1.5 hours

### PR #4: Extract Core Managers (Phase 4)
**Files Changed**: 4 files added, 1 modified
**Lines Changed**: +900, -700
**Risk**: Medium
**Review Time**: 2 hours

### PR #5: Extract Search Module (Phase 5)
**Files Changed**: 7 files added, 1 modified
**Lines Changed**: +1400, -1200
**Risk**: High
**Review Time**: 3 hours

### PR #6: Extract Feature Managers (Phase 6)
**Files Changed**: 8 files added, 1 modified
**Lines Changed**: +2400, -2100
**Risk**: Medium-High
**Review Time**: 4 hours

### PR #7: Extract MCP Layer (Phase 7)
**Files Changed**: 15 files added, 1 modified
**Lines Changed**: +2100, -2000
**Risk**: Medium
**Review Time**: 2 hours

### PR #8: Final Integration (Phase 8)
**Files Changed**: 30+ files modified (tests, docs)
**Lines Changed**: +1500, -100
**Risk**: Low
**Review Time**: 2 hours

---

**Document Version**: 1.0
**Last Updated**: 2025-11-23
**Author**: Claude (AI Assistant)
**Status**: Draft - Awaiting Review
