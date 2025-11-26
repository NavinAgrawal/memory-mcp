# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Root level commands (delegates to workspace)
npm install           # Install all dependencies
npm run build         # Build TypeScript → JavaScript
npm test              # Run tests with coverage (396+ tests)
npm run typecheck     # Strict type checking
npm run watch         # Watch mode for development
npm run clean         # Remove dist/ directories

# Run a single test file
npx vitest run src/memory/__tests__/unit/core/EntityManager.test.ts

# Run tests matching a pattern
npx vitest run -t "should create entities"
```

## Architecture Overview

This is an enhanced MCP memory server with 45 tools (vs 11 in official version), providing knowledge graph storage with hierarchical organization.

### Layered Architecture

```
┌─────────────────────────────────────────┐
│  Layer 1: MCP Protocol Layer            │
│  server/MCPServer.ts (45 tool defs)     │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│  Layer 2: Managers (Facade Pattern)     │
│  core/KnowledgeGraphManager.ts          │
│  + specialized managers                 │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│  Layer 3: Storage Layer                 │
│  core/GraphStorage.ts (JSONL files)     │
└─────────────────────────────────────────┘
```

### Source Structure (src/memory/)

- **core/** - Central functionality: KnowledgeGraphManager (facade), EntityManager, RelationManager, GraphStorage, TransactionManager
- **features/** - Advanced capabilities: HierarchyManager, CompressionManager, ArchiveManager, TagManager, AnalyticsManager, ExportManager, ImportManager, BackupManager
- **search/** - Search implementations: SearchManager (orchestrator), BasicSearch, RankedSearch (TF-IDF), BooleanSearch, FuzzySearch, SavedSearchManager
- **server/** - MCP protocol layer: MCPServer.ts (tool definitions and routing)
- **types/** - Type definitions for entities, relations, search, analytics, tags
- **utils/** - Utilities: Zod schemas (14 validators), constants, errors, date handling, Levenshtein distance, TF-IDF

### Key Design Patterns

1. **Facade Pattern**: KnowledgeGraphManager delegates to specialized managers
2. **Dependency Injection**: GraphStorage injected into managers
3. **Barrel Exports**: Each module exports via index.ts
4. **Manager Pattern**: One manager per domain (entities, relations, search, etc.)

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

## Tool Categories (45 Total)

- **Core Entity/Relation**: create_entities, read_graph, search_nodes, create_relations, delete_entities, etc.
- **Hierarchy (8)**: set_entity_parent, get_children, get_ancestors, get_descendants, get_subtree
- **Compression (3)**: find_duplicates, merge_entities, compress_graph
- **Search (3)**: search_nodes_ranked (TF-IDF), boolean_search, fuzzy_search
- **Saved Searches (6)**: save_search, execute_saved_search, list_saved_searches
- **Tags (8+)**: add_tags, merge_tags, add_tag_alias, resolve_tag
- **Analytics (4)**: get_graph_stats, validate_graph, search_by_date_range
- **Import/Export (2)**: export_graph (7 formats), import_graph (3 formats)

## Test Structure

Tests are in `src/memory/__tests__/`:
- `unit/core/` - Core manager unit tests
- `unit/features/` - Feature manager tests
- `unit/search/` - Search algorithm tests
- `integration/` - Workflow integration tests
- `edge-cases/` - Edge case coverage
- `performance/` - Benchmarks

## Performance Notes

- In-memory caching with write-through invalidation
- 50x faster duplicate detection using two-level bucketing
- TF-IDF index for ranked search
- Handles 2000+ entities efficiently

## Memory Usage Reminder

**Use the memory-mcp tools periodically to maintain cross-session context:**

1. **At session start**: Search memory for relevant context about the current project/task
   - `search_nodes` with project name or topic
   - `get_graph_stats` to see what's stored

2. **During work**: Store important discoveries, decisions, and context
   - Create entities for new projects, components, or concepts learned
   - Add observations to existing entities when learning new facts
   - Create relations to connect related knowledge

3. **At session end**: Persist key learnings before context is lost
   - Summarize what was accomplished
   - Record any user preferences or patterns observed
   - Note unfinished tasks or next steps

4. **Periodically**: Maintain graph hygiene
   - Use `find_duplicates` to identify redundant entries
   - Use `compress_graph` to merge similar entities
   - Update importance scores to prioritize valuable knowledge
