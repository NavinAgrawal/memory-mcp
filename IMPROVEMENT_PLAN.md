# Memory MCP Improvement Plan
## Comprehensive Roadmap for Advanced Features

**Version:** 0.8.0
**Last Updated:** 2025-11-23
**Status:** Week 1 Complete (5/5 features) ✅

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Completed Work (Week 1)](#completed-work-week-1)
3. [Remaining Tier 0 Features (Week 2)](#remaining-tier-0-features-week-2)
4. [Core Missing Features (Original Evaluation)](#core-missing-features)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Technical Specifications](#technical-specifications)
7. [Testing Strategy](#testing-strategy)
8. [Documentation Updates](#documentation-updates)

---

## Executive Summary

### Current State
- **Version:** 0.8.0 (from 0.7.0)
- **Total Tools:** 30 (from 15) → +15 new tools (+100%)
- **Source Lines:** ~2,260 (from ~1,210) → +1,050 lines (+87%)
- **Storage Files:** 4 (main + saved-searches + tag-aliases + original)

### Quality Metrics Progress
| Feature | Before | Current | Target | Status |
|---------|--------|---------|--------|--------|
| Categorization | 8/10 | 9.5/10 | 10/10 | 🟡 95% |
| Search & Filtering | 8/10 | 9.5/10 | 10/10 | 🟡 95% |
| Knowledge Graph | 9/10 | 9.5/10 | 10/10 | 🟡 95% |
| Export | 9/10 | 9/10 | 10/10 | 🟠 90% |
| Timestamps | 9/10 | 9/10 | 10/10 | 🟠 90% |
| **Nesting** | 0/10 | 0/10 | 8/10 | 🔴 0% |
| **Compression** | 0/10 | 0/10 | 8/10 | 🔴 0% |
| **Archiving** | 0/10 | 0/10 | 8/10 | 🔴 0% |

---

## Completed Work (Week 1)

### ✅ B5: Bulk Tag Operations
**Tools Added:** 3
**Lines of Code:** ~120
**Impact:** Categorization 8→9.5/10

**Features:**
- `add_tags_to_multiple_entities` - Batch tag addition
- `replace_tag` - Global tag renaming
- `merge_tags` - Tag consolidation

**Benefits:**
- Efficient bulk operations (single save)
- Consistent tag management
- Reduced I/O operations

---

### ✅ A1: Graph Validation
**Tools Added:** 1
**Lines of Code:** ~130
**Impact:** Knowledge Graph 9→9.5/10

**Features:**
- `validate_graph` - Comprehensive validation

**Checks:**
- **Errors:** Orphaned relations, duplicate entities, invalid data
- **Warnings:** Isolated entities, empty observations, missing metadata

**Benefits:**
- Data integrity assurance
- Early problem detection
- Detailed error reporting

---

### ✅ C4: Saved Searches
**Tools Added:** 5
**Lines of Code:** ~120
**Impact:** Search & Filtering 8→9/10

**Features:**
- `save_search` - Save complex queries
- `list_saved_searches` - View all saved
- `execute_saved_search` - Run by name
- `delete_saved_search` - Remove search
- `update_saved_search` - Modify parameters

**Benefits:**
- Reusable query templates
- Usage tracking (count, last used)
- Query library management

---

### ✅ C2: Fuzzy Search
**Tools Added:** 2
**Lines of Code:** ~170
**Impact:** Search & Filtering 9→9.5/10

**Features:**
- `fuzzy_search` - Typo-tolerant search (Levenshtein)
- `get_search_suggestions` - "Did you mean?" suggestions

**Algorithm:**
- Levenshtein distance (O(m*n))
- Configurable threshold (0.0-1.0)
- Word-level and full-text matching

**Benefits:**
- Handle typos and spelling variations
- Improved user experience
- Better search recall

---

### ✅ B2: Tag Aliases
**Tools Added:** 5
**Lines of Code:** ~115
**Impact:** Categorization 9.5/10 (stable)

**Features:**
- `add_tag_alias` - Create synonym mappings
- `list_tag_aliases` - View all aliases
- `remove_tag_alias` - Delete alias
- `get_aliases_for_tag` - Get aliases for canonical
- `resolve_tag` - Resolve to canonical form

**Benefits:**
- Synonym support (ai → artificial-intelligence)
- Consistent canonical tags
- Flexible search/filter

---

## Remaining Tier 0 Features (Week 2)

### 🔵 C1: Full-Text Search with Ranking
**Complexity:** ⭐⭐⭐ (Medium)
**Priority:** HIGH
**Estimated LOC:** 150-200
**Impact:** Search & Filtering 9.5→10/10

#### Features to Implement:
1. **TF-IDF Scoring**
   - Term frequency calculation
   - Inverse document frequency
   - Combined relevance scoring

2. **Search Results with Scores**
   ```typescript
   interface SearchResult {
     entity: Entity;
     score: number;              // Relevance score (0-1)
     matchedFields: string[];    // Which fields matched
     highlights: string[];       // Matched text snippets
     rank: number;               // Position in results
   }
   ```

3. **Highlighted Matches**
   - Show where query terms appear
   - Context snippets (±50 chars)
   - Multiple highlight formats

4. **Field-Weighted Scoring**
   - name: weight 3.0
   - entityType: weight 2.0
   - observations: weight 1.0
   - tags: weight 1.5

#### New Tools:
- `search_nodes_ranked` - Search with relevance ranking
- `explain_search_score` - Show why a result ranked as it did

#### Implementation Details:
```typescript
// TF-IDF calculation
async calculateTFIDF(term: string, document: string, corpus: string[]): Promise<number> {
  const tf = termFrequency(term, document);
  const idf = Math.log(corpus.length / documentsContaining(term, corpus));
  return tf * idf;
}

// Weighted field scoring
function calculateRelevance(entity: Entity, query: string): number {
  const nameScore = match(query, entity.name) * 3.0;
  const typeScore = match(query, entity.entityType) * 2.0;
  const obsScore = match(query, entity.observations) * 1.0;
  const tagScore = match(query, entity.tags) * 1.5;

  return normalize(nameScore + typeScore + obsScore + tagScore);
}
```

#### Benefits:
- Most relevant results first
- Better UX for large graphs
- Explainable ranking
- Professional search quality

---

### 🔵 C3: Boolean Search Operators
**Complexity:** ⭐⭐⭐ (Medium)
**Priority:** HIGH
**Estimated LOC:** 200-300
**Impact:** Search & Filtering 10/10 (complete)

#### Features to Implement:
1. **Query Parser**
   - Parse: `(python OR typescript) AND NOT java`
   - Support: AND, OR, NOT, parentheses
   - Field-specific: `name:Alice type:person`

2. **Query AST (Abstract Syntax Tree)**
   ```typescript
   type QueryNode =
     | { type: 'AND', children: QueryNode[] }
     | { type: 'OR', children: QueryNode[] }
     | { type: 'NOT', child: QueryNode }
     | { type: 'TERM', field?: string, value: string }
     | { type: 'RANGE', field: string, min: any, max: any };
   ```

3. **Query Execution**
   - Recursive evaluation
   - Set operations (union, intersection, difference)
   - Field-specific matching

4. **Range Queries**
   - `importance:[5 TO 10]`
   - `createdAt:>2025-01-01`
   - `lastModified:<now-7d`

#### New Tools:
- `boolean_search` - Search with boolean operators
- `validate_query` - Check query syntax
- `query_to_sql` - Convert to SQL-like format (for debugging)

#### Query Examples:
```
# Complex boolean
(python OR typescript) AND importance:>7 AND NOT deprecated

# Field-specific
name:Alice AND type:person

# Date range
createdAt:>2025-01-01 AND lastModified:<now-7d

# Negation
programming AND NOT (java OR c++)
```

#### Implementation Details:
```typescript
// Tokenizer
function tokenize(query: string): Token[] {
  // Regex: /\(|\)|AND|OR|NOT|[a-zA-Z0-9_:-]+/g
  return tokens;
}

// Parser (recursive descent)
function parseQuery(tokens: Token[]): QueryNode {
  return parseOr(tokens);
}

// Evaluator
async function evaluate(node: QueryNode, entities: Entity[]): Promise<Entity[]> {
  switch (node.type) {
    case 'AND': return intersection(...node.children.map(evaluate));
    case 'OR': return union(...node.children.map(evaluate));
    case 'NOT': return difference(allEntities, evaluate(node.child));
    // ...
  }
}
```

#### Benefits:
- Powerful query language
- Complex filtering
- Professional search capabilities
- Integration-ready (could expose query language to external tools)

---

### 🔵 D1: Additional Export Formats
**Complexity:** ⭐⭐ (Low-Medium)
**Priority:** MEDIUM
**Estimated LOC:** 100-150 per format
**Impact:** Export 9→9.7/10

#### Formats to Add:
1. **GEXF (Graph Exchange XML Format)**
   - Native Gephi format
   - Supports dynamic graphs
   - Rich attribute types

2. **DOT (GraphViz)**
   - Text-based graph description
   - Generate diagrams programmatically
   - Simple syntax

3. **Markdown**
   - Human-readable export
   - GitHub-compatible tables
   - Good for documentation

4. **Mermaid**
   - Diagram syntax
   - Renders in GitHub/GitLab
   - Interactive graphs

#### New Tools:
- `export_graph` - Update to support new formats (existing tool)

#### Implementation Details:
```typescript
// GEXF
private exportAsGEXF(graph: KnowledgeGraph): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://www.gexf.net/1.2draft">
  <graph mode="static" defaultedgetype="directed">
    <attributes class="node">
      <attribute id="0" title="entityType" type="string"/>
      ...
    </attributes>
    <nodes>
      ${graph.entities.map(e =>
        `<node id="${e.name}" label="${e.name}">
           <attvalues>
             <attvalue for="0" value="${e.entityType}"/>
           </attvalues>
         </node>`
      ).join('\n')}
    </nodes>
    <edges>
      ${graph.relations.map((r, i) =>
        `<edge id="${i}" source="${r.from}" target="${r.to}" label="${r.relationType}"/>`
      ).join('\n')}
    </edges>
  </graph>
</gexf>`;
}

// DOT
private exportAsDOT(graph: KnowledgeGraph): string {
  return `digraph G {
  ${graph.entities.map(e => `"${e.name}" [label="${e.name}\\n${e.entityType}"];`).join('\n')}
  ${graph.relations.map(r => `"${r.from}" -> "${r.to}" [label="${r.relationType}"];`).join('\n')}
}`;
}

// Markdown
private exportAsMarkdown(graph: KnowledgeGraph): string {
  return `# Knowledge Graph Export
## Entities (${graph.entities.length})
| Name | Type | Tags | Importance | Observations |
|------|------|------|------------|--------------|
${graph.entities.map(e =>
  `| ${e.name} | ${e.entityType} | ${e.tags?.join(', ')} | ${e.importance} | ${e.observations.length} |`
).join('\n')}

## Relations (${graph.relations.length})
| From | To | Type |
|------|-----|------|
${graph.relations.map(r => `| ${r.from} | ${r.to} | ${r.relationType} |`).join('\n')}`;
}
```

#### Benefits:
- Better tool compatibility
- More visualization options
- Human-readable formats
- Documentation-friendly

---

### 🔵 D2: Import Capabilities
**Complexity:** ⭐⭐⭐ (Medium)
**Priority:** MEDIUM
**Estimated LOC:** 180-220
**Impact:** Export 9.7→10/10

#### Features to Implement:
1. **Import from Export Formats**
   - JSON, CSV, GraphML import
   - Validation during import
   - Error reporting

2. **Merge Strategies**
   ```typescript
   enum MergeStrategy {
     REPLACE = 'replace',        // Replace existing
     SKIP = 'skip',              // Skip duplicates
     MERGE = 'merge',            // Merge observations
     FAIL = 'fail'               // Error on conflict
   }
   ```

3. **Import Validation**
   - Schema validation
   - Entity reference checking
   - Data type validation

4. **Dry-Run Mode**
   - Preview import without changes
   - Report conflicts
   - Show what would change

#### New Tools:
- `import_graph` - Import from file
- `preview_import` - Dry-run import
- `validate_import_file` - Check file validity

#### Implementation Details:
```typescript
interface ImportOptions {
  format: 'json' | 'csv' | 'graphml';
  mergeStrategy: MergeStrategy;
  dryRun?: boolean;
  validateOnly?: boolean;
}

interface ImportResult {
  success: boolean;
  entitiesAdded: number;
  entitiesUpdated: number;
  entitiesSkipped: number;
  relationsAdded: number;
  relationsSkipped: number;
  errors: ImportError[];
  warnings: ImportWarning[];
}

async importGraph(data: string, options: ImportOptions): Promise<ImportResult> {
  // 1. Parse based on format
  const parsed = await this.parseImport(data, options.format);

  // 2. Validate
  const validation = await this.validateImport(parsed);
  if (!validation.valid) return validation.errors;

  // 3. If dry-run, return preview
  if (options.dryRun) return this.previewImport(parsed);

  // 4. Merge based on strategy
  return await this.mergeImport(parsed, options.mergeStrategy);
}
```

#### Conflict Resolution:
```typescript
// Example: Merge observations
if (strategy === 'merge' && existing) {
  existing.observations = [
    ...existing.observations,
    ...imported.observations.filter(o => !existing.observations.includes(o))
  ];
  existing.lastModified = new Date().toISOString();
}
```

#### Benefits:
- Bidirectional data flow
- Easy backup/restore
- Data migration support
- Integration with external tools

---

## Core Missing Features

Based on the original evaluation, these features are **completely missing**:

### 🔴 Feature Set 1: Hierarchical Nesting (Priority: HIGH)
**Current Score:** 0/10
**Target Score:** 8/10
**Complexity:** ⭐⭐⭐☆ (Medium-High)
**Estimated LOC:** 200-250

#### What's Missing:
1. Parent-child entity relationships
2. Nested observation structures
3. Entity hierarchies with arbitrary depth
4. Context hierarchies (session → conversation → topic)

#### Implementation Plan:

##### Phase 1: Basic Parent-Child References
```typescript
// Update Entity interface
export interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  parentEntity?: string;        // NEW: Reference to parent
  childEntities?: string[];     // NEW: References to children
  hierarchyLevel?: number;      // NEW: Depth in hierarchy
  hierarchyPath?: string[];     // NEW: Path from root
  createdAt?: string;
  lastModified?: string;
  tags?: string[];
  importance?: number;
}
```

##### Phase 2: Hierarchical Operations
```typescript
// New methods
async setParentEntity(childName: string, parentName: string): Promise<void>;
async getChildren(parentName: string): Promise<Entity[]>;
async getDescendants(ancestorName: string, maxDepth?: number): Promise<Entity[]>;
async getAncestors(childName: string): Promise<Entity[]>;
async getSiblings(entityName: string): Promise<Entity[]>;
async moveEntity(entityName: string, newParent: string): Promise<void>;
async getHierarchyTree(rootName?: string): Promise<HierarchyTree>;
```

##### Phase 3: Nested Observations
```typescript
// Structured observations
export interface StructuredObservations {
  facts?: string[];
  preferences?: string[];
  skills?: string[];
  history?: string[];
  relationships?: string[];
  custom?: { [category: string]: string[] };
}

// Update Entity
export interface Entity {
  // ... existing fields ...
  observations: string[] | StructuredObservations;  // Support both
  observationFormat?: 'flat' | 'structured';
}
```

##### Phase 4: Tools
```typescript
// New tools (8)
- set_parent_entity: Set parent-child relationship
- get_children: Get immediate children
- get_descendants: Get all descendants (recursive)
- get_ancestors: Get ancestor chain
- get_siblings: Get entities with same parent
- move_entity: Change parent
- get_hierarchy_tree: Get tree structure
- restructure_observations: Convert flat → structured
```

##### Phase 5: Validation
- Prevent circular hierarchies
- Enforce maximum depth (configurable, default 10)
- Validate parent exists before setting
- Update hierarchy metadata on changes

#### Benefits:
- Organize related entities (e.g., Project → Tasks → Subtasks)
- Context hierarchies (User → Sessions → Conversations)
- Better knowledge organization
- Clearer relationships

#### Use Cases:
```
User
└── Work_Context
    ├── Project_A
    │   ├── Task_1
    │   └── Task_2
    └── Project_B
        └── Task_3
└── Personal_Context
    ├── Hobby_1
    └── Hobby_2
```

---

### 🔴 Feature Set 2: Memory Compression (Priority: MEDIUM)
**Current Score:** 0/10
**Target Score:** 8/10
**Complexity:** ⭐⭐⭐⭐⭐ (Very High)
**Estimated LOC:** 400-500

#### What's Missing:
1. Automatic observation summarization
2. Duplicate detection and merging
3. Semantic compression
4. Scheduled compression

#### Implementation Plan:

##### Phase 1: Basic Observation Compression
```typescript
export interface CompressionConfig {
  enabled: boolean;
  minObservations: number;        // Min observations before compression
  maxObservationAge: number;      // Days before eligible for compression
  similarityThreshold: number;    // 0-1 for duplicate detection
  strategy: 'manual' | 'auto';
  schedule?: string;              // Cron expression
}

export interface CompressionResult {
  entitiesProcessed: number;
  observationsBeforeCompression: number;
  observationsAfterCompression: number;
  compressionRatio: number;       // Percentage saved
  details: Array<{
    entityName: string;
    before: number;
    after: number;
    compressionType: 'duplicate' | 'semantic' | 'summarized';
  }>;
}
```

##### Phase 2: Duplicate Detection
```typescript
// Exact duplicates
async findExactDuplicates(entity: Entity): Promise<string[][]> {
  const groups: Map<string, string[]> = new Map();
  for (const obs of entity.observations) {
    const normalized = obs.toLowerCase().trim();
    if (!groups.has(normalized)) groups.set(normalized, []);
    groups.get(normalized)!.push(obs);
  }
  return Array.from(groups.values()).filter(g => g.length > 1);
}

// Semantic duplicates (fuzzy)
async findSemanticDuplicates(
  entity: Entity,
  threshold: number = 0.8
): Promise<string[][]> {
  const clusters: string[][] = [];
  const used = new Set<string>();

  for (const obs1 of entity.observations) {
    if (used.has(obs1)) continue;
    const cluster = [obs1];

    for (const obs2 of entity.observations) {
      if (obs1 === obs2 || used.has(obs2)) continue;
      if (this.semanticSimilarity(obs1, obs2) >= threshold) {
        cluster.push(obs2);
        used.add(obs2);
      }
    }

    if (cluster.length > 1) clusters.push(cluster);
  }

  return clusters;
}
```

##### Phase 3: AI-Powered Summarization
```typescript
// Requires external LLM API
async summarizeObservations(
  entityName: string,
  observations: string[],
  maxLength?: number
): Promise<string> {
  // Call LLM API (Claude, GPT, etc.)
  const prompt = `Summarize these observations about ${entityName}:
${observations.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Create a concise summary that preserves all important information.`;

  const summary = await callLLM(prompt, maxLength);

  // Store original observations as metadata
  return {
    summary,
    originalCount: observations.length,
    compressedAt: new Date().toISOString()
  };
}
```

##### Phase 4: Compression Tools
```typescript
// New tools (6)
- compress_entity_observations: Compress observations for one entity
- compress_all_observations: Batch compress all entities
- find_duplicates: Find duplicate observations
- merge_duplicates: Remove duplicates
- summarize_observations: AI-powered summarization
- preview_compression: Show what would be compressed
```

##### Phase 5: Compression History
```typescript
export interface CompressionHistory {
  entityName: string;
  compressionDate: string;
  originalObservations: string[];
  compressedObservation: string;
  compressionMethod: 'duplicate' | 'semantic' | 'llm';
  compressionRatio: number;
}

// Store in separate file: memory-compression-history.jsonl
// Allows rollback if needed
```

#### Benefits:
- Reduced storage size
- Faster searches
- Cleaner data
- Prevent information bloat

#### Safety Considerations:
- Always keep compression history
- Provide rollback mechanism
- Preview before compression
- User confirmation for LLM summarization

---

### 🔴 Feature Set 3: Memory Archiving (Priority: MEDIUM)
**Current Score:** 0/10
**Target Score:** 8/10
**Complexity:** ⭐⭐⭐⭐ (High-Medium)
**Estimated LOC:** 250-300

#### What's Missing:
1. Archive storage separate from active memory
2. Auto-archiving based on criteria
3. Archive search and retrieval
4. Archive compression

#### Implementation Plan:

##### Phase 1: Archive Storage
```typescript
export interface ArchiveConfig {
  enabled: boolean;
  archiveFilePath: string;
  autoArchive: boolean;
  criteria: ArchiveCriteria;
}

export interface ArchiveCriteria {
  minAge?: number;               // Days since creation
  maxImportance?: number;        // Archive if importance ≤ this
  minInactivity?: number;        // Days since last access/modification
  tags?: string[];               // Archive entities with these tags
  entityTypes?: string[];        // Archive these entity types
}

export interface ArchivedEntity extends Entity {
  archivedAt: string;
  archivedReason: string;
  originalImportance?: number;
}
```

##### Phase 2: Archiving Operations
```typescript
// Archive management
async archiveEntity(entityName: string, reason: string): Promise<void>;
async archiveEntities(criteria: ArchiveCriteria): Promise<ArchiveResult>;
async unarchiveEntity(entityName: string): Promise<void>;
async listArchived(filter?: ArchiveFilter): Promise<ArchivedEntity[]>;
async searchArchive(query: string): Promise<KnowledgeGraph>;
async getArchiveStats(): Promise<ArchiveStats>;

export interface ArchiveResult {
  archivedCount: number;
  archivedEntities: string[];
  archivedRelations: number;
  archiveSize: number;           // Bytes
  reason: string;
}
```

##### Phase 3: Smart Auto-Archiving
```typescript
async autoArchive(): Promise<ArchiveResult> {
  const graph = await this.loadGraph();
  const candidates: Entity[] = [];
  const now = new Date();

  for (const entity of graph.entities) {
    let shouldArchive = false;
    const reasons: string[] = [];

    // Check age
    if (this.archiveConfig.criteria.minAge) {
      const age = daysSince(entity.createdAt);
      if (age >= this.archiveConfig.criteria.minAge) {
        shouldArchive = true;
        reasons.push(`age: ${age} days`);
      }
    }

    // Check importance
    if (this.archiveConfig.criteria.maxImportance !== undefined) {
      if (entity.importance <= this.archiveConfig.criteria.maxImportance) {
        shouldArchive = true;
        reasons.push(`low importance: ${entity.importance}`);
      }
    }

    // Check inactivity
    if (this.archiveConfig.criteria.minInactivity) {
      const inactivity = daysSince(entity.lastModified);
      if (inactivity >= this.archiveConfig.criteria.minInactivity) {
        shouldArchive = true;
        reasons.push(`inactive: ${inactivity} days`);
      }
    }

    if (shouldArchive) {
      candidates.push({
        entity,
        reason: reasons.join(', ')
      });
    }
  }

  // Archive candidates
  return await this.archiveBatch(candidates);
}
```

##### Phase 4: Archive Compression
```typescript
// Compress archive periodically
async compressArchive(): Promise<CompressionResult> {
  // 1. Load archive
  const archive = await this.loadArchive();

  // 2. Compress observations
  const compressed = await this.compressAllObservations(archive);

  // 3. Save compressed archive
  await this.saveArchive(compressed);

  return compressionStats;
}
```

##### Phase 5: Archive Tools
```typescript
// New tools (7)
- archive_entity: Archive a specific entity
- archive_by_criteria: Auto-archive based on rules
- unarchive_entity: Restore from archive
- list_archived: List archived entities
- search_archive: Search within archive
- get_archive_stats: Archive statistics
- compress_archive: Compress archived data
```

##### Phase 6: Archive Metadata
```typescript
export interface ArchiveStats {
  totalArchivedEntities: number;
  totalArchivedRelations: number;
  oldestArchived: { name: string; date: string };
  newestArchived: { name: string; date: string };
  archiveSize: number;              // Bytes
  compressionRatio: number;         // If compressed
  averageEntityAge: number;         // Days
  entityTypeDistribution: Record<string, number>;
}
```

#### Benefits:
- Reduced active memory size
- Better performance
- Historical record keeping
- Organized memory lifecycle

#### Use Cases:
- Archive old projects
- Archive low-importance entities
- Archive inactive entities
- Seasonal archiving (archive last year's data)

---

## Implementation Roadmap

### Phase 1: Complete Tier 0 (Week 2) - 4-5 days
**Goal:** Perfect existing feature categories

1. **Day 1-2:** C1 (Full-text ranking)
   - Implement TF-IDF scoring
   - Add SearchResult interface
   - Create search_nodes_ranked tool
   - Test relevance ranking

2. **Day 3-4:** C3 (Boolean search)
   - Build query parser
   - Implement AST evaluator
   - Add boolean_search tool
   - Test complex queries

3. **Day 5:** D1 + D2 (Export/Import)
   - Add GEXF, DOT, Markdown formats
   - Implement import_graph tool
   - Add merge strategies
   - Test round-trip import/export

**Deliverables:**
- 9 new tools
- All Tier 0 features at 10/10
- Comprehensive test coverage
- Updated documentation

---

### Phase 2: Hierarchical Nesting - 5-7 days
**Goal:** Add parent-child relationships and nested observations

1. **Day 1-2:** Data model updates
   - Add parent/child fields
   - Update Entity interface
   - Implement hierarchy validation
   - Migration for existing data

2. **Day 3-4:** Hierarchy operations
   - Implement setParentEntity
   - Implement getChildren/getDescendants
   - Implement getAncestors
   - Implement hierarchy tree building

3. **Day 5-6:** Nested observations
   - Add StructuredObservations
   - Implement restructure_observations
   - Add backward compatibility
   - Update search to handle both formats

4. **Day 7:** Testing & tools
   - Add 8 hierarchy tools
   - Comprehensive testing
   - Update documentation

**Deliverables:**
- 8 new tools
- Hierarchical entity support
- Nested observation structures
- Nesting score: 0→8/10

---

### Phase 3: Memory Compression - 7-10 days
**Goal:** Add observation compression and summarization

1. **Day 1-2:** Duplicate detection
   - Implement exact duplicate finder
   - Implement semantic similarity
   - Add find_duplicates tool
   - Add merge_duplicates tool

2. **Day 3-4:** Compression framework
   - Add CompressionConfig
   - Implement compression history
   - Add preview_compression tool
   - Add rollback capability

3. **Day 5-6:** AI summarization (optional)
   - Integrate LLM API (Claude/GPT)
   - Implement summarizeObservations
   - Add safety checks
   - Add user confirmation

4. **Day 7-8:** Batch compression
   - Implement compress_entity_observations
   - Implement compress_all_observations
   - Add scheduling support
   - Performance optimization

5. **Day 9-10:** Testing & documentation
   - Test all compression methods
   - Test rollback
   - Update documentation
   - Add usage examples

**Deliverables:**
- 6 new tools
- Compression framework
- Optional AI summarization
- Compression score: 0→8/10

---

### Phase 4: Memory Archiving - 6-8 days
**Goal:** Add archive storage and lifecycle management

1. **Day 1-2:** Archive storage
   - Implement archive file format
   - Add ArchiveConfig
   - Implement archiveEntity
   - Implement unarchiveEntity

2. **Day 3-4:** Auto-archiving
   - Implement criteria evaluation
   - Implement autoArchive
   - Add archive_by_criteria tool
   - Add scheduling

3. **Day 5-6:** Archive search
   - Implement searchArchive
   - Implement listArchived
   - Add archive statistics
   - Add metadata tracking

4. **Day 7-8:** Testing & tools
   - Add 7 archive tools
   - Test archive lifecycle
   - Performance testing
   - Update documentation

**Deliverables:**
- 7 new tools
- Archive storage system
- Auto-archiving with criteria
- Archiving score: 0→8/10

---

### Phase 5: Testing & Polish - 3-5 days
**Goal:** Comprehensive testing and documentation

1. **Unit tests** for all new features
2. **Integration tests** for feature interactions
3. **Performance tests** for large graphs
4. **Documentation** updates (README, API docs)
5. **Examples** and usage guides
6. **Migration guide** for existing users

---

## Technical Specifications

### Database Schema Changes

#### Entity Extensions
```typescript
export interface Entity {
  // Existing
  name: string;
  entityType: string;
  observations: string[] | StructuredObservations;  // UPDATED
  createdAt?: string;
  lastModified?: string;
  tags?: string[];
  importance?: number;

  // NEW: Hierarchy support
  parentEntity?: string;
  childEntities?: string[];
  hierarchyLevel?: number;
  hierarchyPath?: string[];

  // NEW: Compression support
  compressed?: boolean;
  compressionDate?: string;
  originalObservationCount?: number;

  // NEW: Archive support
  archived?: boolean;
  archivedAt?: string;
  archivedReason?: string;

  // NEW: Access tracking
  lastAccessed?: string;
  accessCount?: number;
}
```

#### New Interfaces
```typescript
export interface StructuredObservations {
  facts?: string[];
  preferences?: string[];
  skills?: string[];
  history?: string[];
  relationships?: string[];
  custom?: { [category: string]: string[] };
}

export interface HierarchyTree {
  entity: Entity;
  children: HierarchyTree[];
  depth: number;
}

export interface SearchResult {
  entity: Entity;
  score: number;
  matchedFields: string[];
  highlights: string[];
  rank: number;
}

export interface CompressionHistory {
  entityName: string;
  compressionDate: string;
  originalObservations: string[];
  compressedObservation: string;
  compressionMethod: string;
  compressionRatio: number;
}

export interface ArchiveEntry {
  entity: ArchivedEntity;
  relations: Relation[];
  archivedAt: string;
  archivedReason: string;
}
```

### Storage Architecture

```
memory.jsonl                          # Active entities & relations
memory-saved-searches.jsonl           # Saved search queries
memory-tag-aliases.jsonl              # Tag synonym mappings
memory-compression-history.jsonl      # Compression history (rollback)
memory-archive.jsonl                  # Archived entities & relations
memory-access-log.jsonl               # Access tracking (optional)
memory-config.json                    # Configuration settings
```

### Configuration File
```json
{
  "version": "0.9.0",
  "features": {
    "hierarchyEnabled": true,
    "compressionEnabled": true,
    "archivingEnabled": true,
    "maxHierarchyDepth": 10,
    "autoCompress": false,
    "autoArchive": false
  },
  "compression": {
    "minObservations": 10,
    "maxObservationAge": 90,
    "similarityThreshold": 0.8,
    "strategy": "manual"
  },
  "archive": {
    "criteria": {
      "minAge": 365,
      "maxImportance": 3,
      "minInactivity": 180
    }
  },
  "performance": {
    "cacheEnabled": true,
    "cacheSizeMB": 50,
    "batchSize": 100
  }
}
```

---

## Testing Strategy

### Unit Tests (Vitest)
```typescript
describe('Hierarchy', () => {
  it('should set parent entity', async () => { });
  it('should prevent circular references', async () => { });
  it('should get descendants recursively', async () => { });
  it('should calculate hierarchy paths', async () => { });
});

describe('Compression', () => {
  it('should find exact duplicates', async () => { });
  it('should find semantic duplicates', async () => { });
  it('should compress observations', async () => { });
  it('should rollback compression', async () => { });
});

describe('Archiving', () => {
  it('should archive by criteria', async () => { });
  it('should search archive', async () => { });
  it('should unarchive entity', async () => { });
  it('should compress archive', async () => { });
});

describe('Boolean Search', () => {
  it('should parse AND queries', async () => { });
  it('should parse OR queries', async () => { });
  it('should parse NOT queries', async () => { });
  it('should handle nested parentheses', async () => { });
});
```

### Integration Tests
- Test hierarchy + search
- Test compression + archive
- Test import + export
- Test large graph performance

### Performance Tests
- 10,000 entities
- 50,000 relations
- 100,000 observations
- Measure: load time, search time, export time

---

## Documentation Updates

### README.md Updates
1. Add new tool sections
2. Update feature comparison table
3. Add hierarchy examples
4. Add compression guide
5. Add archiving guide
6. Update version to 0.9.0

### New Documentation Files
1. **HIERARCHY_GUIDE.md** - Using parent-child relationships
2. **COMPRESSION_GUIDE.md** - Managing memory compression
3. **ARCHIVING_GUIDE.md** - Archive lifecycle
4. **QUERY_LANGUAGE.md** - Boolean search syntax
5. **MIGRATION_GUIDE.md** - Upgrading from 0.8.0

### API Documentation
Update tool descriptions with:
- Parameter details
- Return value schemas
- Usage examples
- Error conditions

---

## Success Metrics

### Code Quality
- ✅ TypeScript strict mode
- ✅ 100% type coverage
- ✅ No linter errors
- ✅ All tests passing

### Feature Completeness
| Feature | Target | Measurement |
|---------|--------|-------------|
| Categorization | 10/10 | All tag operations complete |
| Search | 10/10 | Boolean + ranking + fuzzy |
| Knowledge Graph | 10/10 | Validation + hierarchy |
| Export | 10/10 | All formats + import |
| Timestamps | 10/10 | Full history + rollback |
| Nesting | 8/10 | Hierarchy + structured obs |
| Compression | 8/10 | Duplicate + semantic + LLM |
| Archiving | 8/10 | Auto-archive + search |

### Performance Targets
- Load 10k entities: < 1 second
- Search 10k entities: < 100ms
- Export 10k entities: < 2 seconds
- Import 10k entities: < 3 seconds

### Tool Count
- **Current:** 30 tools
- **After Tier 0:** 39 tools (+9)
- **After Nesting:** 47 tools (+8)
- **After Compression:** 53 tools (+6)
- **After Archiving:** 60 tools (+7)
- **Total Target:** 60 tools (+30 from start)

---

## Risk Assessment

### High Risk
- **LLM Integration:** Depends on external API
  - Mitigation: Make optional, provide fallback
- **Performance:** Large graphs may be slow
  - Mitigation: Caching, indexing, batch operations
- **Data Migration:** Breaking changes to schema
  - Mitigation: Backward compatibility, migration scripts

### Medium Risk
- **Complexity:** Many new features may introduce bugs
  - Mitigation: Comprehensive testing, staged rollout
- **User Experience:** Too many tools may confuse users
  - Mitigation: Good documentation, examples, guides

### Low Risk
- **Storage:** Multiple files may be harder to manage
  - Mitigation: Clear file structure, documentation

---

## Conclusion

This comprehensive improvement plan outlines a clear path to:

1. **Complete Tier 0 features** (Week 2) - Perfect existing capabilities
2. **Add hierarchical nesting** - Organize entities with parent-child relationships
3. **Implement compression** - Reduce memory bloat with smart compression
4. **Enable archiving** - Manage memory lifecycle with archive storage

**Total Estimated Timeline:** 20-30 days of development

**Final State:**
- 60 MCP tools (from 15 original)
- 8 storage files (organized by concern)
- All feature categories at 8-10/10
- Production-ready memory management system

**Next Steps:**
1. Review and approve this plan
2. Start Week 2 implementation (C1, C3, D1, D2)
3. Proceed with Phase 2-4 as outlined
4. Comprehensive testing and documentation

---

*Document Version: 1.0*
*Last Updated: 2025-11-23*
*Status: Ready for Implementation*
