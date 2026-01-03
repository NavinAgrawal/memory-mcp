# Phase 6: Performance Optimization Plan

**Version**: 1.0.0
**Created**: 2026-01-03
**Updated**: 2026-01-03
**Status**: PLANNING
**Total Sprints**: 4
**Total Tasks**: 14 tasks organized into sprints of 3-4 items
**Prerequisites**: Phase 5 (folder restructuring) complete, all tests passing

---

## Executive Summary

This plan implements the "Quick Wins" performance optimizations identified in the [Future Features Roadmap](../roadmap/FUTURE_FEATURES.md). These are low-risk, high-impact changes that improve bulk operation performance by converting O(n²) algorithms to O(n).

### Key Optimizations

1. **Set-based lookups** - Replace `array.includes()` with `Set.has()` for O(1) lookups
2. **NameIndex utilization** - Use existing O(1) index instead of O(n) `find()` calls
3. **Batch operation maps** - Build lookup maps for batch updates
4. **Benchmark validation** - Verify performance gains with measurable tests

### Target Metrics

| Operation | Current | Target | Improvement |
|-----------|---------|--------|-------------|
| `deleteEntities(500)` | O(n×m) ~250K ops | O(n+m) ~1K ops | 250x reduction |
| `addTags()` existence check | O(n) find | O(1) index | 100-1000x |
| `setImportance()` existence check | O(n) find | O(1) index | 100-1000x |
| `batchUpdate(100)` | O(n×m) | O(n+m) | 100x reduction |

### Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing behavior | Low | High | Comprehensive tests exist (2109 tests) |
| Performance regression edge cases | Low | Medium | Add benchmarks before/after |
| Index stale after mutation | Low | High | Verify index updates on mutation paths |

---

## Sprint 1: Benchmark Foundation

**Priority**: CRITICAL (P0)
**Estimated Duration**: 0.5 day
**Impact**: Establishes baseline metrics for all optimizations

### Task 1.1: Create Performance Benchmark Test File

**File**: `tests/performance/optimization-benchmarks.test.ts` (new)
**Estimated Time**: 1.5 hours
**Agent**: Claude Haiku

**Purpose**: Create baseline benchmarks BEFORE implementing optimizations to measure actual gains.

