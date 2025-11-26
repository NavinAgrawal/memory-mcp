# Hierarchical Nesting Guide
## Organizing Knowledge with Parent-Child Relationships

**Version:** 0.8.0
**Last Updated:** 2025-11-23

---

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Getting Started](#getting-started)
4. [Common Use Cases](#common-use-cases)
5. [Tool Reference](#tool-reference)
6. [Best Practices](#best-practices)
7. [Advanced Patterns](#advanced-patterns)
8. [Troubleshooting](#troubleshooting)

---

## Overview

Hierarchical nesting enables you to organize entities in tree-like structures with parent-child relationships. This is perfect for representing:

- **Project hierarchies**: Projects → Features → Tasks → Subtasks
- **Document organization**: Folders → Subfolders → Files → Sections
- **Knowledge categories**: Domains → Topics → Concepts → Details
- **Organizational structures**: Companies → Departments → Teams → Members

### Key Features

- ✅ **Arbitrary depth**: No limit on hierarchy levels
- ✅ **Cycle detection**: Prevents circular parent-child relationships
- ✅ **Tree navigation**: Navigate up (ancestors) or down (descendants)
- ✅ **Subtree extraction**: Get entire branches with relations
- ✅ **Depth calculation**: Automatic hierarchy level tracking

---

## Core Concepts

### Parent-Child Relationships

Every entity can have:
- **One parent** (or none for root entities)
- **Multiple children** (unlimited)

```
Project Alpha (root, depth 0)
├── Feature Authentication (child, depth 1)
│   ├── Task: Login UI (child, depth 2)
│   └── Task: Password Reset (child, depth 2)
└── Feature Dashboard (child, depth 1)
    └── Task: Charts Widget (child, depth 2)
```

### The `parentId` Field

Entities now have an optional `parentId` field:

```typescript
interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  parentId?: string;  // References parent entity name
  // ... other fields
}
```

### Cycle Detection

The system automatically prevents cycles:

```
❌ INVALID: A → B → C → A (creates cycle)
✅ VALID:   A → B → C
```

---

## Getting Started

### Example 1: Simple Project Structure

```javascript
// 1. Create root entity (project)
create_entities({
  entities: [{
    name: "Project Alpha",
    entityType: "project",
    observations: ["Web application rewrite"]
  }]
})

// 2. Create child entities (features)
create_entities({
  entities: [
    {
      name: "Authentication Feature",
      entityType: "feature",
      observations: ["User login and registration"]
    },
    {
      name: "Dashboard Feature",
      entityType: "feature",
      observations: ["Main application dashboard"]
    }
  ]
})

// 3. Set parent relationships
set_entity_parent({
  entityName: "Authentication Feature",
  parentName: "Project Alpha"
})

set_entity_parent({
  entityName: "Dashboard Feature",
  parentName: "Project Alpha"
})

// 4. Verify hierarchy
get_children({ entityName: "Project Alpha" })
// Returns: ["Authentication Feature", "Dashboard Feature"]
```

### Example 2: Document Organization

```javascript
// Create folder structure
create_entities({
  entities: [
    { name: "Documentation", entityType: "folder", observations: ["Root docs"] },
    { name: "API Reference", entityType: "folder", observations: ["API docs"] },
    { name: "REST API", entityType: "document", observations: ["REST endpoints"] },
    { name: "GraphQL API", entityType: "document", observations: ["GraphQL schema"] }
  ]
})

// Build hierarchy
set_entity_parent({ entityName: "API Reference", parentName: "Documentation" })
set_entity_parent({ entityName: "REST API", parentName: "API Reference" })
set_entity_parent({ entityName: "GraphQL API", parentName: "API Reference" })

// Get entire documentation tree
get_subtree({ entityName: "Documentation" })
```

---

## Common Use Cases

### Use Case 1: Project Management

**Structure:**
```
Project
├── Epic
│   ├── Story
│   │   ├── Task
│   │   │   └── Subtask
```

**Implementation:**
```javascript
// Create hierarchy
const entities = [
  { name: "Q4 Initiative", entityType: "project" },
  { name: "User Management Epic", entityType: "epic" },
  { name: "Profile Page Story", entityType: "story" },
  { name: "Design Profile UI", entityType: "task" },
  { name: "Create Wireframes", entityType: "subtask" }
];

// Set relationships
set_entity_parent({ entityName: "User Management Epic", parentName: "Q4 Initiative" })
set_entity_parent({ entityName: "Profile Page Story", parentName: "User Management Epic" })
set_entity_parent({ entityName: "Design Profile UI", parentName: "Profile Page Story" })
set_entity_parent({ entityName: "Create Wireframes", parentName: "Design Profile UI" })

// Navigate
get_ancestors({ entityName: "Create Wireframes" })
// Returns path: [Design Profile UI, Profile Page Story, User Management Epic, Q4 Initiative]

get_entity_depth({ entityName: "Create Wireframes" })
// Returns: { entityName: "Create Wireframes", depth: 4 }
```

### Use Case 2: Knowledge Organization

**Structure:**
```
Computer Science
├── Algorithms
│   ├── Sorting
│   │   ├── Quick Sort
│   │   └── Merge Sort
│   └── Searching
│       ├── Binary Search
│       └── Linear Search
└── Data Structures
    ├── Arrays
    └── Trees
```

**Implementation:**
```javascript
// Create knowledge hierarchy
const knowledge = [
  { name: "Computer Science", entityType: "domain" },
  { name: "Algorithms", entityType: "topic" },
  { name: "Sorting", entityType: "category" },
  { name: "Quick Sort", entityType: "concept" },
  { name: "Merge Sort", entityType: "concept" }
];

// Build hierarchy
set_entity_parent({ entityName: "Algorithms", parentName: "Computer Science" })
set_entity_parent({ entityName: "Sorting", parentName: "Algorithms" })
set_entity_parent({ entityName: "Quick Sort", parentName: "Sorting" })
set_entity_parent({ entityName: "Merge Sort", parentName: "Sorting" })

// Get all sorting algorithms
get_children({ entityName: "Sorting" })
// Returns: ["Quick Sort", "Merge Sort"]
```

### Use Case 3: Organizational Structure

**Structure:**
```
Company
├── Engineering
│   ├── Backend Team
│   │   ├── Alice (Engineer)
│   │   └── Bob (Engineer)
│   └── Frontend Team
│       └── Carol (Engineer)
└── Design
    └── Design Team
        └── David (Designer)
```

**Implementation:**
```javascript
// Create org structure
create_entities({
  entities: [
    { name: "TechCorp", entityType: "company" },
    { name: "Engineering", entityType: "department" },
    { name: "Backend Team", entityType: "team" },
    { name: "Alice", entityType: "person", observations: ["Senior Backend Engineer"] }
  ]
})

// Set relationships
set_entity_parent({ entityName: "Engineering", parentName: "TechCorp" })
set_entity_parent({ entityName: "Backend Team", parentName: "Engineering" })
set_entity_parent({ entityName: "Alice", parentName: "Backend Team" })

// Find Alice's department
get_ancestors({ entityName: "Alice" })
// Returns: [Backend Team, Engineering, TechCorp]

// Get all engineers in Engineering
get_descendants({ entityName: "Engineering" })
// Returns all entities under Engineering
```

---

## Tool Reference

### `set_entity_parent`
Set or remove parent relationship.

```javascript
// Set parent
set_entity_parent({
  entityName: "Task A",
  parentName: "Project Alpha"
})

// Remove parent (make root)
set_entity_parent({
  entityName: "Task A",
  parentName: null
})
```

**Validation:**
- ✅ Both entities must exist
- ✅ Prevents cycles
- ✅ Updates `lastModified` timestamp

### `get_children`
Get immediate children.

```javascript
get_children({ entityName: "Project Alpha" })
// Returns: [Entity, Entity, ...]
```

### `get_parent`
Get parent entity.

```javascript
get_parent({ entityName: "Task A" })
// Returns: Entity or null
```

### `get_ancestors`
Get all ancestors (parent chain to root).

```javascript
get_ancestors({ entityName: "Subtask" })
// Returns: [Task, Feature, Project] (closest to furthest)
```

### `get_descendants`
Get all descendants recursively.

```javascript
get_descendants({ entityName: "Project Alpha" })
// Returns: [Feature1, Feature2, Task1, Task2, ...] (all levels)
```

### `get_subtree`
Get entity + descendants with relations.

```javascript
get_subtree({ entityName: "Project Alpha" })
// Returns: { entities: [...], relations: [...] }
```

**Use for:**
- Exporting project branches
- Analyzing isolated sections
- Filtering by subtree

### `get_root_entities`
Get all entities with no parent.

```javascript
get_root_entities({})
// Returns: [Project1, Project2, ...] (all roots)
```

### `get_entity_depth`
Get depth in hierarchy.

```javascript
get_entity_depth({ entityName: "Subtask" })
// Returns: { entityName: "Subtask", depth: 3 }
```

**Depth values:**
- `0` = Root entity
- `1` = Child of root
- `2` = Grandchild of root
- etc.

---

## Best Practices

### 1. Naming Conventions

**Use descriptive, unique names:**
```javascript
✅ GOOD: "Backend API Feature"
✅ GOOD: "User Authentication Task"
❌ BAD:  "Feature 1"
❌ BAD:  "Task"
```

### 2. Entity Types for Hierarchy

**Establish consistent type hierarchy:**
```javascript
// Project management
project → epic → story → task → subtask

// Document organization
folder → subfolder → document → section

// Knowledge base
domain → topic → category → concept → detail
```

### 3. Depth Limits

**Consider readability:**
```javascript
✅ GOOD: 3-5 levels (easy to navigate)
⚠️ CAUTION: 6-8 levels (complex but manageable)
❌ BAD: 9+ levels (difficult to visualize)
```

### 4. Moving Entities

**Use `set_entity_parent` to reorganize:**
```javascript
// Move Task from Feature A to Feature B
set_entity_parent({
  entityName: "Task X",
  parentName: "Feature B"  // Previously under Feature A
})
```

**Note:** Descendants move with parent!

### 5. Bulk Operations

**Combine with relations:**
```javascript
// Create entities
create_entities({ entities: [...] })

// Set parent relationships
set_entity_parent({ ... })
set_entity_parent({ ... })

// Add cross-hierarchy relations
create_relations({
  relations: [
    {
      from: "Task A",
      to: "Task B",
      relationType: "depends_on"
    }
  ]
})
```

---

## Advanced Patterns

### Pattern 1: Breadcrumb Navigation

```javascript
async function getBreadcrumbs(entityName) {
  const ancestors = await get_ancestors({ entityName });
  const breadcrumbs = [...ancestors.reverse(), entityName];
  return breadcrumbs.join(' → ');
}

// Usage
getBreadcrumbs("Create Wireframes")
// Returns: "Q4 Initiative → User Management Epic → Profile Page Story → Design Profile UI → Create Wireframes"
```

### Pattern 2: Tree Visualization

```javascript
async function printTree(entityName, indent = 0) {
  const entity = await open_nodes({ names: [entityName] });
  console.log('  '.repeat(indent) + '├── ' + entityName);

  const children = await get_children({ entityName });
  for (const child of children) {
    await printTree(child.name, indent + 1);
  }
}

// Usage
printTree("Project Alpha")
// Outputs:
// ├── Project Alpha
//   ├── Feature A
//     ├── Task 1
//     ├── Task 2
//   ├── Feature B
```

### Pattern 3: Scope Filtering

```javascript
// Get all entities in a specific project
async function getProjectScope(projectName) {
  const subtree = await get_subtree({ entityName: projectName });

  // Filter by entity type
  const tasks = subtree.entities.filter(e => e.entityType === 'task');
  const features = subtree.entities.filter(e => e.entityType === 'feature');

  return { tasks, features };
}
```

### Pattern 4: Level-Based Queries

```javascript
// Get all entities at a specific depth
async function getEntitiesAtLevel(level) {
  const allRoots = await get_root_entities({});
  const results = [];

  for (const root of allRoots) {
    const descendants = await get_descendants({ entityName: root.name });

    for (const entity of descendants) {
      const depth = await get_entity_depth({ entityName: entity.name });
      if (depth.depth === level) {
        results.push(entity);
      }
    }
  }

  return results;
}

// Get all level-2 entities (e.g., all features across all projects)
getEntitiesAtLevel(2)
```

---

## Troubleshooting

### Error: "Would create a cycle"

**Problem:** Trying to create circular parent-child relationships.

```javascript
// ❌ This fails:
set_entity_parent({ entityName: "A", parentName: "B" })
set_entity_parent({ entityName: "B", parentName: "C" })
set_entity_parent({ entityName: "C", parentName: "A" })  // ERROR: Cycle!
```

**Solution:** Ensure parent-child relationships form a tree (no cycles).

### Error: "Entity not found"

**Problem:** Parent or child entity doesn't exist.

```javascript
// ❌ This fails if "Feature X" doesn't exist:
set_entity_parent({ entityName: "Task A", parentName: "Feature X" })
```

**Solution:** Create entities before setting parent relationships.

```javascript
// ✅ Correct order:
create_entities({ entities: [{ name: "Feature X", ... }] })
set_entity_parent({ entityName: "Task A", parentName: "Feature X" })
```

### Issue: Lost Relationships After Move

**Problem:** Entity has many relations, worried about losing them when changing parent.

**Answer:** Relations are preserved! Only parent-child link changes.

```javascript
// Task A has relations to Task B, Task C
set_entity_parent({ entityName: "Task A", parentName: "New Parent" })
// Relations to B and C are still intact
```

### Issue: Can't Find Root Entities

**Solution:** Use `get_root_entities` to find all top-level entities.

```javascript
const roots = await get_root_entities({});
console.log("Top-level entities:", roots.map(e => e.name));
```

---

## Integration Examples

### With Search

```javascript
// Find all tasks under "Project Alpha"
const subtree = await get_subtree({ entityName: "Project Alpha" });
const tasks = await search_nodes({
  query: "design",
  // Search only within project subtree by filtering results
});
```

### With Tags

```javascript
// Tag entire project branch
const subtree = await get_subtree({ entityName: "Project Alpha" });
const entityNames = subtree.entities.map(e => e.name);

await add_tags_to_multiple({
  entityNames,
  tags: ["q4-2025", "high-priority"]
});
```

### With Export

```javascript
// Export specific project branch
const subtree = await get_subtree({ entityName: "Project Alpha" });

// Export as Markdown
await export_graph({
  format: "markdown",
  filter: { /* apply subtree filter */ }
});
```

---

## Summary

Hierarchical nesting provides powerful organization capabilities:

✅ **Easy to use:** Simple parent-child relationships
✅ **Safe:** Automatic cycle detection
✅ **Flexible:** Arbitrary depth, multiple roots
✅ **Navigable:** Rich navigation tools (ancestors, descendants, subtrees)
✅ **Integrated:** Works with search, tags, export, and all other features

**Next Steps:**
- Read [COMPRESSION_GUIDE.md](COMPRESSION_GUIDE.md) for duplicate detection
- Read [QUERY_LANGUAGE.md](QUERY_LANGUAGE.md) for advanced search
- See [API Reference](README.md#api-reference) for complete tool documentation
