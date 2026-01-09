# Memory MCP Server

[![Version](https://img.shields.io/badge/version-9.8.3-blue.svg)](https://github.com/danielsimonjr/memory-mcp)
[![NPM](https://img.shields.io/npm/v/@danielsimonjr/memory-mcp.svg)](https://www.npmjs.com/package/@danielsimonjr/memory-mcp)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-1.0-purple.svg)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Coverage](https://img.shields.io/badge/coverage-96.6%25-brightgreen.svg)](docs/architecture/TEST_COVERAGE.md)

An **enhanced fork** of the official [Model Context Protocol](https://modelcontextprotocol.io) memory server with advanced features for **hierarchical nesting**, **intelligent compression**, **semantic search**, **graph algorithms**, **archiving**, **advanced search**, and **multi-format import/export**.

> **Enterprise-grade knowledge graph** with 59 tools, hierarchical organization, semantic search with embeddings, graph traversal algorithms, duplicate detection, smart archiving, and sophisticated search capabilities for long-term memory management.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Development](#development)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Changelog](#changelog)
- [License](#license)

## Features

### Core Memory Capabilities

- **Knowledge Graph Storage**: Entity-Relation-Observation model for structured memory
- **Persistent Memory**: Information persists across chat sessions with JSONL or SQLite storage
- **Dual Storage Backends**: JSONL (human-readable) or SQLite with better-sqlite3 (3-10x faster, FTS5 search)
- **Full CRUD Operations**: Create, read, update, delete entities and relations
- **Flexible Search**: Text-based, fuzzy, boolean, semantic, and TF-IDF ranked search

### Advanced Features

| Category | Tools | Description |
|----------|-------|-------------|
| **Hierarchical Nesting** | 9 | Parent-child relationships for organizing tree structures |
| **Graph Algorithms** | 4 | Path finding, connected components, centrality metrics |
| **Intelligent Search** | 3 | Hybrid multi-layer search with query analysis and reflection |
| **Semantic Search** | 3 | Embedding-based similarity search with OpenAI or local models |
| **Memory Compression** | 4 | Intelligent duplicate detection and merging with similarity scoring |
| **Advanced Search** | 7 | TF-IDF ranking, boolean queries, fuzzy matching, auto-select |
| **Observation Normalization** | 1 | Coreference resolution and temporal anchoring |
| **Tag Management** | 11 | Tags, aliases, bulk operations, importance scores |
| **Saved Searches** | 5 | Store and execute frequent queries |
| **Import/Export** | 2 | 7 export formats with brotli compression, 3 import formats |
| **Graph Analytics** | 2 | Statistics, validation, integrity checks |

### Comparison with Official Memory Server

| Feature | Official | Enhanced (This Fork) |
|---------|----------|----------------------|
| Entity/Relation/Observation Management | ✅ | ✅ |
| Basic Search | ✅ | ✅ |
| **Hierarchical Nesting** | ❌ | ✅ Parent-child trees |
| **Graph Algorithms** | ❌ | ✅ Path finding, centrality |
| **Semantic Search** | ❌ | ✅ Embedding-based similarity |
| **Memory Compression** | ❌ | ✅ Duplicate detection |
| **Brotli Compression** | ❌ | ✅ Backups, exports, responses |
| **Smart Archiving** | ❌ | ✅ Criteria-based |
| **Advanced Search** | ❌ | ✅ TF-IDF + Boolean + Fuzzy |
| **SQLite Backend** | ❌ | ✅ better-sqlite3 (3-10x faster) |
| **Full-Text Search** | ❌ | ✅ FTS5 with BM25 ranking |
| **Timestamps** | ❌ | ✅ createdAt + lastModified |
| **Import/Export Formats** | ❌ | ✅ 7 export / 3 import |
| **Input Validation** | ❌ | ✅ Zod schemas |
| **Backup & Restore** | ❌ | ✅ Compressed snapshots |
| **Intelligent Search** | ❌ | ✅ Hybrid + Query Analysis + Reflection |
| **Observation Normalization** | ❌ | ✅ Coreference resolution + temporal anchoring |
| **Total Tools** | 11 | **59** |
| **Code Structure** | Monolithic | **Modular** (65 files) |

## Quick Start

### 1. Install from NPM

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

## Installation

### Local Build

```bash
# Clone repository
git clone https://github.com/danielsimonjr/memory-mcp.git
cd memory-mcp

# Install and build
npm install
npm run build

# Run tests (2692+ tests)
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
      "args": ["<PATH_TO>/memory-mcp/dist/index.js"],
      "env": {
        "MEMORY_FILE_PATH": "<PATH_TO>/memory.jsonl"
      }
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/memory-mcp/dist/index.js"]
    }
  }
}
```

## Core Concepts

### Entities

Primary nodes in the knowledge graph.

```typescript
interface Entity {
  name: string;           // Unique identifier
  entityType: string;     // Classification
  observations: string[]; // Facts about the entity
  parentId?: string;      // Parent entity name for hierarchical nesting
  tags?: string[];        // Lowercase tags for categorization
  importance?: number;    // 0-10 scale for prioritization
  createdAt?: string;     // ISO 8601 timestamp
  lastModified?: string;  // ISO 8601 timestamp
}
```

### Relations

Directed connections between entities.

```typescript
interface Relation {
  from: string;           // Source entity name
  to: string;             // Target entity name
  relationType: string;   // Relationship type (active voice)
  createdAt?: string;     // ISO 8601 timestamp
  lastModified?: string;  // ISO 8601 timestamp
}
```

### Observations

Discrete facts about entities. Each observation should be atomic and independently manageable.

## API Reference

### Complete Tool List (59 Tools)

#### Entity Operations (4 tools)
| Tool | Description |
|------|-------------|
| `create_entities` | Create multiple new entities |
| `delete_entities` | Remove entities and their relations |
| `read_graph` | Read entire knowledge graph |
| `open_nodes` | Retrieve specific nodes by name |

#### Relation Operations (2 tools)
| Tool | Description |
|------|-------------|
| `create_relations` | Create relations between entities |
| `delete_relations` | Remove specific relations |

#### Observation Management (3 tools)
| Tool | Description |
|------|-------------|
| `add_observations` | Add observations to entities |
| `delete_observations` | Remove specific observations |
| `normalize_observations` | Normalize observations (resolve pronouns, anchor dates) |

#### Search (7 tools)
| Tool | Description |
|------|-------------|
| `search_nodes` | Search with filters (tags, importance) |
| `search_by_date_range` | Filter by date range |
| `search_nodes_ranked` | TF-IDF relevance ranking |
| `boolean_search` | Boolean queries (AND/OR/NOT) |
| `fuzzy_search` | Typo-tolerant search |
| `get_search_suggestions` | "Did you mean?" suggestions |
| `search_auto` | Auto-select best search method |

#### Intelligent Search (3 tools)
| Tool | Description |
|------|-------------|
| `hybrid_search` | Multi-layer search combining semantic, lexical, and symbolic signals |
| `analyze_query` | Extract entities, temporal references, and classify query complexity |
| `smart_search` | Reflection-based iterative search until results meet adequacy threshold |

#### Semantic Search (3 tools)
| Tool | Description |
|------|-------------|
| `semantic_search` | Search by semantic similarity using embeddings |
| `find_similar_entities` | Find entities similar to a reference entity |
| `index_embeddings` | Build or rebuild the semantic search index |

#### Saved Searches (5 tools)
| Tool | Description |
|------|-------------|
| `save_search` | Save search query for reuse |
| `execute_saved_search` | Execute a saved search |
| `list_saved_searches` | List all saved searches |
| `delete_saved_search` | Delete a saved search |
| `update_saved_search` | Update saved search parameters |

#### Tag Management (6 tools)
| Tool | Description |
|------|-------------|
| `add_tags` | Add tags to an entity |
| `remove_tags` | Remove tags from an entity |
| `set_importance` | Set entity importance (0-10) |
| `add_tags_to_multiple_entities` | Bulk tag operation |
| `replace_tag` | Replace tag globally |
| `merge_tags` | Merge two tags into one |

#### Tag Aliases (5 tools)
| Tool | Description |
|------|-------------|
| `add_tag_alias` | Create tag synonym |
| `list_tag_aliases` | List all aliases |
| `remove_tag_alias` | Remove an alias |
| `get_aliases_for_tag` | Get aliases for canonical tag |
| `resolve_tag` | Resolve alias to canonical form |

#### Hierarchical Nesting (9 tools)
| Tool | Description |
|------|-------------|
| `set_entity_parent` | Set/remove parent relationship |
| `get_children` | Get immediate children |
| `get_parent` | Get parent entity |
| `get_ancestors` | Get all ancestors (parent chain) |
| `get_descendants` | Get all descendants (recursive) |
| `get_subtree` | Get entity + descendants with relations |
| `get_root_entities` | Get entities with no parent |
| `get_entity_depth` | Get depth in hierarchy |
| `move_entity` | Move entity to new parent |

#### Graph Algorithms (4 tools)
| Tool | Description |
|------|-------------|
| `find_shortest_path` | Shortest path between entities (BFS) |
| `find_all_paths` | All paths with max depth limit |
| `get_connected_components` | Detect isolated subgraphs |
| `get_centrality` | Calculate centrality metrics (degree, betweenness, PageRank) |

#### Graph Analytics (2 tools)
| Tool | Description |
|------|-------------|
| `get_graph_stats` | Comprehensive graph statistics |
| `validate_graph` | Validate graph integrity |

#### Compression & Archiving (4 tools)
| Tool | Description |
|------|-------------|
| `find_duplicates` | Find similar entities by threshold |
| `merge_entities` | Merge multiple entities into one |
| `compress_graph` | Auto compression with dry-run |
| `archive_entities` | Archive by age, importance, or tags |

#### Import & Export (2 tools)
| Tool | Description |
|------|-------------|
| `export_graph` | Export in 7 formats (JSON, CSV, GraphML, GEXF, DOT, Markdown, Mermaid) with compression |
| `import_graph` | Import from JSON/CSV/GraphML with merge strategies |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MEMORY_FILE_PATH` | Path to storage file | `memory.jsonl` (current directory) |
| `MEMORY_STORAGE_TYPE` | Storage backend: `jsonl` or `sqlite` | `jsonl` |
| `MEMORY_EMBEDDING_PROVIDER` | Embedding provider: `openai`, `local`, or `none` | `none` |
| `MEMORY_OPENAI_API_KEY` | OpenAI API key (required if provider is `openai`) | - |
| `MEMORY_EMBEDDING_MODEL` | Embedding model to use | `text-embedding-3-small` (OpenAI) / `Xenova/all-MiniLM-L6-v2` (local) |
| `MEMORY_AUTO_INDEX_EMBEDDINGS` | Auto-index entities on creation | `false` |

### Storage Backends

| Feature | JSONL (Default) | SQLite (better-sqlite3) |
|---------|-----------------|-------------------------|
| Format | Human-readable text | Native binary database |
| Transactions | Basic | Full ACID with WAL mode |
| Full-Text Search | Basic | FTS5 with BM25 ranking |
| Performance | Good | 3-10x faster |
| Concurrency | Single-threaded | Thread-safe with async-mutex |
| Best For | Small graphs, debugging | Large graphs (10k+ entities) |

**Using SQLite:**

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/memory-mcp/dist/index.js"],
      "env": {
        "MEMORY_STORAGE_TYPE": "sqlite",
        "MEMORY_FILE_PATH": "/path/to/data/memory.db"
      }
    }
  }
}
```

### Storage Files

When you set `MEMORY_FILE_PATH`, the server automatically creates related files:

```
/your/data/directory/
├── memory.jsonl                    # Main knowledge graph
├── memory-saved-searches.jsonl     # Saved search queries
├── memory-tag-aliases.jsonl        # Tag synonym mappings
└── .backups/                       # Timestamped backups
    ├── backup_2026-01-08_10-30-00-123.jsonl
    └── backup_2026-01-08_10-30-00-123.jsonl.meta.json
```

### Migration Tool

Convert between JSONL and SQLite formats:

```bash
cd tools/migrate-from-jsonl-to-sqlite
npm install && npm run build

# JSONL to SQLite
node dist/migrate-from-jsonl-to-sqlite.js --from memory.jsonl --to memory.db

# SQLite to JSONL
node dist/migrate-from-jsonl-to-sqlite.js --from memory.db --to memory.jsonl
```

## Development

### Prerequisites

- Node.js 18+
- npm 9+
- TypeScript 5.6+

### Build Commands

```bash
npm install           # Install dependencies
npm run build         # Build TypeScript
npm test              # Run tests (2692+ tests)
npm run typecheck     # Strict type checking
npm run watch         # Development watch mode
npm run clean         # Remove dist/ directory
npm run docs:deps     # Generate dependency graph
```

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: MCP Protocol Layer                        │
│  server/MCPServer.ts + toolDefinitions (59 tools)   │
│  + toolHandlers + responseCompressor                │
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
│  • GraphTraversal  (path finding, centrality)       │
│  • SemanticSearch  (embeddings, similarity)         │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│  Layer 3: Storage Layer                             │
│  core/GraphStorage.ts (JSONL + in-memory cache)     │
│  core/SQLiteStorage.ts (better-sqlite3 + FTS5)      │
│  core/StorageFactory.ts (backend selection)         │
└─────────────────────────────────────────────────────┘
```

### Project Structure

```
memory-mcp/
├── src/                            # Source (65 TypeScript files)
│   ├── index.ts                    # Entry point
│   ├── core/                       # Core managers (12 files)
│   │   ├── ManagerContext.ts           # Context holder (lazy init)
│   │   ├── EntityManager.ts            # Entity CRUD + hierarchy
│   │   ├── RelationManager.ts          # Relation CRUD
│   │   ├── GraphStorage.ts             # JSONL I/O + caching
│   │   ├── SQLiteStorage.ts            # SQLite with better-sqlite3
│   │   ├── TransactionManager.ts       # ACID transactions
│   │   ├── StorageFactory.ts           # Storage backend factory
│   │   ├── HierarchyManager.ts         # Tree operations
│   │   ├── ObservationManager.ts       # Observation CRUD
│   │   ├── GraphTraversal.ts           # Path finding, centrality
│   │   ├── GraphEventEmitter.ts        # Event system
│   │   └── index.ts
│   ├── server/                     # MCP protocol (4 files)
│   │   ├── MCPServer.ts                # Server setup
│   │   ├── toolDefinitions.ts          # 59 tool schemas
│   │   ├── toolHandlers.ts             # Handler registry
│   │   └── responseCompressor.ts       # Brotli compression
│   ├── search/                     # Search implementations (20 files)
│   │   ├── SearchManager.ts            # Search orchestrator
│   │   ├── BasicSearch.ts              # Text matching
│   │   ├── RankedSearch.ts             # TF-IDF scoring
│   │   ├── BooleanSearch.ts            # AND/OR/NOT logic
│   │   ├── FuzzySearch.ts              # Typo tolerance
│   │   ├── SemanticSearch.ts           # Embedding-based
│   │   ├── EmbeddingService.ts         # Provider abstraction
│   │   ├── VectorStore.ts              # Vector storage
│   │   └── ...                         # + 12 more
│   ├── features/                   # Advanced capabilities (9 files)
│   │   ├── IOManager.ts                # Import/export/backup
│   │   ├── TagManager.ts               # Tag aliases
│   │   ├── AnalyticsManager.ts         # Graph stats
│   │   ├── ArchiveManager.ts           # Entity archival
│   │   ├── CompressionManager.ts       # Duplicate detection
│   │   ├── StreamingExporter.ts        # Large graph exports
│   │   ├── ObservationNormalizer.ts    # Coreference resolution
│   │   ├── KeywordExtractor.ts         # Keyword extraction
│   │   └── index.ts
│   ├── types/                      # TypeScript definitions (2 files)
│   ├── utils/                      # Shared utilities (15 files)
│   └── workers/                    # Worker pool (2 files)
├── tests/                          # Test suite (74 files, 2535 tests)
│   ├── unit/                       # Unit tests
│   ├── integration/                # Integration tests
│   ├── e2e/                        # End-to-end tests
│   └── performance/                # Benchmarks
├── dist/                           # Compiled output
├── docs/                           # Documentation
│   ├── architecture/               # Architecture docs
│   ├── guides/                     # User guides
│   └── reports/                    # Sprint reports
├── tools/                          # Standalone utilities
│   ├── chunking-for-files/         # File splitting
│   ├── compress-for-context/       # CTON compression
│   ├── create-dependency-graph/    # Dependency analyzer
│   └── migrate-from-jsonl-to-sqlite/
├── CHANGELOG.md                    # Version history
└── README.md                       # This file
```

### Dependencies

**Production:**
- `@modelcontextprotocol/sdk`: ^1.21.1
- `better-sqlite3`: ^11.7.0
- `zod`: ^4.1.13
- `async-mutex`: ^0.5.0
- `@danielsimonjr/workerpool`: ^10.0.1

**Development:**
- `typescript`: ^5.6.2
- `vitest`: ^4.0.13
- `@vitest/coverage-v8`: ^4.0.13
- `@types/better-sqlite3`: ^7.6.12

## Documentation

Comprehensive documentation in `docs/`:

**Architecture**
- [API.md](docs/architecture/API.md) - Complete API documentation for all 59 tools
- [ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) - Technical architecture and system design
- [COMPONENTS.md](docs/architecture/COMPONENTS.md) - Component breakdown and responsibilities
- [OVERVIEW.md](docs/architecture/OVERVIEW.md) - High-level project overview
- [DEPENDENCY_GRAPH.md](docs/architecture/DEPENDENCY_GRAPH.md) - Module dependencies

**User Guides**
- [HIERARCHY.md](docs/guides/HIERARCHY.md) - Parent-child relationships (9 tools)
- [COMPRESSION.md](docs/guides/COMPRESSION.md) - Duplicate detection and merging
- [ARCHIVING.md](docs/guides/ARCHIVING.md) - Memory lifecycle and archiving
- [QUERY_LANGUAGE.md](docs/guides/QUERY_LANGUAGE.md) - Boolean search syntax

**Development**
- [WORKFLOW.md](docs/development/WORKFLOW.md) - Development procedures
- [MIGRATION.md](docs/guides/MIGRATION.md) - Version upgrade guide

## Contributing

We welcome contributions!

**See:**
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) - Community standards

**Ways to Help:**
- Report bugs
- Request features
- Submit pull requests
- Improve documentation
- Add tests

## Changelog

All notable changes are documented in **[CHANGELOG.md](CHANGELOG.md)**.

**Current version**: v9.8.3 - [View full changelog](CHANGELOG.md)

Recent highlights:
- **v9.8.3**: SQLite storage support fix, JSON-RPC communication fix
- **v9.8.2**: Security hardening (22 vulnerabilities fixed)
- **v9.8.1**: Architecture documentation overhaul

## License

**MIT License** - see [LICENSE](LICENSE)

## Acknowledgments

### Original Project

Enhanced fork of [Model Context Protocol memory server](https://github.com/modelcontextprotocol/servers) by [Anthropic](https://www.anthropic.com/).

### Developer

**[Daniel Simon Jr.](https://github.com/danielsimonjr)**

### Major Enhancements

- Hierarchical nesting with parent-child relationships
- Graph algorithms: path finding, centrality, connected components
- Semantic search with embedding-based similarity
- Brotli compression for backups, exports, and responses
- Memory compression with intelligent duplicate detection
- Smart archiving with criteria-based filtering
- Advanced search: TF-IDF, boolean, and fuzzy matching
- Multi-format import/export with merge strategies
- SQLite backend with better-sqlite3 (3-10x faster)
- Transaction support with ACID guarantees
- Comprehensive test suite (2535 tests, 96.6% coverage)

---

**Repository:** https://github.com/danielsimonjr/memory-mcp
**NPM:** https://www.npmjs.com/package/@danielsimonjr/memory-mcp
**Issues:** https://github.com/danielsimonjr/memory-mcp/issues
