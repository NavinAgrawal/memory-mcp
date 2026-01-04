/**
 * WorkerPool
 *
 * Manages a pool of worker threads for parallel task execution.
 *
 * @module workers/WorkerPool
 */

import { Worker } from 'worker_threads';
import { cpus } from 'os';

/**
 * Task in the worker pool queue.
 */
interface WorkerTask<TInput, TOutput> {
  /** Input data for the worker */
  data: TInput;
  /** Promise resolver for success */
  resolve: (result: TOutput) => void;
  /** Promise rejector for errors */
  reject: (error: Error) => void;
}

/**
 * Worker pool configuration options.
 */
interface PoolOptions {
  /** Maximum number of concurrent workers (default: CPU count - 1) */
  maxWorkers?: number;
  /** Absolute path to the worker script */
  workerPath: string;
}

/**
 * Statistics about the worker pool.
 */
export interface PoolStats {
  /** Number of currently active workers */
  activeWorkers: number;
  /** Number of tasks waiting in queue */
  queueSize: number;
  /** Maximum number of concurrent workers */
  maxWorkers: number;
}

/**
 * Worker pool for parallel task execution.
 *
 * Features:
 * - Limits concurrent workers to maxWorkers
 * - Queues tasks when all workers are busy
 * - Automatically terminates workers after task completion
 * - Supports batch execution with executeAll()
 */
export class WorkerPool<TInput, TOutput> {
  private taskQueue: WorkerTask<TInput, TOutput>[] = [];
  private activeWorkers = 0;
  private readonly maxWorkers: number;
  private readonly workerPath: string;

  constructor(options: PoolOptions) {
    this.maxWorkers = options.maxWorkers ?? Math.max(1, cpus().length - 1);
    this.workerPath = options.workerPath;
  }

  /**
   * Execute a single task in a worker thread.
   *
   * @param data - Input data for the worker
   * @returns Promise that resolves with the worker's output
   */
  async execute(data: TInput): Promise<TOutput> {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ data, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Execute multiple tasks in parallel.
   *
   * @param items - Array of input data for workers
   * @returns Promise that resolves with array of outputs
   */
  async executeAll(items: TInput[]): Promise<TOutput[]> {
    const promises = items.map(item => this.execute(item));
    return Promise.all(promises);
  }

  /**
   * Process the task queue, spawning workers as needed.
   */
  private processQueue(): void {
    while (this.taskQueue.length > 0 && this.activeWorkers < this.maxWorkers) {
      const task = this.taskQueue.shift();
      if (task) {
        this.runTask(task);
      }
    }
  }

  /**
   * Run a single task in a worker thread.
   *
   * @param task - Task to execute
   */
  private runTask(task: WorkerTask<TInput, TOutput>): void {
    this.activeWorkers++;
    let taskCompleted = false;

    const worker = new Worker(this.workerPath, {
      workerData: task.data,
    });

    worker.on('message', (result: TOutput) => {
      if (!taskCompleted) {
        taskCompleted = true;
        task.resolve(result);
        this.activeWorkers--;
        worker.terminate();
        this.processQueue();
      }
    });

    worker.on('error', (error: Error) => {
      if (!taskCompleted) {
        taskCompleted = true;
        task.reject(error);
        this.activeWorkers--;
        worker.terminate();
        this.processQueue();
      }
    });

    worker.on('exit', (code: number) => {
      if (!taskCompleted && code !== 0) {
        taskCompleted = true;
        task.reject(new Error(`Worker stopped with exit code ${code}`));
        this.activeWorkers--;
        this.processQueue();
      }
    });
  }

  /**
   * Wait for all active workers to complete.
   *
   * @returns Promise that resolves when all workers are done
   */
  async shutdown(): Promise<void> {
    while (this.activeWorkers > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Get current statistics about the worker pool.
   *
   * @returns Pool statistics
   */
  getStats(): PoolStats {
    return {
      activeWorkers: this.activeWorkers,
      queueSize: this.taskQueue.length,
      maxWorkers: this.maxWorkers,
    };
  }
}
