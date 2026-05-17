# Performance & Optimization Roadmap

**Version:** 3.2.3
**Last Updated:** 2026-05-17
**Current Version:** 12.4.1
**Target Version:** 13.0.0

**v12.3.0–12.3.1 update (Phase 16):** 53 new MCP tool surfaces for the v2.1.x
memoryjs additions — Tool Affordance + Observer (11), Heuristic Guidelines (10),
Project Context (12), Decision Rationale (10), `do_not_remember` / Exclusion (5),
Observation Dedup (2), Spell Correction (3). All 213 tools have e2e handler
tests under `tests/e2e/tools/`. v12.3.1 ships the dependabot security bumps
(`fast-uri` 3.1.2, `hono` 4.12.18, `ip-address` + `express-rate-limit`), the
`zod 3.x → 4.x` realignment with memoryjs, the `vitest 4.0.17 → 4.1.6`
worker-bootstrap fix, and the upstream `memoryjs@2.1.1` bump that resolves the
`UpdateEntitySchema` strict-mode bug blocking subclass-manager update paths.

---

## Executive Summary

This document defines the performance optimization roadmap for memory-mcp. All content focuses on **speed, efficiency, scalability, and resource optimization** - not new features or tools.

*Note: This is a **parallel development track** to `FUTURE_FEATURES.md`. Both documents use Phase 6+ numbering independently. Performance phases can be implemented alongside or after feature phases.*

**Performance Targets:**
| Metric | Current (v9.8.3) | Target (v12.0) | Improvement |
|--------|------------------|----------------|-------------|
| Simple search latency | 50ms | 20ms | 2.5x |
| Complex search latency | 200ms | 100ms | 2x |
| Token efficiency | 1x | 30x | 30x |
| Memory (10k entities) | 150MB | 75MB | 2x |
| Concurrent throughput | 20 qps | 100 qps | 5x |
| Bulk entity creation (1000) | 2000ms | 500ms | 4x |

**Benchmarks Inspiration** (SimpleMem research):
| Metric | SimpleMem | Mem0 | Improvement |
|--------|-----------|------|-------------|
| Construction Time | 92.6s | 1350.9s | 14.6x faster |
| Retrieval Time | 388.3s | 583.4s | 1.5x faster |
| Token Usage | ~550 | ~3000+ | 30x reduction |

---

## Table of Contents

