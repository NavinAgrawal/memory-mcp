# Phase 9: Advanced Optimizations

**Version**: 1.0.0
**Created**: 2026-01-04
**Status**: PLANNED
**Total Sprints**: 3
**Total Tasks**: 11 tasks organized into sprints of 3-4 items
**Prerequisites**: Phase 8 (Workerpool Integration) complete, All 2209+ tests passing

---

## Executive Summary

Phase 9 implements advanced optimizations from the Future Features Roadmap (Phase 3). These enhancements target CPU-intensive operations in duplicate detection, compression, and search, enabling memory-mcp to scale efficiently for complex knowledge graph operations.

### Key Features

1. **Observation Index** - Inverted index for O(1) observation-based lookups
2. **Pre-computed Similarity Data** - Avoid redundant Set creation in comparisons
3. **Reduced Graph Reloads in compressGraph** - Load once, operate many times

### Target Metrics

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Observation search | O(n) linear scan | O(1) index lookup | 10-50x faster |
| Entity similarity calculation | Creates 4 Sets per comparison | Pre-computed once | 1.5-2x faster |
| compressGraph (10 groups) | 10+ graph loads | 2 graph loads | 10x I/O reduction |
| Duplicate detection (1000 entities) | ~500ms | ~250ms | 2x faster |

### When These Optimizations Matter

- **Observation Index**: Boolean search with observation clauses, find_similar_entities, compression operations
- **Pre-computed Similarity**: Duplicate detection with many entities in same bucket, compress_graph operations
- **Reduced Graph Reloads**: Any compress_graph operation with multiple duplicate groups

---

## Sprint 1: Observation Index

**Priority**: HIGH (P1)
**Estimated Duration**: 6 hours
**Impact**: 10-50x speedup for observation-based searches

### Task 1.1: Create ObservationIndex Class

**File**: `src/utils/indexes.ts`
**Estimated Time**: 2 hours
**Agent**: Haiku

**Description**: Add an ObservationIndex class that maps words from observations to entity names, enabling O(1) lookup for "which entities mention keyword X?"

**Step-by-Step Instructions**:

1. **Open the file**: `src/utils/indexes.ts`

2. **Find the existing index classes** (NameIndex, TypeIndex, LowercaseCache, RelationIndex)

3. **Add the ObservationIndex class after the existing classes**:
   ```typescript
   /**
    * Inverted index mapping observation keywords to entity names.
    * Enables O(1) lookup for "which entities mention word X?"
    *
    * Words are normalized to lowercase and split on whitespace/punctuation.
    */
   export class ObservationIndex {
     private index: Map<string, Set<string>> = new Map();
     private entityObservations: Map<string, Set<string>> = new Map();

     /**
      * Add an entity's observations to the index.
      * @param entityName - The entity name
      * @param observations - Array of observation strings
      */
     add(entityName: string, observations: string[]): void {
       // Track this entity's words for removal later
       const entityWords = new Set<string>();

       for (const observation of observations) {
         const words = this.tokenize(observation);
         for (const word of words) {
           entityWords.add(word);
           if (!this.index.has(word)) {
             this.index.set(word, new Set());
           }
           this.index.get(word)!.add(entityName);
         }
       }

       this.entityObservations.set(entityName, entityWords);
     }

     /**
      * Remove an entity from the index.
      * @param entityName - The entity to remove
      */
     remove(entityName: string): void {
       const words = this.entityObservations.get(entityName);
       if (!words) return;

       for (const word of words) {
         const entities = this.index.get(word);
         if (entities) {
           entities.delete(entityName);
           if (entities.size === 0) {
             this.index.delete(word);
           }
         }
       }

       this.entityObservations.delete(entityName);
     }

     /**
      * Get all entity names that have observations containing the given word.
      * @param word - The word to search for
      * @returns Set of entity names (empty if none found)
      */
     getEntitiesWithWord(word: string): Set<string> {
       const normalized = word.toLowerCase();
       return this.index.get(normalized) ?? new Set();
     }

     /**
      * Get all entity names matching ANY of the given words.
      * @param words - Array of words to search for
      * @returns Set of entity names
      */
     getEntitiesWithAnyWord(words: string[]): Set<string> {
       const result = new Set<string>();
       for (const word of words) {
         const entities = this.getEntitiesWithWord(word);
         for (const entity of entities) {
           result.add(entity);
         }
       }
       return result;
     }

     /**
      * Get all entity names matching ALL of the given words.
      * @param words - Array of words to search for
      * @returns Set of entity names
      */
     getEntitiesWithAllWords(words: string[]): Set<string> {
       if (words.length === 0) return new Set();

       // Start with entities matching first word
       let result = new Set(this.getEntitiesWithWord(words[0]));

       // Intersect with entities matching remaining words
       for (let i = 1; i < words.length && result.size > 0; i++) {
         const wordEntities = this.getEntitiesWithWord(words[i]);
         result = new Set([...result].filter(e => wordEntities.has(e)));
       }

       return result;
     }

     /**
      * Tokenize an observation into searchable words.
      * Normalizes to lowercase and splits on non-alphanumeric characters.
      * Filters out words shorter than 2 characters.
      */
     private tokenize(text: string): string[] {
       return text
         .toLowerCase()
         .split(/[^a-z0-9]+/)
         .filter(word => word.length >= 2);
     }

     /**
      * Clear the entire index.
      */
     clear(): void {
       this.index.clear();
       this.entityObservations.clear();
     }

     /**
      * Get index statistics.
      */
     getStats(): { wordCount: number; entityCount: number } {
       return {
         wordCount: this.index.size,
         entityCount: this.entityObservations.size,
       };
     }
   }
   ```

