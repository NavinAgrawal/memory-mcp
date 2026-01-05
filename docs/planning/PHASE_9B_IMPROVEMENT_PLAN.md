# Phase 9B: TaskScheduler Integration

**Version**: 1.0.0
**Created**: 2026-01-05
**Status**: PLANNED
**Total Sprints**: 3
**Total Tasks**: 10 tasks organized into sprints of 3-4 items
**Prerequisites**: Phase 9 (Advanced Optimizations) complete, All 2267+ tests passing

---

## Executive Summary

Phase 9B integrates the existing but unused `taskScheduler.ts` utility into production code. This utility was implemented in Phase 8, Sprint 4 with comprehensive test coverage (39 tests) but has never been used in actual operations. This phase connects the scheduling infrastructure to batch operations, enabling progress tracking, cancellation support, and improved parallelization across the codebase.

### Key Features

1. **Progress Tracking** - Real-time progress callbacks for long-running operations
2. **Cancellation Support** - AbortSignal-based cancellation for interruptible operations
3. **Batch Processing** - Parallel processing with concurrency control
4. **Retry Logic** - Exponential backoff retry for transient failures

### Target Metrics

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| createEntities (1000 entities) | No progress visibility | Progress callbacks every 100 entities | Better UX |
| compressGraph (500 duplicates) | No progress, no cancellation | Progress + cancellation | Interruptible |
| importGraph (10000 entities) | Blocks until complete | Progress updates + cancellation | Better UX |
| Long-running operations | Must wait for completion | Can cancel mid-operation | Better control |

### When These Integrations Matter

- **Progress Tracking**: Bulk imports, large compression operations, batch entity creation
- **Cancellation**: User-initiated abort, timeout scenarios, resource cleanup
- **Batch Processing**: Entity validation, duplicate detection, relation verification
- **Retry Logic**: File I/O operations, backup/restore, network-dependent operations

### Current TaskScheduler Capabilities

The `src/utils/taskScheduler.ts` module provides:

| Feature | Description | Use Cases |
|---------|-------------|-----------|
| **TaskQueue** | Priority-based queue with workerpool | Queued, cancellable operations |
| **batchProcess()** | Parallel batch processing with progress | O(n) operations with progress |
| **rateLimitedProcess()** | Sequential with rate limiting | API calls, file operations |
| **withRetry()** | Exponential backoff retry | Network ops, transient failures |
| **debounce()/throttle()** | Rate limiting utilities | User input, cache writes |

---

## Sprint 1: Foundation and Core Integrations

**Priority**: HIGH (P1)
**Estimated Duration**: 8 hours
**Impact**: Enables progress tracking and cancellation for high-volume operations

### Task 1.1: Create Common Types and Operation Utilities

**Files**:
- `src/types/types.ts`
- `src/utils/operationUtils.ts` (new file)
- `src/utils/errors.ts`
- `src/utils/index.ts`

**Estimated Time**: 1.5 hours
**Agent**: Haiku

**Description**: Create shared types and utility functions for long-running operations with progress tracking and cancellation support.

**Step-by-Step Instructions**:

1. **Open the file**: `src/types/types.ts`

2. **Find the imports section** at the top of the file

3. **Add import for ProgressCallback** (if not already re-exported):
   ```typescript
   import type { ProgressCallback, TaskPriority } from '../utils/taskScheduler.js';
   ```

4. **Find the end of the existing interface definitions** and add the new interface:
   ```typescript
   /**
    * Options for long-running operations supporting progress and cancellation.
    * Used by operations that may take significant time and benefit from
    * user feedback and interruptibility.
    */
   export interface LongRunningOperationOptions {
     /**
      * Progress callback for tracking operation progress.
      * Called periodically with completion status.
      */
     onProgress?: ProgressCallback;

     /**
      * AbortSignal for cancellation support.
      * When aborted, the operation will throw OperationCancelledError.
      */
     signal?: AbortSignal;

     /**
      * Priority for queued operations (optional).
      * Higher priority operations are processed first.
      */
     priority?: TaskPriority;
   }
   ```

5. **Open the file**: `src/utils/errors.ts`

6. **Find the existing error classes** and add the new error class:
   ```typescript
   /**
    * Error thrown when an operation is cancelled via AbortSignal.
    */
   export class OperationCancelledError extends KnowledgeGraphError {
     constructor(operation?: string) {
       const message = operation
         ? `Operation '${operation}' was cancelled`
         : 'Operation was cancelled';
       super(message, 'OPERATION_CANCELLED');
       this.name = 'OperationCancelledError';
     }
   }
   ```

