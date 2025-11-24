/**
 * Path Utilities
 *
 * Helper functions for file path management and backward compatibility.
 * Handles memory file path resolution with environment variable support.
 *
 * @module utils/pathUtils
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Default memory file path (in same directory as compiled code).
 */
export const defaultMemoryPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../memory.jsonl'
);

/**
 * Ensure memory file path with backward compatibility migration.
 *
 * Handles:
 * 1. Custom MEMORY_FILE_PATH environment variable
 * 2. Backward compatibility: migrates memory.json to memory.jsonl
 * 3. Absolute vs relative path resolution
 *
 * @returns Resolved memory file path
 *
 * @example
 * ```typescript
 * // Use environment variable
 * process.env.MEMORY_FILE_PATH = '/data/memory.jsonl';
 * const path = await ensureMemoryFilePath(); // '/data/memory.jsonl'
 *
 * // Use default path
 * delete process.env.MEMORY_FILE_PATH;
 * const path = await ensureMemoryFilePath(); // './memory.jsonl'
 * ```
 */
export async function ensureMemoryFilePath(): Promise<string> {
  if (process.env.MEMORY_FILE_PATH) {
    // Custom path provided, resolve to absolute
    return path.isAbsolute(process.env.MEMORY_FILE_PATH)
      ? process.env.MEMORY_FILE_PATH
      : path.join(path.dirname(fileURLToPath(import.meta.url)), '../', process.env.MEMORY_FILE_PATH);
  }

  // No custom path set, check for backward compatibility migration
  const oldMemoryPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../memory.json'
  );
  const newMemoryPath = defaultMemoryPath;

  try {
    // Check if old file exists
    await fs.access(oldMemoryPath);

    try {
      // Check if new file exists
      await fs.access(newMemoryPath);
      // Both files exist, use new one (no migration needed)
      return newMemoryPath;
    } catch {
      // Old file exists, new file doesn't - migrate
      console.log('[INFO] Found legacy memory.json file, migrating to memory.jsonl for JSONL format compatibility');
      await fs.rename(oldMemoryPath, newMemoryPath);
      console.log('[INFO] Successfully migrated memory.json to memory.jsonl');
      return newMemoryPath;
    }
  } catch {
    // Old file doesn't exist, use new path
    return newMemoryPath;
  }
}
