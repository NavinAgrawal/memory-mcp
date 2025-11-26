# Query Language Reference
## Boolean Search Syntax for Advanced Queries

**Version:** 0.8.0
**Last Updated:** 2025-11-23

---

## Table of Contents

1. [Overview](#overview)
2. [Basic Syntax](#basic-syntax)
3. [Logical Operators](#logical-operators)
4. [Field-Specific Search](#field-specific-search)
5. [Quoted Strings](#quoted-strings)
6. [Operator Precedence](#operator-precedence)
7. [Query Examples](#query-examples)
8. [Common Patterns](#common-patterns)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The boolean search feature provides a powerful query language for finding entities using logical expressions. Instead of simple keyword matching, you can construct complex queries with AND, OR, NOT operators, field-specific searches, and exact phrase matching.

### Key Features

- ✅ **Logical Operators**: AND, OR, NOT for combining search terms
- ✅ **Parentheses**: Group expressions for complex logic
- ✅ **Field-Specific**: Search in specific fields (name, type, observation, tag)
- ✅ **Quoted Strings**: Exact phrase matching
- ✅ **Case-Insensitive**: All searches ignore case
- ✅ **Recursive Parser**: Handles deeply nested expressions

### When to Use Boolean Search

| Use Case | Tool | Example |
|----------|------|---------|
| Simple keyword | `search_nodes` | Find entities with "project" |
| Typo-tolerant | `fuzzy_search` | Find "projct" → "project" |
| Relevance ranking | `search_nodes_ranked` | Best matches for "machine learning" |
| **Complex logic** | `boolean_search` | "project AND (frontend OR backend) NOT deprecated" |

---

## Basic Syntax

### Simple Terms

Search for a single term:

```
project
```

**Matches:** Any entity with "project" in name, type, observations, or tags

### Multiple Terms (Implicit AND)

Space-separated terms are implicitly joined with AND:

```
machine learning
```

**Equivalent to:** `machine AND learning`

**Matches:** Entities containing BOTH "machine" AND "learning"

### Case Insensitivity

All searches are case-insensitive:

```
PROJECT = project = Project = PrOjEcT
```

---

## Logical Operators

### AND Operator

Requires BOTH terms to match:

```
frontend AND react
```

**Matches:**
- ✅ "React Frontend Project"
- ✅ Entity with observations: ["Frontend development", "Using React"]
- ❌ "Frontend Vue Project" (no "react")
- ❌ "React Native Mobile" (no "frontend")

**Syntax:**
```
term1 AND term2
term1 && term2      (NOT supported)
term1 term2         (implicit AND)
```

---

### OR Operator

Requires AT LEAST ONE term to match:

```
frontend OR backend
```

**Matches:**
- ✅ "Frontend Development"
- ✅ "Backend API"
- ✅ "Full Stack Frontend and Backend" (both)
- ❌ "Mobile Application" (neither)

**Syntax:**
```
term1 OR term2
term1 || term2      (NOT supported)
```

---

### NOT Operator

Excludes entities matching the term:

```
project NOT deprecated
```

**Matches:**
- ✅ "Active Project"
- ✅ "New Project Alpha"
- ❌ "Deprecated Project" (contains "deprecated")
- ❌ "Old Deprecated System" (contains "deprecated")

**Syntax:**
```
NOT term
!term               (NOT supported)
-term               (NOT supported)
```

**Important:** NOT must be followed by a term or expression:
```
✅ NOT deprecated
✅ NOT (old OR obsolete)
❌ project AND NOT       (invalid - nothing after NOT)
```

---

## Field-Specific Search

### Syntax

Search in specific fields using `field:term` syntax:

```
name:project
type:task
observation:"bug fix"
tag:urgent
```

**Available fields:**
- `name:` - Entity name only
- `type:` - Entity type only
- `observation:` - Observations only
- `tag:` - Tags only

### Examples

#### Search by Name

```
name:alpha
```

**Matches:**
- ✅ Name: "Project Alpha"
- ✅ Name: "Alpha Version"
- ❌ Name: "Project Beta", Observation: "Alpha release" (not in name)

#### Search by Type

```
type:project
```

**Matches:** All entities with `entityType === "project"`

#### Search by Observation

```
observation:bug
```

**Matches:** Entities with "bug" in ANY observation

#### Search by Tag

```
tag:urgent
```

**Matches:** Entities with "urgent" tag

### Combining Field Searches

```
type:project AND tag:urgent
```

**Matches:** Urgent projects only

```
name:api OR type:api
```

**Matches:** Entities with "api" in name OR type "api"

```
observation:"bug fix" AND NOT tag:completed
```

**Matches:** Bug fix observations that aren't completed

---

## Quoted Strings

### Exact Phrase Matching

Use quotes for exact multi-word phrases:

```
"machine learning"
```

**Matches:**
- ✅ "Machine Learning Project"
- ✅ Observation: "Uses machine learning algorithms"
- ❌ "Machine intelligence and deep learning" (not exact phrase)

### With Field Specifiers

```
observation:"bug fix"
```

**Matches:** Observations containing exact phrase "bug fix"

```
name:"Project Alpha"
```

**Matches:** Entities with exact name "Project Alpha"

### Escaping Quotes

To include quotes within quoted strings, escape with backslash:

```
"The \"Best\" Project"
```

**Matches:** Entities containing `The "Best" Project`

---

## Operator Precedence

Operators are evaluated in this order (highest to lowest):

1. **Parentheses** `( )`
2. **NOT**
3. **AND**
4. **OR**

### Examples

```
A AND B OR C
```

**Evaluated as:** `(A AND B) OR C`

**Matches:** (A and B) or C

---

```
A OR B AND C
```

**Evaluated as:** `A OR (B AND C)`

**Matches:** A or (B and C)

---

```
NOT A AND B
```

**Evaluated as:** `(NOT A) AND B`

**Matches:** Not A, but B

---

### Using Parentheses

Override precedence with parentheses:

```
(A OR B) AND C
```

**Matches:** (A or B) and C

```
NOT (A OR B)
```

**Matches:** Neither A nor B

```
(frontend OR backend) AND (react OR vue) NOT deprecated
```

**Evaluated as:** `((frontend OR backend) AND (react OR vue)) AND (NOT deprecated)`

**Matches:** Entities that are:
- (Frontend OR Backend) AND
- (React OR Vue) AND
- NOT Deprecated

---

## Query Examples

### Example 1: Find Active Projects

```
type:project NOT tag:completed NOT tag:deprecated
```

**Finds:** Projects that are not completed or deprecated

---

### Example 2: Find Frontend or Backend Tasks

```
type:task AND (observation:frontend OR observation:backend)
```

**Finds:** Tasks mentioning frontend or backend in observations

---

### Example 3: Find Urgent or High Priority

```
tag:urgent OR tag:high-priority
```

**Finds:** Entities tagged as urgent or high-priority

---

### Example 4: Find API Documentation

```
name:api AND type:document
```

**Finds:** Documents with "api" in the name

---

### Example 5: Find Bug Fixes Not Completed

```
observation:"bug fix" NOT tag:completed
```

**Finds:** Entities with bug fix observations that aren't completed

---

### Example 6: Complex Project Search

```
type:project AND (tag:frontend OR tag:backend) AND NOT (tag:deprecated OR tag:on-hold)
```

**Finds:** Projects that are:
- Type "project" AND
- Tagged as frontend OR backend AND
- NOT deprecated AND NOT on-hold

---

### Example 7: Find React or Vue Projects

```
(name:react OR observation:react OR tag:react) AND type:project
OR
(name:vue OR observation:vue OR tag:vue) AND type:project
```

**Finds:** Projects mentioning React or Vue in any field

---

### Example 8: Exclude Test Data

```
machine learning NOT (tag:test OR tag:draft OR name:test)
```

**Finds:** Machine learning entities that aren't test/draft data

---

## Common Patterns

### Pattern 1: Technology Stack Search

Find entities using specific technologies:

```
(react OR vue OR angular) AND (typescript OR javascript)
```

**Use Case:** Find frontend projects using modern frameworks

---

### Pattern 2: Status Filtering

Find entities in specific states:

```
type:task AND tag:in-progress NOT tag:blocked
```

**Use Case:** Find active, unblocked tasks

---

### Pattern 3: Priority Filtering

Find high-priority work:

```
(tag:urgent OR tag:high-priority) AND NOT tag:completed
```

**Use Case:** Focus on important incomplete work

---

### Pattern 4: Multi-Domain Search

Search across multiple domains:

```
(type:project OR type:feature OR type:epic) AND observation:authentication
```

**Use Case:** Find all work items related to authentication

---

### Pattern 5: Exclusion Search

Find entities NOT matching criteria:

```
type:project NOT (tag:archived OR tag:deprecated OR tag:on-hold)
```

**Use Case:** Find only active projects

---

### Pattern 6: Exact Name Matching

Find entities with exact names:

```
name:"Project Alpha" OR name:"Project Beta"
```

**Use Case:** Find specific named entities

---

### Pattern 7: Composite Field Search

Search across multiple fields for same term:

```
api AND (name:api OR type:api OR observation:api)
```

**Simplified:** Just use `api` (searches all fields by default)

**Use when:** You need explicit field matching

---

### Pattern 8: Tag Combination Search

Find entities with specific tag combinations:

```
tag:frontend AND tag:react AND NOT tag:legacy
```

**Use Case:** Find modern frontend React projects

---

## Best Practices

### 1. Start Simple, Add Complexity

Build queries incrementally:

```
# Step 1: Basic search
project

# Step 2: Add type filter
type:project

# Step 3: Add status filter
type:project NOT tag:completed

# Step 4: Add priority filter
type:project NOT tag:completed AND (tag:urgent OR tag:high-priority)
```

### 2. Use Parentheses for Clarity

Even when not required, parentheses improve readability:

```
❌ Hard to read:
A AND B OR C AND D NOT E

✅ Clear:
(A AND B) OR (C AND D AND NOT E)
```

### 3. Field-Specific When Possible

Be specific to improve precision:

```
❌ Broad:
api

✅ Precise:
name:api OR type:api

✅ Very precise:
type:api AND tag:rest
```

### 4. Combine with Other Search Tools

Use the right tool for the job:

```javascript
// Simple search: use search_nodes
await search_nodes({ query: "project" })

// Typo-tolerant: use fuzzy_search
await fuzzy_search({ query: "projct", threshold: 0.8 })

// Ranked results: use search_nodes_ranked
await search_nodes_ranked({ query: "machine learning", limit: 10 })

// Complex logic: use boolean_search
await boolean_search({ query: "type:project AND (frontend OR backend) NOT deprecated" })
```

### 5. Test Queries Incrementally

Verify each part of complex queries:

```javascript
// Test parts separately
await boolean_search({ query: "frontend OR backend" })
await boolean_search({ query: "type:project" })
await boolean_search({ query: "NOT deprecated" })

// Combine after verification
await boolean_search({
  query: "type:project AND (frontend OR backend) NOT deprecated"
})
```

### 6. Save Complex Queries

Use saved searches for frequently used queries:

```javascript
// Save complex query
await save_search({
  name: "Active Frontend Projects",
  query: "type:project AND tag:frontend NOT (tag:completed OR tag:deprecated)",
  description: "All active frontend projects"
})

// Execute later
await execute_saved_search({ name: "Active Frontend Projects" })
```

---

## Troubleshooting

### Issue: No Results Found

**Problem:** Query returns empty results

**Solutions:**

1. **Simplify query** - Remove operators one by one:
```javascript
// Original (no results)
boolean_search({ query: "type:project AND frontend AND react NOT deprecated" })

// Simplify
boolean_search({ query: "type:project" })  // Does this work?
boolean_search({ query: "frontend" })       // Does this work?
```

2. **Check field names** - Ensure field specifiers are correct:
```javascript
❌ boolean_search({ query: "entityType:project" })  // Wrong field name
✅ boolean_search({ query: "type:project" })        // Correct
```

3. **Check spelling** - Use fuzzy search first:
```javascript
await fuzzy_search({ query: "fronted" })  // Suggests "frontend"
```

---

### Issue: Too Many Results

**Problem:** Query is too broad

**Solutions:**

1. **Add more constraints**:
```javascript
// Too broad
boolean_search({ query: "project" })

// More specific
boolean_search({ query: "type:project AND tag:active" })

// Very specific
boolean_search({
  query: "type:project AND tag:active AND NOT tag:on-hold AND observation:react"
})
```

2. **Use field-specific searches**:
```javascript
// Searches all fields (broad)
boolean_search({ query: "api" })

// Only in name (narrow)
boolean_search({ query: "name:api" })
```

---

### Issue: Syntax Error

**Problem:** Query parser fails

**Common causes:**

1. **Unclosed quotes**:
```javascript
❌ boolean_search({ query: "machine learning" })  // Missing closing quote
✅ boolean_search({ query: "\"machine learning\"" })
```

2. **Invalid field names**:
```javascript
❌ boolean_search({ query: "title:project" })    // No "title" field
✅ boolean_search({ query: "name:project" })
```

3. **Dangling operators**:
```javascript
❌ boolean_search({ query: "project AND" })      // Nothing after AND
✅ boolean_search({ query: "project AND task" })
```

4. **Mismatched parentheses**:
```javascript
❌ boolean_search({ query: "(frontend OR backend" })  // Missing )
✅ boolean_search({ query: "(frontend OR backend)" })
```

---

### Issue: Unexpected Results

**Problem:** Results don't match expectations

**Debug steps:**

1. **Check operator precedence**:
```javascript
// Query: A OR B AND C
// Evaluated as: A OR (B AND C)
// NOT as: (A OR B) AND C

// Use parentheses to control:
boolean_search({ query: "(A OR B) AND C" })
```

2. **Verify field matching**:
```javascript
// Get entity details
const results = await boolean_search({ query: "your query" })
const details = await open_nodes({ names: results.map(e => e.name) })
console.log(details)  // Check why each entity matched
```

3. **Test with simple queries**:
```javascript
// Does the entity match this?
await boolean_search({ query: "frontend" })

// Does it match this?
await boolean_search({ query: "type:project" })

// Why doesn't it match the combination?
await boolean_search({ query: "type:project AND frontend" })
```

---

### Issue: Query is Slow

**Problem:** Complex query takes too long

**Solutions:**

1. **Simplify query** - Reduce complexity:
```javascript
// Complex (slow)
boolean_search({
  query: "(A OR B OR C OR D) AND (E OR F OR G OR H) AND NOT (I OR J OR K)"
})

// Simplified (faster)
boolean_search({ query: "(A OR B) AND E NOT I" })
```

2. **Use other search tools** - Boolean search evaluates every entity:
```javascript
// If you just need keyword matching, use search_nodes
await search_nodes({ query: "project" })

// If you need ranking, use search_nodes_ranked
await search_nodes_ranked({ query: "machine learning" })
```

3. **Filter before searching** - Combine with other filters:
```javascript
// Filter by tags first, then boolean search
const tagged = await search_nodes({ query: "", tags: ["active"] })
// Then manually apply boolean logic to this smaller set
```

---

## Integration Examples

### With Saved Searches

```javascript
// Save complex boolean query
await save_search({
  name: "Active Backend APIs",
  query: "type:api AND tag:backend AND NOT (tag:deprecated OR tag:draft)",
  description: "Production backend APIs only"
})

// Execute saved search
const results = await execute_saved_search({
  name: "Active Backend APIs"
})

console.log(`Found ${results.length} active backend APIs`)
```

---

### With Tags

```javascript
// Find entities to tag
const results = await boolean_search({
  query: "type:project AND observation:\"machine learning\" NOT tag:ml"
})

// Tag them
await add_tags_to_multiple({
  entityNames: results.map(e => e.name),
  tags: ["ml", "machine-learning"]
})

console.log(`Tagged ${results.length} machine learning projects`)
```

---

### With Hierarchies

```javascript
// Find projects with active children
const projects = await boolean_search({
  query: "type:project NOT tag:completed"
})

for (const project of projects) {
  const children = await get_children({ entityName: project.name })

  const activeChildren = children.filter(child =>
    !child.tags?.includes("completed")
  )

  if (activeChildren.length > 0) {
    console.log(`${project.name}: ${activeChildren.length} active children`)
  }
}
```

---

### With Export

```javascript
// Export search results
const results = await boolean_search({
  query: "type:project AND tag:2025-q1 NOT tag:cancelled"
})

// Export just these entities
const entityNames = results.map(e => e.name)
const subtrees = await Promise.all(
  entityNames.map(name => get_subtree({ entityName: name }))
)

// Combine and export
// (Export logic depends on your needs)
```

---

## Advanced Query Patterns

### Pattern 1: Multi-Condition OR

Find entities matching ANY of several complete conditions:

```
(type:project AND tag:urgent)
OR
(type:task AND tag:high-priority)
OR
(type:bug AND tag:critical)
```

**Use Case:** Find all high-priority work across different types

---

### Pattern 2: Nested Exclusions

Complex exclusion logic:

```
type:project NOT (
  tag:completed OR
  tag:cancelled OR
  (tag:on-hold AND NOT tag:urgent)
)
```

**Use Case:** Find active projects, including urgent ones on hold

---

### Pattern 3: Field Combination Matrix

Search multiple terms across multiple fields:

```
(name:api OR type:api OR observation:api OR tag:api)
AND
(name:rest OR observation:rest OR tag:rest)
```

**Use Case:** Find REST APIs mentioned anywhere

---

### Pattern 4: Temporal + Status

Combine with other search filters:

```javascript
// Boolean search for type
const results = await boolean_search({
  query: "type:project AND tag:active"
})

// Further filter by date
const sixMonthsAgo = new Date()
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

const recentActive = results.filter(e => {
  const lastModified = new Date(e.lastModified || e.createdAt)
  return lastModified > sixMonthsAgo
})

console.log(`${recentActive.length} recently active projects`)
```

---

## Summary

Boolean search provides powerful query capabilities:

✅ **Logical Operators**: AND, OR, NOT for complex logic
✅ **Field-Specific**: Search name, type, observation, tag fields
✅ **Quoted Strings**: Exact phrase matching
✅ **Parentheses**: Group expressions for precedence control
✅ **Case-Insensitive**: Flexible matching
✅ **Recursive Parser**: Handle deeply nested queries

**Query Template:**
```
[field:]term [AND|OR] [field:]term [NOT] [field:]term
```

**Operator Precedence:**
1. Parentheses `( )`
2. NOT
3. AND
4. OR

**Best Practices:**
1. Start simple, add complexity incrementally
2. Use parentheses for clarity
3. Be field-specific when possible
4. Test queries incrementally
5. Save complex queries for reuse
6. Combine with other search tools

**Next Steps:**
- Read [HIERARCHY_GUIDE.md](HIERARCHY_GUIDE.md) for organizing entities
- Read [COMPRESSION_GUIDE.md](COMPRESSION_GUIDE.md) for duplicate detection
- Read [ARCHIVING_GUIDE.md](ARCHIVING_GUIDE.md) for memory lifecycle
- See [API Reference](README.md#api-reference) for complete tool documentation
