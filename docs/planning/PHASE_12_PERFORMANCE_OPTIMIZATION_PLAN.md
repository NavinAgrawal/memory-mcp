# Phase 12: Performance Optimization Plan

**Version:** 1.0.0
**Created:** 2026-01-09
**Target Version:** 10.0.0
**Source Document:** `docs/roadmap/PERFORMANCE_AND_CAPABILITIES.md`

---

## Executive Summary

Phase 12 consolidates high-impact performance optimizations from the performance roadmap into a cohesive implementation plan targeting v10.0.0. This phase focuses on **speed, efficiency, scalability, and resource optimization** to establish a solid foundation before the memoryjs/memory-mcp codebase split.

### Performance Targets

| Metric | Current (v9.9.1) | Target (v10.0.0) | Improvement |
|--------|------------------|------------------|-------------|
| Simple search latency | 50ms | 20ms | 2.5x |
| Complex search latency | 200ms | 100ms | 2x |
| Bulk entity creation (1000) | 2000ms | 500ms | 4x |
| Memory (10k entities) | 150MB | 75MB | 2x |
| Concurrent throughput | 20 qps | 100 qps | 5x |
| Duplicate detection (10k) | 8000ms | 2000ms | 4x |

### Sprint Overview

| Sprint | Focus Area | Tasks | Estimated Effort |
|--------|------------|-------|------------------|
| Sprint 1 | Foundation Performance | 5 | 12 hours |
| Sprint 2 | Parallel Processing | 4 | 16 hours |
| Sprint 3 | Search Algorithm Optimization | 4 | 12 hours |
| Sprint 4 | Query Execution Optimization | 5 | 15 hours |
| Sprint 5 | Embedding Performance | 4 | 12 hours |
| Sprint 6 | Memory Efficiency & Benchmarks | 5 | 15 hours |

**Total Estimated Effort:** 82 hours (~2-3 weeks focused development)

---

## Architecture Considerations

### memoryjs/memory-mcp Split Preparation

All Phase 12 implementations should consider the upcoming codebase split:

1. **Core Library (memoryjs)**: Performance primitives, algorithms, data structures
2. **MCP Wrapper (memory-mcp)**: Tool handlers, MCP protocol, response formatting

**Guidelines:**
- New utility classes belong in `src/utils/` or `src/search/` (future memoryjs)
- Avoid tight coupling with MCP-specific code
- Use dependency injection for storage and worker adapters
- Document public APIs clearly for future extraction

### File Organization

```
src/
├── core/                    # → memoryjs (core managers)
├── search/                  # → memoryjs (search algorithms)
│   ├── BM25Search.ts              # NEW: Sprint 3
│   ├── OptimizedInvertedIndex.ts  # NEW: Sprint 3
│   ├── HybridScorer.ts            # NEW: Sprint 3
│   ├── ParallelSearchExecutor.ts  # NEW: Sprint 2
│   ├── EarlyTerminationManager.ts # NEW: Sprint 4
│   ├── QueryPlanCache.ts          # NEW: Sprint 4
│   ├── EmbeddingCache.ts          # NEW: Sprint 5
│   ├── IncrementalIndexer.ts      # NEW: Sprint 5
│   └── QuantizedVectorStore.ts    # NEW: Sprint 6
├── features/                # → memoryjs (advanced features)
├── utils/                   # → memoryjs (shared utilities)
│   ├── WorkerPoolManager.ts       # NEW: Sprint 2
│   ├── BatchProcessor.ts          # NEW: Sprint 2
│   └── MemoryMonitor.ts           # NEW: Sprint 6
└── server/                  # → memory-mcp (MCP layer)
```

### New Environment Variables

Phase 12 introduces the following optional environment variables:

| Variable | Sprint | Default | Description |
|----------|--------|---------|-------------|
| `MEMORY_LEXICAL_ALGORITHM` | 3 | `tfidf` | Lexical search algorithm: `bm25` or `tfidf` |
| `MEMORY_BM25_K1` | 3 | `1.2` | BM25 term frequency saturation parameter |
| `MEMORY_BM25_B` | 3 | `0.75` | BM25 document length normalization parameter |
| `MEMORY_WORKER_POOL_SIZE` | 2 | `cpu_count - 1` | Max workers for parallel operations |
| `MEMORY_EMBEDDING_CACHE_SIZE` | 5 | `10000` | Max cached embeddings |
| `MEMORY_EMBEDDING_CACHE_TTL` | 5 | `3600000` | Embedding cache TTL in ms (1 hour) |
| `MEMORY_INDEX_FLUSH_THRESHOLD` | 5 | `50` | Pending updates before flush |
| `MEMORY_INDEX_FLUSH_INTERVAL` | 5 | `5000` | Index flush interval in ms |

**Note:** Add these to `CLAUDE.md` and `README.md` when implementing.

---

## Sprint 1: Foundation Performance

**Goal:** Optimize core data structure operations for O(1) lookups and efficient bulk operations.
**Effort:** 12 hours
**Impact:** 10-50x speedup for bulk operations

### Task 1.1: Set-Based Bulk Operations

**Priority:** P0 (Critical)
**File:** `src/core/EntityManager.ts`
**Effort:** 2 hours

**Problem:** Current bulk delete uses O(n) `includes()` checks per entity.

```typescript
// Current: O(m) per entity - SLOW
graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
```

**Solution:**
```typescript
// O(1) per entity - FAST
const namesToDelete = new Set(entityNames);
graph.entities = graph.entities.filter(e => !namesToDelete.has(e.name));
```

**Locations to Update:**
- `EntityManager.deleteEntities()` - bulk entity deletion
- `RelationManager.deleteRelations()` - bulk relation deletion
- `EntityManager.batchUpdate()` - batch update filtering

**Tests:**
- `tests/unit/core/EntityManager.test.ts` - add bulk delete benchmarks
- `tests/performance/bulk-operations.test.ts` - new benchmark file

**Acceptance Criteria:**
- [ ] Bulk delete (1000 entities) completes in <100ms (from 5000ms)
- [ ] All existing tests pass
- [ ] New benchmark tests added

---

### Task 1.2: Pre-computed Similarity Data

**Priority:** P0 (Critical)
**File:** `src/features/CompressionManager.ts`
**Effort:** 3 hours

**Problem:** Creates new Sets on every comparison in O(n²) duplicate detection.

**Solution:** Create `PreparedEntity` interface and pre-compute once:

```typescript
interface PreparedEntity {
  entity: Entity;
  obsSet: Set<string>;       // Pre-computed lowercase observations
  tagSet: Set<string>;       // Pre-computed tags
  nameLower: string;         // Pre-computed lowercase name
  textHash: number;          // Fast equality check via FNV-1a
}

function prepareBatch(entities: Entity[]): PreparedEntity[] {
  return entities.map(entity => ({
    entity,
    obsSet: new Set((entity.observations || []).map(o => o.toLowerCase())),
    tagSet: new Set(entity.tags || []),
    nameLower: entity.name.toLowerCase(),
    textHash: fnv1aHash([entity.name, ...(entity.observations || [])].join(' ')),
  }));
}

/**
 * FNV-1a hash function for fast string hashing.
 * Used for quick equality checks before expensive similarity calculations.
 *
 * @param text - Input string to hash
 * @returns 32-bit hash as unsigned integer
 */
function fnv1aHash(text: string): number {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime (uses 32-bit multiplication)
  }
  return hash >>> 0; // Convert to unsigned 32-bit integer
}
```

**Implementation Details:**
1. Add `PreparedEntity` interface to `src/types/types.ts`
2. Add `fnv1aHash()` function to `src/utils/entityUtils.ts`
3. Update `findDuplicates()` to use pre-computed data
4. Update `calculateSimilarity()` to accept `PreparedEntity`

**Tests:**
- Update `tests/unit/features/CompressionManager.test.ts`
- Add hash collision edge cases

**Acceptance Criteria:**
- [ ] Duplicate detection (10k entities) completes in <4000ms (from 8000ms)
- [ ] Hash function handles Unicode correctly
- [ ] Memory overhead is documented

---

### Task 1.3: Single-Load Compression

**Priority:** P1 (High)
**File:** `src/features/CompressionManager.ts`
**Effort:** 3 hours

**Problem:** Each merge operation triggers full graph reload.

**Solution:** Load once → merge all in-memory → save once:

```typescript
async compressGraph(options: CompressOptions): Promise<CompressionResult> {
  // Load graph ONCE
  const graph = await this.storage.load();

  // Find all duplicates using prepared batch
  const prepared = this.prepareBatch(graph.entities);
  const duplicates = this.findDuplicatesFromPrepared(prepared, options.threshold);

  // Merge all in-memory (no I/O per merge)
  for (const group of duplicates) {
    this.mergeInMemory(graph, group);
  }

  // Save ONCE
  await this.storage.save(graph);

  return { mergedCount: duplicates.length, ... };
}
```

