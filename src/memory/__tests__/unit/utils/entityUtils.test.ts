/**
 * Entity Utilities Unit Tests
 *
 * Tests for entity lookup and manipulation functions.
 */

import { describe, it, expect } from 'vitest';
import {
  findEntityByName,
  findEntitiesByNames,
  entityExists,
  getEntityIndex,
  removeEntityByName,
  getEntityNameSet,
  groupEntitiesByType,
  touchEntity,
} from '../../../utils/entityUtils.js';
import { EntityNotFoundError } from '../../../utils/errors.js';
import type { KnowledgeGraph, Entity } from '../../../types/entity.types.js';

describe('entityUtils', () => {
  const createSampleGraph = (): KnowledgeGraph => ({
    entities: [
      { name: 'Alice', entityType: 'person', observations: ['Developer'] },
      { name: 'Bob', entityType: 'person', observations: ['Manager'] },
      { name: 'Project X', entityType: 'project', observations: ['Active project'] },
      { name: 'Config', entityType: 'system', observations: ['Configuration'] },
    ],
    relations: [],
  });

  describe('findEntityByName', () => {
    it('should find existing entity', () => {
      const graph = createSampleGraph();
      const entity = findEntityByName(graph, 'Alice', true);
      expect(entity.name).toBe('Alice');
      expect(entity.entityType).toBe('person');
    });

    it('should throw EntityNotFoundError when throwIfNotFound is true', () => {
      const graph = createSampleGraph();
      expect(() => findEntityByName(graph, 'NonExistent', true)).toThrow(EntityNotFoundError);
    });

    it('should return null when throwIfNotFound is false and entity not found', () => {
      const graph = createSampleGraph();
      const entity = findEntityByName(graph, 'NonExistent', false);
      expect(entity).toBeNull();
    });

    it('should default to throwing when not found', () => {
      const graph = createSampleGraph();
      expect(() => findEntityByName(graph, 'NonExistent')).toThrow(EntityNotFoundError);
    });

    it('should find entity case-sensitively', () => {
      const graph = createSampleGraph();
      expect(() => findEntityByName(graph, 'alice', true)).toThrow(EntityNotFoundError);
    });
  });

  describe('findEntitiesByNames', () => {
    it('should find multiple entities', () => {
      const graph = createSampleGraph();
      const entities = findEntitiesByNames(graph, ['Alice', 'Bob']);
      expect(entities).toHaveLength(2);
      expect(entities.map(e => e.name)).toContain('Alice');
      expect(entities.map(e => e.name)).toContain('Bob');
    });

    it('should throw when any entity not found and throwIfAnyNotFound is true', () => {
      const graph = createSampleGraph();
      expect(() => findEntitiesByNames(graph, ['Alice', 'NonExistent'], true)).toThrow(
        EntityNotFoundError
      );
    });

    it('should skip missing entities when throwIfAnyNotFound is false', () => {
      const graph = createSampleGraph();
      const entities = findEntitiesByNames(graph, ['Alice', 'NonExistent'], false);
      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe('Alice');
    });

    it('should return empty array for empty names array', () => {
      const graph = createSampleGraph();
      const entities = findEntitiesByNames(graph, []);
      expect(entities).toEqual([]);
    });

    it('should preserve order of found entities', () => {
      const graph = createSampleGraph();
      const entities = findEntitiesByNames(graph, ['Bob', 'Alice', 'Config']);
      expect(entities[0].name).toBe('Bob');
      expect(entities[1].name).toBe('Alice');
      expect(entities[2].name).toBe('Config');
    });
  });

  describe('entityExists', () => {
    it('should return true for existing entity', () => {
      const graph = createSampleGraph();
      expect(entityExists(graph, 'Alice')).toBe(true);
    });

    it('should return false for non-existent entity', () => {
      const graph = createSampleGraph();
      expect(entityExists(graph, 'NonExistent')).toBe(false);
    });

    it('should be case-sensitive', () => {
      const graph = createSampleGraph();
      expect(entityExists(graph, 'alice')).toBe(false);
    });

    it('should work with empty graph', () => {
      const graph: KnowledgeGraph = { entities: [], relations: [] };
      expect(entityExists(graph, 'Any')).toBe(false);
    });
  });

  describe('getEntityIndex', () => {
    it('should return correct index for existing entity', () => {
      const graph = createSampleGraph();
      expect(getEntityIndex(graph, 'Alice')).toBe(0);
      expect(getEntityIndex(graph, 'Bob')).toBe(1);
      expect(getEntityIndex(graph, 'Config')).toBe(3);
    });

    it('should return -1 for non-existent entity', () => {
      const graph = createSampleGraph();
      expect(getEntityIndex(graph, 'NonExistent')).toBe(-1);
    });

    it('should be case-sensitive', () => {
      const graph = createSampleGraph();
      expect(getEntityIndex(graph, 'alice')).toBe(-1);
    });
  });

  describe('removeEntityByName', () => {
    it('should remove existing entity and return true', () => {
      const graph = createSampleGraph();
      const result = removeEntityByName(graph, 'Alice');
      expect(result).toBe(true);
      expect(graph.entities).toHaveLength(3);
      expect(entityExists(graph, 'Alice')).toBe(false);
    });

    it('should return false for non-existent entity', () => {
      const graph = createSampleGraph();
      const result = removeEntityByName(graph, 'NonExistent');
      expect(result).toBe(false);
      expect(graph.entities).toHaveLength(4);
    });

    it('should not affect other entities', () => {
      const graph = createSampleGraph();
      removeEntityByName(graph, 'Bob');
      expect(entityExists(graph, 'Alice')).toBe(true);
      expect(entityExists(graph, 'Project X')).toBe(true);
      expect(entityExists(graph, 'Config')).toBe(true);
    });
  });

  describe('getEntityNameSet', () => {
    it('should return set of all entity names', () => {
      const graph = createSampleGraph();
      const nameSet = getEntityNameSet(graph);
      expect(nameSet.size).toBe(4);
      expect(nameSet.has('Alice')).toBe(true);
      expect(nameSet.has('Bob')).toBe(true);
      expect(nameSet.has('Project X')).toBe(true);
      expect(nameSet.has('Config')).toBe(true);
    });

    it('should return empty set for empty graph', () => {
      const graph: KnowledgeGraph = { entities: [], relations: [] };
      const nameSet = getEntityNameSet(graph);
      expect(nameSet.size).toBe(0);
    });

    it('should be useful for O(1) lookups', () => {
      const graph = createSampleGraph();
      const nameSet = getEntityNameSet(graph);
      // Set.has is O(1)
      expect(nameSet.has('Alice')).toBe(true);
      expect(nameSet.has('NonExistent')).toBe(false);
    });
  });

  describe('groupEntitiesByType', () => {
    it('should group entities by type', () => {
      const graph = createSampleGraph();
      const groups = groupEntitiesByType(graph.entities);

      expect(groups.size).toBe(3);
      expect(groups.get('person')).toHaveLength(2);
      expect(groups.get('project')).toHaveLength(1);
      expect(groups.get('system')).toHaveLength(1);
    });

    it('should return empty map for empty entities', () => {
      const groups = groupEntitiesByType([]);
      expect(groups.size).toBe(0);
    });

    it('should contain correct entities in each group', () => {
      const graph = createSampleGraph();
      const groups = groupEntitiesByType(graph.entities);

      const people = groups.get('person')!;
      expect(people.map(e => e.name)).toContain('Alice');
      expect(people.map(e => e.name)).toContain('Bob');
    });
  });

  describe('touchEntity', () => {
    it('should update lastModified timestamp', () => {
      const entity: Entity = { name: 'Test', entityType: 'test', observations: [] };
      const before = new Date().toISOString();
      const result = touchEntity(entity);
      const after = new Date().toISOString();

      expect(result.lastModified).toBeDefined();
      expect(result.lastModified! >= before).toBe(true);
      expect(result.lastModified! <= after).toBe(true);
    });

    it('should return the same entity reference', () => {
      const entity: Entity = { name: 'Test', entityType: 'test', observations: [] };
      const result = touchEntity(entity);
      expect(result).toBe(entity);
    });

    it('should overwrite existing lastModified', () => {
      const entity: Entity = {
        name: 'Test',
        entityType: 'test',
        observations: [],
        lastModified: '2020-01-01T00:00:00Z',
      };
      touchEntity(entity);
      expect(entity.lastModified).not.toBe('2020-01-01T00:00:00Z');
    });
  });

  describe('Edge Cases', () => {
    it('should handle entity names with special characters', () => {
      const graph: KnowledgeGraph = {
        entities: [
          { name: 'Test<>&"\'', entityType: 'test', observations: [] },
          { name: '日本語', entityType: 'test', observations: [] },
        ],
        relations: [],
      };

      expect(findEntityByName(graph, 'Test<>&"\'', false)?.name).toBe('Test<>&"\'');
      expect(findEntityByName(graph, '日本語', false)?.name).toBe('日本語');
    });

    it('should handle empty entity name', () => {
      const graph: KnowledgeGraph = {
        entities: [{ name: '', entityType: 'test', observations: [] }],
        relations: [],
      };

      expect(entityExists(graph, '')).toBe(true);
      expect(findEntityByName(graph, '', false)?.name).toBe('');
    });

    it('should handle whitespace-only entity names', () => {
      const graph: KnowledgeGraph = {
        entities: [{ name: '   ', entityType: 'test', observations: [] }],
        relations: [],
      };

      expect(entityExists(graph, '   ')).toBe(true);
      expect(entityExists(graph, '')).toBe(false);
    });
  });
});
