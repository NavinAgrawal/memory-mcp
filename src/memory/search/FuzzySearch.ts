/**
 * Fuzzy Search
 *
 * Search with typo tolerance using Levenshtein distance similarity.
 *
 * @module search/FuzzySearch
 */

import type { Entity, KnowledgeGraph } from '../types/index.js';
import type { GraphStorage } from '../core/GraphStorage.js';
import { levenshteinDistance } from '../utils/index.js';
import { SEARCH_LIMITS } from '../utils/constants.js';
import { SearchFilterChain, type SearchFilters } from './SearchFilterChain.js';

/**
 * Default fuzzy search similarity threshold (70% match required).
 * Lower values are more permissive (more typos tolerated).
 * Higher values are stricter (fewer typos tolerated).
 */
export const DEFAULT_FUZZY_THRESHOLD = 0.7;

/**
 * Phase 4 Sprint 3: Cache entry for fuzzy search results.
 */
interface FuzzyCacheEntry {
  /** Cached entity names that matched */
  entityNames: string[];
  /** Entity count when cache was created (for invalidation) */
  entityCount: number;
  /** Timestamp when cached */
  timestamp: number;
}

/**
 * Phase 4 Sprint 3: Maximum cache size to prevent memory bloat.
 */
const FUZZY_CACHE_MAX_SIZE = 100;

/**
 * Phase 4 Sprint 3: Cache TTL in milliseconds (5 minutes).
 */
const FUZZY_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Performs fuzzy search with configurable similarity threshold.
 */
export class FuzzySearch {
  /**
   * Phase 4 Sprint 3: Result cache for fuzzy search.
   * Maps cache key -> cached entity names.
   */
  private fuzzyResultCache: Map<string, FuzzyCacheEntry> = new Map();

  constructor(private storage: GraphStorage) {}

  /**
   * Phase 4 Sprint 3: Generate cache key for fuzzy search parameters.
   */
  private generateCacheKey(
    query: string,
    threshold: number,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number,
    offset?: number,
    limit?: number
  ): string {
    return JSON.stringify({
      q: query.toLowerCase(),
      t: threshold,
      tags: tags?.sort().join(',') ?? '',
      min: minImportance,
      max: maxImportance,
      off: offset,
      lim: limit,
    });
  }

  /**
   * Phase 4 Sprint 3: Clear the fuzzy search cache.
   */
  clearCache(): void {
    this.fuzzyResultCache.clear();
  }

