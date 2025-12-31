# Memory MCP - API Reference

**Version**: 0.58.0
**Last Updated**: 2025-12-30

Complete reference for all 47 MCP tools provided by the Memory MCP server.

---

## Table of Contents

1. [Entity Operations](#entity-operations) (4 tools)
2. [Relation Operations](#relation-operations) (2 tools)
3. [Observation Management](#observation-management) (2 tools)
4. [Search Operations](#search-operations) (6 tools)
5. [Saved Searches](#saved-searches) (5 tools)
6. [Tag Management](#tag-management) (6 tools)
7. [Tag Aliases](#tag-aliases) (5 tools)
8. [Hierarchy Operations](#hierarchy-operations) (9 tools)
9. [Analytics](#analytics) (2 tools)
10. [Compression & Deduplication](#compression--deduplication) (4 tools)
11. [Import/Export Operations](#importexport-operations) (2 tools)

---

## Entity Operations

### create_entities

Create one or more entities in the knowledge graph.

**Parameters:**
```typescript
{
  entities: Array<{
    name: string;              // Unique identifier (1-500 chars)
    entityType: string;        // Category (1-100 chars)
    observations: string[];    // Descriptions (1-5000 chars each)
    tags?: string[];           // Optional tags (normalized to lowercase)
    importance?: number;       // Optional priority (0-10, integer)
    parentId?: string;         // Optional parent entity name
  }>
}
```

**Returns:**
```typescript
{
  entities: Entity[];  // Array of created entities with timestamps
}
```

**Example:**
```json
{
  "entities": [
    {
      "name": "Alice",
      "entityType": "person",
      "observations": ["Software engineer", "Works on AI projects"],
      "tags": ["team", "engineering"],
      "importance": 8
    }
  ]
}
```

**Validation:**
- Maximum 1000 entities per batch
- Entity names must be unique
- Duplicate entities are filtered out
- Tags normalized to lowercase
- Automatic timestamp generation

---

### delete_entities

Delete one or more entities from the knowledge graph.

**Parameters:**
```typescript
{
  entityNames: string[];  // Array of entity names to delete
}
```

**Returns:**
```typescript
{
  deletedCount: number;  // Number of entities deleted
}
```

**Notes:**
- Maximum 1000 entities per batch
- Relations involving deleted entities are also removed
- Child entities remain but lose their parent reference

**Example:**
```json
{
  "entityNames": ["Alice", "Bob"]
}
```

---

### read_graph

Read the entire knowledge graph.

**Parameters:** None

**Returns:**
```typescript
{
  entities: Entity[];
  relations: Relation[];
}
```

**Notes:**
- Returns complete graph data
- Use with caution on large graphs
- Consider using search operations for filtered access

---

### open_nodes

Retrieve specific entities by name with their relations.

**Parameters:**
```typescript
{
  names: string[];  // Entity names to retrieve
}
```

**Returns:**
```typescript
{
  entities: Entity[];
  relations: Relation[];  // Relations between opened entities
}
```

**Notes:**
- Only returns relations where BOTH from and to are in the list
- Useful for graph visualization
- Guaranteed to return results for existing entities

**Example:**
```json
{
  "names": ["Alice", "Bob", "Project_X"]
}
```

---

## Relation Operations

### create_relations

Create one or more relations between entities.

**Parameters:**
```typescript
{
  relations: Array<{
    from: string;           // Source entity name
    to: string;             // Target entity name
    relationType: string;   // Relation type (1-100 chars)
  }>
}
```

**Returns:**
```typescript
{
  relations: Relation[];  // Created relations with timestamps
}
```

**Notes:**
- Maximum 1000 relations per batch
- Duplicate relations filtered out
- Deferred integrity: entities don't need to exist
- Automatic timestamp generation

**Example:**
```json
{
  "relations": [
    { "from": "Alice", "to": "Project_X", "relationType": "works_on" },
    { "from": "Alice", "to": "Bob", "relationType": "mentors" }
  ]
}
```

---

### delete_relations

Delete one or more relations from the knowledge graph.

**Parameters:**
```typescript
{
  relations: Array<{
    from: string;
    to: string;
    relationType: string;
  }>
}
```

**Returns:**
```typescript
{
  deletedCount: number;
}
```

**Notes:**
- Maximum 1000 relations per batch
- Non-existent relations silently ignored

**Example:**
```json
{
  "relations": [
    { "from": "Alice", "to": "Project_X", "relationType": "works_on" }
  ]
}
```

---

## Observation Management

### add_observations

Add observations to existing entities.

**Parameters:**
```typescript
{
  observations: Array<{
    entityName: string;
    contents: string[];  // New observations to add
  }>
}
```

**Returns:**
```typescript
{
  results: Array<{
    entityName: string;
    addedObservations: string[];
  }>
}
```

**Notes:**
- Observations are appended, not replaced
- Duplicate observations within the same request are filtered
- `lastModified` automatically updated

**Example:**
```json
{
  "observations": [
    {
      "entityName": "Alice",
      "contents": ["Led project Alpha", "Promoted to senior engineer"]
    }
  ]
}
```

---

### delete_observations

Remove specific observations from entities.

**Parameters:**
```typescript
{
  deletions: Array<{
    entityName: string;
    observations: string[];  // Observations to remove (exact match)
  }>
}
```

**Returns:**
```typescript
{
  results: Array<{
    entityName: string;
    deletedObservations: string[];
  }>
}
```

**Example:**
```json
{
  "deletions": [
    {
      "entityName": "Alice",
      "observations": ["Old observation to remove"]
    }
  ]
}
```

---

## Search Operations

### search_nodes

Basic text search with optional filters.

**Parameters:**
```typescript
{
  query: string;              // Search query
  tags?: string[];            // Filter by tags
  minImportance?: number;     // Minimum importance
  maxImportance?: number;     // Maximum importance
}
```

**Returns:**
```typescript
{
  entities: Entity[];
  relations: Relation[];
}
```

**Search Scope:**
- Entity names
- Entity types
- Observations

**Performance:** <100ms for 500 entities

**Example:**
```json
{
  "query": "engineering",
  "tags": ["team"],
  "minImportance": 5
}
```

---

### search_by_date_range

Search entities by creation/modification date.

**Parameters:**
```typescript
{
  startDate?: string;         // ISO 8601 format
  endDate?: string;           // ISO 8601 format
  entityType?: string;
  tags?: string[];
}
```

**Returns:**
```typescript
{
  entities: Entity[];
  relations: Relation[];
}
```

**Notes:**
- Uses `createdAt` if available, otherwise `lastModified`
- Both dates optional (omit for open-ended ranges)

**Example:**
```json
{
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "entityType": "person"
}
```

---

### search_nodes_ranked

TF-IDF ranked search with relevance scoring.

**Parameters:**
```typescript
{
  query: string;
  tags?: string[];
  minImportance?: number;
  maxImportance?: number;
  limit?: number;              // Max results (default: 50, max: 200)
}
```

**Returns:**
```typescript
{
  results: Array<{
    entity: Entity;
    score: number;             // TF-IDF relevance score
    matchedFields: string[];   // Fields that matched
  }>
}
```

**Features:**
- TF-IDF scoring for relevance
- Results sorted by score (descending)
- Shows which fields matched

**Performance:** <600ms for 500 entities

**Example:**
```json
{
  "query": "senior software engineer",
  "tags": ["engineering"],
  "limit": 10
}
```

---

### boolean_search

Boolean query search with AND/OR/NOT operators.

**Parameters:**
```typescript
{
  query: string;              // Boolean expression
  tags?: string[];
  minImportance?: number;
  maxImportance?: number;
}
```

**Returns:**
```typescript
{
  entities: Entity[];
  relations: Relation[];
}
```

**Query Syntax:**
- `AND`: Both terms must match
- `OR`: Either term must match
- `NOT`: Term must not match
- `()`: Grouping
- `field:value`: Field-specific search (name, type, obs)

**Performance:** <150ms for 500 entities

**Examples:**
```json
{
  "query": "engineer AND (python OR javascript)"
}
```
```json
{
  "query": "type:person AND NOT contractor"
}
```

---

### fuzzy_search

Typo-tolerant search using Levenshtein distance.

**Parameters:**
```typescript
{
  query: string;
  threshold?: number;         // 0.0-1.0 (default: 0.7)
  tags?: string[];
  minImportance?: number;
  maxImportance?: number;
}
```

**Returns:**
```typescript
{
  entities: Entity[];
  relations: Relation[];
}
```

**Threshold Guide:**
- 0.9-1.0: Very strict (minor typos)
- 0.7-0.9: Moderate (recommended)
- 0.5-0.7: Lenient (major differences)

**Performance:** <200ms for 500 entities

**Example:**
```json
{
  "query": "enginer",
  "threshold": 0.8
}
```

---

### get_search_suggestions

Get search query suggestions based on existing content.

**Parameters:**
```typescript
{
  query: string;              // Partial query
  maxSuggestions?: number;    // Max suggestions (default: 10)
}
```

**Returns:**
```typescript
{
  suggestions: string[];
}
```

**Example:**
```json
{
  "query": "eng",
  "maxSuggestions": 5
}
```

---

## Saved Searches

### save_search

Save a search query for later reuse.

**Parameters:**
```typescript
{
  name: string;               // Unique search name
  query: string;              // Search query
  searchType: 'basic' | 'ranked' | 'boolean' | 'fuzzy';
  filters?: {
    tags?: string[];
    minImportance?: number;
    maxImportance?: number;
  };
  description?: string;
}
```

**Returns:**
```typescript
{
  savedSearch: SavedSearch;
}
```

**Example:**
```json
{
  "name": "active-engineers",
  "query": "engineer",
  "searchType": "basic",
  "filters": { "tags": ["active"], "minImportance": 5 }
}
```

---

### execute_saved_search

Execute a previously saved search.

**Parameters:**
```typescript
{
  name: string;  // Saved search name
}
```

**Returns:**
```typescript
{
  entities: Entity[];
  relations: Relation[];
}
```

**Example:**
```json
{
  "name": "active-engineers"
}
```

---

### list_saved_searches

List all saved searches.

**Parameters:** None

**Returns:**
```typescript
{
  savedSearches: SavedSearch[];
}
```

---

### delete_saved_search

Delete a saved search.

**Parameters:**
```typescript
{
  name: string;  // Saved search name to delete
}
```

**Returns:**
```typescript
{
  deleted: boolean;
}
```

---

### update_saved_search

Update an existing saved search.

**Parameters:**
```typescript
{
  name: string;               // Existing search name
  query?: string;             // New query
  searchType?: 'basic' | 'ranked' | 'boolean' | 'fuzzy';
  filters?: {
    tags?: string[];
    minImportance?: number;
    maxImportance?: number;
  };
  description?: string;
}
```

**Returns:**
```typescript
{
  savedSearch: SavedSearch;
}
```

---

## Tag Management

### add_tags

Add tags to a single entity.

**Parameters:**
```typescript
{
  entityName: string;
  tags: string[];  // Tags to add (normalized to lowercase)
}
```

**Returns:**
```typescript
{
  entity: Entity;
}
```

**Example:**
```json
{
  "entityName": "Alice",
  "tags": ["senior", "lead"]
}
```

---

### remove_tags

Remove tags from a single entity.

**Parameters:**
```typescript
{
  entityName: string;
  tags: string[];
}
```

**Returns:**
```typescript
{
  entity: Entity;
}
```

---

### set_importance

Set the importance score for an entity.

**Parameters:**
```typescript
{
  entityName: string;
  importance: number;  // 0-10
}
```

**Returns:**
```typescript
{
  entity: Entity;
}
```

**Example:**
```json
{
  "entityName": "Alice",
  "importance": 9
}
```

---

### add_tags_to_multiple_entities

Add tags to multiple entities at once.

**Parameters:**
```typescript
{
  entityNames: string[];
  tags: string[];
}
```

**Returns:**
```typescript
{
  entities: Entity[];
}
```

**Example:**
```json
{
  "entityNames": ["Alice", "Bob", "Charlie"],
  "tags": ["team-alpha"]
}
```

---

### replace_tag

Replace a tag across all entities.

**Parameters:**
```typescript
{
  oldTag: string;
  newTag: string;
}
```

**Returns:**
```typescript
{
  entitiesUpdated: number;
}
```

**Example:**
```json
{
  "oldTag": "dev",
  "newTag": "developer"
}
```

---

### merge_tags

Merge two tags into one target tag.

**Parameters:**
```typescript
{
  sourceTags: string[];  // Tags to merge
  targetTag: string;     // Resulting tag
}
```

**Returns:**
```typescript
{
  entitiesUpdated: number;
}
```

**Example:**
```json
{
  "sourceTags": ["dev", "developer"],
  "targetTag": "engineering"
}
```

---

## Tag Aliases

### add_tag_alias

Create a tag alias for normalization.

**Parameters:**
```typescript
{
  alias: string;        // Alternate form
  canonical: string;    // Canonical tag
  description?: string;
}
```

**Returns:**
```typescript
{
  tagAlias: TagAlias;
}
```

**Example:**
```json
{
  "alias": "js",
  "canonical": "javascript",
  "description": "JavaScript abbreviation"
}
```

---

### list_tag_aliases

List all tag aliases.

**Parameters:** None

**Returns:**
```typescript
{
  aliases: TagAlias[];
}
```

---

### remove_tag_alias

Remove a tag alias.

**Parameters:**
```typescript
{
  alias: string;
}
```

**Returns:**
```typescript
{
  removed: boolean;
}
```

---

### get_aliases_for_tag

Get all aliases that map to a canonical tag.

**Parameters:**
```typescript
{
  canonicalTag: string;
}
```

**Returns:**
```typescript
{
  aliases: string[];
}
```

---

### resolve_tag

Resolve a tag alias to its canonical form.

**Parameters:**
```typescript
{
  tag: string;
}
```

**Returns:**
```typescript
{
  resolvedTag: string;
  wasAlias: boolean;
}
```

**Example:**
```json
{
  "tag": "js"
}
// Returns: { "resolvedTag": "javascript", "wasAlias": true }
```

---

## Hierarchy Operations

### set_entity_parent

Set the parent entity for hierarchical organization.

**Parameters:**
```typescript
{
  entityName: string;
  parentName: string | null;  // null to remove parent
}
```

**Returns:**
```typescript
{
  entity: Entity;
}
```

**Notes:**
- Cycle detection prevents invalid parent assignments
- Setting null removes the parent relationship

**Example:**
```json
{
  "entityName": "Engineering_Team",
  "parentName": "Company"
}
```

---

### get_children

Get all direct children of an entity.

**Parameters:**
```typescript
{
  entityName: string;
}
```

**Returns:**
```typescript
{
  children: Entity[];
}
```

---

### get_parent

Get the parent of an entity.

**Parameters:**
```typescript
{
  entityName: string;
}
```

**Returns:**
```typescript
{
  parent: Entity | null;
}
```

---

### get_ancestors

Get all ancestors of an entity (parent, grandparent, etc.).

**Parameters:**
```typescript
{
  entityName: string;
}
```

**Returns:**
```typescript
{
  ancestors: Entity[];  // Ordered from immediate parent to root
}
```

---

### get_descendants

Get all descendants of an entity (children, grandchildren, etc.).

**Parameters:**
```typescript
{
  entityName: string;
}
```

**Returns:**
```typescript
{
  descendants: Entity[];
}
```

---

### get_subtree

Get an entity and all its descendants as a subgraph.

**Parameters:**
```typescript
{
  entityName: string;
}
```

**Returns:**
```typescript
{
  entities: Entity[];
  relations: Relation[];
}
```

---

### get_root_entities

Get all entities with no parent (root level).

**Parameters:** None

**Returns:**
```typescript
{
  roots: Entity[];
}
```

---

### get_entity_depth

Get the depth of an entity in the hierarchy.

**Parameters:**
```typescript
{
  entityName: string;
}
```

**Returns:**
```typescript
{
  depth: number;  // 0 for root entities
}
```

---

### move_entity

Move an entity to a new parent.

**Parameters:**
```typescript
{
  entityName: string;
  newParentName: string | null;
}
```

**Returns:**
```typescript
{
  entity: Entity;
}
```

**Notes:**
- Validates that the move doesn't create a cycle
- Updates lastModified timestamp

---

## Analytics

### get_graph_stats

Get comprehensive knowledge graph statistics.

**Parameters:** None

**Returns:**
```typescript
{
  entityCount: number;
  relationCount: number;
  entityTypes: { [type: string]: number };
  relationTypes: { [type: string]: number };
  tagCounts: { [tag: string]: number };
  avgObservationsPerEntity: number;
  importanceDistribution: { [importance: number]: number };
}
```

**Example Response:**
```json
{
  "entityCount": 150,
  "relationCount": 320,
  "entityTypes": { "person": 50, "project": 30, "document": 70 },
  "avgObservationsPerEntity": 3.2
}
```

---

### validate_graph

Validate graph integrity and return issues.

**Parameters:** None

**Returns:**
```typescript
{
  valid: boolean;
  errors: Array<{
    type: string;
    message: string;
    entities?: string[];
  }>;
  warnings: Array<{
    type: string;
    message: string;
    entities?: string[];
  }>;
}
```

**Checks:**
- Dangling relations (references non-existent entities)
- Missing parents (parentId references don't exist)
- Circular hierarchies (entity is its own ancestor)
- Duplicate entity names
- Invalid importance values

---

## Compression & Deduplication

### find_duplicates

Find potential duplicate entities using similarity scoring.

**Parameters:**
```typescript
{
  threshold?: number;  // 0.0-1.0 (default: 0.8)
}
```

**Returns:**
```typescript
{
  duplicateGroups: string[][];  // Arrays of similar entity names
}
```

**Similarity Algorithm:**
- Weighted scoring: name (40%), type (30%), observations (20%), tags (10%)
- Two-level bucketing by entityType for performance
- Levenshtein distance for string comparison

**Performance:** <1500ms for 500 entities

**Example Response:**
```json
{
  "duplicateGroups": [
    ["Alice Smith", "Alice_Smith", "A. Smith"],
    ["Project Alpha", "Project_Alpha"]
  ]
}
```

---

### merge_entities

Merge multiple entities into one, combining observations and relations.

**Parameters:**
```typescript
{
  entityNames: string[];       // Entities to merge (min 2)
  targetName?: string;         // Name for merged entity (default: first name)
}
```

**Returns:**
```typescript
{
  mergedEntity: Entity;
  entitiesMerged: number;
  observationsMerged: number;
}
```

**Merge Logic:**
- Observations: Combined (duplicates removed)
- Tags: Combined (duplicates removed)
- Importance: Maximum value
- Relations: Transferred to merged entity
- Original entities: Deleted

**Example:**
```json
{
  "entityNames": ["Alice Smith", "Alice_Smith"],
  "targetName": "Alice Smith"
}
```

---

### compress_graph

Find and merge all duplicates in one operation.

**Parameters:**
```typescript
{
  threshold?: number;  // 0.0-1.0 (default: 0.8)
  dryRun?: boolean;    // Preview without changes (default: false)
}
```

**Returns:**
```typescript
{
  entitiesMerged: number;
  observationsMerged: number;
  relationsUpdated: number;
  duplicateGroupsFound: number;
}
```

**Performance:** <400ms for 100 entities

**Example:**
```json
{
  "threshold": 0.85,
  "dryRun": true
}
```

---

### archive_entities

Archive old or low-importance entities.

**Parameters:**
```typescript
{
  criteria: {
    olderThan?: string;           // ISO date - archive entities older than this
    importanceLessThan?: number;  // Archive entities below this importance
    tags?: string[];              // Archive entities with these tags
  };
  dryRun?: boolean;               // Preview without changes (default: false)
}
```

**Returns:**
```typescript
{
  archivedCount: number;
  archivedEntities: string[];
}
```

**Example:**
```json
{
  "criteria": {
    "olderThan": "2024-01-01T00:00:00Z",
    "importanceLessThan": 3
  },
  "dryRun": true
}
```

---

## Import/Export Operations

### export_graph

Export the knowledge graph in specified format.

**Parameters:**
```typescript
{
  format: 'json' | 'csv' | 'graphml' | 'gexf' | 'dot' | 'markdown' | 'mermaid';
  filter?: {
    entityType?: string;
    tags?: string[];
    minImportance?: number;
  };
}
```

**Returns:**
```typescript
{
  data: string;  // Formatted export data
  format: string;
  entityCount: number;
  relationCount: number;
}
```

**Supported Formats:**
| Format | Description |
|--------|-------------|
| json | Complete graph with all metadata |
| csv | Entities and relations in CSV format |
| graphml | XML-based graph format |
| gexf | Gephi exchange format |
| dot | Graphviz DOT language |
| markdown | Human-readable markdown |
| mermaid | Mermaid diagram syntax |

**Example:**
```json
{
  "format": "json",
  "filter": { "entityType": "person" }
}
```

---

### import_graph

Import entities and relations from external data.

**Parameters:**
```typescript
{
  format: 'json' | 'csv' | 'graphml';
  data: string;
  mergeStrategy?: 'replace' | 'skip' | 'merge' | 'fail';
  dryRun?: boolean;
}
```

**Returns:**
```typescript
{
  entitiesCreated: number;
  entitiesUpdated: number;
  entitiesSkipped: number;
  relationsCreated: number;
  relationsSkipped: number;
  errors: string[];
}
```

**Merge Strategies:**
- `replace`: Overwrite existing entities
- `skip`: Skip entities that exist (default)
- `merge`: Combine observations and tags
- `fail`: Error if any conflicts

**Example:**
```json
{
  "format": "json",
  "data": "{\"entities\":[...],\"relations\":[...]}",
  "mergeStrategy": "merge",
  "dryRun": true
}
```

---

## Common Patterns

### Pattern 1: Create and Connect

```json
// 1. Create entities
{
  "tool": "create_entities",
  "arguments": {
    "entities": [
      { "name": "Alice", "entityType": "person", "observations": ["Engineer"] },
      { "name": "Project_X", "entityType": "project", "observations": ["AI project"] }
    ]
  }
}

// 2. Create relation
{
  "tool": "create_relations",
  "arguments": {
    "relations": [
      { "from": "Alice", "to": "Project_X", "relationType": "works_on" }
    ]
  }
}
```

### Pattern 2: Search and Tag

```json
// 1. Search for entities
{
  "tool": "search_nodes",
  "arguments": {
    "query": "engineer",
    "minImportance": 5
  }
}

// 2. Add tags to results
{
  "tool": "add_tags_to_multiple_entities",
  "arguments": {
    "entityNames": ["Alice", "Bob"],
    "tags": ["senior"]
  }
}
```

### Pattern 3: Find and Merge Duplicates

```json
// 1. Find duplicates
{
  "tool": "find_duplicates",
  "arguments": {
    "threshold": 0.85
  }
}

// 2. Review and merge
{
  "tool": "merge_entities",
  "arguments": {
    "entityNames": ["Alice Smith", "Alice_Smith"],
    "targetName": "Alice Smith"
  }
}
```

---

## Error Handling

All tools return errors in this format:

```typescript
{
  "content": [{
    "type": "text",
    "text": "Error: <message>"
  }],
  "isError": true
}
```

**Common Error Types:**
- `ValidationError`: Invalid input parameters
- `EntityNotFoundError`: Entity doesn't exist
- `DuplicateError`: Entity already exists
- `CycleDetectedError`: Hierarchy would create a cycle
- `SecurityError`: Path traversal or injection attempt

---

## Performance Guidelines

| Operation | Scale | Expected Time |
|-----------|-------|---------------|
| create_entities | 100 | <200ms |
| create_entities | 1000 | <1500ms |
| search_nodes | 500 entities | <100ms |
| search_nodes_ranked | 500 entities | <600ms |
| boolean_search | 500 entities | <150ms |
| fuzzy_search | 500 entities | <200ms |
| find_duplicates | 100 | <300ms |
| find_duplicates | 500 | <1500ms |
| compress_graph | 100 | <400ms |
| export_graph | 1000 entities | <1000ms |

---

## Best Practices

1. **Use Batch Operations**: Always prefer `create_entities` over multiple single entity calls
2. **Filter Early**: Use tags and importance filters to reduce result sets
3. **Choose Right Search**: Basic for simple queries, ranked for relevance, boolean for complex logic
4. **Regular Compression**: Run `find_duplicates` periodically to maintain quality
5. **Validate Imports**: Use `validate_graph` after importing data
6. **Tag Consistently**: Use `add_tag_alias` for normalization
7. **Export Before Major Changes**: Always backup before `compress_graph` or large merges

---

**Document Version**: 2.1
**Last Updated**: 2025-12-30
**Total Tools**: 47
**Maintained By**: Daniel Simon Jr.
