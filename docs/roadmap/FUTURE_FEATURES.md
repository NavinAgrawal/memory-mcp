# Future Features & Performance Roadmap

This document outlines planned performance optimizations, parallel processing opportunities, and new features for memory-mcp.

## Table of Contents

- [Performance Optimizations](#performance-optimizations)
  - [Phase 1: Quick Wins](#phase-1-quick-wins-1-2-days-each)
  - [Phase 2: Parallel Processing](#phase-2-parallel-processing-3-5-days)
  - [Phase 3: Advanced Optimizations](#phase-3-advanced-optimizations-1-2-weeks)
- [New Feature Ideas](#new-feature-ideas)
- [Implementation Priority Matrix](#implementation-priority-matrix)
- [Files to Modify](#files-to-modify)

---

## Performance Optimizations

### Phase 1: Quick Wins (1-2 days each)

#### 1.1 O(n²) → O(n) Entity Lookups

**Files**: `src/core/EntityManager.ts:158-161`, `src/core/RelationManager.ts:184-190`

**Issue**: Using `array.includes()` for entity name lookups in delete operations

```typescript
// Current: O(n*m)
graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
```

**Fix**: Convert to `Set.has()` for O(1) lookups

```typescript
// Fixed: O(n)
const namesToDelete = new Set(entityNames);
graph.entities = graph.entities.filter(e => !namesToDelete.has(e.name));
```

**Impact**: 10-100x speedup on bulk deletes

---

#### 1.2 Use NameIndex Instead of Full Graph Loads

**Files**: `src/core/EntityManager.ts:337-342, 420-425`

**Issue**: `addTags()` and `setImportance()` load entire graph just to check entity existence

**Fix**: Use existing `storage.getEntityByName(name)` which is O(1)

**Impact**: 2-3x speedup for tag/importance operations

---

#### 1.3 Build Entity Index Map in batchUpdate

**File**: `src/core/EntityManager.ts:305-316`

**Issue**: Linear search per update in batch operations

```typescript
for (const { name, updates } of updates) {
  const entity = graph.entities.find(e => e.name === name); // O(n) per update!
}
```

**Fix**: Build lookup map first

```typescript
const entityIndex = new Map(graph.entities.map((e, i) => [e.name, i]));
for (const { name, updates } of updates) {
  const idx = entityIndex.get(name); // O(1)
  const entity = graph.entities[idx];
}
```

**Impact**: 5-10x speedup for large batch updates

---

### Phase 2: Parallel Processing (3-5 days)

#### 2.1 Parallelize Graph Algorithms

**File**: `src/core/GraphTraversal.ts:403-426, 447-514, 556-605`

| Algorithm | Current | Optimization |
|-----------|---------|--------------|
| Degree Centrality | Sequential loop | `Promise.all()` for entity degree calculations |
| Betweenness | O(n³) sequential | Parallel source subsets + sampling option |
| PageRank | 100+ sequential iterations | Parallel score updates per iteration |

**Impact**: 3-6x speedup on graphs with 100+ entities

---

#### 2.2 Worker Pool for Fuzzy Search

**File**: `src/search/FuzzySearch.ts:199-222`

**Issue**: `levenshteinDistance()` is O(m*n) and CPU-bound, called for every entity-query pair

**Solution**:
- Use `node:worker_threads` with pool of 4-8 workers
- Batch entity comparisons and distribute to workers

**Impact**: 3-5x speedup for fuzzy search with low thresholds

---

#### 2.3 Streaming Exports

**File**: `src/features/IOManager.ts`

**Issue**: Large graphs loaded entirely into memory for export

**Solution**:
- Implement streaming writes for JSONL, CSV, GraphML
- Write to file as entities are processed

**Impact**: 50-70% reduction in peak memory for large exports

---

### Phase 3: Advanced Optimizations (1-2 weeks)

#### 3.1 Parallelize Duplicate Detection Merges

**File**: `src/features/CompressionManager.ts:301-330`

**Issue**: Entities merged sequentially with graph reload per merge

**Solution**:
- Load graph once before loop
- Use `Promise.all()` for merging independent groups
- Track mutations across parallel merges

**Impact**: 5-10x speedup for large duplicate groups

---

#### 3.2 Pre-compute Observation Sets

**File**: `src/features/CompressionManager.ts:50-56`

**Issue**: Creating lowercase observation sets per comparison

**Solution**:
- Pre-compute lowercase observation/tag sets during graph loading
- Cache pre-normalized entity data

**Impact**: 1.5-2x speedup for duplicate detection

---

#### 3.3 Betweenness Centrality Approximation

**File**: `src/core/GraphTraversal.ts:437-514`

**Current**: O(n³) exact algorithm (Brandes)

**Proposed Options**:
- `approximate: true` - Sample 20% of source entities
- `importanceThreshold: 5` - Skip low-importance entities
- `maxIterations: 50` - Cap computation

**Impact**: 10x speedup for large graphs with acceptable accuracy

---

## New Feature Ideas

### 4.1 Observation Index

**Concept**: `Map<observation_text, Set<entity_names>>`

**Benefits**:
- O(1) lookup for "which entities mention X?"
- Speeds up boolean/ranked search
- Lazy-loaded on first observation search

**Impact**: 2-5x speedup for observation-heavy searches

---

### 4.2 Transaction Batching API

**Concept**: Reduce mutex overhead for multiple operations

```typescript
await graph.transaction([
  createEntities([...]),
  createRelations([...]),
  addObservations([...])
]); // Single lock/unlock
```

**Impact**: 2-3x speedup for workloads with many small operations

---

### 4.3 Graph Change Events

**Concept**: EventEmitter for reactive updates

```typescript
storage.on('entityCreated', (entity) => { ... });
storage.on('relationDeleted', (relation) => { ... });
```

**Use Cases**:
- Real-time index updates
- External sync hooks
- Logging/auditing

---

### 4.4 Incremental Search Index

**Concept**: Maintain search indices incrementally instead of rebuilding

**Benefits**:
- TF-IDF index updated on entity changes
- No full reindex needed
- Persistent index across restarts

**Impact**: Near-instant search on large, frequently-updated graphs

---

### 4.5 Graph Partitioning

**Concept**: Split large graphs into partitions for parallel processing

**Benefits**:
- Process partitions in parallel
- Reduce memory pressure
- Enable distributed processing

**Use Cases**:
- Graphs with 10,000+ entities
- Multi-tenant deployments

---

### 4.6 Query Planner

**Concept**: Optimize complex queries before execution

**Features**:
- Analyze filter selectivity
- Choose optimal index usage
- Reorder operations for efficiency

**Impact**: 2-10x speedup for complex multi-filter queries

---

## Implementation Priority Matrix

| Phase | Effort | Items | Combined Impact |
|-------|--------|-------|-----------------|
| **Phase 1** | 1-2 days | Set-based lookups, NameIndex usage, batch map | 5-20x on bulk ops |
| **Phase 2** | 3-5 days | Parallel centrality, worker pool, streaming | 3-6x on compute |
| **Phase 3** | 1-2 weeks | ObservationIndex, approx algorithms, transactions | 2-5x + new features |

### Expected Performance Gains

| Graph Size | Phase 1 | Phase 1+2 | All Phases |
|------------|---------|-----------|------------|
| Small (< 100 entities) | 1.5-2x | 2-3x | 3-5x |
| Medium (100-1000 entities) | 3-5x | 5-8x | 8-15x |
| Large (1000+ entities) | 5-10x | 10-20x | 20-50x |

---

## Files to Modify

| File | Line(s) | Change | Priority |
|------|---------|--------|----------|
| `EntityManager.ts` | 78, 158-161, 305-316, 337-342 | Set lookups, NameIndex, map index | HIGH |
| `RelationManager.ts` | 99-103, 184-190 | Set lookups | HIGH |
| `GraphTraversal.ts` | 403-426, 447-514, 556-605 | Parallel algorithms | HIGH |
| `FuzzySearch.ts` | 199-222 | Worker pool | MEDIUM |
| `CompressionManager.ts` | 50-56, 301-330 | Pre-compute sets, parallel merges | MEDIUM |
| `IOManager.ts` | Export methods | Streaming writes | MEDIUM |
| `GraphStorage.ts` | New | ObservationIndex, events | MEDIUM |
| `SearchManager.ts` | New | Query planner | LOW |

---

## Testing & Validation

For each optimization:

1. **Before/After Benchmarks**
   ```bash
   npm test -- performance/
   ```

2. **Load Testing** - Create tests with large datasets:
   - 1000, 5000, 10000 entities
   - Measure: memory usage, execution time, CPU utilization

3. **Profile with Node**
   ```bash
   node --prof dist/index.js
   node --prof-process isolate-*.log > profile.txt
   ```

4. **Regression Testing** - Ensure all existing tests pass after changes

---

## Contributing

When implementing optimizations:

1. Create a feature branch: `feat/parallel-centrality`
2. Add benchmarks before implementing
3. Document performance gains in PR
4. Ensure all tests pass
5. Update this roadmap with completion status

---

*Last updated: 2026-01-03*
