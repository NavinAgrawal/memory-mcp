# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install           # Install all dependencies
npm run build         # Build TypeScript → JavaScript (tsc)
npm test              # Run tests with coverage (vitest)
npm run typecheck     # Strict type checking (includes --noUnusedLocals --noUnusedParameters)
npm run watch         # Watch mode for development
npm run clean         # Remove dist/ directory

# Run a single test file
npx vitest run tests/e2e/tools/entity-tools.test.ts

# Run tests matching a pattern
npx vitest run -t "should create entities"

# Run server locally (after building)
node dist/index.js

# Skip benchmark tests
# PowerShell:
$env:SKIP_BENCHMARKS=1; npm test
# Bash/Unix:
SKIP_BENCHMARKS=1 npm test

# Standalone tools (in tools/ directory)
npm run tools:install # Install dependencies for all standalone tools
npm run tools:build   # Build all standalone tools
```

## Architecture Overview

This is an **MCP protocol wrapper** around the `@danielsimonjr/memoryjs` library, exposing 137 knowledge graph tools via the Model Context Protocol. After the Phase 13 extraction, this repo contains only 5 TypeScript source files — all core graph logic lives in memoryjs.

**npm:** `@danielsimonjr/memory-mcp` | **Core lib:** `@danielsimonjr/memoryjs` (versions in package.json)

### Layered Architecture

```
memory-mcp (this repo)              @danielsimonjr/memoryjs (npm dependency)
┌──────────────────────────┐        ┌──────────────────────────────────┐
│  src/index.ts            │        │  ManagerContext (lazy init)      │
│  src/server/MCPServer.ts │───────▶│  EntityManager, RelationManager │
│  src/server/toolDefs.ts  │imports │  SearchManager, IOManager, etc. │
│  src/server/toolHandlers │        │  GraphStorage / SQLiteStorage   │
│  src/server/responseComp.│        │  StorageFactory                 │
└──────────────────────────┘        └──────────────────────────────────┘
```

### Source Files (src/) — 5 files total

| File | Role |
|------|------|
| `index.ts` | Entry point. Creates `ManagerContext`, starts `MCPServer`. Re-exports types from memoryjs for backward compatibility. |
| `server/MCPServer.ts` | Creates MCP `Server`, registers `ListToolsRequest` and `CallToolRequest` handlers. Uses stdio transport. |
| `server/toolDefinitions.ts` | Array of 137 tool schemas (name, description, inputSchema). Organized by category with comment headers. |
| `server/toolHandlers.ts` | Handler registry (`Record<string, ToolHandler>`). Each handler validates args with Zod schemas from memoryjs, calls the appropriate manager method, and returns formatted responses. Large-response tools are wrapped with `withCompression()`. |
| `server/responseCompressor.ts` | Auto-compresses responses >256KB with brotli + base64 encoding. Uses `compress`/`decompress` from memoryjs. |

### Key Patterns

- **ESM module**: `"type": "module"` in package.json. All local imports use `.js` extensions (e.g., `'./server/MCPServer.js'`).
- **Handler dispatch**: `handleToolCall(name, args, ctx)` looks up handler in `toolHandlers` registry, calls it with `(ctx, args)`.
- **Validation**: Handlers use `validateWithSchema(value, zodSchema, errorMsg)` imported from memoryjs. Ad-hoc validation uses `z` from zod directly.
- **Response formatting**: Three helpers from memoryjs — `formatToolResponse(data)` (JSON-stringified), `formatTextResponse(msg)` (plain text), `formatRawResponse(text)` (raw string).
- **Compression wrapper**: `withCompression(async () => handler())` wraps tools that return large payloads (read_graph, search_nodes, get_subtree, open_nodes). Responses >256KB get brotli-compressed.
- **Lazy managers**: `ManagerContext` instantiates managers on first access. Available accessors: `ctx.entityManager`, `ctx.relationManager`, `ctx.observationManager`, `ctx.searchManager`, `ctx.tagManager`, `ctx.hierarchyManager`, `ctx.analyticsManager`, `ctx.compressionManager`, `ctx.archiveManager`, `ctx.ioManager`, `ctx.graphTraversal`, `ctx.semanticSearch`, `ctx.rankedSearch`, `ctx.storage` (direct GraphStorage).
- **Backward compat**: `index.ts` re-exports `ManagerContext` as `KnowledgeGraphManager` alias, plus core types.

### Tool Categories (137 tools across 44 categories)

| Category | Count | Key Purpose |
|----------|-------|-------------|
| Entity | 4 | Core CRUD for graph nodes |
| Relation | 2 | Directed edges between entities |
| Observation | 3 | Facts attached to entities, with normalization |
| Search | 7 | Basic, ranked (TF-IDF), boolean, fuzzy, auto-select |
| Intelligent Search | 3 | Hybrid multi-layer, query analysis, reflection-based |
| Semantic Search | 3 | Embedding similarity via OpenAI or local models |
| Saved Searches | 5 | Store and re-execute frequent queries |
| Tag Management | 6 | Tags, bulk ops, importance scores |
| Tag Aliases | 5 | Tag synonym/alias management |
| Hierarchy | 9 | Parent-child trees, subtree traversal |
| Graph Algorithms | 4 | BFS/DFS path finding, centrality, connected components |
| Analytics | 2 | Graph stats and integrity validation |
| Compression | 4 | Duplicate detection, merge, auto-compress, archive |
| Import/Export | 2 | 7 export formats + 3 import formats with merge strategies |
| Ref Index | 4 | Cross-session symbolic reference registration/resolution |
| Artifacts | 3 | Named versioned content blobs attached to entities |
| Temporal Search | 1 | Time-window filtered search across the graph |
| Distillation | 1 | Configure automated observation distillation pipelines |
| Freshness | 5 | Staleness tracking, expiry detection, freshness reporting |
| LLM Query | 1 | Natural-language Q&A over the knowledge graph |
| Governance | 4 | Audited transactions, audit log query/history, rollback |
| Role Profiles | 2 | Per-agent role assignment and profile listing |
| Entropy | 2 | Entropy-based noise filtering and information density scoring |
| Consolidation | 3 | Background memory consolidation scheduling and control |
| Formatter | 1 | Salience-budget-aware context formatting |
| Collaborative | 1 | Multi-agent context synthesis |
| Failure Handling | 2 | Session failure distillation and graceful session end |
| Cognitive Load | 2 | Working-memory load analysis and adaptive reduction |
| Dream Engine | 3 | Background memory maintenance: 8-phase sleep-cycle consolidation |
| **Project Scoping** | **1** | List and filter entities by project (v1.8.0) |
| **Memory Versioning** | **2** | Entity version chains and per-entity version history (v1.8.0) |
| **Semantic Forget** | **1** | Two-tier deletion: exact match → semantic similarity fallback (v1.8.0) |
| **Profiles** | **2** | User/agent profile get and update (v1.8.0) |
| **Temporal KG** | **3** | Temporal relation invalidation, time-travel queries, relation timeline (v1.9.0) |
| **Ingestion** | **1** | Format-agnostic conversation/document ingestion pipeline (v1.9.0) |
| **Agent Diary** | **2** | Per-agent persistent journal write and read (v1.9.0) |
| **Session & Working Memory** | **9** | Session lifecycle, working memory CRUD, TTL, promotion, context wake-up (Phase 14) |
| **Auto-Enhancement** | **3** | Auto-link entity mentions, fact extraction, contradiction detection (Phase 14) |
| **Context Compression** | **1** | N-gram text abbreviation with legend for token savings (Phase 14) |
| **Consolidation Pipeline** | **3** | Session consolidation, pattern detection, entity summarization (Phase 14) |
| **Decay & Salience** | **5** | Time-based decay, importance scoring, weak memory cleanup, reinforcement (Phase 14) |
| **Multi-Agent** | **5** | Agent registration, cross-agent search, visibility, conflict resolution (Phase 14) |
| **Observability** | **4** | D3.js graph visualization, transcript splitting, query cost estimation (Phase 14) |
| **Dedup** | **1** | Priority-based smart deduplication (Phase 14) |

New categories (v1.8.0/v1.9.0/Phase 14, bold above) are implemented in `toolDefinitions.ts` and `toolHandlers.ts` in the same pattern as existing categories.

### Adding a New Tool

1. Add schema to `toolDefinitions.ts` (in the appropriate category section)
2. Add handler to `toolHandlers` registry in `toolHandlers.ts`
3. Handler pattern: validate args → call manager method → return formatted response
4. If response can be large, wrap with `withCompression()`
5. Add e2e test in `tests/e2e/tools/`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MEMORY_FILE_PATH` | Path to storage file | `memory.jsonl` (cwd) |
| `MEMORY_STORAGE_TYPE` | `jsonl` or `sqlite` | `jsonl` |
| `MEMORY_EMBEDDING_PROVIDER` | `openai`, `local`, or `none` | `none` |
| `MEMORY_OPENAI_API_KEY` | Required if provider is `openai` | — |
| `MEMORY_EMBEDDING_MODEL` | Embedding model name | `text-embedding-3-small` / `Xenova/all-MiniLM-L6-v2` |
| `MEMORY_AUTO_INDEX_EMBEDDINGS` | Auto-index on entity creation | `false` |

