# Changelog

All notable changes to the Enhanced Memory MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.0] - 2025-11-24

### Changed
- **Improved Error Handling in CompressionManager**: Use custom error types
  - Replaced generic Error with InsufficientEntitiesError for merge operations
  - Replaced generic Error with EntityNotFoundError for missing entities
  - Updated JSDoc @throws annotations with specific error types
  - Enables better programmatic error handling for compression operations
  - Files: `features/CompressionManager.ts`

## [0.9.9] - 2025-11-24

### Changed
- **Improved Error Handling in HierarchyManager**: Use custom error types throughout
  - Replaced generic Error with EntityNotFoundError for missing entities
  - Replaced generic Error with CycleDetectedError for hierarchy cycles
  - Updated JSDoc @throws annotations with specific error types
  - Enables better programmatic error handling for hierarchical operations
  - Files: `features/HierarchyManager.ts`

## [0.9.8] - 2025-11-24

### Added
- **JSDoc Documentation for RelationManager**: Comprehensive API documentation for all public methods
  - `createRelations()`: Batch creation with duplicate filtering and timestamp management
  - `deleteRelations()`: Cascading timestamp updates for affected entities
  - `getRelations()`: Bidirectional relation lookup with filtering examples
  - Files: `core/RelationManager.ts`

## [0.9.7] - 2025-11-24

### Added
- **JSDoc Documentation for ObservationManager**: Comprehensive API documentation for all public methods
  - `addObservations()`: Batch addition with duplicate filtering and timestamp updates
  - `deleteObservations()`: Safe deletion with automatic timestamp management
  - Detailed examples showing single and multi-entity operations
  - Files: `core/ObservationManager.ts`

## [0.9.6] - 2025-11-24

### Changed
- **Improved Error Handling in ObservationManager**: Use EntityNotFoundError instead of generic Error
  - Better error messages with consistent error codes
  - Enables programmatic error handling for observation operations
  - Files: `core/ObservationManager.ts`

## [0.9.5] - 2025-11-24

### Added
- **JSDoc Documentation for EntityManager**: Comprehensive API documentation for all public methods
  - `createEntities()`: Detailed docs with batch creation examples, error handling, and timestamp behavior
  - `deleteEntities()`: Cascading deletion behavior documented with examples
  - `getEntity()`: Read-only retrieval with null-handling examples
  - `updateEntity()`: Partial update patterns with multiple field examples
  - Files: `core/EntityManager.ts`

## [0.9.4] - 2025-11-24

### Added
- **Custom Error Classes**: Comprehensive error type hierarchy for better error handling
  - `KnowledgeGraphError`: Base error class with error codes
  - `EntityNotFoundError`, `RelationNotFoundError`, `DuplicateEntityError`
  - `ValidationError`, `CycleDetectedError`, `InvalidImportanceError`
  - `FileOperationError`, `ImportError`, `ExportError`, `InsufficientEntitiesError`
  - All errors include error codes for programmatic handling
  - Files: `utils/errors.ts`, `core/EntityManager.ts`

### Changed
- **Error Handling**: EntityManager now uses custom error types
  - Better error messages with context
  - Enables programmatic error handling

## [0.9.3] - 2025-11-24

### Changed
- **Type Safety Improved**: Replaced `any` with `unknown` in validation utils
  - Added `isObject()` type guard for runtime validation
  - Files: `utils/validationUtils.ts`

### Added
- **JSDoc Documentation**: Comprehensive documentation for KnowledgeGraphManager getters
  - All getter properties have detailed JSDoc with examples
  - Files: `core/KnowledgeGraphManager.ts`

### Fixed
- **Import Fix**: Removed `as any` type casting in KnowledgeGraphManager
  - Properly imports and uses BasicSearch instance

## [0.9.2] - 2025-11-24

### Changed
- **Magic Numbers Extracted**: Replaced hardcoded values with named constants
  - `SIMILARITY_WEIGHTS` in `CompressionManager.ts` (NAME: 40%, TYPE: 20%, OBSERVATIONS: 30%, TAGS: 10%)
  - `DEFAULT_DUPLICATE_THRESHOLD` (0.8) in `CompressionManager.ts`
  - `DEFAULT_SEARCH_LIMIT` (50) and `MAX_SEARCH_LIMIT` (200) in `RankedSearch.ts`
  - `MIN_IMPORTANCE` (0) and `MAX_IMPORTANCE` (10) in `EntityManager.ts`
  - `DEFAULT_FUZZY_THRESHOLD` (0.7) in `FuzzySearch.ts`
  - All constants are now documented and configurable
  - Improves code maintainability and tunability