7. **Create new file**: `src/utils/operationUtils.ts`
   ```typescript
   /**
    * Utilities for long-running operations with progress and cancellation support.
    * @module utils/operationUtils
    */

   import { OperationCancelledError } from './errors.js';
   import type { ProgressCallback } from './taskScheduler.js';

   /**
    * Check if an operation has been cancelled via AbortSignal.
    * Throws OperationCancelledError if the signal is aborted.
    *
    * @param signal - Optional AbortSignal to check
    * @param operation - Optional operation name for error message
    * @throws OperationCancelledError if signal is aborted
    *
    * @example
    * ```typescript
    * for (const item of items) {
    *   checkCancellation(options?.signal, 'batch processing');
    *   await processItem(item);
    * }
    * ```
    */
   export function checkCancellation(signal?: AbortSignal, operation?: string): void {
     if (signal?.aborted) {
       throw new OperationCancelledError(operation);
     }
   }

   /**
    * Create a throttled progress reporter to avoid excessive callback invocations.
    * Returns undefined if no callback is provided.
    *
    * @param callback - Optional progress callback to throttle
    * @param throttleMs - Minimum time between callbacks (default: 100ms)
    * @returns Throttled callback or undefined
    *
    * @example
    * ```typescript
    * const reportProgress = createProgressReporter(options?.onProgress, 50);
    * for (let i = 0; i < total; i++) {
    *   reportProgress?.({ completed: i, total, percentage: (i / total) * 100 });
    * }
    * ```
    */
   export function createProgressReporter(
     callback?: ProgressCallback,
     throttleMs: number = 100
   ): ProgressCallback | undefined {
     if (!callback) return undefined;

     let lastCallTime = 0;

     return (progress) => {
       const now = Date.now();
       // Always report 0% and 100%
       if (progress.percentage === 0 || progress.percentage >= 100 || now - lastCallTime >= throttleMs) {
         lastCallTime = now;
         callback(progress);
       }
     };
   }

   /**
    * Create a progress object for reporting.
    *
    * @param completed - Number of completed items
    * @param total - Total number of items
    * @param currentTaskId - Optional current task identifier
    * @returns Progress object suitable for ProgressCallback
    */
   export function createProgress(
     completed: number,
     total: number,
     currentTaskId?: string
   ): { completed: number; total: number; percentage: number; currentTaskId?: string } {
     return {
       completed,
       total,
       percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
       currentTaskId,
     };
   }

   /**
    * Execute an operation with progress phases.
    * Useful when an operation has multiple distinct phases.
    *
    * @param phases - Array of phase definitions with weight and executor
    * @param onProgress - Optional progress callback
    * @param signal - Optional abort signal
    *
    * @example
    * ```typescript
    * await executeWithPhases([
    *   { name: 'parsing', weight: 20, execute: () => parseData() },
    *   { name: 'processing', weight: 60, execute: () => processEntities() },
    *   { name: 'saving', weight: 20, execute: () => saveResults() },
    * ], options?.onProgress, options?.signal);
    * ```
    */
   export async function executeWithPhases<T>(
     phases: Array<{
       name: string;
       weight: number;
       execute: (phaseProgress: (pct: number) => void) => Promise<T>;
     }>,
     onProgress?: ProgressCallback,
     signal?: AbortSignal
   ): Promise<T[]> {
     const totalWeight = phases.reduce((sum, p) => sum + p.weight, 0);
     let completedWeight = 0;
     const results: T[] = [];

     for (const phase of phases) {
       checkCancellation(signal, phase.name);

       const phaseStartWeight = completedWeight;
       const phaseProgress = (phasePct: number) => {
         if (onProgress) {
           const overallPct = ((phaseStartWeight + (phase.weight * phasePct / 100)) / totalWeight) * 100;
           onProgress({
             completed: Math.round(overallPct),
             total: 100,
             percentage: Math.round(overallPct),
             currentTaskId: phase.name,
           });
         }
       };

       const result = await phase.execute(phaseProgress);
       results.push(result);
       completedWeight += phase.weight;
     }

     // Report 100% completion
     onProgress?.({
       completed: 100,
       total: 100,
       percentage: 100,
     });

     return results;
   }
   ```

8. **Open the file**: `src/utils/index.ts`

9. **Add export for the new operationUtils module** near the taskScheduler exports:
   ```typescript
   // ==================== Operation Utilities ====================
   export {
     checkCancellation,
     createProgressReporter,
     createProgress,
     executeWithPhases,
   } from './operationUtils.js';
   ```

10. **Update the errors export** if OperationCancelledError isn't already exported:
    ```typescript
    export {
      KnowledgeGraphError,
      EntityNotFoundError,
      // ... existing errors
      OperationCancelledError,
    } from './errors.js';
    ```

11. **Run TypeScript compilation**:
    ```bash
    npm run typecheck
    ```

**Acceptance Criteria**:
- [ ] LongRunningOperationOptions interface added to types.ts
- [ ] OperationCancelledError class added to errors.ts
- [ ] operationUtils.ts created with all utility functions
- [ ] Exports added to utils/index.ts
- [ ] TypeScript compilation passes
- [ ] No breaking changes to existing code

---

### Task 1.2: Enhance EntityManager.createEntities() with Progress and Cancellation

**File**: `src/core/EntityManager.ts`
**Estimated Time**: 2 hours
**Agent**: Haiku

**Description**: Add optional progress tracking and cancellation support to the createEntities method while maintaining full backward compatibility.

**Step-by-Step Instructions**:

1. **Open the file**: `src/core/EntityManager.ts`

2. **Add imports at the top** (update existing import statement):
   ```typescript
   import {
     BatchCreateEntitiesSchema,
     UpdateEntitySchema,
     EntityNamesSchema,
     checkCancellation,
     createProgressReporter,
     createProgress,
     batchProcess,
     type ProgressCallback,
   } from '../utils/index.js';
   import type { LongRunningOperationOptions } from '../types/index.js';
   ```

3. **Find the createEntities method** (approximately line 65-121)

