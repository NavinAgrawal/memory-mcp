# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Root level commands (delegates to workspace)
npm install           # Install all dependencies
npm run build         # Build TypeScript → JavaScript
npm test              # Run tests with coverage (1484 tests)
npm run typecheck     # Strict type checking
npm run watch         # Watch mode for development
npm run clean         # Remove dist/ directories
npm run docs:deps     # Generate dependency graph

# Run a single test file
npx vitest run src/memory/__tests__/unit/core/EntityManager.test.ts

# Run tests matching a pattern
npx vitest run -t "should create entities"
```

## Architecture Overview

This is an enhanced MCP memory server with **47 tools** (vs 11 in official version), providing knowledge graph storage with hierarchical organization.

**Version:** 0.55.0 | **npm:** @danielsimonjr/memory-mcp

### Layered Architecture

```
┌─────────────────────────────────────────┐
│  Layer 1: MCP Protocol Layer            │
│  server/MCPServer.ts + toolDefinitions  │
│  + toolHandlers (47 tools)              │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│  Layer 2: Managers (Facade Pattern)     │
│  core/KnowledgeGraphManager.ts          │
│  + 4 specialized managers (lazy init)   │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│  Layer 3: Storage Layer                 │
│  core/GraphStorage.ts (JSONL + cache)   │
└─────────────────────────────────────────┘
```

### Source Structure (src/memory/) - 47 TypeScript files

| Module | Files | Purpose |
|--------|-------|---------|
| **core/** | 5 | KnowledgeGraphManager (facade), EntityManager (CRUD + hierarchy + archive), RelationManager, GraphStorage, TransactionManager |
| **features/** | 2 | TagManager (tag aliases), IOManager (import/export/backup) |
| **search/** | 10 | SearchManager (orchestrator + compression + analytics), BasicSearch, RankedSearch, BooleanSearch, FuzzySearch, SavedSearchManager, TFIDFIndexManager, SearchFilterChain, SearchSuggestions |
| **server/** | 3 | MCPServer.ts (67 lines), toolDefinitions.ts, toolHandlers.ts |
| **types/** | 6 | Entity, relation, search, analytics, tag, import-export type definitions |
| **utils/** | 18 | Zod schemas (14 validators), constants, errors, levenshtein, tfidf, logger, pagination, caching, indexes |
| **root** | 2 | index.ts (entry point), memory/ subfolder entry |

### Key Design Patterns

1. **Facade Pattern**: KnowledgeGraphManager delegates to specialized managers
2. **Lazy Initialization**: 4 managers instantiated on-demand (EntityManager, RelationManager, SearchManager, IOManager)
3. **Dependency Injection**: GraphStorage injected into managers
4. **Handler Registry**: Tool handlers mapped in toolHandlers.ts
5. **Barrel Exports**: Each module exports via index.ts

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

### Storage Files

- `memory.jsonl` - Main graph (entities + relations)
- `memory-saved-searches.jsonl` - Saved search queries
- `memory-tag-aliases.jsonl` - Tag synonym mappings

## Entry Points

- **Build output**: `src/memory/dist/index.js`
- **CLI binary**: `mcp-server-memory`
- **Source entry**: `src/memory/index.ts`

## Environment Variables

- `MEMORY_FILE_PATH` - Custom path to memory.jsonl (defaults to current directory)

## Tool Categories (47 Total)

| Category | Count | Tools |
|----------|-------|-------|
| **Entity Operations** | 4 | create_entities, delete_entities, read_graph, open_nodes |
| **Relation Operations** | 2 | create_relations, delete_relations |
| **Observation Management** | 2 | add_observations, delete_observations |
| **Search** | 6 | search_nodes, search_by_date_range, search_nodes_ranked, boolean_search, fuzzy_search, get_search_suggestions |
| **Saved Searches** | 5 | save_search, execute_saved_search, list_saved_searches, delete_saved_search, update_saved_search |
| **Tag Management** | 6 | add_tags, remove_tags, set_importance, add_tags_to_multiple_entities, replace_tag, merge_tags |
| **Tag Aliases** | 5 | add_tag_alias, list_tag_aliases, remove_tag_alias, get_aliases_for_tag, resolve_tag |
| **Hierarchy** | 9 | set_entity_parent, get_children, get_parent, get_ancestors, get_descendants, get_subtree, get_root_entities, get_entity_depth, move_entity |
| **Analytics** | 2 | get_graph_stats, validate_graph |
| **Compression** | 4 | find_duplicates, merge_entities, compress_graph, archive_entities |
| **Import/Export** | 2 | import_graph (3 formats), export_graph (7 formats) |

## Test Structure

Tests are in `src/memory/__tests__/` (1349 tests, 38 files):

| Test File | Tests | Coverage |
|-----------|-------|----------|
| edge-cases.test.ts | 35 | Boundary conditions |
| file-path.test.ts | 9 | Path handling |
| integration/workflows.test.ts | 12 | End-to-end workflows |
| knowledge-graph.test.ts | 30 | Core graph operations |
| performance/benchmarks.test.ts | 18 | Performance validation |
| performance/write-performance.test.ts | 17 | Write optimization tests |
| unit/core/EntityManager.test.ts | 31 | Entity CRUD |
| unit/core/GraphStorage.test.ts | 10 | Storage layer |
| unit/core/RelationManager.test.ts | 24 | Relation operations |
| unit/features/AnalyticsManager.test.ts | 27 | Graph validation & stats (via SearchManager) |
| unit/features/ArchiveManager.test.ts | 27 | Entity archival (via EntityManager) |
| unit/features/BackupManager.test.ts | 27 | Backup/restore (via IOManager) |
| unit/features/CompressionManager.test.ts | 32 | Duplicate detection (via SearchManager) |
| unit/features/ExportManager.test.ts | 84 | Export formats (via IOManager) |
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
| unit/utils/entityUtils.test.ts | 32 | Entity utilities |
| unit/utils/indexes.test.ts | 24 | Search indexes |
| unit/utils/levenshtein.test.ts | 12 | String distance |
| unit/utils/responseFormatter.test.ts | 36 | Response formatting |
| unit/utils/tagUtils.test.ts | 48 | Tag utilities |
| unit/utils/validationHelper.test.ts | 26 | Zod validation |

**Note:** Performance benchmarks use relative testing (baseline + multipliers) to avoid flaky failures on different machines.

## Performance & Optimizations

- **O(1) read operations** - Direct cache access without copying (Sprint 1)
- **O(1) single-entity writes** - Append-only file operations (Sprint 2)
- **Append-only update pattern** - File deduplication on load
- In-memory caching with write-through invalidation
- 50x faster duplicate detection using two-level bucketing
- Lazy TF-IDF index loading
- Lazy manager initialization (4 managers load on-demand)
- Batch operations support via TransactionManager
- Handles 2000+ entities efficiently

## Server Architecture (v0.44.0+)

- **MCPServer.ts**: 66 lines (reduced from 907, 92.6% reduction)
- **toolDefinitions.ts**: 760 lines - all 47 tool schemas organized by category
- **toolHandlers.ts**: 301 lines - handler registry and dispatch logic
- **Consolidated constants**: SIMILARITY_WEIGHTS centralized in constants.ts

## Dependencies

**Production:**
- @modelcontextprotocol/sdk: ^1.21.1
- zod: ^4.1.13

**Development:**
- TypeScript: ^5.6.2
- Vitest: ^4.0.13
- @vitest/coverage-v8: ^4.0.13

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
