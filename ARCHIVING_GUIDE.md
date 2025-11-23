# Memory Archiving Guide
## Managing Memory Lifecycle and Long-Term Storage

**Version:** 0.8.0
**Last Updated:** 2025-11-23

---

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Understanding Archiving Criteria](#understanding-archiving-criteria)
4. [Getting Started](#getting-started)
5. [Tool Reference](#tool-reference)
6. [Common Use Cases](#common-use-cases)
7. [Best Practices](#best-practices)
8. [Advanced Patterns](#advanced-patterns)
9. [Troubleshooting](#troubleshooting)

---

## Overview

Memory archiving helps you manage the lifecycle of your knowledge graph by moving inactive, low-priority, or completed entities out of active memory. This keeps your active graph focused, performant, and relevant while preserving historical data for future reference.

### Key Features

- ✅ **Criteria-Based Archiving**: Archive by age, importance, or tags
- ✅ **OR Logic**: Archive if ANY criterion matches (flexible filtering)
- ✅ **Dry-Run Preview**: Safe preview before executing
- ✅ **Clean Removal**: Automatically removes related relations
- ✅ **Permanent Storage**: Archived entities saved to separate file
- ✅ **Selective Archiving**: Target specific entity groups

### When to Use Archiving

- **Memory optimization**: Active graph is too large and slowing down queries
- **Focus maintenance**: Keep active memory focused on current work
- **Lifecycle management**: Archive completed projects, deprecated features
- **Temporal cleanup**: Remove old entities that are no longer relevant
- **Capacity planning**: Prevent unbounded growth of active memory

### What Gets Archived

When entities are archived:
- **Entity data**: Moved to `archive.jsonl`
- **Relations**: Incoming and outgoing relations are **removed**
- **Active graph**: Entity and its relations are removed from `memory.jsonl`
- **Permanence**: Archived entities are **not** automatically restored

⚠️ **Important:** Archiving is **permanent** removal from active memory. Plan carefully!

---

## Core Concepts

### The Archive File

Archived entities are stored in a separate JSONL file:

```
/path/to/memory-mcp/
├── memory.jsonl           # Active knowledge graph
├── archive.jsonl          # Archived entities (permanent storage)
├── saved-searches.jsonl   # Saved search queries
└── tag-aliases.jsonl      # Tag alias mappings
```

**Archive format:**
```jsonl
{"name":"Old Project","entityType":"project","observations":["Completed in 2023"],"archivedAt":"2025-11-23T10:00:00.000Z"}
{"name":"Deprecated API","entityType":"api","observations":["No longer used"],"archivedAt":"2025-11-23T10:00:00.000Z"}
```

### Archiving Criteria (OR Logic)

You can specify up to 3 criteria, and entities matching **ANY** criterion will be archived:

| Criterion | Type | Description |
|-----------|------|-------------|
| **olderThan** | ISO Date String | Archive entities last modified before this date |
| **importanceLessThan** | Number (0-10) | Archive entities below this importance threshold |
| **tags** | String[] | Archive entities with ANY of these tags |

**Example:**
```javascript
archive_entities({
  olderThan: "2025-06-01",
  importanceLessThan: 3,
  tags: ["deprecated", "completed"]
})

// Archives entities that are:
// - Modified before June 1, 2025, OR
// - Have importance < 3, OR
// - Have tag "deprecated", OR
// - Have tag "completed"
```

### What Happens During Archiving

1. **Evaluation**: Each entity is checked against all criteria
2. **Matching**: If ANY criterion matches, entity is marked for archiving
3. **Relations**: All relations involving archived entities are removed
4. **Storage**: Entity data is written to `archive.jsonl` with `archivedAt` timestamp
5. **Removal**: Entity is removed from active `memory.jsonl`
6. **Save**: Both files are persisted

---

## Understanding Archiving Criteria

### Criterion 1: `olderThan` (Temporal)

Archives entities based on their **last modification date**.

**Format:** ISO 8601 date string (e.g., `"2025-06-01"`, `"2025-01-15T00:00:00.000Z"`)

**Logic:**
```typescript
entity.lastModified < olderThan  // Archive if older
```

**Examples:**
```javascript
// Archive entities not modified since January 1, 2025
archive_entities({ olderThan: "2025-01-01" })

// Archive entities from 2024 or earlier
archive_entities({ olderThan: "2025-01-01T00:00:00.000Z" })

// Archive 6+ month old entities
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
archive_entities({ olderThan: sixMonthsAgo.toISOString() })
```

**Best for:**
- Seasonal cleanup (quarterly, annual)
- Time-based retention policies
- Historical project archiving

---

### Criterion 2: `importanceLessThan` (Priority)

Archives entities based on their **importance level**.

**Format:** Number between 0 and 10

**Logic:**
```typescript
(entity.importance || 0) < importanceLessThan  // Archive if less important
```

**Examples:**
```javascript
// Archive low-priority entities (importance 0-2)
archive_entities({ importanceLessThan: 3 })

// Archive all but high-priority entities (keep 8-10)
archive_entities({ importanceLessThan: 8 })

// Archive unimportant entities (no importance set, or 0)
archive_entities({ importanceLessThan: 1 })
```

**Importance Scale:**
- **9-10**: Critical (never archive)
- **7-8**: High priority (archive rarely)
- **5-6**: Medium priority (archive when old)
- **3-4**: Low priority (archive when inactive)
- **0-2**: Minimal (archive aggressively)

**Best for:**
- Capacity management (keep only important entities)
- Priority-based cleanup
- Focus maintenance

---

### Criterion 3: `tags` (Status/Category)

Archives entities with **specific tags** (case-insensitive).

**Format:** Array of strings

**Logic:**
```typescript
entity.tags?.some(tag => tags.includes(tag.toLowerCase()))  // Archive if ANY tag matches
```

**Examples:**
```javascript
// Archive completed work
archive_entities({ tags: ["completed", "done"] })

// Archive deprecated features
archive_entities({ tags: ["deprecated", "obsolete", "retired"] })

// Archive draft content
archive_entities({ tags: ["draft", "wip", "unfinished"] })

// Archive temporary entities
archive_entities({ tags: ["temp", "scratch", "test"] })
```

**Common Tag Patterns:**

| Tag Pattern | Use Case |
|-------------|----------|
| `completed`, `done`, `finished` | Completed work |
| `deprecated`, `obsolete`, `retired` | Outdated features |
| `draft`, `wip`, `unfinished` | Incomplete work |
| `temp`, `scratch`, `test` | Temporary data |
| `archived`, `inactive` | Manual archive markers |
| `2024-q1`, `2024-q2` | Temporal tags |

**Best for:**
- Status-based archiving (completed projects)
- Category cleanup (remove drafts)
- Manual archiving workflows (tag then archive)

---

## Getting Started

### Example 1: Preview Before Archiving

```javascript
// ALWAYS preview first!
const preview = await archive_entities({
  olderThan: "2025-06-01",
  importanceLessThan: 3
}, true);  // dryRun = true

console.log(`Would archive ${preview.archived} entities`);
console.log(`Entities: ${preview.entityNames.join(', ')}`);

// Review the list, then execute
if (confirm("Proceed with archiving?")) {
  await archive_entities({
    olderThan: "2025-06-01",
    importanceLessThan: 3
  }, false);  // dryRun = false
}
```

### Example 2: Archive Completed Projects

```javascript
// Step 1: Tag completed projects
await add_tags_to_multiple({
  entityNames: ["Project Alpha", "Q3 Initiative", "Backend Rewrite"],
  tags: ["completed"]
});

// Step 2: Archive all completed projects
const result = await archive_entities({
  tags: ["completed"]
}, false);

console.log(`Archived ${result.archived} completed projects`);
```

### Example 3: Temporal Cleanup

```javascript
// Archive entities older than 1 year
const oneYearAgo = new Date();
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

const result = await archive_entities({
  olderThan: oneYearAgo.toISOString()
}, false);

console.log(`Archived ${result.archived} entities from > 1 year ago`);
```

---

## Tool Reference

### `archive_entities`

Archive entities based on criteria (OR logic).

**Parameters:**
```typescript
{
  olderThan?: string;           // ISO date (entities modified before this)
  importanceLessThan?: number;  // Importance threshold (0-10)
  tags?: string[];              // Tag list (any match)
}
```

**Second parameter:** `dryRun` (boolean, default `false`)

**Returns:**
```typescript
{
  archived: number;       // Count of archived entities
  entityNames: string[];  // Names of archived entities
}
```

**Behavior:**
1. Evaluates each entity against all criteria (OR logic)
2. Collects matching entities
3. If `dryRun: true`, returns list without changes
4. If `dryRun: false`, archives entities:
   - Removes relations involving archived entities
   - Writes entities to `archive.jsonl` with `archivedAt` timestamp
   - Removes entities from active graph
   - Saves both active and archive files

**Usage:**
```javascript
// Preview only (safe)
archive_entities({ olderThan: "2025-01-01" }, true)

// Execute archiving
archive_entities({ olderThan: "2025-01-01" }, false)

// Multiple criteria (OR logic)
archive_entities({
  olderThan: "2025-06-01",
  importanceLessThan: 3,
  tags: ["completed", "deprecated"]
}, false)

// Single criterion
archive_entities({ tags: ["temp"] }, false)
```

**Validation:**
- At least one criterion must be provided
- `importanceLessThan` must be 0-10
- `olderThan` must be valid ISO date string
- `tags` must be non-empty array if provided

---

## Common Use Cases

### Use Case 1: Quarterly Cleanup

**Scenario:** Archive old, low-priority entities every quarter.

```javascript
async function quarterlyArchive() {
  // Define criteria
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // Preview
  const preview = await archive_entities({
    olderThan: threeMonthsAgo.toISOString(),
    importanceLessThan: 4  // Low priority
  }, true);

  console.log(`Quarterly Archive Preview:`);
  console.log(`- Entities to archive: ${preview.archived}`);
  console.log(`- Names: ${preview.entityNames.slice(0, 10).join(', ')}...`);

  // Get stats before archiving
  const before = await get_graph_stats();

  // Execute
  const result = await archive_entities({
    olderThan: threeMonthsAgo.toISOString(),
    importanceLessThan: 4
  }, false);

  // Get stats after
  const after = await get_graph_stats();

  // Log report
  console.log(`Quarterly Archive Complete:`);
  console.log(`- Archived: ${result.archived} entities`);
  console.log(`- Before: ${before.totalEntities} entities`);
  console.log(`- After: ${after.totalEntities} entities`);
  console.log(`- Reduction: ${before.totalEntities - after.totalEntities} entities`);

  // Create audit log
  await create_entities({
    entities: [{
      name: `Quarterly Archive ${new Date().toISOString().split('T')[0]}`,
      entityType: "audit-log",
      observations: [
        `Archived ${result.archived} entities`,
        `Criteria: olderThan ${threeMonthsAgo.toISOString()}, importanceLessThan 4`,
        `Graph size: ${before.totalEntities} → ${after.totalEntities}`,
        `Entities: ${result.entityNames.join(', ')}`
      ],
      tags: ["archive", "maintenance", "quarterly"],
      importance: 7
    }]
  });
}

// Run quarterly
await quarterlyArchive();
```

### Use Case 2: Project Lifecycle Management

**Scenario:** Archive completed projects and their entire subtrees.

```javascript
async function archiveCompletedProjects() {
  // Find all completed projects
  const results = await search_nodes({
    query: "",
    tags: ["completed"],
    minImportance: 0,
    maxImportance: 10
  });

  const completedProjects = results.filter(e => e.entityType === "project");

  console.log(`Found ${completedProjects.length} completed projects`);

  for (const project of completedProjects) {
    console.log(`Archiving project: ${project.name}`);

    // Get entire project subtree
    const subtree = await get_subtree({ entityName: project.name });

    console.log(`- Subtree size: ${subtree.entities.length} entities`);

    // Tag entire subtree for archiving
    const entityNames = subtree.entities.map(e => e.name);
    await add_tags_to_multiple({
      entityNames,
      tags: ["archived"]
    });

    // Archive the entire subtree
    const result = await archive_entities({
      tags: ["archived"]
    }, false);

    console.log(`- Archived: ${result.archived} entities`);
  }
}

// Usage
await archiveCompletedProjects();
```

### Use Case 3: Capacity Management

**Scenario:** Keep active memory under 1000 entities by archiving least important entities.

```javascript
async function enforceCapacityLimit(maxEntities = 1000) {
  const stats = await get_graph_stats();

  if (stats.totalEntities <= maxEntities) {
    console.log(`Under capacity: ${stats.totalEntities}/${maxEntities} entities`);
    return;
  }

  const excess = stats.totalEntities - maxEntities;
  console.log(`Over capacity by ${excess} entities. Archiving...`);

  // Archive progressively by importance
  const thresholds = [1, 2, 3, 4, 5, 6, 7, 8];

  for (const threshold of thresholds) {
    const preview = await archive_entities({
      importanceLessThan: threshold
    }, true);

    console.log(`Threshold ${threshold}: Would archive ${preview.archived} entities`);

    if (preview.archived >= excess) {
      // This threshold is sufficient
      const result = await archive_entities({
        importanceLessThan: threshold
      }, false);

      console.log(`Archived ${result.archived} entities (importance < ${threshold})`);

      const newStats = await get_graph_stats();
      console.log(`New entity count: ${newStats.totalEntities}/${maxEntities}`);
      break;
    }
  }
}

// Usage
await enforceCapacityLimit(1000);
```

### Use Case 4: Temporal Retention Policy

**Scenario:** Implement tiered retention based on age and importance.

```javascript
async function tieredRetention() {
  const now = new Date();

  // Tier 1: Archive > 2 years old, any importance
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const tier1 = await archive_entities({
    olderThan: twoYearsAgo.toISOString()
  }, false);

  console.log(`Tier 1 (>2 years): Archived ${tier1.archived} entities`);

  // Tier 2: Archive > 1 year old AND low importance
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const tier2 = await archive_entities({
    olderThan: oneYearAgo.toISOString(),
    importanceLessThan: 5
  }, false);

  console.log(`Tier 2 (>1 year, low priority): Archived ${tier2.archived} entities`);

  // Tier 3: Archive > 6 months old AND very low importance
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const tier3 = await archive_entities({
    olderThan: sixMonthsAgo.toISOString(),
    importanceLessThan: 3
  }, false);

  console.log(`Tier 3 (>6 months, very low priority): Archived ${tier3.archived} entities`);

  const total = tier1.archived + tier2.archived + tier3.archived;
  console.log(`Total archived: ${total} entities`);
}

// Run monthly
await tieredRetention();
```

---

## Best Practices

### 1. Always Preview First

**Never** archive without reviewing what will be removed:

```javascript
✅ GOOD: Safe workflow
const preview = await archive_entities({ tags: ["completed"] }, true);
console.log(`Would archive: ${preview.entityNames.join(', ')}`);
// Review list carefully
await archive_entities({ tags: ["completed"] }, false);

❌ BAD: Blind archiving
await archive_entities({ importanceLessThan: 5 }, false);  // Risky!
```

### 2. Tag Before Archiving

Use tags to explicitly mark entities for archiving:

```javascript
// Step 1: Tag entities for archiving
await add_tags_to_multiple({
  entityNames: ["Project A", "Project B", "Project C"],
  tags: ["ready-to-archive"]
});

// Step 2: Review tagged entities
const tagged = await search_nodes({ query: "", tags: ["ready-to-archive"] });
console.log(`Ready to archive: ${tagged.length} entities`);

// Step 3: Archive
await archive_entities({ tags: ["ready-to-archive"] }, false);
```

### 3. Document Archiving Activity

Create audit logs for all archiving operations:

```javascript
async function documentedArchive(criteria, dryRun = false) {
  const before = await get_graph_stats();

  const result = await archive_entities(criteria, dryRun);

  if (!dryRun) {
    const after = await get_graph_stats();

    await create_entities({
      entities: [{
        name: `Archive Operation ${new Date().toISOString()}`,
        entityType: "archive-log",
        observations: [
          `Criteria: ${JSON.stringify(criteria)}`,
          `Archived: ${result.archived} entities`,
          `Before: ${before.totalEntities} entities`,
          `After: ${after.totalEntities} entities`,
          `Entities: ${result.entityNames.join(', ')}`
        ],
        tags: ["archive", "audit", "maintenance"],
        importance: 8
      }]
    });
  }

  return result;
}
```

### 4. Protect Critical Entities

Ensure important entities are never archived accidentally:

```javascript
// Set high importance for critical entities
await set_importance({ entityName: "Mission Critical System", importance: 10 });
await set_importance({ entityName: "Core Architecture", importance: 10 });
await set_importance({ entityName: "Primary Database", importance: 10 });

// Now archiving by importance will never touch these
await archive_entities({ importanceLessThan: 9 }, false);  // Safe
```

### 5. Use Progressive Thresholds

Start conservative and increase aggressiveness:

```javascript
// Progressive archiving
async function progressiveArchive() {
  // Round 1: Very old, low priority (conservative)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  await archive_entities({
    olderThan: oneYearAgo.toISOString(),
    importanceLessThan: 3
  }, false);

  // Round 2: Completed work (safe)
  await archive_entities({
    tags: ["completed", "done"]
  }, false);

  // Round 3: Deprecated (targeted)
  await archive_entities({
    tags: ["deprecated", "obsolete"]
  }, false);

  // Round 4: If still over capacity, increase aggressiveness
  const stats = await get_graph_stats();
  if (stats.totalEntities > 1000) {
    await archive_entities({
      importanceLessThan: 5
    }, false);
  }
}
```

### 6. Validate After Archiving

Check graph health after major archiving operations:

```javascript
async function safeArchive(criteria) {
  // Backup (optional - depends on your setup)
  const beforeGraph = await read_graph();

  // Archive
  const result = await archive_entities(criteria, false);

  // Validate
  const validation = await validate_graph();

  if (validation.errors.length > 0) {
    console.error("Archiving created errors:", validation.errors);
    // Consider manual review or restoration
  }

  console.log(`Archived ${result.archived} entities`);
  console.log(`Validation: ${validation.errors.length} errors, ${validation.warnings.length} warnings`);

  return result;
}
```

---

## Advanced Patterns

### Pattern 1: Selective Subtree Archiving

Archive specific branches of a hierarchy:

```javascript
async function archiveSubtree(rootEntityName, preserveRoot = false) {
  // Get entire subtree
  const subtree = await get_subtree({ entityName: rootEntityName });

  let entityNames = subtree.entities.map(e => e.name);

  if (preserveRoot) {
    // Remove root from archiving list
    entityNames = entityNames.filter(name => name !== rootEntityName);
  }

  console.log(`Archiving ${entityNames.length} entities from subtree...`);

  // Tag for archiving
  await add_tags_to_multiple({ entityNames, tags: ["subtree-archive"] });

  // Archive
  const result = await archive_entities({ tags: ["subtree-archive"] }, false);

  console.log(`Archived subtree: ${result.archived} entities`);
  return result;
}

// Usage
await archiveSubtree("Old Project", false);  // Archive entire project
await archiveSubtree("Active Project", true); // Archive children but keep root
```

### Pattern 2: Scheduled Archiving

Implement automated archiving schedules:

```javascript
// Pseudo-code for scheduled archiving
class ArchiveScheduler {
  async dailyArchive() {
    // Archive temporary entities
    await archive_entities({
      tags: ["temp", "scratch"]
    }, false);
  }

  async weeklyArchive() {
    // Archive completed work from last week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    await archive_entities({
      olderThan: oneWeekAgo.toISOString(),
      tags: ["completed"]
    }, false);
  }

  async monthlyArchive() {
    // Archive old, low-priority entities
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    await archive_entities({
      olderThan: oneMonthAgo.toISOString(),
      importanceLessThan: 4
    }, false);
  }

  async quarterlyArchive() {
    // Aggressive cleanup
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    await archive_entities({
      olderThan: threeMonthsAgo.toISOString(),
      importanceLessThan: 6
    }, false);
  }
}
```

### Pattern 3: Archive with Backup

Create export backup before archiving:

```javascript
async function archiveWithBackup(criteria) {
  // Step 1: Export entities that will be archived
  const preview = await archive_entities(criteria, true);

  // Step 2: Get full entity data
  const entitiesToArchive = await open_nodes({
    names: preview.entityNames
  });

  // Step 3: Export to JSON
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const backup = {
    archiveDate: timestamp,
    criteria: criteria,
    entities: entitiesToArchive
  };

  console.log(`Backup created: archive-backup-${timestamp}.json`);
  console.log(`Entities: ${entitiesToArchive.length}`);
  // Save backup (implementation depends on your environment)

  // Step 4: Execute archiving
  const result = await archive_entities(criteria, false);

  console.log(`Archived ${result.archived} entities (backup available)`);
  return { result, backup };
}
```

### Pattern 4: Conditional Archiving

Archive based on complex conditions:

```javascript
async function conditionalArchive() {
  const graph = await read_graph();

  const toArchive = [];

  for (const entity of graph.entities) {
    let shouldArchive = false;

    // Condition 1: Old AND no relations
    const age = new Date() - new Date(entity.lastModified || entity.createdAt);
    const sixMonths = 6 * 30 * 24 * 60 * 60 * 1000;
    const hasRelations = graph.relations.some(r =>
      r.from === entity.name || r.to === entity.name
    );

    if (age > sixMonths && !hasRelations) {
      shouldArchive = true;
    }

    // Condition 2: Low importance AND no children
    const hasChildren = graph.entities.some(e => e.parentId === entity.name);
    if ((entity.importance || 0) < 3 && !hasChildren) {
      shouldArchive = true;
    }

    // Condition 3: Tagged for manual archiving
    if (entity.tags?.includes("manual-archive")) {
      shouldArchive = true;
    }

    if (shouldArchive) {
      toArchive.push(entity.name);
    }
  }

  console.log(`Conditional archive: ${toArchive.length} entities`);

  // Tag and archive
  await add_tags_to_multiple({ entityNames: toArchive, tags: ["auto-archive"] });
  await archive_entities({ tags: ["auto-archive"] }, false);
}
```

---

## Troubleshooting

### Issue: Archived Too Much

**Problem:** Archived entities that should have been kept.

**Solution:** There is no built-in restore function. You need to manually restore from `archive.jsonl`:

```javascript
// Read archive.jsonl manually
// Find entities to restore
// Use create_entities to recreate them in active graph
// Manually recreate relations if needed

// Prevention: ALWAYS preview with dryRun: true first!
```

### Issue: Important Entities Archived

**Problem:** Critical entities were archived due to low importance or old age.

**Solution:** Set high importance on critical entities:

```javascript
// Protect critical entities
const critical = ["Core System", "Main Database", "Primary API"];

for (const entityName of critical) {
  await set_importance({ entityName, importance: 10 });
}

// Add protection tag
await add_tags_to_multiple({
  entityNames: critical,
  tags: ["protected", "critical"]
});

// Exclude protected entities from archiving
// (You'll need to manually filter these in your archiving logic)
```

### Issue: Archiving is Too Slow

**Problem:** `archive_entities` takes too long on large graphs.

**Solution:** Use more specific criteria or batch archiving:

```javascript
// Option 1: More specific criteria
await archive_entities({
  tags: ["completed"],  // Targets specific subset
  importanceLessThan: 3
}, false);

// Option 2: Archive by type
const types = ["task", "note", "draft"];
for (const type of types) {
  const entities = await search_nodes({ query: "", entityType: type });
  const oldEntities = entities.filter(e => {
    const age = new Date() - new Date(e.lastModified || e.createdAt);
    return age > 6 * 30 * 24 * 60 * 60 * 1000;  // 6 months
  });

  if (oldEntities.length > 0) {
    const names = oldEntities.map(e => e.name);
    await add_tags_to_multiple({ entityNames: names, tags: ["batch-archive"] });
    await archive_entities({ tags: ["batch-archive"] }, false);
  }
}
```

### Issue: Relations Broken After Archiving

**Problem:** Entities still reference archived entities.

**Solution:** This is expected behavior. Archiving removes all relations involving archived entities. To preserve relations:

```javascript
// Option 1: Don't archive entities with important relations
const graph = await read_graph();
const entityWithRelations = graph.entities.filter(e => {
  const hasRelations = graph.relations.some(r =>
    r.from === e.name || r.to === e.name
  );
  return hasRelations && (e.importance || 0) >= 5;
});

// Exclude from archiving
await add_tags_to_multiple({
  entityNames: entityWithRelations.map(e => e.name),
  tags: ["has-relations"]
});

// Option 2: Archive related entities together
const subtree = await get_subtree({ entityName: "Project Alpha" });
await add_tags_to_multiple({
  entityNames: subtree.entities.map(e => e.name),
  tags: ["archive-together"]
});
await archive_entities({ tags: ["archive-together"] }, false);
```

---

## Integration Examples

### With Hierarchies

```javascript
// Archive completed project subtrees
const roots = await get_root_entities();

for (const root of roots) {
  if (root.tags?.includes("completed")) {
    const subtree = await get_subtree({ entityName: root.name });
    const names = subtree.entities.map(e => e.name);

    await add_tags_to_multiple({ entityNames: names, tags: ["completed-subtree"] });
    await archive_entities({ tags: ["completed-subtree"] }, false);

    console.log(`Archived completed project: ${root.name} (${names.length} entities)`);
  }
}
```

### With Search

```javascript
// Archive old search results
const results = await search_nodes({
  query: "deprecated",
  minImportance: 0,
  maxImportance: 3
});

const oldResults = results.filter(e => {
  const age = new Date() - new Date(e.lastModified || e.createdAt);
  const threeMonths = 3 * 30 * 24 * 60 * 60 * 1000;
  return age > threeMonths;
});

if (oldResults.length > 0) {
  await add_tags_to_multiple({
    entityNames: oldResults.map(e => e.name),
    tags: ["search-archive"]
  });

  await archive_entities({ tags: ["search-archive"] }, false);
}
```

### With Compression

```javascript
// Compress before archiving (maximize efficiency)
async function compressThenArchive(criteria) {
  // Step 1: Compress graph
  const compression = await compress_graph({ threshold: 0.8, dryRun: false });
  console.log(`Compressed: ${compression.entitiesMerged} entities merged`);

  // Step 2: Archive old/unimportant entities
  const archiving = await archive_entities(criteria, false);
  console.log(`Archived: ${archiving.archived} entities`);

  // Step 3: Report
  const stats = await get_graph_stats();
  console.log(`Final graph size: ${stats.totalEntities} entities`);

  return { compression, archiving, stats };
}

// Usage
await compressThenArchive({
  olderThan: "2025-01-01",
  importanceLessThan: 4
});
```

---

## Summary

Memory archiving provides lifecycle management for your knowledge graph:

✅ **Flexible**: Archive by age, importance, or tags (OR logic)
✅ **Safe**: Dry-run preview prevents accidental data loss
✅ **Clean**: Automatically removes relations to archived entities
✅ **Permanent**: Archived data stored separately for future reference
✅ **Efficient**: Keeps active memory focused and performant

**Recommended Workflow:**
1. Define archiving criteria (age, importance, tags)
2. Preview with `archive_entities(criteria, true)`
3. Review entity list carefully
4. Execute with `archive_entities(criteria, false)`
5. Validate with `validate_graph`
6. Document in audit log

**Archiving Strategies:**
- **Temporal**: Archive entities older than N months/years
- **Priority**: Archive low-importance entities
- **Status**: Archive completed, deprecated, or draft entities
- **Capacity**: Archive to maintain entity count limits
- **Hybrid**: Combine multiple criteria for intelligent archiving

**Next Steps:**
- Read [HIERARCHY_GUIDE.md](HIERARCHY_GUIDE.md) for organizing entities
- Read [COMPRESSION_GUIDE.md](COMPRESSION_GUIDE.md) for duplicate detection
- Read [QUERY_LANGUAGE.md](QUERY_LANGUAGE.md) for advanced search
- See [API Reference](README.md#api-reference) for complete tool documentation
