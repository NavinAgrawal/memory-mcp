# Migration Guide: v0.7.0 → v0.8.0
## Upgrading to Enhanced Memory MCP v0.8.0

**Version:** 0.8.0
**Last Updated:** 2025-11-23

---

## Table of Contents

1. [Overview](#overview)
2. [What's New](#whats-new)
3. [Breaking Changes](#breaking-changes)
4. [Data Compatibility](#data-compatibility)
5. [Migration Steps](#migration-steps)
6. [Feature-by-Feature Guide](#feature-by-feature-guide)
7. [Testing After Migration](#testing-after-migration)
8. [Rollback Procedure](#rollback-procedure)
9. [Common Issues](#common-issues)
10. [Getting Help](#getting-help)

---

## Overview

Version 0.8.0 is a **major feature release** that adds 30 new tools and 3 core features to the Memory MCP server. This guide helps you upgrade from v0.7.0 safely and take advantage of the new capabilities.

### Release Summary

| Metric | v0.7.0 | v0.8.0 | Change |
|--------|--------|--------|--------|
| **Total Tools** | 15 | 45 | +200% |
| **Code Size** | 1,210 LOC | 4,550 LOC | +276% |
| **Export Formats** | 3 | 7 | +133% |
| **Storage Files** | 1 | 4 | +300% |
| **Core Features** | 4 phases | 7 phases | +75% |

### Upgrade Safety

✅ **Backward Compatible** - All v0.7.0 data works in v0.8.0
✅ **Non-Destructive** - No data loss during upgrade
✅ **Incremental** - Use new features at your own pace
✅ **Rollback-Safe** - Can revert to v0.7.0 if needed

---

## What's New

### Core Features (3 new capabilities)

#### 1. Hierarchical Nesting (Phase 2)
- **8 new tools** for parent-child relationships
- Organize entities in tree structures (projects → features → tasks)
- Navigate hierarchies (ancestors, descendants, subtrees)
- Automatic cycle detection

**New Field:** `parentId` (optional string)

**Key Tools:**
- `set_entity_parent` - Create parent-child links
- `get_children` / `get_parent` - Navigate hierarchy
- `get_ancestors` / `get_descendants` - Full traversal
- `get_subtree` - Extract entire branches
- `get_root_entities` - Find top-level entities
- `get_entity_depth` - Calculate hierarchy depth

#### 2. Memory Compression (Phase 3)
- **3 new tools** for duplicate detection and merging
- Multi-factor similarity scoring (name, type, observations, tags)
- Intelligent entity merging with data preservation
- Automated graph compression with dry-run mode

**New Interface:** `CompressionResult`

**Key Tools:**
- `find_duplicates` - Find similar entities
- `merge_entities` - Combine duplicates
- `compress_graph` - Automated cleanup

#### 3. Memory Archiving (Phase 4)
- **1 new tool** for memory lifecycle management
- Archive by age, importance, or tags (OR logic)
- Keep active memory focused and performant
- Dry-run preview before archiving

**New File:** `archive.jsonl`

**Key Tool:**
- `archive_entities` - Move entities to long-term storage

### Tier 0 Enhancements (18 new tools)

**Week 1: Core Quality**
- **B5: Bulk Tag Operations** (3 tools) - `add_tags_to_multiple`, `replace_tag`, `merge_tags`
- **A1: Graph Validation** (1 tool) - `validate_graph`
- **C4: Saved Searches** (5 tools) - Save and execute searches
- **C2: Fuzzy Search** (2 tools) - Typo-tolerant search with suggestions
- **B2: Tag Aliases** (5 tools) - Tag synonym management

**Week 2: Advanced Features**
- **C1: TF-IDF Search** (1 tool) - `search_nodes_ranked` with relevance scoring
- **C3: Boolean Search** (1 tool) - `boolean_search` with AND/OR/NOT
- **D1: Export Formats** (4 new formats) - GEXF, DOT, Markdown, Mermaid
- **D2: Import** (1 tool) - `import_graph` from JSON/CSV/GraphML

### Storage Changes

v0.8.0 uses **4 storage files** (v0.7.0 used 1):

```
/path/to/memory-mcp/
├── memory.jsonl           # Active knowledge graph (same as v0.7.0)
├── archive.jsonl          # Archived entities (NEW)
├── saved-searches.jsonl   # Saved search queries (NEW)
└── tag-aliases.jsonl      # Tag alias mappings (NEW)
```

---

## Breaking Changes

### ⚠️ NONE ⚠️

**Good news:** v0.8.0 has **ZERO breaking changes**!

- All v0.7.0 tools work identically in v0.8.0
- All v0.7.0 data loads without modification
- All v0.7.0 APIs maintain same signatures
- All v0.7.0 exports remain compatible

### Optional Fields Only

New fields are **optional** and don't affect existing data:

| Field | Type | Default | Impact |
|-------|------|---------|--------|
| `parentId` | string? | `undefined` | None - entities without parentId are root entities |
| New files | - | Empty | Created on first use |

---

## Data Compatibility

### Existing Data (v0.7.0)

Your `memory.jsonl` from v0.7.0 will load seamlessly:

**v0.7.0 entity:**
```json
{
  "name": "Project Alpha",
  "entityType": "project",
  "observations": ["Web app"],
  "createdAt": "2025-01-15T10:00:00.000Z",
  "lastModified": "2025-06-20T14:30:00.000Z",
  "tags": ["high-priority"],
  "importance": 8
}
```

**v0.8.0 reads this as:**
```json
{
  "name": "Project Alpha",
  "entityType": "project",
  "observations": ["Web app"],
  "createdAt": "2025-01-15T10:00:00.000Z",
  "lastModified": "2025-06-20T14:30:00.000Z",
  "tags": ["high-priority"],
  "importance": 8,
  "parentId": undefined  // Optional field, defaults to undefined
}
```

### New Storage Files

New files are **created automatically** on first use:

- `archive.jsonl` - Created when you first use `archive_entities`
- `saved-searches.jsonl` - Created when you first use `save_search`
- `tag-aliases.jsonl` - Created when you first use `add_tag_alias`

**No manual setup required!**

---

## Migration Steps

### Step 1: Backup Your Data

**Always backup before upgrading!**

```bash
# Backup existing data
cd /path/to/memory-mcp
cp memory.jsonl memory.jsonl.backup-v0.7.0
```

**Recommended:** Export your entire graph:

```javascript
// In v0.7.0, export everything
const graph = await export_graph({ format: "json" })
// Save this export as a complete backup
```

### Step 2: Update Code

**Option A: Git Pull**
```bash
cd /path/to/memory-mcp
git checkout main
git pull origin main
```

**Option B: Download Release**
```bash
# Download v0.8.0 from GitHub
# Extract to /path/to/memory-mcp
```

### Step 3: Install Dependencies

```bash
cd /path/to/memory-mcp
npm install
```

### Step 4: Build

```bash
npm run build
```

**Expected output:**
```
> @danielsimonjr/memory-mcp@0.8.0 build
> npm run build --workspace=src/memory

tsc && shx chmod +x dist/*.js
```

### Step 5: Update Configuration

Update your MCP settings file (if using Claude Desktop or other client):

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "memory": {
      "command": "node",
      "args": [
        "/path/to/memory-mcp/src/memory/dist/index.js"
      ]
    }
  }
}
```

### Step 6: Restart MCP Client

Restart your MCP client (e.g., Claude Desktop) to load v0.8.0.

### Step 7: Verify Installation

```javascript
// Check version and new tools are available
const stats = await get_graph_stats()
console.log("Graph stats:", stats)

// Try a new tool
const roots = await get_root_entities({})
console.log("Root entities:", roots.length)
```

**Success indicators:**
- ✅ All existing entities load correctly
- ✅ Stats show correct entity/relation counts
- ✅ New tools (e.g., `get_root_entities`) work
- ✅ No errors in console

---

## Feature-by-Feature Guide

### Using Hierarchical Nesting

**Before (v0.7.0):** Flat entity list

```javascript
// All entities are at same level
create_entities({ entities: [
  { name: "Project Alpha", entityType: "project" },
  { name: "Feature Auth", entityType: "feature" },
  { name: "Task Login", entityType: "task" }
]})

// No parent-child relationship
```

**After (v0.8.0):** Tree structure

```javascript
// Create entities
create_entities({ entities: [
  { name: "Project Alpha", entityType: "project" },
  { name: "Feature Auth", entityType: "feature" },
  { name: "Task Login", entityType: "task" }
]})

// Set parent relationships (NEW!)
set_entity_parent({ entityName: "Feature Auth", parentName: "Project Alpha" })
set_entity_parent({ entityName: "Task Login", parentName: "Feature Auth" })

// Navigate hierarchy (NEW!)
const children = await get_children({ entityName: "Project Alpha" })
// Returns: [Feature Auth]

const ancestors = await get_ancestors({ entityName: "Task Login" })
// Returns: [Feature Auth, Project Alpha]
```

**Migration tip:** You don't need to add hierarchies to existing entities. They work fine without `parentId`. Add hierarchies incrementally as needed.

### Using Memory Compression

**Before (v0.7.0):** Manual duplicate detection

```javascript
// Manually find similar entities
const graph = await read_graph()
// ... custom code to compare entities
// ... manually merge duplicates
```

**After (v0.8.0):** Automated compression

```javascript
// Find duplicates (NEW!)
const duplicates = await find_duplicates({ threshold: 0.8 })
console.log(`Found ${duplicates.duplicates.length} duplicate pairs`)

// Preview compression (NEW!)
const preview = await compress_graph({ threshold: 0.8, dryRun: true })
console.log(`Would merge ${preview.entitiesMerged} entities`)

// Execute compression (NEW!)
const result = await compress_graph({ threshold: 0.8, dryRun: false })
console.log(`Merged ${result.entitiesMerged} duplicates`)
```

**Migration tip:** Run `find_duplicates` on your existing v0.7.0 data to discover potential cleanup opportunities.

### Using Memory Archiving

**Before (v0.7.0):** Manual cleanup

```javascript
// Manually delete old entities
delete_entities({ entityNames: ["Old Project 1", "Old Project 2"] })
// Data is lost forever
```

**After (v0.8.0):** Safe archiving

```javascript
// Preview archiving (NEW!)
const preview = await archive_entities({
  olderThan: "2025-01-01",
  importanceLessThan: 3
}, true)

console.log(`Would archive ${preview.archived} entities`)

// Execute archiving (NEW!)
const result = await archive_entities({
  olderThan: "2025-01-01",
  importanceLessThan: 3
}, false)

// Data is preserved in archive.jsonl
console.log(`Archived ${result.archived} entities to archive.jsonl`)
```

**Migration tip:** Before deleting old entities, consider archiving them instead for future reference.

### Using Boolean Search

**Before (v0.7.0):** Simple search only

```javascript
// Basic keyword search
const results = await search_nodes({ query: "project" })

// To find "projects that are frontend OR backend but NOT deprecated",
// you had to:
// 1. Search for "project"
// 2. Manually filter results in code
```

**After (v0.8.0):** Complex queries

```javascript
// Boolean search with complex logic (NEW!)
const results = await boolean_search({
  query: "type:project AND (frontend OR backend) NOT deprecated"
})

// Returns only entities matching the exact criteria
console.log(`Found ${results.length} matching projects`)
```

**Migration tip:** Replace complex post-search filtering code with boolean queries.

### Using Saved Searches

**Before (v0.7.0):** Repeat queries manually

```javascript
// Have to write same query multiple times
const results1 = await search_nodes({
  query: "urgent",
  tags: ["high-priority"],
  minImportance: 7
})

// ... later ...

const results2 = await search_nodes({
  query: "urgent",
  tags: ["high-priority"],
  minImportance: 7
})
```

**After (v0.8.0):** Save and reuse

```javascript
// Save search (NEW!)
await save_search({
  name: "Urgent High Priority",
  query: "urgent",
  filters: {
    tags: ["high-priority"],
    minImportance: 7
  },
  description: "Critical work items"
})

// Execute saved search (NEW!)
const results = await execute_saved_search({
  name: "Urgent High Priority"
})

// List all saved searches (NEW!)
const searches = await list_saved_searches()
```

**Migration tip:** Identify frequently used search patterns and save them for easy reuse.

### Using New Export Formats

**Before (v0.7.0):** 3 export formats

```javascript
// JSON, CSV, GraphML only
await export_graph({ format: "json" })
await export_graph({ format: "csv" })
await export_graph({ format: "graphml" })
```

**After (v0.8.0):** 7 export formats

```javascript
// All v0.7.0 formats still work
await export_graph({ format: "json" })
await export_graph({ format: "csv" })
await export_graph({ format: "graphml" })

// NEW formats:
await export_graph({ format: "gexf" })      // Gephi native
await export_graph({ format: "dot" })       // GraphViz
await export_graph({ format: "markdown" })  // Human-readable docs
await export_graph({ format: "mermaid" })   // Embedded diagrams
```

**Migration tip:** Try Markdown or Mermaid formats for documentation and visual analysis.

---

## Testing After Migration

### Verification Checklist

Run these tests to ensure successful migration:

#### 1. Data Integrity

```javascript
// Test 1: Verify entity count
const stats = await get_graph_stats()
console.log(`Total entities: ${stats.totalEntities}`)
// Should match your v0.7.0 count

// Test 2: Verify entity types
console.log(`Entity types: ${Object.keys(stats.entityTypesCounts).join(', ')}`)
// Should include all your entity types

// Test 3: Verify relations
console.log(`Total relations: ${stats.totalRelations}`)
// Should match your v0.7.0 count
```

#### 2. Old Tools Still Work

```javascript
// Test 4: search_nodes (v0.7.0 tool)
const searchResults = await search_nodes({ query: "project" })
console.log(`Search found ${searchResults.length} entities`)

// Test 5: export_graph (v0.7.0 tool)
const export = await export_graph({ format: "json" })
console.log(`Export contains ${export.entities.length} entities`)

// Test 6: get_graph_stats (v0.7.0 tool)
const stats2 = await get_graph_stats()
console.log(`Stats: ${stats2.totalEntities} entities, ${stats2.totalRelations} relations`)
```

#### 3. New Tools Work

```javascript
// Test 7: get_root_entities (NEW in v0.8.0)
const roots = await get_root_entities({})
console.log(`Root entities: ${roots.length}`)
// Should return entities without parentId

// Test 8: find_duplicates (NEW in v0.8.0)
const duplicates = await find_duplicates({ threshold: 0.8 })
console.log(`Potential duplicates: ${duplicates.duplicates.length}`)

// Test 9: validate_graph (NEW in v0.8.0)
const validation = await validate_graph()
console.log(`Errors: ${validation.errors.length}, Warnings: ${validation.warnings.length}`)
```

#### 4. Storage Files

```bash
# Test 10: Verify storage files exist
ls -la /path/to/memory-mcp/memory.jsonl
# Should exist and match v0.7.0 size (approximately)

# Test 11: Check for new files
ls -la /path/to/memory-mcp/*.jsonl
# Should show memory.jsonl
# May show archive.jsonl, saved-searches.jsonl, tag-aliases.jsonl if used
```

### Expected Results

✅ **All tests pass** - Migration successful!
⚠️ **Some tests fail** - Check [Common Issues](#common-issues)
❌ **Many tests fail** - Consider [Rollback](#rollback-procedure)

---

## Rollback Procedure

If you encounter issues with v0.8.0, you can safely rollback to v0.7.0.

### Step 1: Stop MCP Server

Quit your MCP client (e.g., Claude Desktop).

### Step 2: Restore v0.7.0 Code

```bash
cd /path/to/memory-mcp

# Option A: Git checkout
git checkout v0.7.0

# Option B: Re-download v0.7.0 release
```

### Step 3: Rebuild

```bash
npm install
npm run build
```

### Step 4: Restore Data (if needed)

If v0.8.0 modified your data:

```bash
# Restore backup
cp memory.jsonl.backup-v0.7.0 memory.jsonl

# Remove new files
rm -f archive.jsonl saved-searches.jsonl tag-aliases.jsonl
```

### Step 5: Restart MCP Client

Restart your MCP client. You should be back on v0.7.0.

### Step 6: Verify Rollback

```javascript
// Check version (should be v0.7.0)
const stats = await get_graph_stats()
console.log("Entity count:", stats.totalEntities)

// New tools should NOT exist
try {
  await get_root_entities({})
  console.log("ERROR: Still on v0.8.0")
} catch (e) {
  console.log("SUCCESS: Rollback to v0.7.0 complete")
}
```

---

## Common Issues

### Issue 1: Build Fails

**Error:** `npm run build` fails with TypeScript errors

**Solution:**
```bash
# Clean and rebuild
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Issue 2: Tools Not Available

**Error:** New tools like `get_root_entities` not found

**Cause:** MCP client not restarted or wrong path

**Solution:**
1. Verify build succeeded: `ls src/memory/dist/index.js`
2. Check MCP config points to correct path
3. Completely quit and restart MCP client (not just reload)

### Issue 3: Data Not Loading

**Error:** `get_graph_stats` shows 0 entities

**Cause:** Wrong data file path

**Solution:**
```javascript
// Check where MCP is looking for data
// The server uses the working directory to find memory.jsonl

// Verify file exists
ls memory.jsonl

// Verify file has data
wc -l memory.jsonl
```

### Issue 4: Performance Degradation

**Error:** Queries are slower in v0.8.0

**Cause:** Some new tools do full graph scans

**Solution:**
- Use `search_nodes` for simple queries (still fast)
- Use `boolean_search` only for complex logic
- Use `search_nodes_ranked` with result limits
- Consider compression to reduce graph size

### Issue 5: Memory Usage Increased

**Error:** Server using more memory

**Cause:** Additional features require more memory

**Solution:**
- Use `archive_entities` to move old data to archive
- Use `compress_graph` to merge duplicates
- Consider splitting large graphs into separate servers

---

## Getting Help

### Documentation

- **[README.md](README.md)** - Feature overview and API reference
- **[CHANGELOG.md](CHANGELOG.md)** - Complete v0.8.0 changes
- **[HIERARCHY_GUIDE.md](HIERARCHY_GUIDE.md)** - Using parent-child relationships
- **[COMPRESSION_GUIDE.md](COMPRESSION_GUIDE.md)** - Duplicate detection and merging
- **[ARCHIVING_GUIDE.md](ARCHIVING_GUIDE.md)** - Memory lifecycle management
- **[QUERY_LANGUAGE.md](QUERY_LANGUAGE.md)** - Boolean search syntax

### Support

- **GitHub Issues:** [https://github.com/danielsimonjr/memory-mcp/issues](https://github.com/danielsimonjr/memory-mcp/issues)
- **Report bugs**, feature requests, or ask questions

### Community

- **Model Context Protocol:** [https://modelcontextprotocol.io](https://modelcontextprotocol.io)
- Learn more about MCP standard

---

## Summary

### Migration Checklist

- [ ] Backup existing `memory.jsonl`
- [ ] Update code to v0.8.0
- [ ] Run `npm install` and `npm run build`
- [ ] Update MCP client configuration
- [ ] Restart MCP client
- [ ] Verify data loads correctly
- [ ] Test old tools still work
- [ ] Test new tools work
- [ ] Read feature guides
- [ ] Explore new capabilities!

### Key Takeaways

✅ **Zero breaking changes** - v0.7.0 data works in v0.8.0
✅ **Backward compatible** - All old tools work identically
✅ **Incremental adoption** - Use new features at your own pace
✅ **Safe to try** - Easy rollback if needed
✅ **Major upgrade** - 30 new tools, 3 core features

### Next Steps

1. **Read the guides** - Learn about new features
2. **Try hierarchies** - Organize existing entities
3. **Run compression** - Find and merge duplicates
4. **Set up archiving** - Move old data to archive
5. **Use boolean search** - Build complex queries
6. **Save searches** - Reuse common queries
7. **Try new exports** - Generate docs with Markdown/Mermaid

**Welcome to v0.8.0!** 🎉