**Implementation**:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { EntityManager } from '../../src/core/EntityManager.js';
import { GraphStorage } from '../../src/core/GraphStorage.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Performance Optimization Benchmarks', () => {
  let storage: GraphStorage;
  let entityManager: EntityManager;
  const testFile = path.join(__dirname, 'perf-test-graph.jsonl');

  beforeAll(async () => {
    // Clean up any existing test file
    try { fs.unlinkSync(testFile); } catch {}

    storage = new GraphStorage(testFile);
    entityManager = new EntityManager(storage);
  });

  afterAll(async () => {
    try { fs.unlinkSync(testFile); } catch {}
  });

  /**
   * Helper to create N test entities
   */
  async function createTestEntities(count: number, prefix = 'Entity'): Promise<string[]> {
    const entities = Array.from({ length: count }, (_, i) => ({
      name: `${prefix}_${i}`,
      entityType: 'test',
      observations: [`Observation for ${prefix}_${i}`],
    }));

    await entityManager.createEntities(entities);
    return entities.map(e => e.name);
  }

  /**
   * Helper to measure execution time
   */
  async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
    const start = performance.now();
    const result = await fn();
    const durationMs = performance.now() - start;
    return { result, durationMs };
  }

  describe('deleteEntities performance', () => {
    it('should delete 100 entities from 1000 entity graph efficiently', async () => {
      // Setup: Create 1000 entities
      const allNames = await createTestEntities(1000, 'DelTest');
      const toDelete = allNames.slice(0, 100);

      // Measure deletion time
      const { durationMs } = await measureTime(() =>
        entityManager.deleteEntities(toDelete)
      );

      // Log for baseline comparison
      console.log(`deleteEntities(100 from 1000): ${durationMs.toFixed(2)}ms`);

      // Verify deletion worked
      const remaining = await storage.loadGraph();
      expect(remaining.entities.length).toBe(900);

      // Performance expectation (adjust after optimization)
      // Before optimization: May be 50-200ms
      // After optimization: Should be <20ms
      expect(durationMs).toBeLessThan(500); // Generous initial limit
    });

    it('should delete 500 entities from 2000 entity graph', async () => {
      // Reset
      await storage.saveGraph({ entities: [], relations: [] });

      const allNames = await createTestEntities(2000, 'DelTest2');
      const toDelete = allNames.slice(0, 500);

      const { durationMs } = await measureTime(() =>
        entityManager.deleteEntities(toDelete)
      );

      console.log(`deleteEntities(500 from 2000): ${durationMs.toFixed(2)}ms`);

      const remaining = await storage.loadGraph();
      expect(remaining.entities.length).toBe(1500);
    });
  });

  describe('addTags performance', () => {
    it('should add tags with O(1) entity lookup', async () => {
      // Reset
      await storage.saveGraph({ entities: [], relations: [] });

      // Create 1000 entities
      const names = await createTestEntities(1000, 'TagTest');

      // Measure single addTags call
      const { durationMs } = await measureTime(() =>
        entityManager.addTags(names[500], ['tag1', 'tag2'])
      );

      console.log(`addTags (1 entity in 1000): ${durationMs.toFixed(2)}ms`);

      // After optimization: Should be <5ms
      expect(durationMs).toBeLessThan(100);
    });

    it('should add tags to 50 entities sequentially', async () => {
      const names = (await storage.loadGraph()).entities.map(e => e.name).slice(0, 50);

      const { durationMs } = await measureTime(async () => {
        for (const name of names) {
          await entityManager.addTags(name, ['sequential-tag']);
        }
      });

      console.log(`addTags (50 sequential calls): ${durationMs.toFixed(2)}ms`);
    });
  });

  describe('setImportance performance', () => {
    it('should set importance with O(1) entity lookup', async () => {
      const graph = await storage.loadGraph();
      const targetName = graph.entities[500]?.name;
      if (!targetName) return;

      const { durationMs } = await measureTime(() =>
        entityManager.setImportance(targetName, 8)
      );

      console.log(`setImportance (1 entity in 1000): ${durationMs.toFixed(2)}ms`);
      expect(durationMs).toBeLessThan(100);
    });
  });

  describe('batchUpdate performance', () => {
    it('should batch update 100 entities efficiently', async () => {
      // Reset and create fresh entities
      await storage.saveGraph({ entities: [], relations: [] });
      const names = await createTestEntities(500, 'BatchTest');

      const updates = names.slice(0, 100).map(name => ({
        name,
        updates: { importance: 5 },
      }));

      const { durationMs } = await measureTime(() =>
        entityManager.batchUpdate(updates)
      );

      console.log(`batchUpdate (100 entities in 500): ${durationMs.toFixed(2)}ms`);

      // After optimization: Should be <50ms
      expect(durationMs).toBeLessThan(500);
    });
  });
});
```

**Acceptance Criteria**:
- [ ] Benchmark file created at `tests/performance/optimization-benchmarks.test.ts`
- [ ] All benchmarks run and log baseline times
- [ ] Benchmarks cover `deleteEntities`, `addTags`, `setImportance`, `batchUpdate`
- [ ] Tests pass with generous initial limits
- [ ] Console output shows baseline performance numbers

**Run Command**:
```bash
npx vitest run tests/performance/optimization-benchmarks.test.ts
```

---

### Task 1.2: Document Baseline Performance

**File**: `docs/reports/PHASE_6_BASELINE_METRICS.md` (new)
**Estimated Time**: 30 minutes
**Agent**: Claude Haiku

**Purpose**: Record baseline metrics before optimization for comparison.

**Instructions**:
1. Run the benchmark tests from Task 1.1
2. Record the console output times
3. Create a markdown document with the baseline metrics

**Template**:
```markdown
# Phase 6 Baseline Performance Metrics

**Date**: 2026-01-XX
**Version**: 9.2.2
**Test Environment**: [Machine specs]

## Baseline Measurements (Pre-Optimization)

| Operation | Parameters | Time (ms) | Notes |
|-----------|------------|-----------|-------|
| deleteEntities | 100 from 1000 | XXX | O(n×m) current |
| deleteEntities | 500 from 2000 | XXX | O(n×m) current |
| addTags | 1 in 1000 | XXX | Uses loadGraph + find |
| addTags | 50 sequential | XXX | Sequential calls |
| setImportance | 1 in 1000 | XXX | Uses loadGraph + find |
| batchUpdate | 100 in 500 | XXX | O(n×m) find per update |

