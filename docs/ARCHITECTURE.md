# Memory MCP - System Architecture

**Version**: 0.17.0
**Last Updated**: 2025-11-25

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Principles](#architecture-principles)
3. [System Context](#system-context)
4. [Component Architecture](#component-architecture)
5. [Data Model](#data-model)
6. [Key Design Decisions](#key-design-decisions)
7. [Data Flow Patterns](#data-flow-patterns)
8. [Performance Considerations](#performance-considerations)
9. [Security Architecture](#security-architecture)
10. [Testing Strategy](#testing-strategy)

---

## System Overview

Memory MCP is an enhanced Model Context Protocol (MCP) server that provides persistent knowledge graph storage with advanced features including:

- **Entity-Relation Knowledge Graph**: Store and query interconnected knowledge
- **Hierarchical Organization**: Parent-child entity relationships
- **Advanced Search**: Basic, ranked (TF-IDF), boolean, and fuzzy search
- **Compression**: Automatic duplicate detection and merging
- **Tagging & Importance**: Flexible categorization and prioritization
- **Timestamps**: Automatic tracking of creation and modification times
- **Batch Operations**: Efficient bulk updates

### Key Statistics (v0.17.0)

- **396 Tests**: 100% passing (unit, integration, edge cases, performance)
- **Test Coverage**: 98%+ across core managers
- **Performance**: Handles 2000+ entities, 5000+ total elements efficiently
- **TypeScript**: Strict mode, full type safety

---

## Architecture Principles

### 1. Modularity
- **Single Responsibility**: Each module has one clear purpose
- **Loose Coupling**: Modules interact through well-defined interfaces
- **High Cohesion**: Related functionality grouped together

### 2. Testability
- **Dependency Injection**: Storage injected into managers
- **Pure Functions**: Utils are stateless and predictable
- **Test Coverage**: 98%+ coverage across core components

### 3. Performance
- **Single I/O Operations**: Batch operations use one read/write cycle
- **In-Memory Processing**: Load once, process in memory, save once
- **Efficient Algorithms**: TF-IDF for ranking, Levenshtein for fuzzy matching

### 4. Maintainability
- **TypeScript Strict Mode**: Full type safety
- **JSDoc Coverage**: 100% documentation on public APIs
- **Consistent Patterns**: Similar structure across managers

### 5. Security
- **Path Traversal Protection**: Validated storage paths
- **Input Validation**: Zod schemas for all inputs
- **No Code Injection**: Safe string handling, no eval

---

## System Context

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                     MCP Client (Claude)                       │
│                                                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ MCP Protocol
                            │ (JSON-RPC)
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                                                               │
│                   Memory MCP Server                           │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                  MCP Handler Layer                   │    │
│  │            (index.ts - Request Router)               │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │                                    │
│  ┌───────────────────────┴─────────────────────────────┐    │
│  │              Core Managers Layer                     │    │
│  │  • EntityManager   • RelationManager                 │    │
│  │  • SearchManager   • CompressionManager              │    │
│  │  • TagManager      • ExportManager                   │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │                                    │
│  ┌───────────────────────┴─────────────────────────────┐    │
│  │              Storage Layer                           │    │
│  │              GraphStorage                            │    │
│  └───────────────────────┬─────────────────────────────┘    │
│                          │                                    │
└──────────────────────────┼────────────────────────────────────┘
                           │
                           │ File System I/O
                           │
                    ┌──────┴──────┐
                    │   JSONL     │
                    │   Storage   │
                    │   File      │
                    └─────────────┘
```

### External Actors

1. **MCP Client (Claude)**: AI assistant using MCP protocol to interact with memory
2. **File System**: Persistent storage for knowledge graph (JSONL format)
3. **Developer**: Maintains and extends the server

---

## Component Architecture

### Layer 1: MCP Handler (index.ts)

**Responsibility**: Request routing and MCP protocol handling

```typescript
// 45 Tool Handlers
createEntities, getEntity, updateEntity, deleteEntities,
createRelations, getRelations, deleteRelations,
searchNodes, searchNodesRanked, booleanSearch, fuzzySearch,
findDuplicates, mergeEntities, compressGraph,
// ... and 31 more
```

**Design Pattern**: Facade Pattern
- Provides simple interface to complex subsystems
- Routes requests to appropriate managers
- Handles error responses and logging

### Layer 2: Core Managers

#### EntityManager (core/EntityManager.ts)

**Responsibility**: Entity CRUD operations

```typescript
class EntityManager {
  constructor(private storage: GraphStorage)

  // Core Operations
  async createEntities(entities: Entity[]): Promise<Entity[]>
  async getEntity(name: string): Promise<Entity | null>
  async updateEntity(name: string, updates: Partial<Entity>): Promise<Entity>
  async deleteEntities(names: string[]): Promise<void>
  async batchUpdate(updates: Array<{name, updates}>): Promise<Entity[]>
}
```

**Key Features**:
- Automatic timestamp management (createdAt, lastModified)
- Duplicate entity prevention
- Batch update operations (single I/O)
- Tag normalization (lowercase)
- Validation using Zod schemas

**Test Coverage**: 98%+ (48 tests)

#### RelationManager (core/RelationManager.ts)

**Responsibility**: Relation CRUD operations

```typescript
class RelationManager {
  constructor(private storage: GraphStorage)

  // Core Operations
  async createRelations(relations: Relation[]): Promise<Relation[]>
  async getRelations(entityName: string): Promise<{incoming, outgoing}>
  async deleteRelations(relations: Relation[]): Promise<void>
}
```

**Key Features**:
- Automatic timestamp management
- Duplicate relation prevention
- Deferred integrity (relations to non-existent entities allowed)
- Cascading updates on relation changes
- Bidirectional relation tracking

**Test Coverage**: 98%+ (26 tests)

#### SearchManager (search/*)

**Responsibility**: Multiple search strategies

```typescript
// BasicSearch - Text matching with filters
class BasicSearch {
  async searchNodes(query, tags?, minImportance?, maxImportance?): Promise<KnowledgeGraph>
  async openNodes(names: string[]): Promise<KnowledgeGraph>
  async searchByDateRange(start?, end?, entityType?, tags?): Promise<KnowledgeGraph>
}

// RankedSearch - TF-IDF scoring
class RankedSearch {
  async searchNodesRanked(query, tags?, minImportance?, maxImportance?, limit?): Promise<SearchResult[]>
}

// BooleanSearch - AND/OR/NOT logic
class BooleanSearch {
  async booleanSearch(query: string): Promise<KnowledgeGraph>
}

// FuzzySearch - Typo tolerance
class FuzzySearch {
  async fuzzySearch(query, threshold?, tags?, minImportance?, maxImportance?): Promise<KnowledgeGraph>
}
```

**Key Features**:
- Multiple search strategies for different use cases
- TF-IDF scoring for relevance ranking
- Boolean query parsing (AND, OR, NOT, parentheses)
- Levenshtein distance for fuzzy matching
- Combined filtering (tags, importance, dates)

**Test Coverage**: 98%+ (118 tests across all search implementations)

#### CompressionManager (features/CompressionManager.ts)

**Responsibility**: Duplicate detection and merging

```typescript
class CompressionManager {
  async findDuplicates(threshold): Promise<string[][]>
  async mergeEntities(entityNames, targetName?): Promise<Entity>
  async compressGraph(threshold, dryRun): Promise<CompressionResult>
}
```

**Key Features**:
- Two-level similarity bucketing for performance
- Configurable similarity threshold (0.0 - 1.0)
- Smart observation and tag merging
- Relation transfer to merged entity
- Dry-run mode for preview

**Algorithm**:
1. Bucket entities by entityType (fast filter)
2. Calculate similarity within buckets (weighted scoring)
3. Merge entities above threshold
4. Transfer relations and delete originals

**Test Coverage**: 98%+ (29 tests)

### Layer 3: Storage

#### GraphStorage (core/GraphStorage.ts)

**Responsibility**: File I/O and caching

```typescript
class GraphStorage {
  constructor(private filePath: string)

  async loadGraph(): Promise<KnowledgeGraph>
  async saveGraph(graph: KnowledgeGraph): Promise<void>
}
```

**Key Features**:
- JSONL format (line-delimited JSON)
- In-memory caching
- Atomic writes (write to temp, then rename)
- Path traversal protection
- Error recovery

### Layer 4: Utilities

#### Validation (utils/schemas.ts)

**Zod Schemas**:
- EntitySchema, CreateEntitySchema, UpdateEntitySchema
- RelationSchema, CreateRelationSchema
- SearchQuerySchema, DateRangeSchema
- Batch operation schemas (max 1000 items)

**Validation Rules**:
- Entity names: 1-500 characters (trimmed)
- Entity types: 1-100 characters (trimmed)
- Observations: 1-5000 characters each
- Tags: 1-100 characters each (normalized to lowercase)
- Importance: 0-10 (integer)
- Timestamps: ISO 8601 format

#### Text Processing (utils/*)

```typescript
// Levenshtein Distance
function levenshteinDistance(s1: string, s2: string): number

// TF-IDF Scoring
function calculateTF(term: string, document: string): number
function calculateIDF(term: string, documents: string[]): number
function calculateTFIDF(term: string, document: string, documents: string[]): number

// Date Utilities
function isWithinDateRange(date: string, start?: string, end?: string): boolean
```

---

## Data Model

### Entity

```typescript
interface Entity {
  name: string;              // Unique identifier (1-500 chars)
  entityType: string;        // Category (e.g., "person", "project")
  observations: string[];    // Free-form text descriptions
  createdAt: string;         // ISO 8601 timestamp
  lastModified: string;      // ISO 8601 timestamp
  tags?: string[];           // Optional categorization (lowercase)
  importance?: number;       // Optional 0-10 priority
  parentId?: string;         // Optional hierarchical parent
}
```

### Relation

```typescript
interface Relation {
  from: string;              // Source entity name
  to: string;                // Target entity name
  relationType: string;      // Relation type (e.g., "works_at")
  createdAt: string;         // ISO 8601 timestamp
  lastModified: string;      // ISO 8601 timestamp
}
```

### Knowledge Graph

```typescript
interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}
```

**Storage Format** (JSONL):
```jsonl
{"entities":[...],"relations":[...]}
```

---

## Key Design Decisions

### 1. Why JSONL Format?

**Decision**: Use line-delimited JSON (JSONL) for storage

**Rationale**:
- **Simplicity**: Human-readable, standard format
- **Debugging**: Easy to inspect and modify
- **Portability**: Works across all platforms
- **Single-File**: Entire graph in one file
- **Atomic Writes**: Easier to ensure consistency

**Alternatives Considered**:
- **SQLite**: More complex, overhead for small graphs
- **JSON**: Same benefits, JSONL is more future-proof for streaming
- **Binary**: Faster but not human-readable

**Trade-offs**:
- ✅ Simplicity, portability, debuggability
- ❌ Not optimal for very large graphs (>100k entities)

### 2. Why In-Memory Processing?

**Decision**: Load entire graph into memory, process, then save

**Rationale**:
- **Performance**: Orders of magnitude faster than iterative I/O
- **Simplicity**: No need for complex streaming logic
- **Consistency**: Atomic operations on full graph
- **Small Graphs**: Typical use case is <10k entities

**Performance Impact**:
- 1000 entities: ~20MB memory, <500ms load time
- 5000 entities: ~100MB memory, <2s load time

**Alternatives Considered**:
- **Streaming**: Complex, slower for typical use cases
- **Database**: Overhead, external dependency

### 3. Why Modular Architecture?

**Decision**: Separate managers for entities, relations, search, compression

**Rationale**:
- **Single Responsibility**: Each manager has one clear purpose
- **Testability**: Easier to test in isolation
- **Maintainability**: Changes localized to specific managers
- **Extensibility**: Easy to add new managers

**Example Structure**:
```
core/
  EntityManager.ts      (entity CRUD)
  RelationManager.ts    (relation CRUD)
  GraphStorage.ts       (file I/O)
search/
  BasicSearch.ts        (text search)
  RankedSearch.ts       (TF-IDF)
  BooleanSearch.ts      (boolean logic)
  FuzzySearch.ts        (typo tolerance)
features/
  CompressionManager.ts (duplicate detection)
  TagManager.ts         (tag operations)
  ExportManager.ts      (export formats)
```

### 4. Why Two-Level Bucketing for Duplicates?

**Decision**: First bucket by entityType, then calculate similarity within buckets

**Rationale**:
- **Performance**: O(n²) → O(n²/k) where k is number of types
- **Accuracy**: Entities of different types rarely duplicates
- **Simplicity**: Easy to understand and maintain

**Algorithm**:
```typescript
1. Group entities by entityType
2. For each group:
   a. Calculate pairwise similarity
   b. Find pairs above threshold
3. Merge duplicate pairs
```

**Performance**:
- 1000 entities, 10 types: 100x speedup over naive approach
- 100 entities of same type: <300ms

### 5. Why Deferred Integrity?

**Decision**: Allow relations to non-existent entities

**Rationale**:
- **Flexibility**: Create relations before entities exist
- **Import/Export**: Easier to reconstruct graphs
- **Performance**: No need to validate existence on every operation

**Trade-off**:
- ✅ Flexibility, performance
- ❌ Potential for dangling relations

**Mitigation**:
- Documentation clearly states behavior
- Export/import tools handle cleanup
- Future: Optional integrity checking

---

## Data Flow Patterns

### Pattern 1: Create Entities

```
Client Request
    ↓
MCP Handler (index.ts)
    ↓
EntityManager.createEntities()
    ↓
1. Validate input (Zod schema)
2. Load graph from storage
3. Filter duplicates
4. Add timestamps
5. Normalize tags
6. Add entities to graph
7. Save graph to storage
    ↓
Return created entities
    ↓
MCP Response to Client
```

**I/O Operations**: 1 read + 1 write (total: 2)

### Pattern 2: Batch Update

```
Client Request
    ↓
MCP Handler (index.ts)
    ↓
EntityManager.batchUpdate()
    ↓
1. Validate all updates
2. Load graph (once)
3. For each update:
   a. Find entity
   b. Apply changes
   c. Update lastModified
4. Save graph (once)
    ↓
Return updated entities
    ↓
MCP Response to Client
```

**I/O Operations**: 1 read + 1 write (total: 2)
**Performance**: ~200ms for 100 updates

### Pattern 3: Search with Ranking

```
Client Request
    ↓
MCP Handler (index.ts)
    ↓
RankedSearch.searchNodesRanked()
    ↓
1. Load graph
2. Tokenize query
3. For each entity:
   a. Calculate TF-IDF score
   b. Apply filters (tags, importance)
4. Sort by score
5. Apply limit
6. Return results
    ↓
MCP Response to Client
```

**I/O Operations**: 1 read (total: 1)
**Performance**: ~600ms for 500 entities

### Pattern 4: Compress Duplicates

```
Client Request
    ↓
MCP Handler (index.ts)
    ↓
CompressionManager.compressGraph()
    ↓
1. Load graph
2. Bucket by entityType
3. For each bucket:
   a. Calculate pairwise similarity
   b. Find duplicates (threshold)
4. For each duplicate pair:
   a. Merge observations, tags
   b. Transfer relations
   c. Delete original
5. Save graph
    ↓
Return compression results
    ↓
MCP Response to Client
```

**I/O Operations**: 1 read + 1 write (total: 2)
**Performance**: ~400ms for 100 entities

---

## Performance Considerations

### Benchmarks (v0.17.0)

| Operation | Scale | Budget | Actual |
|-----------|-------|--------|--------|
| Create entities | 1 | <50ms | ~10ms |
| Create entities | 100 | <200ms | ~100ms |
| Create entities | 1000 | <1500ms | ~800ms |
| Batch update | 100 | <200ms | ~150ms |
| Basic search | 500 entities | <100ms | ~50ms |
| Ranked search | 500 entities | <600ms | ~500ms |
| Boolean search | 500 entities | <150ms | ~100ms |
| Fuzzy search | 500 entities | <200ms | ~150ms |
| Find duplicates | 100 | <300ms | ~200ms |
| Find duplicates | 500 | <1500ms | ~1100ms |
| Compress graph | 100 | <400ms | ~300ms |

### Optimization Strategies

1. **Batch Operations**: Single I/O cycle for multiple operations
2. **In-Memory Processing**: Avoid repeated file reads
3. **Efficient Algorithms**: TF-IDF, Levenshtein with early termination
4. **Bucketing**: Reduce O(n²) to O(n²/k) for similarity
5. **Lazy Loading**: Only load graph when needed (future optimization)

### Scalability Limits

**Current Design**:
- ✅ 0-2000 entities: Excellent performance
- ✅ 2000-5000 entities: Good performance
- ⚠️  5000-10000 entities: Acceptable performance
- ❌ 10000+ entities: Consider redesign (streaming, database)

---

## Security Architecture

### Input Validation

**All inputs validated using Zod schemas**:
```typescript
// Example: Entity creation
const entities = BatchCreateEntitiesSchema.parse(input);
// Throws ValidationError if invalid
```

**Validation Rules**:
- Max lengths: Prevent memory exhaustion
- Required fields: Ensure data integrity
- Type checking: Prevent injection attacks
- Trimming/normalization: Consistent data

### Path Traversal Protection

```typescript
// Validate storage path
const resolvedPath = path.resolve(filePath);
const baseDir = path.resolve('.');
if (!resolvedPath.startsWith(baseDir)) {
  throw new SecurityError('Path traversal attempt');
}
```

### No Code Injection

- No `eval()` or `Function()` calls
- No dynamic `require()` calls
- Safe string handling (no template injection)
- Boolean query parser uses safe tokenization

### Error Handling

```typescript
try {
  // Operation
} catch (error) {
  // Log error (DEBUG mode only)
  // Return sanitized error to client
  // No sensitive information exposed
}
```

---

## Testing Strategy

### Test Pyramid

```
            /\
           /  \
          / E2E \ (Integration: 12 tests)
         /______\
        /        \
       / Edge     \ (Edge Cases: 35 tests)
      /  Cases    \
     /____________\
    /              \
   /   Unit Tests   \ (Unit: 325 tests)
  /                  \
 /____________________\
/                      \
    Performance Tests    (Performance: 24 tests)
```

### Test Categories

1. **Unit Tests** (325 tests)
   - EntityManager: 48 tests
   - RelationManager: 26 tests
   - BasicSearch: 37 tests
   - RankedSearch: 35 tests
   - BooleanSearch: 41 tests
   - FuzzySearch: 39 tests
   - CompressionManager: 29 tests
   - Utils: Various

2. **Integration Tests** (12 tests)
   - End-to-end workflows
   - Multi-manager interactions
   - Real-world scenarios

3. **Edge Case Tests** (35 tests)
   - Unicode, special characters
   - Extreme values
   - Concurrent operations
   - Large graphs

4. **Performance Tests** (24 tests)
   - Performance budgets
   - Scalability validation
   - Memory efficiency

### Test Coverage

- **Statement Coverage**: 98%+
- **Branch Coverage**: 95%+
- **Function Coverage**: 100%
- **Line Coverage**: 98%+

### Continuous Integration

```bash
# Run all tests
npm test

# Type checking
npm run typecheck

# Coverage report
npm test -- --coverage
```

---

## Future Enhancements

### Planned Improvements

1. **Pagination**: Limit results for large queries
2. **Caching**: LRU cache for search results
3. **Indexing**: Pre-calculated TF-IDF indices
4. **Streaming**: Support for very large graphs
5. **Async Validation**: Non-blocking integrity checks

### Architectural Evolution

**Current**: Single-file JSONL, in-memory processing
**Future**: Pluggable storage backends (JSONL, SQLite, PostgreSQL)

```typescript
interface StorageBackend {
  loadGraph(): Promise<KnowledgeGraph>
  saveGraph(graph: KnowledgeGraph): Promise<void>
}

class JSONLStorage implements StorageBackend { }
class SQLiteStorage implements StorageBackend { }
```

---

## Conclusion

The Memory MCP architecture prioritizes:
- ✅ **Simplicity**: Easy to understand and maintain
- ✅ **Performance**: Efficient for typical use cases (<5000 entities)
- ✅ **Testability**: 98%+ test coverage
- ✅ **Security**: Input validation, path protection
- ✅ **Extensibility**: Modular design, clear interfaces

This architecture serves the current use case well and provides a solid foundation for future enhancements.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-25
**Maintained By**: Daniel Simon Jr.
