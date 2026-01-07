---
description: Index project and update knowledge graph + CLAUDE.md
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "mcp__memory__search_nodes", "mcp__memory__get_graph_stats", "mcp__memory__create_entities", "mcp__memory__add_observations", "mcp__memory__create_relations", "mcp__memory__open_nodes", "mcp__memory__set_importance"]
argument-hint: "[--update-claude-md] [--deep]"
---

# Project Exploration & Knowledge Indexing

Explore the current project, index key information to memory, and optionally update CLAUDE.md.

## Instructions

Perform a comprehensive project exploration and knowledge update:

### Phase 1: Gather Current State

1. **Get project metadata:**
   ```bash
   # Package info
   cat package.json | head -30

   # Git status
   git log --oneline -10
   git status --short
   ```

2. **Count and analyze source files:**
   ```bash
   # TypeScript files
   find src -name "*.ts" | wc -l

   # Test files
   find src -name "*.test.ts" | wc -l
   ```

3. **Check for recent changes:**
   ```bash
   git diff --stat HEAD~5
   ```

4. **Review key entry points:**
   - Read `src/memory/index.ts`
   - Check `src/memory/server/toolDefinitions.ts` for tool count
   - Scan for new files not in CLAUDE.md

### Phase 2: Update Knowledge Graph

1. **Search for existing project entity:**
   - Use `search_nodes` with "memory-mcp"

2. **Create or update project entity:**
   - If not exists: Create entity with type "project"
   - Add observations about current state:
     - Version number
     - Tool count
     - Test count
     - Recent changes summary
     - Key architectural patterns

3. **Create entities for new components:**
   - Any new managers or major classes
   - New tool categories
   - New features discovered

4. **Update relations:**
   - Connect components to the main project
   - Map dependencies between modules

### Phase 3: CLAUDE.md Update (if --update-claude-md)

If `--update-claude-md` flag is provided, analyze and update CLAUDE.md:

1. **Check for discrepancies:**
   - Version number in package.json vs CLAUDE.md
   - Tool count (grep toolDefinitions.ts vs documented 47)
   - Test count (run quick test --dry-run or count test files)
   - File counts per module
   - Dependencies in package.json vs documented

2. **Update outdated sections:**
   - Version numbers
   - Tool counts
   - Test statistics
   - Dependency versions
   - New slash commands in commands list

3. **Add new information:**
   - New features or tools
   - New documentation files
   - Architecture changes

### Phase 4: Report

Provide a summary of:
- Files/modules explored
- Knowledge entities created/updated
- CLAUDE.md changes made (if applicable)
- Recommendations for further documentation

## Usage Examples

```bash
# Basic exploration and memory update
/EXPLORE

# Deep exploration with more file reading
/EXPLORE --deep

# Update CLAUDE.md with current stats
/EXPLORE --update-claude-md

# Full exploration with all updates
/EXPLORE --deep --update-claude-md
```

## What Gets Indexed

| Category | Information Captured |
|----------|---------------------|
| **Project** | Name, version, description, npm package |
| **Architecture** | Layers, patterns, entry points |
| **Modules** | File counts, purposes, key exports |
| **Tools** | MCP tool count and categories |
| **Tests** | Test count, coverage areas |
| **Dependencies** | Production and dev dependencies |
| **Recent Changes** | Last 5-10 commits summary |

## Knowledge Graph Structure

The command creates/updates entities with this structure:

```
memory-mcp (project)
├── observations: [version, tools, tests, patterns...]
├── importance: 9
└── relations:
    ├── has_component → EntityManager
    ├── has_component → SearchManager
    ├── has_tool → search_nodes
    └── uses → better-sqlite3
```

## Tips

- Run at session start to sync knowledge
- Run after major changes to update documentation
- Use `--deep` for thorough analysis (reads more files)
- Combine with `/MEMORY stats` to verify updates
