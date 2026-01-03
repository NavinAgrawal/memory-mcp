# Future Features & Performance Roadmap

This document outlines planned performance optimizations, parallel processing opportunities, and new features for memory-mcp.

> **Note**: This codebase already has significant optimizations including NameIndex, TypeIndex, relation caches, pre-computed lowercase values, and search result caching. The items below represent additional opportunities.

## Table of Contents

- [Performance Optimizations](#performance-optimizations)
  - [Phase 1: Quick Wins](#phase-1-quick-wins)
  - [Phase 2: Parallel Processing](#phase-2-parallel-processing)
  - [Phase 3: Advanced Optimizations](#phase-3-advanced-optimizations)
- [New Feature Ideas](#new-feature-ideas)
- [Implementation Priority Matrix](#implementation-priority-matrix)
- [Files to Modify](#files-to-modify)

---

## Existing Optimizations (Already Implemented)

Before pursuing new optimizations, note what's already in place:

| Component | Optimization | Location |
|-----------|--------------|----------|
| **NameIndex** | O(1) entity lookup by name | `GraphStorage.ts:609` |
| **TypeIndex** | O(1) entities by type | `GraphStorage.ts` |
| **RelationCache** | Bidirectional relation lookups | `GraphStorage.ts` |
| **LowercasedCache** | Pre-computed lowercase for entities | `GraphStorage.ts` |
| **FuzzySearch Cache** | TTL-based result caching | `FuzzySearch.ts` |
| **RankedSearch Cache** | Token and document caching | `RankedSearch.ts` |
| **BooleanSearch Cache** | AST and result caching | `BooleanSearch.ts` |

---

## Performance Optimizations

### Phase 1: Quick Wins

#### 1.1 Convert `includes()` to `Set.has()` in Bulk Operations

**File**: `src/core/EntityManager.ts`

**Issue**: `deleteEntities()` uses `array.includes()` for entity name lookups, which is O(n) per check.

**Location**: Lines 158-161
```typescript
// Current: O(m) per entity where m = entityNames.length
graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
graph.relations = graph.relations.filter(
  r => !entityNames.includes(r.from) && !entityNames.includes(r.to)
);
```

**Fix**:
```typescript
const namesToDelete = new Set(entityNames);
graph.entities = graph.entities.filter(e => !namesToDelete.has(e.name));
graph.relations = graph.relations.filter(
  r => !namesToDelete.has(r.from) && !namesToDelete.has(r.to)
);
```

**Impact**:
- Small arrays (<50): Negligible difference
- Medium arrays (50-500): 2-5x speedup
- Large arrays (500+): 10-50x speedup

**Other `includes()` locations to review**:
- Line 349: `addTags()` - tag deduplication (small arrays, low priority)
- Line 388, 391: `removeTags()` - tag removal (small arrays, low priority)
- Lines 456, 486, 525-536: Batch tag operations (consider if frequently used with large tag arrays)

---

#### 1.2 Use NameIndex in Entity Existence Checks

**Files**: `src/core/EntityManager.ts`

**Issue**: Several methods call `loadGraph()` then `find()` to check entity existence, when `getEntityByName()` (O(1)) already exists.

**Locations**:
- `addTags()` at line 338-339
- `setImportance()` at line 419-420
- `batchUpdate()` at line 306

**Current Pattern**:
```typescript
const readGraph = await this.storage.loadGraph();
const entity = readGraph.entities.find(e => e.name === entityName);
```

**Improved Pattern**:
```typescript
const entity = this.storage.getEntityByName(entityName);
if (!entity) throw new EntityNotFoundError(entityName);
```

**Impact**: Eliminates O(n) find() call, uses existing O(1) NameIndex.

**Caveat**: Need to verify that subsequent mutation logic doesn't require the full graph context.

---

#### 1.3 Build Lookup Map in batchUpdate

**File**: `src/core/EntityManager.ts:305-316`

**Issue**: Linear search per update in batch operations.

```typescript
for (const { name, updates: updateData } of updates) {
  const entity = graph.entities.find(e => e.name === name); // O(n) per update
}
```

**Fix**:
```typescript
const entityMap = new Map(graph.entities.map(e => [e.name, e]));
for (const { name, updates: updateData } of updates) {
  const entity = entityMap.get(name); // O(1)
  if (!entity) throw new EntityNotFoundError(name);
  Object.assign(entity, updateData);
  entity.lastModified = timestamp;
}
```

**Impact**: O(n + m) instead of O(n × m) where n = entities, m = updates.

---

### Phase 2: Parallel Processing

#### 2.1 Worker Pool for CPU-Intensive Fuzzy Search

**File**: `src/search/FuzzySearch.ts:199-222`

**Current State**: Already uses pre-computed lowercase values via `storage.getLowercased()`. The bottleneck is `levenshteinDistance()` calculations for low thresholds.

**When This Matters**:
- Low threshold (< 0.7) triggers more comparisons
- Large graphs (1000+ entities)
- Long observation text requiring word-by-word matching

**Solution**:
- Use `node:worker_threads` with pool of `os.cpus().length` workers
- Batch entities and distribute Levenshtein calculations
- Only activate for graphs > 500 entities AND threshold < 0.8

**Caveats**:
- Worker thread overhead may negate gains for small graphs
- Need benchmarks before implementing
- Consider WASM-based Levenshtein as lighter alternative

**Estimated Impact**: 2-4x for qualifying workloads (large graphs, low threshold)

---

#### 2.2 Streaming Exports for Large Graphs

**File**: `src/features/IOManager.ts`

**Issue**: Export operations build entire output in memory before writing.

**Solution**:
- Stream JSONL: Write entities one per line as processed
- Stream CSV: Write header, then stream rows
- Stream GraphML/GEXF: Use XML streaming writer

**Impact**:
- Memory: 50-70% reduction in peak memory for exports
- Speed: Marginal improvement (I/O bound, not compute bound)

**Priority**: Medium - only matters for graphs > 5000 entities

---

#### 2.3 Async Betweenness Centrality with Progress

**File**: `src/core/GraphTraversal.ts:437-514`

**Current**: Brandes' algorithm, O(V × E) per source vertex, O(V²E) total.

**Issue**: For large graphs, this blocks the event loop.

**Solutions** (in order of complexity):

1. **Chunked Processing**: Process 50 source vertices, yield, continue
2. **Approximation**: Sample 20% of vertices as sources (configurable)
3. **Worker Thread**: Offload entire calculation to worker

**NOT Recommended**: `Promise.all()` for parallelizing - the algorithm is inherently sequential per source vertex, and `getRelationsTo/From()` are already O(1) synchronous lookups.

**Estimated Impact**:
- Chunked: Same total time, but non-blocking
- Approximation: 5x speedup with ~95% accuracy
- Worker: Non-blocking, same total time

---

### Phase 3: Advanced Optimizations

#### 3.1 Observation Index

**Concept**: Inverted index mapping observation text to entity names.

```typescript
// New structure in GraphStorage
private observationIndex: Map<string, Set<string>>; // word → entity names
```

**Benefits**:
- O(1) lookup for "which entities mention keyword X?"
- Speeds up boolean search with observation clauses
- Enables efficient observation-based deduplication

**Maintenance Overhead**: Update index on entity create/update/delete.

**Impact**: 2-5x for observation-heavy searches.

---

#### 3.2 Pre-compute Similarity Data for Compression

**File**: `src/features/CompressionManager.ts:50-56`

**Issue**: `calculateEntitySimilarity()` creates new Sets for observations and tags on every comparison.

```typescript
// Called O(n²) times for n entities in same bucket
const obs1Set = new Set(e1.observations.map(o => o.toLowerCase()));
const obs2Set = new Set(e2.observations.map(o => o.toLowerCase()));
```

**Solution**: Pre-compute normalized Sets once per entity before comparison loop.

```typescript
interface PreparedEntity {
  entity: Entity;
  obsSet: Set<string>;
  tagSet: Set<string>;
  nameLower: string;
}
```

**Impact**: 1.5-2x speedup for duplicate detection.

---

#### 3.3 Reduce Graph Reloads in compressGraph

**File**: `src/features/CompressionManager.ts:300-338`

**Issue**: Each merge group triggers `loadGraph()` (line 304) and `mergeEntities()` triggers another graph load internally.

**Solution**:
- Load graph once before the loop
- Pass graph reference to mergeEntities
- Save graph once after all merges complete

**Impact**: Reduces I/O from O(n) to O(1) where n = number of duplicate groups.

---

## New Feature Ideas

### 4.1 Transaction Batching API

**Concept**: Reduce mutex overhead for multiple operations.

```typescript
await storage.transaction(async (tx) => {
  tx.createEntities([...]);
  tx.createRelations([...]);
  tx.addObservations([...]);
}); // Single lock/unlock, single save
```

**Impact**: 2-3x speedup for workloads with many small sequential operations.

---

### 4.2 Graph Change Events

**Concept**: EventEmitter for reactive updates.

```typescript
storage.on('entityCreated', (entity) => { ... });
storage.on('entityUpdated', (entity, changes) => { ... });
storage.on('relationDeleted', (relation) => { ... });
```

**Use Cases**:
- Real-time index updates
- External sync hooks
- Audit logging
- Cache invalidation

---

### 4.3 Incremental TF-IDF Index

**Current**: TF-IDF index rebuilt on demand.

**Proposed**: Maintain incrementally on entity changes.

**Benefits**:
- Near-instant ranked search after graph modifications
- Persistent index across restarts (serialize to file)

**Trade-off**: Increased write overhead.

---

### 4.4 Query Cost Estimation

**Concept**: Estimate query cost before execution.

```typescript
const cost = searchManager.estimateCost(query, filters);
// { estimatedMs: 150, complexity: 'medium', suggestions: [...] }
```

**Use Cases**:
- Warn users about expensive queries
- Auto-optimize filter order
- Rate limiting based on cost

---

## Implementation Priority Matrix

| Priority | Item | Effort | Impact | Risk |
|----------|------|--------|--------|------|
| **HIGH** | Set-based lookups in deleteEntities | 1 hour | 10-50x on bulk deletes | Low |
| **HIGH** | Use NameIndex in existence checks | 2 hours | 2-3x on tag/importance ops | Low |
| **MEDIUM** | Lookup map in batchUpdate | 1 hour | 2-10x on batch updates | Low |
| **MEDIUM** | Pre-compute similarity data | 2 hours | 1.5-2x on duplicate detection | Low |
| **MEDIUM** | Reduce graph reloads in compress | 3 hours | Significant I/O reduction | Medium |
| **LOW** | Worker pool for fuzzy search | 1-2 days | 2-4x for specific workloads | Medium |
| **LOW** | Streaming exports | 1 day | Memory reduction only | Low |
| **LOW** | Observation index | 2-3 days | 2-5x for observation searches | Medium |

---

## Files to Modify

| File | Lines | Change | Priority |
|------|-------|--------|----------|
| `EntityManager.ts` | 158-161 | Set-based delete | HIGH |
| `EntityManager.ts` | 306, 338-339, 419-420 | Use NameIndex | HIGH |
| `CompressionManager.ts` | 50-56 | Pre-compute similarity sets | MEDIUM |
| `CompressionManager.ts` | 300-338 | Reduce graph reloads | MEDIUM |
| `FuzzySearch.ts` | 199-222 | Worker pool (conditional) | LOW |
| `IOManager.ts` | Export methods | Streaming writes | LOW |
| `GraphStorage.ts` | New | Observation index | LOW |

---

## Testing & Validation

### Before Implementing Any Optimization

1. **Create Benchmark**: Add to `tests/performance/` with baseline measurements
2. **Profile First**: Use `node --prof` to confirm the bottleneck
3. **Measure Real Impact**: Run benchmarks before and after

### Benchmark Commands

```bash
# Run existing performance tests
npm test -- tests/performance/

# Profile specific operation
node --prof dist/index.js
node --prof-process isolate-*.log > profile.txt

# Memory profiling
node --inspect dist/index.js
# Then use Chrome DevTools Memory tab
```

### Avoid Premature Optimization

- Only optimize after profiling confirms bottleneck
- Small graphs (<100 entities) rarely need optimization
- I/O is often the bottleneck, not CPU

---

## Contributing

When implementing optimizations:

1. Create benchmark test first
2. Measure baseline performance
3. Implement optimization
4. Measure improved performance
5. Document gains in PR with actual numbers
6. Update this roadmap with completion status

---

*Last updated: 2026-01-03*