**Implementation Details:**
1. Add `mergeInMemory()` private method
2. Update `compressGraph()` to batch all operations
3. Emit single event after all merges complete

**Tests:**
- Update `tests/unit/features/CompressionManager.test.ts`
- Add I/O counting test to verify single load/save

**Acceptance Criteria:**
- [ ] compressGraph (100 merges) completes in <1000ms (from 10000ms)
- [ ] Single load/save verified via test
- [ ] Event emitted after all merges

---

### Task 1.4: Enhanced NameIndex Utilization

**Priority:** P1 (High)
**Files:** `src/core/EntityManager.ts`, `src/features/TagManager.ts`
**Effort:** 2 hours

**Problem:** Several methods still use O(n) `graph.entities.find()` instead of O(1) index lookup.

**Locations to Fix:**
```typescript
// EntityManager.ts
addTags()      - line ~338: graph.entities.find() → getEntityByName()
setImportance() - line ~419: graph.entities.find() → getEntityByName()
batchUpdate()  - line ~306: entities.find() → use Map lookup

// TagManager.ts
resolveTagsForEntity() - validate entity exists via index
```

**Implementation Details:**
1. Audit all `entities.find()` calls in core managers
2. Replace with `this.storage.getEntityByName()` or Map lookups
3. Add JSDoc comments explaining O(1) complexity

**Tests:**
- Update relevant test files with performance assertions

**Acceptance Criteria:**
- [ ] Zero `entities.find()` calls remain in hot paths
- [ ] addTags (single) completes in <0.5ms (from 5ms)
- [ ] TypeScript strict mode passes

---

### Task 1.5: Foundation Performance Benchmarks

**Priority:** P1 (High)
**File:** `tests/performance/foundation-benchmarks.test.ts` (NEW)
**Effort:** 2 hours

**Purpose:** Establish baseline benchmarks for Sprint 1 optimizations.

**Benchmarks to Add:**
```typescript
describe('Foundation Performance Benchmarks', () => {
  describe('Bulk Operations', () => {
    it('should delete 1000 entities in <100ms', async () => { ... });
    it('should update 1000 entities in <200ms', async () => { ... });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicates in 10k entities in <4s', async () => { ... });
    it('should use pre-computed similarity data', async () => { ... });
  });

  describe('Compression', () => {
    it('should compress 100 merges with single I/O', async () => { ... });
  });

  describe('Index Utilization', () => {
    it('should use O(1) lookups for addTags', async () => { ... });
    it('should use O(1) lookups for setImportance', async () => { ... });
  });
});
```

**Acceptance Criteria:**
- [ ] All Sprint 1 benchmarks pass
- [ ] Benchmark results logged to console
- [ ] CI-friendly with generous thresholds

---

## Sprint 2: Parallel Processing

**Goal:** Maximize throughput via parallel execution using worker pools.
**Effort:** 16 hours
**Impact:** 2-4x throughput improvement

### Task 2.1: Worker Pool Architecture Enhancement

**Priority:** P2 (Medium)
**File:** `src/utils/WorkerPoolManager.ts` (NEW)
**Effort:** 5 hours

**Current State:** Using `@danielsimonjr/workerpool` for fuzzy search only.

**Solution:** Create unified worker pool manager for all parallelizable operations:

```typescript
import workerpool from '@danielsimonjr/workerpool';
import os from 'os';

interface WorkerPoolConfig {
  minWorkers: number;
  maxWorkers: number;
  idleTimeout: number;
  taskQueue: 'fifo' | 'priority';
}

interface TaskResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  executionTimeMs: number;
}

export class WorkerPoolManager {
  private pools: Map<string, workerpool.Pool> = new Map();
  private readonly cpuCount = os.cpus().length;
  private readonly defaultConfig: WorkerPoolConfig = {
    minWorkers: 2,
    maxWorkers: Math.max(4, this.cpuCount - 1),
    idleTimeout: 60000,
    taskQueue: 'fifo',
  };

  getPool(taskType: string, config?: Partial<WorkerPoolConfig>): workerpool.Pool {
    if (!this.pools.has(taskType)) {
      const poolConfig = { ...this.defaultConfig, ...config };
      // Create pool based on task type
      this.pools.set(taskType, this.createPool(taskType, poolConfig));
    }
    return this.pools.get(taskType)!;
  }

  async executeParallel<T, R>(
    tasks: T[],
    processor: (task: T) => Promise<R>,
    options: { maxConcurrency?: number; onProgress?: (completed: number, total: number) => void }
  ): Promise<TaskResult<R>[]> {
    // Implementation with Promise.allSettled for parallel batches
  }

  async shutdown(): Promise<void> {
    for (const pool of this.pools.values()) {
      await pool.terminate();
    }
    this.pools.clear();
  }
}
```

**Integration Points:**
- `FuzzySearch` - migrate to use WorkerPoolManager
- `CompressionManager` - parallel similarity calculations
- `EmbeddingService` - parallel batch embeddings
- `StreamingExporter` - parallel chunk processing

**Tests:**
- `tests/unit/utils/WorkerPoolManager.test.ts` (NEW)
- Test pool creation, task execution, shutdown

**Acceptance Criteria:**
- [ ] WorkerPoolManager created with configurable pools
- [ ] FuzzySearch migrated to use new manager
- [ ] Pool cleanup on process exit
- [ ] TypeScript types exported

---

### Task 2.2: Parallel Search Execution

**Priority:** P0 (Critical)
**File:** `src/search/ParallelSearchExecutor.ts` (NEW)
**Effort:** 4 hours

**Problem:** Hybrid search executes layers sequentially.

**Solution:** Execute all search layers concurrently:

```typescript
export class ParallelSearchExecutor {
  constructor(
    private semanticSearch: SemanticSearch,
    private rankedSearch: RankedSearch,
    private symbolicSearch: SymbolicSearch,
    private hybridScorer: HybridScorer,
  ) {}

  async searchParallel(
    query: string,
    options: HybridSearchOptions
  ): Promise<HybridSearchResult> {
    const startTime = Date.now();

    // Execute all search layers CONCURRENTLY
    const [semanticResults, lexicalResults, symbolicResults] = await Promise.all([
      this.semanticSearch.search(query, { limit: options.limit }),
      this.rankedSearch.search(query, options),
      this.symbolicSearch.filter(options.filters),
    ]);

    // Merge and score results
    const merged = this.hybridScorer.aggregate(
      semanticResults,
      lexicalResults,
      symbolicResults,
      options.weights
    );

    return {
      results: merged.slice(0, options.limit),
      metadata: {
        totalTimeMs: Date.now() - startTime,
        layerTimes: { semantic: ..., lexical: ..., symbolic: ... },
      },
    };
  }
}
```

**Integration:**
- Update `HybridSearchManager` to use `ParallelSearchExecutor`
- Add layer timing metrics to response

**Tests:**
- `tests/unit/search/ParallelSearchExecutor.test.ts` (NEW)
- Verify concurrent execution via timing

**Acceptance Criteria:**
- [ ] Multi-layer search completes in <100ms (from 300ms)
- [ ] Layer timing metadata included in response
- [ ] Graceful fallback if one layer fails

---

### Task 2.3: Batch Processor Utility

**Priority:** P2 (Medium)
**File:** `src/utils/BatchProcessor.ts` (NEW)
**Effort:** 4 hours

**Purpose:** Generic batch processing with parallel execution, retry logic, and progress tracking.

```typescript
interface BatchConfig {
  batchSize: number;
  maxParallelBatches: number;
  retryOnFailure: boolean;
  maxRetries: number;
  onProgress?: (completed: number, total: number) => void;
}

export class BatchProcessor {
  private readonly DEFAULT_CONFIG: BatchConfig = {
    batchSize: 100,
    maxParallelBatches: 4,
    retryOnFailure: true,
    maxRetries: 3,
  };

  async processBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    config: Partial<BatchConfig> = {}
  ): Promise<{ results: R[]; errors: BatchError[] }> {
    const cfg = { ...this.DEFAULT_CONFIG, ...config };

    // Create batches
    const batches = this.createBatches(items, cfg.batchSize);

    // Process in parallel groups with retry
    return this.executeParallelBatches(batches, processor, cfg);
  }

  private createBatches<T>(items: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      batches.push(items.slice(i, i + size));
    }
    return batches;
  }

  private async executeParallelBatches<T, R>(
    batches: T[][],
    processor: (batch: T[]) => Promise<R[]>,
    config: BatchConfig
  ): Promise<{ results: R[]; errors: BatchError[] }> {
    // Implementation with exponential backoff retry
  }
}
```