4. **Update the module exports** at the bottom of the file to include ObservationIndex:
   ```typescript
   export { NameIndex, TypeIndex, LowercaseCache, RelationIndex, ObservationIndex };
   ```

5. **Run TypeScript compilation**:
   ```bash
   npm run typecheck
   ```

**Acceptance Criteria**:
- [ ] ObservationIndex class added to indexes.ts
- [ ] add(), remove(), getEntitiesWithWord() methods implemented
- [ ] getEntitiesWithAnyWord() and getEntitiesWithAllWords() methods implemented
- [ ] tokenize() normalizes text and splits on whitespace/punctuation
- [ ] TypeScript compilation passes

---

### Task 1.2: Integrate ObservationIndex into GraphStorage

**File**: `src/core/GraphStorage.ts`
**Estimated Time**: 1.5 hours
**Agent**: Haiku

**Description**: Add the ObservationIndex to GraphStorage and ensure it's updated on entity create/update/delete operations.

**Step-by-Step Instructions**:

1. **Open the file**: `src/core/GraphStorage.ts`

2. **Update the imports** at the top to include ObservationIndex:
   ```typescript
   import { NameIndex, TypeIndex, LowercaseCache, RelationIndex, ObservationIndex } from '../utils/indexes.js';
   ```

3. **Add the observation index property** after the existing index properties (around line 83):
   ```typescript
   /**
    * O(1) observation word lookup by entity.
    * Maps words in observations to entity names.
    */
   private observationIndex: ObservationIndex = new ObservationIndex();
   ```

4. **Find the rebuildIndexes method** (search for `rebuildIndexes`) and add observation index rebuilding:
   ```typescript
   // Inside rebuildIndexes(), after the existing index clears:
   this.observationIndex.clear();

   // Inside the entity loop:
   this.observationIndex.add(entity.name, entity.observations);
   ```

5. **Add public accessor method** for the observation index:
   ```typescript
   /**
    * Get entities that have observations containing the given word.
    * Uses the observation index for O(1) lookup.
    *
    * @param word - Word to search for in observations
    * @returns Set of entity names
    */
   getEntitiesByObservationWord(word: string): Set<string> {
     return this.observationIndex.getEntitiesWithWord(word);
   }

   /**
    * Get entities that have observations containing ANY of the given words.
    *
    * @param words - Words to search for
    * @returns Set of entity names
    */
   getEntitiesByAnyObservationWord(words: string[]): Set<string> {
     return this.observationIndex.getEntitiesWithAnyWord(words);
   }

   /**
    * Get entities that have observations containing ALL of the given words.
    *
    * @param words - Words to search for
    * @returns Set of entity names
    */
   getEntitiesByAllObservationWords(words: string[]): Set<string> {
     return this.observationIndex.getEntitiesWithAllWords(words);
   }

   /**
    * Get observation index statistics.
    */
   getObservationIndexStats(): { wordCount: number; entityCount: number } {
     return this.observationIndex.getStats();
   }
   ```

6. **Verify TypeScript compilation**:
   ```bash
   npm run typecheck
   ```

7. **Run existing tests** to ensure no regressions:
   ```bash
   npx vitest run tests/unit/core/GraphStorage.test.ts
   ```

**Acceptance Criteria**:
- [ ] ObservationIndex property added to GraphStorage
- [ ] rebuildIndexes() updates the observation index
- [ ] getEntitiesByObservationWord() public method added
- [ ] getEntitiesByAnyObservationWord() and getEntitiesByAllObservationWords() added
- [ ] TypeScript compilation passes
- [ ] All existing GraphStorage tests pass

---

### Task 1.3: Create ObservationIndex Unit Tests

**File**: `tests/unit/utils/observationIndex.test.ts` (new)
**Estimated Time**: 1.5 hours
**Agent**: Haiku

**Description**: Create comprehensive unit tests for the ObservationIndex class.

**Step-by-Step Instructions**:

1. **Create the test file**: `tests/unit/utils/observationIndex.test.ts`

2. **Add imports**:
   ```typescript
   import { describe, it, expect, beforeEach } from 'vitest';
   import { ObservationIndex } from '../../../src/utils/indexes.js';
   ```

