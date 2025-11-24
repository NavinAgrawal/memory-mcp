/**
 * Backup Manager
 *
 * Manages backup and restore operations for the knowledge graph.
 * Provides point-in-time recovery and data protection.
 *
 * @module features/BackupManager
 */

import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import type { GraphStorage } from '../core/GraphStorage.js';
import { FileOperationError } from '../utils/errors.js';

/**
 * Metadata stored with each backup.
 */
export interface BackupMetadata {
  /** Timestamp when backup was created (ISO 8601) */
  timestamp: string;
  /** Number of entities in the backup */
  entityCount: number;
  /** Number of relations in the backup */
  relationCount: number;
  /** File size in bytes */
  fileSize: number;
  /** Optional description/reason for backup */
  description?: string;
}

/**
 * Information about a backup file.
 */
export interface BackupInfo {
  /** Backup file name */
  fileName: string;
  /** Full path to backup file */
  filePath: string;
  /** Backup metadata */
  metadata: BackupMetadata;
}

/**
 * Manages backup and restore operations for the knowledge graph.
 *
 * Backup files are stored in a `.backups` directory next to the main graph file.
 * Each backup includes the graph data and metadata about the backup.
 *
 * @example
 * ```typescript
 * const storage = new GraphStorage('/data/memory.jsonl');
 * const backup = new BackupManager(storage);
 *
 * // Create a backup
 * const backupPath = await backup.createBackup('Before compression');
 *
 * // List available backups
 * const backups = await backup.listBackups();
 *
 * // Restore from backup
 * await backup.restoreFromBackup(backupPath);
 *
 * // Clean old backups (keep last 10)
 * await backup.cleanOldBackups(10);
 * ```
 */
export class BackupManager {
  private backupDir: string;

  constructor(private storage: GraphStorage) {
    const filePath = this.storage.getFilePath();
    const dir = dirname(filePath);
    this.backupDir = join(dir, '.backups');
  }

