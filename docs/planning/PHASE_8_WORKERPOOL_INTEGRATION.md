# Phase 8: Workerpool Library Integration

## Overview

Replace the custom `WorkerPool` implementation in memory-mcp with the `@danielsimonjr/workerpool` library to gain access to a mature, feature-rich worker pool with advanced scheduling, parallel array operations, and robust error handling.

## Motivation

### Current State (Phase 7)
- Custom `WorkerPool.ts` (~100 lines)
- Basic task queuing with `Array.shift()` (O(n) dequeue)
- Manual worker management
- Limited error handling
- Single use case: fuzzy search parallelization

### Target State (Phase 8)
- Battle-tested workerpool library with extensive features
- O(1) queue operations with `GrowableCircularBuffer`
- Advanced worker scheduling strategies
- Built-in parallel array operations
- Robust error handling, timeouts, cancellation
- Potential for broader parallelization across memory-mcp

## Library Comparison

| Feature | Custom WorkerPool | @danielsimonjr/workerpool |
|---------|-------------------|---------------------------|
| Queue complexity | O(n) shift | O(1) circular buffer |
| Worker scheduling | FIFO only | round-robin, least-busy, fair-share, etc. |
| Task cancellation | No | Yes |
| Timeouts | No | Yes |
| Progress events | No | Yes (workerEmit) |
| Transferables | No | Yes (zero-copy) |
| Parallel array ops | No | Yes (map, reduce, filter, etc.) |
| Work stealing | No | Yes |
| Task affinity | No | Yes |
| Error recovery | Basic | Handles worker crashes |
| TypeScript | Yes | Yes (full types) |
| Bundle size | ~5KB | ~9KB min+gzip (modern) |

## Integration Plan

### Sprint 1: Core Integration (2-3 hours)

**Goal**: Replace custom WorkerPool with workerpool for fuzzy search

#### Tasks

1. **Add dependency**
   ```bash
   npm install @danielsimonjr/workerpool
   ```

2. **Update levenshteinWorker.ts**
   - Convert to workerpool.worker() format
   - Register functions for pool access
   ```typescript
   import workerpool from '@danielsimonjr/workerpool';

   function searchEntities(data: WorkerInput): MatchResult[] {
     // existing logic
   }

   workerpool.worker({
     searchEntities
   });
   ```

3. **Update FuzzySearch.ts**
   - Replace custom WorkerPool import with workerpool
   - Use pool.exec() for task execution
   ```typescript
   import workerpool from '@danielsimonjr/workerpool';

   private pool: workerpool.Pool | null = null;

   private async searchWithWorkers(...) {
     if (!this.pool) {
       this.pool = workerpool.pool(this.workerPath, {
         maxWorkers: workerpool.cpus - 1,
         workerType: 'thread'
       });
     }

     const results = await Promise.all(
       chunks.map(chunk =>
         this.pool.exec('searchEntities', [{ query, threshold, entities: chunk }])
       )
     );
     // ...
   }
   ```

4. **Update tests**
   - Modify WorkerPool.test.ts to test workerpool integration
   - Ensure existing fuzzy search tests pass

5. **Remove custom WorkerPool**
   - Delete `src/workers/WorkerPool.ts` (or keep as reference)
   - Update `src/workers/index.ts` exports

#### Acceptance Criteria
- [ ] Fuzzy search uses workerpool instead of custom pool
- [ ] All existing fuzzy search tests pass
- [ ] Worker pool tests updated
- [ ] npm run typecheck passes
- [ ] npm test passes

### Sprint 2: Enhanced Error Handling (1-2 hours)

**Goal**: Leverage workerpool's robust error handling

#### Tasks

1. **Add timeout support**
   ```typescript
   const result = await pool.exec('searchEntities', [data])
     .timeout(30000); // 30 second timeout
   ```

2. **Handle worker crashes gracefully**
   - Workerpool auto-restarts crashed workers
   - Add error logging for visibility

3. **Add cancellation support for long searches**
   ```typescript
   const promise = pool.exec('searchEntities', [data]);
   // Later:
   promise.cancel();
   ```

4. **Update shutdown to use pool.terminate()**
   ```typescript
   async shutdown(): Promise<void> {
     if (this.pool) {
       await this.pool.terminate();
       this.pool = null;
     }
   }
   ```

#### Acceptance Criteria
- [ ] Timeouts work for long-running searches
- [ ] Cancellation supported
- [ ] Worker crashes handled gracefully
- [ ] Clean shutdown implemented

### Sprint 3: Parallel Array Operations (2-3 hours)

**Goal**: Use workerpool's parallel processing for other memory-mcp features

#### Approach

The workerpool library provides factory functions for parallel array operations:
- `createParallelFilter` - Filter arrays in parallel
- `createParallelReduce` - Reduce arrays in parallel
- `createParallelFind` - Find elements in parallel
- `createParallelForEach` - Process elements in parallel

For memory-mcp, we'll primarily use the `pool.exec()` pattern with chunked data, similar to fuzzy search.

#### Potential Use Cases

1. **Parallel duplicate detection**
   ```typescript
   // Using pool.exec with chunks (same pattern as fuzzy search)
   const chunks = chunkArray(entityPairs, chunkSize);
   const results = await Promise.all(
     chunks.map(chunk => pool.exec('findDuplicatesInChunk', [chunk, threshold]))
   );
   const duplicates = results.flat();
   ```

