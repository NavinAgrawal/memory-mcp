/**
 * Backup Operations Unit Tests
 *
 * Tests for backup creation, listing, restoration, and cleanup.
 * (Originally BackupManager, merged into IOManager in Sprint 11.4)
 * Updated for Phase 3 Sprint 2: Backup Compression
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IOManager } from '../../../src/features/IOManager.js';
import { GraphStorage } from '../../../src/core/GraphStorage.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('IOManager Backup Operations', () => {
  let storage: GraphStorage;
  let manager: IOManager;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `backup-manager-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'test-memory.jsonl');
    storage = new GraphStorage(testFilePath);
    manager = new IOManager(storage);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Constructor', () => {
    it('should create manager with storage', () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(IOManager);
    });

    it('should derive backup directory from storage path', () => {
      const backupDir = manager.getBackupDir();
      expect(backupDir).toBe(join(testDir, '.backups'));
    });
  });

  describe('createBackup', () => {
    it('should create backup file', async () => {
      // Create some data first
      await storage.saveGraph({
        entities: [{ name: 'Test', entityType: 'test', observations: [] }],
        relations: [],
      });

      const result = await manager.createBackup();

      expect(result.path).toContain('.backups');
      expect(result.path).toContain('backup_');
      expect(result.path).toContain('.jsonl');

      const exists = await fs.access(result.path).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should create metadata file alongside backup', async () => {
      await storage.saveGraph({ entities: [], relations: [] });
      const result = await manager.createBackup();

      const metadataPath = `${result.path}.meta.json`;
      const exists = await fs.access(metadataPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should include entity and relation counts in metadata', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'E1', entityType: 'test', observations: [] },
          { name: 'E2', entityType: 'test', observations: [] },
        ],
        relations: [
          { from: 'E1', to: 'E2', relationType: 'knows' },
        ],
      });

      const result = await manager.createBackup();
      const metadataContent = await fs.readFile(`${result.path}.meta.json`, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      expect(metadata.entityCount).toBe(2);
      expect(metadata.relationCount).toBe(1);
    });

    it('should include description when provided', async () => {
      await storage.saveGraph({ entities: [], relations: [] });
      const result = await manager.createBackup('Test backup');

      const metadataContent = await fs.readFile(`${result.path}.meta.json`, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      expect(metadata.description).toBe('Test backup');
    });

    it('should include timestamp in metadata', async () => {
      await storage.saveGraph({ entities: [], relations: [] });
      const beforeTime = new Date().toISOString();
      const result = await manager.createBackup();
      const afterTime = new Date().toISOString();

      const metadataContent = await fs.readFile(`${result.path}.meta.json`, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      expect(metadata.timestamp >= beforeTime).toBe(true);
      expect(metadata.timestamp <= afterTime).toBe(true);
    });

    it('should include file size in metadata', async () => {
      await storage.saveGraph({
        entities: [{ name: 'Test', entityType: 'test', observations: ['data'] }],
        relations: [],
      });
      const result = await manager.createBackup();

      const metadataContent = await fs.readFile(`${result.path}.meta.json`, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      expect(metadata.fileSize).toBeGreaterThan(0);
    });

    it('should create backup directory if it does not exist', async () => {
      await storage.saveGraph({ entities: [], relations: [] });
      await manager.createBackup();

      const backupDir = manager.getBackupDir();
      const exists = await fs.access(backupDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle empty graph', async () => {
      // Don't save anything - file doesn't exist
      const result = await manager.createBackup();

      const exists = await fs.access(result.path).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should return BackupResult with compression statistics', async () => {
      await storage.saveGraph({
        entities: [{ name: 'Test', entityType: 'test', observations: ['data'] }],
        relations: [],
      });
      const result = await manager.createBackup();

      // BackupResult properties
      expect(result.path).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.entityCount).toBe(1);
      expect(result.relationCount).toBe(0);
      expect(result.compressed).toBe(true);
      expect(result.originalSize).toBeGreaterThan(0);
      expect(result.compressedSize).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeLessThanOrEqual(1);
    });

    it('should create uncompressed backup when compress is false', async () => {
      await storage.saveGraph({
        entities: [{ name: 'Test', entityType: 'test', observations: ['data'] }],
        relations: [],
      });
      const result = await manager.createBackup({ compress: false });

      expect(result.compressed).toBe(false);
      expect(result.path).not.toContain('.br');
      expect(result.compressionRatio).toBe(1);
      expect(result.originalSize).toBe(result.compressedSize);
    });
  });

  describe('listBackups', () => {
    it('should return empty array when no backups exist', async () => {
      const backups = await manager.listBackups();
      expect(backups).toEqual([]);
    });

    it('should return list of backups', async () => {
      await storage.saveGraph({ entities: [], relations: [] });
      await manager.createBackup('Backup 1');
      await new Promise(r => setTimeout(r, 10)); // Small delay for unique timestamps
      await manager.createBackup('Backup 2');

      const backups = await manager.listBackups();
      expect(backups).toHaveLength(2);
    });

    it('should sort backups newest first', async () => {
      await storage.saveGraph({ entities: [], relations: [] });
      await manager.createBackup('First');
      await new Promise(r => setTimeout(r, 10));
      await manager.createBackup('Second');

      const backups = await manager.listBackups();
      expect(backups[0].metadata.description).toBe('Second');
      expect(backups[1].metadata.description).toBe('First');
    });

    it('should include file path and metadata', async () => {
      await storage.saveGraph({ entities: [], relations: [] });
      await manager.createBackup('Test');

      const backups = await manager.listBackups();
      expect(backups[0].fileName).toContain('backup_');
      expect(backups[0].filePath).toContain('.backups');
      expect(backups[0].metadata.timestamp).toBeDefined();
    });

    it('should skip backups without metadata files', async () => {
      await storage.saveGraph({ entities: [], relations: [] });
      await manager.createBackup();

      // Create orphan backup file without metadata
      const backupDir = manager.getBackupDir();
      await fs.writeFile(join(backupDir, 'backup_orphan.jsonl'), '{}');

      const backups = await manager.listBackups();
      expect(backups).toHaveLength(1);
    });

    it('should include compression info in backup list', async () => {
      await storage.saveGraph({ entities: [], relations: [] });
      await manager.createBackup({ description: 'Compressed backup' });

      const backups = await manager.listBackups();
      expect(backups[0].compressed).toBe(true);
      expect(backups[0].metadata.compressed).toBe(true);
      expect(backups[0].metadata.compressionFormat).toBe('brotli');
      expect(backups[0].size).toBeGreaterThan(0);
    });
  });

  describe('restoreFromBackup', () => {
    it('should restore graph from backup', async () => {
      // Create original data
      await storage.saveGraph({
        entities: [{ name: 'Original', entityType: 'test', observations: [] }],
        relations: [],
      });
      const backupResult = await manager.createBackup();

      // Modify data
      await storage.saveGraph({
        entities: [{ name: 'Modified', entityType: 'test', observations: [] }],
        relations: [],
      });

      // Restore
      const restoreResult = await manager.restoreFromBackup(backupResult.path);
      const graph = await storage.loadGraph();

      expect(graph.entities).toHaveLength(1);
      expect(graph.entities[0].name).toBe('Original');
      expect(restoreResult.entityCount).toBe(1);
    });

    it('should clear storage cache after restore', async () => {
      await storage.saveGraph({
        entities: [{ name: 'Backup', entityType: 'test', observations: [] }],
        relations: [],
      });
      const backupResult = await manager.createBackup();

      await storage.saveGraph({
        entities: [{ name: 'Current', entityType: 'test', observations: [] }],
        relations: [],
      });

      await manager.restoreFromBackup(backupResult.path);
      const graph = await storage.loadGraph();

      expect(graph.entities[0].name).toBe('Backup');
    });

    it('should throw error for non-existent backup', async () => {
      const fakePath = join(testDir, '.backups', 'nonexistent.jsonl');

      await expect(manager.restoreFromBackup(fakePath))
        .rejects.toThrow();
    });

    it('should return RestoreResult with restoration details', async () => {
      await storage.saveGraph({
        entities: [{ name: 'Test', entityType: 'test', observations: [] }],
        relations: [{ from: 'Test', to: 'Test', relationType: 'self' }],
      });
      const backupResult = await manager.createBackup();

      await storage.saveGraph({ entities: [], relations: [] });
      const restoreResult = await manager.restoreFromBackup(backupResult.path);

      expect(restoreResult.entityCount).toBe(1);
      expect(restoreResult.relationCount).toBe(1);
      expect(restoreResult.restoredFrom).toBe(backupResult.path);
      expect(restoreResult.wasCompressed).toBe(true);
    });
  });

  describe('deleteBackup', () => {
    it('should delete backup file', async () => {
      await storage.saveGraph({ entities: [], relations: [] });
      const result = await manager.createBackup();

      await manager.deleteBackup(result.path);

      const exists = await fs.access(result.path).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should delete metadata file', async () => {
      await storage.saveGraph({ entities: [], relations: [] });
      const result = await manager.createBackup();
      const metadataPath = `${result.path}.meta.json`;

      await manager.deleteBackup(result.path);

      const exists = await fs.access(metadataPath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('should throw error for non-existent backup', async () => {
      const fakePath = join(testDir, '.backups', 'nonexistent.jsonl');

      await expect(manager.deleteBackup(fakePath))
        .rejects.toThrow();
    });
  });

  describe('cleanOldBackups', () => {
    it('should keep only specified number of backups', async () => {
      await storage.saveGraph({ entities: [], relations: [] });

      for (let i = 0; i < 5; i++) {
        await manager.createBackup(`Backup ${i}`);
        await new Promise(r => setTimeout(r, 10));
      }

      const deleted = await manager.cleanOldBackups(2);

      expect(deleted).toBe(3);
      const remaining = await manager.listBackups();
      expect(remaining).toHaveLength(2);
    });

    it('should keep newest backups', async () => {
      await storage.saveGraph({ entities: [], relations: [] });

      await manager.createBackup('Oldest');
      await new Promise(r => setTimeout(r, 10));
      await manager.createBackup('Middle');
      await new Promise(r => setTimeout(r, 10));
      await manager.createBackup('Newest');

      await manager.cleanOldBackups(2);

      const remaining = await manager.listBackups();
      expect(remaining[0].metadata.description).toBe('Newest');
      expect(remaining[1].metadata.description).toBe('Middle');
    });

    it('should return 0 when fewer backups than keepCount', async () => {
      await storage.saveGraph({ entities: [], relations: [] });
      await manager.createBackup();

      const deleted = await manager.cleanOldBackups(10);
      expect(deleted).toBe(0);
    });

    it('should use default keepCount of 10', async () => {
      await storage.saveGraph({ entities: [], relations: [] });

      for (let i = 0; i < 12; i++) {
        await manager.createBackup(`Backup ${i}`);
        await new Promise(r => setTimeout(r, 5));
      }

      const deleted = await manager.cleanOldBackups();

      expect(deleted).toBe(2);
      const remaining = await manager.listBackups();
      expect(remaining).toHaveLength(10);
    }, 15000); // Extended timeout for creating multiple backups

    it('should handle no backups', async () => {
      const deleted = await manager.cleanOldBackups(5);
      expect(deleted).toBe(0);
    });
  });

  describe('getBackupDir', () => {
    it('should return backup directory path', () => {
      const backupDir = manager.getBackupDir();
      expect(backupDir).toContain('.backups');
    });
  });
});