### Fixed
- **Search Limit Enforcement**: Added MAX_SEARCH_LIMIT enforcement in ranked search
  - Prevents resource exhaustion from excessively large limit values
  - Automatically caps limit at 200 results maximum

## [0.9.1] - 2025-11-24

### Fixed
- **Console Logging**: Replaced `console.error()` with `console.log()` for informational messages
  - Migration messages now use `[INFO]` prefix
  - Server startup messages now use `[INFO]` prefix
  - Keeps `console.error()` only for actual error conditions
  - Affected files: `index.ts`, `utils/pathUtils.ts`

### Changed
- **Dependencies**: Updated npm dependencies to latest compatible versions
  - Improved security posture
  - Reduced deprecated dependency warnings

## [0.9.0] - 2025-11-23

### Changed - Major Refactoring: Modular Architecture

#### Complete Codebase Restructure
Refactored monolithic `index.ts` (4,187 lines) into a clean, modular architecture with 40+ TypeScript files.

**New Module Structure:**
```
src/memory/
├── types/        (6 files) - Type definitions
├── utils/        (5 files) - Utility functions
├── core/         (5 files) - Storage & core managers
├── search/       (8 files) - Search implementations
└── features/     (9 files) - Feature managers
```

**Key Improvements:**
- ✅ **File Size Compliance**: All files under 400 lines (was 4,187 in monolith)
- ✅ **Separation of Concerns**: Each module has single, clear responsibility
- ✅ **Dependency Injection**: All managers receive dependencies via constructor
- ✅ **Composition Pattern**: KnowledgeGraphManager orchestrates via composition
- ✅ **Type Safety**: Comprehensive TypeScript interfaces throughout
- ✅ **Barrel Exports**: Clean import paths for all modules

**Modules Created:**

*Types (6 files):*
- `entity.types.ts` - Entity, Relation, KnowledgeGraph
- `search.types.ts` - SearchResult, SavedSearch, BooleanQueryNode
- `analytics.types.ts` - GraphStats, ValidationReport
- `import-export.types.ts` - ImportResult, CompressionResult
- `tag.types.ts` - TagAlias
- `index.ts` - Barrel export

*Utilities (5 files):*
- `levenshtein.ts` - String similarity algorithm
- `tfidf.ts` - TF-IDF search ranking
- `dateUtils.ts` - Date parsing and validation
- `validationUtils.ts` - Entity/relation validation
- `pathUtils.ts` - File path management

*Core (5 files):*
- `GraphStorage.ts` - JSONL file I/O
- `EntityManager.ts` - Entity CRUD operations
- `RelationManager.ts` - Relation CRUD operations
- `ObservationManager.ts` - Observation management
- `KnowledgeGraphManager.ts` - Main orchestrator

*Search (8 files):*
- `BasicSearch.ts` - Text search with filters
- `RankedSearch.ts` - TF-IDF relevance ranking
- `BooleanSearch.ts` - AND/OR/NOT query parsing
- `FuzzySearch.ts` - Typo-tolerant search
- `SearchSuggestions.ts` - "Did you mean?" suggestions
- `SavedSearchManager.ts` - Persistent saved searches
- `SearchManager.ts` - Unified search orchestrator
- `index.ts` - Barrel export

*Features (9 files):*
- `TagManager.ts` - Tag alias system
- `HierarchyManager.ts` - Parent-child relationships
- `AnalyticsManager.ts` - Graph validation
- `CompressionManager.ts` - Duplicate detection/merging
- `ArchiveManager.ts` - Entity archival
- `ExportManager.ts` - Multi-format export (JSON, CSV, GraphML, GEXF, DOT, Markdown, Mermaid)
- `ImportManager.ts` - Multi-format import with merge strategies
- `ImportExportManager.ts` - Import/export orchestrator
- `index.ts` - Barrel export

**Quality Metrics:**
- 📊 **40 TypeScript files** created (from 1 monolithic file)
- 📏 **Average file size**: ~200 lines (95% reduction)
- ✅ **TypeScript strict mode**: All files pass type checking
- ✅ **Test coverage**: 51/51 tests passing
- 📦 **Maintainability**: Easy to locate and modify functionality
- 🧪 **Testability**: Each module can be tested in isolation

