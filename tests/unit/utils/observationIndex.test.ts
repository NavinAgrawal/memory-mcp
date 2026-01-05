import { describe, it, expect, beforeEach } from 'vitest';
import { ObservationIndex } from '../../../src/utils/indexes.js';

describe('ObservationIndex', () => {
  let index: ObservationIndex;

  beforeEach(() => {
    index = new ObservationIndex();
  });

  describe('add and getEntitiesWithWord', () => {
    it('should index single word observations', () => {
      index.add('Entity1', ['hello world']);

      const helloEntities = index.getEntitiesWithWord('hello');
      const worldEntities = index.getEntitiesWithWord('world');

      expect(helloEntities.has('Entity1')).toBe(true);
      expect(worldEntities.has('Entity1')).toBe(true);
    });

    it('should handle multiple entities with same word', () => {
      index.add('Entity1', ['hello there']);
      index.add('Entity2', ['hello world']);

      const helloEntities = index.getEntitiesWithWord('hello');

      expect(helloEntities.size).toBe(2);
      expect(helloEntities.has('Entity1')).toBe(true);
      expect(helloEntities.has('Entity2')).toBe(true);
    });

    it('should normalize to lowercase', () => {
      index.add('Entity1', ['Hello World']);

      const lowerHello = index.getEntitiesWithWord('hello');
      const upperHello = index.getEntitiesWithWord('HELLO');
      const mixedWorld = index.getEntitiesWithWord('WoRlD');

      expect(lowerHello.has('Entity1')).toBe(true);
      expect(upperHello.has('Entity1')).toBe(true);
      expect(mixedWorld.has('Entity1')).toBe(true);
    });

    it('should split on punctuation', () => {
      index.add('Entity1', ['hello,world;test!data']);

      expect(index.getEntitiesWithWord('hello').has('Entity1')).toBe(true);
      expect(index.getEntitiesWithWord('world').has('Entity1')).toBe(true);
      expect(index.getEntitiesWithWord('test').has('Entity1')).toBe(true);
      expect(index.getEntitiesWithWord('data').has('Entity1')).toBe(true);
    });

    it('should filter out short words (less than 2 chars)', () => {
      index.add('Entity1', ['a b cd ef']);

      expect(index.getEntitiesWithWord('a').size).toBe(0);
      expect(index.getEntitiesWithWord('b').size).toBe(0);
      expect(index.getEntitiesWithWord('cd').has('Entity1')).toBe(true);
      expect(index.getEntitiesWithWord('ef').has('Entity1')).toBe(true);
    });

    it('should return empty set for unknown word', () => {
      index.add('Entity1', ['hello world']);

      const result = index.getEntitiesWithWord('nonexistent');

      expect(result.size).toBe(0);
    });
  });

  describe('remove', () => {
    it('should remove entity from index', () => {
      index.add('Entity1', ['hello world']);
      index.add('Entity2', ['hello there']);

      index.remove('Entity1');

      const helloEntities = index.getEntitiesWithWord('hello');
      const worldEntities = index.getEntitiesWithWord('world');

      expect(helloEntities.has('Entity1')).toBe(false);
      expect(helloEntities.has('Entity2')).toBe(true);
      expect(worldEntities.size).toBe(0);
    });

    it('should clean up empty word entries', () => {
      index.add('Entity1', ['unique']);

      index.remove('Entity1');

      const stats = index.getStats();
      expect(stats.wordCount).toBe(0);
      expect(stats.entityCount).toBe(0);
    });

    it('should handle removing non-existent entity', () => {
      index.add('Entity1', ['hello']);

      // Should not throw
      expect(() => index.remove('NonExistent')).not.toThrow();

      // Original entity should still be there
      expect(index.getEntitiesWithWord('hello').has('Entity1')).toBe(true);
    });
  });

  describe('getEntitiesWithAnyWord', () => {
    it('should return union of entities matching any word', () => {
      index.add('Entity1', ['hello world']);
      index.add('Entity2', ['foo bar']);
      index.add('Entity3', ['hello bar']);

      const result = index.getEntitiesWithAnyWord(['hello', 'foo']);

      expect(result.size).toBe(3);
      expect(result.has('Entity1')).toBe(true);
      expect(result.has('Entity2')).toBe(true);
      expect(result.has('Entity3')).toBe(true);
    });

    it('should return empty for no matching words', () => {
      index.add('Entity1', ['hello world']);

      const result = index.getEntitiesWithAnyWord(['foo', 'bar']);

      expect(result.size).toBe(0);
    });
  });

  describe('getEntitiesWithAllWords', () => {
    it('should return intersection of entities matching all words', () => {
      index.add('Entity1', ['hello world foo']);
      index.add('Entity2', ['hello world']);
      index.add('Entity3', ['hello foo']);

      const result = index.getEntitiesWithAllWords(['hello', 'world']);

      expect(result.size).toBe(2);
      expect(result.has('Entity1')).toBe(true);
      expect(result.has('Entity2')).toBe(true);
      expect(result.has('Entity3')).toBe(false);
    });

    it('should return empty for no matching all words', () => {
      index.add('Entity1', ['hello']);
      index.add('Entity2', ['world']);

      const result = index.getEntitiesWithAllWords(['hello', 'world']);

      expect(result.size).toBe(0);
    });

    it('should return empty for empty words array', () => {
      index.add('Entity1', ['hello world']);

      const result = index.getEntitiesWithAllWords([]);

      expect(result.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      index.add('Entity1', ['hello world']);
      index.add('Entity2', ['foo bar']);

      index.clear();

      expect(index.getEntitiesWithWord('hello').size).toBe(0);
      expect(index.getEntitiesWithWord('foo').size).toBe(0);

      const stats = index.getStats();
      expect(stats.wordCount).toBe(0);
      expect(stats.entityCount).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return correct counts', () => {
      index.add('Entity1', ['hello world']);
      index.add('Entity2', ['foo bar']);
      index.add('Entity3', ['hello']);

      const stats = index.getStats();

      // Unique words: hello, world, foo, bar = 4
      expect(stats.wordCount).toBe(4);
      expect(stats.entityCount).toBe(3);
    });
  });

  describe('performance', () => {
    it('should handle large number of entities efficiently', () => {
      const startTime = Date.now();

      // Add 1000 entities with observations
      for (let i = 0; i < 1000; i++) {
        index.add(`Entity${i}`, [
          `observation ${i} with some common words`,
          `another observation for entity ${i}`,
        ]);
      }

      // Perform 100 lookups
      for (let i = 0; i < 100; i++) {
        index.getEntitiesWithWord('observation');
        index.getEntitiesWithWord('common');
        index.getEntitiesWithWord(`entity`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 100ms for indexing + 100 lookups)
      expect(duration).toBeLessThan(100);
    });
  });
});
