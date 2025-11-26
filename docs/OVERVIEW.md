# Memory MCP Server - Project Overview

**Version**: 0.47.0
**Last Updated**: 2025-11-26

## What Is This?

Memory MCP is an **enhanced Model Context Protocol (MCP) server** that provides persistent knowledge graph storage for AI assistants. It extends the official MCP memory server with advanced features for organizing, searching, and maintaining structured knowledge.

## Key Capabilities

| Feature | Description |
|---------|-------------|
| **Knowledge Graph** | Store entities and relations in a flexible graph structure |
| **Persistent Memory** | Data persists across sessions in JSONL files |
| **45 Tools** | Comprehensive API for graph operations |
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
                        │
┌───────────────────────┴────────────────────────────┐
│  Layer 2: Manager Layer (Facade Pattern)           │
│  KnowledgeGraphManager delegates to:               │
│  • EntityManager    • RelationManager              │
│  • SearchManager    • CompressionManager           │
│  • HierarchyManager • ExportManager                │
│  • ImportManager    • AnalyticsManager             │
│  • TagManager       • ArchiveManager               │
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
src/memory/
├── index.ts              # Entry point, main() function
├── core/                 # Core managers
│   ├── KnowledgeGraphManager.ts  # Central facade
│   ├── EntityManager.ts          # Entity CRUD
│   ├── RelationManager.ts        # Relation CRUD
│   ├── GraphStorage.ts           # File I/O, caching
│   └── index.ts                  # Barrel export
├── server/               # MCP protocol layer
│   ├── MCPServer.ts              # Server initialization (67 lines)
│   ├── toolDefinitions.ts        # 45 tool schemas
│   └── toolHandlers.ts           # Tool implementation registry
├── search/               # Search implementations
│   ├── SearchManager.ts          # Search orchestrator
│   ├── BasicSearch.ts            # Text matching
│   ├── RankedSearch.ts           # TF-IDF scoring
│   ├── BooleanSearch.ts          # AND/OR/NOT logic
│   ├── FuzzySearch.ts            # Typo tolerance
│   ├── SearchFilterChain.ts      # Unified filter logic
│   └── index.ts
├── features/             # Advanced capabilities
│   ├── HierarchyManager.ts       # Parent-child ops
│   ├── CompressionManager.ts     # Duplicate merging
│   ├── ArchiveManager.ts         # Entity archiving
│   ├── TagManager.ts             # Tag aliases
│   ├── ExportManager.ts          # 7 export formats
│   ├── ImportManager.ts          # 3 import formats
│   ├── AnalyticsManager.ts       # Stats & validation
│   └── index.ts
├── types/                # TypeScript definitions
│   ├── entity.types.ts
│   ├── search.types.ts
│   ├── analytics.types.ts
│   ├── import-export.types.ts
│   ├── tag.types.ts
│   └── index.ts
└── utils/                # Shared utilities
    ├── schemas.ts                # Zod validation schemas
    ├── constants.ts              # Shared constants
    ├── responseFormatter.ts      # Tool response helpers
    ├── levenshtein.ts            # Fuzzy match algorithm
    ├── tfidf.ts                  # Ranking algorithm
    └── index.ts
```

## Tool Categories (45 Total)

| Category | Tools | Description |
|----------|-------|-------------|
| **Entity** | 4 | create_entities, delete_entities, read_graph, open_nodes |
| **Relation** | 2 | create_relations, delete_relations |
| **Observation** | 2 | add_observations, delete_observations |
| **Search** | 5 | search_nodes, search_nodes_ranked, boolean_search, fuzzy_search, search_by_date_range |
| **Hierarchy** | 8 | set_entity_parent, get_children, get_parent, get_ancestors, get_descendants, get_subtree, get_root_entities, get_entity_depth |
| **Compression** | 3 | find_duplicates, merge_entities, compress_graph |
| **Tags** | 8 | add_tags, remove_tags, set_importance, add_tags_to_multiple_entities, replace_tag, merge_tags, add_tag_alias, resolve_tag |
| **Saved Searches** | 6 | save_search, list_saved_searches, get_saved_search, execute_saved_search, delete_saved_search, update_saved_search |
| **Import/Export** | 2 | export_graph (7 formats), import_graph (3 formats) |
| **Analytics** | 3 | get_graph_stats, validate_graph, archive_entities |
| **Tag Aliases** | 2 | list_tag_aliases, remove_tag_alias |

## Key Design Principles

1. **Facade Pattern**: `KnowledgeGraphManager` provides a unified interface, delegating to specialized managers
2. **Lazy Initialization**: Managers are instantiated on-demand for faster startup
3. **Single Responsibility**: Each manager handles one domain (entities, search, compression, etc.)
4. **Dependency Injection**: `GraphStorage` injected into managers for testability
5. **Barrel Exports**: Each module exports through `index.ts` for clean imports

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

# Run tests (396+ tests)
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