1. [Completed Optimizations](#completed-optimizations)
2. [Phase 6: Foundation Performance](#phase-6-foundation-performance)
3. [Phase 7: Parallel Processing](#phase-7-parallel-processing)
4. [Phase 8: Search Algorithm Optimization](#phase-8-search-algorithm-optimization)
5. [Phase 9: Query Execution Optimization](#phase-9-query-execution-optimization)
6. [Phase 10: Embedding Performance](#phase-10-embedding-performance)
7. [Phase 11: Memory Efficiency](#phase-11-memory-efficiency)
8. [Phase 12: Adaptive Performance](#phase-12-adaptive-performance)
9. [Phase 13: New MCP Tools for memoryjs v1.8.0 + v1.9.0](#phase-13-new-mcp-tools-for-memoryjs-v180--v190)
10. [Phase 14: Cognitive Core, Maintenance Intelligence, Multi-Agent (memoryjs v1.7.0)](#phase-14-cognitive-core-maintenance-intelligence-multi-agent-memoryjs-v170)
11. [Phase 15: memoryjs v1.14+ — Bitemporal, OCC, RBAC, Procedural, Causal, World Model](#phase-15-memoryjs-v114--bitemporal-occ-rbac-procedural-causal-world-model)
12. [Implementation Priority Matrix](#implementation-priority-matrix)
13. [Benchmark Suite](#benchmark-suite)

---

## Completed Optimizations

### Phases 1-15 Status (audited 2026-04-26 against current code)

All Phase 6-15 deliverables verified present in `@danielsimonjr/memoryjs` and surfaced through the v12.2.0 MCP tool inventory. **Phases 1-15 are all complete or partial as noted.**

| Phase | Optimization | Status | Verification |
|-------|--------------|--------|-----------------|
| **Phase 1** | SQLite indexes, bidirectional cache, lazy loading | ✅ SHIPPED | O(log n) range queries |
| **Phase 2** | Search caching (Fuzzy, Boolean, Ranked, Pagination) | ✅ SHIPPED | 60-90% faster repeated queries |
| **Phase 3** | Graph algorithms (BFS, DFS, shortest path, centrality) | ✅ SHIPPED | `src/core/GraphTraversal.ts` |
| **Phase 4** | Brotli compression (backup, export, response) | ✅ SHIPPED | 70% storage reduction |
| **Phase 5** | Semantic search (OpenAI + Local embeddings) | ✅ SHIPPED | AI-powered similarity |
| **Phase 6** | Foundation: bulk ops, pre-computed similarity, single-load compression | ✅ SHIPPED | Set-based bulk in `EntityManager` / `RelationManager` |
| **Phase 7** | Parallel processing: worker pool + parallel search + parallel batch | ✅ SHIPPED | `src/utils/WorkerPoolManager.ts` + `src/search/ParallelSearchExecutor.ts` |
| **Phase 8** | Search algorithm: BM25, OptimizedInvertedIndex, HybridScorer | ✅ SHIPPED | `src/search/{BM25Search, OptimizedInvertedIndex, HybridScorer}.ts` |
| **Phase 9** | Query execution: cost estimator, early termination, reflection optimization | ✅ SHIPPED | `src/search/{QueryCostEstimator, EarlyTerminationManager, ReflectionManager}.ts` |
| **Phase 10** | Embedding performance: query-optimized encoding + LRU cache + incremental re-indexing | ✅ SHIPPED | `src/search/{EmbeddingCache, IncrementalIndexer}.ts` |
| **Phase 11** | Memory efficiency: vector quantization + compressed LRU | ✅ SHIPPED | `src/search/QuantizedVectorStore.ts` (HNSW indexing remains future work — see FUTURE_FEATURES.md Phase 10) |
| **Phase 12** | Adaptive performance: auto-tuning + graph-aware optimization | ✅ SHIPPED | `src/search/QueryPlanCache.ts` + plan reuse |
| **Phase 13** | New MCP tools for memoryjs v1.8.0 + v1.9.0 (project scoping, versioning, forget, profiles, temporal KG, ingestion, diary) | ✅ SHIPPED in **v12.1.0** | 12 tools — see [`CHANGELOG.md`](../../CHANGELOG.md) [12.1.0] |
| **Phase 14** | Cognitive core, maintenance intelligence, decay/salience, multi-agent, observability (memoryjs v1.7.0) | ✅ SHIPPED (commit `bbe40ae6`; retroactively summarised in v12.2.0 CHANGELOG) | 31 tools — see Phase 14 section below |
| **Phase 15** | memoryjs v1.14+ — bitemporal validity, OCC, RBAC, procedural memory, active retrieval, causal reasoning, world model | ✅ SHIPPED in **v12.2.0** (2026-04-26) | 23 tools + extensions to `export_graph` / `create_entities` / `set_memory_visibility` |

### Current Performance Baseline (v9.8.3)

| Operation | Current Performance |
|-----------|---------------------|
| Entity lookup by name | O(1) via NameIndex |
| Entity lookup by type | O(1) via TypeIndex |
| Relation lookup | O(1) via RelationIndex |
| Fuzzy search (cached) | <1ms |
| Boolean search (cached) | <5ms |
| Semantic search (10k entities) | ~200ms |
| Startup (10k entities, SQLite) | ~50ms |
| Backup compression ratio | 70% |

---

## Phase 6: Foundation Performance ✅ SHIPPED

**Goal**: Optimize core data structure operations.
**Effort**: 10 hours | **Impact**: 10-50x speedup for specific operations

### 6.1 Set-Based Bulk Operations

**File**: `src/core/EntityManager.ts`

**Current**: O(n) `includes()` checks in bulk operations.

```typescript
// Current: O(m) per entity - SLOW
graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
```

**Optimized**:
```typescript
// O(1) per entity - FAST
const namesToDelete = new Set(entityNames);
graph.entities = graph.entities.filter(e => !namesToDelete.has(e.name));
```

**Impact**: 10-50x speedup for bulk deletes (500+ entities)

### 6.2 Pre-computed Similarity Data

**File**: `src/features/CompressionManager.ts`

**Issue**: Creates Sets on every comparison in O(n²) duplicate detection.

**Solution**:
```typescript
interface PreparedEntity {
  entity: Entity;
  obsSet: Set<string>;       // Pre-computed lowercase observations
  tagSet: Set<string>;       // Pre-computed tags
  nameLower: string;         // Pre-computed lowercase name
  textHash: number;          // Fast equality check
}

// Pre-compute once, compare many times
function prepareBatch(entities: Entity[]): PreparedEntity[] {
  return entities.map(entity => ({
    entity,
    obsSet: new Set(entity.observations.map(o => o.toLowerCase())),
    tagSet: new Set(entity.tags || []),
    nameLower: entity.name.toLowerCase(),
    textHash: hashText([entity.name, ...entity.observations].join(' ')),
  }));
}
```

**Impact**: 1.5-2x speedup for duplicate detection

### 6.3 Single-Load Compression

**Current**: Each merge triggers graph reload.

**Solution**: Load once → merge all → save once.

```typescript
async compressGraph(options: CompressOptions): Promise<CompressionResult> {
  // Load graph ONCE
  const graph = await this.storage.load();

  // Find all duplicates
  const duplicates = this.findDuplicates(graph.entities, options.threshold);

  // Merge all in-memory (no I/O)
  for (const group of duplicates) {
    this.mergeInMemory(graph, group);
  }

  // Save ONCE
  await this.storage.save(graph);
}
```

**Impact**: 10x I/O reduction for large compression operations

### 6.4 Enhanced NameIndex Usage

Replace `graph.entities.find()` with O(1) `getEntityByName()` throughout codebase.

**Locations to fix**:
- `addTags()` line 338-339
- `setImportance()` line 419-420
- `batchUpdate()` line 306

**Impact**: O(n) → O(1) for entity existence checks

### 6.5 Performance Metrics

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Bulk delete (1000) | 5000ms | 100ms | 50x |
| Duplicate detection (10k) | 8000ms | 4000ms | 2x |
| compressGraph (100 merges) | 10000ms | 1000ms | 10x |
| addTags (single) | 5ms | 0.1ms | 50x |

---

## Phase 7: Parallel Processing ✅ SHIPPED

`src/utils/WorkerPoolManager.ts` + `src/search/ParallelSearchExecutor.ts`.

**Goal**: Maximize throughput via parallel execution.
**Effort**: 20 hours | **Impact**: 2-4x throughput improvement

### 7.1 Worker Pool Architecture

**Inspired by**: SimpleMem's ThreadPoolExecutor-based parallel processing.

**File**: `src/core/WorkerPoolManager.ts`

```typescript
import { Worker } from 'worker_threads';
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

class WorkerPoolManager {
  private pools: Map<string, WorkerPool> = new Map();
  private readonly cpuCount = os.cpus().length;

  getPool(taskType: string, config?: Partial<WorkerPoolConfig>): WorkerPool {
    if (!this.pools.has(taskType)) {
      this.pools.set(taskType, new WorkerPool({
        minWorkers: 2,
        maxWorkers: Math.max(4, this.cpuCount - 1),
        idleTimeout: 60000,
        taskQueue: 'fifo',
        ...config,
      }));
    }
    return this.pools.get(taskType)!;
  }

  async executeParallel<T, R>(
    tasks: T[],
    processor: (task: T) => Promise<R>,
    options: { maxConcurrency?: number; onProgress?: (completed: number, total: number) => void }
  ): Promise<TaskResult<R>[]> {
    const { maxConcurrency = this.cpuCount, onProgress } = options;
    const results: TaskResult<R>[] = [];
    let completed = 0;

    for (let i = 0; i < tasks.length; i += maxConcurrency) {
      const batch = tasks.slice(i, i + maxConcurrency);
      const batchStart = Date.now();

      const batchResults = await Promise.allSettled(
        batch.map(async (task) => {
          const taskStart = Date.now();
          const result = await processor(task);
          return { success: true, result, executionTimeMs: Date.now() - taskStart };
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({ success: false, error: result.reason, executionTimeMs: Date.now() - batchStart });
        }
        completed++;
        onProgress?.(completed, tasks.length);
      }
    }

    return results;
  }
}
```

### 7.2 Parallel Search Execution

**File**: `src/search/ParallelSearchExecutor.ts`

```typescript
class ParallelSearchExecutor {
  async searchParallel(
    query: string,
    options: HybridSearchOptions
  ): Promise<HybridSearchResult[]> {
    const startTime = Date.now();

    // Execute all search layers CONCURRENTLY
    const [semanticResults, lexicalResults, symbolicResults] = await Promise.all([
      this.semanticSearch.search(query, options.limit),
      this.rankedSearch.search(query, options),
      this.filterChain.execute(options.filters),
    ]);

    // Merge and score results
    const merged = this.mergeResults(semanticResults, lexicalResults, symbolicResults, options.weights);

    return {
      results: merged,
      metadata: { totalTimeMs: Date.now() - startTime },
    };
  }
}
```

### 7.3 Parallel Batch Operations

**File**: `src/core/BatchProcessor.ts`

```typescript
class BatchProcessor {
  private readonly DEFAULT_CONFIG = {
    batchSize: 100,
    maxParallelBatches: 4,
    retryOnFailure: true,
    maxRetries: 3,
  };

  async processBatches<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    config: Partial<BatchConfig> = {}
  ): Promise<{ results: R[]; errors: Error[] }> {
    const { batchSize, maxParallelBatches, retryOnFailure, maxRetries } = {
      ...this.DEFAULT_CONFIG,
      ...config,
    };

    const results: R[] = [];
    const errors: Error[] = [];

    // Create batches
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    // Process batches in parallel groups
    for (let i = 0; i < batches.length; i += maxParallelBatches) {
      const parallelBatches = batches.slice(i, i + maxParallelBatches);

      const batchPromises = parallelBatches.map(async (batch) => {
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= (retryOnFailure ? maxRetries : 0); attempt++) {
          try {
            return await processor(batch);
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) {
              await this.sleep(Math.pow(2, attempt) * 100);
            }
          }
        }
        throw lastError;
      });

      const batchResults = await Promise.allSettled(batchPromises);
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          errors.push(result.reason);
        }
      }
    }

    return { results, errors };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 7.4 Performance Metrics

| Operation | Before | After (Parallel) | Improvement |
|-----------|--------|------------------|-------------|
| Bulk entity creation (1000) | 2000ms | 500ms | 4x |
| Full graph indexing | 5000ms | 1500ms | 3.3x |
| Multi-layer search | 300ms | 100ms | 3x |
| Duplicate detection (10k) | 8000ms | 2000ms | 4x |

---

## Phase 8: Search Algorithm Optimization ✅ SHIPPED

`src/search/{BM25Search, OptimizedInvertedIndex, HybridScorer}.ts`.

**Goal**: Optimize search algorithms for speed and accuracy.
**Effort**: 15 hours | **Impact**: 2x faster lexical search

### 8.1 BM25 Lexical Scoring

**Inspired by**: SimpleMem's BM25-style keyword scoring.

**File**: `src/search/BM25Search.ts`

```typescript
interface BM25Config {
  k1: number;      // Term frequency saturation (default: 1.2)
  b: number;       // Document length normalization (default: 0.75)
}

interface BM25Index {
  docFrequencies: Map<string, number>;
  docLengths: Map<string, number>;
  avgDocLength: number;
  totalDocs: number;
  invertedIndex: Map<string, Set<string>>;
}

class BM25Search {
  private config: BM25Config = { k1: 1.2, b: 0.75 };
  private index: BM25Index | null = null;

  buildIndex(entities: Entity[]): void {
    const docFrequencies = new Map<string, number>();
    const docLengths = new Map<string, number>();
    const invertedIndex = new Map<string, Set<string>>();
    let totalLength = 0;

    for (const entity of entities) {
      const text = this.entityToText(entity);
      const terms = this.tokenize(text);
      const uniqueTerms = new Set(terms);

      docLengths.set(entity.name, terms.length);
      totalLength += terms.length;

      for (const term of uniqueTerms) {
        docFrequencies.set(term, (docFrequencies.get(term) || 0) + 1);
        if (!invertedIndex.has(term)) {
          invertedIndex.set(term, new Set());
        }
        invertedIndex.get(term)!.add(entity.name);
      }
    }

    this.index = {
      docFrequencies,
      docLengths,
      avgDocLength: totalLength / entities.length,
      totalDocs: entities.length,
      invertedIndex,
    };
  }

  private calculateBM25(
    tf: number, df: number, docLength: number, avgDocLength: number, totalDocs: number
  ): number {
    const { k1, b } = this.config;
    const idf = Math.log((totalDocs - df + 0.5) / (df + 0.5) + 1);
    const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docLength / avgDocLength));
    return idf * tfNorm;
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  }
}
```

### 8.2 Optimized Inverted Index

**File**: `src/search/OptimizedInvertedIndex.ts`

```typescript
class OptimizedInvertedIndex {
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

    // Convert to typed arrays (memory efficient, fast iteration)
    for (const [term, ids] of termToEntities) {
      this.index.set(term, new Uint32Array(ids.sort((a, b) => a - b)));
    }
  }

  search(terms: string[]): string[] {
    const resultSets = terms
      .map(t => this.index.get(t))
      .filter(Boolean) as Uint32Array[];

    if (resultSets.length === 0) return [];

    // Intersect sorted arrays (O(n) per pair)
    let result = Array.from(resultSets[0]);
    for (let i = 1; i < resultSets.length; i++) {
      result = this.intersectSorted(result, resultSets[i]);
    }

    return result.map(id => this.idToEntity[id]);
  }

  private intersectSorted(a: number[], b: Uint32Array): number[] {
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
}
```

### 8.3 Hybrid Score Aggregation

**File**: `src/search/HybridScorer.ts`

```typescript
class HybridScorer {
  private readonly DEFAULT_WEIGHTS = { semantic: 0.5, lexical: 0.3, symbolic: 0.2 };

  aggregate(
    semanticResults: SemanticSearchResult[],
    lexicalResults: BM25Result[],
    symbolicResults: SymbolicResult[],
    weights: Partial<HybridWeights> = {}
  ): HybridSearchResult[] {
    const w = { ...this.DEFAULT_WEIGHTS, ...weights };

    // Normalize scores to [0, 1]
    const normSemantic = this.minMaxNormalize(semanticResults.map(r => ({ name: r.entity.name, score: r.similarity })));
    const normLexical = this.minMaxNormalize(lexicalResults.map(r => ({ name: r.entity.name, score: r.score })));
    const normSymbolic = this.minMaxNormalize(symbolicResults.map(r => ({ name: r.entity.name, score: r.score })));

    // Merge all entities
    const allEntities = new Map<string, { entity: Entity; semantic: number; lexical: number; symbolic: number }>();

    for (const r of semanticResults) {
      allEntities.set(r.entity.name, {
        entity: r.entity,
        semantic: normSemantic.get(r.entity.name) || 0,
        lexical: 0,
        symbolic: 0,
      });
    }

    for (const r of lexicalResults) {
      const entry = allEntities.get(r.entity.name) || { entity: r.entity, semantic: 0, lexical: 0, symbolic: 0 };
      entry.lexical = normLexical.get(r.entity.name) || 0;
      allEntities.set(r.entity.name, entry);
    }

    for (const r of symbolicResults) {
      const entry = allEntities.get(r.entity.name) || { entity: r.entity, semantic: 0, lexical: 0, symbolic: 0 };
      entry.symbolic = normSymbolic.get(r.entity.name) || 0;
      allEntities.set(r.entity.name, entry);
    }

    // Calculate combined scores and sort
    return Array.from(allEntities.values())
      .map(({ entity, semantic, lexical, symbolic }) => ({
        entity,
        scores: { semantic, lexical, symbolic },
        combined: w.semantic * semantic + w.lexical * lexical + w.symbolic * symbolic,
      }))
      .sort((a, b) => b.combined - a.combined);
  }

  private minMaxNormalize(scores: Array<{ name: string; score: number }>): Map<string, number> {
    if (scores.length === 0) return new Map();
    const min = Math.min(...scores.map(s => s.score));
    const max = Math.max(...scores.map(s => s.score));
    const range = max - min || 1;
    return new Map(scores.map(({ name, score }) => [name, (score - min) / range]));
  }
}
```

### 8.4 Performance Metrics

| Operation | TF-IDF Only | BM25 | Improvement |
|-----------|-------------|------|-------------|
| Lexical search (10k) | 50ms | 30ms | 1.7x |
| Index build | 200ms | 150ms | 1.3x |
| Memory usage | 20MB | 15MB | 25% reduction |

---

## Phase 9: Query Execution Optimization ✅ SHIPPED

`src/search/{QueryCostEstimator, EarlyTerminationManager, ReflectionManager}.ts`.

**Goal**: Minimize unnecessary computation through smart query planning.
**Effort**: 20 hours | **Impact**: 30x token efficiency

### 9.1 Query Complexity Estimator

**Inspired by**: SimpleMem's complexity-aware adaptive depth formula: `k_dyn = k_base × (1 + δ × C_q)`

**File**: `src/search/ComplexityEstimator.ts`

```typescript
interface ComplexityFactors {
  queryLength: number;
  entityMentions: number;
  temporalReferences: number;
  multiHopIndicators: number;
  aggregationTerms: number;
  negationTerms: number;
}

interface ComplexityEstimate {
  level: 'low' | 'medium' | 'high';
  score: number;                    // 0-1
  factors: ComplexityFactors;
  recommendedDepth: number;         // Suggested retrieval limit
  estimatedTokens: number;          // Expected context tokens
}

class ComplexityEstimator {
  private readonly DEPTH_BASE = 10;
  private readonly DEPTH_DELTA = 0.5;

  estimate(query: string): ComplexityEstimate {
    const factors = this.extractFactors(query);
    const score = this.calculateScore(factors);
    const level = score < 0.33 ? 'low' : score < 0.66 ? 'medium' : 'high';

    // Adaptive depth: k_dyn = k_base × (1 + δ × C_q)
    const recommendedDepth = Math.round(this.DEPTH_BASE * (1 + this.DEPTH_DELTA * score));

    return {
      level,
      score,
      factors,
      recommendedDepth,
      estimatedTokens: recommendedDepth * 50, // ~50 tokens per entity
    };
  }

  private extractFactors(query: string): ComplexityFactors {
    return {
      queryLength: query.split(/\s+/).length,
      entityMentions: (query.match(/\b[A-Z][a-z]+\b/g) || []).length,
      temporalReferences: (query.match(/\b(yesterday|today|tomorrow|last|next|before|after|week|month|year)\b/gi) || []).length,
      multiHopIndicators: (query.match(/\b(through|via|connected|related|between|both|all)\b/gi) || []).length,
      aggregationTerms: (query.match(/\b(how many|count|total|sum|average|most|least)\b/gi) || []).length,
      negationTerms: (query.match(/\b(not|never|without|except|exclude)\b/gi) || []).length,
    };
  }

  private calculateScore(factors: ComplexityFactors): number {
    const weights = {
      queryLength: 0.1,
      entityMentions: 0.2,
      temporalReferences: 0.15,
      multiHopIndicators: 0.25,
      aggregationTerms: 0.15,
      negationTerms: 0.15,
    };

    let score = 0;
    score += Math.min(factors.queryLength / 20, 1) * weights.queryLength;
    score += Math.min(factors.entityMentions / 5, 1) * weights.entityMentions;
    score += Math.min(factors.temporalReferences / 3, 1) * weights.temporalReferences;
    score += Math.min(factors.multiHopIndicators / 2, 1) * weights.multiHopIndicators;
    score += Math.min(factors.aggregationTerms / 2, 1) * weights.aggregationTerms;
    score += Math.min(factors.negationTerms / 2, 1) * weights.negationTerms;

    return Math.min(score, 1);
  }
}
```

### 9.2 Early Termination

**File**: `src/search/EarlyTermination.ts`

```typescript
class EarlyTerminationManager {
  async searchWithEarlyTermination(
    query: string,
    options: { maxResults: number; adequacyThreshold: number }
  ): Promise<Entity[]> {
    const results: Entity[] = [];
    const seenNames = new Set<string>();

    // Try fastest layer first (symbolic/cached)
    const symbolicResults = await this.symbolicSearch(query);
    this.addResults(symbolicResults, results, seenNames, options.maxResults);

    if (this.checkAdequacy(query, results) >= options.adequacyThreshold) {
      return results; // EARLY TERMINATION
    }

    // Try lexical layer
    const lexicalResults = await this.lexicalSearch(query);
    this.addResults(lexicalResults, results, seenNames, options.maxResults);

    if (this.checkAdequacy(query, results) >= options.adequacyThreshold) {
      return results; // EARLY TERMINATION
    }

    // Finally, try expensive semantic layer
    const semanticResults = await this.semanticSearch(query);
    this.addResults(semanticResults, results, seenNames, options.maxResults);

    return results;
  }

  private checkAdequacy(query: string, results: Entity[]): number {
    const queryTerms = new Set(query.toLowerCase().split(/\s+/).filter(t => t.length > 2));
    const resultText = results.map(e => [e.name, ...e.observations || []].join(' ').toLowerCase()).join(' ');

    let coveredTerms = 0;
    for (const term of queryTerms) {
      if (resultText.includes(term)) coveredTerms++;
    }
    return coveredTerms / queryTerms.size;
  }
}
```

### 9.3 Reflection Loop Optimization

**File**: `src/search/ReflectionOptimizer.ts`

```typescript
class ReflectionOptimizer {
  private readonly DEFAULT_CONFIG = {
    maxRounds: 3,
    adequacyThreshold: 0.8,
    earlyTermination: true,
  };

  async retrieveWithReflection(query: string, config: Partial<ReflectionConfig> = {}): Promise<ReflectionResult> {
    const cfg = { ...this.DEFAULT_CONFIG, ...config };
    const startTime = Date.now();
    const refinementHistory: string[] = [];

    let currentQuery = query;
    let allResults: Entity[] = [];
    let round = 0;

    while (round < cfg.maxRounds) {
      round++;
      refinementHistory.push(currentQuery);

      const searchResults = await this.hybridSearch.search(currentQuery, {
        limit: this.calculateLimit(round, cfg.maxRounds),
      });

      allResults = this.mergeAndDeduplicate(allResults, searchResults);
      const adequacy = this.checkAdequacy(query, allResults, cfg.adequacyThreshold);

      if (adequacy.isAdequate && cfg.earlyTermination) {
        return {
          entities: allResults,
          isAdequate: true,
          rounds: round,
          refinementHistory,
          totalSearchTimeMs: Date.now() - startTime,
        };
      }

      if (round < cfg.maxRounds) {
        currentQuery = this.refineQuery(query, allResults, adequacy.missingInfo);
      }
    }

    return {
      entities: allResults,
      isAdequate: false,
      rounds: round,
      refinementHistory,
      totalSearchTimeMs: Date.now() - startTime,
    };
  }

  private calculateLimit(round: number, maxRounds: number): number {
    return 10 * round; // Increase limit in later rounds
  }
}
```

### 9.4 Performance Metrics

| Metric | Without Optimization | With Optimization | Improvement |
|--------|----------------------|-------------------|-------------|
| Token usage | ~3000 | ~550 | 5.5x reduction |
| Search calls | 1 (exhaustive) | 1-3 (targeted) | Focused |
| Latency (simple) | 200ms | 50ms | 4x faster |
| Early termination rate | 0% | 60% | 60% queries |

---

## Phase 10: Embedding Performance ✅ SHIPPED

`src/search/{EmbeddingCache, IncrementalIndexer}.ts`.

**Goal**: Maximize embedding operation speed.
**Effort**: 15 hours | **Impact**: 2-3x faster embedding operations

### 10.1 Query-Optimized Encoding

**Inspired by**: SimpleMem's query-vs-document encoding with prefixes.

**File**: `src/search/OptimizedEmbeddingService.ts`

```typescript
class OptimizedEmbeddingService {
  private queryPrefix = 'query: ';
  private documentPrefix = 'passage: ';

  async embed(text: string, mode: 'query' | 'document' = 'query'): Promise<number[]> {
    // Add prefix based on mode (improves retrieval quality)
    const prefixedText = mode === 'query'
      ? `${this.queryPrefix}${text}`
      : `${this.documentPrefix}${text}`;

    const embedding = await this.generateEmbedding(prefixedText);
    return this.l2Normalize(embedding);
  }

  async embedBatch(texts: string[], mode: 'document' = 'document'): Promise<number[][]> {
    const batchSize = 32;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(batch.map(text => this.embed(text, mode)));
      results.push(...batchEmbeddings);
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
}
```

### 10.2 Embedding Cache with LRU Eviction

**File**: `src/search/EmbeddingCache.ts`

```typescript
interface CacheEntry {
  embedding: number[];
  timestamp: number;
  accessCount: number;
  textHash: string;
}

class EmbeddingCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 10000, ttlMs: number = 3600000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(entityName: string, textHash: string): number[] | null {
    const entry = this.cache.get(entityName);
    if (!entry) return null;

    // Check if text changed (invalidate stale embedding)
    if (entry.textHash !== textHash) {
      this.cache.delete(entityName);
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(entityName);
      return null;
    }

    entry.accessCount++;
    return entry.embedding;
  }

  set(entityName: string, embedding: number[], textHash: string): void {
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    this.cache.set(entityName, { embedding, timestamp: Date.now(), accessCount: 1, textHash });
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

### 10.3 Incremental Re-indexing

**File**: `src/search/IncrementalIndexer.ts`

```typescript
class IncrementalIndexer {
  private pendingUpdates: Map<string, 'create' | 'update' | 'delete'> = new Map();
  private flushThreshold = 50;
  private flushIntervalMs = 5000;
  private flushTimer: NodeJS.Timer | null = null;

  queueUpdate(entityName: string, type: 'create' | 'update' | 'delete'): void {
    this.pendingUpdates.set(entityName, type);

    if (this.pendingUpdates.size >= this.flushThreshold) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.pendingUpdates.size === 0) return;

    const updates = new Map(this.pendingUpdates);
    this.pendingUpdates.clear();

    // Group by operation type
    const creates: string[] = [];
    const deletes: string[] = [];

    for (const [name, type] of updates) {
      if (type === 'delete') deletes.push(name);
      else creates.push(name);
    }

    // Process deletions (fast)
    for (const name of deletes) {
      this.vectorStore.remove(name);
      this.bm25Index.remove(name);
    }

    // Process creates/updates (batch embed)
    if (creates.length > 0) {
      const entities = await this.loadEntities(creates);
      const texts = entities.map(e => this.entityToText(e));
      const embeddings = await this.embeddingService.embedBatch(texts);

      for (let i = 0; i < entities.length; i++) {
        this.vectorStore.add(entities[i].name, embeddings[i]);
        this.bm25Index.update(entities[i]);
      }
    }
  }
}
```

### 10.4 Performance Metrics

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Query embedding | 100ms | 50ms | 2x (with cache) |
| Batch embedding (100) | 5000ms | 1500ms | 3.3x (parallel) |
| Index update | 500ms | 50ms | 10x (incremental) |
| Cache hit rate | 0% | 80% | Memory savings |

---

## Phase 11: Memory Efficiency ✅ SHIPPED (vector quantization); ⚠️ HNSW indexing remains future work

`src/search/QuantizedVectorStore.ts` ships memory-efficient vector quantization. HNSW graph-based ANN indexing was originally proposed in `FUTURE_FEATURES.md` Phase 10 but has not been implemented; current vector lookup is linear scan over the quantized store.

**Goal**: Reduce memory footprint for large knowledge graphs.
**Effort**: 20 hours | **Impact**: 50% memory reduction

### 11.1 Vector Quantization

**File**: `src/search/QuantizedVectorStore.ts`

```typescript
interface QuantizationConfig {
  method: 'scalar' | 'product';
  bits: 8 | 4;
}

class QuantizedVectorStore {
  private vectors: Map<string, Uint8Array> = new Map();
  private config: QuantizationConfig;

  constructor(config: QuantizationConfig = { method: 'scalar', bits: 8 }) {
    this.config = config;
  }

  add(name: string, vector: number[]): void {
    const quantized = this.quantize(vector);
    this.vectors.set(name, quantized);
  }

  search(query: number[], k: number): Array<{ name: string; score: number }> {
    const scores: Array<{ name: string; score: number }> = [];

    for (const [name, quantized] of this.vectors) {
      const score = this.asymmetricSimilarity(query, quantized);
      scores.push({ name, score });
    }

    return scores.sort((a, b) => b.score - a.score).slice(0, k);
  }

  private quantize(vector: number[]): Uint8Array {
    const quantized = new Uint8Array(vector.length);
    const min = Math.min(...vector);
    const max = Math.max(...vector);
    const range = max - min || 1;

    for (let i = 0; i < vector.length; i++) {
      quantized[i] = Math.round(((vector[i] - min) / range) * 255);
    }
    return quantized;
  }

  private asymmetricSimilarity(query: number[], quantized: Uint8Array): number {
    let dotProduct = 0, queryNorm = 0, dbNorm = 0;

    for (let i = 0; i < query.length; i++) {
      const dbValue = quantized[i] / 255;
      dotProduct += query[i] * dbValue;
      queryNorm += query[i] * query[i];
      dbNorm += dbValue * dbValue;
    }

    return dotProduct / (Math.sqrt(queryNorm) * Math.sqrt(dbNorm));
  }

  getMemoryUsage(): { vectors: number; bytesPerVector: number; totalBytes: number } {
    const count = this.vectors.size;
    if (count === 0) return { vectors: 0, bytesPerVector: 0, totalBytes: 0 };
    const firstVector = this.vectors.values().next().value;
    return { vectors: count, bytesPerVector: firstVector.byteLength, totalBytes: count * firstVector.byteLength };
  }
}
```

### 11.2 Compressed LRU Cache

**File**: `src/utils/CompressedCache.ts`

```typescript
import { brotliCompressSync, brotliDecompressSync, constants } from 'zlib';

class CompressedLRUCache<K, V> {
  private cache: Map<K, { data: Buffer; compressed: boolean; accessTime: number }> = new Map();
  private config = { maxSize: 1000, compressionThreshold: 1024, compressionLevel: 6 };

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    entry.accessTime = Date.now();
    const data = entry.compressed ? brotliDecompressSync(entry.data) : entry.data;
    return JSON.parse(data.toString()) as V;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const serialized = Buffer.from(JSON.stringify(value));
    let data: Buffer;
    let compressed = false;

    if (serialized.length > this.config.compressionThreshold) {
      data = brotliCompressSync(serialized, {
        params: { [constants.BROTLI_PARAM_QUALITY]: this.config.compressionLevel },
      });
      compressed = true;
    } else {
      data = serialized;
    }

    this.cache.set(key, { data, compressed, accessTime: Date.now() });
  }

  private evictLRU(): void {
    let oldestTime = Infinity;
    let oldestKey: K | null = null;
    for (const [key, entry] of this.cache) {
      if (entry.accessTime < oldestTime) {
        oldestTime = entry.accessTime;
        oldestKey = key;
      }
    }
    if (oldestKey !== null) this.cache.delete(oldestKey);
  }
}
```

### 11.3 Performance Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Vector memory (10k, float32) | 60MB | 15MB | 4x reduction |
| Cache memory | 50MB | 15MB | 3.3x reduction |
| Total memory (10k entities) | 150MB | 75MB | 2x reduction |

---

## Phase 12: Adaptive Performance ✅ SHIPPED

`src/search/QueryPlanCache.ts` + plan reuse logic in `QueryPlanner.ts`.

**Goal**: Automatically optimize based on workload characteristics.
**Effort**: 15 hours | **Impact**: Consistent high performance

### 12.1 Auto-Tuning Search Parameters

**File**: `src/search/AutoTuner.ts`

```typescript
interface TuningMetrics {
  avgLatencyMs: number;
  p99LatencyMs: number;
  avgResultCount: number;
  cacheHitRate: number;
}

interface TunedParameters {
  defaultLimit: number;
  cacheSize: number;
  parallelWorkers: number;
  embeddingBatchSize: number;
  hybridWeights: { semantic: number; lexical: number; symbolic: number };
}

class AutoTuner {
  private metrics: TuningMetrics[] = [];
  private currentParams: TunedParameters;

  recordMetrics(operation: SearchOperation): void {
    // Aggregate metrics
  }

  tune(): TunedParameters {
    const avgMetrics = this.aggregateMetrics();

    // Adjust cache size based on hit rate
    if (avgMetrics.cacheHitRate < 0.5) {
      this.currentParams.cacheSize *= 2;
    }

    // Adjust parallel workers based on latency
    if (avgMetrics.p99LatencyMs > 500) {
      this.currentParams.parallelWorkers = Math.min(
        this.currentParams.parallelWorkers + 1,
        os.cpus().length
      );
    }

    // Adjust default limit based on result count
    if (avgMetrics.avgResultCount < 5) {
      this.currentParams.defaultLimit *= 1.5;
    }

    return this.currentParams;
  }
}
```

### 12.2 Graph-Aware Optimization

**File**: `src/search/GraphAwareOptimizer.ts`

```typescript
interface GraphCharacteristics {
  entityCount: number;
  relationCount: number;
  avgObservationsPerEntity: number;
  hierarchyDepth: number;
}

class GraphAwareOptimizer {
  selectIndexStrategy(characteristics: GraphCharacteristics): IndexStrategy {
    // Small graphs: in-memory everything
    if (characteristics.entityCount < 1000) {
      return { vectorIndex: 'flat', textIndex: 'memory', cacheStrategy: 'full' };
    }

    // Medium graphs: approximate search
    if (characteristics.entityCount < 100000) {
      return { vectorIndex: 'hnsw', textIndex: 'bm25', cacheStrategy: 'lru' };
    }

    // Large graphs: sharded
    return { vectorIndex: 'ivf', textIndex: 'bm25-sharded', cacheStrategy: 'distributed' };
  }
}
```

---

## Implementation Priority Matrix

| Priority | Phase | Optimization | Effort | Impact |
|----------|-------|--------------|--------|--------|
| **P0** | 6 | Set-based bulk operations | 2h | 50x bulk deletes |
| **P0** | 6 | Pre-computed similarity | 4h | 2x duplicate detection |
| **P0** | 7 | Parallel search execution | 8h | 3x throughput |
| **P1** | 6 | Single-load compression | 3h | 10x I/O reduction |
| **P1** | 8 | BM25 lexical scoring | 8h | Better accuracy |
| **P1** | 9 | Complexity estimator | 6h | Token reduction |
| **P2** | 7 | Worker pool architecture | 12h | Foundation |
| **P2** | 10 | Embedding cache | 4h | 2x faster embedding |
| **P2** | 10 | Incremental indexing | 8h | 10x update speed |
| **P3** | 11 | Vector quantization | 10h | 4x memory reduction |
| **P3** | 11 | Compressed cache | 6h | 3x memory reduction |
| **P4** | 12 | Auto-tuning | 8h | Self-optimization |
| **P4** | 12 | Graph-aware optimizer | 7h | Adaptive strategy |

---

## Benchmark Suite

### Running Benchmarks

```bash
# Run all benchmarks
npm run benchmark

# Run specific benchmark
npx vitest run tests/performance/hybrid-search.bench.ts
npx vitest run tests/performance/parallel-execution.bench.ts
npx vitest run tests/performance/memory-usage.bench.ts
```

### Benchmark Scenarios

| Scenario | Description | Target |
|----------|-------------|--------|
| **simple-query** | Single-term search | <20ms |
| **complex-query** | Multi-hop, temporal | <200ms |
| **bulk-create** | 1000 entities | <1000ms |
| **full-index** | 10k entity embedding | <30s |
| **memory-10k** | Memory with 10k entities | <100MB |
| **concurrent-50** | 50 concurrent searches | <500ms p99 |

### Success Metrics Summary

| Metric | Current (v9.8.3) | Target (v12.0) | Improvement |
|--------|------------------|----------------|-------------|
| Simple search latency | 50ms | 20ms | 2.5x |
| Complex search latency | 200ms | 100ms | 2x |
| Token efficiency | 1x | 30x | 30x |
| Memory (10k entities) | 150MB | 75MB | 2x |
| Concurrent throughput | 20 qps | 100 qps | 5x |

---

## Environment Variables

```bash
# Parallel Processing
MEMORY_PARALLEL_WORKERS=4
MEMORY_BATCH_SIZE=100
MEMORY_MAX_CONCURRENT_SEARCHES=10

# Search Optimization
MEMORY_SEMANTIC_WEIGHT=0.5
MEMORY_LEXICAL_WEIGHT=0.3
MEMORY_SYMBOLIC_WEIGHT=0.2

# Query Optimization
MEMORY_ENABLE_QUERY_PLANNING=true
MEMORY_COMPLEXITY_THRESHOLD=0.5

# Embedding Performance
MEMORY_EMBEDDING_CACHE_SIZE=10000
MEMORY_EMBEDDING_BATCH_SIZE=32

# Memory Optimization
MEMORY_VECTOR_QUANTIZATION=scalar8
MEMORY_CACHE_COMPRESSION=true
MEMORY_COMPRESSION_THRESHOLD=1024

# Auto-Tuning
MEMORY_AUTO_TUNE=true
MEMORY_TUNE_INTERVAL_MS=300000
```

---

## Phase 13: New MCP Tools for memoryjs v1.8.0 + v1.9.0 ✅ SHIPPED in v12.1.0 (+ backport in v12.3.2)

13 tools total: **12 shipped in v12.1.0** (2026-04-10) and **`set_project_scope` + companion `get_project_scope` backported in v12.3.2** (2026-05-16). The original v12.1.0 commit deliberately deferred `set_project_scope` with a TODO citing server-state management; v12.3.2 supplies the missing piece by storing the active scope in a `WeakMap<ManagerContext, string>` (`projectScopeMap` in `src/server/toolHandlers.ts`). v12.4.0 wires the active scope into `create_entities` — entities without an explicit `projectId` are auto-stamped with the active scope. Search-side auto-filtering is intentionally deferred because it would change search semantics in ways that warrant per-tool design.

See [`CHANGELOG.md`](../../CHANGELOG.md) [12.1.0] and [12.3.2] for the per-tool lists.

**Goal**: Expose 13 new library methods as MCP tools to close the gap between memoryjs capabilities and memory-mcp's tool surface.
**Effort**: 2-3 days | **Impact**: Unlocks project scoping, memory versioning, semantic forget, user profiles, temporal KG, conversation ingestion, agent diary for all MCP clients.
**Requires**: `@danielsimonjr/memoryjs@1.9.1` (published to npm)

### Overview

memoryjs v1.8.0-v1.9.1 added 13 new library methods that have no corresponding MCP tools. Each tool below includes the exact definition for `toolDefinitions.ts` and handler for `toolHandlers.ts`.

---

### 13.1 Project Scoping Tools (v1.8.0)

#### Tool: `list_projects`

**Purpose**: Scan all entities and return distinct projectId values. Enables MCP clients to discover which projects exist in the graph.

**Library method**: `ctx.entityManager.listProjects(): Promise<string[]>`

**toolDefinitions.ts**:
```typescript
{
  name: 'list_projects',
  description: 'List all distinct project IDs in the knowledge graph. Returns sorted array of projectId values, excluding global/unscoped entities.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
  },
},
```

**toolHandlers.ts**:
```typescript
list_projects: async (ctx, _args) => {
  const projects = await ctx.entityManager.listProjects();
  return formatToolResponse({ projects, count: projects.length });
},
```

#### Tool: `set_project_scope`

**Purpose**: Set the default projectId on the ManagerContext. New entities will be auto-stamped with this projectId.

**Note**: ManagerContext stores `defaultProjectId` as a readonly property set at construction. Since the MCP server creates the context once at startup, this tool needs to be implemented differently — either by recreating the context or by setting a mutable override. Recommended approach: add a mutable `activeProjectId` property to the MCP server state that tools check before calling library methods.

**toolDefinitions.ts**:
```typescript
{
  name: 'set_project_scope',
  description: 'Set the active project scope. New entities will be auto-stamped with this projectId, and search operations will filter by it. Pass empty string to clear the scope.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'Project ID to scope to. Empty string clears the scope.' },
    },
    required: ['projectId'],
    additionalProperties: false,
  },
},
```

**toolHandlers.ts**:
```typescript
set_project_scope: async (_ctx, args, serverState) => {
  // serverState.activeProjectId is a mutable field on the MCP server
  serverState.activeProjectId = args.projectId || undefined;
  return formatTextResponse(
    args.projectId
      ? `Project scope set to: ${args.projectId}`
      : 'Project scope cleared (global)'
  );
},
```

**Implementation note**: The `serverState` object needs to be passed through the handler registry. Add `activeProjectId?: string` to the server's state and inject it into search/create calls via the `projectId` filter option.

---

### 13.2 Memory Versioning Tools (v1.8.0)

#### Tool: `get_entity_versions`

**Purpose**: Return all versions in an entity's version chain, sorted by version number ascending.

**Library method**: `ctx.entityManager.getVersionChain(entityName): Promise<Entity[]>`

**toolDefinitions.ts**:
```typescript
{
  name: 'get_entity_versions',
  description: 'Get all versions of an entity in its version chain. Returns versions sorted by version number ascending. Works from any entity in the chain (resolves to root automatically).',
  inputSchema: {
    type: 'object',
    properties: {
      entityName: { type: 'string', description: 'Name of any entity in the version chain' },
    },
    required: ['entityName'],
    additionalProperties: false,
  },
},
```

**toolHandlers.ts**:
```typescript
get_entity_versions: async (ctx, args) => {
  const chain = await ctx.entityManager.getVersionChain(args.entityName);
  return formatToolResponse({
    rootEntity: chain[0]?.name ?? null,
    latestEntity: chain.find(e => e.isLatest !== false)?.name ?? null,
    versions: chain.map(e => ({
      name: e.name,
      version: e.version ?? 1,
      isLatest: e.isLatest !== false,
      observations: e.observations,
    })),
    count: chain.length,
  });
},
```

#### Tool: `get_version_chain`

**Purpose**: Get the latest version of an entity, following the version chain.

**Library method**: `ctx.entityManager.getLatestVersion(entityName): Promise<Entity | null>`

**toolDefinitions.ts**:
```typescript
{
  name: 'get_version_chain',
  description: 'Get the latest version of an entity. If the entity has been superseded by newer versions (via contradiction detection), returns the most recent one.',
  inputSchema: {
    type: 'object',
    properties: {
      entityName: { type: 'string', description: 'Name of any entity in the version chain' },
    },
    required: ['entityName'],
    additionalProperties: false,
  },
},
```

**toolHandlers.ts**:
```typescript
get_version_chain: async (ctx, args) => {
  const latest = await ctx.entityManager.getLatestVersion(args.entityName);
  if (!latest) {
    return formatTextResponse(`Entity '${args.entityName}' not found`);
  }
  return formatToolResponse(latest);
},
```

---

### 13.3 Semantic Forget Tool (v1.8.0)

#### Tool: `forget_memory`

**Purpose**: Two-tier deletion — exact match first, then semantic search fallback at 0.85 threshold. Supports dryRun and project scoping.

**Library method**: `ctx.semanticForget.forgetByContent(content, options): Promise<SemanticForgetResult>`

**toolDefinitions.ts**:
```typescript
{
  name: 'forget_memory',
  description: 'Forget (delete) observations matching the given content. Tries exact match first; falls back to semantic search at 0.85 similarity threshold if available. Supports dryRun to preview what would be deleted.',
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'The content to forget (observation text)' },
      threshold: { type: 'number', description: 'Semantic similarity threshold for fallback (default: 0.85)' },
      projectId: { type: 'string', description: 'Optional project scope filter' },
      dryRun: { type: 'boolean', description: 'If true, return what would be deleted without actually deleting' },
    },
    required: ['content'],
    additionalProperties: false,
  },
},
```

**toolHandlers.ts**:
```typescript
forget_memory: async (ctx, args) => {
  const result = await ctx.semanticForget.forgetByContent(args.content, {
    threshold: args.threshold,
    projectId: args.projectId,
    dryRun: args.dryRun,
  });
  return formatToolResponse(result);
},
```

---

### 13.4 User Profile Tools (v1.8.0)

#### Tool: `get_profile`

**Purpose**: Get the user profile (static + dynamic facts) for a given scope.

**Library method**: `ctx.agentMemory().profileManager.getProfile(options): Promise<ProfileResponse>`

**toolDefinitions.ts**:
```typescript
{
  name: 'get_profile',
  description: 'Get the user profile. Returns static facts (long-lived preferences) and dynamic facts (recent session context). Profiles are scoped by projectId.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'Optional project scope. Omit for global profile.' },
    },
    required: [],
    additionalProperties: false,
  },
},
```

**toolHandlers.ts**:
```typescript
get_profile: async (ctx, args) => {
  const amm = ctx.agentMemory();
  const profile = await amm.profileManager.getProfile({ projectId: args.projectId });
  return formatToolResponse(profile);
},
```

#### Tool: `update_profile`

**Purpose**: Add a static or dynamic fact to the user profile.

**Library method**: `ctx.agentMemory().profileManager.addFact(content, type, options): Promise<void>`

**toolDefinitions.ts**:
```typescript
{
  name: 'update_profile',
  description: 'Add a fact to the user profile. Static facts are long-lived (preferences, role, tools). Dynamic facts are recent (current project, active work).',
  inputSchema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'The fact to add' },
      type: { type: 'string', enum: ['static', 'dynamic'], description: 'Fact type: static (long-lived) or dynamic (recent)' },
      projectId: { type: 'string', description: 'Optional project scope' },
    },
    required: ['content', 'type'],
    additionalProperties: false,
  },
},
```

**toolHandlers.ts**:
```typescript
update_profile: async (ctx, args) => {
  const amm = ctx.agentMemory();
  await amm.profileManager.addFact(args.content, args.type, { projectId: args.projectId });
  return formatTextResponse(`Added ${args.type} profile fact: "${args.content}"`);
},
```

---

### 13.5 Temporal Knowledge Graph Tools (v1.9.0)

#### Tool: `invalidate_relation`

**Purpose**: Mark a relation as no longer valid by setting its validUntil timestamp.

**Library method**: `ctx.relationManager.invalidateRelation(from, type, to, ended?): Promise<void>`

**toolDefinitions.ts**:
```typescript
{
  name: 'invalidate_relation',
  description: 'Mark a relation as no longer valid. Sets the validUntil timestamp on the matching active relation. Use for temporal facts that have ended (e.g., "Kai no longer works on Orion").',
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Source entity name' },
      relationType: { type: 'string', description: 'Relation type (e.g., works_on, assigned_to)' },
      to: { type: 'string', description: 'Target entity name' },
      ended: { type: 'string', description: 'ISO 8601 date when the relation ended. Defaults to now.' },
    },
    required: ['from', 'relationType', 'to'],
    additionalProperties: false,
  },
},
```

**toolHandlers.ts**:
```typescript
invalidate_relation: async (ctx, args) => {
  await ctx.relationManager.invalidateRelation(args.from, args.relationType, args.to, args.ended);
  return formatTextResponse(
    `Invalidated: ${args.from} -[${args.relationType}]-> ${args.to} (ended: ${args.ended ?? 'now'})`
  );
},
```

#### Tool: `query_as_of`

**Purpose**: Query relations valid at a specific point in time (time-travel query).

**Library method**: `ctx.relationManager.queryAsOf(entityName, asOf, options?): Promise<Relation[]>`

**toolDefinitions.ts**:
```typescript
{
  name: 'query_as_of',
  description: 'Query relations valid at a specific point in time. Returns only relations where validFrom <= date AND (validUntil is undefined OR validUntil >= date). Time-travel query for temporal knowledge graphs.',
  inputSchema: {
    type: 'object',
    properties: {
      entityName: { type: 'string', description: 'Entity to query relations for' },
      asOf: { type: 'string', description: 'ISO 8601 date to query at (e.g., "2026-01-15")' },
      direction: { type: 'string', enum: ['outgoing', 'incoming', 'both'], description: 'Relation direction filter. Default: both.' },
    },
    required: ['entityName', 'asOf'],
    additionalProperties: false,
  },
},
```

**toolHandlers.ts**:
```typescript
query_as_of: async (ctx, args) => {
  const relations = await ctx.relationManager.queryAsOf(args.entityName, args.asOf, {
    direction: args.direction,
  });
  return formatToolResponse({ entity: args.entityName, asOf: args.asOf, relations, count: relations.length });
},
```

#### Tool: `timeline`

**Purpose**: Get chronological relation history for an entity (all relations, current + expired).

**Library method**: `ctx.relationManager.timeline(entityName, options?): Promise<Relation[]>`

**toolDefinitions.ts**:
```typescript
{
  name: 'timeline',
  description: 'Get chronological relation history for an entity. Returns ALL relations (current and expired) sorted by validFrom ascending. Shows the full story of an entity over time.',
  inputSchema: {
    type: 'object',
    properties: {
      entityName: { type: 'string', description: 'Entity to get timeline for' },
      direction: { type: 'string', enum: ['outgoing', 'incoming', 'both'], description: 'Relation direction filter. Default: both.' },
    },
    required: ['entityName'],
    additionalProperties: false,
  },
},
```

**toolHandlers.ts**:
```typescript
timeline: async (ctx, args) => {
  const relations = await ctx.relationManager.timeline(args.entityName, {
    direction: args.direction,
  });
  return formatToolResponse({
    entity: args.entityName,
    timeline: relations.map(r => ({
      from: r.from,
      relationType: r.relationType,
      to: r.to,
      validFrom: r.properties?.validFrom ?? null,
      validUntil: r.properties?.validUntil ?? null,
      current: !r.properties?.validUntil,
    })),
    count: relations.length,
  });
},
```

---

### 13.6 Conversation Ingestion Tool (v1.9.0)

#### Tool: `ingest`

**Purpose**: Ingest pre-normalized conversation data into the knowledge graph.

**Library method**: `ctx.ioManager.ingest(input, options): Promise<IngestResult>`

**toolDefinitions.ts**:
```typescript
{
  name: 'ingest',
  description: 'Ingest pre-normalized conversation data into the knowledge graph. Chunks messages by exchange pairs (user+assistant), creates entities with verbatim observations. Format-agnostic: normalize chat exports before calling.',
  inputSchema: {
    type: 'object',
    properties: {
      messages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['user', 'assistant', 'system'] },
            content: { type: 'string' },
            timestamp: { type: 'string', description: 'Optional ISO 8601 timestamp' },
          },
          required: ['role', 'content'],
        },
        description: 'Array of conversation messages to ingest',
      },
      source: { type: 'string', description: 'Source identifier (e.g., filename, session ID)' },
      projectId: { type: 'string', description: 'Project to scope ingested entities to' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags to apply to all created entities' },
      chunkBy: { type: 'string', enum: ['exchange', 'paragraph', 'fixed'], description: 'Chunking strategy. Default: exchange (user+assistant pairs).' },
      dryRun: { type: 'boolean', description: 'Preview without creating entities' },
    },
    required: ['messages'],
    additionalProperties: false,
  },
},
```

**toolHandlers.ts**:
```typescript
ingest: async (ctx, args) => {
  const result = await ctx.ioManager.ingest(
    { messages: args.messages, source: args.source },
    {
      projectId: args.projectId,
      tags: args.tags,
      chunkBy: args.chunkBy,
      dryRun: args.dryRun,
    }
  );
  return formatToolResponse(result);
},
```

---

### 13.7 Agent Diary Tools (v1.9.0)

#### Tool: `diary_write`

**Purpose**: Write a timestamped diary entry for a specialist agent.

**Library method**: `ctx.agentMemory().writeDiary(agentId, entry, options): Promise<void>`

**toolDefinitions.ts**:
```typescript
{
  name: 'diary_write',
  description: 'Write a timestamped diary entry for a specialist agent. Each agent gets its own persistent diary (entity: diary-{agentId}). Use for code review findings, architecture decisions, ops incidents, etc.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'Agent identifier (e.g., reviewer, architect, ops). Alphanumeric + hyphens/underscores only.' },
      entry: { type: 'string', description: 'The diary entry content' },
      topic: { type: 'string', description: 'Optional topic tag for filtering (e.g., security, performance)' },
    },
    required: ['agentId', 'entry'],
    additionalProperties: false,
  },
},
```

**toolHandlers.ts**:
```typescript
diary_write: async (ctx, args) => {
  const amm = ctx.agentMemory();
  await amm.writeDiary(args.agentId, args.entry, { topic: args.topic });
  return formatTextResponse(`Diary entry written for agent '${args.agentId}'`);
},
```

#### Tool: `diary_read`

**Purpose**: Read recent diary entries for a specialist agent.

**Library method**: `ctx.agentMemory().readDiary(agentId, options): Promise<string[]>`

**toolDefinitions.ts**:
```typescript
{
  name: 'diary_read',
  description: 'Read recent diary entries for a specialist agent. Returns entries in reverse chronological order. Optionally filter by topic.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string', description: 'Agent identifier' },
      lastN: { type: 'number', description: 'Number of recent entries to return. Default: 10.' },
      topic: { type: 'string', description: 'Optional topic filter' },
    },
    required: ['agentId'],
    additionalProperties: false,
  },
},
```

**toolHandlers.ts**:
```typescript
diary_read: async (ctx, args) => {
  const amm = ctx.agentMemory();
  const entries = await amm.readDiary(args.agentId, {
    lastN: args.lastN,
    topic: args.topic,
  });
  return formatToolResponse({ agentId: args.agentId, entries, count: entries.length });
},
```

---

### 13.8 Implementation Checklist

**Pre-requisites:**
- [ ] Update `package.json` dependency: `"@danielsimonjr/memoryjs": "^1.9.1"`
- [ ] Run `npm install` to pull the new version

**For each tool (13 total):**
- [ ] Add tool definition to `src/server/toolDefinitions.ts`
- [ ] Add handler to `src/server/toolHandlers.ts`
- [ ] Update tool count in file header comments (94 → 107)
- [ ] Write integration test in `tests/`

**Tools by file location in toolDefinitions.ts:**
| Category | Tools | Insert after |
|----------|-------|-------------|
| Entity | `list_projects`, `get_entity_versions`, `get_version_chain` | `open_nodes` |
| Relation | `invalidate_relation`, `query_as_of`, `timeline` | `delete_relations` |
| Search | `forget_memory` | `search_auto` |
| Agent | `get_profile`, `update_profile`, `diary_write`, `diary_read` | end of agent section |
| IO | `ingest` | `import_graph` |
| Config | `set_project_scope` | end of file |

**Verification:**
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] All 13 new tools appear in `mempalace_status` / tool listing
- [ ] Test each tool via Claude Code MCP: `mcp__memory-mcp__list_projects`, etc.

**Version bump:**
- [ ] Bump `memory-mcp` version to next minor (reflects new tool surface)
- [ ] Update CHANGELOG.md with the 13 new tools
- [ ] `npm publish`

---

*Document Version: 4.0.0 | Last Updated: 2026-04-10*
*Performance insights from: SimpleMem three-stage semantic lossless compression architecture*
*New tools from: memoryjs v1.8.0 (supermemory gap-closing) + v1.9.0/v1.9.1 (mempalace gap-closing)*

---

## Phase 14: Cognitive Core, Maintenance Intelligence, Multi-Agent (memoryjs v1.7.0)

**Status:** ✅ Shipped (no separate CHANGELOG entry — landed in commit `bbe40ae6` between v11.x and v12.1.0; first explicitly retroactively summarised in v12.2.0).

31 new MCP tools across cognitive core (sessions / working memory / wake-up), maintenance intelligence (auto-link / contradictions / consolidation / dedup / compression), decay & salience, multi-agent (registration / cross-agent search / visibility / conflict resolution), and observability (D3.js viz / transcript splitting / query cost estimation).

See `tests/integration/server.test.ts` Phase 14 comment block for the full per-tool list. Pre-existing — this section documents what shipped, it does not propose new work.

---

## Phase 15: memoryjs v1.14+ — Bitemporal, OCC, RBAC, Procedural, Causal, World Model

**Status:** ✅ Shipped in **v12.2.0** (2026-04-26)

23 new MCP tools spanning seven feature areas, plus extensions to three existing tools.

| Area | Tools | Origin |
|---|---|---|
| Entity Bitemporal Validity | `invalidate_entity`, `entity_as_of`, `entity_timeline`, `invalidate_observation`, `observations_as_of` (5) | memoryjs η.4.4 |
| Optimistic Concurrency Control | `update_entity` with `expectedVersion` (1) | memoryjs η.5.5.c |
| RBAC | `rbac_assign_role`, `rbac_revoke_role`, `rbac_check_permission`, `rbac_list_assignments` (4) | memoryjs η.6.1 |
| Procedural Memory | `add_procedure`, `get_procedure`, `match_procedure`, `refine_procedure`, `get_procedure_step` (5) | memoryjs 3B.4 |
| Active Retrieval | `adaptive_retrieve` (1) | memoryjs 3B.5 |
| Causal Reasoning | `find_causes`, `find_effects`, `counterfactual_query`, `detect_causal_cycles` (4) | memoryjs 3B.6 |
| World Model | `get_world_state`, `validate_fact_against_world`, `predict_outcome` (3) | memoryjs 3B.7 |

**Existing tools extended:**
- **`export_graph`** — Three new W3C Linked Data formats (`turtle`, `rdf-xml`, `json-ld` — memoryjs η.5.4); on-export PII redaction via `redactPii: true` (memoryjs η.6.3 / `PiiRedactor`).
- **`create_entities`** — Per-entity `ttl` / `confidence` (v1.6 freshness), `projectId` (v1.8), `validFrom` / `validUntil` / `observationMeta` (η.4.4 bitemporal).
- **`set_memory_visibility`** — Auto-promotes plain entities to `AgentEntity` (was previously a silent `null` failure); supports η.5.5.b time-window and role gates (`allowedRoles`, `visibleFrom`, `visibleUntil`).

**Pre-publish smoke test (2026-04-25/26):** end-to-end MCP transport verification of all 23 new tools against a fresh server build, plus contract-shape regression tests for `save_search` and graceful-error handling for `validate_fact_against_world`. Total tool count: 137 → **160**.

See [`CHANGELOG.md`](../../CHANGELOG.md) [12.2.0] for the full Verified section.

---

*Document Version: 4.1.0 | Last Updated: 2026-04-26*
