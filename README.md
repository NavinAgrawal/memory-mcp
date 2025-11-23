# Memory MCP Server

[![Version](https://img.shields.io/badge/version-0.8.0-blue.svg)](https://github.com/danielsimonjr/memory-mcp)
[![NPM](https://img.shields.io/npm/v/@danielsimonjr/memory-mcp.svg)](https://www.npmjs.com/package/@danielsimonjr/memory-mcp)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-1.0-purple.svg)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)

An **enhanced fork** of the official [Model Context Protocol](https://modelcontextprotocol.io) memory server with advanced features for **hierarchical nesting**, **intelligent compression**, **archiving**, **advanced search**, and **multi-format import/export**.

> **Enterprise-grade knowledge graph** with hierarchical organization, duplicate detection, smart archiving, and sophisticated search capabilities for long-term memory management.

## Table of Contents

- [Features](#features)
- [What's New](#whats-new)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Usage Examples](#usage-examples)
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

### v0.8.0 Major Features
- 🚀 **Hierarchical Nesting**: Parent-child relationships for tree structures
- 🚀 **Memory Compression**: Intelligent duplicate detection and merging
- 🚀 **Smart Archiving**: Criteria-based archiving (age, importance, tags)
- 🚀 **Advanced Search**: TF-IDF ranking, boolean queries, fuzzy matching
- 🚀 **Import/Export**: 7 formats (JSON, CSV, GraphML, GEXF, DOT, Markdown, Mermaid)
- 🚀 **Tag Management**: Aliases, bulk operations, validation
- 🚀 **Saved Searches**: Store and execute frequent queries
- 🚀 **Graph Validation**: Integrity checks, orphan detection

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
| **Memory Compression** | ❌ | ✅ Duplicate detection |
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
| **Total Tools** | 11 | **45** (+34 enhancements) |
| **Code Size** | ~700 LOC | **4,550 LOC** (+549%) |

## What's New

### Version 0.8.0 (Latest - November 2025)

**🚀 Hierarchical Nesting (8 new tools)**
- Parent-child entity relationships for tree structures
- Cycle detection prevents circular references
- Navigate ancestors, descendants, subtrees
- Get root entities and hierarchy depth

**🚀 Memory Compression (3 new tools)**
- Find duplicates with multi-factor similarity scoring
- Merge entities intelligently (combines observations/tags)
- Auto-compress with dry-run preview
- Weighted algorithm: Name 40%, Type 20%, Observations 30%, Tags 10%

**🚀 Smart Archiving (1 new tool)**
- Archive by age (olderThan), importance (< threshold), or tags
- Multiple criteria with OR logic
- Dry-run mode for safe preview
- Clean removal from active graph

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
```

Claude will automatically use the enhanced tools!

## Installation

### Local Build (Recommended)

```bash
# Clone repository
git clone https://github.com/danielsimonjr/memory-mcp.git
cd memory-mcp/src/memory

# Install and build
npm install
npm run build

# Test
npm test
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
      "args": ["c:/mcp-servers/memory-mcp/src/memory/dist/index.js"]
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
- `observations` (string[]): Facts
- `createdAt` (string, optional): ISO 8601 timestamp
- `lastModified` (string, optional): ISO 8601 timestamp
- `tags` (string[], optional): Lowercase tags
- `importance` (number, optional): 0-10 scale

**Example:**
```json
{
  "name": "John_Smith",
  "entityType": "person",
  "observations": ["Speaks fluent Spanish"],
  "createdAt": "2025-01-15T10:30:00.000Z",
  "tags": ["colleague"],
  "importance": 7
}
```

### Relations

**Directed connections** between entities.

**Fields:**
- `from` (string): Source entity
- `to` (string): Target entity
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

### Core Tools (11)

<details>
<summary><b>create_entities</b></summary>

Create multiple new entities in the knowledge graph.

```typescript
{
  entities: Array<{
    name: string;
    entityType: string;
    observations: string[];
  }>
}
```
</details>

<details>
<summary><b>create_relations</b></summary>

Create multiple new relations between entities.

```typescript
{
  relations: Array<{
    from: string;
    to: string;
    relationType: string;
  }>
}
```
</details>

<details>
<summary><b>add_observations</b></summary>

Add new observations to existing entities.

```typescript
{
  observations: Array<{
    entityName: string;
    contents: string[];
  }>
}
```
</details>

<details>
<summary><b>delete_entities</b></summary>

Remove entities and their relations.

```typescript
{
  entityNames: string[]
}
```
</details>

<details>
<summary><b>delete_observations</b></summary>

Remove specific observations from entities.

```typescript
{
  deletions: Array<{
    entityName: string;
    observations: string[];
  }>
}
```
</details>

<details>
<summary><b>delete_relations</b></summary>

Remove specific relations from the graph.

```typescript
{
  relations: Array<{
    from: string;
    to: string;
    relationType: string;
  }>
}
```
</details>

<details>
<summary><b>read_graph</b></summary>

Read the entire knowledge graph.

No input required.
</details>

<details>
<summary><b>search_nodes</b></summary>

Search for nodes based on query.

```typescript
{
  query: string;
}
```
</details>

<details>
<summary><b>open_nodes</b></summary>

Retrieve specific nodes by name.

```typescript
{
  names: string[];
}
```
</details>

### Enhancement Tools (4)

<details>
<summary><b>search_by_date_range</b> - Phase 2</summary>

Filter entities and relations within a date range.

```typescript
{
  startDate?: string;      // ISO 8601
  endDate?: string;        // ISO 8601
  entityType?: string;
  tags?: string[];
}
```

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
<summary><b>get_graph_stats</b> - Phase 2</summary>

Get comprehensive statistics about the knowledge graph.

No input required.

**Returns:** Entity counts, relation counts, type breakdowns, oldest/newest items, date ranges.
</details>

<details>
<summary><b>add_tags / remove_tags</b> - Phase 3</summary>

Add or remove tags from an entity.

```typescript
{
  entityName: string;
  tags: string[];
}
```

Tags are normalized to lowercase.
</details>

<details>
<summary><b>set_importance</b> - Phase 3</summary>

Set the importance level for an entity (0-10).

```typescript
{
  entityName: string;
  importance: number;  // 0-10
}
```
</details>

<details>
<summary><b>export_graph</b> - Phase 4</summary>

Export the knowledge graph in JSON, CSV, or GraphML format.

```typescript
{
  format: "json" | "csv" | "graphml";
  filter?: {
    startDate?: string;
    endDate?: string;
    entityType?: string;
    tags?: string[];
  }
}
```

**Formats:**
- **JSON**: Pretty-printed
- **CSV**: Entities + relations with escaping
- **GraphML**: For Gephi, Cytoscape, yEd
</details>

## Data Model

### Entity Schema

```typescript
interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  createdAt?: string;       // ISO 8601
  lastModified?: string;    // ISO 8601
  tags?: string[];          // Lowercase
  importance?: number;      // 0-10
}
```

### Relation Schema

```typescript
interface Relation {
  from: string;
  to: string;
  relationType: string;
  createdAt?: string;       // ISO 8601
  lastModified?: string;    // ISO 8601
}
```

### Storage

- **Format**: JSONL (JSON Lines)
- **Default**: `memory.jsonl` in server directory
- **Custom**: Set `MEMORY_FILE_PATH` environment variable

## Usage Examples

### Example 1: Create Entity with Tags

```json
{
  "entities": [{
    "name": "Alice_Johnson",
    "entityType": "person",
    "observations": ["Lead developer", "TypeScript specialist"]
  }]
}

// Then add tags
{
  "entityName": "Alice_Johnson",
  "tags": ["colleague", "tech-lead"]
}

// Set importance
{
  "entityName": "Alice_Johnson",
  "importance": 9
}
```

### Example 2: Date Range Search

```json
{
  "startDate": "2025-01-01T00:00:00.000Z",
  "endDate": "2025-01-31T23:59:59.999Z",
  "tags": ["project"]
}
```

### Example 3: Export to GraphML

```json
{
  "format": "graphml",
  "filter": {
    "entityType": "person",
    "tags": ["colleague"]
  }
}
```

## Configuration

### Environment Variables

- `MEMORY_FILE_PATH`: Path to memory storage file (default: `memory.jsonl`)

### Example Configuration

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["c:/mcp-servers/memory-mcp/src/memory/dist/index.js"],
      "env": {
        "MEMORY_FILE_PATH": "c:/data/memory.jsonl"
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
cd src/memory
npm install
npm run build      # Production
npm run watch      # Development
```

### Test

```bash
npm test
```

### Structure

```
memory-mcp/
├── src/memory/
│   ├── src/index.ts      # Main implementation
│   ├── dist/             # Compiled output
│   └── package.json
├── CHANGELOG.md
├── CONTRIBUTING.md
├── WORKFLOW.md
└── README.md
```

See [WORKFLOW.md](WORKFLOW.md) for detailed development guide.

## Contributing

We welcome contributions!

**See:**
- [CONTRIBUTING.md](CONTRIBUTING.md) - Guidelines
- [WORKFLOW.md](WORKFLOW.md) - Development workflow
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Community standards

**Ways to Help:**
- 🐛 Report bugs
- ✨ Request features
- 🔧 Submit fixes
- 📚 Improve docs
- 🧪 Add tests

## License

**MIT License** - see [LICENSE](LICENSE)

You are free to use, modify, and distribute this software.

## Acknowledgments

### Original Project

Enhanced fork of [Model Context Protocol memory server](https://github.com/modelcontextprotocol/servers) by [Anthropic](https://www.anthropic.com/).

**Original License:** MIT

### Enhancements

**Developer:** [Daniel Simon Jr.](https://github.com/danielsimonjr)

**Features Added:**
- Automatic timestamps (createdAt, lastModified)
- Date range search and filtering
- Graph statistics and analytics
- Tags and importance categorization
- Multi-format export (JSON, CSV, GraphML)

### Community

Thanks to:
- 🛠️ [MCP Specification](https://modelcontextprotocol.io)
- 📚 MCP community
- **Vitest**, **TypeScript**, **Node.js**

---

**Repository:** https://github.com/danielsimonjr/memory-mcp
**Issues:** https://github.com/danielsimonjr/memory-mcp/issues

**Made with ❤️ for the MCP community**
