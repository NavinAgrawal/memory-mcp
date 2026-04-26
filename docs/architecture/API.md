# Memory MCP - API Reference

**Version**: 12.2.0
**Last Updated**: 2026-04-26

Complete reference for all 160 MCP tools provided by the Memory MCP server. The 23 newest tools (Phase 15 / memoryjs v1.14+) are documented in their own sections at the end: **Entity Bitemporal Validity**, **OCC Update**, **RBAC**, **Procedural Memory**, **Active Retrieval**, **Causal Reasoning**, and **World Model**. Phase 15 also extends three existing tools (`export_graph`, `create_entities`, `set_memory_visibility`) — those updates are noted inline in their respective sections.

---

## Table of Contents

1. [Entity Operations](#entity-operations) (4 tools)
2. [Relation Operations](#relation-operations) (2 tools)
3. [Observation Management](#observation-management) (3 tools)
4. [Search Operations](#search-operations) (7 tools)
5. [Intelligent Search](#intelligent-search) (3 tools)
6. [Semantic Search](#semantic-search) (3 tools)
7. [Saved Searches](#saved-searches) (5 tools)
8. [Tag Management](#tag-management) (6 tools)
9. [Tag Aliases](#tag-aliases) (5 tools)
10. [Hierarchy Operations](#hierarchy-operations) (9 tools)
11. [Graph Algorithms](#graph-algorithms) (4 tools)
12. [Analytics](#analytics) (2 tools)
13. [Compression & Deduplication](#compression--deduplication) (4 tools)
14. [Import/Export Operations](#importexport-operations) (2 tools)
15. [Project Scoping](#project-scoping) (1 tool) — v1.8.0
16. [Memory Versioning](#memory-versioning) (2 tools) — v1.8.0
17. [Semantic Forget](#semantic-forget) (1 tool) — v1.8.0
18. [Profiles](#profiles) (2 tools) — v1.8.0
19. [Temporal KG](#temporal-kg) (3 tools) — v1.9.0
20. [Ingestion](#ingestion) (1 tool) — v1.9.0
21. [Agent Diary](#agent-diary) (2 tools) — v1.9.0
22. [Entity Bitemporal Validity](#entity-bitemporal-validity-phase-15--memoryjs-η44) (5 tools) — Phase 15 / memoryjs η.4.4
23. [Optimistic Concurrency Control](#optimistic-concurrency-control-phase-15--memoryjs-η55c) (1 tool) — Phase 15 / memoryjs η.5.5.c
24. [RBAC](#rbac-phase-15--memoryjs-η61) (4 tools) — Phase 15 / memoryjs η.6.1
25. [Procedural Memory](#procedural-memory-phase-15--memoryjs-3b4) (5 tools) — Phase 15 / memoryjs 3B.4
26. [Active Retrieval](#active-retrieval-phase-15--memoryjs-3b5) (1 tool) — Phase 15 / memoryjs 3B.5
27. [Causal Reasoning](#causal-reasoning-phase-15--memoryjs-3b6) (4 tools) — Phase 15 / memoryjs 3B.6
28. [World Model](#world-model-phase-15--memoryjs-3b7) (3 tools) — Phase 15 / memoryjs 3B.7
29. [Phase 15 enhancements to existing tools](#phase-15-enhancements-to-existing-tools) — `export_graph`, `create_entities`, `set_memory_visibility`

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

### normalize_observations

Normalize observations for an entity by resolving coreferences and anchoring temporal references.

**Parameters:**
```typescript
{
  entityName: string;            // Entity to normalize
  options?: {
    resolveCoreferences?: boolean;   // Replace pronouns with entity name (default: true)
    anchorDates?: boolean;           // Convert relative dates to absolute (default: true)
    extractKeywords?: boolean;       // Extract and score keywords (default: false)
    referenceDate?: string;          // ISO 8601 date for temporal anchoring (default: now)
  }
}
```

**Returns:**
```typescript
{
  entityName: string;
  originalCount: number;
  normalizedCount: number;
  observations: Array<{
    original: string;
    normalized: string;
    keywords?: Array<{
      keyword: string;
      score: number;
    }>;
  }>;
}
```

**Features:**
- **Coreference Resolution**: Replaces pronouns (he, she, they, it, etc.) with the entity name
- **Temporal Anchoring**: Converts relative dates ("yesterday", "last week", "3 days ago") to absolute ISO dates
- **Keyword Extraction**: Extracts significant keywords with TF-IDF-like scoring

**Example:**
```json
{
  "entityName": "Alice",
  "options": {
    "resolveCoreferences": true,
    "anchorDates": true,
    "extractKeywords": true
  }
}
```

**Example Response:**
```json
{
  "entityName": "Alice",
  "originalCount": 2,
  "normalizedCount": 2,
  "observations": [
    {
      "original": "She joined the team yesterday",
      "normalized": "Alice joined the team on 2026-01-08",
      "keywords": [{ "keyword": "joined", "score": 0.85 }, { "keyword": "team", "score": 0.72 }]
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

### search_auto

Automatically select the best search strategy based on query analysis.

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
  searchMethod: string;       // Method that was used (basic, ranked, boolean, fuzzy)
  cost: number;               // Estimated query cost
}
```

**Strategy Selection:**
- Boolean operators detected → `boolean_search`
- Short query with typos likely → `fuzzy_search`
- Multi-word query → `search_nodes_ranked`
- Simple query → `search_nodes`

**Example:**
```json
{
  "query": "engineer AND python",
  "minImportance": 5
}
```

---

## Intelligent Search

Three-layer hybrid search architecture combining semantic, lexical, and symbolic signals for advanced query understanding and result refinement.

### hybrid_search

Multi-layer search combining semantic (vector similarity), lexical (TF-IDF/BM25), and symbolic (metadata filtering) signals.

**Parameters:**
```typescript
{
  query: string;                    // Natural language query
  weights?: {
    semantic?: number;              // Weight for semantic similarity (default: 0.4)
    lexical?: number;               // Weight for lexical matching (default: 0.4)
    symbolic?: number;              // Weight for metadata filtering (default: 0.2)
  };
  filters?: {
    entityTypes?: string[];         // Filter by entity types
    tags?: string[];                // Filter by tags
    minImportance?: number;         // Minimum importance
    maxImportance?: number;         // Maximum importance
    dateRange?: {
      start?: string;               // ISO 8601 start date
      end?: string;                 // ISO 8601 end date
    };
  };
  limit?: number;                   // Max results (default: 20)
  minScore?: number;                // Minimum combined score (0.0-1.0)
}
```

**Returns:**
```typescript
{
  results: Array<{
    entity: Entity;
    scores: {
      semantic: number;             // Vector similarity score
      lexical: number;              // TF-IDF/BM25 score
      symbolic: number;             // Metadata match score
      combined: number;             // Weighted combined score
    };
    matchedFields: string[];        // Fields that matched
  }>;
  queryAnalysis: {
    extractedEntities: string[];    // Entities mentioned in query
    temporalReferences: string[];   // Time expressions found
    questionType: string;           // Type of question (who, what, when, etc.)
  };
}
```

**Example:**
```json
{
  "query": "engineers who worked on AI projects last year",
  "weights": { "semantic": 0.5, "lexical": 0.3, "symbolic": 0.2 },
  "filters": { "entityTypes": ["person"], "minImportance": 5 },
  "limit": 10
}
```

---

### analyze_query

Analyze a natural language query to extract entities, temporal references, and question characteristics.

**Parameters:**
```typescript
{
  query: string;                    // Natural language query to analyze
}
```

**Returns:**
```typescript
{
  query: string;                    // Original query
  analysis: {
    extractedEntities: Array<{
      text: string;                 // Entity mention
      type: string;                 // Inferred entity type
      confidence: number;           // Confidence score
    }>;
    temporalReferences: Array<{
      text: string;                 // Time expression (e.g., "last week")
      resolved: string;             // ISO 8601 date or range
      type: string;                 // absolute, relative, range
    }>;
    questionType: string;           // who, what, when, where, why, how, boolean, list
    complexity: string;             // simple, moderate, complex
    suggestedSearchMethods: string[]; // Recommended search approaches
  };
}
```

**Example:**
```json
{
  "query": "Who are the senior engineers who joined after January 2025?"
}
```

**Example Response:**
```json
{
  "query": "Who are the senior engineers who joined after January 2025?",
  "analysis": {
    "extractedEntities": [
      { "text": "senior engineers", "type": "person", "confidence": 0.9 }
    ],
    "temporalReferences": [
      { "text": "after January 2025", "resolved": "2025-01-01T00:00:00Z", "type": "relative" }
    ],
    "questionType": "who",
    "complexity": "moderate",
    "suggestedSearchMethods": ["hybrid_search", "search_by_date_range"]
  }
}
```

---

### smart_search

Orchestrates query analysis, planning, and reflection-based iterative refinement until results meet adequacy threshold.

**Parameters:**
```typescript
{
  query: string;                    // Natural language query
  maxIterations?: number;           // Max refinement iterations (default: 3)
  targetAdequacy?: number;          // Target adequacy score 0.0-1.0 (default: 0.7)
  filters?: {
    entityTypes?: string[];
    tags?: string[];
    minImportance?: number;
    maxImportance?: number;
  };
}
```

**Returns:**
```typescript
{
  results: Array<{
    entity: Entity;
    score: number;
    relevanceExplanation: string;   // Why this result is relevant
  }>;
  searchProcess: {
    iterations: number;             // Number of refinement iterations
    finalAdequacy: number;          // Final adequacy score achieved
    queryRefinements: string[];     // How the query was refined
    searchMethodsUsed: string[];    // Methods used during search
  };
  analysis: {
    questionType: string;
    complexity: string;
    extractedEntities: string[];
  };
}
```

**Example:**
```json
{
  "query": "Find all people related to the machine learning initiative",
  "maxIterations": 3,
  "targetAdequacy": 0.8
}
```

**Example Response:**
```json
{
  "results": [...],
  "searchProcess": {
    "iterations": 2,
    "finalAdequacy": 0.85,
    "queryRefinements": [
      "Added entity type filter: person",
      "Expanded query to include 'AI' and 'ML' synonyms"
    ],
    "searchMethodsUsed": ["analyze_query", "hybrid_search", "fuzzy_search"]
  },
  "analysis": {
    "questionType": "list",
    "complexity": "moderate",
    "extractedEntities": ["machine learning initiative"]
  }
}
```

---

## Semantic Search

### semantic_search

Search using semantic similarity with embeddings.

**Parameters:**
```typescript
{
  query: string;              // Natural language query
  limit?: number;             // Max results (default: 10, max: 100)
  minSimilarity?: number;     // Min similarity threshold (0.0-1.0)
}
```

**Returns:**
```typescript
{
  results: Array<{
    entity: Entity;
    similarity: number;
  }>
}
```

**Notes:**
- Requires embedding provider configuration via `MEMORY_EMBEDDING_PROVIDER`
- Supported providers: `openai`, `local`, `none`
- Call `index_embeddings` first to build the vector index

**Example:**
```json
{
  "query": "people who work on machine learning projects",
  "limit": 10,
  "minSimilarity": 0.7
}
```

---

### find_similar_entities

Find entities similar to a given entity.

**Parameters:**
```typescript
{
  entityName: string;         // Reference entity
  limit?: number;             // Max results (default: 10, max: 100)
  minSimilarity?: number;     // Min similarity threshold (0.0-1.0)
}
```

**Returns:**
```typescript
{
  results: Array<{
    entity: Entity;
    similarity: number;
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

### index_embeddings

Index all entities for semantic search.

**Parameters:**
```typescript
{
  forceReindex?: boolean;     // Re-index even if already indexed (default: false)
}
```

**Returns:**
```typescript
{
  indexed: number;            // Number of entities indexed
  skipped: number;            // Number already indexed (if not forcing)
}
```

**Notes:**
- Call after adding entities to enable semantic search
- Requires embedding provider configuration
- Can be slow for large graphs (batches API calls)

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

## Graph Algorithms

### find_shortest_path

Find the shortest path between two entities.

**Parameters:**
```typescript
{
  source: string;             // Starting entity name
  target: string;             // Target entity name
  relationTypes?: string[];   // Filter by relation types
  direction?: 'outgoing' | 'incoming' | 'both';  // Traversal direction (default: both)
}
```

**Returns:**
```typescript
{
  path: string[];             // Entity names in order
  relations: Relation[];      // Relations along the path
  length: number;             // Number of hops
}
```

**Example:**
```json
{
  "source": "Alice",
  "target": "Project_Z",
  "direction": "outgoing"
}
```

---

### find_all_paths

Find all paths between two entities up to a maximum depth.

**Parameters:**
```typescript
{
  source: string;
  target: string;
  maxDepth?: number;          // Max path length (default: 5)
  relationTypes?: string[];
  direction?: 'outgoing' | 'incoming' | 'both';
}
```

**Returns:**
```typescript
{
  paths: Array<{
    path: string[];
    relations: Relation[];
    length: number;
  }>
}
```

**Example:**
```json
{
  "source": "Alice",
  "target": "Charlie",
  "maxDepth": 3
}
```

---

### get_connected_components

Find all connected components in the graph.

**Parameters:** None

**Returns:**
```typescript
{
  components: Array<{
    entities: string[];
    size: number;
  }>;
  componentCount: number;
  largestComponentSize: number;
}
```

**Notes:**
- Useful for identifying isolated subgraphs
- Treats relations as undirected for connectivity

---

### get_centrality

Calculate centrality metrics for entities.

**Parameters:**
```typescript
{
  algorithm?: 'degree' | 'betweenness' | 'pagerank';  // default: degree
  topN?: number;              // Return top N entities (default: 10)
  direction?: 'in' | 'out' | 'both';  // For degree centrality
  dampingFactor?: number;     // For PageRank (default: 0.85)
  approximate?: boolean;      // Use approximation for betweenness (default: false)
  sampleRate?: number;        // Sample rate for approximation (0.0-1.0, default: 0.2)
}
```

**Returns:**
```typescript
{
  centrality: Array<{
    entityName: string;
    score: number;
  }>;
  algorithm: string;
}
```

**Algorithm Notes:**
- `degree`: Count of connections (fastest)
- `betweenness`: How often entity appears on shortest paths (slow for large graphs)
- `pagerank`: Importance based on incoming connections

**Example:**
```json
{
  "algorithm": "pagerank",
  "topN": 5,
  "dampingFactor": 0.85
}
```

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

## Project Scoping

### list_projects

List all project IDs present in the graph, or filter entities by a specific project.

**Parameters:**
```typescript
{
  projectId?: string;  // Optional: filter entities belonging to this project
}
```

**Returns:**
```typescript
{
  projects: string[];      // All distinct projectId values (when no filter)
  entities?: Entity[];     // Entities matching projectId (when filter provided)
}
```

---

## Memory Versioning

### get_entity_versions

Retrieve all versions of a versioned entity by its root name.

**Parameters:**
```typescript
{
  entityName: string;  // Name of the entity (any version)
}
```

**Returns:**
```typescript
{
  versions: Entity[];  // All versions ordered by version number
}
```

---

### get_version_chain

Get the full version chain from root to latest for an entity.

**Parameters:**
```typescript
{
  entityName: string;  // Name of the entity (any version in chain)
}
```

**Returns:**
```typescript
{
  chain: Entity[];   // Version chain from root to latest
  latest: Entity;    // The current latest version
}
```

---

## Semantic Forget

### forget_memory

Delete an entity by exact name. If no exact match is found, falls back to semantic similarity search (0.85 threshold) to locate and delete the closest matching entity.

**Parameters:**
```typescript
{
  entityName: string;      // Name or description of entity to forget
  auditReason?: string;    // Optional reason for audit log
}
```

**Returns:**
```typescript
{
  deleted: boolean;
  method: 'exact' | 'semantic';
  entityName: string;      // Actual name of deleted entity
}
```

---

## Profiles

### get_profile

Retrieve a user or agent profile entity.

**Parameters:**
```typescript
{
  profileName: string;  // Name of the profile entity
}
```

**Returns:**
```typescript
{
  profile: Entity;  // Profile entity with observations and metadata
}
```

---

### update_profile

Update observations and metadata on a profile entity.

**Parameters:**
```typescript
{
  profileName: string;
  observations?: string[];    // New observations to add
  importance?: number;        // Update importance (0-10)
  tags?: string[];            // Update tags
}
```

**Returns:**
```typescript
{
  profile: Entity;  // Updated profile entity
}
```

---

## Temporal KG

### invalidate_relation

Mark a relation as ended by setting its temporal validity end date.

**Parameters:**
```typescript
{
  from: string;
  to: string;
  relationType: string;
  endDate?: string;  // ISO 8601 date; defaults to now
}
```

**Returns:**
```typescript
{
  relation: Relation;  // Updated relation with validity end date
}
```

---

### query_as_of

Retrieve all relations for an entity that were valid at a given point in time.

**Parameters:**
```typescript
{
  entityName: string;
  asOf: string;  // ISO 8601 date for the time-travel query
}
```

**Returns:**
```typescript
{
  relations: Relation[];  // Relations valid at the specified date
}
```

---

### timeline

Return a chronological list of relation events (created/invalidated) for an entity.

**Parameters:**
```typescript
{
  entityName: string;
}
```

**Returns:**
```typescript
{
  events: Array<{
    date: string;
    event: 'created' | 'invalidated';
    relation: Relation;
  }>;
}
```

---

## Ingestion

### ingest

Ingest a conversation, document, or free-form text into the knowledge graph using the format-agnostic `IOManager.ingest()` pipeline.

**Parameters:**
```typescript
{
  input: string;           // Raw text, conversation, or document content
  format?: string;         // Hint: 'conversation' | 'document' | 'auto'
  projectId?: string;      // Assign ingested entities to a project
  tags?: string[];         // Tags to apply to ingested entities
}
```

**Returns:**
```typescript
{
  entitiesCreated: number;
  relationsCreated: number;
  observationsAdded: number;
}
```

---

## Agent Diary

### diary_write

Append an entry to the agent's persistent diary.

**Parameters:**
```typescript
{
  agentId: string;     // Agent identifier
  entry: string;       // Diary entry text
  tags?: string[];     // Optional tags for the entry
}
```

**Returns:**
```typescript
{
  entryId: string;
  timestamp: string;
}
```

---

### diary_read

Read diary entries for an agent, optionally filtered by date range.

**Parameters:**
```typescript
{
  agentId: string;
  startDate?: string;   // ISO 8601 date (inclusive)
  endDate?: string;     // ISO 8601 date (inclusive)
  limit?: number;       // Max entries to return (default: 50)
}
```

**Returns:**
```typescript
{
  entries: Array<{
    entryId: string;
    timestamp: string;
    entry: string;
    tags?: string[];
  }>;
}
```

---

## Entity Bitemporal Validity (Phase 15 / memoryjs η.4.4)

5 tools for time-travel queries over entities and observations. Distinct from v1.8 supersession (which models content edits over time): bitemporal validity models when a fact was true in the world. Entities and observations remain queryable for past timestamps after invalidation; only future-asOf queries return null.

### invalidate_entity

Mark an entity as no longer valid by setting `validUntil`. Idempotent. Does not delete — `entity_as_of` still returns it for past `asOf` timestamps.

```typescript
{
  name: 'invalidate_entity',
  arguments: {
    name: string;
    ended?: string;  // ISO 8601; defaults to current time
  }
}
```

### entity_as_of

Time-travel query: returns the entity at a given point in time. An entity is valid at `asOf` when `validFrom <= asOf AND (validUntil is undefined OR validUntil >= asOf)`.

```typescript
{
  name: 'entity_as_of',
  arguments: {
    name: string;
    asOf: string;  // ISO 8601
  }
}

// Returns: { entity: Entity | null, valid: boolean, asOf: string }
```

### entity_timeline

All temporal versions of an entity in chronological order (by `validFrom` ascending; unbounded entities last). Integrates the v1.8 supersession chain when one exists.

```typescript
{
  name: 'entity_timeline',
  arguments: { name: string }
}

// Returns: { name: string, versions: Entity[], count: number }
```

### invalidate_observation

Mark a specific observation on an entity as no longer valid. Creates a parallel `observationMeta[]` entry if absent. Throws if observation not found on entity.

```typescript
{
  name: 'invalidate_observation',
  arguments: {
    entityName: string;
    content: string;  // exact observation text to invalidate
    ended?: string;   // ISO 8601
  }
}
```

### observations_as_of

Get observations valid at a given point in time. Observations with no `observationMeta` entry are treated as unbounded.

```typescript
{
  name: 'observations_as_of',
  arguments: {
    entityName: string;
    asOf: string;
  }
}

// Returns: { entityName: string, asOf: string, observations: string[], count: number }
```

---

## Optimistic Concurrency Control (Phase 15 / memoryjs η.5.5.c)

### update_entity

Update an entity with optional optimistic concurrency control. Pass `expectedVersion` to assert the live entity is at that version; throws `VersionConflictError` on mismatch. Omit for legacy last-write-wins semantics. OCC-guarded writes auto-increment `version`.

```typescript
{
  name: 'update_entity',
  arguments: {
    name: string;
    updates: Partial<Entity>;
    expectedVersion?: number;
  }
}

// On success: returns updated Entity with bumped version
// On stale expectedVersion: error "Version conflict on entity 'X': expected vN, found vM"
```

---

## RBAC (Phase 15 / memoryjs η.6.1)

4 tools for role-based access control. Roles: `reader` (read-only), `writer` (read+write), `admin` (read+write+delete), `owner` (all four). Optional `resourceType` narrows to one type; optional `scope` narrows to a name prefix; optional `validUntil` expires the grant.

### rbac_assign_role

```typescript
{
  name: 'rbac_assign_role',
  arguments: {
    agentId: string;
    role: string;  // 'reader' | 'writer' | 'admin' | 'owner' | custom
    resourceType?: 'entity' | 'relation' | 'observation' | 'session' | 'artifact';
    scope?: string;       // e.g. 'project-x:'
    validFrom?: string;   // ISO 8601
    validUntil?: string;
    notes?: string;
  }
}
```

### rbac_revoke_role

Match by `agentId + role + resourceType` (exact, including `undefined`).

```typescript
{
  name: 'rbac_revoke_role',
  arguments: {
    agentId: string;
    role: string;
    resourceType?: 'entity' | 'relation' | 'observation' | 'session' | 'artifact';
  }
}
```

### rbac_check_permission

Falls back to `defaultRole=reader` for agents with no assignments.

```typescript
{
  name: 'rbac_check_permission',
  arguments: {
    agentId: string;
    action: 'read' | 'write' | 'delete' | 'manage';
    resourceType: 'entity' | 'relation' | 'observation' | 'session' | 'artifact';
    resourceName?: string;  // for scope-prefix matching
    now?: string;           // hypothetical-time queries
  }
}

// Returns: { agentId, action, resourceType, allowed: boolean }
```

### rbac_list_assignments

```typescript
{
  name: 'rbac_list_assignments',
  arguments: {
    agentId: string;
    activeOnly?: boolean;  // default false
    now?: string;
  }
}
```

---

## Procedural Memory (Phase 15 / memoryjs 3B.4)

5 tools for executable how-to sequences distinct from semantic facts and episodic events. Steps are 1-indexed with optional fallback chains. Auto-generates id when omitted.

### add_procedure

```typescript
{
  name: 'add_procedure',
  arguments: {
    id?: string;            // auto-generated if omitted
    name?: string;
    description?: string;
    steps: Array<{
      order: number;        // 1-indexed
      action: string;
      parameters: Record<string, string>;
      timeout?: number;     // ms
      fallback?: object;
    }>;
    triggers?: string[];    // free-form match phrases
  }
}
```

### get_procedure

```typescript
{ name: 'get_procedure', arguments: { id: string } }
```

### match_procedure

Token-overlap match a context description against stored procedures. Returns ranked Jaccard-like scores.

```typescript
{
  name: 'match_procedure',
  arguments: {
    context: string;
    candidateIds?: string[];  // default: all procedures
    threshold?: number;       // default 0
  }
}

// Returns: { context, threshold, matches: [{procedure, score}], count }
```

### refine_procedure

Apply caller feedback after execution. Increments `executionCount` and updates `successRate` via EWMA (α=0.2).

```typescript
{
  name: 'refine_procedure',
  arguments: {
    id: string;
    succeeded: boolean;
    notes?: string;
    recordedAt?: string;
  }
}
```

### get_procedure_step

Load by 1-indexed `order`, OR get the step after `order` when `next: true`.

```typescript
{
  name: 'get_procedure_step',
  arguments: {
    id: string;
    order: number;
    next?: boolean;
  }
}
```

---

## Active Retrieval (Phase 15 / memoryjs 3B.5)

### adaptive_retrieve

Iterative query rewriting: up to `maxRounds` of (search → score coverage → rewrite). Stops early when `coverage ≥ minCoverage` or no expansion tokens remain. Pure symbolic — no LLM provider required.

```typescript
{
  name: 'adaptive_retrieve',
  arguments: {
    query: string;
    maxRounds?: number;       // default 3
    minCoverage?: number;     // default 0.6
    resultsPerRound?: number; // default 10
    budgetTokens?: number;    // optional cost cap
  }
}

// Returns: {
//   bestResults: SearchResult[],
//   bestCoverage: number,
//   rounds: [{query, results, coverage, expansionTokens}]
// }
```

---

## Causal Reasoning (Phase 15 / memoryjs 3B.6)

4 tools that walk causal relation types: `causes`, `enables`, `prevents`, `precedes`, `correlates`. Chains are scored by product of per-edge `causalStrength`.

> **CAVEAT**: `detect_causal_cycles` treats `prevents` as a directed edge, not as logical negation — `prevents` + `enables` triangles ARE flagged as cycles.

### find_causes

Causal chains ending at the named effect.

```typescript
{
  name: 'find_causes',
  arguments: {
    effect: string;
    candidates: string[];
    maxDepth?: number;  // default 6
  }
}

// Returns: { effect, candidates, chains: Chain[], count }
```

### find_effects

Symmetric counterpart starting at the named cause.

```typescript
{
  name: 'find_effects',
  arguments: {
    cause: string;
    candidates: string[];
    maxDepth?: number;
  }
}
```

### counterfactual_query

"What if we remove edge (`removeFrom` → `removeTo`)? Is `predict` still reachable from `seed`?" Returns chains from seed to predict that DO NOT use the removed edge. Pure: does not mutate the graph.

```typescript
{
  name: 'counterfactual_query',
  arguments: {
    seed: string;
    removeFrom: string;
    removeTo: string;
    predict: string;
    maxDepth?: number;
  }
}
```

### detect_causal_cycles

```typescript
{
  name: 'detect_causal_cycles',
  arguments: {
    seed: string;
    maxDepth?: number;
  }
}
```

---

## World Model (Phase 15 / memoryjs 3B.7)

3 tools: snapshot the live graph, validate proposed observations against it, predict downstream effects of actions.

### get_world_state

Capture a fresh snapshot: `entitiesByName + takenAt timestamp + size`. Capped at `maxSnapshotSize` (default 1000); over-cap prefers high-importance entities.

```typescript
{ name: 'get_world_state', arguments: {} }

// Returns: { takenAt: string, entities: Array<{name, entityType, observationCount, ...}> }
```

### validate_fact_against_world

Validate a candidate observation against a target entity. Delegates to `MemoryValidator.validateConsistency`.

When the local embedding provider is selected but `@xenova/transformers` isn't installed, the handler returns a structured graceful response instead of leaking the raw Node module-resolution error:
```json
{
  "observation": "...",
  "entityName": "...",
  "result": null,
  "reason": "embedding_provider_unavailable",
  "detail": "Failed to initialize local embedding service: ..."
}
```

```typescript
{
  name: 'validate_fact_against_world',
  arguments: {
    observation: string;
    entityName: string;
  }
}
```

### predict_outcome

Predict downstream effects of an action by walking the causal subgraph. Delegates to `CausalReasoner.findEffects`.

```typescript
{
  name: 'predict_outcome',
  arguments: {
    action: string;
    candidates: string[];
  }
}
```

---

## Phase 15 enhancements to existing tools

### export_graph (extended)

Phase 15 (memoryjs η.5.4 / η.6.3) added three W3C Linked Data export formats and PII redaction:

| Field | Type | Notes |
|---|---|---|
| `format: 'turtle'` | RDF 1.1 Turtle | `@prefix rdf:`, `@prefix rdfs:`, `@prefix dcterms:` headers |
| `format: 'rdf-xml'` | RDF 1.1 XML | Statement reification for non-NCName predicates |
| `format: 'json-ld'` | JSON-LD 1.1 | `@context` mapping to RDFS + DCTerms |
| `redactPii?: boolean` | Default `false` | Scrubs email / SSN / credit-card / phone / IPv4 from observations using the η.6.3 `PiiRedactor` default pattern bank |

### create_entities (extended)

Phase 15 (memoryjs v1.6 freshness, v1.8 project scoping, η.4.4 bitemporal) added per-entity fields:

| Field | Type | Notes |
|---|---|---|
| `ttl?: number` | seconds | v1.6 freshness — seconds until entity is considered stale |
| `confidence?: number` | 0–1 | v1.6 freshness — belief strength |
| `projectId?: string` | string | v1.8 project scope identifier |
| `validFrom?: string` | ISO 8601 | η.4.4 — entity is valid from this instant |
| `validUntil?: string` | ISO 8601 | η.4.4 — entity is valid until this instant |
| `observationMeta?: Array<{...}>` | array | η.4.4 — per-observation temporal metadata indexed by content match |

### set_memory_visibility (extended)

Phase 15 (memoryjs η.5.5.b) added time-window and role gates, plus auto-promotion of plain entities to `AgentEntity` (was previously a silent `null` failure):

| Field | Type | Notes |
|---|---|---|
| `allowedRoles?: string[]` | array | Role gate AND-combined with the visibility level check |
| `visibleFrom?: string` | ISO 8601 | Memory becomes visible at this instant |
| `visibleUntil?: string` | ISO 8601 | Memory stops being visible at this instant |

When called on a plain `Entity` (not yet an `AgentEntity`), the handler now stamps `agentId`, `memoryType: 'semantic'`, `confidence: 0.8`, `confirmationCount: 0`, and `accessCount: 0` before applying visibility — and returns `{promoted: true, memoryName, agentId, visibility, ...}` so callers can detect the promotion.

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

**Document Version**: 5.1
**Last Updated**: 2026-04-10
**Total Tools**: 106
**Maintained By**: Daniel Simon Jr.