## Test Structure

24 test files, ~657 tests, >92% statement coverage. Core graph tests are in the memoryjs package.

Tests are organized in three tiers:
- **Unit** (`tests/unit/`): Isolated module tests (e.g., response compressor)
- **Integration** (`tests/integration/`): MCP server lifecycle tests
- **E2E** (`tests/e2e/tools/`): Per-category tool tests — one file per tool group (entity, relation, observation, governance, freshness, dream, entropy, etc.) plus `handler-smoke.test.ts` for broad handler coverage
- **Root** (`tests/`): Core graph operations (`knowledge-graph.test.ts`) and storage path handling (`file-path.test.ts`)

Vitest config: `vitest.config.ts`. Coverage targets `src/**/*.ts` (excludes index barrel files). Custom reporter at `tests/test-results/per-file-reporter.js`.

## Storage

Data files live in the **project root** (not `dist/`):
- **JSONL**: `memory.jsonl`, `memory-saved-searches.jsonl`, `memory-tag-aliases.jsonl`
- **SQLite**: `memory.db` (set `MEMORY_STORAGE_TYPE=sqlite`)

## Entry Points

- **Build output**: `dist/index.js`
- **CLI binary**: `mcp-server-memory` (defined in package.json `bin`)
- **Source entry**: `src/index.ts`