4. **Update the method signature** to accept options parameter:
   ```typescript
   /**
    * Create multiple entities in the graph.
    *
    * @param entities - Array of entities to create
    * @param options - Optional progress and cancellation options
    * @returns Array of created entities
    * @throws OperationCancelledError if cancelled via signal
    *
    * @example
    * ```typescript
    * // Basic usage (backward compatible)
    * const entities = await manager.createEntities([...]);
    *
    * // With progress tracking
    * const entities = await manager.createEntities([...], {
    *   onProgress: (p) => console.log(`${p.percentage}% complete`),
    * });
    *
    * // With cancellation
    * const controller = new AbortController();
    * const entities = await manager.createEntities([...], {
    *   signal: controller.signal,
    * });
    * // Later: controller.abort();
    * ```
    */
   async createEntities(
     entities: Entity[],
     options?: LongRunningOperationOptions
   ): Promise<Entity[]> {
   ```

5. **Add progress and cancellation logic** at the start of the method:
   ```typescript
   async createEntities(
     entities: Entity[],
     options?: LongRunningOperationOptions
   ): Promise<Entity[]> {
     // Check for cancellation before starting
     checkCancellation(options?.signal, 'createEntities');

     // Create throttled progress reporter
     const reportProgress = createProgressReporter(options?.onProgress);

     // Report initial progress
     reportProgress?.(createProgress(0, entities.length));
   ```

6. **Add progress updates within the method** after validation and during processing:
   ```typescript
     // After validation (approximately 10% of work)
     reportProgress?.(createProgress(Math.floor(entities.length * 0.1), entities.length));

     // Check cancellation after validation
     checkCancellation(options?.signal, 'createEntities');
   ```

7. **Add batch progress tracking** during entity creation loop or bulk operation:
   ```typescript
     // If processing entities in a loop, add progress updates:
     const batchSize = 100;
     for (let i = 0; i < newEntities.length; i++) {
       // Check cancellation periodically
       if (i % batchSize === 0) {
         checkCancellation(options?.signal, 'createEntities');
         // Report progress (validation = 10%, creation = 90%)
         const creationProgress = Math.floor((i / newEntities.length) * 90);
         reportProgress?.(createProgress(
           Math.floor(entities.length * 0.1) + Math.floor(newEntities.length * creationProgress / 100),
           entities.length
         ));
       }
       // ... existing entity processing
     }
   ```

8. **Report completion** at the end of the method:
   ```typescript
     // Before return statement
     reportProgress?.(createProgress(entities.length, entities.length));

     return createdEntities; // or whatever the existing return is
   }
   ```

9. **Run TypeScript compilation**:
   ```bash
   npm run typecheck
   ```

10. **Run existing tests** to ensure backward compatibility:
    ```bash
    npx vitest run tests/unit/core/EntityManager.test.ts
    ```

**Acceptance Criteria**:
- [ ] createEntities accepts optional LongRunningOperationOptions parameter
- [ ] Progress callback receives updates during operation
- [ ] Cancellation via AbortSignal works correctly
- [ ] All existing tests pass without modification
- [ ] TypeScript compilation passes
- [ ] Backward compatible (works without options)

---

### Task 1.3: Enhance CompressionManager with Progress and Cancellation

**Files**: `src/features/CompressionManager.ts`
**Estimated Time**: 2.5 hours
**Agent**: Haiku

**Description**: Add progress tracking and cancellation support to findDuplicates() and compressGraph() methods.

**Step-by-Step Instructions**:

1. **Open the file**: `src/features/CompressionManager.ts`

2. **Add imports at the top**:
   ```typescript
   import {
     checkCancellation,
     createProgressReporter,
     createProgress,
     executeWithPhases,
   } from '../utils/index.js';
   import type { LongRunningOperationOptions } from '../types/index.js';
   ```

3. **Find the findDuplicates method** and update its signature:
   ```typescript
   /**
    * Find duplicate entities based on similarity threshold.
    *
    * @param threshold - Similarity threshold (0.0 to 1.0, default 0.8)
    * @param options - Optional progress and cancellation options
    * @returns Array of duplicate entity groups
    * @throws OperationCancelledError if cancelled
    *
    * @example
    * ```typescript
    * const duplicates = await manager.findDuplicates(0.8, {
    *   onProgress: (p) => console.log(`Finding duplicates: ${p.percentage}%`),
    *   signal: abortController.signal,
    * });
    * ```
    */
   async findDuplicates(
     threshold: number = 0.8,
     options?: LongRunningOperationOptions
   ): Promise<string[][]> {
   ```

4. **Add progress tracking** inside findDuplicates:
   ```typescript
   async findDuplicates(
     threshold: number = 0.8,
     options?: LongRunningOperationOptions
   ): Promise<string[][]> {
     checkCancellation(options?.signal, 'findDuplicates');
     const reportProgress = createProgressReporter(options?.onProgress);

     const graph = await this.storage.loadGraph();
     const entities = graph.entities;
     const totalComparisons = (entities.length * (entities.length - 1)) / 2;
     let comparisonsCompleted = 0;

     reportProgress?.(createProgress(0, totalComparisons));

     // ... existing bucketing and comparison logic

     // Inside comparison loops, add:
     // comparisonsCompleted++;
     // if (comparisonsCompleted % 1000 === 0) {
     //   checkCancellation(options?.signal, 'findDuplicates');
     //   reportProgress?.(createProgress(comparisonsCompleted, totalComparisons));
     // }

     reportProgress?.(createProgress(totalComparisons, totalComparisons));
     return duplicateGroups;
   }
   ```