**Usage Examples:**
- Bulk entity creation with parallel batches
- Batch embedding generation
- Parallel duplicate detection across type buckets

**Tests:**
- `tests/unit/utils/BatchProcessor.test.ts` (NEW)
- Test retry logic, error handling, progress callbacks

**Acceptance Criteria:**
- [ ] BatchProcessor handles 10k items efficiently
- [ ] Retry logic with exponential backoff
- [ ] Progress callback invoked correctly
- [ ] Errors collected without failing entire batch

---

### Task 2.4: Parallel Processing Benchmarks

**Priority:** P1 (High)
**File:** `tests/performance/parallel-benchmarks.test.ts` (NEW)
**Effort:** 3 hours

**Benchmarks:**
```typescript
describe('Parallel Processing Benchmarks', () => {
  describe('Bulk Entity Creation', () => {
    it('should create 1000 entities in <500ms with parallel batches', async () => { ... });
  });

  describe('Multi-Layer Search', () => {
    it('should execute hybrid search in <100ms', async () => { ... });
    it('should show 2-3x improvement over sequential', async () => { ... });
  });

  describe('Batch Processing', () => {
    it('should process 10k items with progress tracking', async () => { ... });
  });
});
```

**Acceptance Criteria:**
- [ ] All Sprint 2 benchmarks pass
- [ ] Parallel vs sequential comparison logged
- [ ] Memory usage within bounds

---

## Sprint 3: Search Algorithm Optimization

**Goal:** Implement BM25 scoring and optimize inverted index for faster, more accurate search.
**Effort:** 12 hours
**Impact:** 2x faster lexical search, better relevance ranking

### Task 3.1: BM25 Lexical Scoring

**Priority:** P1 (High)
**File:** `src/search/BM25Search.ts` (NEW)
**Effort:** 4 hours

**Background:** BM25 (Best Matching 25) is a probabilistic ranking function that improves on TF-IDF by:
- Saturating term frequency (diminishing returns for repeated terms)
- Normalizing for document length

**Implementation:**

```typescript
interface BM25Config {
  k1: number;  // Term frequency saturation (default: 1.2)
  b: number;   // Document length normalization (default: 0.75)
}

interface BM25Index {
  docFrequencies: Map<string, number>;    // term → document count
  docLengths: Map<string, number>;         // entityName → term count
  avgDocLength: number;
  totalDocs: number;
  invertedIndex: Map<string, Set<string>>; // term → entity names
}

export class BM25Search {
  private config: BM25Config = { k1: 1.2, b: 0.75 };
  private index: BM25Index | null = null;

  buildIndex(entities: Entity[]): void {
    // Build inverted index with document frequencies
  }

  search(query: string, limit: number = 10): BM25Result[] {
    // Score entities using BM25 formula
  }

  private calculateBM25(
    tf: number,      // Term frequency in document
    df: number,      // Document frequency of term
    docLength: number,
    avgDocLength: number,
    totalDocs: number
  ): number {
    const { k1, b } = this.config;
    // IDF component
    const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);
    // TF component with saturation and length normalization
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docLength / avgDocLength));
    return idf * tfNorm;
  }

  // Required for IncrementalIndexer integration
  update(entity: Entity): void {
    // Remove old entry and re-add with new data
    this.remove(entity.name);
    this.addEntity(entity);
  }

  remove(entityName: string): boolean {
    const entityId = this.entityToId.get(entityName);
    if (entityId === undefined) return false;

    // Remove from all posting lists
    for (const [term, postings] of this.index) {
      const newPostings = postings.filter(id => id !== entityId);
      if (newPostings.length === 0) {
        this.index.delete(term);
      } else if (newPostings.length !== postings.length) {
        this.index.set(term, newPostings);
      }
    }

    // Update doc frequencies and lengths
    this.docLengths.delete(entityName);
    this.entityToId.delete(entityName);
    this.totalDocs--;
    this.recalculateAvgDocLength();
    return true;
  }

  private addEntity(entity: Entity): void {
    const id = this.entityToId.size;
    this.entityToId.set(entity.name, id);
    const terms = this.tokenize(this.entityToText(entity));
    this.docLengths.set(entity.name, terms.length);

    for (const term of terms) {
      if (!this.index.has(term)) {
        this.index.set(term, []);
        this.docFrequencies.set(term, 0);
      }
      this.index.get(term)!.push(id);
      this.docFrequencies.set(term, (this.docFrequencies.get(term) || 0) + 1);
    }
    this.totalDocs++;
    this.recalculateAvgDocLength();
  }

  private entityToText(entity: Entity): string {
    return [entity.name, entity.entityType, ...(entity.observations || [])].join(' ');
  }

  private recalculateAvgDocLength(): void {
    if (this.docLengths.size === 0) {
      this.avgDocLength = 0;
      return;
    }
    let total = 0;
    for (const len of this.docLengths.values()) total += len;
    this.avgDocLength = total / this.docLengths.size;
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .split(/\W+/)
      .filter(t => t.length > 2 && !this.isStopWord(t));
  }

  private isStopWord(term: string): boolean {
    return STOPWORDS.has(term);
  }
}

// Common English stopwords for search filtering
const STOPWORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
  'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other',
  'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
  'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way',
  'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
  'is', 'are', 'was', 'were', 'been', 'being', 'has', 'had', 'does', 'did',
]);
```

**Integration:**
- Add to `SearchManager` as alternative to TF-IDF
- Expose via environment variable `MEMORY_LEXICAL_ALGORITHM=bm25|tfidf`

**Tests:**
- `tests/unit/search/BM25Search.test.ts` (NEW)
- Compare BM25 vs TF-IDF ranking quality

**Acceptance Criteria:**
- [ ] BM25 index builds for 10k entities in <200ms
- [ ] BM25 search returns relevant results
- [ ] Configurable k1 and b parameters
- [ ] Stopword filtering included
- [ ] `remove()` method for incremental deletion
- [ ] `update()` method for incremental updates

---

### Task 3.2: Optimized Inverted Index

**Priority:** P1 (High)
**File:** `src/search/OptimizedInvertedIndex.ts` (NEW)
**Effort:** 3 hours

**Problem:** Current index uses string-based entity names (memory overhead, slow comparison).

**Solution:** Use integer IDs with typed arrays:

```typescript
export class OptimizedInvertedIndex {
  private index: Map<string, Uint32Array> = new Map();
  private entityToId: Map<string, number> = new Map();
  private idToEntity: string[] = [];

  build(entities: Entity[]): void {
    // Assign integer IDs (faster than string comparisons)
    for (let i = 0; i < entities.length; i++) {
      this.entityToId.set(entities[i].name, i);
      this.idToEntity[i] = entities[i].name;
    }

    // Build inverted index with typed arrays
    const termToEntities = new Map<string, number[]>();
    for (const entity of entities) {
      const id = this.entityToId.get(entity.name)!;
      const terms = this.extractTerms(entity);
      for (const term of terms) {
        if (!termToEntities.has(term)) {
          termToEntities.set(term, []);
        }
        termToEntities.get(term)!.push(id);
      }
    }

    // Convert to sorted typed arrays (memory efficient, fast intersection)
    for (const [term, ids] of termToEntities) {
      this.index.set(term, new Uint32Array(ids.sort((a, b) => a - b)));
    }
  }

  search(terms: string[]): string[] {
    // Intersect sorted arrays in O(n) per pair
    const resultSets = terms
      .map(t => this.index.get(t))
      .filter((arr): arr is Uint32Array => arr !== undefined);

    if (resultSets.length === 0) return [];

    // Start with smallest set for efficiency
    resultSets.sort((a, b) => a.length - b.length);

    let result = Array.from(resultSets[0]);
    for (let i = 1; i < resultSets.length; i++) {
      result = this.intersectSorted(result, resultSets[i]);
      if (result.length === 0) break; // Early termination
    }

    return result.map(id => this.idToEntity[id]);
  }

  private intersectSorted(a: number[], b: Uint32Array): number[] {
    // O(n) merge-based intersection
    const result: number[] = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        result.push(a[i]);
        i++; j++;
      } else if (a[i] < b[j]) {
        i++;
      } else {
        j++;
      }
    }
    return result;
  }

  getMemoryUsage(): { terms: number; bytesTotal: number } {
    let bytes = 0;
    for (const arr of this.index.values()) {
      bytes += arr.byteLength;
    }
    return { terms: this.index.size, bytesTotal: bytes };
  }
}
```

