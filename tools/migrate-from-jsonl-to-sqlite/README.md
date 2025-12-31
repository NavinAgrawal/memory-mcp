# Memory MCP Migration Tool

Migrate knowledge graph data between JSONL and SQLite storage formats for the Memory MCP server.

## Overview

This standalone tool allows you to convert your existing JSONL knowledge graph to SQLite format (or vice versa) when upgrading to SQLite storage for improved performance with large datasets.

## Installation

```bash
cd tools/migrate-from-jsonl-to-sqlite
npm install
```

## Usage

### Using Bun (Recommended)

```bash
# Migrate JSONL to SQLite
bun run migrate-from-jsonl-to-sqlite.ts --from memory.jsonl --to memory.db

# Migrate SQLite to JSONL
bun run migrate-from-jsonl-to-sqlite.ts --from memory.db --to memory.jsonl

# Verbose output
bun run migrate-from-jsonl-to-sqlite.ts -f memory.jsonl -t memory.db -v
```

### Using Node.js

```bash
# Build first
npm run build:ts

# Run
node dist/migrate-from-jsonl-to-sqlite.js --from memory.jsonl --to memory.db
```

### Build Executable

```bash
# Requires Bun
npm run build

# Creates migrate-from-jsonl-to-sqlite.exe
./migrate-from-jsonl-to-sqlite.exe --from memory.jsonl --to memory.db
```

## Arguments

| Argument | Short | Description |
|----------|-------|-------------|
| `--from` | `-f` | Source file path (JSONL or SQLite) |
| `--to` | `-t` | Target file path (JSONL or SQLite) |
| `--verbose` | `-v` | Show detailed progress |
| `--help` | `-h` | Show help message |

## File Extensions

The tool automatically detects the storage format based on file extension:

| Format | Extensions |
|--------|------------|
| JSONL | `.jsonl`, `.json` |
| SQLite | `.db`, `.sqlite`, `.sqlite3` |

## Examples

```bash
# Basic migration
./migrate-from-jsonl-to-sqlite.exe memory.jsonl memory.db

# Using named arguments
./migrate-from-jsonl-to-sqlite.exe --from /path/to/memory.jsonl --to /path/to/memory.db

# Verbose output shows detailed progress
./migrate-from-jsonl-to-sqlite.exe -f memory.jsonl -t memory.db -v
```

## Output

```
📖 Loading source data...
   Found 150 entities and 75 relations

💾 Writing to target...

✅ Verifying migration...

✨ Migration completed successfully!
   Migrated 150 entities and 75 relations
   From: memory.jsonl (jsonl)
   To:   memory.db (sqlite)
```

## Notes

- **Data Preserved**: All entities, relations, and metadata are fully preserved during migration
- **Verification**: The tool automatically verifies data integrity after migration
- **Overwrite**: If the target file exists, it will be overwritten
- **Separate Files**: Saved searches and tag aliases are stored in separate files and are NOT migrated by this tool

## When to Use SQLite

| Use Case | Recommendation |
|----------|----------------|
| Small graphs (<1000 entities) | JSONL (default) |
| Large graphs (10k+ entities) | SQLite |
| Need ACID transactions | SQLite |
| Want to inspect data manually | JSONL |
| Debugging | JSONL |

## Configuring Memory MCP for SQLite

After migrating, configure the Memory MCP server to use SQLite:

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": ["/path/to/memory-mcp/src/memory/dist/index.js"],
      "env": {
        "MEMORY_STORAGE_TYPE": "sqlite",
        "MEMORY_FILE_PATH": "/path/to/memory.db"
      }
    }
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Run directly with Bun
bun run migrate-from-jsonl-to-sqlite.ts --help

# Build TypeScript
npm run build:ts

# Build executable (requires Bun)
npm run build
```