  /**
   * Phase 4 Sprint 3: Invalidate stale cache entries.
   */
  private cleanupCache(): void {
    const now = Date.now();
    const entries = Array.from(this.fuzzyResultCache.entries());

    // Remove expired entries
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > FUZZY_CACHE_TTL_MS) {
        this.fuzzyResultCache.delete(key);
      }
    }

    // If still over limit, remove oldest entries
    if (this.fuzzyResultCache.size > FUZZY_CACHE_MAX_SIZE) {
      const sortedEntries = entries
        .filter(([k]) => this.fuzzyResultCache.has(k))
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const toRemove = sortedEntries.slice(0, this.fuzzyResultCache.size - FUZZY_CACHE_MAX_SIZE);
      for (const [key] of toRemove) {
        this.fuzzyResultCache.delete(key);
      }
    }
  }

  /**
   * Fuzzy search for entities with typo tolerance and pagination.
   *
   * Uses Levenshtein distance to calculate similarity between strings.
   * Matches if similarity >= threshold (0.0 to 1.0).
   *
   * Phase 4 Sprint 3: Implements result caching for repeated queries.
   *
   * @param query - Search query
   * @param threshold - Similarity threshold (0.0 to 1.0), default DEFAULT_FUZZY_THRESHOLD
   * @param tags - Optional tags filter
   * @param minImportance - Optional minimum importance
   * @param maxImportance - Optional maximum importance
   * @param offset - Number of results to skip (default: 0)
   * @param limit - Maximum number of results (default: 50, max: 200)
   * @returns Filtered knowledge graph with fuzzy matches and pagination applied
   */
  async fuzzySearch(
    query: string,
    threshold: number = DEFAULT_FUZZY_THRESHOLD,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number,
    offset: number = 0,
    limit: number = SEARCH_LIMITS.DEFAULT
  ): Promise<KnowledgeGraph> {
    const graph = await this.storage.loadGraph();
    const queryLower = query.toLowerCase();

    // Phase 4 Sprint 3: Generate cache key and check cache
    const cacheKey = this.generateCacheKey(query, threshold, tags, minImportance, maxImportance, offset, limit);
    const cached = this.fuzzyResultCache.get(cacheKey);

    // Check if cache is valid (entity count hasn't changed)
    if (cached && cached.entityCount === graph.entities.length) {
      const now = Date.now();
      if (now - cached.timestamp < FUZZY_CACHE_TTL_MS) {
        // Return cached results
        const cachedNameSet = new Set(cached.entityNames);
        const cachedEntities = graph.entities.filter(e => cachedNameSet.has(e.name));
        const cachedEntityNames = new Set(cached.entityNames);
        const cachedRelations = graph.relations.filter(
          r => cachedEntityNames.has(r.from) && cachedEntityNames.has(r.to)
        );
        return { entities: cachedEntities, relations: cachedRelations };
      }
    }

    // Perform fuzzy search
    const fuzzyMatched = this.performFuzzyMatch(graph.entities, queryLower, threshold);

    // Apply tag and importance filters using SearchFilterChain
    const filters: SearchFilters = { tags, minImportance, maxImportance };
    const filteredEntities = SearchFilterChain.applyFilters(fuzzyMatched, filters);

    // Apply pagination using SearchFilterChain
    const pagination = SearchFilterChain.validatePagination(offset, limit);
    const paginatedEntities = SearchFilterChain.paginate(filteredEntities, pagination);

    // Phase 4 Sprint 3: Cache the results
    this.fuzzyResultCache.set(cacheKey, {
      entityNames: paginatedEntities.map(e => e.name),
      entityCount: graph.entities.length,
      timestamp: Date.now(),
    });

    // Cleanup old cache entries periodically
    if (this.fuzzyResultCache.size > FUZZY_CACHE_MAX_SIZE / 2) {
      this.cleanupCache();
    }

    const filteredEntityNames = new Set(paginatedEntities.map(e => e.name));
    const filteredRelations = graph.relations.filter(
      r => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    return {
      entities: paginatedEntities,
      relations: filteredRelations,
    };
  }

  /**
   * Phase 4 Sprint 3: Perform the actual fuzzy matching logic.
   * Extracted from fuzzySearch for cleaner code structure.
   */
  private performFuzzyMatch(entities: readonly Entity[], queryLower: string, threshold: number): Entity[] {
    return entities.filter(e => {
      const lowercased = this.storage.getLowercased(e.name);

      // Check name match (use pre-computed lowercase)
      const nameLower = lowercased?.name ?? e.name.toLowerCase();
      if (this.isFuzzyMatchLower(nameLower, queryLower, threshold)) return true;

      // Check type match (use pre-computed lowercase)
      const typeLower = lowercased?.entityType ?? e.entityType.toLowerCase();
      if (this.isFuzzyMatchLower(typeLower, queryLower, threshold)) return true;

      // Check observations (use pre-computed lowercase array)
      const obsLower = lowercased?.observations ?? e.observations.map(o => o.toLowerCase());
      return obsLower.some(
        o =>
          // For observations, split into words and check each word
          o
            .split(/\s+/)
            .some(word => this.isFuzzyMatchLower(word, queryLower, threshold)) ||
          // Also check if the observation contains the query
          this.isFuzzyMatchLower(o, queryLower, threshold)
      );
    }) as Entity[];
  }

  /**
   * Check if two already-lowercase strings match with fuzzy logic.
   *
   * OPTIMIZED: Skips toLowerCase() calls when strings are already lowercase.
   *
   * @param s1 - First string (already lowercase)
   * @param s2 - Second string (already lowercase)
   * @param threshold - Similarity threshold (0.0 to 1.0)
   * @returns True if strings match fuzzily
   */
  private isFuzzyMatchLower(s1: string, s2: string, threshold: number = 0.7): boolean {
    // Exact match
    if (s1 === s2) return true;

    // One contains the other
    if (s1.includes(s2) || s2.includes(s1)) return true;

    // Calculate similarity using Levenshtein distance
    const distance = levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    const similarity = 1 - distance / maxLength;

    return similarity >= threshold;
  }
}