**Benefits:**
- 4 bytes per posting (vs 20+ bytes for string reference)
- O(n) sorted array intersection
- Early termination when intersection becomes empty

**Tests:**
- `tests/unit/search/OptimizedInvertedIndex.test.ts` (NEW)
- Memory usage comparison test

**Acceptance Criteria:**
- [ ] Index memory reduced by 50%+
- [ ] Multi-term search with sorted intersection
- [ ] Memory usage reporting method

---

### Task 3.3: Enhanced Hybrid Score Aggregation

**Priority:** P1 (High)
**File:** `src/search/HybridScorer.ts` (NEW)
**Effort:** 3 hours

**Purpose:** Improve score normalization and aggregation in hybrid search.

```typescript
interface HybridWeights {
  semantic: number;
  lexical: number;
  symbolic: number;
}

// Explicitly typed result interfaces for type safety
interface SemanticSearchResult {
  entity: Entity;
  similarity: number;
}

interface LexicalSearchResult {
  entity: Entity;
  score: number;
}

interface ScoredResult {
  entity: Entity;
  scores: { semantic: number; lexical: number; symbolic: number };
  combined: number;
  explanations?: string[]; // Optional score explanation
}

export class HybridScorer {
  private readonly DEFAULT_WEIGHTS: HybridWeights = {
    semantic: 0.4,
    lexical: 0.4,
    symbolic: 0.2,
  };

  aggregate(
    semanticResults: SemanticSearchResult[],
    lexicalResults: LexicalSearchResult[],
    symbolicResults: Entity[],
    weights: Partial<HybridWeights> = {}
  ): ScoredResult[] {
    const w = { ...this.DEFAULT_WEIGHTS, ...weights };

    // Normalize all scores to [0, 1] range (type-safe)
    const normSemantic = this.normalizeSemanticResults(semanticResults);
    const normLexical = this.normalizeLexicalResults(lexicalResults);
    // Symbolic results get score 1.0 (they passed the filter)
    const symbolicSet = new Set(symbolicResults.map(e => e.name));

    // Merge all entities
    const allEntities = new Map<string, ScoredResult>();

    // Add semantic results
    for (const r of semanticResults) {
      allEntities.set(r.entity.name, {
        entity: r.entity,
        scores: { semantic: normSemantic.get(r.entity.name) || 0, lexical: 0, symbolic: 0 },
        combined: 0,
      });
    }

    // Merge lexical results
    for (const r of lexicalResults) {
      const entry = allEntities.get(r.entity.name) || {
        entity: r.entity,
        scores: { semantic: 0, lexical: 0, symbolic: 0 },
        combined: 0,
      };
      entry.scores.lexical = normLexical.get(r.entity.name) || 0;
      allEntities.set(r.entity.name, entry);
    }

    // Mark symbolic matches
    for (const [name, entry] of allEntities) {
      if (symbolicSet.has(name)) {
        entry.scores.symbolic = 1.0;
      }
    }

    // Add symbolic-only results (passed filter but not in semantic/lexical)
    for (const entity of symbolicResults) {
      if (!allEntities.has(entity.name)) {
        allEntities.set(entity.name, {
          entity,
          scores: { semantic: 0, lexical: 0, symbolic: 1.0 },
          combined: 0,
        });
      }
    }

    // Calculate combined scores and sort
    const results = Array.from(allEntities.values());
    for (const r of results) {
      r.combined = w.semantic * r.scores.semantic +
                   w.lexical * r.scores.lexical +
                   w.symbolic * r.scores.symbolic;
    }

    return results.sort((a, b) => b.combined - a.combined);
  }

  // Type-safe normalization for semantic results
  private normalizeSemanticResults(results: SemanticSearchResult[]): Map<string, number> {
    if (results.length === 0) return new Map();

    const scores = results.map(r => ({ name: r.entity.name, score: r.similarity }));
    return this.applyMinMaxNormalization(scores);
  }

  // Type-safe normalization for lexical results
  private normalizeLexicalResults(results: LexicalSearchResult[]): Map<string, number> {
    if (results.length === 0) return new Map();

    const scores = results.map(r => ({ name: r.entity.name, score: r.score }));
    return this.applyMinMaxNormalization(scores);
  }

  // Shared min-max normalization logic
  private applyMinMaxNormalization(
    scores: Array<{ name: string; score: number }>
  ): Map<string, number> {
    const min = Math.min(...scores.map(s => s.score));
    const max = Math.max(...scores.map(s => s.score));
    const range = max - min || 1;

    return new Map(scores.map(({ name, score }) => [name, (score - min) / range]));
  }
}
```

**Integration:**
- Replace score aggregation in `HybridSearchManager`
- Update `ParallelSearchExecutor` to use `HybridScorer`

**Tests:**
- `tests/unit/search/HybridScorer.test.ts` (NEW)
- Test normalization, weight application, edge cases

**Acceptance Criteria:**
- [ ] Proper min-max normalization
- [ ] Configurable weights via options
- [ ] Score breakdown in results

---

### Task 3.4: Search Algorithm Benchmarks

**Priority:** P1 (High)
**File:** `tests/performance/search-algorithm-benchmarks.test.ts` (NEW)
**Effort:** 2 hours

**Benchmarks:**
```typescript
describe('Search Algorithm Benchmarks', () => {
  describe('BM25 vs TF-IDF', () => {
    it('should build BM25 index in <200ms for 10k entities', async () => { ... });
    it('should search BM25 index in <30ms', async () => { ... });
    it('should compare relevance quality', async () => { ... });
  });

  describe('Optimized Inverted Index', () => {
    it('should use 50% less memory than string-based index', async () => { ... });
    it('should intersect terms efficiently', async () => { ... });
  });

  describe('Hybrid Scoring', () => {
    it('should aggregate 3 layers in <10ms', async () => { ... });
  });
});
```

**Acceptance Criteria:**
- [ ] All Sprint 3 benchmarks pass
- [ ] Memory comparison logged
- [ ] Relevance quality comparison documented

---

## Sprint 4: Query Execution Optimization

**Goal:** Minimize unnecessary computation through smart query analysis and early termination.
**Effort:** 15 hours
**Impact:** 30x token efficiency, 4x faster simple queries

### Task 4.1: Enhanced Query Complexity Estimator

**Priority:** P1 (High)
**File:** `src/search/QueryCostEstimator.ts` (UPDATE)
**Effort:** 3 hours

**Current State:** Basic complexity estimation exists.

**Enhancement:** Add adaptive depth calculation inspired by SimpleMem:

```typescript
// Formula: k_dyn = k_base × (1 + δ × C_q)
// Where: k_base = 10, δ = 0.5, C_q = complexity score (0-1)

interface EnhancedComplexityFactors {
  queryLength: number;
  entityMentions: number;
  temporalReferences: number;
  multiHopIndicators: number;
  aggregationTerms: number;
  negationTerms: number;
  questionType: 'factoid' | 'list' | 'boolean' | 'comparison' | 'how' | 'why';
}

interface EnhancedComplexityEstimate {
  level: 'low' | 'medium' | 'high';
  score: number;                    // 0-1
  factors: EnhancedComplexityFactors;
  recommendedDepth: number;         // Adaptive k
  recommendedLayers: ('semantic' | 'lexical' | 'symbolic')[];
  estimatedTokens: number;
}

// Add to QueryCostEstimator
estimateWithAdaptiveDepth(query: string): EnhancedComplexityEstimate {
  const DEPTH_BASE = 10;
  const DEPTH_DELTA = 0.5;

  const factors = this.extractEnhancedFactors(query);
  const score = this.calculateScore(factors);
  const level = score < 0.33 ? 'low' : score < 0.66 ? 'medium' : 'high';

  // Adaptive depth formula
  const recommendedDepth = Math.round(DEPTH_BASE * (1 + DEPTH_DELTA * score));

  // Layer recommendations based on query type
  const recommendedLayers = this.recommendLayers(factors, score);

  return {
    level,
    score,
    factors,
    recommendedDepth,
    recommendedLayers,
    estimatedTokens: recommendedDepth * 50, // ~50 tokens per entity
  };
}
```

**Integration:**
- Update `smart_search` tool to use enhanced estimation
- Add layer recommendations to search metadata

**Tests:**
- Update `tests/unit/search/QueryCostEstimator.test.ts`
- Add adaptive depth test cases

**Acceptance Criteria:**
- [ ] Adaptive depth calculation implemented
- [ ] Layer recommendations based on query type
- [ ] Token estimation included

---

### Task 4.2: Early Termination Manager

**Priority:** P0 (Critical)
**File:** `src/search/EarlyTerminationManager.ts` (NEW)
**Effort:** 4 hours

