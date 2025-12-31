# Memory MCP Server - Project Overview

**Version**: 0.58.0
**Last Updated**: 2025-12-30

## What Is This?

Memory MCP is an **enhanced Model Context Protocol (MCP) server** that provides persistent knowledge graph storage for AI assistants. It extends the official MCP memory server with advanced features for organizing, searching, and maintaining structured knowledge.

## Key Capabilities

| Feature | Description |
|---------|-------------|
| **Knowledge Graph** | Store entities and relations in a flexible graph structure |
| **Persistent Memory** | Data persists across sessions in JSONL files |
| **47 Tools** | Comprehensive API for graph operations |
| **Hierarchical Nesting** | Parent-child relationships for tree organization |
| **Advanced Search** | Basic, TF-IDF ranked, boolean, and fuzzy search |
| **Duplicate Detection** | Intelligent compression with similarity scoring |
| **Multi-format Export** | JSON, CSV, GraphML, GEXF, DOT, Markdown, Mermaid |
| **Tag Management** | Aliases, bulk operations, and validation |

## Quick Architecture Overview

```
┌────────────────────────────────────────────────────┐
│            MCP Client (Claude, etc.)               │
└───────────────────────┬────────────────────────────┘
                        │ MCP Protocol (JSON-RPC)
┌───────────────────────┴────────────────────────────┐
│  Layer 1: MCP Server                               │
│  ┌──────────────────────────────────────────────┐  │
│  │ MCPServer.ts → toolDefinitions + toolHandlers│  │
│  └──────────────────────────────────────────────┘  │
└───────────────────────┬────────────────────────────┘
                        │ (direct manager access)
┌───────────────────────┴────────────────────────────┐
│  Layer 2: Managers + Context (Lazy Initialization) │
│  ManagerContext (aliased as KnowledgeGraphManager) │
│  • EntityManager   (CRUD + hierarchy + archive)    │
│  • RelationManager (relation CRUD)                 │
│  • SearchManager   (search + compression + stats)  │
│  • IOManager       (import + export + backup)      │
│  • TagManager      (tag aliases)                   │
└───────────────────────┬────────────────────────────┘
                        │
┌───────────────────────┴────────────────────────────┐
│  Layer 3: Storage Layer                            │
│  GraphStorage (JSONL files, in-memory caching)     │
└────────────────────────────────────────────────────┘
```

## Data Model

### Entity (Graph Node)
```typescript
interface Entity {
  name: string;           // Unique identifier
  entityType: string;     // Classification (person, project, concept)
  observations: string[]; // Facts/notes about the entity
  parentId?: string;      // Hierarchical parent (optional)
  tags?: string[];        // Categories (lowercase, optional)
  importance?: number;    // Priority 0-10 (optional)
  createdAt?: string;     // ISO 8601 timestamp
  lastModified?: string;  // ISO 8601 timestamp
}
```

### Relation (Graph Edge)
```typescript
interface Relation {
  from: string;         // Source entity name
  to: string;           // Target entity name
  relationType: string; // Relationship type (works_at, knows, etc.)
}
```

## Directory Structure

