/**
 * Search Module Barrel Export
 *
 * Sprint 2: Added SearchFilterChain for centralized filter logic
 */

export { BasicSearch } from './BasicSearch.js';
export { RankedSearch } from './RankedSearch.js';
export { BooleanSearch } from './BooleanSearch.js';
export { FuzzySearch } from './FuzzySearch.js';
export { SearchSuggestions } from './SearchSuggestions.js';
export { SavedSearchManager } from './SavedSearchManager.js';
export { SearchManager } from './SearchManager.js';

// Sprint 2: Search Filter Chain utilities
export { SearchFilterChain, type SearchFilters, type ValidatedPagination } from './SearchFilterChain.js';