**Purpose:** Stop search early when results are adequate, saving computation.

```typescript
interface EarlyTerminationConfig {
  adequacyThreshold: number;      // 0-1, default 0.8
  maxLayers: number;              // Max layers to try before giving up
  layerOrder: ('symbolic' | 'lexical' | 'semantic')[];
}

interface AdequacyResult {
  score: number;
  isAdequate: boolean;
  missingTerms: string[];
  coveredTerms: string[];
}

export class EarlyTerminationManager {
  private config: EarlyTerminationConfig = {
    adequacyThreshold: 0.8,
    maxLayers: 3,
    layerOrder: ['symbolic', 'lexical', 'semantic'], // Fastest first
  };

  // Constructor with dependency injection for search layers
  constructor(
    private symbolicSearch: SymbolicSearch,
    private rankedSearch: RankedSearch,
    private semanticSearch: SemanticSearch,
  ) {}

  async searchWithEarlyTermination(
    query: string,
    options: SearchOptions
  ): Promise<{ results: Entity[]; terminatedEarly: boolean; layersUsed: string[] }> {
    const results: Entity[] = [];
    const seenNames = new Set<string>();
    const layersUsed: string[] = [];

    for (const layer of this.config.layerOrder) {
      layersUsed.push(layer);

      const layerResults = await this.executeLayer(layer, query, options);
      this.addUniqueResults(layerResults, results, seenNames, options.limit);

      const adequacy = this.checkAdequacy(query, results);
      if (adequacy.isAdequate) {
        return { results, terminatedEarly: true, layersUsed };
      }
    }

    return { results, terminatedEarly: false, layersUsed };
  }

  checkAdequacy(query: string, results: Entity[]): AdequacyResult {
    const queryTerms = this.extractSignificantTerms(query);
    const resultText = results
      .flatMap(e => [e.name, ...(e.observations || [])])
      .join(' ')
      .toLowerCase();

    const coveredTerms: string[] = [];
    const missingTerms: string[] = [];

    for (const term of queryTerms) {
      if (resultText.includes(term.toLowerCase())) {
        coveredTerms.push(term);
      } else {
        missingTerms.push(term);
      }
    }

    const score = coveredTerms.length / queryTerms.length;
    return {
      score,
      isAdequate: score >= this.config.adequacyThreshold,
      missingTerms,
      coveredTerms,
    };
  }

  private extractSignificantTerms(query: string): string[] {
    // Extract non-stopword terms with length > 2
    return query
      .split(/\W+/)
      .filter(t => t.length > 2 && !this.isStopWord(t));
  }

  // Execute search on a specific layer
  private async executeLayer(
    layer: 'symbolic' | 'lexical' | 'semantic',
    query: string,
    options: SearchOptions
  ): Promise<Entity[]> {
    switch (layer) {
      case 'symbolic':
        // Fastest: metadata filtering only
        return this.symbolicSearch.filter(options.filters || {});
      case 'lexical':
        // Medium: TF-IDF/BM25 text matching
        const lexResults = await this.rankedSearch.search(query, options);
        return lexResults.map(r => r.entity);
      case 'semantic':
        // Slowest: embedding similarity
        const semResults = await this.semanticSearch.search(query, { limit: options.limit });
        return semResults.map(r => r.entity);
    }
  }

  // Add results while avoiding duplicates
  private addUniqueResults(
    newResults: Entity[],
    existing: Entity[],
    seenNames: Set<string>,
    limit: number
  ): void {
    for (const entity of newResults) {
      if (existing.length >= limit) break;
      if (!seenNames.has(entity.name)) {
        seenNames.add(entity.name);
        existing.push(entity);
      }
    }
  }

  private isStopWord(term: string): boolean {
    return STOPWORDS.has(term.toLowerCase());
  }
}
```

**Integration:**
- Add to `smart_search` implementation
- Report early termination in response metadata

**Tests:**
- `tests/unit/search/EarlyTerminationManager.test.ts` (NEW)
- Test adequacy calculation, layer ordering

**Acceptance Criteria:**
- [ ] Early termination when results are adequate
- [ ] Layers executed in cost-order (fastest first)
- [ ] Adequacy score calculation correct
- [ ] ~60% early termination rate on typical queries

---

### Task 4.3: Reflection Loop Optimization

**Priority:** P1 (High)
**File:** `src/search/ReflectionManager.ts` (UPDATE)
**Effort:** 3 hours

**Current State:** Basic reflection loop exists.

**Enhancement:** Add progressive limit increase and focused refinement:

```typescript
// Enhanced reflection with progressive limits
async retrieveWithReflection(
  query: string,
  config: ReflectionConfig = {}
): Promise<EnhancedReflectionResult> {
  const cfg = { ...this.DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const refinementHistory: RefinementStep[] = [];

  let currentQuery = query;
  let allResults: Entity[] = [];
  let round = 0;

  while (round < cfg.maxRounds) {
    round++;

    // Progressive limit: more results in later rounds
    const limit = this.calculateProgressiveLimit(round, cfg.maxRounds);

    refinementHistory.push({
      round,
      query: currentQuery,
      limit,
      timestamp: Date.now(),
    });

    const searchResults = await this.hybridSearch.search(currentQuery, { limit });
    allResults = this.mergeAndDeduplicate(allResults, searchResults);

    const adequacy = this.checkAdequacy(query, allResults, cfg.adequacyThreshold);

    if (adequacy.isAdequate && cfg.earlyTermination) {
      return {
        entities: allResults,
        isAdequate: true,
        rounds: round,
        refinementHistory,
        totalSearchTimeMs: Date.now() - startTime,
        adequacyScore: adequacy.score,
      };
    }

    if (round < cfg.maxRounds) {
      // Focused refinement based on missing information
      currentQuery = this.refineQueryFocused(query, allResults, adequacy.missingInfo);
    }
  }

  return {
    entities: allResults,
    isAdequate: false,
    rounds: round,
    refinementHistory,
    totalSearchTimeMs: Date.now() - startTime,
    adequacyScore: this.checkAdequacy(query, allResults, cfg.adequacyThreshold).score,
  };
}

private calculateProgressiveLimit(round: number, maxRounds: number): number {
  // Start with 10, increase by 10 each round
  return 10 + (round - 1) * 10;
}

private refineQueryFocused(
  originalQuery: string,
  currentResults: Entity[],
  missingInfo: string[]
): string {
  // Add missing terms to query for focused retrieval
  if (missingInfo.length === 0) return originalQuery;
  return `${originalQuery} ${missingInfo.join(' ')}`;
}
```

**Tests:**
- Update `tests/unit/search/ReflectionManager.test.ts`
- Add progressive limit tests

**Acceptance Criteria:**
- [ ] Progressive limit increase per round
- [ ] Focused query refinement based on gaps
- [ ] Refinement history in response

---

### Task 4.4: Query Plan Caching

**Priority:** P2 (Medium)
**File:** `src/search/QueryPlanCache.ts` (NEW)
**Effort:** 3 hours

**Purpose:** Cache query analysis and planning results for repeated queries.

```typescript
interface CachedQueryPlan {
  analysis: QueryAnalysisResult;
  plan: QueryPlan;
  createdAt: number;
  accessCount: number;
}

export class QueryPlanCache {
  private cache: Map<string, CachedQueryPlan> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 1000, ttlMs: number = 3600000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(query: string): CachedQueryPlan | null {
    const normalizedQuery = this.normalizeQuery(query);
    const entry = this.cache.get(normalizedQuery);

    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(normalizedQuery);
      return null;
    }

    entry.accessCount++;
    return entry;
  }

  set(query: string, analysis: QueryAnalysisResult, plan: QueryPlan): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const normalizedQuery = this.normalizeQuery(query);
    this.cache.set(normalizedQuery, {
      analysis,
      plan,
      createdAt: Date.now(),
      accessCount: 1,
    });
  }

  private normalizeQuery(query: string): string {
    // Normalize for cache key: lowercase, collapse whitespace, sort terms
    return query.toLowerCase().trim().split(/\s+/).sort().join(' ');
  }

  private evictLRU(): void {
    let minAccess = Infinity;
    let evictKey: string | null = null;

    for (const [key, entry] of this.cache) {
      if (entry.accessCount < minAccess) {
        minAccess = entry.accessCount;
        evictKey = key;
      }
    }

    if (evictKey) this.cache.delete(evictKey);
  }

  getStats(): { size: number; hitRate: number } {
    // Return cache statistics
  }
}
```

**Integration:**
- Add to `QueryPlanner` for plan caching
- Add to `QueryAnalyzer` for analysis caching

**Tests:**
- `tests/unit/search/QueryPlanCache.test.ts` (NEW)
- Test LRU eviction, TTL, normalization

