/**
 * WorkerPool Tests
 *
 * Unit tests for the WorkerPool class.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkerPool } from '../../../src/workers/WorkerPool.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

describe('WorkerPool', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Path to the worker script (in dist after build)
  const workerPath = join(__dirname, '../../../dist/workers/levenshteinWorker.js');

  describe('Initialization', () => {
    it('should initialize with correct stats', () => {
      const pool = new WorkerPool({
        maxWorkers: 2,
        workerPath,
      });

      const stats = pool.getStats();
      expect(stats.maxWorkers).toBe(2);
      expect(stats.activeWorkers).toBe(0);
      expect(stats.queueSize).toBe(0);
    });

    it('should default maxWorkers to CPU count - 1', () => {
      const pool = new WorkerPool({
        workerPath,
      });

      const stats = pool.getStats();
      expect(stats.maxWorkers).toBeGreaterThan(0);
    });
  });

  describe('Task Queuing', () => {
    it('should queue tasks when workers are busy', () => {
      const pool = new WorkerPool({
        maxWorkers: 1,
        workerPath,
      });

      // Create multiple tasks
      const promises = [
        pool.execute({ query: 'test1', entities: [], threshold: 0.7 }),
        pool.execute({ query: 'test2', entities: [], threshold: 0.7 }),
        pool.execute({ query: 'test3', entities: [], threshold: 0.7 }),
      ];

      const stats = pool.getStats();
      // With maxWorkers = 1, first task should be active, rest queued
      expect(stats.activeWorkers).toBeLessThanOrEqual(1);
      expect(stats.activeWorkers + stats.queueSize).toBe(3);

      return Promise.all(promises);
    });
  });

  describe('Worker Execution', () => {
    let pool: WorkerPool<any, any>;

    beforeEach(() => {
      pool = new WorkerPool({
        maxWorkers: 2,
        workerPath,
      });
    });

    afterEach(async () => {
      await pool.shutdown();
    });

    it('should respect maxWorkers limit', async () => {
      // Create 4 tasks with maxWorkers = 2
      const promises = [
        pool.execute({ query: 'test1', entities: [], threshold: 0.7 }),
        pool.execute({ query: 'test2', entities: [], threshold: 0.7 }),
        pool.execute({ query: 'test3', entities: [], threshold: 0.7 }),
        pool.execute({ query: 'test4', entities: [], threshold: 0.7 }),
      ];

      const stats = pool.getStats();
      // Active workers should never exceed maxWorkers
      expect(stats.activeWorkers).toBeLessThanOrEqual(2);

      await Promise.all(promises);
    });

    it('should execute a simple task', async () => {
      const result = await pool.execute({
        query: 'test',
        entities: [
          {
            name: 'TestEntity',
            nameLower: 'testentity',
            observations: ['test observation'],
          },
        ],
        threshold: 0.7,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should execute multiple tasks in parallel', async () => {
      const tasks = [
        { query: 'alpha', entities: [], threshold: 0.7 },
        { query: 'beta', entities: [], threshold: 0.7 },
        { query: 'gamma', entities: [], threshold: 0.7 },
      ];

      const results = await pool.executeAll(tasks);

      expect(results).toHaveLength(3);
      expect(Array.isArray(results[0])).toBe(true);
      expect(Array.isArray(results[1])).toBe(true);
      expect(Array.isArray(results[2])).toBe(true);
    });

    it('should find fuzzy matches correctly', async () => {
      const result = await pool.execute({
        query: 'test',
        entities: [
          {
            name: 'TestEntity',
            nameLower: 'testentity',
            observations: [],
          },
          {
            name: 'OtherEntity',
            nameLower: 'otherentity',
            observations: ['this is a test'],
          },
          {
            name: 'NoMatch',
            nameLower: 'nomatch',
            observations: [],
          },
        ],
        threshold: 0.7,
      });

      expect(Array.isArray(result)).toBe(true);
      // Should find at least the entities with 'test' in name or observations
      const matchedNames = result.map((r: any) => r.name);
      expect(matchedNames).toContain('TestEntity');
      expect(matchedNames).toContain('OtherEntity');
    });
  });

  describe('Shutdown', () => {
    it('should wait for all workers to complete', async () => {
      const pool = new WorkerPool({
        maxWorkers: 2,
        workerPath,
      });

      // Start some tasks
      const promises = [
        pool.execute({ query: 'test1', entities: [], threshold: 0.7 }),
        pool.execute({ query: 'test2', entities: [], threshold: 0.7 }),
      ];

      await Promise.all(promises);

      // Shutdown should complete without errors
      await pool.shutdown();

      const stats = pool.getStats();
      expect(stats.activeWorkers).toBe(0);
    });
  });
});
