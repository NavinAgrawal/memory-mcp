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

This is an **MCP protocol wrapper** around the `@danielsimonjr/memoryjs` library, exposing 59 knowledge graph tools via the Model Context Protocol. After the Phase 13 extraction, this repo contains only 5 TypeScript source files — all core graph logic lives in memoryjs.

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
| `server/toolDefinitions.ts` | Array of 59 tool schemas (name, description, inputSchema). Organized by category with comment headers. |
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

8 test files, ~251 tests. Core graph tests are in the memoryjs package (2,882 tests).

| Test File | What It Tests |
|-----------|---------------|
| `tests/file-path.test.ts` | Storage path handling |
| `tests/knowledge-graph.test.ts` | Core graph operations via memoryjs |
| `tests/integration/server.test.ts` | MCP server integration |
| `tests/e2e/tools/entity-tools.test.ts` | Entity tool end-to-end |
| `tests/e2e/tools/observation-tools.test.ts` | Observation tool end-to-end |
| `tests/e2e/tools/relation-tools.test.ts` | Relation tool end-to-end |
| `tests/unit/response-compressor.test.ts` | Response compressor unit tests |
| `tests/e2e/tools/handler-smoke.test.ts` | Smoke tests for 36 tool handlers |

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
```

## Gotchas

- **Data files are gitignored**: `*.jsonl` and `memory.db` are in `.gitignore` — test runs create/modify these in the project root but they won't appear in `git status`.
- **Error handling in dispatch**: `handleToolCall` catches exceptions from handlers and returns them as MCP-formatted error responses (not thrown). Check MCP response `isError` field when debugging.
- **TypeScript target**: ES2022 with Node16 module resolution. The `prepare` script runs `npm run build` on install, so `dist/` is rebuilt automatically.
- **Tarball includes `dist/memory.jsonl`**: The `files` field is `["dist"]`, so any `.jsonl` copied into `dist/` gets published. Consider adding `dist/*.jsonl` to `.npmignore` if this is unintentional.
