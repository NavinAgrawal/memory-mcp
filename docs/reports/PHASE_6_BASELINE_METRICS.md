# Phase 6 Performance Optimization - Baseline Metrics

## Test Environment

- **Date**: 2026-01-03
- **Version**: 9.2.1 (pre-optimization)
- **Node.js**: v20.x
- **Platform**: Windows
- **Test Framework**: Vitest 4.0.16

## Baseline Measurements (Pre-Optimization)

All measurements taken with `tests/performance/optimization-benchmarks.test.ts`.

### deleteEntities Performance (Sprint 2 Target)

Current implementation uses `array.includes()` which is O(n) per check.

| Operation | Entities | Delete Count | Time (ms) | Complexity |
|-----------|----------|--------------|-----------|------------|
| deleteEntities | 1,000 | 100 | 7.23 | O(n×m) = 100K checks |
| deleteEntities | 2,000 | 500 | 14.02 | O(n×m) = 1M checks |

**Analysis**: With current O(n×m) complexity, deleting m entities from n-entity graph requires n×m array lookups. The Set-based optimization (Sprint 2) will reduce this to O(n+m).

### addTags Performance (Sprint 3 Target)

Current implementation calls `loadGraph()` then `find()` - O(n) lookup.

| Operation | Graph Size | Operations | Time (ms) | Avg/Op (ms) |
|-----------|------------|------------|-----------|-------------|
| addTags | 1,000 | 1 | 3.64 | 3.64 |
| addTags | 1,000 | 50 sequential | 91.21 | 1.82 |

**Analysis**: Each addTags call loads the full graph and performs O(n) find(). The NameIndex optimization (Sprint 3) will provide O(1) entity lookup.

### setImportance Performance (Sprint 3 Target)

Current implementation uses same pattern as addTags.

| Operation | Graph Size | Operations | Time (ms) | Avg/Op (ms) |
|-----------|------------|------------|-----------|-------------|
| setImportance | 1,000 | 1 | 2.85 | 2.85 |
| setImportance | 1,000 | 50 sequential | 87.77 | 1.76 |

**Analysis**: Same O(n) find() pattern as addTags. Will benefit from NameIndex optimization.

### batchUpdate Performance (Sprint 4 Target)

Current implementation calls `find()` inside loop - O(n×m) total.

| Operation | Graph Size | Updates | Time (ms) | Complexity |
|-----------|------------|---------|-----------|------------|
| batchUpdate | 500 | 100 | 7.70 | O(n×m) = 50K finds |
| batchUpdate | 1,000 | 200 | 9.57 | O(n×m) = 200K finds |

**Analysis**: With m updates and n entities, current implementation performs n×m array lookups. Map-based optimization (Sprint 4) will reduce to O(n+m).

### NameIndex Verification (Sprint 1 Task 3)

Verified that `getEntityByName()` provides O(1) lookup via NameIndex.

| Operation | Lookups | Time (ms) | Avg/Lookup (ms) |
|-----------|---------|-----------|-----------------|
| getEntityByName | 100 | 0.31 | 0.003 |

**Analysis**: NameIndex provides sub-millisecond lookups. This confirms the optimization strategy for Sprint 3 is viable.

## Current Algorithm Complexity

| Method | Current Complexity | Issue |
|--------|-------------------|-------|
| deleteEntities | O(n×m) | `includes()` is O(n) per check |
| addTags | O(n) | `loadGraph()` + `find()` |
| setImportance | O(n) | `loadGraph()` + `find()` |
| removeTags | O(n) | Uses `getGraphForMutation()` + `find()` - different pattern |
| batchUpdate | O(n×m) | `find()` inside loop |

## Target Improvements

| Sprint | Method | Current | Target | Expected Gain |
|--------|--------|---------|--------|---------------|
| 2 | deleteEntities | O(n×m) | O(n+m) | 10-50x faster |
| 3 | addTags | O(n) | O(1) | 100-1000x faster |
| 3 | setImportance | O(n) | O(1) | 100-1000x faster |
| 4 | batchUpdate | O(n×m) | O(n+m) | 10-100x faster |

---

## Post-Optimization Measurements

All measurements taken after applying Phase 6 optimizations.

### Sprint 2: Set-Based Lookups (deleteEntities)

| Operation | Entities | Delete | Pre (ms) | Post (ms) | Improvement |
|-----------|----------|--------|----------|-----------|-------------|
| deleteEntities | 1,000 | 100 | 7.23 | 7.78 | ~same (I/O bound) |
| deleteEntities | 2,000 | 500 | 14.02 | 7.30 | **48% faster** |

**Analysis**: The Set-based optimization (`Set.has()` instead of `includes()`) shows significant improvement on larger datasets. The 500-entity deletion from 2000 entities improved from 14ms to 7ms. Smaller operations are I/O bound.

### Sprint 3: NameIndex Utilization (addTags, setImportance)

| Operation | Graph Size | Ops | Pre (ms) | Post (ms) | Improvement |
|-----------|------------|-----|----------|-----------|-------------|
| addTags | 1,000 | 1 | 3.64 | 3.47 | 5% faster |
| addTags | 1,000 | 50 | 91.21 | 80.46 | **12% faster** |
| setImportance | 1,000 | 1 | 2.85 | 2.70 | 5% faster |
| setImportance | 1,000 | 50 | 87.77 | 86.89 | ~same |

**Analysis**: The NameIndex optimization (O(1) `getEntityByName()` instead of `loadGraph()` + O(n) `find()`) provides modest improvements. The bulk of execution time is in `updateEntity()` disk writes, not the lookup.

### Sprint 4: Map-Based Lookups (batchUpdate)

| Operation | Graph Size | Updates | Pre (ms) | Post (ms) | Improvement |
|-----------|------------|---------|----------|-----------|-------------|
| batchUpdate | 500 | 100 | 7.70 | 6.86 | **11% faster** |
| batchUpdate | 1,000 | 200 | 9.57 | 7.46 | **22% faster** |

**Analysis**: The Map-based optimization (build index once, O(1) lookups) shows improvement especially on larger batch operations.

## Algorithm Changes Summary

| Method | Before | After | Change |
|--------|--------|-------|--------|
| deleteEntities | `includes()` O(n) per check | `Set.has()` O(1) per check | O(n×m) → O(n+m) |
| addTags | `loadGraph()` + `find()` O(n) | `getEntityByName()` O(1) | Eliminated graph load |
| setImportance | `loadGraph()` + `find()` O(n) | `getEntityByName()` O(1) | Eliminated graph load |
| batchUpdate | `find()` O(n) per update | `Map.get()` O(1) per update | O(n×m) → O(n+m) |

## Notes

- All tests pass within generous time limits (500ms for most operations)
- NameIndex is already available in GraphStorage and provides O(1) lookups
- removeTags uses a different pattern (`getGraphForMutation()` + `saveGraph()`) and may not benefit from the same optimization approach as addTags/setImportance
- Actual improvements are modest because disk I/O dominates execution time for these operations
- The algorithmic improvements will be more noticeable on larger datasets or when disk caching is warm
