# Performance & Capabilities Improvement Roadmap

**Version:** 1.0.0
**Created:** 2026-01-02
**Current Version:** 8.50.24
**Target Version:** 9.0.0

---

## Executive Summary

This roadmap defines a comprehensive plan to improve memory-mcp's speed and capabilities across 5 phases. The improvements target:

1. **Search Performance** - 40-70% faster repeated queries through caching
2. **Database Optimization** - O(n) → O(log n) for range queries via indexes
3. **Graph Algorithms** - New traversal capabilities (shortest path, centrality, components)
4. **Storage Efficiency** - 50-70% space reduction via Brotli compression
5. **Semantic Search** - AI-powered similarity search with embeddings

**Total Estimated Effort:** 80-100 hours
**Expected Performance Gain:** 2-5x for common operations

---

## Table of Contents

1. [Phase 1: Quick Wins (8 hours)](#phase-1-quick-wins)
2. [Phase 2: Search Optimization (12 hours)](#phase-2-search-optimization)
3. [Phase 3: Graph Algorithms (24 hours)](#phase-3-graph-algorithms)
4. [Phase 4: Brotli Compression (31 hours)](#phase-4-brotli-compression)
5. [Phase 5: Semantic Search (25 hours)](#phase-5-semantic-search)
6. [Implementation Schedule](#implementation-schedule)
7. [Success Metrics](#success-metrics)
8. [Risk Assessment](#risk-assessment)

---

## Phase 1: Quick Wins

**Effort:** 8 hours | **Priority:** CRITICAL | **ROI:** IMMEDIATE

These improvements require minimal code changes but yield significant performance gains.

### 1.1 Add Missing SQLite Indexes

**Effort:** 30 minutes | **Impact:** HIGH

**Problem:** Range queries on `importance`, `lastModified`, and `relationType` perform full table scans.

**File:** `src/memory/core/SQLiteStorage.ts`

**Current State (lines 151-154):**
```typescript
db.exec(`CREATE INDEX IF NOT EXISTS idx_entity_type ON entities(entityType)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_entity_parent ON entities(parentId)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_relation_from ON relations(fromEntity)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_relation_to ON relations(toEntity)`);
```

**Required Changes:**
```typescript
// Add after existing indexes (line 154)
db.exec(`CREATE INDEX IF NOT EXISTS idx_entity_importance ON entities(importance)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_entity_lastmodified ON entities(lastModified)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_entity_createdat ON entities(createdAt)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_relation_type ON relations(relationType)`);

// Composite index for common query patterns
db.exec(`CREATE INDEX IF NOT EXISTS idx_entity_type_importance ON entities(entityType, importance)`);
```

**Expected Improvement:**
| Query Type | Before | After |
|------------|--------|-------|
| Filter by importance | O(n) | O(log n) |
| Filter by date range | O(n) | O(log n) |
| Filter by relation type | O(n) | O(log n) |
| Combined type + importance | O(n) | O(log n) |

**Test Cases:**
```typescript
describe('SQLite Index Performance', () => {
  it('should use importance index for range queries', async () => {
    // Create 10,000 entities with varied importance
    // Query importance > 7 should be < 10ms
  });

  it('should use date index for range queries', async () => {
    // Query lastModified within date range should be < 10ms
  });
});
```

---

### 1.2 Cache Bidirectional Relation Queries

**Effort:** 2 hours | **Impact:** HIGH

**Problem:** `getRelationsFor()` scans relations twice (from + to) and falls back to O(n) cache scan.

**File:** `src/memory/core/SQLiteStorage.ts` (lines 811-830)

**Current State:**
```typescript
getRelationsFor(entityName: string): Relation[] {
  // Currently: Two separate queries + cache fallback
  const fromRelations = this.getRelationsFrom(entityName);
  const toRelations = this.getRelationsTo(entityName);
  return [...fromRelations, ...toRelations];
}
```

**Proposed Solution:**
```typescript
// Add bidirectional cache
private bidirectionalRelationCache: Map<string, Relation[]> = new Map();

getRelationsFor(entityName: string): Relation[] {
  // Check cache first
  const cached = this.bidirectionalRelationCache.get(entityName);
  if (cached !== undefined) {
    return cached;
  }

  // Use RelationIndex for O(1) lookup
  const relations = this.relationIndex.getRelationsFor(entityName);

  // Cache the result
  this.bidirectionalRelationCache.set(entityName, relations);
  return relations;
}

// Invalidate on relation changes
private invalidateBidirectionalCache(entityName: string): void {
  this.bidirectionalRelationCache.delete(entityName);
}
```

**Cache Invalidation Points:**
- `addRelation()` - Invalidate both `from` and `to` entities
- `removeRelation()` - Invalidate both `from` and `to` entities
- `deleteEntity()` - Invalidate the deleted entity
- `saveGraph()` - Clear entire cache

**Expected Improvement:**
- First query: Same performance (cache miss)
- Subsequent queries: O(1) vs O(n) - **50-90% faster**

---

### 1.3 Add RankedSearch Fallback Cache

**Effort:** 3 hours | **Impact:** MEDIUM

**Problem:** When TF-IDF index file isn't available, `RankedSearch` recomputes everything.

**File:** `src/memory/search/RankedSearch.ts` (lines 193-256)

**Current State:**
```typescript
// Fallback path tokenizes all documents on every search
private searchWithoutIndex(query: string, entities: Entity[]): RankedResult[] {
  const documents = entities.map(e => this.entityToDocument(e));
  const queryTerms = tokenize(query);
  // ... O(n * m) computation every time
}
```

**Proposed Solution:**
```typescript
// Add in-memory fallback cache
interface TokenizedEntity {
  entity: Entity;
  tokens: Set<string>;
  document: string;
}

class RankedSearch {
  private tokenCache: Map<string, TokenizedEntity> = new Map();
  private idfCache: Map<string, number> = new Map();
  private lastEntityCount: number = 0;

  private getOrComputeTokens(entity: Entity): TokenizedEntity {
    const cached = this.tokenCache.get(entity.name);
    if (cached && cached.entity.lastModified === entity.lastModified) {
      return cached;
    }

    const document = this.entityToDocument(entity);
    const tokens = new Set(tokenize(document));
    const result = { entity, tokens, document };
    this.tokenCache.set(entity.name, result);
    return result;
  }

  private searchWithoutIndex(query: string, entities: Entity[]): RankedResult[] {
    // Rebuild IDF cache if entity count changed significantly
    if (Math.abs(entities.length - this.lastEntityCount) > entities.length * 0.1) {
      this.rebuildIDFCache(entities);
      this.lastEntityCount = entities.length;
    }

    // Use cached tokens
    const tokenizedEntities = entities.map(e => this.getOrComputeTokens(e));

    // ... rest of ranking logic using cached data
  }
}
```

**Expected Improvement:**
- First search: Same performance
- Subsequent searches: **60-80% faster** (skip tokenization)
- After entity updates: Incremental recomputation only

---

### 1.4 Implement Lazy Graph Loading

**Effort:** 4 hours | **Impact:** HIGH

**Problem:** `SQLiteStorage` loads entire graph into memory on initialization.

**File:** `src/memory/core/SQLiteStorage.ts` (lines 112-113)

**Current State:**
```typescript
constructor(memoryFilePath: string) {
  this.initializeDatabase();
  this.loadGraphIntoCache();  // Blocks startup, loads everything
}
```

**Proposed Solution:**
```typescript
class SQLiteStorage {
  private cacheLoaded: boolean = false;
  private loadingPromise: Promise<void> | null = null;

  constructor(memoryFilePath: string) {
    this.initializeDatabase();
    // Don't load cache immediately
  }

  private async ensureCacheLoaded(): Promise<void> {
    if (this.cacheLoaded) return;

    if (this.loadingPromise) {
      await this.loadingPromise;
      return;
    }

    this.loadingPromise = this.loadGraphIntoCache();
    await this.loadingPromise;
    this.cacheLoaded = true;
    this.loadingPromise = null;
  }

  async loadGraph(): Promise<ReadonlyKnowledgeGraph> {
    await this.ensureCacheLoaded();
    return this.cache!;
  }

  // For simple lookups, query DB directly without full cache
  async getEntity(name: string): Promise<Entity | undefined> {
    // Fast path: check if already in cache
    if (this.cacheLoaded && this.nameIndex.has(name)) {
      return this.nameIndex.get(name);
    }

    // Query DB directly
    const stmt = this.db.prepare('SELECT * FROM entities WHERE name = ?');
    const row = stmt.get(name);
    return row ? this.rowToEntity(row) : undefined;
  }
}
```

**Startup Time Improvement:**

| Graph Size | Before | After |
|------------|--------|-------|
| 1,000 entities | 50ms | 5ms |
| 10,000 entities | 500ms | 5ms |
| 100,000 entities | 5,000ms | 5ms |

**Trade-offs:**
- First full-graph operation still incurs load time
- Individual entity lookups work immediately
- Memory usage identical once cache loaded

---

## Phase 2: Search Optimization

**Effort:** 12 hours | **Priority:** HIGH | **ROI:** HIGH

### 2.1 Fuzzy Search Cache

**Effort:** 4 hours | **Impact:** HIGH

**Problem:** `FuzzySearch` computes Levenshtein distance for every entity on every query.

**File:** `src/memory/search/FuzzySearch.ts`

**Proposed Implementation:**
```typescript
import { createSearchCache, SearchCacheKey } from '../utils/searchCache.js';

interface FuzzyCacheKey extends SearchCacheKey {
  query: string;
  maxDistance: number;
  limit: number;
  offset: number;
}

class FuzzySearch {
  private cache = createSearchCache<FuzzyCacheKey, FuzzySearchResult[]>({
    maxSize: 100,
    ttlMs: 5 * 60 * 1000, // 5 minutes
  });

  async search(
    query: string,
    entities: Entity[],
    options: FuzzySearchOptions
  ): Promise<FuzzySearchResult[]> {
    const cacheKey: FuzzyCacheKey = {
      query: query.toLowerCase(),
      maxDistance: options.maxDistance ?? 2,
      limit: options.limit ?? 10,
      offset: options.offset ?? 0,
    };

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Compute results
    const results = this.computeFuzzySearch(query, entities, options);

    // Cache results
    this.cache.set(cacheKey, results);
    return results;
  }

  invalidateCache(): void {
    this.cache.clear();
  }
}
```

**Cache Invalidation Strategy:**
- Clear on any entity create/update/delete
- TTL-based expiration (5 minutes)
- LRU eviction when cache full (100 entries)

**Expected Improvement:**
| Scenario | Before | After |
|----------|--------|-------|
| First query | 100ms | 100ms |
| Repeated query | 100ms | <1ms |
| Similar query | 100ms | 100ms |

---

### 2.2 Boolean Search Cache with AST Caching

**Effort:** 4 hours | **Impact:** MEDIUM

**Problem:** Boolean queries are parsed and evaluated from scratch every time.

**File:** `src/memory/search/BooleanSearch.ts`

**Current State (lines 38-88):**
```typescript
search(query: string, entities: Entity[]): Entity[] {
  const ast = this.parse(query);      // Parsed every time
  return this.evaluate(ast, entities); // Evaluated every time
}
```

**Proposed Solution:**
```typescript
interface BooleanCacheEntry {
  ast: BooleanAST;
  results: Entity[];
  entityHash: string;  // Hash of entity names for invalidation
}

class BooleanSearch {
  private astCache: Map<string, BooleanAST> = new Map();
  private resultCache: Map<string, BooleanCacheEntry> = new Map();

  search(query: string, entities: Entity[]): Entity[] {
    const normalizedQuery = this.normalizeQuery(query);
    const entityHash = this.computeEntityHash(entities);

    // Check result cache
    const cached = this.resultCache.get(normalizedQuery);
    if (cached && cached.entityHash === entityHash) {
      return cached.results;
    }

    // Get or parse AST
    let ast = this.astCache.get(normalizedQuery);
    if (!ast) {
      ast = this.parse(normalizedQuery);
      this.astCache.set(normalizedQuery, ast);
    }

    // Evaluate and cache
    const results = this.evaluate(ast, entities);
    this.resultCache.set(normalizedQuery, { ast, results, entityHash });

    return results;
  }

  private normalizeQuery(query: string): string {
    // Normalize whitespace, case for operators
    return query
      .replace(/\s+/g, ' ')
      .replace(/\b(AND|OR|NOT)\b/gi, m => m.toUpperCase())
      .trim();
  }

  private computeEntityHash(entities: Entity[]): string {
    // Fast hash based on count + first/last names + modification times
    if (entities.length === 0) return 'empty';
    return `${entities.length}:${entities[0].name}:${entities[entities.length-1].lastModified}`;
  }
}
```

**Expected Improvement:**
- AST parsing: Cached after first use
- Result evaluation: Cached until entities change
- **40-60% faster** for repeated boolean queries

---

### 2.3 Search Result Pagination Cache

**Effort:** 4 hours | **Impact:** MEDIUM

**Problem:** Pagination recalculates entire result set, then slices.

**Files:** `src/memory/search/SearchFilterChain.ts`, `src/memory/search/SearchManager.ts`

**Proposed Solution:**
```typescript
interface PaginatedCacheEntry<T> {
  fullResults: T[];
  totalCount: number;
  timestamp: number;
}

class SearchManager {
  private paginationCache: Map<string, PaginatedCacheEntry<Entity>> = new Map();
  private readonly PAGINATION_CACHE_TTL = 30_000; // 30 seconds

  async searchNodes(query: string, options: SearchOptions): Promise<PaginatedResult<Entity>> {
    const cacheKey = this.buildSearchCacheKey(query, options);
    const paginationKey = `${cacheKey}:pagination`;

    // Check if we have cached full results
    const cached = this.paginationCache.get(paginationKey);
    if (cached && Date.now() - cached.timestamp < this.PAGINATION_CACHE_TTL) {
      // Paginate from cached results
      const { offset = 0, limit = 10 } = options;
      return {
        results: cached.fullResults.slice(offset, offset + limit),
        totalCount: cached.totalCount,
        hasMore: offset + limit < cached.totalCount,
      };
    }

    // Compute full results
    const fullResults = await this.executeSearch(query, options);

    // Cache full results for pagination
    this.paginationCache.set(paginationKey, {
      fullResults,
      totalCount: fullResults.length,
      timestamp: Date.now(),
    });

    // Return paginated slice
    const { offset = 0, limit = 10 } = options;
    return {
      results: fullResults.slice(offset, offset + limit),
      totalCount: fullResults.length,
      hasMore: offset + limit < fullResults.length,
    };
  }
}
```

**Use Case:**
- User searches "project"
- Gets page 1 (offset=0, limit=10)
- Clicks "next page" (offset=10, limit=10)
- Second request uses cached full results

**Expected Improvement:**
- First page: Normal performance
- Subsequent pages: **90%+ faster** (just array slice)

---

## Phase 3: Graph Algorithms

**Effort:** 24 hours | **Priority:** MEDIUM | **ROI:** HIGH (New Capabilities)

### 3.1 Graph Traversal Framework

**Effort:** 8 hours | **Impact:** FOUNDATIONAL

**New File:** `src/memory/core/GraphTraversal.ts`

```typescript
/**
 * Graph Traversal Framework
 *
 * Provides general-purpose graph traversal algorithms for the knowledge graph.
 * Supports both entity hierarchy (parent-child) and relations (edges).
 *
 * @module core/GraphTraversal
 */

import type { Entity, Relation, KnowledgeGraph } from '../types/index.js';

export interface TraversalOptions {
  /** Maximum depth to traverse (default: Infinity) */
  maxDepth?: number;
  /** Follow hierarchy (parent-child) edges */
  includeHierarchy?: boolean;
  /** Follow relation edges */
  includeRelations?: boolean;
  /** Relation types to follow (default: all) */
  relationTypes?: string[];
  /** Direction for relations: 'outgoing', 'incoming', 'both' */
  direction?: 'outgoing' | 'incoming' | 'both';
  /** Early termination condition */
  stopCondition?: (entity: Entity, depth: number) => boolean;
}

export interface PathResult {
  /** Entities in the path, from start to end */
  path: Entity[];
  /** Relations traversed (if includeRelations) */
  relations: Relation[];
  /** Total path length */
  length: number;
}

export interface ComponentResult {
  /** Entities in this connected component */
  entities: Entity[];
  /** Relations within this component */
  relations: Relation[];
  /** Size of the component */
  size: number;
}

export interface CentralityResult {
  /** Entity name */
  entity: string;
  /** Centrality score (interpretation depends on algorithm) */
  score: number;
}

export class GraphTraversal {
  constructor(
    private graph: KnowledgeGraph,
    private relationIndex: RelationIndex
  ) {}

  // ==================== TRAVERSAL ALGORITHMS ====================

  /**
   * Breadth-First Search from a starting entity.
   *
   * @param startName - Entity name to start from
   * @param options - Traversal options
   * @returns Entities in BFS order with their depths
   */
  bfs(startName: string, options: TraversalOptions = {}): Map<string, number> {
    const visited = new Map<string, number>();
    const queue: Array<{ name: string; depth: number }> = [{ name: startName, depth: 0 }];
    const maxDepth = options.maxDepth ?? Infinity;

    while (queue.length > 0) {
      const { name, depth } = queue.shift()!;

      if (visited.has(name) || depth > maxDepth) continue;
      visited.set(name, depth);

      const entity = this.graph.entities.find(e => e.name === name);
      if (!entity) continue;

      if (options.stopCondition?.(entity, depth)) continue;

      // Get neighbors
      const neighbors = this.getNeighbors(name, options);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push({ name: neighbor, depth: depth + 1 });
        }
      }
    }

    return visited;
  }

  /**
   * Depth-First Search from a starting entity.
   *
   * @param startName - Entity name to start from
   * @param options - Traversal options
   * @returns Entities in DFS order
   */
  dfs(startName: string, options: TraversalOptions = {}): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    const maxDepth = options.maxDepth ?? Infinity;

    const visit = (name: string, depth: number): void => {
      if (visited.has(name) || depth > maxDepth) return;
      visited.add(name);
      result.push(name);

      const entity = this.graph.entities.find(e => e.name === name);
      if (!entity || options.stopCondition?.(entity, depth)) return;

      const neighbors = this.getNeighbors(name, options);
      for (const neighbor of neighbors) {
        visit(neighbor, depth + 1);
      }
    };

    visit(startName, 0);
    return result;
  }

  // ==================== PATH FINDING ====================

  /**
   * Find shortest path between two entities.
   * Uses BFS for unweighted graphs.
   *
   * @param fromName - Starting entity name
   * @param toName - Target entity name
   * @param options - Traversal options
   * @returns Shortest path or null if no path exists
   */
  shortestPath(
    fromName: string,
    toName: string,
    options: TraversalOptions = {}
  ): PathResult | null {
    if (fromName === toName) {
      const entity = this.graph.entities.find(e => e.name === fromName);
      return entity ? { path: [entity], relations: [], length: 0 } : null;
    }

    const visited = new Set<string>();
    const parent = new Map<string, { from: string; relation?: Relation }>();
    const queue: string[] = [fromName];
    visited.add(fromName);

    while (queue.length > 0) {
      const current = queue.shift()!;

      const neighbors = this.getNeighborsWithRelations(current, options);
      for (const { neighbor, relation } of neighbors) {
        if (visited.has(neighbor)) continue;

        visited.add(neighbor);
        parent.set(neighbor, { from: current, relation });

        if (neighbor === toName) {
          // Reconstruct path
          return this.reconstructPath(fromName, toName, parent);
        }

        queue.push(neighbor);
      }
    }

    return null; // No path found
  }

  /**
   * Find all paths between two entities up to a maximum length.
   *
   * @param fromName - Starting entity name
   * @param toName - Target entity name
   * @param maxLength - Maximum path length
   * @returns Array of all paths found
   */
  allPaths(
    fromName: string,
    toName: string,
    maxLength: number = 5
  ): PathResult[] {
    const results: PathResult[] = [];
    const currentPath: string[] = [];
    const currentRelations: Relation[] = [];
    const visited = new Set<string>();

    const dfs = (current: string): void => {
      if (currentPath.length > maxLength) return;

      currentPath.push(current);
      visited.add(current);

      if (current === toName) {
        results.push({
          path: currentPath.map(name =>
            this.graph.entities.find(e => e.name === name)!
          ),
          relations: [...currentRelations],
          length: currentPath.length - 1,
        });
      } else {
        const neighbors = this.getNeighborsWithRelations(current, {
          includeRelations: true,
          direction: 'both'
        });

        for (const { neighbor, relation } of neighbors) {
          if (!visited.has(neighbor)) {
            if (relation) currentRelations.push(relation);
            dfs(neighbor);
            if (relation) currentRelations.pop();
          }
        }
      }

      currentPath.pop();
      visited.delete(current);
    };

    dfs(fromName);
    return results;
  }

  // ==================== CONNECTED COMPONENTS ====================

  /**
   * Find all connected components in the graph.
   *
   * @param options - Traversal options
   * @returns Array of connected components
   */
  connectedComponents(options: TraversalOptions = {}): ComponentResult[] {
    const visited = new Set<string>();
    const components: ComponentResult[] = [];

    for (const entity of this.graph.entities) {
      if (visited.has(entity.name)) continue;

      // BFS to find all entities in this component
      const componentEntities: Entity[] = [];
      const componentRelations: Relation[] = [];
      const queue: string[] = [entity.name];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        const currentEntity = this.graph.entities.find(e => e.name === current);
        if (currentEntity) {
          componentEntities.push(currentEntity);
        }

        const neighbors = this.getNeighborsWithRelations(current, {
          ...options,
          direction: 'both',
        });

        for (const { neighbor, relation } of neighbors) {
          if (relation && !componentRelations.includes(relation)) {
            componentRelations.push(relation);
          }
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }

      components.push({
        entities: componentEntities,
        relations: componentRelations,
        size: componentEntities.length,
      });
    }

    return components.sort((a, b) => b.size - a.size);
  }

  // ==================== CENTRALITY MEASURES ====================

  /**
   * Calculate degree centrality for all entities.
   * Degree = number of connections (relations + hierarchy).
   *
   * @param options - Traversal options
   * @returns Entities sorted by centrality score
   */
  degreeCentrality(options: TraversalOptions = {}): CentralityResult[] {
    const results: CentralityResult[] = [];

    for (const entity of this.graph.entities) {
      const neighbors = this.getNeighbors(entity.name, {
        ...options,
        direction: 'both',
      });

      results.push({
        entity: entity.name,
        score: neighbors.length,
      });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate betweenness centrality for all entities.
   * Measures how often an entity lies on shortest paths between other entities.
   *
   * @param sampleSize - Number of entity pairs to sample (for large graphs)
   * @returns Entities sorted by betweenness score
   */
  betweennessCentrality(sampleSize?: number): CentralityResult[] {
    const scores = new Map<string, number>();

    // Initialize scores
    for (const entity of this.graph.entities) {
      scores.set(entity.name, 0);
    }

    // Sample entity pairs or use all pairs
    const entities = this.graph.entities;
    const pairs: Array<[string, string]> = [];

    if (sampleSize && entities.length > sampleSize) {
      // Random sampling for large graphs
      for (let i = 0; i < sampleSize; i++) {
        const a = entities[Math.floor(Math.random() * entities.length)].name;
        const b = entities[Math.floor(Math.random() * entities.length)].name;
        if (a !== b) pairs.push([a, b]);
      }
    } else {
      // All pairs for small graphs
      for (let i = 0; i < entities.length; i++) {
        for (let j = i + 1; j < entities.length; j++) {
          pairs.push([entities[i].name, entities[j].name]);
        }
      }
    }

    // Count shortest paths through each entity
    for (const [from, to] of pairs) {
      const path = this.shortestPath(from, to);
      if (path && path.path.length > 2) {
        // Intermediate nodes get credit
        for (let i = 1; i < path.path.length - 1; i++) {
          const name = path.path[i].name;
          scores.set(name, (scores.get(name) || 0) + 1);
        }
      }
    }

    // Normalize and sort
    const maxScore = Math.max(...scores.values()) || 1;
    return Array.from(scores.entries())
      .map(([entity, score]) => ({ entity, score: score / maxScore }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate PageRank-style importance scores.
   * Propagates importance through the graph structure.
   *
   * @param dampingFactor - Probability of following a link (default: 0.85)
   * @param iterations - Number of iterations (default: 20)
   * @returns Entities sorted by PageRank score
   */
  pageRank(dampingFactor: number = 0.85, iterations: number = 20): CentralityResult[] {
    const n = this.graph.entities.length;
    if (n === 0) return [];

    // Initialize scores
    let scores = new Map<string, number>();
    for (const entity of this.graph.entities) {
      scores.set(entity.name, 1 / n);
    }

    // Iterate
    for (let i = 0; i < iterations; i++) {
      const newScores = new Map<string, number>();

      for (const entity of this.graph.entities) {
        // Base score from random jumps
        let score = (1 - dampingFactor) / n;

        // Add contributions from incoming edges
        const incomingNeighbors = this.getNeighbors(entity.name, {
          includeRelations: true,
          direction: 'incoming',
        });

        for (const neighbor of incomingNeighbors) {
          const outDegree = this.getNeighbors(neighbor, {
            includeRelations: true,
            direction: 'outgoing',
          }).length || 1;

          score += dampingFactor * (scores.get(neighbor) || 0) / outDegree;
        }

        newScores.set(entity.name, score);
      }

      scores = newScores;
    }

    return Array.from(scores.entries())
      .map(([entity, score]) => ({ entity, score }))
      .sort((a, b) => b.score - a.score);
  }

  // ==================== HELPER METHODS ====================

  private getNeighbors(entityName: string, options: TraversalOptions): string[] {
    const neighbors = new Set<string>();
    const entity = this.graph.entities.find(e => e.name === entityName);

    // Hierarchy edges
    if (options.includeHierarchy !== false) {
      if (entity?.parentId) {
        neighbors.add(entity.parentId);
      }
      // Children
      for (const e of this.graph.entities) {
        if (e.parentId === entityName) {
          neighbors.add(e.name);
        }
      }
    }

    // Relation edges
    if (options.includeRelations !== false) {
      const relations = this.relationIndex.getRelationsFor(entityName);
      const direction = options.direction ?? 'both';
      const allowedTypes = options.relationTypes ? new Set(options.relationTypes) : null;

      for (const rel of relations) {
        if (allowedTypes && !allowedTypes.has(rel.relationType)) continue;

        if (direction === 'outgoing' || direction === 'both') {
          if (rel.from === entityName) neighbors.add(rel.to);
        }
        if (direction === 'incoming' || direction === 'both') {
          if (rel.to === entityName) neighbors.add(rel.from);
        }
      }
    }

    return Array.from(neighbors);
  }

  private getNeighborsWithRelations(
    entityName: string,
    options: TraversalOptions
  ): Array<{ neighbor: string; relation?: Relation }> {
    const result: Array<{ neighbor: string; relation?: Relation }> = [];

    // ... similar to getNeighbors but returns relation info

    return result;
  }

  private reconstructPath(
    from: string,
    to: string,
    parent: Map<string, { from: string; relation?: Relation }>
  ): PathResult {
    const path: Entity[] = [];
    const relations: Relation[] = [];
    let current = to;

    while (current !== from) {
      const entity = this.graph.entities.find(e => e.name === current);
      if (entity) path.unshift(entity);

      const p = parent.get(current);
      if (!p) break;
      if (p.relation) relations.unshift(p.relation);
      current = p.from;
    }

    const startEntity = this.graph.entities.find(e => e.name === from);
    if (startEntity) path.unshift(startEntity);

    return { path, relations, length: path.length - 1 };
  }
}
```

---

### 3.2 MCP Tool Integration

**Effort:** 4 hours | **Impact:** HIGH

**New Tools to Add:**

```typescript
// toolDefinitions.ts additions

// Shortest Path
{
  name: 'find_shortest_path',
  description: 'Find the shortest path between two entities through relations',
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Starting entity name' },
      to: { type: 'string', description: 'Target entity name' },
      relationTypes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Limit to specific relation types (optional)'
      },
      maxDepth: { type: 'number', description: 'Maximum path length (default: 10)' }
    },
    required: ['from', 'to']
  }
},

// Connected Components
{
  name: 'get_connected_components',
  description: 'Find all connected subgraphs in the knowledge graph',
  inputSchema: {
    type: 'object',
    properties: {
      minSize: { type: 'number', description: 'Minimum component size to return' }
    }
  }
},

// Centrality Analysis
{
  name: 'get_centrality',
  description: 'Calculate centrality scores to find important entities',
  inputSchema: {
    type: 'object',
    properties: {
      algorithm: {
        type: 'string',
        enum: ['degree', 'betweenness', 'pagerank'],
        description: 'Centrality algorithm to use'
      },
      limit: { type: 'number', description: 'Number of top entities to return' }
    }
  }
},

// Find All Paths
{
  name: 'find_all_paths',
  description: 'Find all paths between two entities up to a maximum length',
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'string' },
      to: { type: 'string' },
      maxLength: { type: 'number', description: 'Maximum path length (default: 5)' }
    },
    required: ['from', 'to']
  }
}
```

**Handler Implementations:**
```typescript
// toolHandlers.ts additions

find_shortest_path: async (ctx, args) => {
  const from = validateWithSchema(args.from, z.string(), 'Invalid from entity');
  const to = validateWithSchema(args.to, z.string(), 'Invalid to entity');
  const maxDepth = args.maxDepth as number | undefined;
  const relationTypes = args.relationTypes as string[] | undefined;

  const graph = await ctx.storage.loadGraph();
  const traversal = new GraphTraversal(graph, ctx.storage.getRelationIndex());

  const result = traversal.shortestPath(from, to, {
    includeRelations: true,
    relationTypes,
    maxDepth,
  });

  if (!result) {
    return formatTextResponse(`No path found between "${from}" and "${to}"`);
  }

  return formatToolResponse({
    path: result.path.map(e => e.name),
    relations: result.relations.map(r => `${r.from} -[${r.relationType}]-> ${r.to}`),
    length: result.length,
  });
},

get_connected_components: async (ctx, args) => {
  const minSize = (args.minSize as number) ?? 1;

  const graph = await ctx.storage.loadGraph();
  const traversal = new GraphTraversal(graph, ctx.storage.getRelationIndex());

  const components = traversal.connectedComponents()
    .filter(c => c.size >= minSize);

  return formatToolResponse({
    totalComponents: components.length,
    components: components.map(c => ({
      size: c.size,
      entities: c.entities.map(e => e.name),
      relationCount: c.relations.length,
    })),
  });
},

get_centrality: async (ctx, args) => {
  const algorithm = (args.algorithm as string) ?? 'degree';
  const limit = (args.limit as number) ?? 10;

  const graph = await ctx.storage.loadGraph();
  const traversal = new GraphTraversal(graph, ctx.storage.getRelationIndex());

  let results: CentralityResult[];
  switch (algorithm) {
    case 'degree':
      results = traversal.degreeCentrality();
      break;
    case 'betweenness':
      results = traversal.betweennessCentrality(100); // Sample 100 pairs
      break;
    case 'pagerank':
      results = traversal.pageRank();
      break;
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }

  return formatToolResponse({
    algorithm,
    topEntities: results.slice(0, limit),
  });
},
```

---

### 3.3 Relation Weights Support

**Effort:** 4 hours | **Impact:** MEDIUM

**Schema Changes:**
```typescript
// types/types.ts
export interface Relation {
  from: string;
  to: string;
  relationType: string;
  weight?: number;        // NEW: Optional weight (default: 1.0)
  metadata?: Record<string, unknown>;  // NEW: Optional metadata
  createdAt?: string;     // NEW: Track relation creation
}
```

**Use Cases:**
- Weighted shortest path (Dijkstra's algorithm)
- Stronger/weaker relationships
- Confidence scores for extracted relations

---

### 3.4 Multi-Hop Relation Queries

**Effort:** 8 hours | **Impact:** HIGH

**New Tool:**
```typescript
{
  name: 'query_relations',
  description: 'Query entities connected through multiple relation hops',
  inputSchema: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Starting entity' },
      pattern: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            relationType: { type: 'string' },
            direction: { type: 'string', enum: ['outgoing', 'incoming', 'any'] }
          }
        },
        description: 'Pattern of relation types to follow'
      }
    },
    required: ['from', 'pattern']
  }
}
```

**Example Usage:**
```json
{
  "from": "Alice",
  "pattern": [
    { "relationType": "works_at", "direction": "outgoing" },
    { "relationType": "located_in", "direction": "outgoing" }
  ]
}
// Returns: Alice -> Company -> City
```

---

## Phase 4: Brotli Compression

**Effort:** 31 hours | **Priority:** MEDIUM | **ROI:** HIGH (Storage)

> **Note:** Detailed implementation plan exists in `docs/planning/PHASE_3_REFACTORING_PLAN.md`

### 4.1 Sprint Overview

| Sprint | Feature | Effort | Impact |
|--------|---------|--------|--------|
| **Sprint 1** | Compression utility module | 6 hours | Foundation |
| **Sprint 2** | Backup compression | 7 hours | 50-70% smaller backups |
| **Sprint 3** | Export compression | 6 hours | 60-75% smaller exports |
| **Sprint 4** | MCP response compression | 6 hours | Faster large responses |
| **Sprint 5** | Archive + cache compression | 6 hours | Memory savings |

### 4.2 Expected Metrics

| Operation | Before | After | Reduction |
|-----------|--------|-------|-----------|
| Backup (5K entities) | 1.25 MB | 375 KB | 70% |
| Export (100K entities) | 25 MB | 7.5 MB | 70% |
| MCP response (large) | 1 MB | 300 KB | 70% |
| Write overhead | 0ms | +1-2ms | Acceptable |
| Load overhead | 0ms | +10-15ms | Acceptable |

### 4.3 Implementation Notes

```typescript
// New file: src/memory/utils/compression.ts

import { brotliCompressSync, brotliDecompressSync, constants } from 'zlib';

export interface CompressionOptions {
  level?: number;  // 1-11, default 6
  threshold?: number;  // Min size to compress, default 1024
}

export function compress(data: string, options: CompressionOptions = {}): Buffer {
  const level = options.level ?? 6;

  if (data.length < (options.threshold ?? 1024)) {
    return Buffer.from(data, 'utf-8');
  }

  return brotliCompressSync(Buffer.from(data, 'utf-8'), {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: level,
    },
  });
}

export function decompress(data: Buffer): string {
  // Check magic bytes for Brotli
  if (isBrotliCompressed(data)) {
    return brotliDecompressSync(data).toString('utf-8');
  }
  return data.toString('utf-8');
}

function isBrotliCompressed(data: Buffer): boolean {
  // Brotli doesn't have magic bytes, use heuristic
  // Try to decompress and catch error
  try {
    brotliDecompressSync(data);
    return true;
  } catch {
    return false;
  }
}
```

---

## Phase 5: Semantic Search

**Effort:** 25 hours | **Priority:** LOW | **ROI:** VERY HIGH (Capabilities)

### 5.1 Overview

Semantic search uses AI embeddings to find entities by meaning, not just text matching.

**Benefits:**
- "Find entities similar to X" without exact text match
- Automatic clustering of related entities
- Better duplicate detection via semantic similarity
- Natural language queries ("projects about authentication")

### 5.2 Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Semantic Search                    │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Embedding  │  │   Vector    │  │   Nearest   │ │
│  │   Service   │──│    Store    │──│  Neighbor   │ │
│  │  (OpenAI/   │  │  (SQLite/   │  │   Search    │ │
│  │   Local)    │  │   Memory)   │  │             │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 5.3 Implementation Plan

#### 5.3.1 Embedding Service Abstraction

**New File:** `src/memory/search/EmbeddingService.ts`

```typescript
export interface EmbeddingService {
  /** Generate embedding vector for text */
  embed(text: string): Promise<number[]>;

  /** Generate embeddings for multiple texts (batched) */
  embedBatch(texts: string[]): Promise<number[][]>;

  /** Embedding dimension size */
  readonly dimensions: number;
}

// OpenAI implementation
export class OpenAIEmbeddingService implements EmbeddingService {
  readonly dimensions = 1536; // text-embedding-3-small

  constructor(private apiKey: string) {}

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text,
      }),
    });

    const data = await response.json();
    return data.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Batch up to 2048 texts per request
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts,
      }),
    });

    const data = await response.json();
    return data.data.map((d: any) => d.embedding);
  }
}

// Local implementation using transformers.js (no API needed)
export class LocalEmbeddingService implements EmbeddingService {
  readonly dimensions = 384; // all-MiniLM-L6-v2
  private pipeline: any;

  async initialize(): Promise<void> {
    const { pipeline } = await import('@xenova/transformers');
    this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.pipeline(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }
}
```

#### 5.3.2 Vector Store

**SQLite Extension:**
```sql
-- Add to entities table
ALTER TABLE entities ADD COLUMN embedding BLOB;
ALTER TABLE entities ADD COLUMN embedding_model TEXT;
ALTER TABLE entities ADD COLUMN embedding_updated_at TEXT;

-- Create index for efficient similarity search (if using sqlite-vss extension)
CREATE VIRTUAL TABLE IF NOT EXISTS entity_vectors USING vss0(
  embedding(1536)  -- Dimension matches embedding model
);
```

**In-Memory Fallback:**
```typescript
class InMemoryVectorStore {
  private vectors: Map<string, number[]> = new Map();

  add(entityName: string, vector: number[]): void {
    this.vectors.set(entityName, vector);
  }

  search(queryVector: number[], k: number): Array<{ name: string; score: number }> {
    const scores: Array<{ name: string; score: number }> = [];

    for (const [name, vector] of this.vectors) {
      const score = this.cosineSimilarity(queryVector, vector);
      scores.push({ name, score });
    }

    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
```

#### 5.3.3 Semantic Search Manager

**New File:** `src/memory/search/SemanticSearch.ts`

```typescript
export class SemanticSearch {
  constructor(
    private embeddingService: EmbeddingService,
    private vectorStore: VectorStore,
    private storage: IGraphStorage
  ) {}

  /**
   * Index all entities for semantic search.
   * Call on startup or after bulk updates.
   */
  async indexAll(): Promise<void> {
    const graph = await this.storage.loadGraph();
    const texts = graph.entities.map(e => this.entityToText(e));

    // Batch embed
    const embeddings = await this.embeddingService.embedBatch(texts);

    // Store vectors
    for (let i = 0; i < graph.entities.length; i++) {
      this.vectorStore.add(graph.entities[i].name, embeddings[i]);
    }
  }

  /**
   * Find entities semantically similar to the query.
   */
  async search(query: string, limit: number = 10): Promise<SemanticSearchResult[]> {
    const queryVector = await this.embeddingService.embed(query);
    const results = this.vectorStore.search(queryVector, limit);

    const graph = await this.storage.loadGraph();
    return results.map(r => ({
      entity: graph.entities.find(e => e.name === r.name)!,
      similarity: r.score,
    }));
  }

  /**
   * Find entities similar to a given entity.
   */
  async findSimilar(entityName: string, limit: number = 10): Promise<SemanticSearchResult[]> {
    const graph = await this.storage.loadGraph();
    const entity = graph.entities.find(e => e.name === entityName);
    if (!entity) throw new EntityNotFoundError(entityName);

    const text = this.entityToText(entity);
    return this.search(text, limit + 1)
      .then(results => results.filter(r => r.entity.name !== entityName).slice(0, limit));
  }

  /**
   * Cluster entities by semantic similarity.
   */
  async cluster(k: number): Promise<EntityCluster[]> {
    // K-means clustering on embeddings
    // Implementation details...
  }

  private entityToText(entity: Entity): string {
    const parts = [
      entity.name,
      entity.entityType,
      ...(entity.observations || []),
      ...(entity.tags || []),
    ];
    return parts.join(' ');
  }
}
```

#### 5.3.4 New MCP Tools

```typescript
// Semantic search tool
{
  name: 'semantic_search',
  description: 'Find entities by semantic similarity to a natural language query',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Natural language search query' },
      limit: { type: 'number', description: 'Maximum results (default: 10)' }
    },
    required: ['query']
  }
},

// Find similar entities
{
  name: 'find_similar_entities',
  description: 'Find entities semantically similar to a given entity',
  inputSchema: {
    type: 'object',
    properties: {
      entityName: { type: 'string', description: 'Entity to find similar entities for' },
      limit: { type: 'number', description: 'Maximum results (default: 10)' }
    },
    required: ['entityName']
  }
},

// Cluster entities
{
  name: 'cluster_entities',
  description: 'Group entities into clusters based on semantic similarity',
  inputSchema: {
    type: 'object',
    properties: {
      clusters: { type: 'number', description: 'Number of clusters (default: auto-detect)' }
    }
  }
}
```

### 5.4 Configuration

```typescript
// Environment variables
MEMORY_EMBEDDING_PROVIDER=openai|local|none
MEMORY_OPENAI_API_KEY=sk-...
MEMORY_EMBEDDING_MODEL=text-embedding-3-small
MEMORY_AUTO_INDEX_EMBEDDINGS=true|false
```

---

## Implementation Schedule

### Timeline Overview

```
Week 1-2:   Phase 1 (Quick Wins) ──────────────── 8 hours
Week 3-4:   Phase 2 (Search Optimization) ─────── 12 hours
Week 5-8:   Phase 3 (Graph Algorithms) ────────── 24 hours
Week 9-14:  Phase 4 (Brotli Compression) ──────── 31 hours
Week 15-18: Phase 5 (Semantic Search) ─────────── 25 hours
```

### Detailed Schedule

| Week | Phase | Tasks | Hours |
|------|-------|-------|-------|
| 1 | 1 | SQLite indexes, bidirectional cache | 4 |
| 2 | 1 | RankedSearch cache, lazy loading | 4 |
| 3 | 2 | Fuzzy search cache | 4 |
| 4 | 2 | Boolean cache, pagination cache | 8 |
| 5 | 3 | GraphTraversal framework | 8 |
| 6 | 3 | BFS, DFS, shortest path | 6 |
| 7 | 3 | Connected components, centrality | 6 |
| 8 | 3 | MCP tools, relation weights | 4 |
| 9-10 | 4 | Compression module, backup compression | 13 |
| 11-12 | 4 | Export compression, MCP compression | 12 |
| 13-14 | 4 | Archive compression, polish | 6 |
| 15-16 | 5 | Embedding service, vector store | 12 |
| 17-18 | 5 | Semantic search, clustering, tools | 13 |

---

## Success Metrics

### Performance Metrics

| Metric | Baseline | Phase 1 | Phase 2 | Phase 3 | Target |
|--------|----------|---------|---------|---------|--------|
| Repeated fuzzy search | 100ms | 100ms | <5ms | <5ms | <5ms |
| Repeated boolean search | 50ms | 50ms | <5ms | <5ms | <5ms |
| Relation lookup (bidirectional) | 20ms | <5ms | <5ms | <5ms | <5ms |
| Startup time (10K entities) | 500ms | 50ms | 50ms | 50ms | <100ms |
| Shortest path (1000 nodes) | N/A | N/A | N/A | <50ms | <100ms |

### Storage Metrics

| Metric | Baseline | After Phase 4 | Reduction |
|--------|----------|---------------|-----------|
| Backup size (5K entities) | 1.25 MB | 375 KB | 70% |
| Export size (100K entities) | 25 MB | 7.5 MB | 70% |

### Capability Metrics

| Capability | Before | After |
|------------|--------|-------|
| Search algorithms | 5 | 6 (+ semantic) |
| Graph algorithms | 0 | 5 (BFS, DFS, shortest path, components, centrality) |
| MCP tools | 47 | 52+ |
| Embedding support | No | Yes |

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Embedding API costs | MEDIUM | MEDIUM | Offer local embedding option |
| SQLite VSS extension availability | LOW | HIGH | In-memory fallback |
| Backward compatibility | MEDIUM | HIGH | Version migration scripts |
| Performance regression | LOW | HIGH | Comprehensive benchmarks |

### Dependency Risks

| Dependency | Risk | Mitigation |
|------------|------|------------|
| OpenAI API | Rate limits, pricing changes | Local embedding fallback |
| better-sqlite3 | Native compilation issues | Document requirements |
| @xenova/transformers | Large bundle size | Optional dependency |

### Migration Risks

| Risk | Mitigation |
|------|------------|
| Existing data format changes | Versioned schemas, auto-migration |
| Index changes | Rebuild indexes on upgrade |
| API changes | Deprecation warnings, compatibility shims |

---

## Appendix A: File Changes Summary

### New Files

| File | Phase | Purpose |
|------|-------|---------|
| `src/memory/core/GraphTraversal.ts` | 3 | Graph algorithms |
| `src/memory/utils/compression.ts` | 4 | Brotli utilities |
| `src/memory/search/EmbeddingService.ts` | 5 | Embedding abstraction |
| `src/memory/search/VectorStore.ts` | 5 | Vector storage |
| `src/memory/search/SemanticSearch.ts` | 5 | Semantic search |

### Modified Files

| File | Phases | Changes |
|------|--------|---------|
| `src/memory/core/SQLiteStorage.ts` | 1, 5 | Indexes, embeddings |
| `src/memory/search/FuzzySearch.ts` | 2 | Caching |
| `src/memory/search/BooleanSearch.ts` | 2 | AST + result caching |
| `src/memory/search/SearchManager.ts` | 2 | Pagination cache |
| `src/memory/search/RankedSearch.ts` | 2 | Fallback cache |
| `src/memory/server/toolDefinitions.ts` | 3, 5 | New tools |
| `src/memory/server/toolHandlers.ts` | 3, 5 | New handlers |
| `src/memory/types/types.ts` | 3 | Relation weights |
| `src/memory/features/IOManager.ts` | 4 | Compression |

---

## Appendix B: Environment Variables

```bash
# Storage
MEMORY_FILE_PATH=/path/to/memory.jsonl
MEMORY_STORAGE_TYPE=sqlite|jsonl

# Compression (Phase 4)
MEMORY_COMPRESSION_ENABLED=true|false
MEMORY_COMPRESSION_LEVEL=6  # 1-11
MEMORY_COMPRESSION_THRESHOLD=1024  # bytes

# Embeddings (Phase 5)
MEMORY_EMBEDDING_PROVIDER=openai|local|none
MEMORY_OPENAI_API_KEY=sk-...
MEMORY_EMBEDDING_MODEL=text-embedding-3-small
MEMORY_AUTO_INDEX_EMBEDDINGS=true|false
```

---

*Document Version: 1.0.0 | Created: 2026-01-02 | Author: Claude*
