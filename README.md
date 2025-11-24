# Memory MCP Server

[![Version](https://img.shields.io/badge/version-0.11.5-blue.svg)](https://github.com/danielsimonjr/memory-mcp)
[![NPM](https://img.shields.io/npm/v/@danielsimonjr/memory-mcp.svg)](https://www.npmjs.com/package/@danielsimonjr/memory-mcp)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-1.0-purple.svg)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)

An **enhanced fork** of the official [Model Context Protocol](https://modelcontextprotocol.io) memory server with advanced features for **hierarchical nesting**, **intelligent compression**, **archiving**, **advanced search**, and **multi-format import/export**.

> **Enterprise-grade knowledge graph** with 45 tools, hierarchical organization, duplicate detection, smart archiving, and sophisticated search capabilities for long-term memory management.

## Table of Contents

- [Features](#features)
- [What's New](#whats-new)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Usage Examples](#usage-examples)
- [Comprehensive Guides](#comprehensive-guides)
- [Configuration](#configuration)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Features

### Core Memory Capabilities
- ✅ **Knowledge Graph Storage**: Entity-Relation-Observation model
- ✅ **Persistent Memory**: Remember information across chat sessions
- ✅ **Full CRUD Operations**: Create, read, update, delete entities and relations
- ✅ **Flexible Search**: Text-based, fuzzy, boolean, and TF-IDF ranked search

### v0.9.0 Architecture Update
- 🏗️ **Modular Architecture**: Refactored from 4,187-line monolith to 40+ focused modules
- 📦 **Clean Separation**: Types, Utils, Core, Search, Features modules
- ✅ **100% Test Coverage**: All 51 tests passing with TypeScript strict mode
- 🎯 **Developer Experience**: Comprehensive JSDoc, barrel exports, dependency injection
- ⚡ **Performance**: Better tree-shaking, faster imports, parallel development

### v0.8.0 Major Features
- 🚀 **Hierarchical Nesting**: Parent-child relationships for tree structures (8 tools)
- 🚀 **Memory Compression**: Intelligent duplicate detection and merging (3 tools)
- 🚀 **Smart Archiving**: Criteria-based archiving by age, importance, tags (1 tool)
- 🚀 **Advanced Search**: TF-IDF ranking, boolean queries, fuzzy matching (3 tools)
- 🚀 **Import/Export**: 7 formats (JSON, CSV, GraphML, GEXF, DOT, Markdown, Mermaid)
- 🚀 **Tag Management**: Aliases, bulk operations, validation (11 tools)
- 🚀 **Saved Searches**: Store and execute frequent queries (5 tools)
- 🚀 **Graph Validation**: Integrity checks, orphan detection (1 tool)

### Enhanced Features (v0.7.0)
- ✅ **Automatic Timestamps**: `createdAt` and `lastModified` fields with smart updates
- ✅ **Date Range Search**: Filter entities/relations by creation or modification date
- ✅ **Graph Statistics**: Comprehensive analytics with counts, types, and temporal data
- ✅ **Tags System**: Categorize entities with case-insensitive tags
- ✅ **Importance Levels**: 0-10 scale for entity prioritization
- ✅ **Advanced Filtering**: Combine text, tags, importance, and date ranges

### Comparison with Official Memory Server

| Feature | Official | Enhanced (This Fork) |
|---------|----------|----------------------|
| Entity Management | ✅ | ✅ |
| Relation Management | ✅ | ✅ |
| Observation Tracking | ✅ | ✅ |
| Basic Search | ✅ | ✅ |
| **Hierarchical Nesting** | ❌ | ✅ Parent-child trees |
| **Memory Compression** | ❌ | ✅ Duplicate detection (50x faster) |
| **Smart Archiving** | ❌ | ✅ Criteria-based |
| **Advanced Search** | ❌ | ✅ TF-IDF + Boolean |
| **Fuzzy Search** | ❌ | ✅ Typo-tolerant |
| **Saved Searches** | ❌ | ✅ Store queries |
| **Tag Aliases** | ❌ | ✅ Synonyms |
| **Graph Validation** | ❌ | ✅ Integrity checks |
| **Timestamps** | ❌ | ✅ createdAt + lastModified |
| **Importance Levels** | ❌ | ✅ 0-10 scale |
| **Export Formats** | ❌ | ✅ 7 formats |
| **Import** | ❌ | ✅ 3 formats + merge |
| **Input Validation** | ❌ | ✅ Zod schemas (14 validators) |
| **Caching Layer** | ❌ | ✅ In-memory (instant reads) |
| **Backup & Restore** | ❌ | ✅ Point-in-time recovery |
| **Transactions** | ❌ | ✅ ACID guarantees |
| **Security** | ⚠️ Vulnerabilities | ✅ 0 CVEs |
| **Test Coverage** | Basic | ✅ 83 tests (comprehensive) |
| **Total Tools** | 11 | **45** (+309%) |
| **Code Structure** | Monolithic | **Modular** (40+ files) |
| **Code Size** | ~700 LOC | **5,200 LOC** (+642%) |
| **Avg File Size** | N/A | **~200 lines** |

## What's New

### Version 0.11.5 (Latest - November 2025)

**🔐 Production-Ready Enterprise Features**

Critical improvements for production deployments with enhanced security, performance, and data integrity:

**🛡️ Security & Validation (v0.11.0 - v0.11.1)**
- ✅ **All Security Vulnerabilities Fixed**: 0 CVEs (updated vitest 2.1.8 → 4.0.13)
- ✅ **Input Validation with Zod**: 14 comprehensive schemas prevent malformed data & injection attacks
  - Entity/Relation validation with size constraints
  - Importance range validation (0-10)
  - Batch operation limits (1-1000 items)
  - ISO 8601 date validation
  - Tag/observation length limits

**⚡ Performance Optimizations (v0.11.2 - v0.11.3)**
- ✅ **O(n²) → O(n·k) Duplicate Detection**: 50x faster for large graphs (10k entities: 50M → 1M comparisons)
  - Two-level bucketing strategy (type + name prefix)
  - Maintains accuracy while dramatically improving speed
- ✅ **In-Memory Caching Layer**: Eliminates repeated disk reads
  - O(n) → O(1) for read-heavy workloads
  - Write-through invalidation ensures consistency
  - Deep copy returns prevent cache pollution

**🔒 Data Protection & Integrity (v0.11.4 - v0.11.5)**
- ✅ **Backup & Restore System**: Point-in-time recovery with metadata
  - Timestamped backups with entity/relation counts
  - Automatic cleanup (keep N most recent)
  - Backup browsing and selective restoration
- ✅ **Transaction Support**: ACID-compliant atomic operations
  - Begin/Commit/Rollback with automatic backup
  - Stage multiple operations, commit atomically
  - All succeed together or all fail (no partial failures)
  - Critical for data integrity in production

**📊 Impact Summary**
- **Security**: 0 vulnerabilities, comprehensive input validation
- **Performance**: 50x faster duplicate detection, near-instant graph reads
- **Reliability**: Full backup/restore, atomic transactions, zero data corruption risk
- **Production**: Enterprise-grade data protection and integrity guarantees

### Version 0.9.0 (November 2025)

**🏗️ Major Architecture Refactoring**

Complete codebase restructure from monolithic file (4,187 lines) to clean, modular architecture:

**New Module Structure:**
```
src/memory/
├── types/        (6 files)  - Type definitions
├── utils/        (5 files)  - Utility functions
├── core/         (5 files)  - Storage & managers
├── search/       (8 files)  - Search implementations
└── features/     (9 files)  - Feature managers
```

**Key Improvements:**
- ✅ **40 TypeScript modules** (avg ~200 lines each)
- ✅ **100% test coverage** - All 51 tests passing
- ✅ **TypeScript strict mode** - Full type safety
- ✅ **Dependency injection** - Flexible, testable design
- ✅ **Barrel exports** - Clean import paths
- ✅ **Backward compatible** - No breaking changes

**Developer Experience:**
```typescript
// Use the main orchestrator
import { KnowledgeGraphManager } from './memory/core';

// Or use specific modules
import { EntityManager } from './memory/core';
import { RankedSearch } from './memory/search';
import { CompressionManager } from './memory/features';
```

**Benefits:**
- ⚡ Faster imports (tree-shaking)
- 🧪 Easier testing (isolated modules)
- 👥 Parallel development
- 📖 Clear module boundaries
- 🔧 Better maintainability

See [CHANGELOG.md](CHANGELOG.md) for complete details.

### Version 0.8.0 (November 2025)

**🚀 Hierarchical Nesting (8 new tools)**
- Parent-child entity relationships for tree structures
- Cycle detection prevents circular references
- Navigate ancestors, descendants, subtrees
- Get root entities and hierarchy depth
- Use cases: Projects → Features → Tasks → Subtasks

**🚀 Memory Compression (3 new tools)**
- Find duplicates with multi-factor similarity scoring
- Merge entities intelligently (combines observations/tags)
- Auto-compress with dry-run preview
- Weighted algorithm: Name 40%, Type 20%, Observations 30%, Tags 10%

**🚀 Smart Archiving (1 new tool)**
- Archive by age (olderThan), importance (< threshold), or tags
- Multiple criteria with OR logic
- Dry-run mode for safe preview
- Clean removal from active graph with relation cleanup

**🔍 Advanced Search (3 new tools)**
- TF-IDF relevance ranking with scores
- Boolean queries (AND, OR, NOT, parentheses)
- Fuzzy search with typo tolerance
- Field-specific queries (name:, type:, observation:, tag:)

**📦 Import/Export (5 new tools + 4 formats)**
- Import from JSON, CSV, GraphML with merge strategies
- Export to GEXF (Gephi), DOT (GraphViz), Markdown, Mermaid
- 7 total export formats for different use cases
- Dry-run and preview modes

**🏷️ Enhanced Tag Management (8 new tools)**
- Tag aliases for synonyms
- Bulk tag operations (add to multiple, replace, merge)
- Saved searches with usage tracking
- Graph validation with orphan detection

**Stats:** +30 tools (15 → 45), +3,340 LOC (+276%), 4 storage files

### Version 0.7.0 (November 2025)

**Phase 1-4: Foundation Features**
- Automatic timestamps (createdAt, lastModified)
- Date range search and graph statistics
- Tags system and importance levels (0-10)
- Export to JSON, CSV, GraphML

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

## Quick Start

### 1. Install from NPM (Recommended)

```bash
npm install -g @danielsimonjr/memory-mcp
```

Or use with npx (no installation required):

```bash
npx @danielsimonjr/memory-mcp
```

### 2. Configure Claude Desktop

Add to `claude_desktop_config.json`:

**Using NPM Global Install:**
```json
{
  "mcpServers": {
    "memory": {
      "command": "mcp-server-memory"
    }
  }
}
```

**Using NPX:**
```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@danielsimonjr/memory-mcp"]
    }
  }
}
```

### 3. Restart Claude Desktop

Restart Claude Desktop to load the enhanced memory server.

### 4. Start Using

Tell Claude:
```
Please remember that I prefer TypeScript over JavaScript.
Tag this as "preferences" with importance 8.
Create a parent entity called "Development Preferences" and nest this under it.
```

Claude will automatically use the enhanced tools!

## Installation

### Local Build (Recommended)

```bash
# Clone repository
git clone https://github.com/danielsimonjr/memory-mcp.git
cd memory-mcp

# Install and build
npm install
npm run build

# Run tests
npm test

# Type check
npm run typecheck
```

### Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["<PATH_TO>/memory-mcp/src/memory/dist/index.js"],
      "env": {
        "MEMORY_FILE_PATH": "<PATH_TO>/memory.jsonl"
      }
    }
  }
}
```

Replace `<PATH_TO>` with your actual paths.

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/memory-mcp/src/memory/dist/index.js"]
    }
  }
}
```

## Core Concepts

### Entities

**Primary nodes** in the knowledge graph.

**Fields:**
- `name` (string): Unique identifier
- `entityType` (string): Classification
- `observations` (string[]): Facts about the entity
- `parentId` (string, optional): Parent entity name for hierarchical nesting
- `createdAt` (string, optional): ISO 8601 timestamp
- `lastModified` (string, optional): ISO 8601 timestamp
- `tags` (string[], optional): Lowercase tags for categorization
- `importance` (number, optional): 0-10 scale for prioritization

**Example:**
```json
{
  "name": "John_Smith",
  "entityType": "person",
  "observations": ["Speaks fluent Spanish", "Senior developer"],
  "parentId": "Engineering_Team",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "tags": ["colleague", "engineering"],
  "importance": 7
}
```

### Relations

**Directed connections** between entities.

**Fields:**
- `from` (string): Source entity name
- `to` (string): Target entity name
- `relationType` (string): Relationship type
- `createdAt` (string, optional): ISO 8601 timestamp
- `lastModified` (string, optional): ISO 8601 timestamp

**Example:**
```json
{
  "from": "John_Smith",
  "to": "Anthropic",
  "relationType": "works_at",
  "createdAt": "2025-01-15T10:30:00.000Z"
}
```

### Observations

**Discrete facts** about entities.

**Principles:**
- One fact per observation
- Atomic information
- Independently manageable

## API Reference

### Complete Tool List (45 Tools)

#### Core Entity & Relation Management (9 tools)
- `create_entities` - Create multiple new entities
- `create_relations` - Create multiple new relations
- `add_observations` - Add observations to entities
- `delete_entities` - Remove entities and their relations
- `delete_observations` - Remove specific observations
- `delete_relations` - Remove specific relations
- `read_graph` - Read entire knowledge graph
- `search_nodes` - Search for nodes by query
- `open_nodes` - Retrieve specific nodes by name

#### Hierarchical Nesting (8 tools)
- `set_entity_parent` - Set or remove parent relationship
- `get_children` - Get immediate children
- `get_parent` - Get parent entity
- `get_ancestors` - Get all ancestors (parent chain)
- `get_descendants` - Get all descendants (recursive)
- `get_subtree` - Get entity + descendants with relations
- `get_root_entities` - Get all entities with no parent
- `get_entity_depth` - Get depth in hierarchy (0 = root)

#### Memory Compression (3 tools)
- `find_duplicates` - Find similar entities by threshold
- `merge_entities` - Merge multiple entities into one
- `compress_graph` - Automated compression with dry-run

#### Memory Archiving (1 tool)
- `archive_entities` - Archive by age, importance, or tags

#### Advanced Search (3 tools)
- `search_nodes_ranked` - TF-IDF relevance ranking
- `boolean_search` - Boolean queries (AND/OR/NOT)
- `fuzzy_search` - Typo-tolerant search

#### Search Management (6 tools)
- `save_search` - Save search query
- `list_saved_searches` - List all saved searches
- `get_saved_search` - Get saved search details
- `execute_saved_search` - Execute saved search
- `delete_saved_search` - Delete saved search
- `update_saved_search` - Update saved search
- `get_search_suggestions` - Get "Did you mean?" suggestions

#### Tag Management (8 tools)
- `add_tags` - Add tags to entity
- `remove_tags` - Remove tags from entity
- `add_tags_to_multiple` - Add tags to multiple entities
- `replace_tag` - Replace tag globally
- `merge_tags` - Merge two tags into one
- `add_tag_alias` - Create tag synonym
- `list_tag_aliases` - List all tag aliases
- `get_aliases_for_tag` - Get aliases for tag
- `remove_tag_alias` - Remove tag alias
- `resolve_tag` - Resolve alias to canonical form

#### Graph Analytics & Validation (3 tools)
- `get_graph_stats` - Get comprehensive graph statistics
- `search_by_date_range` - Filter by date range
- `validate_graph` - Validate graph integrity
- `set_importance` - Set entity importance (0-10)

#### Import & Export (2 tools)
- `export_graph` - Export in 7 formats
- `import_graph` - Import from JSON/CSV/GraphML

---

### Detailed API Documentation

<details>
<summary><b>Core: create_entities</b></summary>

Create multiple new entities in the knowledge graph.

**Input:**
```typescript
{
  entities: Array<{
    name: string;
    entityType: string;
    observations: string[];
    parentId?: string;      // NEW in v0.8.0
    tags?: string[];
    importance?: number;    // 0-10
  }>
}
```

**Returns:** Array of created entities with timestamps

**Example:**
```json
{
  "entities": [{
    "name": "Project_Alpha",
    "entityType": "project",
    "observations": ["Web application rewrite"],
    "tags": ["high-priority"],
    "importance": 8
  }]
}
```
</details>

<details>
<summary><b>Core: create_relations</b></summary>

Create multiple new relations between entities.

**Input:**
```typescript
{
  relations: Array<{
    from: string;
    to: string;
    relationType: string;
  }>
}
```

**Returns:** Array of created relations with timestamps

**Example:**
```json
{
  "relations": [{
    "from": "John_Smith",
    "to": "Project_Alpha",
    "relationType": "works_on"
  }]
}
```
</details>

<details>
<summary><b>Core: add_observations</b></summary>

Add new observations to existing entities.

**Input:**
```typescript
{
  observations: Array<{
    entityName: string;
    contents: string[];
  }>
}
```

**Returns:** Array with added observations per entity

**Example:**
```json
{
  "observations": [{
    "entityName": "John_Smith",
    "contents": ["Certified AWS architect", "Speaks German"]
  }]
}
```
</details>

<details>
<summary><b>Core: delete_entities</b></summary>

Remove entities and all their relations from the graph.

**Input:**
```typescript
{
  entityNames: string[]
}
```

**Returns:** Confirmation

**Note:** Cascade deletes all relations to/from these entities.
</details>

<details>
<summary><b>Core: delete_observations</b></summary>

Remove specific observations from entities.

**Input:**
```typescript
{
  deletions: Array<{
    entityName: string;
    observations: string[];
  }>
}
```

**Returns:** Confirmation
</details>

<details>
<summary><b>Core: delete_relations</b></summary>

Remove specific relations from the graph.

**Input:**
```typescript
{
  relations: Array<{
    from: string;
    to: string;
    relationType: string;
  }>
}
```

**Returns:** Confirmation
</details>

<details>
<summary><b>Core: read_graph</b></summary>

Read the entire knowledge graph (all entities and relations).

**Input:** None

**Returns:** Complete knowledge graph
```typescript
{
  entities: Entity[];
  relations: Relation[];
}
```
</details>

<details>
<summary><b>Core: search_nodes</b></summary>

Search for nodes by query string with optional filters.

**Input:**
```typescript
{
  query: string;
  tags?: string[];
  minImportance?: number;
  maxImportance?: number;
}
```

**Returns:** Matching entities and their relations

**Example:**
```json
{
  "query": "typescript",
  "tags": ["programming"],
  "minImportance": 5
}
```
</details>

<details>
<summary><b>Core: open_nodes</b></summary>

Retrieve specific nodes by exact name match.

**Input:**
```typescript
{
  names: string[]
}
```

**Returns:** Requested entities and relations between them

**Example:**
```json
{
  "names": ["John_Smith", "Project_Alpha"]
}
```
</details>

---

<details>
<summary><b>Hierarchy: set_entity_parent</b></summary>

Set or remove parent-child relationship for hierarchical nesting.

**Input:**
```typescript
{
  entityName: string;
  parentName: string | null;  // null removes parent
}
```

**Returns:** Updated entity

**Features:**
- Automatic cycle detection
- Updates lastModified timestamp

**Example:**
```json
{
  "entityName": "Feature_Auth",
  "parentName": "Project_Alpha"
}
```
</details>

<details>
<summary><b>Hierarchy: get_children</b></summary>

Get immediate children of an entity.

**Input:**
```typescript
{
  entityName: string;
}
```

**Returns:** Array of child entities

**Example:**
```json
{
  "entityName": "Project_Alpha"
}
```
</details>

<details>
<summary><b>Hierarchy: get_parent</b></summary>

Get parent entity (or null if root).

**Input:**
```typescript
{
  entityName: string;
}
```

**Returns:** Parent entity or null
</details>

<details>
<summary><b>Hierarchy: get_ancestors</b></summary>

Get all ancestors (parent chain to root).

**Input:**
```typescript
{
  entityName: string;
}
```

**Returns:** Array of ancestors (closest to furthest)

**Example:** Task → Feature → Project → Root
</details>

<details>
<summary><b>Hierarchy: get_descendants</b></summary>

Get all descendants recursively (BFS traversal).

**Input:**
```typescript
{
  entityName: string;
}
```

**Returns:** Array of all descendant entities
</details>

<details>
<summary><b>Hierarchy: get_subtree</b></summary>

Get entity + all descendants with their relations.

**Input:**
```typescript
{
  entityName: string;
}
```

**Returns:** Subtree (entities + relations)
```typescript
{
  entities: Entity[];
  relations: Relation[];
}
```

**Use cases:** Export branches, analyze sections, filter by scope
</details>

<details>
<summary><b>Hierarchy: get_root_entities</b></summary>

Get all entities with no parent (top-level entities).

**Input:** None

**Returns:** Array of root entities
</details>

<details>
<summary><b>Hierarchy: get_entity_depth</b></summary>

Get depth in hierarchy (0 = root, 1 = child of root, etc.).

**Input:**
```typescript
{
  entityName: string;
}
```

**Returns:**
```typescript
{
  entityName: string;
  depth: number;
}
```
</details>

---

<details>
<summary><b>Compression: find_duplicates</b></summary>

Find similar entities using multi-factor similarity scoring.

**Input:**
```typescript
{
  threshold?: number;  // Default 0.8 (80% similar)
}
```

**Returns:** Array of duplicate entity name groups

**Algorithm:**
- Name similarity: 40% (Levenshtein distance)
- Type match: 20% (exact match)
- Observation overlap: 30% (Jaccard similarity)
- Tag overlap: 10% (Jaccard similarity)

**Example:**
```json
{
  "threshold": 0.85
}
```
</details>

<details>
<summary><b>Compression: merge_entities</b></summary>

Merge multiple entities into one target entity.

**Input:**
```typescript
{
  entityNames: string[];
  targetName?: string;  // Auto-selects if not provided
}
```

**Returns:** Merged entity

**Merge behavior:**
- Combines unique observations and tags
- Keeps highest importance
- Redirects all relations to target
- Preserves earliest createdAt

**Example:**
```json
{
  "entityNames": ["Project Alpha", "project-alpha", "Project-Alpha"],
  "targetName": "Project Alpha"
}
```
</details>

<details>
<summary><b>Compression: compress_graph</b></summary>

Automated duplicate detection and merging.

**Input:**
```typescript
{
  threshold?: number;   // Default 0.8
  dryRun?: boolean;     // Default false (preview only)
}
```

**Returns:** Compression statistics
```typescript
{
  duplicatesFound: number;
  entitiesMerged: number;
  observationsCompressed: number;
  relationsConsolidated: number;
  spaceFreed: number;
  mergedEntities: Array<{ kept: string; merged: string[] }>;
}
```

**Example:**
```json
{
  "threshold": 0.8,
  "dryRun": true
}
```
</details>

---

<details>
<summary><b>Archiving: archive_entities</b></summary>

Archive entities based on criteria (OR logic).

**Input:**
```typescript
{
  olderThan?: string;           // ISO date
  importanceLessThan?: number;  // 0-10
  tags?: string[];              // Any match
}
```

**Second parameter:** `dryRun` (boolean, default false)

**Returns:**
```typescript
{
  archived: number;
  entityNames: string[];
}
```

**Criteria (OR logic):** Archive if ANY criterion matches

**Example:**
```json
{
  "olderThan": "2025-01-01T00:00:00.000Z",
  "importanceLessThan": 3,
  "tags": ["completed", "deprecated"]
}
```
</details>

---

<details>
<summary><b>Search: search_nodes_ranked</b></summary>

Full-text search with TF-IDF relevance ranking.

**Input:**
```typescript
{
  query: string;
  limit?: number;  // Default 50, max 200
}
```

**Returns:** Ranked results with scores
```typescript
Array<{
  entityName: string;
  score: number;
  matchedIn: string[];  // Fields matched
}>
```

**Example:**
```json
{
  "query": "machine learning algorithms",
  "limit": 10
}
```
</details>

<details>
<summary><b>Search: boolean_search</b></summary>

Advanced boolean queries with logical operators.

**Input:**
```typescript
{
  query: string;  // Boolean expression
}
```

**Operators:**
- `AND`, `OR`, `NOT`, `()`
- Field-specific: `name:`, `type:`, `observation:`, `tag:`
- Quoted strings: `"exact phrase"`

**Example:**
```json
{
  "query": "type:project AND (frontend OR backend) NOT deprecated"
}
```
</details>

<details>
<summary><b>Search: fuzzy_search</b></summary>

Typo-tolerant search using Levenshtein distance.

**Input:**
```typescript
{
  query: string;
  threshold?: number;  // Default 0.7 (70% match)
}
```

**Returns:** Matching entities (sorted by similarity)

**Example:**
```json
{
  "query": "projekt",
  "threshold": 0.8
}
```
</details>

---

<details>
<summary><b>Saved Search: save_search</b></summary>

Save a search query for reuse.

**Input:**
```typescript
{
  name: string;
  query: string;
  filters?: object;
  description?: string;
}
```

**Returns:** Saved search object
</details>

<details>
<summary><b>Saved Search: list_saved_searches</b></summary>

List all saved searches.

**Input:** None

**Returns:** Array of saved searches with metadata
</details>

<details>
<summary><b>Saved Search: get_saved_search</b></summary>

Get details of a saved search.

**Input:**
```typescript
{
  name: string;
}
```

**Returns:** Saved search object
</details>

<details>
<summary><b>Saved Search: execute_saved_search</b></summary>

Execute a saved search (updates usage count).

**Input:**
```typescript
{
  name: string;
}
```

**Returns:** Search results
</details>

<details>
<summary><b>Saved Search: delete_saved_search</b></summary>

Delete a saved search.

**Input:**
```typescript
{
  name: string;
}
```

**Returns:** Confirmation
</details>

<details>
<summary><b>Saved Search: update_saved_search</b></summary>

Update a saved search.

**Input:**
```typescript
{
  name: string;
  query?: string;
  filters?: object;
  description?: string;
}
```

**Returns:** Updated saved search
</details>

<details>
<summary><b>Search: get_search_suggestions</b></summary>

Get "Did you mean?" suggestions for typos.

**Input:**
```typescript
{
  query: string;
  limit?: number;  // Default 5
}
```

**Returns:** Array of suggestions with scores
</details>

---

<details>
<summary><b>Tags: add_tags</b></summary>

Add tags to an entity (normalized to lowercase).

**Input:**
```typescript
{
  entityName: string;
  tags: string[];
}
```

**Returns:** Entity with added tags
</details>

<details>
<summary><b>Tags: remove_tags</b></summary>

Remove tags from an entity.

**Input:**
```typescript
{
  entityName: string;
  tags: string[];
}
```

**Returns:** Entity with remaining tags
</details>

<details>
<summary><b>Tags: add_tags_to_multiple</b></summary>

Add tags to multiple entities at once (bulk operation).

**Input:**
```typescript
{
  entityNames: string[];
  tags: string[];
}
```

**Returns:** Array of results per entity
</details>

<details>
<summary><b>Tags: replace_tag</b></summary>

Replace a tag globally across all entities.

**Input:**
```typescript
{
  oldTag: string;
  newTag: string;
}
```

**Returns:** Count of entities updated
</details>

<details>
<summary><b>Tags: merge_tags</b></summary>

Merge two tags into one (all entities with tag1 get tag2).

**Input:**
```typescript
{
  sourceTag: string;
  targetTag: string;
}
```

**Returns:** Count of entities updated
</details>

<details>
<summary><b>Tag Aliases: add_tag_alias</b></summary>

Create a tag synonym (alias → canonical).

**Input:**
```typescript
{
  alias: string;
  canonical: string;
  description?: string;
}
```

**Example:** "ai" → "artificial-intelligence"

**Returns:** Tag alias object
</details>

<details>
<summary><b>Tag Aliases: list_tag_aliases</b></summary>

List all tag aliases.

**Input:** None

**Returns:** Array of tag aliases
</details>

<details>
<summary><b>Tag Aliases: get_aliases_for_tag</b></summary>

Get all aliases for a canonical tag.

**Input:**
```typescript
{
  canonical: string;
}
```

**Returns:** Array of aliases
</details>

<details>
<summary><b>Tag Aliases: remove_tag_alias</b></summary>

Remove a tag alias.

**Input:**
```typescript
{
  alias: string;
}
```

**Returns:** Confirmation
</details>

<details>
<summary><b>Tag Aliases: resolve_tag</b></summary>

Resolve an alias to its canonical form.

**Input:**
```typescript
{
  tag: string;
}
```

**Returns:** Canonical tag name (or original if no alias)
</details>

---

<details>
<summary><b>Analytics: get_graph_stats</b></summary>

Get comprehensive graph statistics.

**Input:** None

**Returns:**
```typescript
{
  totalEntities: number;
  totalRelations: number;
  entityTypesCounts: { [type: string]: number };
  relationTypesCounts: { [type: string]: number };
  oldestEntity: { name: string; date: string };
  newestEntity: { name: string; date: string };
  oldestRelation: { from: string; to: string; date: string };
  newestRelation: { from: string; to: string; date: string };
  entityDateRange: { start: string; end: string };
  relationDateRange: { start: string; end: string };
}
```
</details>

<details>
<summary><b>Analytics: search_by_date_range</b></summary>

Filter entities and relations by date range.

**Input:**
```typescript
{
  startDate?: string;   // ISO 8601
  endDate?: string;     // ISO 8601
  entityType?: string;
  tags?: string[];
}
```

**Returns:** Filtered knowledge graph

**Example:**
```json
{
  "startDate": "2025-01-01T00:00:00.000Z",
  "endDate": "2025-01-31T23:59:59.999Z",
  "tags": ["project"]
}
```
</details>

<details>
<summary><b>Analytics: validate_graph</b></summary>

Validate graph integrity and detect issues.

**Input:** None

**Returns:**
```typescript
{
  isValid: boolean;
  errors: string[];      // Critical issues
  warnings: string[];    // Non-critical issues
}
```

**Checks:**
- Orphaned relations
- Duplicate entities
- Invalid data
- Isolated entities (warning)
- Empty observations (warning)
</details>

<details>
<summary><b>Analytics: set_importance</b></summary>

Set importance level for an entity (0-10).

**Input:**
```typescript
{
  entityName: string;
  importance: number;  // 0-10
}
```

**Returns:** Updated entity

**Scale:**
- 9-10: Critical
- 7-8: High
- 5-6: Medium
- 3-4: Low
- 0-2: Minimal
</details>

---

<details>
<summary><b>Export: export_graph</b></summary>

Export knowledge graph in multiple formats.

**Input:**
```typescript
{
  format: "json" | "csv" | "graphml" | "gexf" | "dot" | "markdown" | "mermaid";
  filter?: {
    startDate?: string;
    endDate?: string;
    entityType?: string;
    tags?: string[];
  }
}
```

**Formats:**
- **JSON**: Pretty-printed with all data
- **CSV**: Entities + relations sections
- **GraphML**: XML for Gephi, Cytoscape, yEd
- **GEXF**: Gephi native format
- **DOT**: GraphViz for publication
- **Markdown**: Human-readable documentation
- **Mermaid**: Embedded diagrams

**Example:**
```json
{
  "format": "gexf",
  "filter": {
    "entityType": "person",
    "tags": ["colleague"]
  }
}
```
</details>

<details>
<summary><b>Import: import_graph</b></summary>

Import knowledge graph from JSON, CSV, or GraphML.

**Input:**
```typescript
{
  format: "json" | "csv" | "graphml";
  data: string;
  strategy?: "replace" | "skip" | "merge" | "fail";  // Default "merge"
  dryRun?: boolean;  // Default false
}
```

**Merge strategies:**
- **replace**: Overwrite existing entities
- **skip**: Keep existing, skip imports
- **merge**: Combine observations/tags
- **fail**: Error on conflicts

**Returns:** Import statistics
```typescript
{
  entitiesImported: number;
  relationsImported: number;
  entitiesSkipped: number;
  relationsSkipped: number;
  errors: string[];
}
```
</details>

## Data Model

### Entity Schema

```typescript
interface Entity {
  name: string;              // Unique identifier
  entityType: string;        // Classification
  observations: string[];    // Facts about the entity
  parentId?: string;         // Parent entity (v0.8.0)
  createdAt?: string;        // ISO 8601 timestamp
  lastModified?: string;     // ISO 8601 timestamp
  tags?: string[];           // Lowercase tags
  importance?: number;       // 0-10 scale
}
```

### Relation Schema

```typescript
interface Relation {
  from: string;              // Source entity name
  to: string;                // Target entity name
  relationType: string;      // Relationship type
  createdAt?: string;        // ISO 8601 timestamp
  lastModified?: string;     // ISO 8601 timestamp
}
```

### Storage Files

- **memory.jsonl**: Active knowledge graph (JSONL format)
- **archive.jsonl**: Archived entities
- **saved-searches.jsonl**: Saved search queries
- **tag-aliases.jsonl**: Tag synonym mappings

**Custom path:** Set `MEMORY_FILE_PATH` environment variable

## Usage Examples

### Example 1: Hierarchical Project Structure

```json
// Create entities
{
  "entities": [
    { "name": "Project_Alpha", "entityType": "project", "observations": ["Web app rewrite"] },
    { "name": "Feature_Auth", "entityType": "feature", "observations": ["User authentication"] },
    { "name": "Task_Login", "entityType": "task", "observations": ["Implement login UI"] }
  ]
}

// Set hierarchy
{ "entityName": "Feature_Auth", "parentName": "Project_Alpha" }
{ "entityName": "Task_Login", "parentName": "Feature_Auth" }

// Navigate
{ "entityName": "Project_Alpha" }  // get_children → [Feature_Auth]
{ "entityName": "Task_Login" }     // get_ancestors → [Feature_Auth, Project_Alpha]
```

### Example 2: Duplicate Detection and Merging

```json
// Find duplicates
{ "threshold": 0.8 }  // find_duplicates

// Merge duplicates
{
  "entityNames": ["Project Alpha", "project-alpha", "Project-Alpha"],
  "targetName": "Project Alpha"
}  // merge_entities

// Auto-compress
{ "threshold": 0.8, "dryRun": true }  // compress_graph (preview)
{ "threshold": 0.8, "dryRun": false }  // compress_graph (execute)
```

### Example 3: Smart Archiving

```json
// Archive old, low-priority, or completed entities
{
  "olderThan": "2025-01-01T00:00:00.000Z",
  "importanceLessThan": 3,
  "tags": ["completed", "deprecated"]
}  // archive_entities (OR logic)
```

### Example 4: Advanced Search

```json
// Boolean search
{ "query": "type:project AND (frontend OR backend) NOT deprecated" }

// TF-IDF ranking
{ "query": "machine learning algorithms", "limit": 10 }

// Fuzzy search
{ "query": "projekt", "threshold": 0.8 }
```

### Example 5: Tag Management

```json
// Bulk tag operations
{
  "entityNames": ["Entity1", "Entity2", "Entity3"],
  "tags": ["new-tag"]
}  // add_tags_to_multiple

// Tag aliases
{ "alias": "ai", "canonical": "artificial-intelligence" }  // add_tag_alias

// Merge tags
{ "sourceTag": "ml", "targetTag": "machine-learning" }  // merge_tags
```

## Comprehensive Guides

Detailed documentation for advanced features:

- **[HIERARCHY_GUIDE.md](HIERARCHY_GUIDE.md)** - Complete guide to parent-child relationships (8 tools)
- **[COMPRESSION_GUIDE.md](COMPRESSION_GUIDE.md)** - Intelligent duplicate detection and merging (3 tools)
- **[ARCHIVING_GUIDE.md](ARCHIVING_GUIDE.md)** - Memory lifecycle and long-term storage (1 tool)
- **[QUERY_LANGUAGE.md](QUERY_LANGUAGE.md)** - Boolean search syntax reference
- **[MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)** - Upgrade guide from v0.7.0 to v0.8.0

## Configuration

### Environment Variables

- `MEMORY_FILE_PATH`: Path to memory storage file (default: `memory.jsonl`)

### Example Configuration

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/memory-mcp/src/memory/dist/index.js"],
      "env": {
        "MEMORY_FILE_PATH": "/path/to/memory.jsonl"
      }
    }
  }
}
```

## Development

### Prerequisites

- Node.js 18+
- npm 9+
- TypeScript 5.6+

### Build

```bash
npm install
npm run build      # Production build
npm run watch      # Development watch mode
```

### Test

```bash
npm test          # Run test suite with coverage
npm run typecheck # TypeScript type checking
```

### Project Structure

```
memory-mcp/
├── src/memory/
│   ├── index.ts              # Main implementation (4,550 LOC)
│   ├── dist/                 # Compiled output
│   ├── __tests__/            # Test files
│   │   ├── knowledge-graph.test.ts
│   │   └── file-path.test.ts
│   └── package.json
├── CHANGELOG.md              # Version history
├── HIERARCHY_GUIDE.md        # Nesting guide
├── COMPRESSION_GUIDE.md      # Compression guide
├── ARCHIVING_GUIDE.md        # Archiving guide
├── QUERY_LANGUAGE.md         # Boolean search reference
├── MIGRATION_GUIDE.md        # Upgrade guide
├── IMPROVEMENT_PLAN.md       # Implementation roadmap
├── package.json              # Root package
└── README.md                 # This file
```

### Scripts

```bash
npm run build      # Build production
npm run watch      # Watch mode
npm test           # Run tests
npm run typecheck  # Type check
npm run clean      # Clean dist
```

## Contributing

We welcome contributions!

**See:**
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [IMPROVEMENT_PLAN.md](IMPROVEMENT_PLAN.md) - Feature roadmap
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Community standards

**Ways to Help:**
- 🐛 Report bugs
- ✨ Request features
- 🔧 Submit pull requests
- 📚 Improve documentation
- 🧪 Add tests
- 🌍 Translate guides

## License

**MIT License** - see [LICENSE](LICENSE)

You are free to use, modify, and distribute this software.

## Acknowledgments

### Original Project

Enhanced fork of [Model Context Protocol memory server](https://github.com/modelcontextprotocol/servers) by [Anthropic](https://www.anthropic.com/).

**Original License:** MIT

### Enhancements (v0.8.0)

**Developer:** [Daniel Simon Jr.](https://github.com/danielsimonjr)

**Major Features Added:**
- Hierarchical nesting with parent-child relationships (8 tools)
- Memory compression with duplicate detection (3 tools)
- Smart archiving with criteria-based filtering (1 tool)
- Advanced search: TF-IDF, boolean, fuzzy (3 tools)
- Import/export: 7 formats with merge strategies
- Tag management: aliases, bulk operations (11 tools)
- Saved searches with usage tracking (5 tools)
- Graph validation and integrity checks (1 tool)
- Comprehensive documentation (5 guides, 3,600+ lines)

**Stats:** 45 tools (+309%), 4,550 LOC (+549%), 4 storage files

### Community

Thanks to:
- 🛠️ [MCP Specification](https://modelcontextprotocol.io)
- 📚 MCP community and contributors
- **Technologies:** Vitest, TypeScript, Node.js

---

**Repository:** https://github.com/danielsimonjr/memory-mcp
**Issues:** https://github.com/danielsimonjr/memory-mcp/issues
**NPM:** https://www.npmjs.com/package/@danielsimonjr/memory-mcp

**Made with ❤️ for the MCP community**