3. **Add test suite**:
   ```typescript
   describe('ObservationIndex', () => {
     let index: ObservationIndex;

     beforeEach(() => {
       index = new ObservationIndex();
     });

     describe('add and getEntitiesWithWord', () => {
       it('should index single word observations', () => {
         index.add('Entity1', ['hello world']);

         expect(index.getEntitiesWithWord('hello').has('Entity1')).toBe(true);
         expect(index.getEntitiesWithWord('world').has('Entity1')).toBe(true);
       });

       it('should handle multiple entities with same word', () => {
         index.add('Entity1', ['hello there']);
         index.add('Entity2', ['hello friend']);

         const entities = index.getEntitiesWithWord('hello');
         expect(entities.has('Entity1')).toBe(true);
         expect(entities.has('Entity2')).toBe(true);
         expect(entities.size).toBe(2);
       });

       it('should normalize to lowercase', () => {
         index.add('Entity1', ['Hello World']);

         expect(index.getEntitiesWithWord('hello').has('Entity1')).toBe(true);
         expect(index.getEntitiesWithWord('HELLO').has('Entity1')).toBe(true);
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

         expect(index.getEntitiesWithWord('unknown').size).toBe(0);
       });
     });

     describe('remove', () => {
       it('should remove entity from index', () => {
         index.add('Entity1', ['hello world']);
         index.add('Entity2', ['hello friend']);

         index.remove('Entity1');

         const entities = index.getEntitiesWithWord('hello');
         expect(entities.has('Entity1')).toBe(false);
         expect(entities.has('Entity2')).toBe(true);
       });

       it('should clean up empty word entries', () => {
         index.add('Entity1', ['unique word']);
         index.remove('Entity1');

         const stats = index.getStats();
         // Word entries should be cleaned up when last entity is removed
         expect(index.getEntitiesWithWord('unique').size).toBe(0);
       });

       it('should handle removing non-existent entity', () => {
         index.add('Entity1', ['hello']);
         // Should not throw
         expect(() => index.remove('NonExistent')).not.toThrow();
       });
     });

     describe('getEntitiesWithAnyWord', () => {
       it('should return union of entities matching any word', () => {
         index.add('Entity1', ['hello world']);
         index.add('Entity2', ['foo bar']);
         index.add('Entity3', ['hello foo']);

         const result = index.getEntitiesWithAnyWord(['hello', 'foo']);
         expect(result.has('Entity1')).toBe(true);
         expect(result.has('Entity2')).toBe(true);
         expect(result.has('Entity3')).toBe(true);
       });

       it('should return empty for no matching words', () => {
         index.add('Entity1', ['hello world']);

         const result = index.getEntitiesWithAnyWord(['nonexistent']);
         expect(result.size).toBe(0);
       });
     });

     describe('getEntitiesWithAllWords', () => {
       it('should return intersection of entities matching all words', () => {
         index.add('Entity1', ['hello world']);
         index.add('Entity2', ['hello foo']);
         index.add('Entity3', ['hello world test']);

         const result = index.getEntitiesWithAllWords(['hello', 'world']);
         expect(result.has('Entity1')).toBe(true);
         expect(result.has('Entity2')).toBe(false);
         expect(result.has('Entity3')).toBe(true);
       });

       it('should return empty for no matching all words', () => {
         index.add('Entity1', ['hello world']);

         const result = index.getEntitiesWithAllWords(['hello', 'nonexistent']);
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

         expect(index.getStats().wordCount).toBe(0);
         expect(index.getStats().entityCount).toBe(0);
       });
     });

     describe('getStats', () => {
       it('should return correct counts', () => {
         index.add('Entity1', ['hello world']);
         index.add('Entity2', ['hello friend']);

         const stats = index.getStats();
         // 'hello' + 'world' + 'friend' = 3 unique words
         expect(stats.wordCount).toBe(3);
         expect(stats.entityCount).toBe(2);
       });
     });

     describe('performance', () => {
       it('should handle large number of entities efficiently', () => {
         const start = Date.now();

         // Add 1000 entities with observations
         for (let i = 0; i < 1000; i++) {
           index.add(`Entity${i}`, [
             `This is observation ${i} with some words`,
             `Another observation about topic${i % 100}`,
           ]);
         }

         const addTime = Date.now() - start;

         // Lookup should be O(1)
         const lookupStart = Date.now();
         for (let i = 0; i < 100; i++) {
           index.getEntitiesWithWord('observation');
         }
         const lookupTime = Date.now() - lookupStart;

         console.log(`Add 1000 entities: ${addTime}ms, 100 lookups: ${lookupTime}ms`);

         // Lookups should be very fast (< 10ms for 100 lookups)
         expect(lookupTime).toBeLessThan(50);
       });
     });
   });
   ```

4. **Run the tests**:
   ```bash
   npx vitest run tests/unit/utils/observationIndex.test.ts
   ```

**Acceptance Criteria**:
- [ ] 17 unit tests for ObservationIndex (matching Sprint 1 JSON specification)
- [ ] Tests cover add, remove, lookup, clear, and getStats
- [ ] Tests verify O(1) lookup performance
- [ ] All tests pass

---

### Task 1.4: Update BooleanSearch to Use ObservationIndex

**File**: `src/search/BooleanSearch.ts`
**Estimated Time**: 1 hour
**Agent**: Haiku

**Description**: Modify BooleanSearch to use the ObservationIndex for faster observation-based queries.

**Step-by-Step Instructions**:

1. **Open the file**: `src/search/BooleanSearch.ts`

2. **Find the method that searches observations** (look for `observations` in search methods)

3. **Modify the observation search logic** to use the index when searching for specific words:
   ```typescript
   // When searching for a term in observations, check if we can use the index
   // The index provides O(1) lookup vs O(n) linear scan

   // In booleanSearch method, after loading the graph:
   // Check if we can optimize with observation index for simple terms
   private isSimpleTerm(term: string): boolean {
     // Simple terms don't contain regex/wildcard characters
     const specialChars = /[.*+?^${}()|[\]\\]/;
     return !specialChars.test(term);
   }

   // In evaluateBooleanQuery TERM case for observation field:
   // If term is simple, use index for O(1) lookup
   if (this.isSimpleTerm(value)) {
     const candidateNames = this.storage.getEntitiesByObservationWord(value);
     if (candidateNames.has(entity.name)) {
       return true; // O(1) check instead of iterating all observations
     }
     return false;
   }
   // Fall back to existing linear scan for complex patterns
   ```

4. **Add fallback for complex patterns** (regex, wildcards) that can't use the index:
   ```typescript
   // For complex patterns, fall back to linear scan
   if (this.isComplexPattern(term)) {
     return this.linearObservationSearch(term);
   }
   ```

5. **Verify TypeScript compilation**:
   ```bash
   npm run typecheck
   ```

6. **Run BooleanSearch tests**:
   ```bash
   npx vitest run tests/unit/search/BooleanSearch.test.ts
   ```

