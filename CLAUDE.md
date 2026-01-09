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
npx vitest run tests/unit/core/EntityManager.test.ts

# Run tests matching a pattern
npx vitest run -t "should create entities"
```

## Architecture Overview

This is an enhanced MCP memory server with **59 tools** (vs 11 in official version), providing knowledge graph storage with hierarchical organization.

**npm:** @danielsimonjr/memory-mcp

### Layered Architecture

```
┌─────────────────────────────────────────┐
│  Layer 1: MCP Protocol Layer            │
│  server/MCPServer.ts + toolDefinitions  │
│  + toolHandlers (59 tools)              │
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

### Source Structure (src/) - 65 TypeScript files

| Module | Files | Purpose |
|--------|-------|---------|
| **core/** | 12 | ManagerContext (context holder), EntityManager (CRUD + hierarchy + archive), RelationManager, ObservationManager, HierarchyManager, GraphStorage, SQLiteStorage, TransactionManager, StorageFactory, GraphTraversal (graph algorithms), GraphEventEmitter, index |
| **features/** | 9 | TagManager (tag aliases), IOManager (import/export/backup), StreamingExporter (memory-efficient large exports), AnalyticsManager, ArchiveManager, CompressionManager, ObservationNormalizer (coreference resolution + temporal anchoring), KeywordExtractor (scored keyword extraction), index |
| **search/** | 20 | SearchManager (orchestrator), BasicSearch, RankedSearch, BooleanSearch, FuzzySearch, SavedSearchManager, TFIDFIndexManager, TFIDFEventSync, SearchFilterChain, SearchSuggestions, EmbeddingService, VectorStore, SemanticSearch, SymbolicSearch, HybridSearchManager, QueryAnalyzer, QueryPlanner, QueryCostEstimator, ReflectionManager, index |
| **server/** | 4 | MCPServer.ts, toolDefinitions.ts, toolHandlers.ts, responseCompressor.ts (auto-compress large responses) |
| **types/** | 2 | Consolidated type definitions (types.ts + index.ts barrel) |
| **utils/** | 15 | schemas.ts (Zod + validation), entityUtils.ts (entity/tag/date/filter/path), formatters.ts (response + pagination), compressionUtil.ts (brotli compression), compressedCache.ts (LRU cache with compression), constants, errors, searchAlgorithms, logger, indexes, searchCache, operationUtils, parallelUtils, taskScheduler, index |
| **workers/** | 2 | levenshteinWorker (workerpool-based fuzzy search worker), index |
| **root** | 1 | index.ts (entry point) |

> **Note**: types/ consolidated to 2 files, utils/ extended to 15 files for improved modularity

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

Tests are in `tests/`:

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
| unit/core/GraphTraversal.test.ts | 41 | Graph traversal algorithms (BFS, DFS, centrality) |
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
| unit/search/EmbeddingService.test.ts | 31 | Embedding service abstraction |
| unit/search/VectorStore.test.ts | 32 | Vector storage & similarity search |
| unit/search/SemanticSearch.test.ts | 27 | Semantic search manager |
| unit/search/HybridSearchManager.test.ts | 33 | Hybrid search with three-layer fusion |
| unit/search/QueryAnalyzer.test.ts | 56 | Query analysis and planning |
| integration/hybrid-search.test.ts | 18 | Hybrid search integration |
| integration/smart-search.test.ts | 15 | Smart search with reflection |
| unit/features/ObservationNormalizer.test.ts | 35 | Coreference resolution + keyword extraction |
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
| unit/features/StreamingExporter.test.ts | 9 | Streaming export |
| integration/streaming-export.test.ts | 6 | Streaming export integration |
| unit/workers/WorkerPool.test.ts | 8 | Worker pool for parallel processing |

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

- **O(1) read operations** via direct cache access
- **O(1) single-entity writes** via append-only file operations
- **O(1) observation lookups** via ObservationIndex (inverted index mapping words to entities)
- In-memory caching with write-through invalidation
- Lazy manager initialization (managers load on-demand)
- Batch operations support via TransactionManager
- Search caching with TTL and LRU eviction
- Streaming exports for large graphs (>= 5000 entities)
- Parallel fuzzy search via worker pool
- Pre-computed similarity data for 1.5-2x faster duplicate detection
- Optimized compressGraph with single load/save (10x I/O reduction)

## Server Architecture

- **MCPServer.ts**: Main server entry point
- **toolDefinitions.ts**: All 59 tool schemas organized by category
- **toolHandlers.ts**: Handler registry and dispatch logic
- **responseCompressor.ts**: Automatic brotli compression for large responses (>256KB)
- **GraphTraversal.ts**: Graph algorithms (BFS, DFS, shortest path, centrality)

## Dependencies

**Production:**
- @modelcontextprotocol/sdk: ^1.21.1
- @danielsimonjr/workerpool: Worker pool management
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