**Backward Compatibility:**
- ✅ Full API compatibility maintained
- ✅ Same public interface via KnowledgeGraphManager
- ✅ No breaking changes to existing integrations

**Performance Benefits:**
- ⚡ Faster imports (import only what you need)
- 🌳 Better tree-shaking (unused modules eliminated)
- 👥 Parallel development (teams work on different modules)
- 🧪 Easier testing (isolated module testing)

**Developer Experience:**
- 📖 Comprehensive JSDoc documentation
- 🎯 Clear module boundaries
- 🔧 Dependency injection for flexibility
- 📦 Barrel exports for clean imports

**Migration:**
```typescript
// Before (still works!)
import { KnowledgeGraphManager } from './memory/index.js';

// After (recommended)
import { KnowledgeGraphManager } from './memory/core/index.js';

// Or use specific modules
import { EntityManager } from './memory/core/index.js';
import { RankedSearch } from './memory/search/index.js';
```

### Fixed
- Resolved duplicate identifier conflicts in SearchManager
- Fixed implicit any types in lambda parameters
- Corrected barrel export function names in utils module
- Fixed Levenshtein test assertion (expected value)

### Documentation
- Added REFACTORING_SUMMARY.md with complete architecture overview
- Added README files in each module directory
- Comprehensive JSDoc comments on all public methods

## [0.8.0] - 2025-11-23

### Added - Core Features: Hierarchical Nesting, Compression, and Archiving

#### Phase 2: Hierarchical Nesting (8 new tools)
**New Field:**
- **parentId** (string): Optional parent entity reference for tree structures

**New Tools:**
- **set_entity_parent** - Set or remove entity parent with cycle detection
- **get_children** - Get immediate children of an entity
- **get_parent** - Get parent of an entity
- **get_ancestors** - Get all ancestors (parent chain to root)
- **get_descendants** - Get all descendants recursively
- **get_subtree** - Get entity + descendants with relations
- **get_root_entities** - Get all entities with no parent
- **get_entity_depth** - Get depth in hierarchy (0 = root)

**Features:**
- Parent-child relationships for tree-like organization
- Cycle detection prevents circular relationships
- BFS traversal for descendants
- Depth calculation for hierarchy analysis

**Use Cases:**
- Projects → Features → Tasks → Subtasks
- Documents → Folders → Files → Sections
- Categories → Subcategories → Specific Items

#### Phase 3: Memory Compression (3 new tools)
**New Interface:**
- **CompressionResult** - Statistics for compression operations
  - duplicatesFound, entitiesMerged, observationsCompressed
  - relationsConsolidated, spaceFreed, mergedEntities

**New Tools:**
- **find_duplicates** - Find similar entities by threshold (default 0.8)
- **merge_entities** - Merge multiple entities into one
- **compress_graph** - Automated compression with dry-run mode

**Features:**
- Multi-factor similarity scoring (name, type, observations, tags)
- Weighted algorithm: Name 40%, Type 20%, Observations 30%, Tags 10%
- Levenshtein distance for name matching
- Jaccard similarity for set overlap
- Intelligent merging: combines unique observations/tags, preserves highest importance

**Use Cases:**
- Duplicate cleanup: Merge "Project Alpha" / "project-alpha"
- Data consolidation: Unify fragmented knowledge
- Storage optimization: Reduce graph size
- Quality improvement: Automated deduplication

#### Phase 4: Memory Archiving (1 new tool)
**New Tool:**
- **archive_entities** - Archive by age, importance, or tags

**Criteria (OR logic):**
- **olderThan** - Archive entities last modified before ISO date
- **importanceLessThan** - Archive entities below importance threshold
- **tags** - Archive entities with specific tags

**Features:**
- Multiple criteria support with OR logic
- Dry-run mode for safe preview
- Clean removal from active graph
- Relation cleanup for archived entities

**Use Cases:**
- Temporal: Archive entities > 6 months old
- Priority: Archive low-importance (< 3) entities
- Status: Archive "completed", "draft", "deprecated" tags
- Capacity: Keep active memory focused on current work

### Added - Tier 0 Enhancements (9 features, 18 new tools)

#### Week 1: Core Quality Improvements

