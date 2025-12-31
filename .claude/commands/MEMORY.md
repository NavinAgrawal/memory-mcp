---
description: Quick memory graph operations - search, stats, and maintenance
allowed-tools: ["mcp__memory-mcp__search_nodes", "mcp__memory-mcp__get_graph_stats", "mcp__memory-mcp__find_duplicates", "mcp__memory-mcp__compress_graph", "mcp__memory-mcp__read_graph"]
argument-hint: "<search-query> | stats | duplicates | compress | all"
---

# Memory Graph Operations

Quick access to common memory-mcp operations for maintaining cross-session context.

## Instructions

Based on the argument provided, perform the appropriate memory operation:

### If argument is "stats" or empty:
1. Call `get_graph_stats` to show current graph statistics
2. Report entity count, relation count, entity types, and date ranges

### If argument is "duplicates":
1. Call `find_duplicates` with threshold 0.6
2. Report any potential duplicate entities found

### If argument is "compress":
1. Call `compress_graph` with dryRun=true first to preview
2. Ask user to confirm before running actual compression

### If argument is "all":
1. Run stats, duplicates check, and show graph summary
2. Provide maintenance recommendations if needed

### If argument is a search query:
1. Call `search_nodes` with the provided query
2. Display matching entities with their types and observation counts

## Usage Examples

```bash
# Show graph statistics
/project:MEMORY stats

# Search for entities
/project:MEMORY typescript project

# Find duplicate entities
/project:MEMORY duplicates

# Compress/consolidate graph (with preview)
/project:MEMORY compress

# Full maintenance check
/project:MEMORY all
```

## Maintenance Tips

- Run `/project:MEMORY stats` at session start to understand stored context
- Run `/project:MEMORY duplicates` periodically to find redundant entries
- Run `/project:MEMORY compress` to merge similar entities
- Search before creating new entities to avoid duplicates