**Acceptance Criteria:**
- [ ] Query plan caching with LRU eviction
- [ ] Query normalization for better cache hits
- [ ] Cache statistics reporting

---

### Task 4.5: Query Execution Benchmarks

**Priority:** P1 (High)
**File:** `tests/performance/query-execution-benchmarks.test.ts` (NEW)
**Effort:** 2 hours

**Benchmarks:**
```typescript
describe('Query Execution Benchmarks', () => {
  describe('Early Termination', () => {
    it('should terminate early for 60%+ of simple queries', async () => { ... });
    it('should complete simple queries in <50ms', async () => { ... });
  });

  describe('Reflection Loop', () => {
    it('should complete in max 3 rounds', async () => { ... });
    it('should show progressive improvement', async () => { ... });
  });

  describe('Query Plan Cache', () => {
    it('should achieve 80%+ hit rate on repeated queries', async () => { ... });
    it('should reduce planning time by 90%+ on cache hit', async () => { ... });
  });
});
```

**Acceptance Criteria:**
- [ ] All Sprint 4 benchmarks pass
- [ ] Early termination rate logged
- [ ] Cache hit rate logged

---

## Sprint 5: Embedding Performance

**Goal:** Maximize embedding operation speed through caching and incremental indexing.
**Effort:** 12 hours
**Impact:** 2-3x faster embedding operations

### Task 5.1: Query-Optimized Embedding Encoding

**Priority:** P2 (Medium)
**File:** `src/search/EmbeddingService.ts` (UPDATE)
**Effort:** 3 hours

**Enhancement:** Add query vs document prefixes for improved retrieval quality:

```typescript
// Add to EmbeddingService
private readonly QUERY_PREFIX = 'query: ';
private readonly DOCUMENT_PREFIX = 'passage: ';

async embed(text: string, mode: 'query' | 'document' = 'query'): Promise<number[]> {
  // Add prefix based on mode (improves retrieval quality for many models)
  const prefixedText = mode === 'query'
    ? `${this.QUERY_PREFIX}${text}`
    : `${this.DOCUMENT_PREFIX}${text}`;

  const embedding = await this.generateEmbedding(prefixedText);
  return this.l2Normalize(embedding);
}

async embedBatch(
  texts: string[],
  mode: 'document' = 'document',
  options: { batchSize?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<number[][]> {
  const batchSize = options.batchSize || 32;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await Promise.all(
      batch.map(text => this.embed(text, mode))
    );
    results.push(...batchEmbeddings);
    options.onProgress?.(Math.min(i + batchSize, texts.length), texts.length);
  }

  return results;
}

private l2Normalize(vector: number[]): number[] {
  let norm = 0;
  for (const v of vector) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm === 0) return vector;
  return vector.map(v => v / norm);
}
```

**Tests:**
- Update `tests/unit/search/EmbeddingService.test.ts`
- Test prefix application, normalization

**Acceptance Criteria:**
- [ ] Query prefix for search queries
- [ ] Document prefix for entity indexing
- [ ] L2 normalization for cosine similarity

---

### Task 5.2: Embedding Cache with LRU Eviction

**Priority:** P2 (Medium)
**File:** `src/search/EmbeddingCache.ts` (NEW)
**Effort:** 3 hours

**Purpose:** Cache embeddings to avoid re-computation:

```typescript
interface EmbeddingCacheEntry {
  embedding: number[];
  textHash: string;
  timestamp: number;
  accessCount: number;
}

export class EmbeddingCache {
  private cache: Map<string, EmbeddingCacheEntry> = new Map();
  private maxSize: number;
  private ttlMs: number;

  // Hit rate tracking
  private hits: number = 0;
  private misses: number = 0;

  constructor(maxSize: number = 10000, ttlMs: number = 3600000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(entityName: string, currentTextHash: string): number[] | null {
    const entry = this.cache.get(entityName);
    if (!entry) {
      this.misses++;
      return null;
    }

    // Invalidate if text changed
    if (entry.textHash !== currentTextHash) {
      this.cache.delete(entityName);
      this.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(entityName);
      this.misses++;
      return null;
    }

    this.hits++;
    entry.accessCount++;
    return entry.embedding;
  }

  set(entityName: string, embedding: number[], textHash: string): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(entityName, {
      embedding,
      textHash,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  invalidate(entityName: string): boolean {
    return this.cache.delete(entityName);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  getStats(): { size: number; memoryBytes: number; hitRate: number; hits: number; misses: number } {
    let memoryBytes = 0;
    for (const entry of this.cache.values()) {
      memoryBytes += entry.embedding.length * 4; // Float32
    }
    const totalRequests = this.hits + this.misses;
    return {
      size: this.cache.size,
      memoryBytes,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
      hits: this.hits,
      misses: this.misses,
    };
  }

  // Reset hit rate tracking (useful for benchmarks)
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
  }

  private evictLRU(): void {
    let minAccess = Infinity;
    let evictKey: string | null = null;

    for (const [key, entry] of this.cache) {
      if (entry.accessCount < minAccess) {
        minAccess = entry.accessCount;
        evictKey = key;
      }
    }

    if (evictKey) this.cache.delete(evictKey);
  }
}
```

**Integration:**
- Add to `SemanticSearch` for query embedding caching
- Add to `VectorStore` for entity embedding caching

**Tests:**
- `tests/unit/search/EmbeddingCache.test.ts` (NEW)
- Test invalidation on text change, LRU eviction

**Acceptance Criteria:**
- [ ] 80%+ cache hit rate for repeated queries
- [ ] Automatic invalidation on text change
- [ ] Memory usage tracking

---

### Task 5.3: Incremental Re-indexing

**Priority:** P2 (Medium)
**File:** `src/search/IncrementalIndexer.ts` (NEW)
**Effort:** 4 hours

**Purpose:** Queue index updates and batch-process them efficiently:

```typescript
interface PendingUpdate {
  entityName: string;
  type: 'create' | 'update' | 'delete';
  timestamp: number;
}

export class IncrementalIndexer {
  private pendingUpdates: Map<string, PendingUpdate> = new Map();
  private flushThreshold: number = 50;
  private flushIntervalMs: number = 5000;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private vectorStore: VectorStore,
    private bm25Index: BM25Search,
    private embeddingService: EmbeddingService,
    private storage: GraphStorage,
  ) {}

  queueUpdate(entityName: string, type: 'create' | 'update' | 'delete'): void {
    this.pendingUpdates.set(entityName, { entityName, type, timestamp: Date.now() });

    if (this.pendingUpdates.size >= this.flushThreshold) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  async flush(): Promise<{ processed: number; errors: number }> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.pendingUpdates.size === 0) {
      return { processed: 0, errors: 0 };
    }

    const updates = new Map(this.pendingUpdates);
    this.pendingUpdates.clear();

    // Group by operation type
    const deletes: string[] = [];
    const createOrUpdate: string[] = [];

    for (const [name, update] of updates) {
      if (update.type === 'delete') {
        deletes.push(name);
      } else {
        createOrUpdate.push(name);
      }
    }

    let errors = 0;

    // Process deletions (fast, no embedding needed)
    for (const name of deletes) {
      try {
        this.vectorStore.remove(name);
        this.bm25Index.remove(name);
      } catch {
        errors++;
      }
    }

    // Process creates/updates (batch embed for efficiency)
    if (createOrUpdate.length > 0) {
      try {
        const entities = await this.loadEntities(createOrUpdate);
        const texts = entities.map(e => this.entityToText(e));
        const embeddings = await this.embeddingService.embedBatch(texts, 'document');

        for (let i = 0; i < entities.length; i++) {
          this.vectorStore.add(entities[i].name, embeddings[i]);
          this.bm25Index.update(entities[i]);
        }
      } catch {
        errors += createOrUpdate.length;
      }
    }

    return { processed: updates.size, errors };
  }

  getPendingCount(): number {
    return this.pendingUpdates.size;
  }

  async shutdown(): Promise<void> {
    await this.flush();
  }

  // Load entities from storage by name
  private async loadEntities(names: string[]): Promise<Entity[]> {
    const graph = await this.storage.load();
    const nameSet = new Set(names);
    return graph.entities.filter(e => nameSet.has(e.name));
  }

  // Convert entity to searchable text for embedding
  private entityToText(entity: Entity): string {
    const parts = [
      entity.name,
      entity.entityType,
      ...(entity.observations || []),
      ...(entity.tags || []),
    ];
    return parts.filter(Boolean).join(' ');
  }
}
```

**Integration:**
- Hook into `EntityManager` create/update/delete events
- Add to `GraphEventEmitter` event handlers