5. **Find the compressGraph method** and update its signature:
   ```typescript
   /**
    * Compress the graph by merging duplicate entities.
    *
    * @param threshold - Similarity threshold for duplicate detection
    * @param dryRun - If true, only report what would be merged
    * @param options - Optional progress and cancellation options
    * @returns Compression result with statistics
    * @throws OperationCancelledError if cancelled
    *
    * @example
    * ```typescript
    * const result = await manager.compressGraph(0.8, false, {
    *   onProgress: (p) => {
    *     console.log(`${p.currentTaskId}: ${p.percentage}%`);
    *   },
    * });
    * ```
    */
   async compressGraph(
     threshold?: number,
     dryRun?: boolean,
     options?: LongRunningOperationOptions
   ): Promise<CompressionResult> {
   ```

6. **Implement phased progress** in compressGraph:
   ```typescript
   async compressGraph(
     threshold: number = 0.8,
     dryRun: boolean = false,
     options?: LongRunningOperationOptions
   ): Promise<CompressionResult> {
     checkCancellation(options?.signal, 'compressGraph');

     // Use executeWithPhases for structured progress
     const reportProgress = createProgressReporter(options?.onProgress);

     // Phase 1: Find duplicates (40% of work)
     reportProgress?.(createProgress(0, 100, 'findDuplicates'));
     const duplicateGroups = await this.findDuplicates(threshold, {
       signal: options?.signal,
       onProgress: (p) => {
         // Scale to 0-40%
         reportProgress?.(createProgress(
           Math.floor(p.percentage * 0.4),
           100,
           'findDuplicates'
         ));
       },
     });

     if (dryRun || duplicateGroups.length === 0) {
       reportProgress?.(createProgress(100, 100));
       return { /* ... dry run result */ };
     }

     // Phase 2: Merge duplicates (60% of work)
     const totalMerges = duplicateGroups.length;
     let mergesCompleted = 0;

     for (const group of duplicateGroups) {
       checkCancellation(options?.signal, 'compressGraph');

       // ... existing merge logic

       mergesCompleted++;
       reportProgress?.(createProgress(
         40 + Math.floor((mergesCompleted / totalMerges) * 60),
         100,
         `merging ${group[0]}`
       ));
     }

     reportProgress?.(createProgress(100, 100));
     return result;
   }
   ```

7. **Run TypeScript compilation**:
   ```bash
   npm run typecheck
   ```

8. **Run existing tests**:
   ```bash
   npx vitest run tests/unit/features/CompressionManager.test.ts
   ```

**Acceptance Criteria**:
- [ ] findDuplicates accepts optional LongRunningOperationOptions
- [ ] compressGraph accepts optional LongRunningOperationOptions
- [ ] Progress callbacks report meaningful phase information
- [ ] Cancellation works at safe checkpoints
- [ ] All existing tests pass
- [ ] TypeScript compilation passes

---

### Task 1.4: Enhance IOManager.importGraph() with Progress and Cancellation

**File**: `src/features/IOManager.ts`
**Estimated Time**: 2 hours
**Agent**: Haiku

**Description**: Add progress tracking and cancellation support to the importGraph method with phased progress reporting.

**Step-by-Step Instructions**:

1. **Open the file**: `src/features/IOManager.ts`

2. **Add imports at the top**:
   ```typescript
   import {
     checkCancellation,
     createProgressReporter,
     createProgress,
     withRetry,
   } from '../utils/index.js';
   import type { LongRunningOperationOptions } from '../types/index.js';
   ```

3. **Find the importGraph method** and update its signature:
   ```typescript
   /**
    * Import a graph from various formats.
    *
    * @param format - Import format ('json', 'csv', 'graphml')
    * @param data - Raw data string to import
    * @param mergeStrategy - How to handle existing entities
    * @param dryRun - If true, only validate without importing
    * @param options - Optional progress and cancellation options
    * @returns Import result with statistics
    * @throws OperationCancelledError if cancelled
    *
    * @example
    * ```typescript
    * const result = await manager.importGraph('json', data, 'merge', false, {
    *   onProgress: (p) => console.log(`Import: ${p.percentage}% (${p.currentTaskId})`),
    *   signal: abortController.signal,
    * });
    * ```
    */
   async importGraph(
     format: ImportFormat,
     data: string,
     mergeStrategy?: MergeStrategy,
     dryRun?: boolean,
     options?: LongRunningOperationOptions
   ): Promise<ImportResult> {
   ```

4. **Implement phased progress tracking**:
   ```typescript
   async importGraph(
     format: ImportFormat,
     data: string,
     mergeStrategy: MergeStrategy = 'skip',
     dryRun: boolean = false,
     options?: LongRunningOperationOptions
   ): Promise<ImportResult> {
     checkCancellation(options?.signal, 'importGraph');
     const reportProgress = createProgressReporter(options?.onProgress);

     // Phase 1: Parsing (0-20%)
     reportProgress?.(createProgress(0, 100, 'parsing'));
     let parsedGraph: KnowledgeGraph;

     try {
       switch (format) {
         case 'json':
           parsedGraph = JSON.parse(data);
           break;
         case 'csv':
           checkCancellation(options?.signal, 'importGraph');
           parsedGraph = await this.parseCsvImport(data);
           break;
         case 'graphml':
           checkCancellation(options?.signal, 'importGraph');
           parsedGraph = await this.parseGraphMLImport(data);
           break;
       }
     } catch (error) {
       throw new Error(`Failed to parse ${format} data: ${error}`);
     }

     reportProgress?.(createProgress(20, 100, 'parsed'));
     checkCancellation(options?.signal, 'importGraph');

     // Phase 2: Process entities (20-70%)
     const totalEntities = parsedGraph.entities.length;
     const totalRelations = parsedGraph.relations.length;
     let entitiesProcessed = 0;

     // ... existing entity processing logic
     // Add inside loop:
     // entitiesProcessed++;
     // if (entitiesProcessed % 100 === 0) {
     //   checkCancellation(options?.signal, 'importGraph');
     //   reportProgress?.(createProgress(
     //     20 + Math.floor((entitiesProcessed / totalEntities) * 50),
     //     100,
     //     `processing entity ${entitiesProcessed}/${totalEntities}`
     //   ));
     // }

     // Phase 3: Process relations (70-100%)
     reportProgress?.(createProgress(70, 100, 'processing relations'));
     let relationsProcessed = 0;

     // ... existing relation processing logic
     // Add inside loop:
     // relationsProcessed++;
     // if (relationsProcessed % 100 === 0) {
     //   checkCancellation(options?.signal, 'importGraph');
     //   reportProgress?.(createProgress(
     //     70 + Math.floor((relationsProcessed / totalRelations) * 30),
     //     100,
     //     `processing relation ${relationsProcessed}/${totalRelations}`
     //   ));
     // }

     reportProgress?.(createProgress(100, 100, 'complete'));
     return result;
   }
   ```

