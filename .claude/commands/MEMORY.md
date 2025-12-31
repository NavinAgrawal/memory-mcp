---
description: Comprehensive memory graph operations - CRUD, search, and maintenance
allowed-tools: ["mcp__memory-mcp__search_nodes", "mcp__memory-mcp__get_graph_stats", "mcp__memory-mcp__find_duplicates", "mcp__memory-mcp__compress_graph", "mcp__memory-mcp__read_graph", "mcp__memory-mcp__create_entities", "mcp__memory-mcp__add_observations", "mcp__memory-mcp__delete_observations", "mcp__memory-mcp__delete_entities", "mcp__memory-mcp__create_relations", "mcp__memory-mcp__open_nodes", "mcp__memory-mcp__add_tags", "mcp__memory-mcp__set_importance", "mcp__memory-mcp__merge_entities"]
argument-hint: "<action> [args...]"
---

# Memory Graph Operations

Comprehensive access to memory-mcp for maintaining cross-session context.

## Actions

### Read Operations

| Action | Description |
|--------|-------------|
| `stats` | Show graph statistics (entity/relation counts, types, dates) |
| `search <query>` | Search for entities matching query |
| `open <name>` | Open specific entity by name |
| `read` | Read entire graph (use sparingly) |
| `duplicates` | Find potential duplicate entities |

### Write Operations

| Action | Description |
|--------|-------------|
| `update <entity> <observation>` | Add observation to existing entity |
| `create <name> <type> <observation>` | Create new entity |
| `relate <from> <to> <type>` | Create relation between entities |
| `tag <entity> <tags...>` | Add tags to entity |
| `importance <entity> <0-10>` | Set entity importance score |
| `delete <entity>` | Delete an entity |

### Maintenance Operations

| Action | Description |
|--------|-------------|
| `compress` | Preview graph compression (merge similar entities) |
| `merge <entity1> <entity2>` | Merge two entities into one |
| `cleanup` | Run full maintenance (stats + duplicates + recommendations) |

## Usage Examples

```bash
# Read operations
/project:MEMORY stats
/project:MEMORY search typescript project
/project:MEMORY open memory-mcp
/project:MEMORY duplicates

# Write operations
/project:MEMORY update memory-mcp "Added new feature X"
/project:MEMORY create my-project project "New project started"
/project:MEMORY relate my-project memory-mcp uses
/project:MEMORY tag memory-mcp sqlite storage
/project:MEMORY importance memory-mcp 9

# Maintenance
/project:MEMORY compress
/project:MEMORY merge old-entity new-entity
/project:MEMORY cleanup
```

## Session Workflow

1. **Session Start**: `/project:MEMORY stats` - Check what's stored
2. **During Work**: `/project:MEMORY update <entity> <observation>` - Record discoveries
3. **Session End**: `/project:MEMORY update <project> "Session summary..."` - Persist learnings
4. **Periodically**: `/project:MEMORY cleanup` - Maintain graph hygiene

## Tips

- Search before creating to avoid duplicates
- Use importance scores (0-10) to prioritize valuable knowledge
- Tag entities for easier filtering
- Compress periodically to merge similar entities
- Keep observations concise but informative