```
src/memory/ (49 TypeScript files)
├── index.ts              # Entry point, main() function
├── vitest.config.ts      # Test configuration
├── core/ (7 files)       # Core managers
│   ├── ManagerContext.ts         # Context holder (lazy init)
│   ├── EntityManager.ts          # Entity CRUD + hierarchy + archive
│   ├── RelationManager.ts        # Relation CRUD
│   ├── GraphStorage.ts           # File I/O, caching
│   ├── TransactionManager.ts     # Batch operations
│   ├── StorageFactory.ts         # Storage backend factory
│   └── index.ts                  # Barrel export (+ KnowledgeGraphManager alias)
├── server/ (3 files)     # MCP protocol layer
│   ├── MCPServer.ts              # Server initialization (67 lines)
│   ├── toolDefinitions.ts        # 47 tool schemas
│   └── toolHandlers.ts           # Tool implementation registry
├── search/ (10 files)    # Search implementations
│   ├── SearchManager.ts          # Search orchestrator + compression + analytics
│   ├── BasicSearch.ts            # Text matching
│   ├── RankedSearch.ts           # TF-IDF scoring
│   ├── BooleanSearch.ts          # AND/OR/NOT logic
│   ├── FuzzySearch.ts            # Typo tolerance
│   ├── SearchFilterChain.ts      # Unified filter logic
│   ├── SavedSearchManager.ts     # Saved search persistence
│   ├── TFIDFIndexManager.ts      # TF-IDF index management
│   ├── SearchSuggestions.ts      # "Did you mean?" suggestions
│   └── index.ts
├── features/ (3 files)   # Advanced capabilities
│   ├── TagManager.ts             # Tag aliases
│   ├── IOManager.ts              # Import + export + backup (consolidated)
│   └── index.ts
├── types/ (7 files)      # TypeScript definitions
│   ├── entity.types.ts
│   ├── search.types.ts
│   ├── analytics.types.ts
│   ├── import-export.types.ts
│   ├── tag.types.ts
│   ├── storage.types.ts          # IGraphStorage interface
│   └── index.ts
└── utils/ (17 files)     # Shared utilities
    ├── schemas.ts                # Zod validation schemas (14 validators)
    ├── constants.ts              # Shared constants (SIMILARITY_WEIGHTS)
    ├── responseFormatter.ts      # Tool response helpers
    ├── searchAlgorithms.ts       # Levenshtein + TF-IDF (consolidated)
    ├── entityUtils.ts            # Entity helper functions
    ├── tagUtils.ts               # Tag normalization/validation
    ├── filterUtils.ts            # Date range filtering
    ├── validationUtils.ts        # Validation helpers
    ├── validationHelper.ts       # Zod validation wrappers
    ├── paginationUtils.ts        # Pagination helpers
    ├── searchCache.ts            # Search result caching
    ├── indexes.ts                # Search index utilities
    ├── dateUtils.ts              # Date manipulation
    ├── pathUtils.ts              # Path handling
    ├── errors.ts                 # Custom error classes
    ├── logger.ts                 # Logging utility
    └── index.ts
```

## Tool Categories (47 Total)

| Category | Tools | Description |
|----------|-------|-------------|
| **Entity** | 4 | create_entities, delete_entities, read_graph, open_nodes |
| **Relation** | 2 | create_relations, delete_relations |
| **Observation** | 2 | add_observations, delete_observations |
| **Search** | 6 | search_nodes, search_by_date_range, search_nodes_ranked, boolean_search, fuzzy_search, get_search_suggestions |
| **Saved Search** | 5 | save_search, execute_saved_search, list_saved_searches, delete_saved_search, update_saved_search |
| **Tag** | 6 | add_tags, remove_tags, set_importance, add_tags_to_multiple_entities, replace_tag, merge_tags |
| **Tag Alias** | 5 | add_tag_alias, list_tag_aliases, remove_tag_alias, get_aliases_for_tag, resolve_tag |
| **Hierarchy** | 9 | set_entity_parent, get_children, get_parent, get_ancestors, get_descendants, get_subtree, get_root_entities, get_entity_depth, move_entity |
| **Analytics** | 2 | get_graph_stats, validate_graph |
| **Compression** | 4 | find_duplicates, merge_entities, compress_graph, archive_entities |
| **Import/Export** | 2 | export_graph (7 formats), import_graph (3 formats) |

## Key Design Principles

1. **Context Pattern**: `ManagerContext` holds all managers with lazy-initialized getters
2. **Lazy Initialization**: 5 managers instantiated on-demand using `??=` operator
3. **Manager Consolidation**: Functionality merged (e.g., SearchManager includes compression + analytics)
4. **Dependency Injection**: `GraphStorage` injected into managers for testability
5. **Barrel Exports**: Each module exports through `index.ts` (includes `KnowledgeGraphManager` alias)

## Performance Characteristics

- **Entities**: Handles 2,000+ efficiently; 5,000+ with acceptable performance
- **Batch Operations**: Single I/O cycle for bulk operations
- **Caching**: In-memory graph caching with write-through invalidation
- **Duplicate Detection**: O(n²/k) via entityType bucketing (50x faster than naive)
- **Search**: TF-IDF index for relevance ranking; Levenshtein for fuzzy matching

## Storage Files

| File | Purpose |
|------|---------|
| `memory.jsonl` | Main graph (entities + relations) |
| `memory-saved-searches.jsonl` | Saved search queries |
| `memory-tag-aliases.jsonl` | Tag synonym mappings |

## Getting Started

```bash
# Install
npm install

# Build
npm run build

# Run tests (1484 tests)
npm test

# Run server
npx mcp-server-memory
```

Set `MEMORY_FILE_PATH` environment variable to customize storage location.

## Related Documentation

- **[API Reference](./API.md)** - Complete tool documentation
- **[Architecture Details](./ARCHITECTURE.md)** - In-depth technical architecture
- **[User Guides](./guides/)** - Feature-specific guides
- **[Changelog](../CHANGELOG.md)** - Version history

---

**Maintained by**: Daniel Simon Jr.
