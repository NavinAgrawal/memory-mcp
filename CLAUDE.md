# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install           # Install all dependencies
npm run build         # Build TypeScript → JavaScript
npm test              # Run tests with coverage (2109 tests)
npm run typecheck     # Strict type checking
npm run watch         # Watch mode for development
npm run clean         # Remove dist/ directory
npm run docs:deps     # Generate dependency graph

# Run a single test file
npx vitest run tests/unit/core/EntityManager.test.ts

# Run tests matching a pattern
npx vitest run -t "should create entities"
```

## Architecture Overview

This is an enhanced MCP memory server with **54 tools** (vs 11 in official version), providing knowledge graph storage with hierarchical organization.

**Version:** 9.1.0 | **npm:** @danielsimonjr/memory-mcp

### Layered Architecture

```
┌─────────────────────────────────────────┐
│  Layer 1: MCP Protocol Layer            │
│  server/MCPServer.ts + toolDefinitions  │
│  + toolHandlers (54 tools)              │
└──────────────────┬──────────────────────┘
                   │ (direct manager access)
┌──────────────────┴──────────────────────┐
│  Layer 2: Managers + Context            │
│  core/ManagerContext.ts (lazy init)     │
│  → EntityManager, RelationManager       │
│  → SearchManager, IOManager, TagManager │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│  Layer 3: Storage Layer                 │
│  core/GraphStorage.ts (JSONL + cache)   │
│  core/SQLiteStorage.ts (better-sqlite3) │
│  core/StorageFactory.ts (backend select)│
└─────────────────────────────────────────┘
```

### Source Structure (src/) - 50 TypeScript files

| Module | Files | Purpose |
|--------|-------|---------|
| **core/** | 11 | ManagerContext (context holder), EntityManager (CRUD + hierarchy + archive), RelationManager, ObservationManager, HierarchyManager, GraphStorage, SQLiteStorage, TransactionManager, StorageFactory, GraphTraversal (Phase 4: graph algorithms), index |
| **features/** | 6 | TagManager (tag aliases), IOManager (import/export/backup), AnalyticsManager, ArchiveManager, CompressionManager, index |
| **search/** | 13 | SearchManager (orchestrator), BasicSearch, RankedSearch, BooleanSearch, FuzzySearch, SavedSearchManager, TFIDFIndexManager, SearchFilterChain, SearchSuggestions, EmbeddingService, VectorStore, SemanticSearch, index |
| **server/** | 4 | MCPServer.ts (67 lines), toolDefinitions.ts, toolHandlers.ts, responseCompressor.ts (auto-compress large responses) |
| **types/** | 2 | Consolidated type definitions (types.ts + index.ts barrel) |
| **utils/** | 12 | schemas.ts (Zod + validation), entityUtils.ts (entity/tag/date/filter/path), formatters.ts (response + pagination), compressionUtil.ts (brotli compression), compressedCache.ts (LRU cache with compression), constants, errors, searchAlgorithms, logger, indexes, searchCache, index |
| **root** | 1 | index.ts (entry point) |

> **Phase 5 Cleanup**: utils/ consolidated from 17→10 files, types/ from 7→2 files, folder structure simplified

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

**JSONL (Default):**
- `memory.jsonl` - Main graph (entities + relations)
- `memory-saved-searches.jsonl` - Saved search queries
- `memory-tag-aliases.jsonl` - Tag synonym mappings

**SQLite (Optional - Phase 8):**
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

## Tool Categories (54 Total)

| Category | Count | Tools |
|----------|-------|-------|
| **Entity Operations** | 4 | create_entities, delete_entities, read_graph, open_nodes |
| **Relation Operations** | 2 | create_relations, delete_relations |
| **Observation Management** | 2 | add_observations, delete_observations |
| **Search** | 6 | search_nodes, search_by_date_range, search_nodes_ranked, boolean_search, fuzzy_search, get_search_suggestions |
| **Semantic Search** | 3 | semantic_search, find_similar_entities, index_embeddings |
| **Saved Searches** | 5 | save_search, execute_saved_search, list_saved_searches, delete_saved_search, update_saved_search |
| **Tag Management** | 6 | add_tags, remove_tags, set_importance, add_tags_to_multiple_entities, replace_tag, merge_tags |
| **Tag Aliases** | 5 | add_tag_alias, list_tag_aliases, remove_tag_alias, get_aliases_for_tag, resolve_tag |
| **Hierarchy** | 9 | set_entity_parent, get_children, get_parent, get_ancestors, get_descendants, get_subtree, get_root_entities, get_entity_depth, move_entity |
| **Graph Algorithms** | 4 | find_shortest_path, find_all_paths, get_connected_components, get_centrality |
| **Analytics** | 2 | get_graph_stats, validate_graph |
| **Compression** | 4 | find_duplicates, merge_entities, compress_graph, archive_entities |
| **Import/Export** | 2 | import_graph (3 formats), export_graph (7 formats + compression) |

## Test Structure

Tests are in `tests/` (1803 tests, 52 files):

| Test File | Tests | Coverage |
|-----------|-------|----------|
| edge-cases.test.ts | 35 | Boundary conditions |
| file-path.test.ts | 9 | Path handling |
| integration/workflows.test.ts | 12 | End-to-end workflows |
| knowledge-graph.test.ts | 30 | Core graph operations |
| performance/benchmarks.test.ts | 18 | Performance validation |
| performance/write-performance.test.ts | 17 | Write optimization tests |
| unit/core/EntityManager.test.ts | 31 | Entity CRUD |
| unit/core/GraphStorage.test.ts | 10 | JSONL storage layer |
| unit/core/SQLiteStorage.test.ts | 31 | SQLite storage layer |
| unit/core/RelationManager.test.ts | 24 | Relation operations |
| unit/core/GraphTraversal.test.ts | 34 | Graph traversal algorithms (Phase 4) |
| unit/features/AnalyticsManager.test.ts | 27 | Graph validation & stats (via SearchManager) |
| unit/features/ArchiveManager.test.ts | 42 | Entity archival + compression (via EntityManager) |
| unit/features/BackupManager.test.ts | 31 | Backup/restore (via IOManager) |
| integration/backup-compression.test.ts | 16 | Backup compression integration |
| unit/features/CompressionManager.test.ts | 32 | Duplicate detection (via SearchManager) |
| unit/features/ExportManager.test.ts | 95 | Export formats + compression (via IOManager) |
| unit/features/ImportManager.test.ts | 26 | Import formats (via IOManager) |
| unit/features/TagManager.test.ts | 35 | Tag aliases |
| unit/search/BasicSearch.test.ts | 37 | Basic search |
| unit/search/BooleanSearch.test.ts | 52 | AND/OR/NOT queries |
| unit/search/FuzzySearch.test.ts | 53 | Levenshtein matching |
| unit/search/RankedSearch.test.ts | 35 | TF-IDF ranking |
| unit/search/SavedSearchManager.test.ts | 29 | Saved searches |
| unit/search/SearchFilterChain.test.ts | 48 | Filter logic |
| unit/search/SearchSuggestions.test.ts | 24 | "Did you mean?" |
| unit/search/TFIDFIndexManager.test.ts | 38 | TF-IDF indexing |
| unit/search/EmbeddingService.test.ts | 31 | Embedding service abstraction (Phase 4) |
| unit/search/VectorStore.test.ts | 32 | Vector storage & similarity search (Phase 4) |
| unit/search/SemanticSearch.test.ts | 27 | Semantic search manager (Phase 4) |
| unit/utils/entityUtils.test.ts | 32 | Entity utilities |
| unit/utils/indexes.test.ts | 24 | Search indexes |
| unit/utils/levenshtein.test.ts | 12 | String distance |
| unit/utils/responseFormatter.test.ts | 36 | Response formatting |
| unit/utils/tagUtils.test.ts | 48 | Tag utilities |
| unit/utils/validationHelper.test.ts | 26 | Zod validation |
| unit/utils/compressionUtil.test.ts | 41 | Brotli compression utilities |
| unit/utils/compressedCache.test.ts | 42 | LRU cache with compression |
| unit/server/responseCompressor.test.ts | 25 | MCP response compression |
| performance/compression-benchmarks.test.ts | 9 | Compression performance benchmarks |

**Note:** Performance benchmarks use relative testing (baseline + multipliers) to avoid flaky failures on different machines.

### Test Reporting

Custom Vitest reporter generates HTML and JSON reports:

```bash
# Run tests with reports (default mode: all)
npm test