## Analysis

- `deleteEntities` scales poorly with deletion count due to O(m) includes per entity
- `addTags` and `setImportance` load entire graph just for existence check
- `batchUpdate` does O(n) find for each update in the batch
```

**Acceptance Criteria**:
- [ ] Baseline metrics documented with actual measurements
- [ ] Document created at `docs/reports/PHASE_6_BASELINE_METRICS.md`
- [ ] Analysis explains why current implementation is slow

---

### Task 1.3: Verify Existing NameIndex API

**File**: `src/core/GraphStorage.ts` (read-only analysis)
**Estimated Time**: 30 minutes
**Agent**: Claude Haiku

**Purpose**: Confirm the `getEntityByName()` method exists and works correctly before using it in optimizations.

**Instructions**:
1. Read `src/core/GraphStorage.ts` and locate the `getEntityByName()` method
2. Verify it uses the NameIndex for O(1) lookup
3. Check when the NameIndex is updated (on create, update, delete)
4. Document findings in a comment block at the top of the optimization PR

**Verification Code** (add to benchmark test temporarily):
```typescript
describe('NameIndex verification', () => {
  it('should have O(1) getEntityByName lookup', async () => {
    await storage.saveGraph({ entities: [], relations: [] });
    await createTestEntities(1000, 'IndexTest');

    // Multiple lookups should all be fast
    const times: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      const entity = storage.getEntityByName(`IndexTest_${i * 10}`);
      times.push(performance.now() - start);
      expect(entity).toBeDefined();
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`getEntityByName avg: ${avgTime.toFixed(4)}ms`);

    // O(1) lookup should be <1ms per call
    expect(avgTime).toBeLessThan(1);
  });

  it('should return undefined for non-existent entity', () => {
    const entity = storage.getEntityByName('NonExistent_Entity_12345');
    expect(entity).toBeUndefined();
  });
});
```

**Expected Findings**:
- `getEntityByName()` exists at approximately line 609
- Uses `this.nameIndex.get(name)` for O(1) lookup
- Index is updated in `rebuildIndexes()` called after graph mutations
- Returns `Entity | undefined`

**Acceptance Criteria**:
- [ ] Confirmed `getEntityByName()` exists and signature documented
- [ ] Confirmed NameIndex is rebuilt after mutations
- [ ] Verification tests added to benchmark file
- [ ] Tests pass confirming O(1) behavior

---

## Sprint 2: Set-Based Lookup Optimization

**Priority**: HIGH (P1)
**Estimated Duration**: 0.5 day
**Impact**: 10-50x speedup on bulk delete operations

### Task 2.1: Optimize deleteEntities with Set

**File**: `src/core/EntityManager.ts`
**Location**: Lines 155-165 (approximately)
**Estimated Time**: 45 minutes
**Agent**: Claude Haiku

**Current Code** (around lines 155-165):
```typescript
async deleteEntities(entityNames: string[]): Promise<{ deletedEntities: string[]; deletedRelations: number }> {
  // ... validation ...

  const graph = await this.storage.getGraphForMutation();

  // CURRENT: O(n×m) - includes() is O(m) per check
  graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
  graph.relations = graph.relations.filter(
    r => !entityNames.includes(r.from) && !entityNames.includes(r.to)
  );

  // ... save and return ...
}
```

**Optimized Code**:
```typescript
async deleteEntities(entityNames: string[]): Promise<{ deletedEntities: string[]; deletedRelations: number }> {
  // ... validation unchanged ...

  const graph = await this.storage.getGraphForMutation();

  // OPTIMIZED: O(n+m) - Set.has() is O(1) per check
  const namesToDelete = new Set(entityNames);

  const originalEntityCount = graph.entities.length;
  const originalRelationCount = graph.relations.length;

  graph.entities = graph.entities.filter(e => !namesToDelete.has(e.name));
  graph.relations = graph.relations.filter(
    r => !namesToDelete.has(r.from) && !namesToDelete.has(r.to)
  );

  // ... save and return unchanged ...
}
```

**Step-by-Step Instructions**:

1. **Open the file**:
   ```
   src/core/EntityManager.ts
   ```

2. **Locate the deleteEntities method** (search for `async deleteEntities`):
   - Should be around line 140-170
   - Find the lines with `entityNames.includes()`

3. **Add the Set creation** immediately after getting the graph:
   ```typescript
   const namesToDelete = new Set(entityNames);
   ```

4. **Replace all `entityNames.includes()` calls**:
   - Change `!entityNames.includes(e.name)` to `!namesToDelete.has(e.name)`
   - Change `!entityNames.includes(r.from)` to `!namesToDelete.has(r.from)`
   - Change `!entityNames.includes(r.to)` to `!namesToDelete.has(r.to)`

5. **Run the existing tests** to verify no regression:
   ```bash
   npx vitest run tests/unit/core/EntityManager.test.ts
   ```

6. **Run the benchmark** to verify improvement:
   ```bash
   npx vitest run tests/performance/optimization-benchmarks.test.ts
   ```

**Acceptance Criteria**:
- [ ] `deleteEntities` uses `Set.has()` instead of `includes()`
- [ ] All existing EntityManager tests pass (31 tests)
- [ ] Benchmark shows measurable improvement for large deletions
- [ ] No changes to method signature or return type

---

### Task 2.2: Run Full Test Suite After Optimization

**Estimated Time**: 10 minutes
**Agent**: Claude Haiku

**Purpose**: Ensure the optimization doesn't break any existing functionality.

**Commands**:
```bash
# Run type check
npm run typecheck