## Standalone Tools

The `tools/` directory has standalone utilities (each with own `package.json`, buildable to Windows exes via pkg):

| Tool | Purpose |
|------|---------|
| `chunking-for-files` | Split/merge large files for context-limited editing |
| `compress-for-context` | CTON compression for LLM context windows |
| `create-dependency-graph` | Generate TypeScript project dependency graphs |
| `migrate-from-jsonl-to-sqlite` | Convert between JSONL and SQLite formats |

## Publishing to npm

```bash
# Token with "bypass 2FA" required — classic tokens are revoked
npm config set //registry.npmjs.org/:_authToken=$(cat c:\mcp-servers\npm_key.txt)
npm publish --access public
# `prepare` script auto-builds, so separate `npm run build` is not needed before publish
# Verify tarball contents before publishing:
# npm pack --dry-run 2>&1 | grep -E "jsonl|\.db|total files|package size"
# Always bump version in package.json before publishing (npm won't re-publish an existing version)
```

## Gotchas

- **Local file dependency**: `@danielsimonjr/memoryjs` is linked via `file:C:/Users/danie/Dropbox/Github/memoryjs` in package.json. Changes to the memoryjs repo are picked up on `npm install` — no npm publish needed for local dev. This means `npm install` will fail on machines without that local path.
- **Data files are gitignored**: `*.jsonl` and `memory.db` are in `.gitignore` — test runs create/modify these in the project root but they won't appear in `git status`.
- **Error handling in dispatch**: `handleToolCall` catches exceptions from handlers and returns them as MCP-formatted error responses (not thrown). Check MCP response `isError` field when debugging.
- **TypeScript target**: ES2022 with Node16 module resolution. The `prepare` script runs `npm run build` on install, so `dist/` is rebuilt automatically.
- **Tarball includes `dist/memory.jsonl`**: The `files` field is `["dist"]`, so any `.jsonl` copied into `dist/` gets published. Consider adding `dist/*.jsonl` to `.npmignore` if this is unintentional.