# Report modes via environment variable
VITEST_REPORT_MODE=summary npm test   # Only summary reports
VITEST_REPORT_MODE=debug npm test     # Only failed test reports
VITEST_REPORT_MODE=all npm test       # All test reports (default)

# Skip benchmark tests
SKIP_BENCHMARKS=true npm test
```

**Report Output Structure:**
```
tests/test-results/
├── json/           # Per-file JSON reports
├── html/           # Per-file HTML reports
└── summary/        # Summary JSON + HTML with coverage data
```

## Performance & Optimizations

- **O(1) read operations** - Direct cache access without copying (Sprint 1)
- **O(1) single-entity writes** - Append-only file operations (Sprint 2)
- **Append-only update pattern** - File deduplication on load
- In-memory caching with write-through invalidation
- 50x faster duplicate detection using two-level bucketing
- Lazy TF-IDF index loading
- Lazy manager initialization (6 managers load on-demand)
- Batch operations support via TransactionManager
- Handles 2000+ entities efficiently
- **Phase 4 Search Caching**:
  - Bidirectional relation cache with O(1) repeated lookups
  - RankedSearch token cache with entity count invalidation
  - Fuzzy search result cache with TTL (5 minutes) and LRU eviction
  - Boolean search AST cache (50 entries) and result cache (100 entries)
  - Cache management methods: `clearAllCaches()`, `clearFuzzyCache()`, `clearBooleanCache()`, `clearRankedCache()`

## Server Architecture (v0.44.0+)

- **MCPServer.ts**: 66 lines (reduced from 907, 92.6% reduction)
- **toolDefinitions.ts**: 920 lines - all 54 tool schemas organized by category (including Graph Algorithms and Semantic Search)
- **toolHandlers.ts**: 400 lines - handler registry, dispatch logic, and response compression wrapper
- **responseCompressor.ts**: 170 lines - automatic brotli compression for large responses (>256KB)
- **Consolidated constants**: SIMILARITY_WEIGHTS centralized in constants.ts
- **GraphTraversal.ts**: 500+ lines - BFS, DFS, shortest path, all paths, connected components, centrality (degree, betweenness, PageRank)

## Dependencies

**Production:**
- @modelcontextprotocol/sdk: ^1.21.1
- better-sqlite3: ^11.7.0
- zod: ^4.1.13

**Development:**
- @types/better-sqlite3: ^7.6.12
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

3. **At session end**: Persist key learnings
   - Summarize accomplishments
   - Record user preferences observed
   - Note unfinished tasks or next steps

4. **Periodically**: Maintain graph hygiene
   - Use `find_duplicates` to identify redundant entries
   - Use `compress_graph` to merge similar entities
   - Update importance scores to prioritize valuable knowledge