**B5: Bulk Tag Operations (3 tools)**
- **add_tags_to_multiple** - Add tags to multiple entities at once
- **replace_tag** - Rename tag globally across all entities
- **merge_tags** - Combine two tags into one

**A1: Graph Validation (1 tool)**
- **validate_graph** - Comprehensive graph integrity checks
  - Orphaned relations detection
  - Duplicate entity detection
  - Invalid data validation
  - Warnings for isolated entities, empty observations, missing metadata

**C4: Saved Searches (5 tools)**
- **save_search** - Save search query with metadata
- **list_saved_searches** - List all saved searches
- **get_saved_search** - Retrieve saved search
- **execute_saved_search** - Run saved search with usage tracking
- **delete_saved_search** - Remove saved search
- **update_saved_search** - Modify saved search

**C2: Fuzzy Search (2 tools)**
- **fuzzy_search** - Typo-tolerant search using Levenshtein distance
- **get_search_suggestions** - "Did you mean?" suggestions

**B2: Tag Aliases (5 tools)**
- **add_tag_alias** - Create tag synonym (e.g., "ai" → "artificial-intelligence")
- **list_tag_aliases** - List all aliases
- **get_aliases_for_tag** - Get aliases for canonical tag
- **remove_tag_alias** - Delete alias
- **resolve_tag** - Resolve alias to canonical form

#### Week 2: Advanced Search & Import/Export

**C1: Full-Text Search with TF-IDF Ranking (1 tool)**
- **search_nodes_ranked** - Relevance-based search with TF-IDF scoring
  - Multi-term query support
  - Field-level match tracking
  - Configurable result limit (default 50, max 200)
  - Returns scores and matched fields

**C3: Boolean Search (1 tool)**
- **boolean_search** - Advanced queries with logical operators
  - Operators: AND, OR, NOT, parentheses
  - Field-specific: name:, type:, observation:, tag:
  - Quoted strings for exact phrases
  - Recursive descent parser with AST evaluation

**D1: Additional Export Formats (4 new formats)**
- **GEXF** - Gephi native format with full attributes
- **DOT** - GraphViz for publication-quality graphs
- **Markdown** - Human-readable documentation
- **Mermaid** - Embedded diagrams with importance-based coloring
- Updated export_graph tool to support 7 total formats

**D2: Import Capabilities (1 tool)**
- **import_graph** - Import from JSON, CSV, GraphML
  - Merge strategies: replace, skip, merge, fail
  - Dry-run mode for preview
  - ImportResult with detailed statistics
  - Error handling and validation

### Changed
- Updated version from 0.7.0 to 0.8.0
- Total code expansion: 1,210 → 4,550 lines (+3,340 lines, +276%)
- Total MCP tools: 15 → 45 tools (+30 new, +200%)
- Export formats: 3 → 7 formats (+133%)
- Storage files: 1 → 4 files (memory.jsonl, saved-searches, tag-aliases, archive)

### Technical Notes
- All new fields optional for backward compatibility
- Cycle detection for hierarchies prevents invalid states
- Multi-factor similarity scoring for intelligent compression
- Criteria-based archiving with OR logic
- Dry-run modes for safe preview of destructive operations
- Comprehensive error handling throughout

## [0.7.0] - 2025-11-09

### Added - Phase 4: Export & Batch Operations

#### New Tools
- **export_graph** - Export knowledge graph in multiple formats
  - JSON format: Pretty-printed with all entity and relation data
  - CSV format: Two-section format (entities + relations) with proper escaping
  - GraphML format: Standard XML for visualization tools (Gephi, Cytoscape, yEd)
  - Optional filter parameter supports: startDate, endDate, entityType, tags
  - All export formats include Phase 1-3 fields (timestamps, tags, importance)

#### Enhancements
- Added JSDoc documentation to `createEntities()` and `createRelations()` for batch operation efficiency
- Documented single `saveGraph()` call per batch operation
- CSV export includes proper escaping for commas, quotes, and newlines
- GraphML export includes all node/edge attributes with proper XML escaping

### Added - Phase 3: Tags & Importance Categorization

#### New Fields
- **tags** (string[]): Optional array of tags for entity categorization
  - Normalized to lowercase for case-insensitive matching
  - Persisted to JSONL storage
- **importance** (number): Optional importance level (0-10 scale)
  - Validated on creation and modification
  - Used for filtering and prioritization

