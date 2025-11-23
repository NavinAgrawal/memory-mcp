/**
 * Search Manager
 *
 * Orchestrates all search types (basic, ranked, boolean, fuzzy).
 *
 * @module search/SearchManager
 */

import type { KnowledgeGraph, SearchResult, SavedSearch } from '../types/index.js';
import type { GraphStorage } from '../core/GraphStorage.js';
import { BasicSearch } from './BasicSearch.js';
import { RankedSearch } from './RankedSearch.js';
import { BooleanSearch } from './BooleanSearch.js';
import { FuzzySearch } from './FuzzySearch.js';
import { SearchSuggestions } from './SearchSuggestions.js';
import { SavedSearchManager } from './SavedSearchManager.js';

/**
 * Unified search manager providing access to all search types.
 */
export class SearchManager {
  private basicSearch: BasicSearch;
  private rankedSearch: RankedSearch;
  private booleanSearch: BooleanSearch;
  private fuzzySearch: FuzzySearch;
  private searchSuggestions: SearchSuggestions;
  private savedSearchManager: SavedSearchManager;

  constructor(storage: GraphStorage, savedSearchesFilePath: string) {
    this.basicSearch = new BasicSearch(storage);
    this.rankedSearch = new RankedSearch(storage);
    this.booleanSearch = new BooleanSearch(storage);
    this.fuzzySearch = new FuzzySearch(storage);
    this.searchSuggestions = new SearchSuggestions(storage);
    this.savedSearchManager = new SavedSearchManager(savedSearchesFilePath, this.basicSearch);
  }

  // ==================== Basic Search ====================

  /**
   * Simple text-based search.
   *
   * @param query - Text to search for
   * @param tags - Optional tags filter
   * @param minImportance - Optional minimum importance
   * @param maxImportance - Optional maximum importance
   * @returns Filtered knowledge graph
   */
  async searchNodes(
    query: string,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number
  ): Promise<KnowledgeGraph> {
    return this.basicSearch.searchNodes(query, tags, minImportance, maxImportance);
  }

  /**
   * Open specific nodes by name.
   *
   * @param names - Array of entity names
   * @returns Knowledge graph with specified entities
   */
  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    return this.basicSearch.openNodes(names);
  }

  /**
   * Search by date range.
   *
   * @param startDate - Optional start date (ISO 8601)
   * @param endDate - Optional end date (ISO 8601)
   * @param entityType - Optional entity type filter
   * @param tags - Optional tags filter
   * @returns Filtered knowledge graph
   */
  async searchByDateRange(
    startDate?: string,
    endDate?: string,
    entityType?: string,
    tags?: string[]
  ): Promise<KnowledgeGraph> {
    return this.basicSearch.searchByDateRange(startDate, endDate, entityType, tags);
  }

  // ==================== Ranked Search ====================

  /**
   * TF-IDF ranked search.
   *
   * @param query - Search query
   * @param tags - Optional tags filter
   * @param minImportance - Optional minimum importance
   * @param maxImportance - Optional maximum importance
   * @param limit - Maximum results to return
   * @returns Array of search results sorted by relevance
   */
  async searchNodesRanked(
    query: string,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number,
    limit?: number
  ): Promise<SearchResult[]> {
    return this.rankedSearch.searchNodesRanked(query, tags, minImportance, maxImportance, limit);
  }

  // ==================== Boolean Search ====================

  /**
   * Boolean search with AND, OR, NOT operators.
   *
   * @param query - Boolean query string
   * @param tags - Optional tags filter
   * @param minImportance - Optional minimum importance
   * @param maxImportance - Optional maximum importance
   * @returns Filtered knowledge graph
   */
  async booleanSearch(
    query: string,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number
  ): Promise<KnowledgeGraph> {
    return this.booleanSearch.booleanSearch(query, tags, minImportance, maxImportance);
  }

  // ==================== Fuzzy Search ====================

  /**
   * Fuzzy search with typo tolerance.
   *
   * @param query - Search query
   * @param threshold - Similarity threshold (0.0 to 1.0)
   * @param tags - Optional tags filter
   * @param minImportance - Optional minimum importance
   * @param maxImportance - Optional maximum importance
   * @returns Filtered knowledge graph
   */
  async fuzzySearch(
    query: string,
    threshold?: number,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number
  ): Promise<KnowledgeGraph> {
    return this.fuzzySearch.fuzzySearch(query, threshold, tags, minImportance, maxImportance);
  }

  // ==================== Search Suggestions ====================

  /**
   * Get search suggestions for a query.
   *
   * @param query - Search query
   * @param maxSuggestions - Maximum suggestions to return
   * @returns Array of suggested terms
   */
  async getSearchSuggestions(query: string, maxSuggestions?: number): Promise<string[]> {
    return this.searchSuggestions.getSearchSuggestions(query, maxSuggestions);
  }

  // ==================== Saved Searches ====================

  /**
   * Save a search query.
   *
   * @param search - Search parameters
   * @returns Newly created saved search
   */
  async saveSearch(
    search: Omit<SavedSearch, 'createdAt' | 'useCount' | 'lastUsed'>
  ): Promise<SavedSearch> {
    return this.savedSearchManager.saveSearch(search);
  }

  /**
   * List all saved searches.
   *
   * @returns Array of saved searches
   */
  async listSavedSearches(): Promise<SavedSearch[]> {
    return this.savedSearchManager.listSavedSearches();
  }

  /**
   * Get a saved search by name.
   *
   * @param name - Search name
   * @returns Saved search or null
   */
  async getSavedSearch(name: string): Promise<SavedSearch | null> {
    return this.savedSearchManager.getSavedSearch(name);
  }

  /**
   * Execute a saved search.
   *
   * @param name - Search name
   * @returns Search results
   */
  async executeSavedSearch(name: string): Promise<KnowledgeGraph> {
    return this.savedSearchManager.executeSavedSearch(name);
  }

  /**
   * Delete a saved search.
   *
   * @param name - Search name
   * @returns True if deleted
   */
  async deleteSavedSearch(name: string): Promise<boolean> {
    return this.savedSearchManager.deleteSavedSearch(name);
  }

  /**
   * Update a saved search.
   *
   * @param name - Search name
   * @param updates - Fields to update
   * @returns Updated saved search
   */
  async updateSavedSearch(
    name: string,
    updates: Partial<Omit<SavedSearch, 'name' | 'createdAt' | 'useCount' | 'lastUsed'>>
  ): Promise<SavedSearch> {
    return this.savedSearchManager.updateSavedSearch(name, updates);
  }
}
