# Memory MCP - API Reference

**Version**: 0.18.0
**Last Updated**: 2025-11-25

Complete reference for all 45 MCP tools provided by the Memory MCP server.

---

## Table of Contents

1. [Entity Management](#entity-management) (7 tools)
2. [Relation Management](#relation-management) (5 tools)
3. [Search Operations](#search-operations) (7 tools)
4. [Compression & Deduplication](#compression--deduplication) (3 tools)
5. [Tag Management](#tag-management) (5 tools)
6. [Hierarchies](#hierarchies) (3 tools)
7. [Statistics](#statistics) (3 tools)
8. [Export Operations](#export-operations) (3 tools)
9. [Import Operations](#import-operations) (1 tool)
10. [Graph Operations](#graph-operations) (2 tools)
11. [Utility Operations](#utility-operations) (6 tools)

---

## Entity Management

### createEntities

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

### getEntity

Retrieve a single entity by name.

**Parameters:**
```typescript
{
  name: string;  // Entity name to retrieve
}
```

**Returns:**
```typescript
{
  entity: Entity | null;  // Entity if found, null otherwise
}
```

**Example:**
```json
{
  "name": "Alice"
}
```

---

### updateEntity

Update an existing entity's properties.

**Parameters:**
```typescript
{
  name: string;                  // Entity to update
  updates: {
    entityType?: string;         // New type
    observations?: string[];     // Replace observations
    tags?: string[];             // Replace tags
    importance?: number;         // New importance
    parentId?: string;           // New parent
  }
}
```

**Returns:**
```typescript
{
  entity: Entity;  // Updated entity
}
```

**Notes:**
- Cannot update entity name (it's the unique identifier)
- `lastModified` timestamp automatically updated
- Updates are partial (only specified fields changed)

**Example:**
```json
{
  "name": "Alice",
  "updates": {
    "importance": 9,
    "tags": ["team", "engineering", "lead"]
  }
}
```

---

### deleteEntities

Delete one or more entities from the knowledge graph.

**Parameters:**
```typescript
{
  names: string[];  // Array of entity names to delete
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
- Related entities' `lastModified` timestamps updated
- Relations involving deleted entities are also removed

**Example:**
```json
{
  "names": ["Alice", "Bob"]
}
```

---

### batchUpdateEntities

Update multiple entities in a single atomic operation.

**Parameters:**
```typescript
{
  updates: Array<{
    name: string;
    updates: {
      entityType?: string;
      observations?: string[];
      tags?: string[];
      importance?: number;
      parentId?: string;
    }
  }>
}
```

**Returns:**
```typescript
{
  entities: Entity[];  // Array of updated entities
}
```

**Performance:**
- Single I/O operation
- ~200ms for 100 entities

**Example:**
```json
{
  "updates": [
    { "name": "Alice", "updates": { "importance": 9 } },
    { "name": "Bob", "updates": { "importance": 8 } }
  ]
}
```

---

### listEntities

List all entities with optional filtering.

**Parameters:**
```typescript
{
  entityType?: string;    // Filter by type
  tags?: string[];        // Filter by tags (AND logic)
  minImportance?: number; // Minimum importance
  maxImportance?: number; // Maximum importance
}
```

**Returns:**
```typescript
{
  entities: Entity[];
  count: number;
}
```

**Example:**
```json
{
  "entityType": "person",
  "tags": ["engineering"],
  "minImportance": 7
}
```

---

### observeEntity

Add observations to an existing entity without replacing existing ones.

**Parameters:**
```typescript
{
  name: string;
  observations: string[];  // New observations to add
}
```

**Returns:**
```typescript
{
  entity: Entity;  // Updated entity
}
```

**Notes:**
- Observations are appended, not replaced
- Duplicates are allowed
- `lastModified` automatically updated

**Example:**
```json
{
  "name": "Alice",
  "observations": ["Led project Alpha", "Promoted to senior engineer"]
}
```

---

## Relation Management

### createRelations

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

### getRelations

Get all relations for a specific entity.

**Parameters:**
```typescript
{
  entityName: string;  // Entity to get relations for
}
```

**Returns:**
```typescript
{
  incoming: Relation[];  // Relations where entity is 'to'
  outgoing: Relation[];  // Relations where entity is 'from'
}
```

**Notes:**
- May return `null` if entity has no relations
- Use `openNodes` for guaranteed results

**Example:**
```json
{
  "entityName": "Alice"
}
```

---

### deleteRelations

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
- Related entities' `lastModified` updated
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

### listRelations

List all relations with optional filtering.

**Parameters:**
```typescript
{
  relationType?: string;  // Filter by relation type
}
```

**Returns:**
```typescript
{
  relations: Relation[];
  count: number;
}
```

**Example:**
```json
{
  "relationType": "works_on"
}
```

---

### getRelationTypes

Get all unique relation types in the knowledge graph.

**Parameters:** None

**Returns:**
```typescript
{
  relationTypes: string[];
  count: number;
}
```

**Example Usage:**
```json
{}
```

**Example Response:**
```json
{
  "relationTypes": ["works_on", "mentors", "reports_to", "collaborates_with"],
  "count": 4
}
```

---

## Search Operations

### searchNodes

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

### searchNodesRanked

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

### booleanSearch

Boolean query search with AND/OR/NOT operators.

**Parameters:**
```typescript
{
  query: string;  // Boolean expression
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
```json
{
  "query": "(senior OR lead) AND engineering"
}
```

---

### fuzzySearch

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
- 0.0-0.5: Very lenient (not recommended)

**Performance:** <200ms for 500 entities

**Example:**
```json
{
  "query": "enginer",  // Typo for "engineer"
  "threshold": 0.8
}
```

---

### openNodes

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
- Guaranteed to return results (unlike `getRelations`)
- Useful for graph visualization

**Performance:** <100ms for 50 nodes

**Example:**
```json
{
  "names": ["Alice", "Bob", "Project_X"]
}
```

---

### searchByDateRange

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

### searchByTags

Search entities by tags with optional text query.

**Parameters:**
```typescript
{
  tags: string[];             // Required tags (AND logic)
  query?: string;             // Optional text search
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

**Example:**
```json
{
  "tags": ["engineering", "senior"],
  "query": "python"
}
```

---

## Compression & Deduplication

### findDuplicates

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
- Weighted scoring: name (40%), type (20%), observations (30%), tags (10%)
- Two-level bucketing by entityType for performance
- Levenshtein distance for string comparison

**Performance:** <1500ms for 500 entities

**Example:**
```json
{
  "threshold": 0.85
}
```

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

### mergeEntities

Merge multiple entities into one, combining observations and relations.

**Parameters:**
```typescript
{
  entityNames: string[];       // Entities to merge
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

### compressGraph

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

## Tag Management

### addTagsToEntities

Add tags to multiple entities.

**Parameters:**
```typescript
{
  entityNames: string[];
  tags: string[];  // Tags to add (normalized to lowercase)
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
  "entityNames": ["Alice", "Bob"],
  "tags": ["senior", "engineering"]
}
```

---

### removeTagsFromEntities

Remove tags from multiple entities.

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
  entitiesUpdated: number;
}
```

**Example:**
```json
{
  "entityNames": ["Alice"],
  "tags": ["junior"]
}
```

---

### listTags

List all unique tags in the knowledge graph.

**Parameters:** None

**Returns:**
```typescript
{
  tags: string[];
  count: number;
}
```

**Example Response:**
```json
{
  "tags": ["engineering", "senior", "team", "contractor"],
  "count": 4
}
```

---

### createTagAlias

Create tag aliases for normalization.

**Parameters:**
```typescript
{
  canonical: string;    // Canonical tag
  aliases: string[];    // Alternate forms
}
```

**Returns:**
```typescript
{
  canonical: string;
  aliases: string[];
}
```

**Example:**
```json
{
  "canonical": "engineering",
  "aliases": ["eng", "engineer", "dev"]
}
```

---

### getTagSuggestions

Get tag suggestions for an entity based on similar entities.

**Parameters:**
```typescript
{
  entityName: string;
  limit?: number;  // Max suggestions (default: 5)
}
```

**Returns:**
```typescript
{
  suggestions: Array<{
    tag: string;
    confidence: number;  // 0.0-1.0
  }>
}
```

**Example:**
```json
{
  "entityName": "Alice",
  "limit": 5
}
```

---

## Hierarchies

### setParent

Set the parent entity for hierarchical organization.

**Parameters:**
```typescript
{
  childName: string;
  parentName: string;
}
```

**Returns:**
```typescript
{
  entity: Entity;  // Updated child entity
}
```

**Example:**
```json
{
  "childName": "Engineering_Team",
  "parentName": "Company"
}
```

---

### getChildren

Get all direct children of an entity.

**Parameters:**
```typescript
{
  parentName: string;
}
```

**Returns:**
```typescript
{
  children: Entity[];
  count: number;
}
```

**Example:**
```json
{
  "parentName": "Company"
}
```

---

### getDescendants

Get all descendants (children, grandchildren, etc.) of an entity.

**Parameters:**
```typescript
{
  parentName: string;
  maxDepth?: number;  // Max levels (default: unlimited)
}
```

**Returns:**
```typescript
{
  descendants: Entity[];
  count: number;
  depth: number;
}
```

**Example:**
```json
{
  "parentName": "Company",
  "maxDepth": 3
}
```

---

## Statistics

### getStats

Get comprehensive knowledge graph statistics.

**Parameters:** None

**Returns:**
```typescript
{
  entityCount: number;
  relationCount: number;
  entityTypes: { [type: string]: number };
  relationTypes: { [type: string]: number };
  tags: { [tag: string]: number };
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

### getEntityTypeStats

Get statistics for a specific entity type.

**Parameters:**
```typescript
{
  entityType: string;
}
```

**Returns:**
```typescript
{
  count: number;
  tags: { [tag: string]: number };
  avgImportance: number;
  avgObservations: number;
}
```

**Example:**
```json
{
  "entityType": "person"
}
```

---

### getTagStats

Get statistics for a specific tag.

**Parameters:**
```typescript
{
  tag: string;
}
```

**Returns:**
```typescript
{
  count: number;
  entityTypes: { [type: string]: number };
  avgImportance: number;
}
```

**Example:**
```json
{
  "tag": "engineering"
}
```

---

## Export Operations

### exportGraph

Export the entire knowledge graph in specified format.

**Parameters:**
```typescript
{
  format: "json" | "graphml" | "csv";
  includeRelations?: boolean;  // Default: true
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

**Formats:**
- **json**: Complete graph with all metadata
- **graphml**: Graph format for visualization tools
- **csv**: Entities and relations in separate CSV format

**Example:**
```json
{
  "format": "json",
  "includeRelations": true
}
```

---

### exportEntities

Export specific entities.

**Parameters:**
```typescript
{
  entityNames: string[];
  format: "json" | "csv";
  includeRelations?: boolean;
}
```

**Returns:**
```typescript
{
  data: string;
  format: string;
  entityCount: number;
}
```

**Example:**
```json
{
  "entityNames": ["Alice", "Bob"],
  "format": "json",
  "includeRelations": true
}
```

---

### exportByQuery

Export entities matching a search query.

**Parameters:**
```typescript
{
  query: string;
  format: "json" | "csv";
  includeRelations?: boolean;
}
```

**Returns:**
```typescript
{
  data: string;
  format: string;
  entityCount: number;
}
```

**Example:**
```json
{
  "query": "type:person AND engineering",
  "format": "json"
}
```

---

## Import Operations

### importGraph

Import entities and relations from JSON data.

**Parameters:**
```typescript
{
  data: {
    entities: Entity[];
    relations?: Relation[];
  };
  mode: "merge" | "replace";  // Default: "merge"
}
```

**Returns:**
```typescript
{
  entitiesImported: number;
  relationsImported: number;
  entitiesSkipped: number;
}
```

**Modes:**
- **merge**: Add new entities, skip existing
- **replace**: Clear graph first, then import

**Example:**
```json
{
  "data": {
    "entities": [...],
    "relations": [...]
  },
  "mode": "merge"
}
```

---

## Graph Operations

### clearGraph

Clear all entities and relations from the knowledge graph.

**Parameters:**
```typescript
{
  confirm: boolean;  // Must be true
}
```

**Returns:**
```typescript
{
  entitiesDeleted: number;
  relationsDeleted: number;
}
```

**Warning:** This operation is irreversible!

**Example:**
```json
{
  "confirm": true
}
```

---

### validateGraph

Validate graph integrity and return issues.

**Parameters:** None

**Returns:**
```typescript
{
  valid: boolean;
  issues: Array<{
    type: "dangling_relation" | "missing_parent" | "circular_hierarchy";
    description: string;
    entities: string[];
  }>;
}
```

**Checks:**
- Dangling relations (references non-existent entities)
- Missing parents (parentId references don't exist)
- Circular hierarchies (entity is its own ancestor)

**Example Response:**
```json
{
  "valid": false,
  "issues": [
    {
      "type": "dangling_relation",
      "description": "Relation references non-existent entity",
      "entities": ["DeletedEntity"]
    }
  ]
}
```

---

## Utility Operations

### searchSimilarEntities

Find entities similar to a given entity.

**Parameters:**
```typescript
{
  entityName: string;
  threshold?: number;  // 0.0-1.0 (default: 0.7)
  limit?: number;      // Max results (default: 10)
}
```

**Returns:**
```typescript
{
  similar: Array<{
    entity: Entity;
    similarity: number;
  }>
}
```

**Example:**
```json
{
  "entityName": "Alice",
  "threshold": 0.75,
  "limit": 5
}
```

---

### getEntityHistory

Get modification history for an entity (if tracking enabled).

**Parameters:**
```typescript
{
  entityName: string;
}
```

**Returns:**
```typescript
{
  entity: Entity;
  createdAt: string;
  lastModified: string;
  modificationCount: number;
}
```

**Example:**
```json
{
  "entityName": "Alice"
}
```

---

### bulkImportObservations

Import observations from external sources.

**Parameters:**
```typescript
{
  entityName: string;
  observations: string[];
  deduplicate?: boolean;  // Remove duplicates (default: true)
}
```

**Returns:**
```typescript
{
  entity: Entity;
  observationsAdded: number;
}
```

**Example:**
```json
{
  "entityName": "Alice",
  "observations": ["Led project Alpha", "Completed certification"],
  "deduplicate": true
}
```

---

### renameEntity

Rename an entity (updates all relations).

**Parameters:**
```typescript
{
  oldName: string;
  newName: string;
}
```

**Returns:**
```typescript
{
  entity: Entity;
  relationsUpdated: number;
}
```

**Notes:**
- Updates all incoming and outgoing relations
- Updates parent references
- New name must not already exist

**Example:**
```json
{
  "oldName": "Alice_Smith",
  "newName": "Alice Smith"
}
```

---

### getRecentlyModified

Get recently modified entities.

**Parameters:**
```typescript
{
  limit?: number;         // Max results (default: 20)
  entityType?: string;    // Filter by type
  since?: string;         // ISO 8601 date
}
```

**Returns:**
```typescript
{
  entities: Entity[];
  count: number;
}
```

**Example:**
```json
{
  "limit": 10,
  "since": "2025-11-20T00:00:00Z"
}
```

---

### getOrphanedEntities

Get entities with no relations.

**Parameters:**
```typescript
{
  entityType?: string;  // Filter by type
}
```

**Returns:**
```typescript
{
  entities: Entity[];
  count: number;
}
```

**Example:**
```json
{
  "entityType": "person"
}
```

---

## Common Patterns

### Pattern 1: Create and Connect

```json
// 1. Create entities
{
  "tool": "createEntities",
  "entities": [
    { "name": "Alice", "entityType": "person", "observations": ["Engineer"] },
    { "name": "Project_X", "entityType": "project", "observations": ["AI project"] }
  ]
}

// 2. Create relation
{
  "tool": "createRelations",
  "relations": [
    { "from": "Alice", "to": "Project_X", "relationType": "works_on" }
  ]
}
```

### Pattern 2: Search and Update

```json
// 1. Search for entities
{
  "tool": "searchNodes",
  "query": "engineer",
  "tags": ["team"]
}

// 2. Batch update results
{
  "tool": "batchUpdateEntities",
  "updates": [
    { "name": "Alice", "updates": { "importance": 9 } },
    { "name": "Bob", "updates": { "importance": 8 } }
  ]
}
```

### Pattern 3: Find and Merge Duplicates

```json
// 1. Find duplicates
{
  "tool": "findDuplicates",
  "threshold": 0.85
}

// 2. Review and merge
{
  "tool": "mergeEntities",
  "entityNames": ["Alice Smith", "Alice_Smith"],
  "targetName": "Alice Smith"
}
```

---

## Error Handling

All tools return errors in this format:

```typescript
{
  "error": {
    "code": string;
    "message": string;
    "details?: any;
  }
}
```

**Common Error Codes:**
- `ValidationError`: Invalid input parameters
- `NotFoundError`: Entity/relation not found
- `DuplicateError`: Entity already exists
- `SecurityError`: Path traversal or injection attempt

---

## Performance Guidelines

| Operation | Scale | Expected Time |
|-----------|-------|---------------|
| Create entities | 100 | <200ms |
| Create entities | 1000 | <1500ms |
| Batch update | 100 | <200ms |
| Basic search | 500 entities | <100ms |
| Ranked search | 500 entities | <600ms |
| Boolean search | 500 entities | <150ms |
| Fuzzy search | 500 entities | <200ms |
| Find duplicates | 100 | <300ms |
| Find duplicates | 500 | <1500ms |
| Compress graph | 100 | <400ms |
| Export graph | 1000 entities | <1000ms |

---

## Best Practices

1. **Use Batch Operations**: Always prefer `createEntities` over multiple `createEntity` calls
2. **Filter Early**: Use tags and importance filters to reduce result sets
3. **Choose Right Search**: Basic for simple queries, ranked for relevance, boolean for complex logic
4. **Regular Compression**: Run `compressGraph` periodically to maintain quality
5. **Validate Imports**: Use `validateGraph` after importing data
6. **Tag Consistently**: Use `createTagAlias` for normalization
7. **Export Before Major Changes**: Always backup before `clearGraph` or large merges

---

**Document Version**: 1.0
**Last Updated**: 2025-11-25
**Total Tools**: 45
