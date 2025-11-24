/**
 * EntityManager Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EntityManager } from '../../../core/EntityManager.js';
import { GraphStorage } from '../../../core/GraphStorage.js';
import { EntityNotFoundError, ValidationError } from '../../../utils/errors.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('EntityManager', () => {
  let storage: GraphStorage;
  let manager: EntityManager;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    // Create unique temp directory for each test
    testDir = join(tmpdir(), `entity-manager-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'test-graph.jsonl');

    storage = new GraphStorage(testFilePath);
    manager = new EntityManager(storage);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('createEntities', () => {
    it('should create a single entity with timestamps', async () => {
      const entities = await manager.createEntities([
        {
          name: 'Alice',
          entityType: 'person',
          observations: ['Software engineer'],
        },
      ]);

      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('Alice');
      expect(entities[0].entityType).toBe('person');
      expect(entities[0].observations).toEqual(['Software engineer']);
      expect(entities[0].createdAt).toBeDefined();
      expect(entities[0].lastModified).toBeDefined();
    });

    it('should create multiple entities in batch', async () => {
      const entities = await manager.createEntities([
        { name: 'Alice', entityType: 'person', observations: [] },
        { name: 'Bob', entityType: 'person', observations: [] },
        { name: 'Company', entityType: 'organization', observations: [] },
      ]);

      expect(entities).toHaveLength(3);
      expect(entities.map(e => e.name)).toEqual(['Alice', 'Bob', 'Company']);
    });

    it('should filter out duplicate entities', async () => {
      await manager.createEntities([
        { name: 'Alice', entityType: 'person', observations: [] },
      ]);

      const result = await manager.createEntities([
        { name: 'Alice', entityType: 'person', observations: ['Duplicate'] },
        { name: 'Bob', entityType: 'person', observations: [] },
      ]);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob');
    });

    it('should normalize tags to lowercase', async () => {
      const entities = await manager.createEntities([
        {
          name: 'Alice',
          entityType: 'person',
          observations: [],
          tags: ['Engineering', 'LEADERSHIP', 'Team'],
        },
      ]);

      expect(entities[0].tags).toEqual(['engineering', 'leadership', 'team']);
    });

    it('should validate importance range', async () => {
      await expect(
        manager.createEntities([
          {
            name: 'Alice',
            entityType: 'person',
            observations: [],
            importance: 11,
          },
        ])
      ).rejects.toThrow();
    });

    it('should throw ValidationError for invalid entity data', async () => {
      await expect(
        manager.createEntities([
          {
            name: '',
            entityType: 'person',
            observations: [],
          } as any,
        ])
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty array', async () => {
      await expect(
        manager.createEntities([])
      ).rejects.toThrow(ValidationError);
    });

    it('should preserve optional fields', async () => {
      const entities = await manager.createEntities([
        {
          name: 'Alice',
          entityType: 'person',
          observations: ['Engineer'],
          importance: 8,
          tags: ['team'],
          parentId: 'Company',
        },
      ]);

      expect(entities[0].importance).toBe(8);
      expect(entities[0].tags).toEqual(['team']);
      expect(entities[0].parentId).toBe('Company');
    });
  });

  describe('deleteEntities', () => {
    beforeEach(async () => {
      await manager.createEntities([
        { name: 'Alice', entityType: 'person', observations: [] },
        { name: 'Bob', entityType: 'person', observations: [] },
      ]);
    });

    it('should delete a single entity', async () => {
      await manager.deleteEntities(['Alice']);

      const alice = await manager.getEntity('Alice');
      expect(alice).toBeNull();

      const bob = await manager.getEntity('Bob');
      expect(bob).not.toBeNull();
    });

    it('should delete multiple entities', async () => {
      await manager.deleteEntities(['Alice', 'Bob']);

      const alice = await manager.getEntity('Alice');
      const bob = await manager.getEntity('Bob');

      expect(alice).toBeNull();
      expect(bob).toBeNull();
    });

    it('should silently ignore non-existent entities', async () => {
      await expect(
        manager.deleteEntities(['NonExistent'])
      ).resolves.not.toThrow();
    });

    it('should throw ValidationError for invalid input', async () => {
      await expect(
        manager.deleteEntities([])
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getEntity', () => {
    beforeEach(async () => {
      await manager.createEntities([
        {
          name: 'Alice',
          entityType: 'person',
          observations: ['Software engineer'],
          importance: 8,
        },
      ]);
    });

    it('should retrieve an existing entity', async () => {
      const alice = await manager.getEntity('Alice');

      expect(alice).not.toBeNull();
      expect(alice!.name).toBe('Alice');
      expect(alice!.entityType).toBe('person');
      expect(alice!.observations).toEqual(['Software engineer']);
      expect(alice!.importance).toBe(8);
    });

    it('should return null for non-existent entity', async () => {
      const result = await manager.getEntity('NonExistent');
      expect(result).toBeNull();
    });

    it('should be case-sensitive', async () => {
      const result = await manager.getEntity('alice');
      expect(result).toBeNull();
    });
  });

  describe('updateEntity', () => {
    beforeEach(async () => {
      await manager.createEntities([
        {
          name: 'Alice',
          entityType: 'person',
          observations: ['Engineer'],
          importance: 5,
        },
      ]);
    });

    it('should update entity importance', async () => {
      const updated = await manager.updateEntity('Alice', {
        importance: 9,
      });

      expect(updated.importance).toBe(9);
      expect(updated.name).toBe('Alice');
    });

    it('should update entity observations', async () => {
      const updated = await manager.updateEntity('Alice', {
        observations: ['Senior Engineer', 'Team Lead'],
      });

      expect(updated.observations).toEqual(['Senior Engineer', 'Team Lead']);
    });

    it('should update lastModified timestamp', async () => {
      const original = await manager.getEntity('Alice');
      const originalTimestamp = original!.lastModified;

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = await manager.updateEntity('Alice', {
        importance: 8,
      });

      expect(updated.lastModified).not.toBe(originalTimestamp);
    });

    it('should throw EntityNotFoundError for non-existent entity', async () => {
      await expect(
        manager.updateEntity('NonExistent', { importance: 5 })
      ).rejects.toThrow(EntityNotFoundError);
    });

    it('should throw ValidationError for invalid updates', async () => {
      await expect(
        manager.updateEntity('Alice', { importance: 11 } as any)
      ).rejects.toThrow(ValidationError);
    });

    it('should update multiple fields at once', async () => {
      const updated = await manager.updateEntity('Alice', {
        entityType: 'senior_engineer',
        importance: 9,
        tags: ['leadership'],
        observations: ['Lead Engineer'],
      });

      expect(updated.entityType).toBe('senior_engineer');
      expect(updated.importance).toBe(9);
      expect(updated.tags).toEqual(['leadership']);
      expect(updated.observations).toEqual(['Lead Engineer']);
    });
  });

  describe('persistence', () => {
    it('should persist entities across storage instances', async () => {
      await manager.createEntities([
        { name: 'Alice', entityType: 'person', observations: [] },
      ]);

      // Create new storage and manager instances
      const newStorage = new GraphStorage(testFilePath);
      const newManager = new EntityManager(newStorage);

      const alice = await newManager.getEntity('Alice');
      expect(alice).not.toBeNull();
      expect(alice!.name).toBe('Alice');
    });
  });
});