5. **Run TypeScript compilation**:
   ```bash
   npm run typecheck
   ```

6. **Run existing tests**:
   ```bash
   npx vitest run tests/unit/features/ImportManager.test.ts
   ```

**Acceptance Criteria**:
- [ ] importGraph accepts optional LongRunningOperationOptions
- [ ] Progress reports parsing, entity processing, and relation processing phases
- [ ] Cancellation works at safe checkpoints between batches
- [ ] All existing tests pass
- [ ] TypeScript compilation passes

---

## Sprint 2: Medium Priority Integrations

**Priority**: MEDIUM (P2)
**Estimated Duration**: 6 hours
**Impact**: Extends progress/cancellation to archiving, search indexing, and transactions

### Task 2.1: Enhance ArchiveManager.archiveEntities() with Progress and Cancellation

**File**: `src/features/ArchiveManager.ts`
**Estimated Time**: 1.5 hours
**Agent**: Haiku

**Description**: Add progress tracking and cancellation support to the archiveEntities method.

**Step-by-Step Instructions**:

1. **Open the file**: `src/features/ArchiveManager.ts`

2. **Add imports at the top**:
   ```typescript
   import {
     checkCancellation,
     createProgressReporter,
     createProgress,
   } from '../utils/index.js';
   import type { LongRunningOperationOptions } from '../types/index.js';
   ```

3. **Update the ArchiveOptions interface** or create extended options:
   ```typescript
   /**
    * Extended archive options with progress and cancellation support.
    */
   export interface ArchiveOptionsExtended extends ArchiveOptions {
     /** Progress callback for tracking archive progress */
     onProgress?: ProgressCallback;
     /** AbortSignal for cancellation support */
     signal?: AbortSignal;
   }
   ```

4. **Find the archiveEntities method** and update its signature:
   ```typescript
   /**
    * Archive entities matching the specified criteria.
    *
    * @param criteria - Criteria for selecting entities to archive
    * @param options - Archive options including progress and cancellation
    * @returns Archive result with statistics
    * @throws OperationCancelledError if cancelled
    */
   async archiveEntities(
     criteria: ArchiveCriteria,
     options?: ArchiveOptionsExtended
   ): Promise<ArchiveResult> {
   ```

5. **Implement progress tracking**:
   ```typescript
   async archiveEntities(
     criteria: ArchiveCriteria,
     options?: ArchiveOptionsExtended
   ): Promise<ArchiveResult> {
     checkCancellation(options?.signal, 'archiveEntities');
     const reportProgress = createProgressReporter(options?.onProgress);

     const graph = await this.storage.loadGraph();
     const totalEntities = graph.entities.length;

     // Phase 1: Filter entities (0-50%)
     reportProgress?.(createProgress(0, 100, 'filtering entities'));
     const toArchive: Entity[] = [];

     for (let i = 0; i < graph.entities.length; i++) {
       if (i % 100 === 0) {
         checkCancellation(options?.signal, 'archiveEntities');
         reportProgress?.(createProgress(
           Math.floor((i / totalEntities) * 50),
           100,
           'filtering entities'
         ));
       }

       const entity = graph.entities[i];
       // ... existing filtering logic
       if (shouldArchive) {
         toArchive.push(entity);
       }
     }

     // Phase 2: Create archive (50-100%)
     reportProgress?.(createProgress(50, 100, 'creating archive'));
     checkCancellation(options?.signal, 'archiveEntities');

     // ... existing archive creation logic

     reportProgress?.(createProgress(100, 100, 'complete'));
     return result;
   }
   ```

6. **Run TypeScript compilation and tests**:
   ```bash
   npm run typecheck
   npx vitest run tests/unit/features/ArchiveManager.test.ts
   ```

**Acceptance Criteria**:
- [ ] archiveEntities accepts extended options with progress/signal
- [ ] Progress reports filtering and archive creation phases
- [ ] Cancellation works at safe checkpoints
- [ ] All existing tests pass
- [ ] TypeScript compilation passes

---

### Task 2.2: Enhance SemanticSearch.indexAll() with Cancellation Support

**File**: `src/search/SemanticSearch.ts`
**Estimated Time**: 1.5 hours
**Agent**: Haiku

**Description**: Add cancellation support to the indexAll method which already has progress tracking.

**Step-by-Step Instructions**:

1. **Open the file**: `src/search/SemanticSearch.ts`

2. **Add imports**:
   ```typescript
   import { checkCancellation } from '../utils/index.js';
   ```

