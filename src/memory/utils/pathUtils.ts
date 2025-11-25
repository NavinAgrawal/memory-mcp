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
import { FileOperationError } from './errors.js';

/**
 * Validate and normalize a file path to prevent path traversal attacks.
 *
 * This function:
 * - Normalizes the path to canonical form
 * - Converts relative paths to absolute paths
 * - Detects and prevents path traversal attempts (..)
 *
 * @param filePath - The file path to validate
 * @param baseDir - Optional base directory for relative paths (defaults to process.cwd())
 * @returns Validated absolute file path
 * @throws {FileOperationError} If path traversal is detected or path is invalid
 *
 * @example
 * ```typescript
 * // Valid paths
 * validateFilePath('/var/data/memory.jsonl'); // Returns absolute path
 * validateFilePath('data/memory.jsonl'); // Returns absolute path from cwd
 *
 * // Invalid paths (throws FileOperationError)
 * validateFilePath('../../../etc/passwd'); // Path traversal detected
 * validateFilePath('/var/data/../../../etc/passwd'); // Path traversal detected
 * ```
 */
export function validateFilePath(filePath: string, baseDir: string = process.cwd()): string {
  // Normalize path to remove redundant separators and resolve . and ..
  const normalized = path.normalize(filePath);

  // Convert to absolute path
  const absolute = path.isAbsolute(normalized)
    ? normalized
    : path.join(baseDir, normalized);

  // After normalization, check if path still contains .. which would indicate
  // traversal beyond the base directory
  const finalNormalized = path.normalize(absolute);

  // Split path into segments and check for suspicious patterns
  const segments = finalNormalized.split(path.sep);
  if (segments.includes('..')) {
    throw new FileOperationError(
      `Path traversal detected in file path: ${filePath}`,
      filePath
    );
  }

  return finalNormalized;
}

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
 * 1. Custom MEMORY_FILE_PATH environment variable (with path traversal protection)
 * 2. Backward compatibility: migrates memory.json to memory.jsonl
 * 3. Absolute vs relative path resolution
 *
 * @returns Resolved and validated memory file path
 * @throws {FileOperationError} If path traversal is detected in MEMORY_FILE_PATH
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
 *
 * // Invalid path (throws error)
 * process.env.MEMORY_FILE_PATH = '../../../etc/passwd';
 * await ensureMemoryFilePath(); // Throws FileOperationError
 * ```
 */
export async function ensureMemoryFilePath(): Promise<string> {
  if (process.env.MEMORY_FILE_PATH) {
    // Custom path provided, validate and resolve to absolute
    const baseDir = path.dirname(fileURLToPath(import.meta.url)) + '/../';
    const validatedPath = validateFilePath(process.env.MEMORY_FILE_PATH, baseDir);
    return validatedPath;
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
