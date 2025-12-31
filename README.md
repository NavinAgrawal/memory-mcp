# Memory MCP Server

[![Version](https://img.shields.io/badge/version-0.58.0-blue.svg)](https://github.com/danielsimonjr/memory-mcp)
[![NPM](https://img.shields.io/npm/v/@danielsimonjr/memory-mcp.svg)](https://www.npmjs.com/package/@danielsimonjr/memory-mcp)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-1.0-purple.svg)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Changelog](https://img.shields.io/badge/changelog-latest-orange.svg)](CHANGELOG.md)

An **enhanced fork** of the official [Model Context Protocol](https://modelcontextprotocol.io) memory server with advanced features for **hierarchical nesting**, **intelligent compression**, **archiving**, **advanced search**, and **multi-format import/export**.

> **Enterprise-grade knowledge graph** with 47 tools, hierarchical organization, duplicate detection, smart archiving, and sophisticated search capabilities for long-term memory management.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Usage Examples](#usage-examples)
- [Documentation](#documentation)
- [Configuration](#configuration)
- [Development](#development)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Features

### Core Memory Capabilities
- **Knowledge Graph Storage**: Entity-Relation-Observation model for structured memory
- **Persistent Memory**: Information persists across chat sessions with JSONL storage
- **Full CRUD Operations**: Create, read, update, delete entities and relations
- **Flexible Search**: Text-based, fuzzy, boolean, and TF-IDF ranked search

### Advanced Features
- **Hierarchical Nesting**: Parent-child relationships for organizing tree structures (9 tools)
- **Memory Compression**: Intelligent duplicate detection and merging with similarity scoring (4 tools)
- **Advanced Search**: TF-IDF ranking, boolean queries, fuzzy matching, date range search (6 tools)
- **Import/Export**: 7 export formats (JSON, CSV, GraphML, GEXF, DOT, Markdown, Mermaid), 3 import formats
- **Tag Management**: Tags, aliases, bulk operations, importance scores (11 tools)
- **Saved Searches**: Store and execute frequent queries (5 tools)
- **Graph Analytics**: Statistics, validation, integrity checks (2 tools)

### Data Management
- **Automatic Timestamps**: `createdAt` and `lastModified` fields with smart updates
- **Date Range Search**: Filter entities/relations by creation or modification date
- **Graph Statistics**: Comprehensive analytics with counts, types, and temporal data
- **Tags System**: Categorize entities with case-insensitive tags and aliases
- **Importance Levels**: 0-10 scale for entity prioritization
- **Advanced Filtering**: Combine text, tags, importance, and date ranges

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
| **Security** | Basic | ✅ Input validation |
| **Reliability** | Basic | ✅ Backups & Transactions |
| **Performance** | Basic | ✅ Caching & Optimizations |
| **Total Tools** | 11 | **47** (+327%) |
| **Code Structure** | Monolithic | **Modular** (49 files, ~8.5K lines) |

## Key Features

### Production-Ready Enterprise Capabilities

**🔐 Security & Data Integrity**
- **Input Validation**: Zod-based schemas validate all inputs, preventing malformed data and injection attacks
- **Transaction Support**: ACID-compliant transactions with automatic rollback on failures
- **Backup & Restore**: Point-in-time recovery with timestamped backups and metadata
- **Data Protection**: Comprehensive validation with size limits, range checks, and format enforcement

**⚡ Performance Optimizations**
- **Smart Caching**: In-memory cache with write-through invalidation for instant reads
- **Optimized Algorithms**: 50x faster duplicate detection using two-level bucketing (O(n²) → O(n·k))
- **Efficient Storage**: JSONL format with modular architecture for better tree-shaking

**🏗️ Architecture**
- **Modular Design**: Clean separation of concerns across 49 focused modules with 5 consolidated managers
- **Type Safety**: Full TypeScript strict mode with comprehensive type definitions
- **Lazy Initialization**: Context pattern with on-demand manager instantiation
- **Developer Experience**: Barrel exports, 1484 tests, and comprehensive documentation

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

### Complete Tool List (47 Tools)

#### Entity Operations (4 tools)
- `create_entities` - Create multiple new entities
- `delete_entities` - Remove entities and their relations
- `read_graph` - Read entire knowledge graph
- `open_nodes` - Retrieve specific nodes by name

#### Relation Operations (2 tools)
- `create_relations` - Create multiple new relations
- `delete_relations` - Remove specific relations

#### Observation Management (2 tools)
- `add_observations` - Add observations to entities
- `delete_observations` - Remove specific observations

#### Search (6 tools)
- `search_nodes` - Search for nodes by query with filters
- `search_by_date_range` - Filter by date range
- `search_nodes_ranked` - TF-IDF relevance ranking
- `boolean_search` - Boolean queries (AND/OR/NOT)
- `fuzzy_search` - Typo-tolerant search
- `get_search_suggestions` - Get "Did you mean?" suggestions

#### Saved Searches (5 tools)
- `save_search` - Save search query
- `list_saved_searches` - List all saved searches
- `execute_saved_search` - Execute saved search
- `delete_saved_search` - Delete saved search
- `update_saved_search` - Update saved search

#### Tag Management (6 tools)
- `add_tags` - Add tags to entity
- `remove_tags` - Remove tags from entity
- `set_importance` - Set entity importance (0-10)
- `add_tags_to_multiple_entities` - Add tags to multiple entities
- `replace_tag` - Replace tag globally
- `merge_tags` - Merge two tags into one

#### Tag Aliases (5 tools)
- `add_tag_alias` - Create tag synonym
- `list_tag_aliases` - List all tag aliases
- `remove_tag_alias` - Remove tag alias
- `get_aliases_for_tag` - Get aliases for tag
- `resolve_tag` - Resolve alias to canonical form

#### Hierarchical Nesting (9 tools)
- `set_entity_parent` - Set or remove parent relationship
- `get_children` - Get immediate children
- `get_parent` - Get parent entity
- `get_ancestors` - Get all ancestors (parent chain)
- `get_descendants` - Get all descendants (recursive)
- `get_subtree` - Get entity + descendants with relations
- `get_root_entities` - Get all entities with no parent
- `get_entity_depth` - Get depth in hierarchy (0 = root)
- `move_entity` - Move entity to new parent

#### Graph Analytics (2 tools)
- `get_graph_stats` - Get comprehensive graph statistics
- `validate_graph` - Validate graph integrity

#### Compression & Archiving (4 tools)
- `find_duplicates` - Find similar entities by threshold
- `merge_entities` - Merge multiple entities into one
- `compress_graph` - Automated compression with dry-run
- `archive_entities` - Archive by age, importance, or tags

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

<details>
<summary><b>Hierarchy: move_entity</b></summary>

Move an entity to a new parent (shorthand for set_entity_parent).

**Input:**
```typescript
{
  entityName: string;
  newParentName: string | null;  // null makes it a root entity
}
```

**Returns:** Updated entity

**Features:**
- Automatic cycle detection
- Updates lastModified timestamp
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
- Type match: 30% (exact match)
- Observation overlap: 20% (Jaccard similarity)
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
<summary><b>Tags: add_tags_to_multiple_entities</b></summary>

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

The server automatically creates and manages these files:

- **`memory.jsonl`**: Main knowledge graph storage (entities and relations)
- **`memory-saved-searches.jsonl`**: Saved search queries with metadata
- **`memory-tag-aliases.jsonl`**: Tag synonym mappings (alias → canonical)
- **`.backups/`**: Backup directory with timestamped snapshots

All files use JSONL (JSON Lines) format where each line is a valid JSON object.

**Custom path:** Set `MEMORY_FILE_PATH` environment variable (see [Configuration](#configuration))

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

## Documentation

### 📚 **[Complete Documentation](docs/README.md)**

Comprehensive documentation organized by category:

**Core Documentation**
- **[API Reference](docs/architecture/API.md)** - Complete API documentation for all 47 tools
- **[Architecture](docs/architecture/ARCHITECTURE.md)** - Technical architecture and system design
- **[Dependency Graph](docs/architecture/DEPENDENCY_GRAPH.md)** - Module dependencies and structure
- **[Workflow](docs/development/WORKFLOW.md)** - Development workflow and procedures

**User Guides**
- **[Hierarchy Guide](docs/guides/HIERARCHY.md)** - Parent-child relationships (9 tools)
- **[Compression Guide](docs/guides/COMPRESSION.md)** - Duplicate detection and merging (4 tools)
- **[Archiving Guide](docs/guides/ARCHIVING.md)** - Memory lifecycle and archiving
- **[Query Language](docs/guides/QUERY_LANGUAGE.md)** - Boolean search syntax reference
- **[Migration Guide](docs/guides/MIGRATION.md)** - Version upgrade guide

**Project Information**
- **[Changelog](CHANGELOG.md)** - Version history and release notes
- **[Sprint Progress](docs/reports/SPRINT_PROGRESS.md)** - Development progress tracking

## Configuration

### Environment Variables

- **`MEMORY_FILE_PATH`**: Path to the main memory storage file
  - **Default**: `memory.jsonl` in the current working directory
  - **Format**: JSONL (JSON Lines) format
  - Sets the location for the primary knowledge graph storage

### Storage File Organization

When you set `MEMORY_FILE_PATH`, the server automatically creates related files in the same directory:

```
/your/data/directory/
├── memory.jsonl                    # Main knowledge graph (active entities & relations)
├── memory-saved-searches.jsonl     # Saved search queries
├── memory-tag-aliases.jsonl        # Tag synonym mappings
└── .backups/                       # Timestamped backup directory
    ├── backup_2025-11-24_10-30-00-123.jsonl
    ├── backup_2025-11-24_10-30-00-123.jsonl.meta.json
    └── ...
```

**Note**: All auxiliary files use the same base filename as `MEMORY_FILE_PATH` with descriptive suffixes.

### Example Configuration

**Claude Desktop (`claude_desktop_config.json`):**
```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/memory-mcp/src/memory/dist/index.js"],
      "env": {
        "MEMORY_FILE_PATH": "/path/to/data/memory.jsonl"
      }
    }
  }
}
```

**Default behavior (no environment variable):**
```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/memory-mcp/src/memory/dist/index.js"]
    }
  }
}
```
Creates `memory.jsonl` in the current working directory.

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

### Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: MCP Protocol Layer                        │
│  server/MCPServer.ts + toolDefinitions              │
│  + toolHandlers (47 tools)                          │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│  Layer 2: Managers + Context (Lazy Initialization)  │
│  ManagerContext (aliased as KnowledgeGraphManager)  │
│  • EntityManager   (CRUD + hierarchy + archive)     │
│  • RelationManager (relation CRUD)                  │
│  • SearchManager   (search + compression + stats)   │
│  • IOManager       (import + export + backup)       │
│  • TagManager      (tag aliases)                    │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│  Layer 3: Storage Layer                             │
│  core/GraphStorage.ts (JSONL + in-memory cache)     │
└─────────────────────────────────────────────────────┘
```

### Project Structure

```
memory-mcp/
├── src/memory/                     # Main source (49 TypeScript files)
│   ├── index.ts                    # Entry point
│   ├── vitest.config.ts            # Test configuration
│   ├── core/                       # Core managers (7 files)
│   │   ├── ManagerContext.ts           # Context holder (lazy init)
│   │   ├── EntityManager.ts            # Entity CRUD + hierarchy + archive
│   │   ├── RelationManager.ts          # Relation CRUD
│   │   ├── GraphStorage.ts             # JSONL I/O + caching
│   │   ├── TransactionManager.ts       # ACID transactions
│   │   ├── StorageFactory.ts           # Storage backend factory
│   │   └── index.ts                    # Barrel export (+ KnowledgeGraphManager alias)
│   ├── server/                     # MCP protocol layer (3 files)
│   │   ├── MCPServer.ts                # Server setup (67 lines)
│   │   ├── toolDefinitions.ts          # 47 tool schemas
│   │   └── toolHandlers.ts             # Handler registry
│   ├── search/                     # Search implementations (10 files)
│   │   ├── SearchManager.ts            # Search orchestrator + compression + analytics
│   │   ├── BasicSearch.ts              # Text matching
│   │   ├── RankedSearch.ts             # TF-IDF scoring
│   │   ├── BooleanSearch.ts            # AND/OR/NOT logic
│   │   ├── FuzzySearch.ts              # Typo tolerance
│   │   ├── SavedSearchManager.ts       # Saved queries
│   │   ├── SearchSuggestions.ts        # "Did you mean?"
│   │   ├── TFIDFIndexManager.ts        # TF-IDF index
│   │   ├── SearchFilterChain.ts        # Unified filters
│   │   └── index.ts
│   ├── features/                   # Advanced capabilities (3 files)
│   │   ├── IOManager.ts                # Import + export + backup (consolidated)
│   │   ├── TagManager.ts               # Tag aliases
│   │   └── index.ts
│   ├── types/                      # TypeScript definitions (7 files)
│   │   ├── entity.types.ts
│   │   ├── search.types.ts
│   │   ├── analytics.types.ts
│   │   ├── import-export.types.ts
│   │   ├── tag.types.ts
│   │   ├── storage.types.ts            # IGraphStorage interface
│   │   └── index.ts
│   ├── utils/                      # Shared utilities (17 files)
│   │   ├── schemas.ts                  # Zod validation (14 schemas)
│   │   ├── constants.ts                # Shared constants (SIMILARITY_WEIGHTS)
│   │   ├── errors.ts                   # Custom error types
│   │   ├── searchAlgorithms.ts         # Levenshtein + TF-IDF (consolidated)
│   │   ├── responseFormatter.ts        # Tool response helpers
│   │   ├── entityUtils.ts              # Entity helper functions
│   │   ├── tagUtils.ts                 # Tag normalization/validation
│   │   ├── searchCache.ts              # Result caching
│   │   └── ... (more utilities)
│   ├── __tests__/                  # Test suite (1484 tests)
│   └── dist/                       # Compiled output
├── docs/                           # Documentation
│   ├── architecture/               # Architecture docs
│   ├── guides/                     # User guides
│   └── README.md
├── tools/                          # Development tools
│   └── create-dependency-graph/    # Dependency analyzer
├── CHANGELOG.md                    # Version history
└── README.md                       # This file
```

### Scripts

```bash
npm run build      # Build TypeScript to JavaScript
npm run watch      # Watch mode for development
npm test           # Run 1484 tests with coverage
npm run typecheck  # TypeScript strict type checking
npm run clean      # Clean dist/ directories
npm run docs:deps  # Generate dependency graph
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

## Changelog

All notable changes to this project are documented in **[CHANGELOG.md](CHANGELOG.md)**.

The changelog follows [Keep a Changelog](https://keepachangelog.com/) format and tracks:
- **Added**: New features and capabilities
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

**Current version**: v0.58.0 - [View full changelog →](CHANGELOG.md)

## License

**MIT License** - see [LICENSE](LICENSE)

You are free to use, modify, and distribute this software.

## Acknowledgments

### Original Project

Enhanced fork of [Model Context Protocol memory server](https://github.com/modelcontextprotocol/servers) by [Anthropic](https://www.anthropic.com/).

**Original License:** MIT

### Enhancements

**Developer:** [Daniel Simon Jr.](https://github.com/danielsimonjr)

**Major Features Added:**
- Hierarchical nesting with parent-child relationships
- Memory compression with intelligent duplicate detection
- Smart archiving with criteria-based filtering
- Advanced search: TF-IDF, boolean, and fuzzy matching
- Multi-format import/export with merge strategies
- Enhanced tag management with aliases and bulk operations
- Saved searches with usage tracking
- Graph validation and integrity checks
- Transaction support with ACID guarantees
- Backup and restore capabilities
- Input validation and security hardening
- Performance optimizations and caching
- Comprehensive documentation and guides

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