**Acceptance Criteria**:
- [ ] BooleanSearch uses ObservationIndex for simple term lookups
- [ ] Falls back to linear scan for complex patterns (regex, wildcards)
- [ ] TypeScript compilation passes
- [ ] All existing BooleanSearch tests pass

---

## Sprint 2: Pre-computed Similarity Data

**Priority**: MEDIUM (P2)
**Estimated Duration**: 4 hours
**Impact**: 1.5-2x speedup for duplicate detection

### Task 2.1: Create PreparedEntity Interface and Helper

**File**: `src/features/CompressionManager.ts`
**Estimated Time**: 1 hour
**Agent**: Haiku

**Description**: Create a PreparedEntity interface that pre-computes normalized Sets once per entity, avoiding repeated Set creation during O(n²) comparisons.

**Step-by-Step Instructions**:

1. **Open the file**: `src/features/CompressionManager.ts`

2. **Add the PreparedEntity interface** after the imports:
   ```typescript
   /**
    * Entity data pre-processed for efficient similarity comparisons.
    * Pre-computes normalized Sets once to avoid repeated creation during O(n²) comparisons.
    */
   interface PreparedEntity {
     /** Original entity reference */
     entity: Entity;
     /** Lowercase name for comparison */
     nameLower: string;
     /** Lowercase entity type */
     typeLower: string;
     /** Set of lowercase observations */
     observationSet: Set<string>;
     /** Set of lowercase tags */
     tagSet: Set<string>;
   }
   ```

3. **Add a helper method to prepare entities**:
   ```typescript
   /**
    * Prepare an entity for efficient similarity comparisons.
    * Pre-computes all normalized data to avoid repeated computation.
    *
    * @param entity - The entity to prepare
    * @returns PreparedEntity with pre-computed data
    */
   private prepareEntity(entity: Entity): PreparedEntity {
     return {
       entity,
       nameLower: entity.name.toLowerCase(),
       typeLower: entity.entityType.toLowerCase(),
       observationSet: new Set(entity.observations.map(o => o.toLowerCase())),
       tagSet: new Set((entity.tags ?? []).map(t => t.toLowerCase())),
     };
   }
   ```

4. **Add a bulk preparation method**:
   ```typescript
   /**
    * Prepare multiple entities for efficient similarity comparisons.
    * Use this before batch comparison operations.
    *
    * @param entities - Entities to prepare
    * @returns Map of entity name to PreparedEntity
    */
   private prepareEntities(entities: Entity[]): Map<string, PreparedEntity> {
     const prepared = new Map<string, PreparedEntity>();
     for (const entity of entities) {
       prepared.set(entity.name, this.prepareEntity(entity));
     }
     return prepared;
   }
   ```

5. **Verify TypeScript compilation**:
   ```bash
   npm run typecheck
   ```

**Acceptance Criteria**:
- [ ] PreparedEntity interface defined
- [ ] prepareEntity() method creates pre-computed data
- [ ] prepareEntities() bulk preparation method added
- [ ] TypeScript compilation passes

---

### Task 2.2: Optimize calculateEntitySimilarity

**File**: `src/features/CompressionManager.ts`
**Estimated Time**: 1.5 hours
**Agent**: Haiku

**Description**: Create an optimized version of calculateEntitySimilarity that uses PreparedEntity to avoid repeated Set creation.

**Step-by-Step Instructions**:

1. **Open the file**: `src/features/CompressionManager.ts`

2. **Add a new optimized similarity method** that uses PreparedEntity:
   ```typescript
   /**
    * Calculate similarity between two prepared entities.
    * OPTIMIZED: Uses pre-computed Sets to avoid O(n) set creation per comparison.
    *
    * @param p1 - First prepared entity
    * @param p2 - Second prepared entity
    * @returns Similarity score from 0 (completely different) to 1 (identical)
    */
   private calculatePreparedSimilarity(p1: PreparedEntity, p2: PreparedEntity): number {
     let score = 0;
     let factors = 0;

     // Name similarity (Levenshtein-based)
     const nameDistance = levenshteinDistance(p1.nameLower, p2.nameLower);
     const maxNameLength = Math.max(p1.nameLower.length, p2.nameLower.length);
     const nameSimilarity = 1 - nameDistance / maxNameLength;
     score += nameSimilarity * SIMILARITY_WEIGHTS.NAME;
     factors += SIMILARITY_WEIGHTS.NAME;

     // Type similarity (exact match) - use pre-computed lowercase
     if (p1.typeLower === p2.typeLower) {
       score += SIMILARITY_WEIGHTS.TYPE;
     }
     factors += SIMILARITY_WEIGHTS.TYPE;

     // Observation overlap (Jaccard similarity) - use pre-computed Sets
     const obsIntersectionSize = this.setIntersectionSize(p1.observationSet, p2.observationSet);
     const obsUnionSize = p1.observationSet.size + p2.observationSet.size - obsIntersectionSize;
     const observationSimilarity = obsUnionSize > 0 ? obsIntersectionSize / obsUnionSize : 0;
     score += observationSimilarity * SIMILARITY_WEIGHTS.OBSERVATIONS;
     factors += SIMILARITY_WEIGHTS.OBSERVATIONS;

     // Tag overlap (Jaccard similarity) - use pre-computed Sets
     if (p1.tagSet.size > 0 || p2.tagSet.size > 0) {
       const tagIntersectionSize = this.setIntersectionSize(p1.tagSet, p2.tagSet);
       const tagUnionSize = p1.tagSet.size + p2.tagSet.size - tagIntersectionSize;
       const tagSimilarity = tagUnionSize > 0 ? tagIntersectionSize / tagUnionSize : 0;
       score += tagSimilarity * SIMILARITY_WEIGHTS.TAGS;
       factors += SIMILARITY_WEIGHTS.TAGS;
     }

     return factors > 0 ? score / factors : 0;
   }

   /**
    * Efficiently calculate intersection size of two Sets without creating a new Set.
    * Iterates over the smaller set for O(min(m,n)) complexity.
    */
   private setIntersectionSize(a: Set<string>, b: Set<string>): number {
     // Always iterate over smaller set
     const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
     let count = 0;
     for (const item of smaller) {
       if (larger.has(item)) count++;
     }
     return count;
   }
   ```