# Run all tests
npm test

# Verify test count unchanged (should be 2109)
```

**Acceptance Criteria**:
- [ ] `npm run typecheck` passes with no errors
- [ ] All 2109 tests pass
- [ ] No new warnings introduced

---

### Task 2.3: Update Benchmark with Post-Optimization Metrics

**File**: `docs/reports/PHASE_6_BASELINE_METRICS.md`
**Estimated Time**: 20 minutes
**Agent**: Claude Haiku

**Instructions**:
1. Run the benchmark tests again
2. Add a new section with post-optimization metrics
3. Calculate the improvement factor

**Template Addition**:
```markdown
## Post-Optimization Measurements (Sprint 2)

| Operation | Pre (ms) | Post (ms) | Improvement |
|-----------|----------|-----------|-------------|
| deleteEntities(100 from 1000) | XXX | YYY | X.Xx faster |
| deleteEntities(500 from 2000) | XXX | YYY | X.Xx faster |

### Analysis

The Set-based optimization reduced `deleteEntities` complexity from O(n×m) to O(n+m).
For deleting 500 entities from a 2000-entity graph:
- Before: 500 × 2000 = 1,000,000 includes checks
- After: 500 Set creations + 2000 has checks = ~2,500 operations
- Theoretical improvement: ~400x
- Actual improvement: XXx
```

**Acceptance Criteria**:
- [ ] Post-optimization metrics documented
- [ ] Improvement factor calculated
- [ ] Analysis explains the improvement

---

## Sprint 3: NameIndex Utilization

**Priority**: HIGH (P1)
**Estimated Duration**: 1 day
**Impact**: Eliminate unnecessary graph loads for existence checks

### Task 3.1: Optimize addTags Entity Existence Check

**File**: `src/core/EntityManager.ts`
**Location**: Lines 336-342 (approximately)
**Estimated Time**: 1 hour
**Agent**: Claude Haiku

**Current Code** (around lines 336-357):
```typescript
async addTags(entityName: string, tags: string[]): Promise<{ entityName: string; addedTags: string[] }> {
  // CURRENT: Loads entire graph just to check existence
  const readGraph = await this.storage.loadGraph();
  const entity = readGraph.entities.find(e => e.name === entityName);
  if (!entity) {
    throw new EntityNotFoundError(entityName);
  }

  // Initialize tags array if it doesn't exist
  const existingTags = entity.tags || [];

  // Normalize tags to lowercase and filter out duplicates
  const normalizedTags = tags.map(tag => tag.toLowerCase());
  const newTags = normalizedTags.filter(tag => !existingTags.includes(tag));

  if (newTags.length > 0) {
    // Uses updateEntity for in-place update
    await this.storage.updateEntity(entityName, { tags: [...existingTags, ...newTags] });
  }

  return { entityName, addedTags: newTags };
}
```

**Optimized Code**:
```typescript
async addTags(entityName: string, tags: string[]): Promise<{ entityName: string; addedTags: string[] }> {
  // OPTIMIZED: Use O(1) NameIndex lookup instead of O(n) find
  const entity = this.storage.getEntityByName(entityName);
  if (!entity) {
    throw new EntityNotFoundError(entityName);
  }

  // Initialize tags array if it doesn't exist
  const existingTags = entity.tags || [];

  // Normalize tags to lowercase and filter out duplicates
  const normalizedTags = tags.map(tag => tag.toLowerCase());
  const newTags = normalizedTags.filter(tag => !existingTags.includes(tag));

  if (newTags.length > 0) {
    // Uses updateEntity for in-place update
    await this.storage.updateEntity(entityName, { tags: [...existingTags, ...newTags] });
  }

  return { entityName, addedTags: newTags };
}
```

**Step-by-Step Instructions**:

1. **Open the file**:
   ```
   src/core/EntityManager.ts
   ```

2. **Locate the addTags method** (search for `async addTags`):
   - Should be around line 336

3. **Remove the loadGraph call**:
   - Delete or comment out: `const readGraph = await this.storage.loadGraph();`

4. **Replace the find call with getEntityByName**:
   - Change: `const entity = readGraph.entities.find(e => e.name === entityName);`
   - To: `const entity = this.storage.getEntityByName(entityName);`

5. **Verify the rest of the method still works**:
   - The `entity` variable is now directly from the index
   - The `existingTags` access should still work: `entity.tags || []`
   - The `updateEntity` call is unchanged

6. **Run the tag-related tests**:
   ```bash
   npx vitest run tests/unit/core/EntityManager.test.ts -t "addTags"
   ```

**Important Note**:
The entity returned by `getEntityByName()` is the same object reference as in the graph. Any reads from it are valid. However, we should NOT mutate it directly - we still use `updateEntity()` for mutations, which is correct in the current code.

**Acceptance Criteria**:
- [ ] `addTags` uses `getEntityByName()` instead of `loadGraph() + find()`
- [ ] All addTags tests pass
- [ ] Benchmark shows improvement for addTags operations
- [ ] No changes to method signature or return type

---

### Task 3.2: Optimize setImportance Entity Existence Check

**File**: `src/core/EntityManager.ts`
**Location**: Lines 412-428 (approximately)
**Estimated Time**: 45 minutes
**Agent**: Claude Haiku

**Current Code** (around lines 412-428):
```typescript
async setImportance(entityName: string, importance: number): Promise<{ entityName: string; importance: number }> {
  // Validate importance range (0-10)
  if (importance < 0 || importance > 10) {
    throw new Error(`Importance must be between 0 and 10, got ${importance}`);
  }

  // CURRENT: Loads entire graph just to check existence
  const readGraph = await this.storage.loadGraph();
  const entity = readGraph.entities.find(e => e.name === entityName);
  if (!entity) {
    throw new EntityNotFoundError(entityName);
  }

  // Uses updateEntity for in-place update
  await this.storage.updateEntity(entityName, { importance });

  return { entityName, importance };
}
```

**Optimized Code**:
```typescript
async setImportance(entityName: string, importance: number): Promise<{ entityName: string; importance: number }> {
  // Validate importance range (0-10)
  if (importance < 0 || importance > 10) {
    throw new Error(`Importance must be between 0 and 10, got ${importance}`);
  }

  // OPTIMIZED: Use O(1) NameIndex lookup instead of O(n) find
  const entity = this.storage.getEntityByName(entityName);
  if (!entity) {
    throw new EntityNotFoundError(entityName);
  }

  // Uses updateEntity for in-place update
  await this.storage.updateEntity(entityName, { importance });

  return { entityName, importance };
}
```

**Step-by-Step Instructions**:

1. **Locate the setImportance method** (search for `async setImportance`)

2. **Apply the same pattern as addTags**:
   - Remove: `const readGraph = await this.storage.loadGraph();`
   - Change: `readGraph.entities.find(e => e.name === entityName)`
   - To: `this.storage.getEntityByName(entityName)`

3. **Run the importance-related tests**:
   ```bash
   npx vitest run tests/unit/core/EntityManager.test.ts -t "importance"
   ```

**Acceptance Criteria**:
- [ ] `setImportance` uses `getEntityByName()` instead of `loadGraph() + find()`
- [ ] All setImportance tests pass
- [ ] Benchmark shows improvement

---

### Task 3.3: Optimize removeTags Entity Existence Check

**File**: `src/core/EntityManager.ts`
**Location**: Lines 370-395 (approximately)
**Estimated Time**: 45 minutes
**Agent**: Claude Haiku

**Instructions**:
Apply the same optimization pattern to `removeTags()`:
1. Replace `loadGraph() + find()` with `getEntityByName()`
2. Keep the rest of the logic unchanged
3. Run tests to verify

**Acceptance Criteria**:
- [ ] `removeTags` uses `getEntityByName()`
- [ ] All removeTags tests pass

---

### Task 3.4: Run Full Test Suite and Update Metrics

**Estimated Time**: 20 minutes
**Agent**: Claude Haiku

**Commands**:
```bash
npm run typecheck
npm test
npx vitest run tests/performance/optimization-benchmarks.test.ts
```

**Update Metrics Document**:
Add Sprint 3 results to `docs/reports/PHASE_6_BASELINE_METRICS.md`

**Acceptance Criteria**:
- [ ] All 2109 tests pass
- [ ] Post-Sprint-3 metrics documented
- [ ] Improvement factors calculated

---

## Sprint 4: Batch Operation Optimization

**Priority**: MEDIUM (P2)
**Estimated Duration**: 0.5 day
**Impact**: O(n×m) → O(n+m) for batch updates

### Task 4.1: Optimize batchUpdate with Lookup Map

**File**: `src/core/EntityManager.ts`
**Location**: Lines 289-320 (approximately)
**Estimated Time**: 1 hour
**Agent**: Claude Haiku

**Current Code** (around lines 300-320):
```typescript
async batchUpdate(updates: { name: string; updates: Partial<Entity> }[]): Promise<Entity[]> {
  // ... validation ...

  const graph = await this.storage.getGraphForMutation();
  const timestamp = new Date().toISOString();
  const updatedEntities: Entity[] = [];

  // CURRENT: O(n) find per update = O(n×m) total
  for (const { name, updates: updateData } of updates) {
    const entity = graph.entities.find(e => e.name === name);

    if (!entity) {
      throw new EntityNotFoundError(name);
    }

    // Apply updates
    Object.assign(entity, updateData);
    entity.lastModified = timestamp;
    updatedEntities.push(entity);
  }

  await this.storage.saveGraph(graph);
  return updatedEntities;
}
```

**Optimized Code**:
```typescript
async batchUpdate(updates: { name: string; updates: Partial<Entity> }[]): Promise<Entity[]> {
  // ... validation unchanged ...

  const graph = await this.storage.getGraphForMutation();
  const timestamp = new Date().toISOString();
  const updatedEntities: Entity[] = [];

  // OPTIMIZED: Build lookup map once = O(n), then O(1) per lookup
  const entityMap = new Map(graph.entities.map(e => [e.name, e]));

  for (const { name, updates: updateData } of updates) {
    const entity = entityMap.get(name);

    if (!entity) {
      throw new EntityNotFoundError(name);
    }

    // Apply updates
    Object.assign(entity, updateData);
    entity.lastModified = timestamp;
    updatedEntities.push(entity);
  }

  await this.storage.saveGraph(graph);
  return updatedEntities;
}
```

**Step-by-Step Instructions**:

1. **Locate the batchUpdate method** (search for `async batchUpdate`)

2. **Add the Map creation** before the for loop:
   ```typescript
   const entityMap = new Map(graph.entities.map(e => [e.name, e]));
   ```

3. **Replace the find call**:
   - Change: `const entity = graph.entities.find(e => e.name === name);`
   - To: `const entity = entityMap.get(name);`

4. **Run the batch update tests**:
   ```bash
   npx vitest run tests/unit/core/EntityManager.test.ts -t "batch"
   ```

**Acceptance Criteria**:
- [ ] `batchUpdate` uses Map lookup instead of find()
- [ ] All batchUpdate tests pass
- [ ] Benchmark shows improvement for batch operations

---

### Task 4.2: Review Other Batch Operations

**File**: `src/core/EntityManager.ts`
**Estimated Time**: 30 minutes
**Agent**: Claude Haiku

**Purpose**: Check if other batch methods could benefit from the same optimization.

**Methods to Review**:
1. `addTagsToMultipleEntities()` - around line 438
2. `replaceTag()` - around line 480
3. `mergeTags()` - around line 515

**Instructions**:
For each method, check if it:
1. Iterates over entities
2. Does a `find()` call inside the loop
3. Could benefit from a pre-built Map

**Document Findings**: Add a comment in the code or in the metrics document about which methods were reviewed and whether optimization was applied.

**Acceptance Criteria**:
- [ ] All batch methods reviewed
- [ ] Optimizations applied where beneficial
- [ ] Findings documented

---

### Task 4.3: Final Benchmark and Documentation

**Estimated Time**: 30 minutes
**Agent**: Claude Haiku

**Commands**:
```bash
npm run typecheck
npm test
npx vitest run tests/performance/optimization-benchmarks.test.ts
```

**Final Documentation**:
Update `docs/reports/PHASE_6_BASELINE_METRICS.md` with:
1. Final post-optimization metrics for all sprints
2. Summary of improvements
3. Recommendations for future optimizations

**Template**:
```markdown
## Final Results (Phase 6 Complete)

