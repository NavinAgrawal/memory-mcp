# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install           # Install all dependencies
npm run build         # Build TypeScript → JavaScript
npm test              # Run tests with coverage
npm run typecheck     # Strict type checking
npm run watch         # Watch mode for development
npm run clean         # Remove dist/ directory
npm run docs:deps     # Generate dependency graph

# Run a single test file
npx vitest run tests/e2e/tools/entity-tools.test.ts

# Run tests matching a pattern
npx vitest run -t "should create entities"
```

## Architecture Overview

This is an enhanced MCP memory server with **59 tools** (vs 11 in official version), providing knowledge graph storage with hierarchical organization.

**npm:** @danielsimonjr/memory-mcp

### Phase 13: MemoryJS Extraction (Complete)

Core knowledge graph functionality has been extracted into a standalone library:

**[@danielsimonjr/memoryjs](https://www.npmjs.com/package/@danielsimonjr/memoryjs)** v1.0.0 (published)

| Component | memoryjs | memory-mcp |
|-----------|----------|------------|
| **Purpose** | Core knowledge graph library | MCP server wrapping memoryjs |
| **Files** | 73 TypeScript source files | 5 TypeScript source files |
| **Tests** | 2,882 tests (90 test files) | 194 tests |
| **Exports** | Managers, storage, search, types | MCP tools (59 tools) |
| **Dependencies** | zod, better-sqlite3, async-mutex | memoryjs + @modelcontextprotocol/sdk |
| **Use Case** | Standalone graph operations | AI assistant integration |

**Status:** All 26 sprints complete. memory-mcp v11.0.0 released.

memory-mcp now imports all core functionality from memoryjs rather than containing it directly.

### Layered Architecture

```
┌─────────────────────────────────────────┐
│  memory-mcp: MCP Protocol Layer         │
│  server/MCPServer.ts + toolDefinitions  │
│  + toolHandlers (59 tools)              │
└──────────────────┬──────────────────────┘
                   │ (imports from memoryjs)
┌──────────────────┴──────────────────────┐
│  @danielsimonjr/memoryjs                │
│  ├── ManagerContext (lazy init)         │
│  ├── EntityManager, RelationManager     │
│  ├── SearchManager, IOManager, TagManager│
│  ├── GraphStorage (JSONL + cache)       │
│  ├── SQLiteStorage (better-sqlite3)     │
│  └── StorageFactory (backend select)    │
└─────────────────────────────────────────┘
```

### Source Structure (src/) - 5 TypeScript files

After Phase 13 extraction, memory-mcp contains only the MCP server layer:

| File | Purpose |
|------|---------|
| **index.ts** | Entry point, re-exports from memoryjs for backward compatibility |
| **server/MCPServer.ts** | MCP server initialization and request handling |
| **server/toolDefinitions.ts** | 59 MCP tool schemas organized by category |
| **server/toolHandlers.ts** | Handler registry and dispatch logic |
| **server/responseCompressor.ts** | Auto-compress large responses (>256KB) with brotli |

> **Note**: All core/, features/, search/, types/, utils/, and workers/ directories have been moved to [@danielsimonjr/memoryjs](https://www.npmjs.com/package/@danielsimonjr/memoryjs)

### Key Design Patterns

1. **Context Pattern**: ManagerContext holds all managers with lazy-initialized getters
2. **Direct Manager Access**: Tool handlers call managers directly via `ctx.entityManager`, `ctx.searchManager`, etc.
3. **Lazy Initialization**: 7 managers instantiated on-demand (EntityManager, RelationManager, SearchManager, IOManager, TagManager, GraphTraversal, SemanticSearch)
4. **Dependency Injection**: GraphStorage injected into managers
5. **Handler Registry**: Tool handlers mapped in toolHandlers.ts
6. **Barrel Exports**: Each module exports via index.ts (includes `KnowledgeGraphManager` alias)

### Data Model

```typescript
// Entity (node in graph)
interface Entity {
  name: string;           // Unique identifier
  entityType: string;     // Classification
  observations: string[]; // Facts
  parentId?: string;      // Hierarchical nesting
  tags?: string[];        // Categories (lowercase)
  importance?: number;    // 0-10 scale
  createdAt?: string;     // ISO 8601
  lastModified?: string;
}

