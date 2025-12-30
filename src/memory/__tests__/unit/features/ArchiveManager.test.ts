/**
 * ArchiveManager Unit Tests
 *
 * Tests for entity archival based on age, importance, and tags.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ArchiveManager } from '../../../features/ArchiveManager.js';
import { GraphStorage } from '../../../core/GraphStorage.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ArchiveManager', () => {
  let storage: GraphStorage;
  let manager: ArchiveManager;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `archive-manager-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'test-memory.jsonl');
    storage = new GraphStorage(testFilePath);
    manager = new ArchiveManager(storage);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('archiveEntities - Date Criteria', () => {
    it('should archive entities older than specified date', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'Old', entityType: 'test', observations: [], lastModified: '2020-01-01T00:00:00Z' },
          { name: 'New', entityType: 'test', observations: [], lastModified: '2024-06-01T00:00:00Z' },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' });

      expect(result.archived).toBe(1);
      expect(result.entityNames).toContain('Old');
      expect(result.entityNames).not.toContain('New');
    });

    it('should not archive entities without lastModified when using olderThan', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'NoDate', entityType: 'test', observations: [] },
          { name: 'Old', entityType: 'test', observations: [], lastModified: '2020-01-01T00:00:00Z' },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' });

      expect(result.archived).toBe(1);
      expect(result.entityNames).toContain('Old');
      expect(result.entityNames).not.toContain('NoDate');
    });

    it('should archive all entities older than cutoff', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'Old1', entityType: 'test', observations: [], lastModified: '2019-01-01T00:00:00Z' },
          { name: 'Old2', entityType: 'test', observations: [], lastModified: '2020-06-01T00:00:00Z' },
          { name: 'Old3', entityType: 'test', observations: [], lastModified: '2022-12-31T00:00:00Z' },
          { name: 'New', entityType: 'test', observations: [], lastModified: '2024-01-01T00:00:00Z' },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' });

      expect(result.archived).toBe(3);
      expect(result.entityNames).toContain('Old1');
      expect(result.entityNames).toContain('Old2');
      expect(result.entityNames).toContain('Old3');
    });

    it('should not archive entities on exact cutoff date', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'Exact', entityType: 'test', observations: [], lastModified: '2023-01-01T00:00:00Z' },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' });

      expect(result.archived).toBe(0);
    });
  });

  describe('archiveEntities - Importance Criteria', () => {
    it('should archive entities with importance below threshold', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'Low', entityType: 'test', observations: [], importance: 2 },
          { name: 'High', entityType: 'test', observations: [], importance: 8 },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ importanceLessThan: 5 });

      expect(result.archived).toBe(1);
      expect(result.entityNames).toContain('Low');
      expect(result.entityNames).not.toContain('High');
    });

    it('should archive entities without importance when using importanceLessThan', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'NoImportance', entityType: 'test', observations: [] },
          { name: 'High', entityType: 'test', observations: [], importance: 8 },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ importanceLessThan: 5 });

      expect(result.archived).toBe(1);
      expect(result.entityNames).toContain('NoImportance');
    });

    it('should not archive entities at exactly the threshold', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'AtThreshold', entityType: 'test', observations: [], importance: 5 },
          { name: 'Below', entityType: 'test', observations: [], importance: 4 },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ importanceLessThan: 5 });

      expect(result.archived).toBe(1);
      expect(result.entityNames).not.toContain('AtThreshold');
      expect(result.entityNames).toContain('Below');
    });

    it('should archive entities with importance 0', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'Zero', entityType: 'test', observations: [], importance: 0 },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ importanceLessThan: 1 });

      expect(result.archived).toBe(1);
      expect(result.entityNames).toContain('Zero');
    });
  });

  describe('archiveEntities - Tag Criteria', () => {
    it('should archive entities with matching tags', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'Tagged', entityType: 'test', observations: [], tags: ['archive', 'old'] },
          { name: 'NotTagged', entityType: 'test', observations: [], tags: ['keep'] },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ tags: ['archive'] });

      expect(result.archived).toBe(1);
      expect(result.entityNames).toContain('Tagged');
      expect(result.entityNames).not.toContain('NotTagged');
    });

    it('should be case-insensitive for tag matching', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'Upper', entityType: 'test', observations: [], tags: ['ARCHIVE'] },
          { name: 'Lower', entityType: 'test', observations: [], tags: ['archive'] },
          { name: 'Mixed', entityType: 'test', observations: [], tags: ['Archive'] },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ tags: ['archive'] });

      expect(result.archived).toBe(3);
    });

    it('should archive entity if any tag matches (OR logic)', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'HasFirst', entityType: 'test', observations: [], tags: ['deprecated'] },
          { name: 'HasSecond', entityType: 'test', observations: [], tags: ['obsolete'] },
          { name: 'HasNeither', entityType: 'test', observations: [], tags: ['active'] },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ tags: ['deprecated', 'obsolete'] });

      expect(result.archived).toBe(2);
      expect(result.entityNames).toContain('HasFirst');
      expect(result.entityNames).toContain('HasSecond');
    });

    it('should not archive entities without tags when using tag criteria', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'NoTags', entityType: 'test', observations: [] },
          { name: 'EmptyTags', entityType: 'test', observations: [], tags: [] },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ tags: ['archive'] });

      expect(result.archived).toBe(0);
    });
  });

  describe('archiveEntities - Multiple Criteria (OR)', () => {
    it('should archive entities matching ANY criteria', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'OldOnly', entityType: 'test', observations: [], lastModified: '2020-01-01T00:00:00Z', importance: 8 },
          { name: 'LowImportanceOnly', entityType: 'test', observations: [], lastModified: '2024-01-01T00:00:00Z', importance: 1 },
          { name: 'TaggedOnly', entityType: 'test', observations: [], lastModified: '2024-01-01T00:00:00Z', importance: 8, tags: ['archive'] },
          { name: 'KeepMe', entityType: 'test', observations: [], lastModified: '2024-01-01T00:00:00Z', importance: 8, tags: ['keep'] },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({
        olderThan: '2023-01-01T00:00:00Z',
        importanceLessThan: 5,
        tags: ['archive'],
      });

      expect(result.archived).toBe(3);
      expect(result.entityNames).toContain('OldOnly');
      expect(result.entityNames).toContain('LowImportanceOnly');
      expect(result.entityNames).toContain('TaggedOnly');
      expect(result.entityNames).not.toContain('KeepMe');
    });

    it('should archive entity matching multiple criteria only once', async () => {
      await storage.saveGraph({
        entities: [
          {
            name: 'MatchesAll',
            entityType: 'test',
            observations: [],
            lastModified: '2020-01-01T00:00:00Z',
            importance: 1,
            tags: ['archive']
          },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({
        olderThan: '2023-01-01T00:00:00Z',
        importanceLessThan: 5,
        tags: ['archive'],
      });

      expect(result.archived).toBe(1);
      expect(result.entityNames).toHaveLength(1);
    });
  });

  describe('archiveEntities - Dry Run', () => {
    it('should preview without making changes', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'ToArchive', entityType: 'test', observations: [], lastModified: '2020-01-01T00:00:00Z' },
          { name: 'ToKeep', entityType: 'test', observations: [], lastModified: '2024-01-01T00:00:00Z' },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' }, true);

      expect(result.archived).toBe(1);
      expect(result.entityNames).toContain('ToArchive');

      // Verify graph unchanged
      const graph = await storage.loadGraph();
      expect(graph.entities).toHaveLength(2);
      expect(graph.entities.some(e => e.name === 'ToArchive')).toBe(true);
    });

    it('should return same results as actual archive', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'Old1', entityType: 'test', observations: [], lastModified: '2020-01-01T00:00:00Z' },
          { name: 'Old2', entityType: 'test', observations: [], lastModified: '2021-01-01T00:00:00Z' },
        ],
        relations: [],
      });

      const dryRunResult = await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' }, true);
      const actualResult = await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' }, false);

      expect(dryRunResult.archived).toBe(actualResult.archived);
      expect(dryRunResult.entityNames.sort()).toEqual(actualResult.entityNames.sort());
    });
  });

  describe('archiveEntities - Entity and Relation Removal', () => {
    it('should remove archived entities from graph', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'ToArchive', entityType: 'test', observations: [], lastModified: '2020-01-01T00:00:00Z' },
          { name: 'ToKeep', entityType: 'test', observations: [], lastModified: '2024-01-01T00:00:00Z' },
        ],
        relations: [],
      });

      await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' });

      const graph = await storage.loadGraph();
      expect(graph.entities).toHaveLength(1);
      expect(graph.entities[0].name).toBe('ToKeep');
    });

    it('should remove relations involving archived entities', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'Old', entityType: 'test', observations: [], lastModified: '2020-01-01T00:00:00Z' },
          { name: 'New', entityType: 'test', observations: [], lastModified: '2024-01-01T00:00:00Z' },
        ],
        relations: [
          { from: 'Old', to: 'New', relationType: 'knows' },
          { from: 'New', to: 'Old', relationType: 'knows' },
          { from: 'New', to: 'New', relationType: 'self' },
        ],
      });

      await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' });

      const graph = await storage.loadGraph();
      expect(graph.relations).toHaveLength(1);
      expect(graph.relations[0].relationType).toBe('self');
    });

    it('should remove relations where archived entity is source', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'Old', entityType: 'test', observations: [], lastModified: '2020-01-01T00:00:00Z' },
          { name: 'New', entityType: 'test', observations: [], lastModified: '2024-01-01T00:00:00Z' },
        ],
        relations: [
          { from: 'Old', to: 'New', relationType: 'knows' },
        ],
      });

      await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' });

      const graph = await storage.loadGraph();
      expect(graph.relations).toHaveLength(0);
    });

    it('should remove relations where archived entity is target', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'Old', entityType: 'test', observations: [], lastModified: '2020-01-01T00:00:00Z' },
          { name: 'New', entityType: 'test', observations: [], lastModified: '2024-01-01T00:00:00Z' },
        ],
        relations: [
          { from: 'New', to: 'Old', relationType: 'knows' },
        ],
      });

      await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' });

      const graph = await storage.loadGraph();
      expect(graph.relations).toHaveLength(0);
    });

    it('should remove relations between two archived entities', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'Old1', entityType: 'test', observations: [], lastModified: '2020-01-01T00:00:00Z' },
          { name: 'Old2', entityType: 'test', observations: [], lastModified: '2021-01-01T00:00:00Z' },
        ],
        relations: [
          { from: 'Old1', to: 'Old2', relationType: 'knows' },
        ],
      });

      await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' });

      const graph = await storage.loadGraph();
      expect(graph.entities).toHaveLength(0);
      expect(graph.relations).toHaveLength(0);
    });
  });

  describe('archiveEntities - Edge Cases', () => {
    it('should handle empty graph', async () => {
      await storage.saveGraph({ entities: [], relations: [] });

      const result = await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' });

      expect(result.archived).toBe(0);
      expect(result.entityNames).toEqual([]);
    });

    it('should handle no matching entities', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'New', entityType: 'test', observations: [], lastModified: '2024-01-01T00:00:00Z' },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' });

      expect(result.archived).toBe(0);
      expect(result.entityNames).toEqual([]);
    });

    it('should handle archiving all entities', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'E1', entityType: 'test', observations: [], importance: 1 },
          { name: 'E2', entityType: 'test', observations: [], importance: 2 },
        ],
        relations: [
          { from: 'E1', to: 'E2', relationType: 'knows' },
        ],
      });

      const result = await manager.archiveEntities({ importanceLessThan: 10 });

      expect(result.archived).toBe(2);

      const graph = await storage.loadGraph();
      expect(graph.entities).toHaveLength(0);
      expect(graph.relations).toHaveLength(0);
    });

    it('should handle empty criteria (no archiving)', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'E1', entityType: 'test', observations: [] },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({});

      expect(result.archived).toBe(0);
    });

    it('should handle empty tags array (no tag matching)', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'Tagged', entityType: 'test', observations: [], tags: ['something'] },
        ],
        relations: [],
      });

      const result = await manager.archiveEntities({ tags: [] });

      expect(result.archived).toBe(0);
    });

    it('should preserve entity order for remaining entities', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'A', entityType: 'test', observations: [], lastModified: '2024-01-01T00:00:00Z' },
          { name: 'B', entityType: 'test', observations: [], lastModified: '2020-01-01T00:00:00Z' },
          { name: 'C', entityType: 'test', observations: [], lastModified: '2024-01-01T00:00:00Z' },
        ],
        relations: [],
      });

      await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' });

      const graph = await storage.loadGraph();
      expect(graph.entities.map(e => e.name)).toEqual(['A', 'C']);
    });

    it('should handle invalid date format gracefully', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'BadDate', entityType: 'test', observations: [], lastModified: 'not-a-date' },
          { name: 'GoodDate', entityType: 'test', observations: [], lastModified: '2020-01-01T00:00:00Z' },
        ],
        relations: [],
      });

      // Invalid date will create NaN comparison, so it won't match
      const result = await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' });

      // GoodDate should still be archived
      expect(result.entityNames).toContain('GoodDate');
    });
  });

  describe('archiveEntities - Persistence', () => {
    it('should persist changes after archiving', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'ToArchive', entityType: 'test', observations: [], lastModified: '2020-01-01T00:00:00Z' },
        ],
        relations: [],
      });

      await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' });

      // Create new storage instance to verify persistence
      const newStorage = new GraphStorage(testFilePath);
      const graph = await newStorage.loadGraph();
      expect(graph.entities).toHaveLength(0);
    });

    it('should not persist changes in dry run mode', async () => {
      await storage.saveGraph({
        entities: [
          { name: 'ToArchive', entityType: 'test', observations: [], lastModified: '2020-01-01T00:00:00Z' },
        ],
        relations: [],
      });

      await manager.archiveEntities({ olderThan: '2023-01-01T00:00:00Z' }, true);

      // Create new storage instance to verify no persistence
      const newStorage = new GraphStorage(testFilePath);
      const graph = await newStorage.loadGraph();
      expect(graph.entities).toHaveLength(1);
    });
  });
});