3. **Update the SemanticIndexOptions interface** to include signal:
   ```typescript
   export interface SemanticIndexOptions {
     /** Batch size for embedding generation */
     batchSize?: number;
     /** Progress callback */
     onProgress?: (indexed: number, total: number) => void;
     /** Force re-indexing of already indexed entities */
     forceReindex?: boolean;
     /** AbortSignal for cancellation support */
     signal?: AbortSignal;
   }
   ```

4. **Add cancellation checks** in the indexAll method:
   ```typescript
   async indexAll(
     graph: ReadonlyKnowledgeGraph,
     options?: SemanticIndexOptions
   ): Promise<{ indexed: number; skipped: number; errors: number }> {
     // Check for initial cancellation
     checkCancellation(options?.signal, 'indexAll');

     // ... existing setup code

     for (let i = 0; i < toIndex.length; i += batchSize) {
       // Check cancellation before each batch
       checkCancellation(options?.signal, 'indexAll');

       const batch = toIndex.slice(i, i + batchSize);
       // ... existing batch processing

       // Report progress (existing code)
       if (options?.onProgress) {
         options.onProgress(indexed + skipped + errors, total);
       }
     }

     return { indexed, skipped, errors };
   }
   ```

5. **Run TypeScript compilation and tests**:
   ```bash
   npm run typecheck
   npx vitest run tests/unit/search/SemanticSearch.test.ts
   ```

**Acceptance Criteria**:
- [ ] SemanticIndexOptions includes optional signal property
- [ ] Cancellation checked before each batch
- [ ] Existing progress tracking still works
- [ ] All existing tests pass
- [ ] TypeScript compilation passes

---

### Task 2.3: Add Parallel Validation Option to TransactionManager.commit()

**File**: `src/core/TransactionManager.ts`
**Estimated Time**: 2 hours
**Agent**: Haiku

**Description**: Add optional parallel pre-validation to TransactionManager.commit() using batchProcess.

**Step-by-Step Instructions**:

1. **Open the file**: `src/core/TransactionManager.ts`

2. **Add imports**:
   ```typescript
   import {
     checkCancellation,
     createProgressReporter,
     createProgress,
     batchProcess,
   } from '../utils/index.js';
   import type { LongRunningOperationOptions } from '../types/index.js';
   ```

3. **Create extended commit options interface**:
   ```typescript
   /**
    * Options for transaction commit with optional parallel validation.
    */
   export interface CommitOptions extends LongRunningOperationOptions {
     /**
      * If true, validate all operations in parallel before applying.
      * Can speed up validation for large transactions but uses more memory.
      */
     parallelValidation?: boolean;
   }
   ```

4. **Update the commit method signature**:
   ```typescript
   /**
    * Commit all pending operations in the transaction.
    *
    * @param options - Commit options including parallel validation and progress
    * @returns Transaction result with statistics
    * @throws OperationCancelledError if cancelled
    *
    * @example
    * ```typescript
    * const result = await transaction.commit({
    *   parallelValidation: true,
    *   onProgress: (p) => console.log(`Commit: ${p.percentage}%`),
    * });
    * ```
    */
   async commit(options?: CommitOptions): Promise<TransactionResult> {
   ```

5. **Implement parallel validation**:
   ```typescript
   async commit(options?: CommitOptions): Promise<TransactionResult> {
     checkCancellation(options?.signal, 'commit');
     const reportProgress = createProgressReporter(options?.onProgress);

     const operations = this.getOperations();
     if (operations.length === 0) {
       return { success: true, /* ... */ };
     }

     // Phase 1: Validation (0-50%)
     reportProgress?.(createProgress(0, 100, 'validating'));

     if (options?.parallelValidation && operations.length > 10) {
       // Parallel validation using batchProcess
       const validationResults = await batchProcess(
         operations,
         async (op) => this.validateOperation(op),
         {
           concurrency: 4,
           timeout: 5000,
           stopOnError: true,
           onProgress: (p) => {
             reportProgress?.(createProgress(
               Math.floor(p.percentage * 0.5),
               100,
               'validating'
             ));
           },
         }
       );

       // Check for validation failures
       const failures = validationResults.filter(r => !r.success);
       if (failures.length > 0) {
         throw new Error(`Validation failed: ${failures.length} operations invalid`);
       }
     } else {
       // Sequential validation (existing behavior)
       for (let i = 0; i < operations.length; i++) {
         checkCancellation(options?.signal, 'commit');
         await this.validateOperation(operations[i]);
         reportProgress?.(createProgress(
           Math.floor((i / operations.length) * 50),
           100,
           'validating'
         ));
       }
     }

     // Phase 2: Apply operations (50-100%)
     reportProgress?.(createProgress(50, 100, 'applying'));
     checkCancellation(options?.signal, 'commit');

     // ... existing apply logic with progress updates

     reportProgress?.(createProgress(100, 100, 'complete'));
     return result;
   }
   ```

6. **Run TypeScript compilation and tests**:
   ```bash
   npm run typecheck
   npx vitest run tests/unit/core/TransactionManager.test.ts
   ```

**Acceptance Criteria**:
- [ ] commit() accepts optional CommitOptions parameter
- [ ] parallelValidation option enables parallel validation
- [ ] Progress reports validation and apply phases
- [ ] Cancellation works at safe checkpoints
- [ ] All existing tests pass
- [ ] TypeScript compilation passes

---

## Sprint 3: Polish and Documentation