// Relation (edge in graph)
interface Relation {
  from: string;
  to: string;
  relationType: string;
}
```

### Storage Options

Data files are stored in the **project root directory** (not in `dist/`):

**JSONL (Default):**
- `memory.jsonl` - Main graph (entities + relations)
- `memory-saved-searches.jsonl` - Saved search queries
- `memory-tag-aliases.jsonl` - Tag synonym mappings

**SQLite (Optional):**
- `memory.db` - SQLite database with all data
- Configure via `MEMORY_STORAGE_TYPE=sqlite` environment variable
- Uses better-sqlite3 (native SQLite) for 3-10x faster performance
- Features: FTS5 full-text search with BM25 ranking, referential integrity (ON DELETE CASCADE), WAL mode
- O(1) entity lookups via NameIndex and TypeIndex
- Thread-safe with async-mutex concurrency control
- ACID transactions with durability guarantees

## Entry Points

- **Build output**: `dist/index.js`
- **CLI binary**: `mcp-server-memory`
- **Source entry**: `src/index.ts`

## Environment Variables

- `MEMORY_FILE_PATH` - Custom path to storage file (defaults to current directory)
- `MEMORY_STORAGE_TYPE` - Storage backend: 'jsonl' (default) or 'sqlite'
- `MEMORY_EMBEDDING_PROVIDER` - Embedding provider: 'openai', 'local', or 'none' (default)
- `MEMORY_OPENAI_API_KEY` - OpenAI API key (required if provider is 'openai')
- `MEMORY_EMBEDDING_MODEL` - Embedding model (default: text-embedding-3-small for OpenAI, Xenova/all-MiniLM-L6-v2 for local)
- `MEMORY_AUTO_INDEX_EMBEDDINGS` - Auto-index entities on creation: 'true' or 'false' (default: false)

## Tool Categories (59 Total)

| Category | Count | Tools |
|----------|-------|-------|
| **Entity Operations** | 4 | create_entities, delete_entities, read_graph, open_nodes |
| **Relation Operations** | 2 | create_relations, delete_relations |
| **Observation Management** | 3 | add_observations, delete_observations, normalize_observations |
| **Search** | 7 | search_nodes, search_by_date_range, search_nodes_ranked, boolean_search, fuzzy_search, get_search_suggestions, search_auto |
| **Intelligent Search** | 3 | hybrid_search (multi-layer fusion), analyze_query (query understanding), smart_search (reflection-based refinement) |
| **Semantic Search** | 3 | semantic_search, find_similar_entities, index_embeddings |
| **Saved Searches** | 5 | save_search, execute_saved_search, list_saved_searches, delete_saved_search, update_saved_search |
| **Tag Management** | 6 | add_tags, remove_tags, set_importance, add_tags_to_multiple_entities, replace_tag, merge_tags |
| **Tag Aliases** | 5 | add_tag_alias, list_tag_aliases, remove_tag_alias, get_aliases_for_tag, resolve_tag |
| **Hierarchy** | 9 | set_entity_parent, get_children, get_parent, get_ancestors, get_descendants, get_subtree, get_root_entities, get_entity_depth, move_entity |
| **Graph Algorithms** | 4 | find_shortest_path, find_all_paths, get_connected_components, get_centrality (supports chunked processing and approximation for betweenness) |
| **Analytics** | 2 | get_graph_stats, validate_graph |
| **Compression** | 4 | find_duplicates, merge_entities, compress_graph, archive_entities |
| **Import/Export** | 2 | import_graph (3 formats), export_graph (7 formats + compression + streaming for large graphs) |

### Intelligent Search (Phase 11)

Three-layer hybrid search architecture combining semantic, lexical, and symbolic signals:

- **hybrid_search**: Combines semantic (vector similarity), lexical (TF-IDF/BM25), and symbolic (metadata filtering) signals with configurable weights
- **analyze_query**: Extracts entities, temporal references, question type, and complexity from natural language queries
- **smart_search**: Orchestrates query analysis, planning, and reflection-based iterative refinement until results meet adequacy threshold
- **normalize_observations**: Transforms observations into self-contained facts by resolving pronouns to entity names and converting relative dates to absolute dates

## Test Structure

After Phase 13 extraction, memory-mcp retains only MCP server and integration tests (6 files, 194 tests). Core knowledge graph tests are now in memoryjs.

| Test File | Purpose |
|-----------|---------|
| `file-path.test.ts` | Storage path handling |
| `knowledge-graph.test.ts` | Core graph operations via memoryjs |
| `integration/server.test.ts` | MCP server integration |
| `e2e/tools/entity-tools.test.ts` | Entity tool end-to-end tests |
| `e2e/tools/observation-tools.test.ts` | Observation tool end-to-end tests |
| `e2e/tools/relation-tools.test.ts` | Relation tool end-to-end tests |

> **Note**: For comprehensive unit tests covering search, storage, managers, and utilities, see [@danielsimonjr/memoryjs](https://www.npmjs.com/package/@danielsimonjr/memoryjs) (2,882 tests across 90 test files)

## Performance & Optimizations

Performance is provided by the memoryjs library:
- **O(1) read operations** via direct cache access
- **O(1) single-entity writes** via append-only file operations
- In-memory caching with write-through invalidation
- Lazy manager initialization (managers load on-demand)
- Streaming exports for large graphs (>= 5000 entities)
- Parallel fuzzy search via worker pool

memory-mcp adds:
- **Response compression**: Automatic brotli compression for large responses (>256KB)

## Dependencies

**Production:**
- @danielsimonjr/memoryjs: ^1.0.0 (core knowledge graph)
- @modelcontextprotocol/sdk: ^1.21.1 (MCP protocol)
- zod: ^3.24.1 (validation)

**Development:**
- TypeScript: ^5.6.2
- Vitest: ^4.0.13
- @vitest/coverage-v8: ^4.0.13

## Standalone Tools

The `tools/` directory contains standalone utilities compiled to Windows executables using pkg:

| Tool | Purpose |
|------|---------|
| `chunking-for-files` | Split/merge large files for editing within context limits |
| `compress-for-context` | CTON compression for LLM context windows |
| `create-dependency-graph` | Generate TypeScript project dependency graphs |
| `migrate-from-jsonl-to-sqlite` | Convert between JSONL and SQLite storage formats |

**Build commands** (in each tool directory):
```bash
npm run build      # Build TypeScript + create exe
npm run build:ts   # TypeScript compilation only
npm run build:exe  # Create exe only (requires dist/)
```

## Documentation

Comprehensive docs in `docs/` directory:
- `architecture/` - OVERVIEW.md, COMPONENTS.md, DATAFLOW.md
- `development/` - Plans, tasks, workflow guides
- `guides/` - ARCHIVING.md, COMPRESSION.md, HIERARCHY.md, QUERY_LANGUAGE.md
- `reports/` - Sprint summaries, improvements

## Memory Usage Reminder

**Use the memory-mcp tools periodically to maintain cross-session context:**

1. **At session start**: Search memory for relevant context
   - `search_nodes` with project name or topic
   - `get_graph_stats` to see what's stored

2. **During work**: Store important discoveries and decisions
   - Create entities for new projects, components, concepts
   - Add observations to existing entities
   - Create relations to connect knowledge

3. **After every commit**: Update project memory nodes
   - Add observations for version bumps, new features, bug fixes
   - Record architectural changes and important decisions
   - Keep project nodes current with latest changes

4. **At session end**: Persist key learnings
   - Summarize accomplishments
   - Record user preferences observed
   - Note unfinished tasks or next steps

5. **Periodically**: Maintain graph hygiene
   - Use `find_duplicates` to identify redundant entries
   - Use `compress_graph` to merge similar entities
   - Update importance scores to prioritize valuable knowledge