**Tests:**
- `tests/unit/search/IncrementalIndexer.test.ts` (NEW)
- Test batching, flush threshold, timer

**Acceptance Criteria:**
- [ ] Index updates batched and flushed
- [ ] 10x faster updates vs full re-index
- [ ] Graceful shutdown with final flush

---

### Task 5.4: Embedding Performance Benchmarks

**Priority:** P1 (High)
**File:** `tests/performance/embedding-benchmarks.test.ts` (NEW)
**Effort:** 2 hours

**Benchmarks:**
```typescript
describe('Embedding Performance Benchmarks', () => {
  describe('Embedding Cache', () => {
    it('should achieve 80%+ hit rate on repeated queries', async () => { ... });
    it('should reduce query embedding time by 90%+ on cache hit', async () => { ... });
  });

  describe('Batch Embedding', () => {
    it('should embed 100 entities in <1500ms', async () => { ... });
    it('should show 3x improvement over sequential', async () => { ... });
  });

  describe('Incremental Indexing', () => {
    it('should batch 50 updates efficiently', async () => { ... });
    it('should complete batch update in <500ms', async () => { ... });
  });
});
```

**Acceptance Criteria:**
- [ ] All Sprint 5 benchmarks pass
- [ ] Cache hit rate logged
- [ ] Batch vs sequential comparison

---

## Sprint 6: Memory Efficiency & Final Benchmarks

**Goal:** Reduce memory footprint and establish comprehensive benchmarks.
**Effort:** 15 hours
**Impact:** 50% memory reduction, v10.0.0 release readiness

### Task 6.1: Vector Quantization

**Priority:** P3 (Low)
**File:** `src/search/QuantizedVectorStore.ts` (NEW)
**Effort:** 4 hours

**Purpose:** Reduce vector memory by 4x using 8-bit quantization:

```typescript
interface QuantizationConfig {
  method: 'scalar';  // Scalar quantization (8-bit)
}

export class QuantizedVectorStore {
  private vectors: Map<string, Uint8Array> = new Map();
  private metadata: Map<string, { min: number; max: number }> = new Map();

  add(name: string, vector: number[]): void {
    const { quantized, min, max } = this.quantize(vector);
    this.vectors.set(name, quantized);
    this.metadata.set(name, { min, max });
  }

  remove(name: string): boolean {
    this.metadata.delete(name);
    return this.vectors.delete(name);
  }

  search(query: number[], k: number): Array<{ name: string; score: number }> {
    const scores: Array<{ name: string; score: number }> = [];

    for (const [name, quantized] of this.vectors) {
      const score = this.asymmetricSimilarity(query, quantized, this.metadata.get(name)!);
      scores.push({ name, score });
    }

    return scores.sort((a, b) => b.score - a.score).slice(0, k);
  }

  private quantize(vector: number[]): { quantized: Uint8Array; min: number; max: number } {
    const min = Math.min(...vector);
    const max = Math.max(...vector);
    const range = max - min || 1;

    const quantized = new Uint8Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      quantized[i] = Math.round(((vector[i] - min) / range) * 255);
    }

    return { quantized, min, max };
  }

  private asymmetricSimilarity(
    query: number[],
    quantized: Uint8Array,
    meta: { min: number; max: number }
  ): number {
    // Asymmetric: full precision query, quantized database
    let dotProduct = 0, queryNorm = 0, dbNorm = 0;
    const { min, max } = meta;
    const range = max - min || 1;

    for (let i = 0; i < query.length; i++) {
      const dbValue = (quantized[i] / 255) * range + min;
      dotProduct += query[i] * dbValue;
      queryNorm += query[i] * query[i];
      dbNorm += dbValue * dbValue;
    }

    return dotProduct / (Math.sqrt(queryNorm) * Math.sqrt(dbNorm));
  }

  getMemoryUsage(): { vectors: number; bytesPerVector: number; totalBytes: number } {
    if (this.vectors.size === 0) {
      return { vectors: 0, bytesPerVector: 0, totalBytes: 0 };
    }

    const first = this.vectors.values().next().value;
    const bytesPerVector = first.byteLength + 16; // + metadata overhead

    return {
      vectors: this.vectors.size,
      bytesPerVector,
      totalBytes: this.vectors.size * bytesPerVector,
    };
  }
}
```

**Trade-offs:**
- 4x memory reduction (Float32 → Uint8)
- ~2-5% accuracy loss (acceptable for most use cases)
- Asymmetric similarity preserves query precision

**Tests:**
- `tests/unit/search/QuantizedVectorStore.test.ts` (NEW)
- Test accuracy vs full precision, memory savings

**Acceptance Criteria:**
- [ ] 4x memory reduction for vectors
- [ ] Accuracy within 95% of full precision
- [ ] Memory usage reporting

---

### Task 6.2: Enhanced Compressed Cache

**Priority:** P3 (Low)
**File:** `src/utils/compressedCache.ts` (UPDATE)
**Effort:** 3 hours

**Enhancement:** Add adaptive compression based on entry size:

```typescript
// Add to CompressedLRUCache
interface AdaptiveCompressionConfig {
  compressionThreshold: number;   // Minimum size to compress (bytes)
  compressionLevel: number;       // Brotli quality (1-11)
  adaptiveLevel: boolean;         // Adjust level based on size
}

private getCompressionLevel(size: number): number {
  if (!this.config.adaptiveLevel) {
    return this.config.compressionLevel;
  }

  // Smaller entries: faster compression (lower quality)
  // Larger entries: better compression (higher quality)
  if (size < 4096) return 4;
  if (size < 16384) return 6;
  if (size < 65536) return 8;
  return 9;
}

// Add compression statistics
getCompressionStats(): {
  totalEntries: number;
  compressedEntries: number;
  originalBytes: number;
  compressedBytes: number;
  compressionRatio: number;
} {
  let originalBytes = 0;
  let compressedBytes = 0;
  let compressedCount = 0;

  for (const entry of this.cache.values()) {
    if (entry.compressed) {
      compressedCount++;
      // Estimate original size from metadata or track it
    }
    compressedBytes += entry.data.length;
  }

  return {
    totalEntries: this.cache.size,
    compressedEntries: compressedCount,
    originalBytes,
    compressedBytes,
    compressionRatio: originalBytes > 0 ? compressedBytes / originalBytes : 1,
  };
}
```

**Tests:**
- Update `tests/unit/utils/compressedCache.test.ts`
- Test adaptive compression levels

**Acceptance Criteria:**
- [ ] Adaptive compression based on entry size
- [ ] Compression statistics reporting
- [ ] 3x memory reduction for large entries

---

### Task 6.3: Memory Usage Monitoring

**Priority:** P2 (Medium)
**File:** `src/utils/MemoryMonitor.ts` (NEW)
**Effort:** 2 hours

**Purpose:** Track memory usage across all components:

```typescript
interface ComponentMemoryUsage {
  component: string;
  heapUsed: number;
  external: number;
  estimatedBytes: number;
}

export class MemoryMonitor {
  private components: Map<string, () => number> = new Map();

  register(name: string, getSize: () => number): void {
    this.components.set(name, getSize);
  }

  unregister(name: string): void {
    this.components.delete(name);
  }

  getUsage(): {
    process: NodeJS.MemoryUsage;
    components: ComponentMemoryUsage[];
    total: number;
  } {
    const processMemory = process.memoryUsage();
    const components: ComponentMemoryUsage[] = [];
    let total = 0;

    for (const [name, getSize] of this.components) {
      const estimatedBytes = getSize();
      components.push({
        component: name,
        heapUsed: 0, // Component-specific heap tracking not available
        external: 0,
        estimatedBytes,
      });
      total += estimatedBytes;
    }

    return { process: processMemory, components, total };
  }

  formatUsage(): string {
    const usage = this.getUsage();
    const lines: string[] = [
      'Memory Usage:',
      `  Process Heap: ${this.formatBytes(usage.process.heapUsed)}`,
      `  Process RSS: ${this.formatBytes(usage.process.rss)}`,
      'Components:',
    ];

    for (const comp of usage.components) {
      lines.push(`  ${comp.component}: ${this.formatBytes(comp.estimatedBytes)}`);
    }

    lines.push(`  Total Tracked: ${this.formatBytes(usage.total)}`);
    return lines.join('\n');
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }
}

// Singleton instance
export const memoryMonitor = new MemoryMonitor();
```

**Integration:**
- Register VectorStore, EmbeddingCache, SearchCache
- Add to `get_graph_stats` response

**Tests:**
- `tests/unit/utils/MemoryMonitor.test.ts` (NEW)

**Acceptance Criteria:**
- [ ] Memory tracking for all major components
- [ ] Human-readable format output
- [ ] Integration with graph stats

