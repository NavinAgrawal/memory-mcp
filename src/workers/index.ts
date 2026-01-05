/**
 * Workers Module
 *
 * Worker thread utilities for parallel processing.
 * Phase 8: Uses workerpool library for worker management.
 *
 * @module workers
 */

// Re-export workerpool types for convenience
export type { Pool, PoolStats } from '@danielsimonjr/workerpool/modern';

// Note: WorkerPool.ts is deprecated as of Phase 8.
// Use workerpool directly instead:
//   import workerpool from '@danielsimonjr/workerpool';
//   const pool = workerpool.pool(workerPath, options);