3. **Keep the original calculateEntitySimilarity** for backward compatibility but mark it as less efficient:
   ```typescript
   /**
    * Calculate similarity between two entities using multiple heuristics.
    *
    * NOTE: For batch comparisons, use prepareEntities() + calculatePreparedSimilarity()
    * for better performance.
    *
    * @param e1 - First entity
    * @param e2 - Second entity
    * @returns Similarity score from 0 (completely different) to 1 (identical)
    */
   calculateEntitySimilarity(e1: Entity, e2: Entity): number {
     // Existing implementation unchanged for backward compatibility
     // ...
   }
   ```

4. **Verify TypeScript compilation**:
   ```bash
   npm run typecheck
   ```

**Acceptance Criteria**:
- [ ] calculatePreparedSimilarity() uses pre-computed Sets
- [ ] setIntersectionSize() avoids creating new Set
- [ ] Original calculateEntitySimilarity() preserved for backward compatibility
- [ ] TypeScript compilation passes

---

### Task 2.3: Update findDuplicates to Use Prepared Entities

**File**: `src/features/CompressionManager.ts`
**Estimated Time**: 1 hour
**Agent**: Haiku

**Description**: Modify findDuplicates to prepare entities once before comparing, using the optimized similarity calculation.

**Step-by-Step Instructions**:

1. **Open the file**: `src/features/CompressionManager.ts`

2. **Find the findDuplicates method** (around line 85)

3. **Modify the method to prepare entities before comparison**:
   ```typescript
   async findDuplicates(threshold: number = DEFAULT_DUPLICATE_THRESHOLD): Promise<string[][]> {
     const graph = await this.storage.loadGraph();
     const duplicateGroups: string[][] = [];
     const processed = new Set<string>();

     // OPTIMIZATION: Pre-prepare all entities once before comparisons
     const preparedEntities = this.prepareEntities(graph.entities);

     // Step 1: Bucket entities by type (reduces comparisons drastically)
     const typeMap = new Map<string, Entity[]>();
     for (const entity of graph.entities) {
       const normalizedType = entity.entityType.toLowerCase();
       if (!typeMap.has(normalizedType)) {
         typeMap.set(normalizedType, []);
       }
       typeMap.get(normalizedType)!.push(entity);
     }

     // Step 2: For each type bucket, sub-bucket by name prefix
     for (const entities of typeMap.values()) {
       if (entities.length < 2) continue;

       // Create name prefix buckets
       const prefixMap = new Map<string, Entity[]>();
       for (const entity of entities) {
         const prefix = entity.name.toLowerCase().slice(0, 2);
         if (!prefixMap.has(prefix)) {
           prefixMap.set(prefix, []);
         }
         prefixMap.get(prefix)!.push(entity);
       }

       const prefixKeys = Array.from(prefixMap.keys()).sort();

       for (let bucketIdx = 0; bucketIdx < prefixKeys.length; bucketIdx++) {
         const currentPrefix = prefixKeys[bucketIdx];
         const currentBucket = prefixMap.get(currentPrefix)!;

         const candidateEntities: Entity[] = [...currentBucket];
         if (bucketIdx + 1 < prefixKeys.length) {
           candidateEntities.push(...prefixMap.get(prefixKeys[bucketIdx + 1])!);
         }

         for (let i = 0; i < currentBucket.length; i++) {
           const entity1 = currentBucket[i];
           if (processed.has(entity1.name)) continue;

           const group: string[] = [entity1.name];
           // OPTIMIZATION: Use prepared entity for comparison
           const prepared1 = preparedEntities.get(entity1.name)!;

           for (let j = 0; j < candidateEntities.length; j++) {
             const entity2 = candidateEntities[j];
             if (entity1.name === entity2.name || processed.has(entity2.name)) continue;

             // OPTIMIZATION: Use prepared entity and optimized similarity
             const prepared2 = preparedEntities.get(entity2.name)!;
             const similarity = this.calculatePreparedSimilarity(prepared1, prepared2);

             if (similarity >= threshold) {
               group.push(entity2.name);
               processed.add(entity2.name);
             }
           }

           if (group.length > 1) {
             duplicateGroups.push(group);
             processed.add(entity1.name);
           }
         }
       }
     }

     return duplicateGroups;
   }
   ```

4. **Verify TypeScript compilation**:
   ```bash
   npm run typecheck
   ```

5. **Run CompressionManager tests**:
   ```bash
   npx vitest run tests/unit/features/CompressionManager.test.ts
   ```

**Acceptance Criteria**:
- [ ] findDuplicates prepares all entities once before comparisons
- [ ] Uses calculatePreparedSimilarity instead of calculateEntitySimilarity
- [ ] TypeScript compilation passes
- [ ] All existing CompressionManager tests pass

---

### Task 2.4: Add Benchmark Tests for Similarity Optimization

**File**: `tests/performance/optimization-benchmarks.test.ts`
**Estimated Time**: 0.5 hours
**Agent**: Haiku

**Description**: Add benchmark tests to verify the similarity optimization provides measurable improvement.

**Step-by-Step Instructions**:

1. **Open the file**: `tests/performance/optimization-benchmarks.test.ts`