2. **Semantic similarity calculations**
   ```typescript
   // Parallelize similarity calculations across worker threads
   const chunks = chunkArray(entities, Math.ceil(entities.length / numWorkers));
   const results = await Promise.all(
     chunks.map(chunk => pool.exec('calculateSimilarities', [chunk, queryEmbedding]))
   );
   const similarities = results.flat();
   ```

3. **Using factory functions (advanced)**
   ```typescript
   import { createParallelFilter } from '@danielsimonjr/workerpool';

   const parallelFilter = createParallelFilter(pool, { chunkSize: 100 });
   const duplicates = await parallelFilter(
     entityPairs,
     (pair) => calculateSimilarity(pair[0], pair[1]) >= threshold
   );
   ```

#### Tasks

1. Identify CPU-bound operations that would benefit from parallelization
2. Implement parallel versions using pool.map/reduce/filter
3. Add benchmarks comparing serial vs parallel performance
4. Add activation thresholds (similar to fuzzy search's 500 entity minimum)

#### Acceptance Criteria
- [ ] At least 2 features use parallel array ops
- [ ] Benchmarks show performance improvement
- [ ] Activation thresholds prevent overhead for small graphs

### Sprint 4: Advanced Scheduling (Optional) (2-3 hours)

**Goal**: Use AdvancedPool for optimal task distribution

#### Tasks

1. **Evaluate AdvancedPool benefits**
   ```typescript
   import { advancedPool } from '@danielsimonjr/workerpool';

   const pool = advancedPool('./worker.js', {
     workerChoiceStrategy: 'least-busy',  // or 'round-robin', 'fair-share'
     enableWorkStealing: true
   });
   ```

2. **Task affinity for related searches**
   - Use TaskAffinityRouter to route similar queries to same worker for cache locality
   ```typescript
   import { TaskAffinityRouter, createAffinityKey } from '@danielsimonjr/workerpool';

   const affinityRouter = new TaskAffinityRouter(pool);
   const affinityKey = createAffinityKey(query.substring(0, 3));
   await affinityRouter.execWithAffinity(affinityKey, 'searchEntities', [data]);
   ```

3. **Work stealing for load balancing**
   - WorkStealingScheduler automatically rebalances tasks
   ```typescript
   import { WorkStealingScheduler } from '@danielsimonjr/workerpool';

   const scheduler = new WorkStealingScheduler(pool);
   // Tasks are automatically stolen from busy workers
   ```

#### Acceptance Criteria
- [ ] AdvancedPool evaluated
- [ ] If beneficial, implemented for appropriate use cases
- [ ] Performance improvements documented

## File Changes Summary

### Files to Modify
- `package.json` - Add @danielsimonjr/workerpool dependency
- `package-lock.json` - Updated by npm install
- `src/search/FuzzySearch.ts` - Use workerpool instead of custom pool
- `src/workers/levenshteinWorker.ts` - Convert to workerpool.worker() format
- `src/workers/index.ts` - Update exports
- `tests/unit/workers/WorkerPool.test.ts` - Update for workerpool
- `CLAUDE.md` - Document workerpool integration (dependencies, workers module)

### Files to Remove (Optional)
- `src/workers/WorkerPool.ts` - Replaced by workerpool library

### Files to Create
- `docs/planning/PHASE_8_SPRINT_1_TODO.json`
- `docs/planning/PHASE_8_SPRINT_2_TODO.json`
- `docs/planning/PHASE_8_SPRINT_3_TODO.json`
- `docs/planning/PHASE_8_INDEX.json`

## Dependencies

- `@danielsimonjr/workerpool`: ^10.0.1

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API differences cause test failures | Medium | Careful migration, comprehensive testing |
| Bundle size increase | Low | Only ~4KB increase, acceptable |
| Learning curve | Low | Well-documented library |
| Worker path resolution | Medium | Test in both dev and production |

## Success Metrics

1. All existing tests pass after migration
2. Fuzzy search performance maintained or improved
3. Code reduced by ~100 lines (WorkerPool.ts removal)
4. New features enabled (timeouts, cancellation, parallel array ops)

## Timeline

| Sprint | Effort | Priority |
|--------|--------|----------|
| Sprint 1: Core Integration | 2-3 hours | HIGH |
| Sprint 2: Error Handling | 1-2 hours | MEDIUM |
| Sprint 3: Parallel Array Ops | 2-3 hours | MEDIUM |
| Sprint 4: Advanced Scheduling | 2-3 hours | LOW |

**Total Estimated Effort**: 7-11 hours

## Notes

- The workerpool library is maintained by the same author as memory-mcp, ensuring alignment
- **Import paths**:
  - `@danielsimonjr/workerpool` - Main TypeScript build (~9KB) - **recommended for memory-mcp**
  - `@danielsimonjr/workerpool/minimal` - Lightweight (~5KB) - core functionality only
  - `@danielsimonjr/workerpool/full` - Complete (~15KB) - includes WASM support, debug utilities
- WASM features not needed for memory-mcp use cases
- All advanced features (AdvancedPool, TaskAffinityRouter, parallel processing factories) are available in the main build
