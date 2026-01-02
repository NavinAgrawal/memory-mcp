/**
 * Search Module Barrel Export
 *
 * Sprint 2: Added SearchFilterChain for centralized filter logic
 * Phase 4 Sprint 10: Added EmbeddingService for semantic search
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

// Phase 4 Sprint 10: Embedding Service for semantic search
export {
  OpenAIEmbeddingService,
  LocalEmbeddingService,
  MockEmbeddingService,
  createEmbeddingService,
} from './EmbeddingService.js';

// Phase 4 Sprint 11: Vector Store for semantic search
export {
  InMemoryVectorStore,
  SQLiteVectorStore,
  createVectorStore,
  cosineSimilarity,
  type SQLiteStorageWithEmbeddings,
} from './VectorStore.js';

// Phase 4 Sprint 12: Semantic Search Manager
export {
  SemanticSearch,
  entityToText,
} from './SemanticSearch.js';
