# MemoryJS Extraction Plan

## Project Refactoring: memory-mcp → memoryjs + memory-mcp

**Version**: 1.0.0
**Created**: 2026-01-09
**Status**: Planning

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Goals and Non-Goals](#goals-and-non-goals)
3. [Architecture Overview](#architecture-overview)
4. [Repository Setup](#repository-setup)
5. [Package Configuration](#package-configuration)
6. [Interface Definitions](#interface-definitions)
7. [Extraction Phases](#extraction-phases)
8. [Integration Plan](#integration-plan)
9. [Testing Strategy](#testing-strategy)
10. [Migration Checklist](#migration-checklist)
11. [Rollback Plan](#rollback-plan)
12. [Sprint Task Breakdown](#sprint-task-breakdown)

---

## Executive Summary

This plan details the extraction of the core knowledge graph functionality from `@danielsimonjr/memory-mcp` into a standalone library `@danielsimonjr/memoryjs`, leaving memory-mcp as a thin MCP protocol wrapper.

**Current State:**
```
memory-mcp (monolithic, 65 files, ~24,800 LOC)
├── server/       (MCP protocol - 4 files)
├── core/         (Managers, storage - 12 files)
├── features/     (Advanced features - 9 files)
├── search/       (Search implementations - 20 files)
├── types/        (Type definitions - 2 files)
├── utils/        (Utilities - 15 files)
└── workers/      (Worker pool - 2 files)
```

**Target State:**
```
memoryjs (core library, ~58 files)          memory-mcp (MCP wrapper, ~7 files)
├── core/                                    ├── server/
├── features/                                │   ├── MCPServer.ts
├── search/                                  │   ├── toolDefinitions.ts
├── types/                                   │   └── toolHandlers.ts
├── utils/                                   ├── index.ts
├── workers/                                 └── package.json
├── adapters/                                    (depends on @danielsimonjr/memoryjs)
│   ├── storage/
│   │   ├── JsonlStorageAdapter.ts
│   │   └── SqliteStorageAdapter.ts
│   └── workers/
│       └── NodeWorkerAdapter.ts
└── package.json
```

**Versioning:**
- `@danielsimonjr/memoryjs`: 1.0.0 (new package)
- `@danielsimonjr/memory-mcp`: 10.0.0 (major version bump due to internal restructure)

---

## Goals and Non-Goals

### Goals

1. **Separation of Concerns**: Extract core knowledge graph into reusable library
2. **Portability**: Enable future Bun/Deno support via adapter interfaces
3. **Maintainability**: Cleaner codebase with single responsibility per package
4. **Reusability**: Allow use of memoryjs in non-MCP contexts (CLI tools, web apps, APIs)
5. **Backward Compatibility**: memory-mcp maintains identical 59 tools and external behavior
6. **Incremental Migration**: Extract module by module with constant validation

### Non-Goals

1. NOT implementing Bun/Deno adapters (future work)
2. NOT changing the public MCP tool API
3. NOT redesigning the ManagerContext pattern
4. NOT adding new features during extraction
5. NOT breaking existing memory-mcp users

---

## Architecture Overview

### Dependency Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User Application                          │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│  @danielsimonjr/        │     │  Direct memoryjs usage      │
│  memory-mcp             │     │  (CLI tools, web apps)      │
│  (MCP Protocol Layer)   │     │                             │
└───────────┬─────────────┘     └──────────────┬──────────────┘
            │                                   │
            └───────────────┬───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 @danielsimonjr/memoryjs                      │
│                   (Core Library)                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ManagerContext                                      │    │
│  │  ├── EntityManager                                   │    │
│  │  ├── RelationManager                                 │    │
│  │  ├── SearchManager                                   │    │
│  │  ├── IOManager                                       │    │
│  │  └── TagManager                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                 │
│  ┌─────────────────────────┴─────────────────────────┐      │
│  │              Adapter Interfaces                    │      │
│  │  ┌─────────────────┐  ┌─────────────────────────┐ │      │
│  │  │ IStorageAdapter │  │ IWorkerAdapter          │ │      │
│  │  └────────┬────────┘  └────────────┬────────────┘ │      │
│  └───────────┼────────────────────────┼──────────────┘      │
│              │                        │                      │
│  ┌───────────┴────────────┐  ┌───────┴───────────────┐      │
│  │  Built-in Adapters     │  │  Built-in Adapters    │      │
│  │  • JsonlStorageAdapter │  │  • NodeWorkerAdapter  │      │
│  │  • SqliteStorageAdapter│  │    (workerpool)       │      │
│  └────────────────────────┘  └───────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Module Responsibilities

| Package | Responsibility |
|---------|---------------|
| **memoryjs** | Core knowledge graph operations, search, storage adapters, worker adapters |
| **memory-mcp** | MCP protocol binding, tool definitions, tool handlers |

---

## Repository Setup

### Phase 0: Repository Initialization

#### Step 0.1: Create memoryjs Repository

**Location**: `C:\Users\danie\Dropbox\github\memoryjs`

```bash
# Create directory
mkdir -p C:\Users\danie\Dropbox\github\memoryjs

# Initialize git
cd C:\Users\danie\Dropbox\github\memoryjs
git init

# Create initial structure
mkdir -p src/{core,features,search,types,utils,workers,adapters/{storage,workers}}
mkdir -p tests/{unit,integration}
mkdir -p docs
```

#### Step 0.2: Initialize package.json for memoryjs

```json
{
  "name": "@danielsimonjr/memoryjs",
  "version": "1.0.0",
  "description": "High-performance knowledge graph library with pluggable storage and worker adapters",
  "license": "MIT",
  "type": "module",
  "engines": {
    "node": ">=18.0.0"
  },
  "author": "Daniel Simon Jr. (https://github.com/danielsimonjr)",
  "homepage": "https://github.com/danielsimonjr/memoryjs",
  "repository": {
    "type": "git",
    "url": "https://github.com/danielsimonjr/memoryjs.git"
  },
  "keywords": [
    "knowledge-graph",
    "memory",
    "graph-database",
    "entity-management",
    "search",
    "typescript"
  ],
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./adapters": {
      "types": "./dist/adapters/index.d.ts",
      "import": "./dist/adapters/index.js"
    }
  },
  "files": [
    "dist",
    "LICENSE",
    "README.md"
  ],
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "zod": "^4.1.13",
    "better-sqlite3": "^11.7.0",
    "@danielsimonjr/workerpool": "^9.2.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^22.10.2",
    "typescript": "^5.6.2",
    "vitest": "^4.0.13",
    "@vitest/coverage-v8": "^4.0.13"
  }
}
```

#### Step 0.3: Initialize tsconfig.json for memoryjs

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

#### Step 0.4: Create Feature Branch in memory-mcp

```bash
cd C:\mcp-servers\memory-mcp
git checkout -b feature/memoryjs-extraction
```

---

## Package Configuration

### memoryjs Package Structure

```
memoryjs/
├── src/
│   ├── index.ts                    # Main entry point, exports ManagerContext
│   │
│   ├── adapters/
│   │   ├── index.ts                # Adapter exports
│   │   ├── interfaces.ts           # IStorageAdapter, IWorkerAdapter
│   │   ├── storage/
│   │   │   ├── index.ts
│   │   │   ├── JsonlStorageAdapter.ts
│   │   │   └── SqliteStorageAdapter.ts
│   │   └── workers/
│   │       ├── index.ts
│   │       ├── NodeWorkerAdapter.ts
│   │       └── SyncWorkerAdapter.ts  # Fallback for no workers
│   │
│   ├── core/
│   │   ├── index.ts
│   │   ├── ManagerContext.ts
│   │   ├── EntityManager.ts
│   │   ├── RelationManager.ts
│   │   ├── ObservationManager.ts
│   │   ├── HierarchyManager.ts
│   │   ├── TransactionManager.ts
│   │   ├── GraphStorage.ts          # Uses IStorageAdapter
│   │   ├── GraphTraversal.ts
│   │   └── GraphEventEmitter.ts
│   │
│   ├── features/
│   │   ├── index.ts
│   │   ├── TagManager.ts
│   │   ├── IOManager.ts
│   │   ├── StreamingExporter.ts
│   │   ├── AnalyticsManager.ts
│   │   ├── ArchiveManager.ts
│   │   ├── CompressionManager.ts
│   │   ├── ObservationNormalizer.ts
│   │   └── KeywordExtractor.ts
│   │
│   ├── search/
│   │   ├── index.ts
│   │   ├── SearchManager.ts
│   │   ├── BasicSearch.ts
│   │   ├── RankedSearch.ts
│   │   ├── BooleanSearch.ts
│   │   ├── FuzzySearch.ts           # Uses IWorkerAdapter
│   │   ├── SearchFilterChain.ts
│   │   ├── SavedSearchManager.ts
│   │   ├── TFIDFIndexManager.ts
│   │   ├── TFIDFEventSync.ts
│   │   ├── SearchSuggestions.ts
│   │   ├── QueryCostEstimator.ts
│   │   ├── SemanticSearch.ts
│   │   ├── EmbeddingService.ts
│   │   ├── VectorStore.ts
│   │   ├── HybridSearchManager.ts
│   │   ├── QueryAnalyzer.ts
│   │   ├── QueryPlanner.ts
│   │   ├── SymbolicSearch.ts
│   │   └── ReflectionManager.ts
│   │
│   ├── types/
│   │   ├── index.ts
│   │   └── types.ts
│   │
│   ├── utils/
│   │   ├── index.ts
│   │   ├── schemas.ts
│   │   ├── constants.ts
│   │   ├── formatters.ts
│   │   ├── entityUtils.ts
│   │   ├── searchAlgorithms.ts
│   │   ├── compressionUtil.ts
│   │   ├── compressedCache.ts
│   │   ├── operationUtils.ts
│   │   ├── taskScheduler.ts
│   │   ├── searchCache.ts
│   │   ├── indexes.ts
│   │   ├── errors.ts
│   │   ├── logger.ts
│   │   └── parallelUtils.ts
│   │
│   └── workers/
│       ├── index.ts
│       └── levenshteinWorker.ts
│
├── tests/
│   ├── unit/
│   │   ├── core/
│   │   ├── features/
│   │   ├── search/
│   │   └── utils/
│   └── integration/
│
├── docs/
│   └── API.md
│
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── LICENSE
├── README.md
└── CLAUDE.md
```

### memory-mcp Package Structure (After Extraction)

```
memory-mcp/
├── src/
│   ├── index.ts                    # Entry point, creates ManagerContext
│   └── server/
│       ├── MCPServer.ts
│       ├── toolDefinitions.ts
│       ├── toolHandlers.ts
│       └── responseCompressor.ts
│
├── tests/
│   └── integration/
│       └── mcp-tools.test.ts       # MCP-specific integration tests
│
├── docs/
│   └── (existing docs)
│
├── package.json                    # Depends on @danielsimonjr/memoryjs
├── tsconfig.json
├── vitest.config.ts
├── LICENSE
├── README.md
└── CLAUDE.md
```

---

## Interface Definitions

### IStorageAdapter Interface

**File**: `src/adapters/interfaces.ts`

```typescript
import type { KnowledgeGraph, Entity, Relation } from '../types/types.js';

/**
 * Storage adapter interface for pluggable storage backends.
 *
 * Implementations:
 * - JsonlStorageAdapter: Line-delimited JSON file storage (default)
 * - SqliteStorageAdapter: SQLite database with FTS5 (built-in)
 * - Custom: Implement this interface for IndexedDB, cloud storage, etc.
 */
export interface IStorageAdapter {
  /**
   * Initialize the storage backend.
   * Called once when ManagerContext is created.
   */
  initialize(): Promise<void>;

  /**
   * Load the complete knowledge graph from storage.
   * @returns The complete graph with entities and relations
   */
  loadGraph(): Promise<KnowledgeGraph>;

  /**
   * Save the complete knowledge graph to storage.
   * @param graph - The graph to persist
   */
  saveGraph(graph: KnowledgeGraph): Promise<void>;

  /**
   * Check if the storage has been initialized with data.
   */
  exists(): Promise<boolean>;

  /**
   * Close any open connections/handles.
   */
  close(): Promise<void>;

  /**
   * Get storage metadata (optional).
   */
  getMetadata?(): Promise<StorageMetadata>;
}

export interface StorageMetadata {
  type: 'jsonl' | 'sqlite' | 'custom';
  path: string;
  size?: number;
  lastModified?: string;
}

/**
 * Configuration for storage adapter creation.
 */
export interface StorageConfig {
  type: 'jsonl' | 'sqlite';
  path: string;
  options?: {
    /** SQLite: Enable WAL mode (default: true) */
    walMode?: boolean;
    /** SQLite: Enable FTS5 full-text search (default: true) */
    fts5?: boolean;
    /** JSONL: Pretty print JSON (default: false) */
    prettyPrint?: boolean;
  };
}

/**
 * Factory function type for creating storage adapters.
 */
export type StorageAdapterFactory = (config: StorageConfig) => IStorageAdapter;
```

### IWorkerAdapter Interface

**File**: `src/adapters/interfaces.ts` (continued)

```typescript
/**
 * Worker adapter interface for pluggable parallel processing.
 *
 * Implementations:
 * - NodeWorkerAdapter: Node.js worker_threads via workerpool (default)
 * - SyncWorkerAdapter: Synchronous fallback (no parallelism)
 * - Custom: Implement for Web Workers, Bun workers, Deno workers, etc.
 */
export interface IWorkerAdapter {
  /**
   * Execute a function in a worker thread.
   * @param workerPath - Path to the worker module
   * @param method - Method name to call in the worker
   * @param args - Arguments to pass to the method
   * @returns Promise resolving to the result
   */
  exec<T>(workerPath: string, method: string, args: unknown[]): Promise<T>;

  /**
   * Execute a function directly (for simple tasks).
   * @param fn - Function to execute
   * @param args - Arguments to pass
   */
  execDirect<T>(fn: (...args: unknown[]) => T, args: unknown[]): Promise<T>;

  /**
   * Get the number of available workers.
   */
  getPoolSize(): number;

  /**
   * Get current worker statistics.
   */
  getStats(): WorkerStats;

  /**
   * Terminate all workers and clean up.
   */
  terminate(): Promise<void>;
}

export interface WorkerStats {
  totalWorkers: number;
  busyWorkers: number;
  idleWorkers: number;
  pendingTasks: number;
}

/**
 * Configuration for worker adapter creation.
 */
export interface WorkerConfig {
  /** Maximum number of workers (default: CPU cores - 1) */
  maxWorkers?: number;
  /** Minimum number of workers to keep alive (default: 1) */
  minWorkers?: number;
  /** Worker idle timeout in ms (default: 60000) */
  idleTimeout?: number;
}

/**
 * Factory function type for creating worker adapters.
 */
export type WorkerAdapterFactory = (config?: WorkerConfig) => IWorkerAdapter;
```

### ManagerContext Configuration

**File**: `src/core/ManagerContext.ts` (updated)

```typescript
import type { IStorageAdapter, IWorkerAdapter, StorageConfig, WorkerConfig } from '../adapters/interfaces.js';
import { createStorageAdapter } from '../adapters/storage/index.js';
import { createWorkerAdapter } from '../adapters/workers/index.js';

export interface ManagerContextConfig {
  /**
   * Storage configuration or custom adapter.
   * Default: JSONL storage at './memory.jsonl'
   */
  storage?: StorageConfig | IStorageAdapter;

  /**
   * Worker configuration or custom adapter.
   * Default: NodeWorkerAdapter with auto-detected pool size
   */
  workers?: WorkerConfig | IWorkerAdapter;

  /**
   * Path for saved searches file (JSONL only).
   */
  savedSearchesPath?: string;

  /**
   * Path for tag aliases file (JSONL only).
   */
  tagAliasesPath?: string;
}

export class ManagerContext {
  private readonly storageAdapter: IStorageAdapter;
  private readonly workerAdapter: IWorkerAdapter;

  // ... lazy-initialized managers ...

  constructor(config?: ManagerContextConfig | string) {
    // Support legacy string path for backward compatibility
    if (typeof config === 'string') {
      config = { storage: { type: 'jsonl', path: config } };
    }

    const resolvedConfig = config ?? {};

    // Initialize storage adapter
    if (isStorageAdapter(resolvedConfig.storage)) {
      this.storageAdapter = resolvedConfig.storage;
    } else {
      const storageConfig: StorageConfig = resolvedConfig.storage ?? {
        type: 'jsonl',
        path: './memory.jsonl'
      };
      this.storageAdapter = createStorageAdapter(storageConfig);
    }

    // Initialize worker adapter
    if (isWorkerAdapter(resolvedConfig.workers)) {
      this.workerAdapter = resolvedConfig.workers;
    } else {
      this.workerAdapter = createWorkerAdapter(resolvedConfig.workers);
    }
  }

  // ... rest of implementation ...
}

// Type guards
function isStorageAdapter(obj: unknown): obj is IStorageAdapter {
  return obj !== null &&
         typeof obj === 'object' &&
         'loadGraph' in obj &&
         'saveGraph' in obj;
}

function isWorkerAdapter(obj: unknown): obj is IWorkerAdapter {
  return obj !== null &&
         typeof obj === 'object' &&
         'exec' in obj &&
         'terminate' in obj;
}
```

---

## Extraction Phases

### Phase 1: Foundation (types, utils, errors)

**Goal**: Extract foundational modules with zero dependencies on other internal modules.

**Duration**: 1-2 sprints

#### Sprint 1.1: Types Module

**Files to Extract**:
| Source (memory-mcp) | Destination (memoryjs) |
|---------------------|------------------------|
| `src/types/types.ts` | `src/types/types.ts` |
| `src/types/index.ts` | `src/types/index.ts` |

**Tasks**:
1. Create `memoryjs/src/types/` directory
2. Copy `types.ts` with all interfaces
3. Copy `index.ts` barrel export
4. Run `npm run typecheck` in memoryjs
5. Commit to memoryjs main: "feat: add types module"

**Verification**:
```bash
cd C:\Users\danie\Dropbox\github\memoryjs
npm run typecheck
# Should pass with 0 errors
```

#### Sprint 1.2: Errors Module

**Files to Extract**:
| Source (memory-mcp) | Destination (memoryjs) |
|---------------------|------------------------|
| `src/utils/errors.ts` | `src/utils/errors.ts` |

**Tasks**:
1. Create `memoryjs/src/utils/` directory
2. Copy `errors.ts` (12 error classes)
3. Update imports if needed
4. Run typecheck
5. Commit: "feat: add error classes"

#### Sprint 1.3: Core Utilities

**Files to Extract** (in order):
| Source | Destination | Dependencies |
|--------|-------------|--------------|
| `src/utils/constants.ts` | `src/utils/constants.ts` | None |
| `src/utils/logger.ts` | `src/utils/logger.ts` | None |
| `src/utils/entityUtils.ts` | `src/utils/entityUtils.ts` | types |
| `src/utils/searchAlgorithms.ts` | `src/utils/searchAlgorithms.ts` | None |
| `src/utils/formatters.ts` | `src/utils/formatters.ts` | types |
| `src/utils/schemas.ts` | `src/utils/schemas.ts` | types, zod |

**Tasks per file**:
1. Copy file to memoryjs
2. Update relative imports
3. Run typecheck
4. Commit: "feat: add {filename}"

#### Sprint 1.4: Advanced Utilities

**Files to Extract**:
| Source | Destination | Dependencies |
|--------|-------------|--------------|
| `src/utils/indexes.ts` | `src/utils/indexes.ts` | types |
| `src/utils/searchCache.ts` | `src/utils/searchCache.ts` | types |
| `src/utils/compressionUtil.ts` | `src/utils/compressionUtil.ts` | None |
| `src/utils/compressedCache.ts` | `src/utils/compressedCache.ts` | compressionUtil |
| `src/utils/operationUtils.ts` | `src/utils/operationUtils.ts` | None |
| `src/utils/parallelUtils.ts` | `src/utils/parallelUtils.ts` | None |
| `src/utils/taskScheduler.ts` | `src/utils/taskScheduler.ts` | None |
| `src/utils/index.ts` | `src/utils/index.ts` | All above |

**Commit**: "feat: add utility modules"

#### Sprint 1.5: Workers Module

**Files to Extract**:
| Source | Destination |
|--------|-------------|
| `src/workers/levenshteinWorker.ts` | `src/workers/levenshteinWorker.ts` |
| `src/workers/index.ts` | `src/workers/index.ts` |

**Commit**: "feat: add workers module"

#### Sprint 1.6: Add Adapter Interfaces

**New Files to Create**:
| File | Purpose |
|------|---------|
| `src/adapters/interfaces.ts` | IStorageAdapter, IWorkerAdapter interfaces |
| `src/adapters/index.ts` | Barrel export |

**Commit**: "feat: add adapter interfaces"

**Phase 1 Checkpoint**:
```bash
cd C:\Users\danie\Dropbox\github\memoryjs
npm run typecheck  # 0 errors
npm run build      # Successful
git log --oneline  # ~8 commits
```

---

### Phase 2: Core Module

**Goal**: Extract core managers and storage with adapter integration.

**Duration**: 2-3 sprints

#### Sprint 2.1: Storage Adapters

**New Files to Create**:
| File | Purpose |
|------|---------|
| `src/adapters/storage/JsonlStorageAdapter.ts` | JSONL file storage |
| `src/adapters/storage/SqliteStorageAdapter.ts` | SQLite storage |
| `src/adapters/storage/index.ts` | Factory and exports |

**Refactoring Required**:
- Extract storage logic from `GraphStorage.ts` into adapters
- `GraphStorage.ts` becomes a thin wrapper using `IStorageAdapter`

**Tasks**:
1. Create `JsonlStorageAdapter` implementing `IStorageAdapter`
   - Move JSONL read/write logic from GraphStorage
   - Implement `loadGraph()`, `saveGraph()`, `initialize()`, `close()`
2. Create `SqliteStorageAdapter` implementing `IStorageAdapter`
   - Move SQLite logic from SQLiteStorage
   - Keep better-sqlite3 integration
3. Create factory function `createStorageAdapter(config)`
4. Update `GraphStorage` to use adapter
5. Run typecheck and tests
6. Commit: "feat: add storage adapters"

**JsonlStorageAdapter Skeleton**:
```typescript
import type { IStorageAdapter, StorageMetadata } from '../interfaces.js';
import type { KnowledgeGraph } from '../../types/types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class JsonlStorageAdapter implements IStorageAdapter {
  private readonly filePath: string;
  private readonly prettyPrint: boolean;

  constructor(filePath: string, options?: { prettyPrint?: boolean }) {
    this.filePath = path.resolve(filePath);
    this.prettyPrint = options?.prettyPrint ?? false;
  }

  async initialize(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
  }

  async loadGraph(): Promise<KnowledgeGraph> {
    // ... JSONL parsing logic from GraphStorage ...
  }

  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    // ... JSONL writing logic from GraphStorage ...
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    // No cleanup needed for file-based storage
  }

  async getMetadata(): Promise<StorageMetadata> {
    const stats = await fs.stat(this.filePath);
    return {
      type: 'jsonl',
      path: this.filePath,
      size: stats.size,
      lastModified: stats.mtime.toISOString()
    };
  }
}
```

#### Sprint 2.2: Worker Adapters

**New Files to Create**:
| File | Purpose |
|------|---------|
| `src/adapters/workers/NodeWorkerAdapter.ts` | workerpool integration |
| `src/adapters/workers/SyncWorkerAdapter.ts` | Synchronous fallback |
| `src/adapters/workers/index.ts` | Factory and exports |

**Tasks**:
1. Create `NodeWorkerAdapter` implementing `IWorkerAdapter`
   - Wrap workerpool functionality
   - Handle worker lifecycle
2. Create `SyncWorkerAdapter` for environments without workers
   - Execute functions synchronously
3. Create factory function `createWorkerAdapter(config)`
4. Update `FuzzySearch` to use `IWorkerAdapter`
5. Run typecheck and tests
6. Commit: "feat: add worker adapters"

**NodeWorkerAdapter Skeleton**:
```typescript
import type { IWorkerAdapter, WorkerStats, WorkerConfig } from '../interfaces.js';
import workerpool from '@danielsimonjr/workerpool';
import * as os from 'os';

export class NodeWorkerAdapter implements IWorkerAdapter {
  private pool: workerpool.Pool;
  private readonly config: Required<WorkerConfig>;

  constructor(config?: WorkerConfig) {
    this.config = {
      maxWorkers: config?.maxWorkers ?? Math.max(1, os.cpus().length - 1),
      minWorkers: config?.minWorkers ?? 1,
      idleTimeout: config?.idleTimeout ?? 60000
    };

    this.pool = workerpool.pool({
      maxWorkers: this.config.maxWorkers,
      minWorkers: this.config.minWorkers
    });
  }

  async exec<T>(workerPath: string, method: string, args: unknown[]): Promise<T> {
    return this.pool.exec(method, args, {
      on: workerPath
    }) as Promise<T>;
  }

  async execDirect<T>(fn: (...args: unknown[]) => T, args: unknown[]): Promise<T> {
    return this.pool.exec(fn, args) as Promise<T>;
  }

  getPoolSize(): number {
    return this.config.maxWorkers;
  }

  getStats(): WorkerStats {
    const stats = this.pool.stats();
    return {
      totalWorkers: stats.totalWorkers,
      busyWorkers: stats.busyWorkers,
      idleWorkers: stats.idleWorkers,
      pendingTasks: stats.pendingTasks
    };
  }

  async terminate(): Promise<void> {
    await this.pool.terminate();
  }
}
```

#### Sprint 2.3: Core Managers (Part 1)

**Files to Extract**:
| Source | Destination | Modifications |
|--------|-------------|---------------|
| `src/core/GraphStorage.ts` | `src/core/GraphStorage.ts` | Use IStorageAdapter |
| `src/core/GraphEventEmitter.ts` | `src/core/GraphEventEmitter.ts` | None |
| `src/core/EntityManager.ts` | `src/core/EntityManager.ts` | None |
| `src/core/RelationManager.ts` | `src/core/RelationManager.ts` | None |

**Tasks**:
1. Copy each file, update imports
2. Modify `GraphStorage` to accept `IStorageAdapter` in constructor
3. Run typecheck after each file
4. Commit: "feat: add core managers (part 1)"

#### Sprint 2.4: Core Managers (Part 2)

**Files to Extract**:
| Source | Destination |
|--------|-------------|
| `src/core/ObservationManager.ts` | `src/core/ObservationManager.ts` |
| `src/core/HierarchyManager.ts` | `src/core/HierarchyManager.ts` |
| `src/core/TransactionManager.ts` | `src/core/TransactionManager.ts` |
| `src/core/GraphTraversal.ts` | `src/core/GraphTraversal.ts` |

**Commit**: "feat: add core managers (part 2)"

#### Sprint 2.5: ManagerContext

**Files to Extract**:
| Source | Destination | Modifications |
|--------|-------------|---------------|
| `src/core/ManagerContext.ts` | `src/core/ManagerContext.ts` | Add adapter config |
| `src/core/index.ts` | `src/core/index.ts` | Update exports |

**Key Changes**:
- Add `ManagerContextConfig` interface
- Support both config object and legacy string path
- Initialize adapters from config
- Pass adapters to managers that need them

**Commit**: "feat: add ManagerContext with adapter support"

**Phase 2 Checkpoint**:
```bash
cd C:\Users\danie\Dropbox\github\memoryjs
npm run typecheck  # 0 errors
npm run build      # Successful
# Create simple test
echo "import { ManagerContext } from './dist/index.js'; console.log('OK');" > test.mjs
node test.mjs      # Should print "OK"
```

---

### Phase 3: Search Module

**Goal**: Extract all search implementations.

**Duration**: 2 sprints

#### Sprint 3.1: Basic Search Components

**Files to Extract**:
| Source | Destination |
|--------|-------------|
| `src/search/BasicSearch.ts` | `src/search/BasicSearch.ts` |
| `src/search/SearchFilterChain.ts` | `src/search/SearchFilterChain.ts` |
| `src/search/SearchSuggestions.ts` | `src/search/SearchSuggestions.ts` |
| `src/search/SavedSearchManager.ts` | `src/search/SavedSearchManager.ts` |

**Commit**: "feat: add basic search components"

#### Sprint 3.2: Advanced Search Components

**Files to Extract**:
| Source | Destination | Modifications |
|--------|-------------|---------------|
| `src/search/RankedSearch.ts` | `src/search/RankedSearch.ts` | None |
| `src/search/BooleanSearch.ts` | `src/search/BooleanSearch.ts` | None |
| `src/search/FuzzySearch.ts` | `src/search/FuzzySearch.ts` | Use IWorkerAdapter |
| `src/search/TFIDFIndexManager.ts` | `src/search/TFIDFIndexManager.ts` | None |
| `src/search/TFIDFEventSync.ts` | `src/search/TFIDFEventSync.ts` | None |
| `src/search/QueryCostEstimator.ts` | `src/search/QueryCostEstimator.ts` | None |

**Key Change for FuzzySearch**:
```typescript
export class FuzzySearch {
  constructor(
    private storage: GraphStorage,
    private workerAdapter?: IWorkerAdapter  // Optional, fallback to sync
  ) {}

  async fuzzySearch(query: string, threshold?: number, ...): Promise<KnowledgeGraph> {
    if (this.workerAdapter) {
      // Use worker for parallel processing
      return this.workerAdapter.exec(
        './workers/levenshteinWorker.js',
        'searchEntities',
        [entities, query, threshold]
      );
    } else {
      // Fallback to synchronous
      return this.fuzzySearchSync(query, threshold, ...);
    }
  }
}
```

**Commit**: "feat: add advanced search components"

#### Sprint 3.3: Semantic Search Components

**Files to Extract**:
| Source | Destination |
|--------|-------------|
| `src/search/EmbeddingService.ts` | `src/search/EmbeddingService.ts` |
| `src/search/VectorStore.ts` | `src/search/VectorStore.ts` |
| `src/search/SemanticSearch.ts` | `src/search/SemanticSearch.ts` |

**Commit**: "feat: add semantic search components"

#### Sprint 3.4: Phase 11 Hybrid Search Components

**Files to Extract**:
| Source | Destination |
|--------|-------------|
| `src/search/HybridSearchManager.ts` | `src/search/HybridSearchManager.ts` |
| `src/search/QueryAnalyzer.ts` | `src/search/QueryAnalyzer.ts` |
| `src/search/QueryPlanner.ts` | `src/search/QueryPlanner.ts` |
| `src/search/SymbolicSearch.ts` | `src/search/SymbolicSearch.ts` |
| `src/search/ReflectionManager.ts` | `src/search/ReflectionManager.ts` |

**Commit**: "feat: add hybrid search components"

#### Sprint 3.5: SearchManager and Index

**Files to Extract**:
| Source | Destination |
|--------|-------------|
| `src/search/SearchManager.ts` | `src/search/SearchManager.ts` |
| `src/search/index.ts` | `src/search/index.ts` |

**Commit**: "feat: add SearchManager"

**Phase 3 Checkpoint**:
```bash
npm run typecheck  # 0 errors
npm run build
```

---

### Phase 4: Features Module

**Goal**: Extract advanced features.

**Duration**: 1 sprint

#### Sprint 4.1: Feature Managers

**Files to Extract**:
| Source | Destination |
|--------|-------------|
| `src/features/TagManager.ts` | `src/features/TagManager.ts` |
| `src/features/IOManager.ts` | `src/features/IOManager.ts` |
| `src/features/StreamingExporter.ts` | `src/features/StreamingExporter.ts` |
| `src/features/AnalyticsManager.ts` | `src/features/AnalyticsManager.ts` |
| `src/features/ArchiveManager.ts` | `src/features/ArchiveManager.ts` |
| `src/features/CompressionManager.ts` | `src/features/CompressionManager.ts` |
| `src/features/ObservationNormalizer.ts` | `src/features/ObservationNormalizer.ts` |
| `src/features/KeywordExtractor.ts` | `src/features/KeywordExtractor.ts` |
| `src/features/index.ts` | `src/features/index.ts` |

**Commit**: "feat: add features module"

---

### Phase 5: Main Entry Point and Tests

**Goal**: Finalize memoryjs package and extract tests.

**Duration**: 2 sprints

#### Sprint 5.1: Main Entry Point

**File to Create**: `src/index.ts`

```typescript
// Main exports
export { ManagerContext } from './core/ManagerContext.js';
export type { ManagerContextConfig } from './core/ManagerContext.js';

// Adapter interfaces
export type {
  IStorageAdapter,
  IWorkerAdapter,
  StorageConfig,
  WorkerConfig,
  StorageMetadata,
  WorkerStats
} from './adapters/interfaces.js';

// Built-in adapters
export { JsonlStorageAdapter } from './adapters/storage/JsonlStorageAdapter.js';
export { SqliteStorageAdapter } from './adapters/storage/SqliteStorageAdapter.js';
export { NodeWorkerAdapter } from './adapters/workers/NodeWorkerAdapter.js';
export { SyncWorkerAdapter } from './adapters/workers/SyncWorkerAdapter.js';
export { createStorageAdapter } from './adapters/storage/index.js';
export { createWorkerAdapter } from './adapters/workers/index.js';

// Types (re-export all)
export * from './types/index.js';

// Errors
export * from './utils/errors.js';

// For advanced usage - individual managers
export { EntityManager } from './core/EntityManager.js';
export { RelationManager } from './core/RelationManager.js';
export { SearchManager } from './search/SearchManager.js';
export { IOManager } from './features/IOManager.js';
export { TagManager } from './features/TagManager.js';
```

**Commit**: "feat: add main entry point"

#### Sprint 5.2: Extract Tests

**Test Migration Strategy**:

| Test Category | Destination | Refactoring |
|---------------|-------------|-------------|
| `tests/unit/core/` | memoryjs | Update imports |
| `tests/unit/features/` | memoryjs | Update imports |
| `tests/unit/search/` | memoryjs | Update imports |
| `tests/unit/utils/` | memoryjs | Update imports |
| `tests/integration/` (non-MCP) | memoryjs | Update imports |
| `tests/performance/` | memoryjs | Update imports |
| MCP tool tests | memory-mcp | Keep in place |

**Tasks**:
1. Copy test directories to memoryjs
2. Update all imports to use `@danielsimonjr/memoryjs`
3. Update vitest.config.ts
4. Run tests: `npm test`
5. Fix any failures
6. Commit: "test: add comprehensive test suite"

#### Sprint 5.3: Documentation

**Files to Create in memoryjs**:
| File | Purpose |
|------|---------|
| `README.md` | Package documentation |
| `CLAUDE.md` | Development guidance |
| `docs/API.md` | API reference |
| `LICENSE` | MIT license |

**README.md Structure**:
```markdown
# @danielsimonjr/memoryjs

High-performance knowledge graph library with pluggable storage and worker adapters.

## Installation

npm install @danielsimonjr/memoryjs

## Quick Start

import { ManagerContext } from '@danielsimonjr/memoryjs';

const ctx = new ManagerContext('./memory.jsonl');
await ctx.entityManager.createEntities([...]);

## Configuration

### Storage Adapters
### Worker Adapters
### Custom Adapters

## API Reference

## License
```

**Commit**: "docs: add documentation"

#### Sprint 5.4: Publish memoryjs to npm

**Tasks**:
1. Final typecheck and build
2. Run full test suite
3. Update version if needed
4. Publish: `npm publish --access public`

```bash
cd C:\Users\danie\Dropbox\github\memoryjs
npm run typecheck
npm run build
npm test
npm publish --access public
```

**Commit**: "chore: prepare for npm publish"

---

## Integration Plan

### Phase 6: Wire Up memory-mcp

**Goal**: Update memory-mcp to use memoryjs as a dependency.

**Duration**: 2 sprints

#### Sprint 6.1: Update memory-mcp Dependencies

**In memory-mcp feature branch**:

1. Update `package.json`:
```json
{
  "name": "@danielsimonjr/memory-mcp",
  "version": "10.0.0",
  "dependencies": {
    "@danielsimonjr/memoryjs": "^1.0.0",
    "@modelcontextprotocol/sdk": "^1.21.1"
  }
}
```

2. Remove extracted source files from `src/`:
   - Delete `src/core/` (except keep imports working via memoryjs)
   - Delete `src/features/`
   - Delete `src/search/`
   - Delete `src/types/`
   - Delete `src/utils/`
   - Delete `src/workers/`

3. Keep only:
   - `src/index.ts`
   - `src/server/MCPServer.ts`
   - `src/server/toolDefinitions.ts`
   - `src/server/toolHandlers.ts`
   - `src/server/responseCompressor.ts`

**Commit to feature branch**: "refactor: remove extracted modules"

#### Sprint 6.2: Update Imports in memory-mcp

**Update `src/index.ts`**:
```typescript
import { ManagerContext } from '@danielsimonjr/memoryjs';
import { MCPServer } from './server/MCPServer.js';

async function main() {
  const memoryFilePath = process.env.MEMORY_FILE_PATH || './memory.jsonl';
  const storageType = process.env.MEMORY_STORAGE_TYPE || 'jsonl';

  const ctx = new ManagerContext({
    storage: {
      type: storageType as 'jsonl' | 'sqlite',
      path: memoryFilePath
    }
  });

  const server = new MCPServer(ctx);
  await server.start();
}

main().catch(console.error);
```

**Update `src/server/toolHandlers.ts`**:
```typescript
import {
  ManagerContext,
  type Entity,
  type Relation,
  type KnowledgeGraph,
  // ... other types
} from '@danielsimonjr/memoryjs';

// Tool handlers remain the same, just with updated imports
```

**Update `src/server/toolDefinitions.ts`**:
```typescript
// No changes needed - just schema definitions
```

**Commit to feature branch**: "refactor: update imports to use memoryjs"

#### Sprint 6.3: Verify MCP Functionality

**Tasks**:
1. Run typecheck: `npm run typecheck`
2. Build: `npm run build`
3. Run MCP-specific tests
4. Manual test with Claude Desktop
5. Verify all 59 tools work identically

**Test Commands**:
```bash
cd C:\mcp-servers\memory-mcp
npm install
npm run typecheck
npm run build
npm test
```

**Commit to feature branch**: "test: verify MCP functionality"

#### Sprint 6.4: Merge and Release

**Tasks**:
1. Create PR for feature branch
2. Review changes
3. Merge to main
4. Update version to 10.0.0
5. Update CHANGELOG.md
6. Publish to npm

```bash
git checkout main
git merge feature/memoryjs-extraction
npm version major  # 10.0.0
npm run build
npm publish
```

**Final Commits**:
- "chore: merge memoryjs extraction"
- "chore: bump version to 10.0.0"
- "docs: update changelog for v10.0.0"

---

## Testing Strategy

### Test Distribution

| Test Suite | Package | Count (est.) |
|------------|---------|--------------|
| Unit: core/ | memoryjs | ~150 |
| Unit: features/ | memoryjs | ~300 |
| Unit: search/ | memoryjs | ~400 |
| Unit: utils/ | memoryjs | ~200 |
| Integration (non-MCP) | memoryjs | ~100 |
| Performance | memoryjs | ~50 |
| **memoryjs Total** | memoryjs | **~1200** |
| MCP tool integration | memory-mcp | ~50 |
| MCP protocol tests | memory-mcp | ~20 |
| **memory-mcp Total** | memory-mcp | **~70** |

### Test Refactoring Approach

1. **Copy tests to memoryjs first** (don't delete from memory-mcp yet)
2. **Update imports** to use `@danielsimonjr/memoryjs`
3. **Run and fix** any failures
4. **Once green**, delete from memory-mcp
5. **Add MCP-specific tests** for tool handlers

### Continuous Integration

**memoryjs CI** (GitHub Actions):
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
      - run: npm test
```

**memory-mcp CI**: Similar, but also tests MCP protocol.

---

## Migration Checklist

### Pre-Extraction Checklist

- [ ] Create memoryjs repository at `C:\Users\danie\Dropbox\github\memoryjs`
- [ ] Initialize git, package.json, tsconfig.json
- [ ] Create feature branch in memory-mcp: `feature/memoryjs-extraction`
- [ ] Ensure all memory-mcp tests pass before starting
- [ ] Create backup/tag of current memory-mcp state

### Phase 1 Checklist (Foundation)

- [ ] Extract types/types.ts
- [ ] Extract types/index.ts
- [ ] Extract utils/errors.ts
- [ ] Extract utils/constants.ts
- [ ] Extract utils/logger.ts
- [ ] Extract utils/entityUtils.ts
- [ ] Extract utils/searchAlgorithms.ts
- [ ] Extract utils/formatters.ts
- [ ] Extract utils/schemas.ts
- [ ] Extract utils/indexes.ts
- [ ] Extract utils/searchCache.ts
- [ ] Extract utils/compressionUtil.ts
- [ ] Extract utils/compressedCache.ts
- [ ] Extract utils/operationUtils.ts
- [ ] Extract utils/parallelUtils.ts
- [ ] Extract utils/taskScheduler.ts
- [ ] Extract utils/index.ts
- [ ] Extract workers/levenshteinWorker.ts
- [ ] Extract workers/index.ts
- [ ] Create adapters/interfaces.ts
- [ ] Create adapters/index.ts
- [ ] Typecheck passes in memoryjs
- [ ] Commit all Phase 1 work

### Phase 2 Checklist (Core)

- [ ] Create adapters/storage/JsonlStorageAdapter.ts
- [ ] Create adapters/storage/SqliteStorageAdapter.ts
- [ ] Create adapters/storage/index.ts
- [ ] Create adapters/workers/NodeWorkerAdapter.ts
- [ ] Create adapters/workers/SyncWorkerAdapter.ts
- [ ] Create adapters/workers/index.ts
- [ ] Extract core/GraphStorage.ts (with adapter support)
- [ ] Extract core/GraphEventEmitter.ts
- [ ] Extract core/EntityManager.ts
- [ ] Extract core/RelationManager.ts
- [ ] Extract core/ObservationManager.ts
- [ ] Extract core/HierarchyManager.ts
- [ ] Extract core/TransactionManager.ts
- [ ] Extract core/GraphTraversal.ts
- [ ] Extract core/ManagerContext.ts (with config)
- [ ] Extract core/index.ts
- [ ] Typecheck passes
- [ ] Basic integration test works

### Phase 3 Checklist (Search)

- [ ] Extract search/BasicSearch.ts
- [ ] Extract search/SearchFilterChain.ts
- [ ] Extract search/SearchSuggestions.ts
- [ ] Extract search/SavedSearchManager.ts
- [ ] Extract search/RankedSearch.ts
- [ ] Extract search/BooleanSearch.ts
- [ ] Extract search/FuzzySearch.ts (with worker adapter)
- [ ] Extract search/TFIDFIndexManager.ts
- [ ] Extract search/TFIDFEventSync.ts
- [ ] Extract search/QueryCostEstimator.ts
- [ ] Extract search/EmbeddingService.ts
- [ ] Extract search/VectorStore.ts
- [ ] Extract search/SemanticSearch.ts
- [ ] Extract search/HybridSearchManager.ts
- [ ] Extract search/QueryAnalyzer.ts
- [ ] Extract search/QueryPlanner.ts
- [ ] Extract search/SymbolicSearch.ts
- [ ] Extract search/ReflectionManager.ts
- [ ] Extract search/SearchManager.ts
- [ ] Extract search/index.ts
- [ ] Typecheck passes

### Phase 4 Checklist (Features)

- [ ] Extract features/TagManager.ts
- [ ] Extract features/IOManager.ts
- [ ] Extract features/StreamingExporter.ts
- [ ] Extract features/AnalyticsManager.ts
- [ ] Extract features/ArchiveManager.ts
- [ ] Extract features/CompressionManager.ts
- [ ] Extract features/ObservationNormalizer.ts
- [ ] Extract features/KeywordExtractor.ts
- [ ] Extract features/index.ts
- [ ] Typecheck passes

### Phase 5 Checklist (Finalize memoryjs)

- [ ] Create src/index.ts main entry
- [ ] Copy and refactor unit tests
- [ ] Copy and refactor integration tests
- [ ] Copy and refactor performance tests
- [ ] All tests pass
- [ ] Create README.md
- [ ] Create CLAUDE.md
- [ ] Create docs/API.md
- [ ] Copy LICENSE
- [ ] Publish to npm as @danielsimonjr/memoryjs@1.0.0

### Phase 6 Checklist (Integration)

- [ ] Update memory-mcp package.json with memoryjs dependency
- [ ] Delete extracted directories from memory-mcp
- [ ] Update src/index.ts imports
- [ ] Update server/toolHandlers.ts imports
- [ ] Typecheck passes
- [ ] Build succeeds
- [ ] All MCP tests pass
- [ ] Manual verification with Claude Desktop
- [ ] Merge feature branch to main
- [ ] Update version to 10.0.0
- [ ] Update CHANGELOG.md
- [ ] Publish to npm as @danielsimonjr/memory-mcp@10.0.0

---

## Rollback Plan

### If Issues During Extraction

1. **memoryjs issues**: Simply don't publish; fix in memoryjs repo
2. **memory-mcp issues**: Stay on feature branch; don't merge to main
3. **Post-merge issues**:
   - Revert merge commit: `git revert <merge-commit>`
   - Publish patch with revert
   - Fix issues on new branch

### Maintaining Backward Compatibility

- memory-mcp 9.x remains available on npm
- Users can pin to `@danielsimonjr/memory-mcp@^9.0.0`
- No breaking changes to MCP tool API
- Only internal implementation changes

### Emergency Contacts

- GitHub Issues: https://github.com/danielsimonjr/memory-mcp/issues
- npm unpublish (within 72 hours): `npm unpublish @danielsimonjr/memoryjs@1.0.0`

---

## Sprint Task Breakdown

### Detailed Task List (JSON Format)

See accompanying files:
- `MEMORYJS_PHASE_1_TODO.json` - Foundation extraction
- `MEMORYJS_PHASE_2_TODO.json` - Core extraction
- `MEMORYJS_PHASE_3_TODO.json` - Search extraction
- `MEMORYJS_PHASE_4_TODO.json` - Features extraction
- `MEMORYJS_PHASE_5_TODO.json` - Finalization
- `MEMORYJS_PHASE_6_TODO.json` - Integration

### Estimated Timeline

| Phase | Sprints | Focus |
|-------|---------|-------|
| Phase 0 | 0.5 | Repository setup |
| Phase 1 | 1.5 | Foundation (types, utils, workers) |
| Phase 2 | 2.5 | Core (storage, managers, adapters) |
| Phase 3 | 2 | Search (all search implementations) |
| Phase 4 | 1 | Features |
| Phase 5 | 2 | Finalization and tests |
| Phase 6 | 1.5 | Integration |
| **Total** | **11** | |

### Success Criteria

1. **memoryjs**:
   - Builds without errors
   - All ~1200 tests pass
   - Published to npm
   - Documentation complete

2. **memory-mcp**:
   - Builds without errors
   - All MCP tests pass
   - All 59 tools work identically
   - Published to npm as v10.0.0

3. **Integration**:
   - memory-mcp correctly imports from memoryjs
   - No functionality regression
   - Performance maintained or improved

---

## Appendix A: File Mapping Table

| Source (memory-mcp) | Destination (memoryjs) | Notes |
|---------------------|------------------------|-------|
| src/types/types.ts | src/types/types.ts | Direct copy |
| src/types/index.ts | src/types/index.ts | Direct copy |
| src/utils/errors.ts | src/utils/errors.ts | Direct copy |
| src/utils/constants.ts | src/utils/constants.ts | Direct copy |
| src/utils/logger.ts | src/utils/logger.ts | Direct copy |
| src/utils/entityUtils.ts | src/utils/entityUtils.ts | Update imports |
| src/utils/searchAlgorithms.ts | src/utils/searchAlgorithms.ts | Direct copy |
| src/utils/formatters.ts | src/utils/formatters.ts | Update imports |
| src/utils/schemas.ts | src/utils/schemas.ts | Update imports |
| src/utils/indexes.ts | src/utils/indexes.ts | Update imports |
| src/utils/searchCache.ts | src/utils/searchCache.ts | Update imports |
| src/utils/compressionUtil.ts | src/utils/compressionUtil.ts | Direct copy |
| src/utils/compressedCache.ts | src/utils/compressedCache.ts | Update imports |
| src/utils/operationUtils.ts | src/utils/operationUtils.ts | Direct copy |
| src/utils/parallelUtils.ts | src/utils/parallelUtils.ts | Direct copy |
| src/utils/taskScheduler.ts | src/utils/taskScheduler.ts | Direct copy |
| src/utils/index.ts | src/utils/index.ts | Update exports |
| src/workers/levenshteinWorker.ts | src/workers/levenshteinWorker.ts | Direct copy |
| src/workers/index.ts | src/workers/index.ts | Direct copy |
| src/core/GraphStorage.ts | src/core/GraphStorage.ts | Refactor for adapter |
| src/core/SQLiteStorage.ts | src/adapters/storage/SqliteStorageAdapter.ts | Refactor to adapter |
| src/core/GraphEventEmitter.ts | src/core/GraphEventEmitter.ts | Direct copy |
| src/core/EntityManager.ts | src/core/EntityManager.ts | Update imports |
| src/core/RelationManager.ts | src/core/RelationManager.ts | Update imports |
| src/core/ObservationManager.ts | src/core/ObservationManager.ts | Update imports |
| src/core/HierarchyManager.ts | src/core/HierarchyManager.ts | Update imports |
| src/core/TransactionManager.ts | src/core/TransactionManager.ts | Update imports |
| src/core/GraphTraversal.ts | src/core/GraphTraversal.ts | Update imports |
| src/core/ManagerContext.ts | src/core/ManagerContext.ts | Add adapter config |
| src/core/StorageFactory.ts | (merged into adapters) | Refactored |
| src/core/index.ts | src/core/index.ts | Update exports |
| src/search/*.ts | src/search/*.ts | Update imports |
| src/features/*.ts | src/features/*.ts | Update imports |
| src/server/*.ts | (stays in memory-mcp) | MCP-specific |
| src/index.ts | (new in both) | Different entry points |

---

## Appendix B: Import Update Patterns

### Before (memory-mcp internal imports):
```typescript
import { Entity, Relation } from '../types/types.js';
import { KnowledgeGraphError } from '../utils/errors.js';
import { GraphStorage } from '../core/GraphStorage.js';
```

### After (memoryjs internal imports):
```typescript
import { Entity, Relation } from '../types/types.js';
import { KnowledgeGraphError } from '../utils/errors.js';
import { GraphStorage } from '../core/GraphStorage.js';
// Same relative paths within memoryjs
```

### After (memory-mcp importing from memoryjs):
```typescript
import {
  ManagerContext,
  Entity,
  Relation,
  KnowledgeGraphError,
  type KnowledgeGraph
} from '@danielsimonjr/memoryjs';
```

---

**Document Version**: 1.0.0
**Last Updated**: 2026-01-09
**Author**: Claude (with Daniel Simon Jr.)