  /**
   * Ensure backup directory exists.
   *
   * @private
   */
  private async ensureBackupDir(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      throw new FileOperationError('create backup directory', this.backupDir, error as Error);
    }
  }

  /**
   * Generate backup file name with timestamp.
   *
   * Format: backup_YYYY-MM-DD_HH-MM-SS-mmm.jsonl
   *
   * @private
   */
  private generateBackupFileName(): string {
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/:/g, '-')
      .replace(/\./g, '-')
      .replace('T', '_')
      .replace('Z', '');
    return `backup_${timestamp}.jsonl`;
  }

  /**
   * Create a backup of the current knowledge graph.
   *
   * Backup includes:
   * - Complete graph data (entities and relations)
   * - Metadata (timestamp, counts, file size, description)
   *
   * @param description - Optional description for this backup
   * @returns Promise resolving to the backup file path
   * @throws {FileOperationError} If backup creation fails
   *
   * @example
   * ```typescript
   * // Create backup with description
   * const backupPath = await manager.createBackup('Before merging duplicates');
   *
   * // Create backup without description
   * const backupPath = await manager.createBackup();
   * ```
   */
  async createBackup(description?: string): Promise<string> {
    await this.ensureBackupDir();

    // Load current graph
    const graph = await this.storage.loadGraph();
    const fileName = this.generateBackupFileName();
    const backupPath = join(this.backupDir, fileName);

    try {
      // Read the current file content to preserve exact formatting
      const originalPath = this.storage.getFilePath();
      let fileContent: string;

      try {
        fileContent = await fs.readFile(originalPath, 'utf-8');
      } catch (error) {
        // File doesn't exist yet - generate content from graph
        const lines = [
          ...graph.entities.map(e => JSON.stringify({ type: 'entity', ...e })),
          ...graph.relations.map(r => JSON.stringify({ type: 'relation', ...r })),
        ];
        fileContent = lines.join('\n');
      }

      // Write backup file
      await fs.writeFile(backupPath, fileContent);

      // Get file stats
      const stats = await fs.stat(backupPath);

      // Create metadata
      const metadata: BackupMetadata = {
        timestamp: new Date().toISOString(),
        entityCount: graph.entities.length,
        relationCount: graph.relations.length,
        fileSize: stats.size,
        description,
      };

      // Write metadata file
      const metadataPath = `${backupPath}.meta.json`;
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      return backupPath;
    } catch (error) {
      throw new FileOperationError('create backup', backupPath, error as Error);
    }
  }

  /**
   * List all available backups, sorted by timestamp (newest first).
   *
   * @returns Promise resolving to array of backup information
   * @throws {FileOperationError} If listing fails
   *
   * @example
   * ```typescript
   * const backups = await manager.listBackups();
   * console.log(`Found ${backups.length} backups`);
   *
   * for (const backup of backups) {
   *   console.log(`${backup.fileName}: ${backup.metadata.entityCount} entities`);
   * }
   * ```
   */
  async listBackups(): Promise<BackupInfo[]> {
    try {
      // Check if backup directory exists
      try {
        await fs.access(this.backupDir);
      } catch {
        // Directory doesn't exist - no backups
        return [];
      }

      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(f => f.startsWith('backup_') && f.endsWith('.jsonl'));

      const backups: BackupInfo[] = [];

      for (const fileName of backupFiles) {
        const filePath = join(this.backupDir, fileName);
        const metadataPath = `${filePath}.meta.json`;

        try {
          // Read metadata if it exists
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          const metadata: BackupMetadata = JSON.parse(metadataContent);

          backups.push({
            fileName,
            filePath,
            metadata,
          });
        } catch {
          // Metadata file doesn't exist or is corrupt - skip this backup
          continue;
        }
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) =>
        new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime()
      );

      return backups;
    } catch (error) {
      throw new FileOperationError('list backups', this.backupDir, error as Error);
    }
  }

  /**
   * Restore the knowledge graph from a backup file.
   *
   * CAUTION: This operation overwrites the current graph with backup data.
   * Consider creating a backup before restoring.
   *
   * @param backupPath - Path to the backup file to restore from
   * @returns Promise that resolves when restore is complete
   * @throws {FileOperationError} If restore fails
   *
   * @example
   * ```typescript
   * // List backups and restore the most recent
   * const backups = await manager.listBackups();
   * if (backups.length > 0) {
   *   await manager.restoreFromBackup(backups[0].filePath);
   * }
   *
   * // Restore specific backup by path
   * await manager.restoreFromBackup('/data/.backups/backup_2024-01-15_10-30-00.jsonl');
   * ```
   */
  async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      // Verify backup file exists
      await fs.access(backupPath);

      // Read backup content
      const backupContent = await fs.readFile(backupPath, 'utf-8');

      // Write to main graph file
      const mainPath = this.storage.getFilePath();
      await fs.writeFile(mainPath, backupContent);

      // Clear storage cache to force reload
      this.storage.clearCache();
    } catch (error) {
      throw new FileOperationError('restore from backup', backupPath, error as Error);
    }
  }

  /**
   * Delete a specific backup file.
   *
   * Also deletes the associated metadata file.
   *
   * @param backupPath - Path to the backup file to delete
   * @returns Promise that resolves when deletion is complete
   * @throws {FileOperationError} If deletion fails
   *
   * @example
   * ```typescript
   * const backups = await manager.listBackups();
   * // Delete oldest backup
   * if (backups.length > 0) {
   *   await manager.deleteBackup(backups[backups.length - 1].filePath);
   * }
   * ```
   */
  async deleteBackup(backupPath: string): Promise<void> {
    try {
      // Delete backup file
      await fs.unlink(backupPath);

      // Delete metadata file (ignore errors if it doesn't exist)
      try {
        await fs.unlink(`${backupPath}.meta.json`);
      } catch {
        // Metadata file doesn't exist - that's ok
      }
    } catch (error) {
      throw new FileOperationError('delete backup', backupPath, error as Error);
    }
  }

  /**
   * Clean old backups, keeping only the most recent N backups.
   *
   * Backups are sorted by timestamp, and older backups are deleted.
   *
   * @param keepCount - Number of recent backups to keep (default: 10)
   * @returns Promise resolving to number of backups deleted
   * @throws {FileOperationError} If cleanup fails
   *
   * @example
   * ```typescript
   * // Keep only the 5 most recent backups
   * const deleted = await manager.cleanOldBackups(5);
   * console.log(`Deleted ${deleted} old backups`);
   *
   * // Keep default 10 most recent backups
   * await manager.cleanOldBackups();
   * ```
   */
  async cleanOldBackups(keepCount: number = 10): Promise<number> {
    const backups = await this.listBackups();

    // If we have fewer backups than keepCount, nothing to delete
    if (backups.length <= keepCount) {
      return 0;
    }

    // Delete backups beyond keepCount
    const backupsToDelete = backups.slice(keepCount);
    let deletedCount = 0;

    for (const backup of backupsToDelete) {
      try {
        await this.deleteBackup(backup.filePath);
        deletedCount++;
      } catch {
        // Continue deleting other backups even if one fails
        continue;
      }
    }

    return deletedCount;
  }

  /**
   * Get the path to the backup directory.
   *
   * @returns The backup directory path
   */
  getBackupDir(): string {
    return this.backupDir;
  }
}