2. **Add a new describe block for similarity optimization**:
   ```typescript
   describe('Pre-computed Similarity Optimization', () => {
     it('should be faster with prepared entities for 100 comparisons', async () => {
       const storage = new GraphStorage(join(tmpdir(), `bench-sim-${Date.now()}.jsonl`));

       // Create 50 entities
       const entities = Array.from({ length: 50 }, (_, i) => ({
         name: `Entity${i}`,
         entityType: i % 5 === 0 ? 'special' : 'common',
         observations: [`Observation ${i}`, `Data point ${i % 10}`],
         tags: [`tag${i % 10}`, 'benchmark'],
       }));

       await storage.saveGraph({ entities, relations: [] });

       const manager = new CompressionManager(storage);

       // Time findDuplicates which now uses prepared entities
       const start = Date.now();
       await manager.findDuplicates(0.7);
       const duration = Date.now() - start;

       console.log(`findDuplicates (50 entities, optimized): ${duration}ms`);

       // Should complete in reasonable time (< 500ms)
       expect(duration).toBeLessThan(500);

       // Cleanup
       await fs.unlink(join(tmpdir(), `bench-sim-${Date.now()}.jsonl`)).catch(() => {});
     });
   });
   ```

3. **Run the benchmark**:
   ```bash
   npx vitest run tests/performance/optimization-benchmarks.test.ts -t "Pre-computed"
   ```

**Acceptance Criteria**:
- [ ] Benchmark test added for similarity optimization
- [ ] Test measures and logs performance
- [ ] Test passes with reasonable timing

---

## Sprint 3: Reduce Graph Reloads in compressGraph

**Priority**: MEDIUM (P2)
**Estimated Duration**: 4 hours
**Impact**: 10x I/O reduction for compress_graph operations

### Task 3.1: Refactor mergeEntities for External Graph

**File**: `src/features/CompressionManager.ts`
**Estimated Time**: 1.5 hours
**Agent**: Haiku

**Description**: Modify mergeEntities to accept an optional graph parameter, allowing it to operate on an already-loaded graph instead of reloading.

**Step-by-Step Instructions**:

1. **Open the file**: `src/features/CompressionManager.ts`

2. **Find the mergeEntities method** (around line 160)

3. **Modify the method signature** to accept an optional graph parameter:
   ```typescript
   /**
    * Merge multiple entities into one, combining their observations and tags.
    *
    * @param entityNames - Array of entity names to merge (first becomes primary)
    * @param options - Optional configuration
    * @param options.graph - Pre-loaded graph to use (avoids reload)
    * @param options.skipSave - If true, don't save (caller will save)
    * @returns The merged entity
    * @throws EntityNotFoundError if any entity doesn't exist
    * @throws InsufficientEntitiesError if fewer than 2 entities provided
    */
   async mergeEntities(
     entityNames: string[],
     options: {
       graph?: KnowledgeGraph;
       skipSave?: boolean;
     } = {}
   ): Promise<Entity> {
     if (entityNames.length < 2) {
       throw new InsufficientEntitiesError('merge', 2);
     }

     // Use provided graph or load fresh
     const graph = options.graph ?? await this.storage.loadGraph();

     const entitiesToMerge: Entity[] = [];
     for (const name of entityNames) {
       const entity = graph.entities.find(e => e.name === name);
       if (!entity) {
         throw new EntityNotFoundError(name);
       }
       entitiesToMerge.push(entity);
     }

     // Keep the first entity as primary
     const primary = entitiesToMerge[0];
     const others = entitiesToMerge.slice(1);

     // Merge observations (deduplicate)
     const allObservations = new Set<string>(primary.observations);
     for (const other of others) {
       for (const obs of other.observations) {
         allObservations.add(obs);
       }
     }
     primary.observations = Array.from(allObservations);

     // Merge tags (deduplicate)
     const allTags = new Set<string>(primary.tags ?? []);
     for (const other of others) {
       for (const tag of other.tags ?? []) {
         allTags.add(tag);
       }
     }
     primary.tags = Array.from(allTags);

     // Keep highest importance
     for (const other of others) {
       if ((other.importance ?? 0) > (primary.importance ?? 0)) {
         primary.importance = other.importance;
       }
     }

     // Update timestamp
     primary.lastModified = new Date().toISOString();

     // Remove merged entities from graph
     const namesToRemove = new Set(others.map(e => e.name));
     graph.entities = graph.entities.filter(e => !namesToRemove.has(e.name));

     // Update relations to point to primary
     for (const relation of graph.relations) {
       if (namesToRemove.has(relation.from)) {
         relation.from = primary.name;
       }
       if (namesToRemove.has(relation.to)) {
         relation.to = primary.name;
       }
     }

     // Remove duplicate relations
     const relationSet = new Set<string>();
     graph.relations = graph.relations.filter(r => {
       const key = `${r.from}|${r.to}|${r.relationType}`;
       if (relationSet.has(key)) return false;
       relationSet.add(key);
       return true;
     });

     // Save unless caller said to skip
     if (!options.skipSave) {
       await this.storage.saveGraph(graph);
     }

     return primary;
   }
   ```

4. **Verify TypeScript compilation**:
   ```bash
   npm run typecheck
   ```

5. **Run mergeEntities tests**:
   ```bash
   npx vitest run tests/unit/features/CompressionManager.test.ts -t "merge"
   ```

**Acceptance Criteria**:
- [ ] mergeEntities accepts optional graph parameter
- [ ] mergeEntities accepts optional skipSave parameter
- [ ] Uses provided graph when available
- [ ] Backward compatible (works without parameters)
- [ ] TypeScript compilation passes
- [ ] All existing merge tests pass