| Operation | Baseline (ms) | Final (ms) | Improvement |
|-----------|---------------|------------|-------------|
| deleteEntities(100 from 1000) | XXX | YYY | X.Xx |
| deleteEntities(500 from 2000) | XXX | YYY | X.Xx |
| addTags(1 in 1000) | XXX | YYY | X.Xx |
| setImportance(1 in 1000) | XXX | YYY | X.Xx |
| batchUpdate(100 in 500) | XXX | YYY | X.Xx |

## Summary

Phase 6 optimizations achieved:
- **Bulk deletes**: X.Xx faster through Set-based lookups
- **Entity operations**: X.Xx faster through NameIndex utilization
- **Batch updates**: X.Xx faster through Map-based lookups

## Remaining Opportunities

From FUTURE_FEATURES.md Phase 2:
- Worker pool for fuzzy search (medium priority)
- Streaming exports (low priority)
```

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Final metrics documented
- [ ] Summary written
- [ ] Phase 6 marked as COMPLETED

---

### Task 4.4: Version Bump and Release

**Estimated Time**: 15 minutes
**Agent**: Claude Haiku

**Use the /COMMIT slash command**:
```
/COMMIT minor "Performance optimizations: Set-based lookups, NameIndex utilization, batch Map lookups"
```

This will:
1. Run typecheck
2. Run all tests
3. Bump version (9.2.2 → 9.3.0)
4. Update CHANGELOG.md
5. Update CLAUDE.md
6. Commit and push

**Acceptance Criteria**:
- [ ] Version bumped to 9.3.0
- [ ] CHANGELOG updated with Phase 6 changes
- [ ] Pushed to GitHub

---

## Appendix A: File Changes Summary

### New Files Created

```
tests/performance/optimization-benchmarks.test.ts
docs/reports/PHASE_6_BASELINE_METRICS.md
```

### Files Modified

```
src/core/EntityManager.ts    # Set-based deletes, NameIndex usage, batch Map
```

---

## Appendix B: Rollback Plan

If any optimization causes issues:

1. **Identify the problematic change** via git diff
2. **Revert the specific optimization**:
   ```bash
   git checkout HEAD~1 -- src/core/EntityManager.ts
   ```
3. **Run tests to confirm fix**:
   ```bash
   npm test
   ```
4. **Document the issue** for future investigation

---

## Appendix C: Success Metrics Checklist

### Performance
- [ ] `deleteEntities` 10x+ faster for 100+ deletions
- [ ] `addTags` and `setImportance` 10x+ faster
- [ ] `batchUpdate` 10x+ faster for 50+ updates

### Quality
- [ ] All 2109 tests pass
- [ ] No TypeScript errors
- [ ] No new warnings

### Documentation
- [ ] Baseline metrics recorded
- [ ] Post-optimization metrics recorded
- [ ] Improvement factors calculated
- [ ] CHANGELOG updated

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-03 | 1.0.0 | Initial plan extracted from FUTURE_FEATURES.md Phase 1 |
