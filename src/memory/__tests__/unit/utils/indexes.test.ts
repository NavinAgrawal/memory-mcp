/**
 * Index Tests
 *
 * Tests for NameIndex, TypeIndex, and LowercaseCache.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NameIndex, TypeIndex, LowercaseCache } from '../../../utils/indexes.js';
import type { Entity } from '../../../types/index.js';

const createEntity = (name: string, type: string, observations: string[] = [], tags?: string[]): Entity => ({
  name,
  entityType: type,
  observations,
  tags,
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
});

describe('NameIndex', () => {
  let index: NameIndex;

  beforeEach(() => {
    index = new NameIndex();
  });

  describe('build', () => {
    it('should build index from entities', () => {
      const entities = [
        createEntity('Alice', 'person'),
        createEntity('Bob', 'person'),
        createEntity('Acme', 'company'),
      ];

      index.build(entities);

      expect(index.size).toBe(3);
      expect(index.has('Alice')).toBe(true);
      expect(index.has('Bob')).toBe(true);
      expect(index.has('Acme')).toBe(true);
    });

    it('should clear existing index on rebuild', () => {
      index.add(createEntity('Old', 'person'));
      expect(index.has('Old')).toBe(true);

      index.build([createEntity('New', 'person')]);

      expect(index.has('Old')).toBe(false);
      expect(index.has('New')).toBe(true);
    });
  });

  describe('get', () => {
    it('should return entity by name', () => {
      const alice = createEntity('Alice', 'person');
      index.add(alice);

      expect(index.get('Alice')).toBe(alice);
    });

    it('should return undefined for non-existent name', () => {
      expect(index.get('NonExistent')).toBeUndefined();
    });
  });

  describe('add', () => {
    it('should add entity to index', () => {
      const entity = createEntity('Test', 'test');
      index.add(entity);

      expect(index.get('Test')).toBe(entity);
    });

    it('should update existing entity reference', () => {
      const entity1 = createEntity('Test', 'test');
      const entity2 = createEntity('Test', 'updated');
      index.add(entity1);
      index.add(entity2);

      expect(index.get('Test')).toBe(entity2);
      expect(index.size).toBe(1);
    });
  });

  describe('remove', () => {
    it('should remove entity from index', () => {
      index.add(createEntity('Test', 'test'));
      expect(index.has('Test')).toBe(true);

      index.remove('Test');
      expect(index.has('Test')).toBe(false);
    });

    it('should handle removing non-existent entity', () => {
      expect(() => index.remove('NonExistent')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      index.add(createEntity('A', 'test'));
      index.add(createEntity('B', 'test'));
      expect(index.size).toBe(2);

      index.clear();
      expect(index.size).toBe(0);
    });
  });
});

describe('TypeIndex', () => {
  let index: TypeIndex;

  beforeEach(() => {
    index = new TypeIndex();
  });

  describe('build', () => {
    it('should build index from entities', () => {
      const entities = [
        createEntity('Alice', 'person'),
        createEntity('Bob', 'Person'), // Different case
        createEntity('Acme', 'company'),
      ];

      index.build(entities);

      expect(index.getNames('person').size).toBe(2);
      expect(index.getNames('company').size).toBe(1);
    });

    it('should be case-insensitive', () => {
      index.add(createEntity('Test', 'UPPERCASE'));

      expect(index.getNames('uppercase').has('Test')).toBe(true);
      expect(index.getNames('UPPERCASE').has('Test')).toBe(true);
      expect(index.getNames('Uppercase').has('Test')).toBe(true);
    });
  });

  describe('getNames', () => {
    it('should return set of entity names by type', () => {
      index.add(createEntity('Alice', 'person'));
      index.add(createEntity('Bob', 'person'));

      const names = index.getNames('person');
      expect(names.has('Alice')).toBe(true);
      expect(names.has('Bob')).toBe(true);
    });

    it('should return empty set for unknown type', () => {
      const names = index.getNames('unknown');
      expect(names.size).toBe(0);
    });
  });

  describe('remove', () => {
    it('should remove entity from type bucket', () => {
      index.add(createEntity('Alice', 'person'));
      index.add(createEntity('Bob', 'person'));

      index.remove('Alice', 'person');

      const names = index.getNames('person');
      expect(names.has('Alice')).toBe(false);
      expect(names.has('Bob')).toBe(true);
    });

    it('should delete empty type buckets', () => {
      index.add(createEntity('Only', 'singleton'));
      index.remove('Only', 'singleton');

      expect(index.getTypes()).not.toContain('singleton');
    });
  });

  describe('updateType', () => {
    it('should move entity between types', () => {
      index.add(createEntity('Test', 'oldType'));
      index.updateType('Test', 'oldType', 'newType');

      expect(index.getNames('oldType').has('Test')).toBe(false);
      expect(index.getNames('newType').has('Test')).toBe(true);
    });
  });

  describe('getTypes', () => {
    it('should return all unique types', () => {
      index.add(createEntity('A', 'person'));
      index.add(createEntity('B', 'company'));
      index.add(createEntity('C', 'person'));

      const types = index.getTypes();
      expect(types).toContain('person');
      expect(types).toContain('company');
      expect(types.length).toBe(2);
    });
  });
});

describe('LowercaseCache', () => {
  let cache: LowercaseCache;

  beforeEach(() => {
    cache = new LowercaseCache();
  });

  describe('build', () => {
    it('should build cache from entities', () => {
      const entities = [
        createEntity('Alice', 'Person', ['Observation One'], ['Tag1']),
        createEntity('Bob', 'PERSON', ['OBSERVATION TWO'], ['TAG2']),
      ];

      cache.build(entities);

      expect(cache.size).toBe(2);
      expect(cache.has('Alice')).toBe(true);
      expect(cache.has('Bob')).toBe(true);
    });
  });

  describe('get', () => {
    it('should return pre-computed lowercase data', () => {
      const entity = createEntity('ALICE', 'PERSON', ['OBSERVATION'], ['TAG']);
      cache.set(entity);

      const lowercased = cache.get('ALICE');
      expect(lowercased).toBeDefined();
      expect(lowercased!.name).toBe('alice');
      expect(lowercased!.entityType).toBe('person');
      expect(lowercased!.observations).toEqual(['observation']);
      expect(lowercased!.tags).toEqual(['tag']);
    });

    it('should return undefined for non-existent entity', () => {
      expect(cache.get('NonExistent')).toBeUndefined();
    });

    it('should handle entity without tags', () => {
      const entity = createEntity('Test', 'Type', ['Obs']);
      cache.set(entity);

      const lowercased = cache.get('Test');
      expect(lowercased!.tags).toEqual([]);
    });
  });

  describe('set', () => {
    it('should add or update entity in cache', () => {
      const entity1 = createEntity('Test', 'TypeA', ['Obs1']);
      const entity2 = createEntity('Test', 'TypeB', ['Obs2']);

      cache.set(entity1);
      expect(cache.get('Test')!.entityType).toBe('typea');

      cache.set(entity2);
      expect(cache.get('Test')!.entityType).toBe('typeb');
      expect(cache.size).toBe(1);
    });
  });

  describe('remove', () => {
    it('should remove entity from cache', () => {
      cache.set(createEntity('Test', 'Type', []));
      expect(cache.has('Test')).toBe(true);

      cache.remove('Test');
      expect(cache.has('Test')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set(createEntity('A', 'Type', []));
      cache.set(createEntity('B', 'Type', []));
      expect(cache.size).toBe(2);

      cache.clear();
      expect(cache.size).toBe(0);
    });
  });
});