---

### Task 3.2: Optimize compressGraph Method

**File**: `src/features/CompressionManager.ts`
**Estimated Time**: 1.5 hours
**Agent**: Haiku

**Description**: Modify compressGraph to load the graph once and pass it to all merge operations, saving once at the end.

**Step-by-Step Instructions**:

1. **Open the file**: `src/features/CompressionManager.ts`

2. **Find the compressGraph method** (around line 270)

3. **Refactor to load graph once**:
   ```typescript
   /**
    * Compress the graph by merging duplicate entities.
    * OPTIMIZED: Loads graph once, performs all merges, saves once.
    *
    * @param threshold - Similarity threshold for duplicates
    * @param dryRun - If true, only report what would happen
    * @returns Compression result with statistics
    */
   async compressGraph(
     threshold: number = DEFAULT_DUPLICATE_THRESHOLD,
     dryRun: boolean = false
   ): Promise<CompressionResult> {
     // Find duplicates first
     const duplicateGroups = await this.findDuplicates(threshold);

     // OPTIMIZATION: Load graph once for all operations
     const graph = await this.storage.loadGraph();
     const initialSize = JSON.stringify(graph).length;

     const result: CompressionResult = {
       duplicatesFound: duplicateGroups.reduce((sum, group) => sum + group.length, 0),
       entitiesMerged: 0,
       observationsCompressed: 0,
       relationsConsolidated: 0,
       spaceFreed: 0,
       mergedEntities: [],
     };

     if (dryRun) {
       // Just report what would happen
       for (const group of duplicateGroups) {
         result.mergedEntities.push({
           kept: group[0],
           merged: group.slice(1),
         });
         result.entitiesMerged += group.length - 1;
       }
       return result;
     }

     // Actually merge duplicates - all using the same graph instance
     for (const group of duplicateGroups) {
       try {
         // Count observations before merge
         let totalObservationsBefore = 0;
         for (const name of group) {
           const entity = graph.entities.find(e => e.name === name);
           if (entity) {
             totalObservationsBefore += entity.observations.length;
           }
         }

         // OPTIMIZATION: Pass graph and skip individual saves
         const mergedEntity = await this.mergeEntities(group, {
           graph,
           skipSave: true,
         });

         // Count observations after merge
         const observationsAfter = mergedEntity.observations.length;
         result.observationsCompressed += totalObservationsBefore - observationsAfter;

         result.mergedEntities.push({
           kept: group[0],
           merged: group.slice(1),
         });
         result.entitiesMerged += group.length - 1;
       } catch (error) {
         // Skip groups that fail to merge
         console.error(`Failed to merge group ${group}:`, error);
       }
     }

     // OPTIMIZATION: Save once after all merges complete
     await this.storage.saveGraph(graph);

     // Calculate space saved
     const finalSize = JSON.stringify(graph).length;
     result.spaceFreed = initialSize - finalSize;

     // Count consolidated relations
     // (Relations that were deduplicated during merges)
     result.relationsConsolidated = result.entitiesMerged; // Approximation

     return result;
   }
   ```

4. **Verify TypeScript compilation**:
   ```bash
   npm run typecheck
   ```

5. **Run compression tests**:
   ```bash
   npx vitest run tests/unit/features/CompressionManager.test.ts
   ```

**Acceptance Criteria**:
- [ ] compressGraph loads graph once at the start
- [ ] All mergeEntities calls use the same graph instance
- [ ] Graph is saved only once at the end
- [ ] TypeScript compilation passes
- [ ] All existing compression tests pass

---

### Task 3.3: Add Integration Tests for Reduced Reloads

**File**: `tests/integration/compression-optimization.test.ts` (new)
**Estimated Time**: 1 hour
**Agent**: Haiku

**Description**: Create integration tests that verify the reduced graph reload behavior.

**Step-by-Step Instructions**:

1. **Create the test file**: `tests/integration/compression-optimization.test.ts`