**Priority**: LOW (P3)
**Estimated Duration**: 4 hours
**Impact**: Completes integration and ensures comprehensive coverage

### Task 3.1: Enhance GraphTraversal.findAllPaths() with Cancellation

**File**: `src/core/GraphTraversal.ts`
**Estimated Time**: 1.5 hours
**Agent**: Haiku

**Description**: Add cancellation support and optional maxPaths limit to findAllPaths for early termination.

**Step-by-Step Instructions**:

1. **Open the file**: `src/core/GraphTraversal.ts`

2. **Add imports**:
   ```typescript
   import { checkCancellation } from '../utils/index.js';
   ```

3. **Update TraversalOptions** to include cancellation and limits:
   ```typescript
   export interface TraversalOptions {
     /** Direction of traversal */
     direction?: 'outgoing' | 'incoming' | 'both';
     /** Relation types to follow */
     relationTypes?: string[];
     /** Entity types to include */
     entityTypes?: string[];
     /** Maximum depth for traversal */
     maxDepth?: number;
     /** AbortSignal for cancellation */
     signal?: AbortSignal;
     /** Maximum number of paths to return (for early termination) */
     maxPaths?: number;
   }
   ```

4. **Update findAllPaths method**:
   ```typescript
   async findAllPaths(
     source: string,
     target: string,
     maxDepth: number = 5,
     options?: TraversalOptions
   ): Promise<PathResult[]> {
     checkCancellation(options?.signal, 'findAllPaths');

     const paths: PathResult[] = [];
     const maxPaths = options?.maxPaths ?? Infinity;

     // ... existing DFS setup

     const dfs = (current: string, path: string[], depth: number): void => {
       // Check cancellation periodically
       if (paths.length % 100 === 0) {
         checkCancellation(options?.signal, 'findAllPaths');
       }

       // Early termination if maxPaths reached
       if (paths.length >= maxPaths) {
         return;
       }

       // ... existing DFS logic
     };

     dfs(source, [source], 0);

     return paths;
   }
   ```

5. **Run TypeScript compilation and tests**:
   ```bash
   npm run typecheck
   npx vitest run tests/unit/core/GraphTraversal.test.ts
   ```

**Acceptance Criteria**:
- [ ] TraversalOptions includes signal and maxPaths
- [ ] findAllPaths respects cancellation signal
- [ ] maxPaths enables early termination
- [ ] All existing tests pass

---

### Task 3.2: Add Progress Callbacks to StreamingExporter

**File**: `src/features/StreamingExporter.ts`
**Estimated Time**: 1 hour
**Agent**: Haiku

**Description**: Add progress callbacks to streaming export methods.

**Step-by-Step Instructions**:

1. **Open the file**: `src/features/StreamingExporter.ts`

2. **Add imports**:
   ```typescript
   import type { ProgressCallback } from '../utils/taskScheduler.js';
   ```

3. **Create streaming options interface**:
   ```typescript
   export interface StreamingExportOptions {
     /** Progress callback */
     onProgress?: ProgressCallback;
   }
   ```

4. **Update streamJSONL method**:
   ```typescript
   async streamJSONL(
     graph: ReadonlyKnowledgeGraph,
     outputPath: string,
     options?: StreamingExportOptions
   ): Promise<StreamResult> {
     const totalItems = graph.entities.length + graph.relations.length;
     let itemsWritten = 0;

     // ... existing stream setup

     for (const entity of graph.entities) {
       // ... existing write logic
       itemsWritten++;
       if (itemsWritten % 100 === 0) {
         options?.onProgress?.({
           completed: itemsWritten,
           total: totalItems,
           percentage: Math.round((itemsWritten / totalItems) * 100),
         });
       }
     }

     // ... relations

     options?.onProgress?.({
       completed: totalItems,
       total: totalItems,
       percentage: 100,
     });

     return result;
   }
   ```

5. **Run TypeScript compilation and tests**:
   ```bash
   npm run typecheck
   npx vitest run tests/unit/features/StreamingExporter.test.ts
   ```

**Acceptance Criteria**:
- [ ] StreamingExportOptions interface created
- [ ] streamJSONL reports progress during export
- [ ] Progress updates are throttled (every 100 items)
- [ ] All existing tests pass

---

### Task 3.3: Update Index Exports and Write Tests

**Files**:
- `src/utils/index.ts`
- `src/types/index.ts`
- `tests/unit/utils/operationUtils.test.ts` (new)

**Estimated Time**: 1.5 hours
**Agent**: Haiku

**Description**: Ensure all new utilities are properly exported and create comprehensive tests.

**Step-by-Step Instructions**:

1. **Verify exports in `src/utils/index.ts`**:
   ```typescript
   // Ensure these are exported:
   export {
     checkCancellation,
     createProgressReporter,
     createProgress,
     executeWithPhases,
   } from './operationUtils.js';

   export { OperationCancelledError } from './errors.js';
   ```

2. **Verify exports in `src/types/index.ts`**:
   ```typescript
   export type { LongRunningOperationOptions } from './types.js';
   ```

