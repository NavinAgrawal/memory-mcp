/**
 * Storage Factory
 *
 * Factory for creating IGraphStorage implementations.
 * Supports different storage backends based on configuration.
 *
 * Currently supported:
 * - 'jsonl': JSONL file-based storage (default)
 *
 * Future support planned:
 * - 'sqlite': SQLite database storage
 *
 * @module core/StorageFactory
 */

import { GraphStorage } from './GraphStorage.js';
import type { IGraphStorage, StorageConfig } from '../types/index.js';

/**
 * Default storage type when not specified.
 */
const DEFAULT_STORAGE_TYPE = 'jsonl';

/**
 * Create a storage instance based on configuration.
 *
 * Uses environment variable MEMORY_STORAGE_TYPE to override default.
 *
 * @param config - Storage configuration
 * @returns IGraphStorage implementation
 * @throws Error if storage type is not supported
 *
 * @example
 * ```typescript
 * // Create default JSONL storage
 * const storage = createStorage({ type: 'jsonl', path: './memory.jsonl' });
 *
 * // Or use path-only shorthand (assumes jsonl type)
 * const storage = createStorageFromPath('./memory.jsonl');
 * ```
 */
export function createStorage(config: StorageConfig): IGraphStorage {
  // Allow environment override
  const storageType = process.env.MEMORY_STORAGE_TYPE || config.type || DEFAULT_STORAGE_TYPE;

  switch (storageType) {
    case 'jsonl':
      return new GraphStorage(config.path);

    case 'sqlite':
      // SQLite support planned for future implementation
      // Will require: npm install better-sqlite3
      throw new Error(
        'SQLite storage is not yet implemented. ' +
        'Use MEMORY_STORAGE_TYPE=jsonl or omit the environment variable.'
      );

    default:
      throw new Error(
        `Unknown storage type: ${storageType}. ` +
        `Supported types: jsonl (sqlite planned)`
      );
  }
}

/**
 * Create a storage instance from a file path.
 *
 * Uses default storage type (jsonl) or MEMORY_STORAGE_TYPE env var.
 *
 * @param path - Path to storage file
 * @returns IGraphStorage implementation
 */
export function createStorageFromPath(path: string): IGraphStorage {
  const storageType = (process.env.MEMORY_STORAGE_TYPE as 'jsonl' | 'sqlite') || DEFAULT_STORAGE_TYPE;
  return createStorage({ type: storageType, path });
}