---

### Task 6.4: Comprehensive v10.0.0 Benchmarks

**Priority:** P0 (Critical)
**File:** `tests/performance/v10-benchmarks.test.ts` (NEW)
**Effort:** 4 hours

**Purpose:** Comprehensive benchmark suite for v10.0.0 release validation.

```typescript
describe('v10.0.0 Performance Targets', () => {
  describe('Search Latency', () => {
    it('should complete simple search in <20ms', async () => { ... });
    it('should complete complex search in <100ms', async () => { ... });
    it('should complete hybrid search in <100ms', async () => { ... });
  });

  describe('Bulk Operations', () => {
    it('should create 1000 entities in <500ms', async () => { ... });
    it('should delete 1000 entities in <100ms', async () => { ... });
    it('should detect duplicates in 10k entities in <2s', async () => { ... });
  });

  describe('Memory Efficiency', () => {
    it('should use <75MB for 10k entities', async () => { ... });
    it('should show 4x reduction with quantized vectors', async () => { ... });
  });

  describe('Concurrent Throughput', () => {
    it('should handle 100 qps sustained', async () => { ... });
    it('should maintain <500ms p99 latency under load', async () => { ... });
  });

  describe('Token Efficiency', () => {
    it('should use <600 tokens average per query', async () => { ... });
    it('should show 60%+ early termination rate', async () => { ... });
  });
});
```

**Acceptance Criteria:**
- [ ] All v10.0.0 targets achieved
- [ ] Benchmark results documented
- [ ] CI integration for regression detection

---

### Task 6.5: Documentation and Changelog

**Priority:** P1 (High)
**Files:** Various documentation files
**Effort:** 2 hours

**Updates Required:**
1. `CHANGELOG.md` - v10.0.0 release notes
2. `README.md` - Update performance claims
3. `docs/architecture/OVERVIEW.md` - Update architecture section
4. `docs/architecture/COMPONENTS.md` - Add new components
5. `docs/roadmap/PERFORMANCE_AND_CAPABILITIES.md` - Mark phases complete

**Changelog Entry Template:**
```markdown
## [10.0.0] - 2026-XX-XX

### Performance (Phase 12)

#### Sprint 1: Foundation Performance
- Set-based bulk operations (50x faster bulk deletes)
- Pre-computed similarity data (2x faster duplicate detection)
- Single-load compression (10x I/O reduction)
- Enhanced NameIndex utilization (O(1) lookups)

#### Sprint 2: Parallel Processing
- WorkerPoolManager for unified parallel execution
- Parallel search execution (3x faster hybrid search)
- BatchProcessor utility with retry logic

#### Sprint 3: Search Algorithm Optimization
- BM25 lexical scoring (better relevance)
- Optimized inverted index (50% memory reduction)
- Enhanced hybrid score aggregation

#### Sprint 4: Query Execution Optimization
- Enhanced complexity estimation with adaptive depth
- Early termination (60%+ simple queries)
- Reflection loop optimization
- Query plan caching

#### Sprint 5: Embedding Performance
- Query-optimized encoding with prefixes
- Embedding cache with LRU eviction (80%+ hit rate)
- Incremental re-indexing (10x faster updates)

#### Sprint 6: Memory Efficiency
- Vector quantization (4x memory reduction)
- Enhanced compressed cache
- Memory usage monitoring
```

**Acceptance Criteria:**
- [ ] All documentation updated
- [ ] Changelog complete
- [ ] Version bumped to 10.0.0

---

## Implementation Schedule

### Recommended Order

| Week | Sprint | Focus |
|------|--------|-------|
| 1 | Sprint 1 | Foundation Performance |
| 1-2 | Sprint 2 | Parallel Processing |
| 2 | Sprint 3 | Search Algorithm Optimization |
| 2-3 | Sprint 4 | Query Execution Optimization |
| 3 | Sprint 5 | Embedding Performance |
| 3-4 | Sprint 6 | Memory Efficiency & Final |

### Dependencies

```
Sprint 1 (Foundation) ─────┬──────────────────────────────────┐
                           │                                  │
Sprint 2 (Parallel) ───────┼──────────────────────────────────┤
                           │                                  │
Sprint 3 (Search Algo) ────┤                                  │
                           │                                  ▼
Sprint 4 (Query Exec) ─────┼──────────────────────► Sprint 6 (Memory & Benchmarks)
                           │                                  ▲
Sprint 5 (Embedding) ──────┴──────────────────────────────────┘
```

**Key Dependencies:**
- Sprint 2 depends on Sprint 1 (bulk operations foundation)
- Sprint 4 depends on Sprint 3 (BM25 for early termination)
- Sprint 6 depends on all previous sprints (final benchmarks)

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Performance regression | Comprehensive benchmark suite |
| Breaking changes | Maintain backward compatibility in APIs |
| Memory leaks | Memory monitoring + leak detection tests |
| Worker pool issues | Graceful degradation to synchronous execution |

---

## Success Criteria

### v10.0.0 Release Requirements

- [ ] All 27 tasks completed
- [ ] All benchmark targets achieved
- [ ] 2693+ tests passing (existing + new)
- [ ] No performance regressions
- [ ] Documentation updated
- [ ] Changelog complete
- [ ] npm publish successful

### Performance Verification

```bash
# Run all v10.0.0 benchmarks
npm run benchmark

# Expected output:
# ✓ Simple search: 18ms (target: <20ms)
# ✓ Complex search: 85ms (target: <100ms)
# ✓ Bulk create (1000): 450ms (target: <500ms)
# ✓ Memory (10k): 72MB (target: <75MB)
# ✓ Concurrent throughput: 105 qps (target: >100 qps)
```

---

## Appendix: File Inventory

### New Files (Sprint 1-6)

| File | Sprint | Purpose |
|------|--------|---------|
| `src/utils/WorkerPoolManager.ts` | 2 | Unified worker pool management |
| `src/utils/BatchProcessor.ts` | 2 | Generic batch processing |
| `src/utils/MemoryMonitor.ts` | 6 | Memory usage tracking |
| `src/search/ParallelSearchExecutor.ts` | 2 | Parallel search execution |
| `src/search/BM25Search.ts` | 3 | BM25 lexical scoring |
| `src/search/OptimizedInvertedIndex.ts` | 3 | Memory-efficient index |
| `src/search/HybridScorer.ts` | 3 | Score aggregation |
| `src/search/EarlyTerminationManager.ts` | 4 | Early termination logic |
| `src/search/QueryPlanCache.ts` | 4 | Query plan caching |
| `src/search/EmbeddingCache.ts` | 5 | Embedding caching |
| `src/search/IncrementalIndexer.ts` | 5 | Incremental indexing |
| `src/search/QuantizedVectorStore.ts` | 6 | Vector quantization |

### Modified Files

| File | Sprints | Changes |
|------|---------|---------|
| `src/core/EntityManager.ts` | 1 | Set-based operations, index usage |
| `src/core/RelationManager.ts` | 1 | Set-based bulk operations |
| `src/features/CompressionManager.ts` | 1 | Pre-computed similarity, single-load |
| `src/features/TagManager.ts` | 1 | O(1) index lookups |
| `src/search/HybridSearchManager.ts` | 2, 3 | Parallel executor, scorer |
| `src/search/SearchManager.ts` | 3 | BM25 integration, algorithm selection |
| `src/search/QueryCostEstimator.ts` | 4 | Enhanced complexity estimation |
| `src/search/ReflectionManager.ts` | 4 | Progressive limits, focused refinement |
| `src/search/EmbeddingService.ts` | 5 | Query prefixes, batch embedding |
| `src/types/types.ts` | 1 | PreparedEntity interface |
| `src/utils/entityUtils.ts` | 1 | fnv1aHash function |
| `src/utils/compressedCache.ts` | 6 | Adaptive compression |

### Test Files

| File | Sprint | Coverage |
|------|--------|----------|
| `tests/performance/foundation-benchmarks.test.ts` | 1 | Foundation optimizations |
| `tests/performance/parallel-benchmarks.test.ts` | 2 | Parallel processing |
| `tests/performance/search-algorithm-benchmarks.test.ts` | 3 | Search algorithms |
| `tests/performance/query-execution-benchmarks.test.ts` | 4 | Query execution |
| `tests/performance/embedding-benchmarks.test.ts` | 5 | Embedding operations |
| `tests/performance/v10-benchmarks.test.ts` | 6 | Comprehensive v10.0.0 |

---

*Document Version: 1.0.0 | Created: 2026-01-09*
*Phase 12 targets v10.0.0 release as foundation for memoryjs/memory-mcp split*