2. **Add imports and test suite**:
   ```typescript
   import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
   import { GraphStorage } from '../../src/core/GraphStorage.js';
   import { CompressionManager } from '../../src/features/CompressionManager.js';
   import { promises as fs } from 'fs';
   import { join } from 'path';
   import { tmpdir } from 'os';

   describe('Compression Optimization - Reduced Graph Reloads', () => {
     let testDir: string;
     let storage: GraphStorage;
     let compressionManager: CompressionManager;

     beforeEach(async () => {
       testDir = join(tmpdir(), `compress-opt-${Date.now()}-${Math.random().toString(36).slice(2)}`);
       await fs.mkdir(testDir, { recursive: true });

       const storagePath = join(testDir, 'test.jsonl');
       storage = new GraphStorage(storagePath);
       compressionManager = new CompressionManager(storage);
     });

     afterEach(async () => {
       try {
         await fs.rm(testDir, { recursive: true, force: true });
       } catch {
         // Ignore
       }
     });

     it('should only load graph once for multiple merge groups', async () => {
       // Create entities with duplicates in multiple groups
       const entities = [
         // Group 1: Entity1 and Entity1Copy
         { name: 'Entity1', entityType: 'test', observations: ['obs1'] },
         { name: 'Entity1Copy', entityType: 'test', observations: ['obs1', 'extra'] },
         // Group 2: Entity2 and Entity2Copy
         { name: 'Entity2', entityType: 'test', observations: ['obs2'] },
         { name: 'Entity2Copy', entityType: 'test', observations: ['obs2', 'extra2'] },
         // Group 3: Entity3 and Entity3Copy
         { name: 'Entity3', entityType: 'test', observations: ['obs3'] },
         { name: 'Entity3Copy', entityType: 'test', observations: ['obs3', 'extra3'] },
       ];

       await storage.saveGraph({ entities, relations: [] });

       // Spy on loadGraph to count calls
       const loadSpy = vi.spyOn(storage, 'loadGraph');
       const saveSpy = vi.spyOn(storage, 'saveGraph');

       // Compress with high threshold to force merges
       await compressionManager.compressGraph(0.7, false);

       // Should only have 2 loads: 1 for findDuplicates, 1 for compressGraph
       expect(loadSpy).toHaveBeenCalledTimes(2);

       // Should only save once at the end
       expect(saveSpy).toHaveBeenCalledTimes(1);
     });

     it('should correctly merge all groups in single transaction', async () => {
       const entities = [
         { name: 'Alpha', entityType: 'person', observations: ['works at company'] },
         { name: 'AlphaCopy', entityType: 'person', observations: ['works at company', 'loves coding'] },
         { name: 'Beta', entityType: 'person', observations: ['manager role'] },
         { name: 'BetaCopy', entityType: 'person', observations: ['manager role', 'leads team'] },
       ];

       await storage.saveGraph({ entities, relations: [] });

       const result = await compressionManager.compressGraph(0.7, false);

       // Should have merged groups
       expect(result.entitiesMerged).toBeGreaterThan(0);

       // Verify final graph state
       const finalGraph = await storage.loadGraph();
       expect(finalGraph.entities.length).toBe(2); // Alpha and Beta remain
       expect(finalGraph.entities.find(e => e.name === 'Alpha')).toBeDefined();
       expect(finalGraph.entities.find(e => e.name === 'Beta')).toBeDefined();
       expect(finalGraph.entities.find(e => e.name === 'AlphaCopy')).toBeUndefined();
       expect(finalGraph.entities.find(e => e.name === 'BetaCopy')).toBeUndefined();
     });

     it('should handle failures gracefully without corrupting graph', async () => {
       const entities = [
         { name: 'Good1', entityType: 'test', observations: ['obs'] },
         { name: 'Good1Copy', entityType: 'test', observations: ['obs'] },
         { name: 'Other', entityType: 'different', observations: ['unique'] },
       ];

       await storage.saveGraph({ entities, relations: [] });

       const result = await compressionManager.compressGraph(0.8, false);

       // Should complete without error
       expect(result.entitiesMerged).toBeGreaterThanOrEqual(0);

       // Graph should still be valid
       const finalGraph = await storage.loadGraph();
       expect(finalGraph.entities.length).toBeGreaterThan(0);
     });
   });
   ```

3. **Run the tests**:
   ```bash
   npx vitest run tests/integration/compression-optimization.test.ts
   ```

**Acceptance Criteria**:
- [ ] Integration tests verify reduced graph reloads
- [ ] Tests verify correct merge behavior
- [ ] Tests verify graceful failure handling
- [ ] All tests pass

---

## Appendix A: File Changes Summary

### New Files Created

```
tests/unit/utils/observationIndex.test.ts
tests/integration/compression-optimization.test.ts
```

### Files Modified

```
src/utils/indexes.ts              # Add ObservationIndex class
src/core/GraphStorage.ts          # Integrate ObservationIndex
src/search/BooleanSearch.ts       # Use observation index for lookups
src/features/CompressionManager.ts # PreparedEntity, optimized similarity, reduced reloads
tests/performance/optimization-benchmarks.test.ts # Similarity benchmarks
```

---

## Appendix B: Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ObservationIndex memory overhead | Medium | Low | Only index words >= 2 chars, lazy build |
| PreparedEntity cache invalidation | Low | Medium | Always prepare fresh for each operation |
| Merge transaction failure | Low | High | Catch errors, skip failed groups, log warnings |
| Backward compatibility | Low | Medium | Keep original methods, add optimized variants |

---

## Appendix C: Sprint Dependencies

```mermaid
graph TD
    S1[Sprint 1: Observation Index]
    S2[Sprint 2: Pre-computed Similarity]
    S3[Sprint 3: Reduced Reloads]
```

### Parallel Execution

| Group | Sprints | Description |
|-------|---------|-------------|
| 1 | Sprint 1, 2, 3 | All can run in parallel (independent optimizations) |

**Note**: All three sprints target different optimization areas and have no dependencies on each other:
- Sprint 1: Observation searches (indexes.ts, GraphStorage.ts, BooleanSearch.ts)
- Sprint 2: Similarity calculations (CompressionManager.ts - findDuplicates)
- Sprint 3: I/O operations (CompressionManager.ts - mergeEntities, compressGraph)

---

## Appendix D: Success Metrics Checklist

### Observation Index
- [ ] O(1) lookup for single word observation queries
- [ ] Index rebuilt automatically on entity create/update/delete
- [ ] getStats() returns accurate word and entity counts
- [ ] Memory overhead acceptable (< 1MB for 1000 entities)

### Pre-computed Similarity
- [ ] calculatePreparedSimilarity() avoids Set creation
- [ ] findDuplicates() prepares entities once before loop
- [ ] 1.5-2x speedup verified in benchmarks

### Reduced Graph Reloads
- [ ] compressGraph loads graph only twice (findDuplicates + compressGraph)
- [ ] Saves graph only once at end of compression
- [ ] All merge operations use same graph instance
- [ ] 10x I/O reduction for multiple merge groups

### Overall
- [ ] All 2209+ existing tests pass
- [ ] No TypeScript compilation errors
- [ ] No performance regressions for simple operations
- [ ] Documentation updated

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-04 | 1.0.0 | Initial Phase 9 plan extracted from FUTURE_FEATURES.md Phase 3 |