#### New Tools
- **add_tags** - Add tags to existing entities
  - Normalizes tags to lowercase
  - Prevents duplicates
  - Updates lastModified timestamp
- **remove_tags** - Remove tags from entities
  - Case-insensitive matching
  - Updates lastModified timestamp
- **set_importance** - Set entity importance level
  - Validates 0-10 range
  - Updates lastModified timestamp

#### Enhanced Tools
- **search_nodes** - Added optional filters:
  - `tags` (string[]): Filter by tags (case-insensitive)
  - `minImportance` (number): Minimum importance threshold
  - `maxImportance` (number): Maximum importance threshold
- **search_by_date_range** - Added optional `tags` filter parameter

### Added - Phase 2: Search & Analytics

#### New Tools
- **search_by_date_range** - Filter entities and relations by date range
  - Parameters: startDate (optional), endDate (optional), entityType (optional)
  - Uses lastModified or createdAt as fallback
  - Returns filtered knowledge graph
- **get_graph_stats** - Get comprehensive graph statistics
  - Total counts for entities and relations
  - Entity types breakdown (count per type)
  - Relation types breakdown (count per type)
  - Oldest and newest entities with dates
  - Oldest and newest relations with dates
  - Date ranges for entities and relations

#### New Interface
- **GraphStats** - TypeScript interface for statistics output
  - totalEntities, totalRelations
  - entityTypesCounts, relationTypesCounts
  - oldestEntity, newestEntity, oldestRelation, newestRelation
  - entityDateRange, relationDateRange

### Added - Phase 1: Timestamp Tracking

#### New Fields
- **createdAt** (string): ISO 8601 timestamp for entity/relation creation
  - Auto-generated if not provided
  - Persisted to JSONL storage
- **lastModified** (string): ISO 8601 timestamp for last modification
  - Auto-updated on all modification operations
  - Smart updates: only changes when actual modifications occur

#### Modified Methods
- **createEntities()** - Auto-generates createdAt and lastModified timestamps
- **createRelations()** - Auto-generates createdAt and lastModified timestamps
- **addObservations()** - Updates lastModified only if observations added
- **deleteObservations()** - Updates lastModified only if observations removed
- **deleteRelations()** - Updates lastModified on affected entities
- **loadGraph()** - Backward compatibility for data without timestamps
- **saveGraph()** - Persists timestamps to JSONL format

#### Technical Details
- All timestamps use ISO 8601 format via `new Date().toISOString()`
- Optional fields (`?`) ensure backward compatibility
- Smart timestamp logic: only update when actual changes occur
- Relation deletions update `lastModified` on affected entities

### Changed
- Updated server version from 0.6.3 to 0.7.0
- Total code expansion: 713 → 1,210 lines (+497 lines, +70%)
- Total MCP tools: 11 → 15 tools (+4 new)

### Technical Notes
- All new fields are optional for backward compatibility
- Existing data loads gracefully without timestamps, tags, or importance
- All export formats maintain backward compatibility
- Filter logic reused across search_nodes, searchByDateRange, and export_graph

## [0.6.3] - 2025-11-09 (Initial Fork)

### Added
- Forked from modelcontextprotocol/servers
- Base memory MCP with 11 original tools:
  - create_entities
  - create_relations
  - add_observations
  - delete_entities
  - delete_observations
  - delete_relations
  - read_graph
  - search_nodes
  - open_nodes

### Repository
- GitHub: https://github.com/danielsimonjr/mcp-servers
- Location: c:/mcp-servers/memory-mcp/
- Branch: main

---

## Summary of Enhancements

| Phase | Features | Tools Added | Lines Added |
|-------|----------|-------------|-------------|
| Phase 1 | Timestamp tracking (createdAt, lastModified) | 0 | +223 |
| Phase 2 | Search & analytics | 2 (search_by_date_range, get_graph_stats) | Included in Phase 1 |
| Phase 3 | Tags & importance | 3 (add_tags, remove_tags, set_importance) | +249 |
| Phase 4 | Export & batch ops | 1 (export_graph) | +248 |
| **Total** | **All enhancements** | **+4 tools (15 total)** | **+497 lines (+70%)** |

## Links
- [Repository](https://github.com/danielsimonjr/mcp-servers)
- [Workflow Guide](WORKFLOW.md)
- [Model Context Protocol](https://modelcontextprotocol.io)