3. **Create test file**: `tests/unit/utils/operationUtils.test.ts`
   ```typescript
   import { describe, it, expect, vi } from 'vitest';
   import {
     checkCancellation,
     createProgressReporter,
     createProgress,
     executeWithPhases,
     OperationCancelledError,
   } from '../../../src/utils/index.js';

   describe('operationUtils', () => {
     describe('checkCancellation', () => {
       it('should not throw when signal is undefined', () => {
         expect(() => checkCancellation(undefined)).not.toThrow();
       });

       it('should not throw when signal is not aborted', () => {
         const controller = new AbortController();
         expect(() => checkCancellation(controller.signal)).not.toThrow();
       });

       it('should throw OperationCancelledError when signal is aborted', () => {
         const controller = new AbortController();
         controller.abort();
         expect(() => checkCancellation(controller.signal)).toThrow(OperationCancelledError);
       });

       it('should include operation name in error message', () => {
         const controller = new AbortController();
         controller.abort();
         expect(() => checkCancellation(controller.signal, 'testOp'))
           .toThrow("Operation 'testOp' was cancelled");
       });
     });

     describe('createProgressReporter', () => {
       it('should return undefined when callback is undefined', () => {
         expect(createProgressReporter(undefined)).toBeUndefined();
       });

       it('should throttle progress callbacks', async () => {
         const callback = vi.fn();
         const reporter = createProgressReporter(callback, 50);

         reporter!({ completed: 1, total: 100, percentage: 1 });
         reporter!({ completed: 2, total: 100, percentage: 2 });
         reporter!({ completed: 3, total: 100, percentage: 3 });

         // Only first call should go through (within throttle window)
         expect(callback).toHaveBeenCalledTimes(1);
       });

       it('should always report 0% and 100%', () => {
         const callback = vi.fn();
         const reporter = createProgressReporter(callback, 1000);

         reporter!({ completed: 0, total: 100, percentage: 0 });
         reporter!({ completed: 100, total: 100, percentage: 100 });

         expect(callback).toHaveBeenCalledTimes(2);
       });
     });

     describe('createProgress', () => {
       it('should create progress object with correct values', () => {
         const progress = createProgress(50, 100);
         expect(progress).toEqual({
           completed: 50,
           total: 100,
           percentage: 50,
         });
       });

       it('should handle zero total', () => {
         const progress = createProgress(0, 0);
         expect(progress.percentage).toBe(0);
       });

       it('should include currentTaskId when provided', () => {
         const progress = createProgress(25, 100, 'task1');
         expect(progress.currentTaskId).toBe('task1');
       });
     });

     describe('executeWithPhases', () => {
       it('should execute phases in order', async () => {
         const order: string[] = [];

         await executeWithPhases([
           { name: 'phase1', weight: 50, execute: async () => { order.push('1'); return 1; } },
           { name: 'phase2', weight: 50, execute: async () => { order.push('2'); return 2; } },
         ]);

         expect(order).toEqual(['1', '2']);
       });

       it('should report progress correctly', async () => {
         const progressUpdates: number[] = [];

         await executeWithPhases(
           [
             { name: 'phase1', weight: 25, execute: async (p) => { p(100); return 1; } },
             { name: 'phase2', weight: 75, execute: async (p) => { p(100); return 2; } },
           ],
           (p) => progressUpdates.push(p.percentage)
         );

         expect(progressUpdates).toContain(100); // Final completion
       });

       it('should throw on cancellation', async () => {
         const controller = new AbortController();
         controller.abort();

         await expect(executeWithPhases(
           [{ name: 'phase1', weight: 100, execute: async () => 1 }],
           undefined,
           controller.signal
         )).rejects.toThrow(OperationCancelledError);
       });
     });
   });
   ```

4. **Run all tests**:
   ```bash
   npm test
   ```

**Acceptance Criteria**:
- [ ] All new utilities properly exported
- [ ] Comprehensive tests for operationUtils
- [ ] All tests pass (including new and existing)
- [ ] Test coverage maintained or improved

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing APIs | Low | High | All parameters are optional; extensive backward compatibility testing |
| Performance overhead from progress callbacks | Low | Low | Throttled callbacks (100ms default); only invoked when provided |
| Memory leaks from unclosed abort controllers | Medium | Medium | Document proper AbortController lifecycle; add cleanup in tests |
| Inconsistent progress reporting | Medium | Low | Use shared createProgress() utility; document progress phases |
| Worker pool compatibility issues | Low | Medium | Already tested via FuzzySearch; fallback to synchronous when needed |

---

## Documentation Updates

### CLAUDE.md Updates
Add new section under "Performance & Optimizations":
```markdown
### Progress and Cancellation Support

Long-running operations support optional progress tracking and cancellation:

```typescript
// Progress tracking
await manager.createEntities(entities, {
  onProgress: (p) => console.log(`${p.percentage}% complete`),
});

// Cancellation
const controller = new AbortController();
const promise = manager.compressGraph(0.8, false, {
  signal: controller.signal,
});
// Later: controller.abort();
```

Supported operations:
- EntityManager: createEntities()
- CompressionManager: findDuplicates(), compressGraph()
- IOManager: importGraph()
- ArchiveManager: archiveEntities()
- SemanticSearch: indexAll()
- TransactionManager: commit()
- GraphTraversal: findAllPaths()
- StreamingExporter: streamJSONL(), streamJSON()
```

---

## Summary

| Sprint | Tasks | Focus |
|--------|-------|-------|
| Sprint 1 | 4 | Foundation types, EntityManager, CompressionManager, IOManager |
| Sprint 2 | 3 | ArchiveManager, SemanticSearch, TransactionManager |
| Sprint 3 | 3 | GraphTraversal, StreamingExporter, Tests & Documentation |

**Total**: 10 tasks across 3 sprints

**Key deliverables**:
1. New `operationUtils.ts` with shared utilities
2. `LongRunningOperationOptions` interface for consistent API
3. Progress and cancellation in 8+ methods
4. Comprehensive test coverage
5. Updated documentation
