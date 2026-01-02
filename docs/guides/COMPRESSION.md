# Memory Compression Guide
## Brotli Compression, Response Compression, and Entity Deduplication

**Version:** 1.0.0
**Last Updated:** 2026-01-02

---

## Table of Contents

1. [Brotli Compression Overview](#brotli-compression-overview)
2. [Response Compression](#response-compression)
3. [Backup & Export Compression](#backup--export-compression)
4. [Entity Deduplication Overview](#entity-deduplication-overview)
5. [Core Concepts](#core-concepts)
6. [Understanding Similarity Scoring](#understanding-similarity-scoring)
7. [Getting Started](#getting-started)
8. [Tool Reference](#tool-reference)
9. [Common Use Cases](#common-use-cases)
10. [Best Practices](#best-practices)
11. [Advanced Patterns](#advanced-patterns)
12. [Troubleshooting](#troubleshooting)

---

## Brotli Compression Overview

Memory-MCP uses **Brotli compression** for efficient data storage and transfer. Brotli is a modern compression algorithm (built into Node.js) that offers 15-20% better compression than gzip, with 60-75% compression typical for JSON data.

### Where Compression is Used

| Feature | Compression | Quality Level | Threshold |
|---------|-------------|---------------|-----------|
| **Backups** | Always (default) | Maximum (11) | Always compressed |
| **Exports** | Optional/Auto | Batch (6) | >100KB auto-compress |
| **MCP Responses** | Auto | Batch (6) | >256KB auto-compress |
| **Archives** | Always | Maximum (11) | Always compressed |

### Benefits

- **50-70% backup space reduction** - Maximum compression for archival
- **60-75% export compression** - Smaller files for transport
- **Reduced bandwidth** - Large MCP responses compressed automatically
- **No external dependencies** - Uses Node.js built-in `zlib` module

---

## Response Compression

Large MCP tool responses are automatically compressed using Brotli when they exceed 256KB. This reduces bandwidth for operations like `read_graph`, `search_nodes`, `get_subtree`, and `open_nodes`.

### Compressed Response Format

When a response is compressed, it returns the following structure:

```json
{
  "compressed": true,
  "compressionFormat": "brotli",
  "encoding": "base64",
  "originalSize": 524288,
  "compressedSize": 157286,
  "data": "G3gBILSh7WDAqy...base64-encoded-compressed-data..."
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `compressed` | boolean | Whether the data is compressed |
| `compressionFormat` | string | `"brotli"` or `"none"` |
| `encoding` | string | `"base64"` (compressed) or `"utf-8"` (uncompressed) |
| `originalSize` | number | Original size in bytes (only if compressed) |
| `compressedSize` | number | Compressed size in bytes (only if compressed) |
| `data` | string | The response data (base64-encoded if compressed) |

### Client Decompression

To decompress a response on the client side:

```typescript
import { brotliDecompress } from 'zlib';
import { promisify } from 'util';

const decompress = promisify(brotliDecompress);

async function handleResponse(response: unknown) {
  // Check if response is compressed
  if (typeof response === 'object' && response !== null) {
    const resp = response as Record<string, unknown>;
    if (resp.compressed === true && resp.encoding === 'base64') {
      const buffer = Buffer.from(resp.data as string, 'base64');
      const decompressed = await decompress(buffer);
      return decompressed.toString('utf-8');
    }
  }
  // Return as-is if not compressed
  return JSON.stringify(response);
}

// Usage
const result = await handleResponse(mcpResponse);
const data = JSON.parse(result);
```

### Python Client Example

```python
import brotli
import base64
import json

def handle_response(response):
    if isinstance(response, dict) and response.get('compressed'):
        compressed_data = base64.b64decode(response['data'])
        decompressed = brotli.decompress(compressed_data)
        return decompressed.decode('utf-8')
    return json.dumps(response)

# Usage
result = handle_response(mcp_response)
data = json.loads(result)
```

### Tools with Automatic Compression

These tools may return compressed responses for large payloads:

- `read_graph` - Returns full knowledge graph
- `search_nodes` - May return many search results
- `get_subtree` - Large hierarchical subtrees
- `open_nodes` - Multiple entity details

### Configuration

The compression threshold can be controlled via constants (default 256KB):

```typescript
// In constants.ts
COMPRESSION_CONFIG.AUTO_COMPRESS_RESPONSE_SIZE = 256 * 1024; // 256KB
```

---

## Backup & Export Compression

### Backup Compression

Backups are compressed by default with maximum quality (level 11):

```typescript
// Create compressed backup (default)
const result = await createBackup();
// result.path = 'backup_2026-01-02T10-00-00.jsonl.br'
// result.compressionRatio = 0.28 (72% reduction)

// Create uncompressed backup
const result = await createBackup({ compress: false });
// result.path = 'backup_2026-01-02T10-00-00.jsonl'
```

### Export Compression

Exports can be compressed explicitly or auto-compress above 100KB:

```typescript
// Explicit compression
export_graph({
  format: 'json',
  compress: true,
  compressionQuality: 6  // 0-11, default 6
})

// Returns:
{
  "format": "json",
  "entityCount": 5000,
  "relationCount": 2000,
  "compressed": true,
  "encoding": "base64",
  "originalSize": 1250000,
  "compressedSize": 375000,
  "compressionRatio": "30.0%",
  "data": "G3gBILSh...base64-data..."
}

// Auto-compression (>100KB)
export_graph({ format: 'json' })
// Large exports auto-compress; small exports remain uncompressed
```

### Quality Levels

| Level | Use Case | Speed | Compression |
|-------|----------|-------|-------------|
| 0-3 | Real-time streaming | Very Fast | Low |
| 4 | Entity writes | Fast | Moderate |
| 5-6 | Exports, responses | Balanced | Good |
| 7-9 | Batch processing | Slow | Better |
| 10-11 | Backups, archives | Very Slow | Maximum |

---

## Entity Deduplication Overview

Memory compression also helps you maintain a clean, efficient knowledge graph by identifying and merging duplicate or highly similar entities. Over time, knowledge graphs can accumulate redundant entries that waste storage and complicate queries.

### Key Features

- ✅ **Intelligent Similarity Scoring**: Multi-factor algorithm considers names, types, observations, and tags
- ✅ **Configurable Thresholds**: Control sensitivity of duplicate detection (default 0.8)
- ✅ **Safe Merging**: Preserves all unique information when combining entities
- ✅ **Automated Compression**: One-command cleanup with dry-run preview
- ✅ **Relation Consolidation**: Automatically redirects relations to merged entities

### When to Use Compression

- **Data consolidation**: Multiple similar entities exist (e.g., "Project Alpha", "project-alpha", "Project-Alpha")
- **Storage optimization**: Graph is growing too large with redundant data
- **Quality improvement**: Automated cleanup after bulk imports
- **Periodic maintenance**: Regular deduplication as part of memory hygiene

---

## Core Concepts

### What is a Duplicate?

Duplicates are entities that represent the same real-world concept but have slightly different representations:

```
Entity 1: "John Smith" (person) - ["Software engineer at TechCorp"]
Entity 2: "John smith" (person) - ["Engineer at TechCorp", "Lives in SF"]
```

These are likely duplicates because:
- Similar names (case variation)
- Same entity type
- Overlapping observations

### Similarity Score

The system calculates a **similarity score** (0.0 to 1.0) between entity pairs:

- **1.0** = Identical entities
- **0.8-0.99** = Very similar (likely duplicates)
- **0.5-0.79** = Somewhat similar (review manually)
- **0.0-0.49** = Different entities

**Default threshold**: 0.8 (only entities with ≥80% similarity are considered duplicates)

### Merge Behavior

When merging entities:

1. **Observations**: Combined and deduplicated (unique values only)
2. **Tags**: Combined and deduplicated (unique values only)
3. **Importance**: Highest value is preserved
4. **Timestamps**: Earliest `createdAt`, latest `lastModified`
5. **Relations**: All relations redirected to target entity
6. **Name**: Target entity name is kept (or most important entity)
7. **Type**: Target entity type is kept

---

## Understanding Similarity Scoring

### Multi-Factor Algorithm

The similarity score is calculated using **4 weighted factors**:

| Factor | Weight | Algorithm | Description |
|--------|--------|-----------|-------------|
| **Name** | 40% | Levenshtein Distance | Character-level edit distance |
| **Type** | 20% | Exact Match | Entity type must match |
| **Observations** | 30% | Jaccard Similarity | Overlap of observation sets |
| **Tags** | 10% | Jaccard Similarity | Overlap of tag sets |

### Factor Details

#### 1. Name Similarity (40% weight)

Uses **Levenshtein Distance** to measure how many edits are needed to transform one name into another.

```javascript
// Examples
"Project Alpha" vs "project alpha"    → 0.92 (case difference)
"John Smith" vs "Jon Smith"           → 0.91 (one character)
"API Server" vs "API Service"         → 0.73 (two characters)
"Frontend" vs "Backend"               → 0.22 (very different)
```

**Formula:**
```
nameSimilarity = 1 - (editDistance / maxLength)
```

#### 2. Type Similarity (20% weight)

Simple exact match (case-insensitive):

```javascript
// Examples
"project" vs "project"   → 1.0 (match)
"project" vs "Project"   → 1.0 (case-insensitive)
"project" vs "task"      → 0.0 (different)
```

**Score:**
- Match: +0.2
- No match: +0.0

#### 3. Observation Similarity (30% weight)

Uses **Jaccard Similarity** to measure overlap between observation sets:

```
Jaccard = |intersection| / |union|
```

**Example:**
```javascript
Entity A: ["Software engineer", "Works at Google"]
Entity B: ["Software engineer", "Lives in SF"]

Intersection: {"Software engineer"}        → 1 item
Union: {"Software engineer", "Works at Google", "Lives in SF"} → 3 items

Jaccard = 1/3 = 0.33
Weighted = 0.33 × 0.3 = 0.10
```

#### 4. Tag Similarity (10% weight)

Also uses **Jaccard Similarity** for tag overlap:

**Example:**
```javascript
Entity A: ["javascript", "frontend", "react"]
Entity B: ["javascript", "frontend", "vue"]

Intersection: {"javascript", "frontend"}   → 2 items
Union: {"javascript", "frontend", "react", "vue"} → 4 items

Jaccard = 2/4 = 0.50
Weighted = 0.50 × 0.1 = 0.05
```

### Final Score Calculation

```javascript
finalScore = (nameSimilarity × 0.4) +
             (typeMatch × 0.2) +
             (observationJaccard × 0.3) +
             (tagJaccard × 0.1)
```

**Example Calculation:**
```
Entity 1: "Project Alpha" (project) - ["Web app rewrite"] - [high-priority]
Entity 2: "project alpha" (project) - ["Web app rewrite", "Q4 deadline"] - [high-priority, urgent]

Name:         0.92 × 0.4 = 0.368
Type:         1.0  × 0.2 = 0.200
Observations: 0.50 × 0.3 = 0.150
Tags:         0.50 × 0.1 = 0.050
                          ─────
Final Score:              0.768  (76.8% similar - below default threshold)
```

---

## Getting Started

### Example 1: Finding Duplicates

```javascript
// Find all duplicate pairs with default threshold (0.8)
find_duplicates({})

// Returns:
{
  "duplicates": [
    {
      "entity1": "Project Alpha",
      "entity2": "project-alpha",
      "similarity": 0.89
    },
    {
      "entity1": "John Smith",
      "entity2": "John smith",
      "similarity": 0.95
    }
  ]
}

// Find with custom threshold (more sensitive)
find_duplicates({ threshold: 0.7 })
```

### Example 2: Manual Merging

```javascript
// Merge specific entities
merge_entities({
  entityNames: ["Project Alpha", "project-alpha", "Project-Alpha"]
})

// Returns merged entity:
{
  "name": "Project Alpha",
  "entityType": "project",
  "observations": [
    "Web application rewrite",
    "React frontend migration",
    "Q4 2025 deadline"
  ],
  "tags": ["high-priority", "frontend", "migration"],
  "importance": 8,
  "createdAt": "2025-09-15T10:00:00.000Z",
  "lastModified": "2025-11-23T14:30:00.000Z"
}
```

### Example 3: Automated Compression

```javascript
// Preview compression (safe mode)
compress_graph({
  threshold: 0.8,
  dryRun: true
})

// Returns preview:
{
  "duplicatesFound": 5,
  "entitiesMerged": 0,        // 0 because dry-run
  "observationsCompressed": 12,
  "relationsConsolidated": 8,
  "spaceFreed": 3420,
  "mergedEntities": [
    {
      "kept": "Project Alpha",
      "merged": ["project-alpha", "Project-Alpha"]
    },
    {
      "kept": "John Smith",
      "merged": ["John smith"]
    }
  ]
}

// Execute compression
compress_graph({
  threshold: 0.8,
  dryRun: false
})
```

---

## Tool Reference

### `find_duplicates`

Find similar entity pairs above threshold.

**Parameters:**
- `threshold` (optional, default 0.8): Similarity threshold (0.0-1.0)

**Returns:**
```typescript
{
  duplicates: Array<{
    entity1: string;
    entity2: string;
    similarity: number;
  }>
}
```

**Usage:**
```javascript
// Default sensitivity (80%)
find_duplicates({})

// High sensitivity (70%)
find_duplicates({ threshold: 0.7 })

// Very strict (90%)
find_duplicates({ threshold: 0.9 })
```

**When to use:**
- Manual review of duplicates before merging
- Finding clusters of similar entities
- Assessing data quality

---

### `merge_entities`

Merge multiple entities into one target entity.

**Parameters:**
- `entityNames` (required): Array of entity names to merge
- `targetName` (optional): Name of entity to keep (if not specified, uses first or highest importance)

**Returns:** Merged entity object

**Behavior:**
1. Combines all unique observations
2. Combines all unique tags
3. Keeps highest importance value
4. Keeps earliest `createdAt`
5. Updates `lastModified` to now
6. Redirects all relations to target
7. Removes duplicate entities

**Usage:**
```javascript
// Merge with auto-selected target
merge_entities({
  entityNames: ["Project Alpha", "project-alpha", "Project-Alpha"]
})

// Merge with specific target
merge_entities({
  entityNames: ["Project Alpha", "project-alpha", "Project-Alpha"],
  targetName: "Project Alpha"
})
```

**Validation:**
- All entities must exist
- Must provide at least 2 entities
- Target (if specified) must be in the entity list

---

### `compress_graph`

Automated duplicate detection and merging.

**Parameters:**
- `threshold` (optional, default 0.8): Similarity threshold
- `dryRun` (optional, default false): Preview mode (no changes)

**Returns:** CompressionResult object

**Usage:**
```javascript
// Safe preview
compress_graph({ threshold: 0.8, dryRun: true })

// Execute compression
compress_graph({ threshold: 0.8, dryRun: false })

// Aggressive compression (review carefully!)
compress_graph({ threshold: 0.7, dryRun: true })
```

**Best practices:**
- **Always** run with `dryRun: true` first
- Review `mergedEntities` list before executing
- Use higher thresholds (0.85-0.9) for initial cleanup
- Lower thresholds (0.7-0.75) for manual review

---

## Common Use Cases

### Use Case 1: Post-Import Cleanup

**Scenario:** You imported entities from multiple sources and have duplicates with different naming conventions.

```javascript
// Step 1: Assess the damage
const result = await find_duplicates({ threshold: 0.8 });
console.log(`Found ${result.duplicates.length} duplicate pairs`);

// Step 2: Preview compression
const preview = await compress_graph({ threshold: 0.8, dryRun: true });
console.log(`Would merge ${preview.entitiesMerged} entities`);
console.log(`Would save ~${preview.spaceFreed} characters`);

// Step 3: Review specific merges
preview.mergedEntities.forEach(merge => {
  console.log(`Keep: ${merge.kept}`);
  console.log(`Merge: ${merge.merged.join(', ')}`);
});

// Step 4: Execute if satisfied
await compress_graph({ threshold: 0.8, dryRun: false });
```

### Use Case 2: Periodic Maintenance

**Scenario:** Monthly cleanup to maintain graph quality.

```javascript
// Monthly compression script
async function monthlyCleanup() {
  // Conservative threshold for automated cleanup
  const result = await compress_graph({
    threshold: 0.85,
    dryRun: false
  });

  console.log(`Monthly Cleanup Report:`);
  console.log(`- Duplicates found: ${result.duplicatesFound}`);
  console.log(`- Entities merged: ${result.entitiesMerged}`);
  console.log(`- Space freed: ${result.spaceFreed} characters`);
  console.log(`- Relations consolidated: ${result.relationsConsolidated}`);

  // Archive the report
  await create_entities({
    entities: [{
      name: `Cleanup Report ${new Date().toISOString()}`,
      entityType: "maintenance-log",
      observations: [
        `Merged ${result.entitiesMerged} duplicate entities`,
        `Saved ${result.spaceFreed} characters`
      ],
      tags: ["maintenance", "compression"],
      importance: 3
    }]
  });
}
```

### Use Case 3: Case-Insensitive Deduplication

**Scenario:** Multiple entities with same name but different capitalization.

```javascript
// Find case variants
const entities = await read_graph();
const nameMap = new Map();

entities.entities.forEach(e => {
  const lowerName = e.name.toLowerCase();
  if (!nameMap.has(lowerName)) {
    nameMap.set(lowerName, []);
  }
  nameMap.get(lowerName).push(e.name);
});

// Merge case variants
for (const [lowerName, variants] of nameMap) {
  if (variants.length > 1) {
    console.log(`Merging: ${variants.join(', ')}`);
    await merge_entities({ entityNames: variants });
  }
}
```

### Use Case 4: Targeted Compression by Type

**Scenario:** Compress only specific entity types (e.g., clean up "person" entities).

```javascript
async function compressByType(entityType, threshold = 0.8) {
  // Get all entities of type
  const graph = await read_graph();
  const typeEntities = graph.entities
    .filter(e => e.entityType === entityType)
    .map(e => e.name);

  console.log(`Checking ${typeEntities.length} "${entityType}" entities...`);

  // Find duplicates among this type
  const allDuplicates = await find_duplicates({ threshold });

  // Filter to only this type
  const typeDuplicates = allDuplicates.duplicates.filter(d =>
    typeEntities.includes(d.entity1) && typeEntities.includes(d.entity2)
  );

  console.log(`Found ${typeDuplicates.length} duplicate pairs in "${entityType}"`);

  // Merge each duplicate pair
  const merged = new Set();
  for (const dup of typeDuplicates) {
    if (!merged.has(dup.entity1) && !merged.has(dup.entity2)) {
      await merge_entities({ entityNames: [dup.entity1, dup.entity2] });
      merged.add(dup.entity2);
    }
  }

  console.log(`Merged ${merged.size} duplicate "${entityType}" entities`);
}

// Usage
await compressByType("person", 0.8);
await compressByType("project", 0.85);
```

---

## Best Practices

### 1. Always Preview First

**Never** run compression without reviewing the preview:

```javascript
✅ GOOD: Safe workflow
const preview = await compress_graph({ threshold: 0.8, dryRun: true });
// Review preview.mergedEntities
if (looks_good) {
  await compress_graph({ threshold: 0.8, dryRun: false });
}

❌ BAD: Direct execution
await compress_graph({ threshold: 0.7, dryRun: false });  // Risky!
```

### 2. Start Conservative

Use **higher thresholds** initially, then lower if needed:

```javascript
// Recommended progression
1. Start: threshold 0.9  (very strict - obvious duplicates only)
2. Review: threshold 0.85 (strict - high confidence)
3. Careful: threshold 0.8  (balanced - default)
4. Manual: threshold 0.7  (sensitive - review each merge)
```

### 3. Compression by Phases

Break large compressions into manageable phases:

```javascript
// Phase 1: Obvious duplicates (very high similarity)
await compress_graph({ threshold: 0.9, dryRun: false });

// Phase 2: High confidence (after review)
await compress_graph({ threshold: 0.85, dryRun: false });

// Phase 3: Manual review (identify borderline cases)
const borderline = await find_duplicates({ threshold: 0.75 });
// Manually review and merge selectively
```

### 4. Preserve Important Entities

Ensure important entities are the merge target:

```javascript
// When merging, specify the canonical entity as target
merge_entities({
  entityNames: ["Project Alpha", "project-alpha", "PROJ-ALPHA"],
  targetName: "Project Alpha"  // Keep the official name
})
```

### 5. Document Compression Activity

Track compression history for auditing:

```javascript
async function documentedCompression(threshold) {
  const before = await get_graph_stats();

  const result = await compress_graph({ threshold, dryRun: false });

  const after = await get_graph_stats();

  await create_entities({
    entities: [{
      name: `Compression ${new Date().toISOString()}`,
      entityType: "compression-log",
      observations: [
        `Threshold: ${threshold}`,
        `Before: ${before.totalEntities} entities`,
        `After: ${after.totalEntities} entities`,
        `Merged: ${result.entitiesMerged} entities`,
        `Space freed: ${result.spaceFreed} characters`,
        `Merged groups: ${result.mergedEntities.map(m => m.kept).join(', ')}`
      ],
      tags: ["compression", "maintenance", "audit"],
      importance: 5
    }]
  });

  return result;
}
```

### 6. Validate After Compression

Check graph integrity after major compressions:

```javascript
// Run validation
const validation = await validate_graph();

if (validation.errors.length > 0) {
  console.error("Compression created errors:", validation.errors);
  // Consider restoring from backup
}

if (validation.warnings.length > 0) {
  console.warn("Compression warnings:", validation.warnings);
}
```

---

## Advanced Patterns

### Pattern 1: Similarity Clustering

Group entities by similarity to find clusters of duplicates:

```javascript
async function findSimilarityClusters(threshold = 0.8) {
  const duplicates = await find_duplicates({ threshold });

  // Build adjacency map
  const adjacency = new Map();

  duplicates.duplicates.forEach(({ entity1, entity2, similarity }) => {
    if (!adjacency.has(entity1)) adjacency.set(entity1, []);
    if (!adjacency.has(entity2)) adjacency.set(entity2, []);

    adjacency.get(entity1).push({ entity: entity2, similarity });
    adjacency.get(entity2).push({ entity: entity1, similarity });
  });

  // Find connected components (clusters)
  const visited = new Set();
  const clusters = [];

  function dfs(entity, cluster) {
    if (visited.has(entity)) return;
    visited.add(entity);
    cluster.push(entity);

    const neighbors = adjacency.get(entity) || [];
    neighbors.forEach(({ entity: neighbor }) => {
      dfs(neighbor, cluster);
    });
  }

  adjacency.forEach((_, entity) => {
    if (!visited.has(entity)) {
      const cluster = [];
      dfs(entity, cluster);
      if (cluster.length > 1) {
        clusters.push(cluster);
      }
    }
  });

  return clusters;
}

// Usage
const clusters = await findSimilarityClusters(0.8);
console.log(`Found ${clusters.length} clusters of similar entities`);

clusters.forEach((cluster, i) => {
  console.log(`Cluster ${i + 1}: ${cluster.join(', ')}`);

  // Option to merge entire cluster
  // await merge_entities({ entityNames: cluster });
});
```

### Pattern 2: Selective Field Merging

Custom merge logic for specific scenarios:

```javascript
async function smartMerge(entities, strategy) {
  // Get full entity data
  const fullEntities = await open_nodes({ names: entities });

  let targetName;
  if (strategy === "most-important") {
    targetName = fullEntities.reduce((max, e) =>
      (e.importance || 0) > (max.importance || 0) ? e : max
    ).name;
  } else if (strategy === "newest") {
    targetName = fullEntities.reduce((newest, e) =>
      new Date(e.lastModified || e.createdAt) > new Date(newest.lastModified || newest.createdAt) ? e : newest
    ).name;
  } else if (strategy === "oldest") {
    targetName = fullEntities.reduce((oldest, e) =>
      new Date(e.createdAt || e.lastModified) < new Date(oldest.createdAt || oldest.lastModified) ? e : oldest
    ).name;
  }

  return merge_entities({
    entityNames: entities,
    targetName
  });
}

// Usage
await smartMerge(["Entity A", "Entity B", "Entity C"], "most-important");
```

### Pattern 3: Incremental Compression

Process large graphs incrementally to avoid memory issues:

```javascript
async function incrementalCompression(threshold, batchSize = 50) {
  const graph = await read_graph();
  const entities = graph.entities.map(e => e.name);

  let totalMerged = 0;

  // Process in batches
  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);

    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}...`);

    // Find duplicates within batch
    const duplicates = await find_duplicates({ threshold });

    // Filter to batch entities
    const batchDuplicates = duplicates.duplicates.filter(d =>
      batch.includes(d.entity1) && batch.includes(d.entity2)
    );

    // Merge batch duplicates
    const merged = new Set();
    for (const dup of batchDuplicates) {
      if (!merged.has(dup.entity1) && !merged.has(dup.entity2)) {
        await merge_entities({ entityNames: [dup.entity1, dup.entity2] });
        merged.add(dup.entity2);
        totalMerged++;
      }
    }
  }

  console.log(`Incremental compression complete: ${totalMerged} entities merged`);
  return totalMerged;
}
```

---

## Troubleshooting

### Issue: Too Many False Positives

**Problem:** Compression merges entities that shouldn't be merged.

**Solution:** Increase threshold for stricter matching.

```javascript
// Too aggressive (merges too much)
compress_graph({ threshold: 0.7 })  ❌

// More conservative
compress_graph({ threshold: 0.85 })  ✅
```

### Issue: Missing Obvious Duplicates

**Problem:** Entities that are clearly duplicates are not being detected.

**Solution:** Lower threshold or check entity structure.

```javascript
// Check similarity score manually
const duplicates = await find_duplicates({ threshold: 0.6 });
duplicates.duplicates.forEach(d => {
  console.log(`${d.entity1} <-> ${d.entity2}: ${d.similarity}`);
});

// If similarity is lower than expected, investigate:
const entities = await open_nodes({ names: ["Entity A", "Entity B"] });
console.log("Entity A:", entities[0]);
console.log("Entity B:", entities[1]);

// Common reasons for low similarity:
// - Different entity types (20% penalty)
// - Few overlapping observations
// - Missing tags
// - Very different names
```

### Issue: Important Data Lost During Merge

**Problem:** Merge removed observations or tags that should have been kept.

**Solution:** This shouldn't happen! Merging preserves all unique data. Verify:

```javascript
// Before merge
const before = await open_nodes({ names: ["Entity A", "Entity B"] });
console.log("Before:", before);

// After merge
const merged = await merge_entities({ entityNames: ["Entity A", "Entity B"] });
console.log("After:", merged);

// Check that all observations and tags are present
// If data is missing, this is a bug - report it!
```

### Issue: Relations Not Redirected

**Problem:** After merging, relations still point to deleted entities.

**Solution:** Validate graph integrity.

```javascript
// Check for orphaned relations
const validation = await validate_graph();

validation.errors.forEach(error => {
  if (error.includes("orphaned relation")) {
    console.error("Found orphaned relation:", error);
  }
});

// This should not happen - merging automatically redirects relations
// If orphaned relations exist, this is a bug
```

### Issue: Compression is Too Slow

**Problem:** `compress_graph` takes too long on large graphs.

**Solution:** Use incremental compression or target specific types.

```javascript
// Option 1: Incremental processing
await incrementalCompression(0.8, 50);  // Process 50 entities at a time

// Option 2: Compress by type
await compressByType("project", 0.8);
await compressByType("task", 0.8);
await compressByType("person", 0.8);
```

---

## Integration Examples

### With Search

```javascript
// Find duplicates in search results
const searchResults = await search_nodes({ query: "project" });
const resultNames = searchResults.map(e => e.name);

const duplicates = await find_duplicates({ threshold: 0.8 });
const searchDuplicates = duplicates.duplicates.filter(d =>
  resultNames.includes(d.entity1) && resultNames.includes(d.entity2)
);

console.log(`Found ${searchDuplicates.length} duplicates in search results`);
```

### With Hierarchies

```javascript
// Compress entities within a specific subtree
const subtree = await get_subtree({ entityName: "Project Alpha" });
const subtreeNames = subtree.entities.map(e => e.name);

// Find duplicates within subtree
const allDuplicates = await find_duplicates({ threshold: 0.8 });
const subtreeDuplicates = allDuplicates.duplicates.filter(d =>
  subtreeNames.includes(d.entity1) && subtreeNames.includes(d.entity2)
);

// Merge subtree duplicates
for (const dup of subtreeDuplicates) {
  await merge_entities({ entityNames: [dup.entity1, dup.entity2] });
}
```

### With Tags

```javascript
// Compress entities with specific tag
const graph = await read_graph();
const taggedEntities = graph.entities
  .filter(e => e.tags?.includes("needs-cleanup"))
  .map(e => e.name);

// Aggressive compression for cleanup-tagged entities
const duplicates = await find_duplicates({ threshold: 0.75 });
const taggedDuplicates = duplicates.duplicates.filter(d =>
  taggedEntities.includes(d.entity1) && taggedEntities.includes(d.entity2)
);

for (const dup of taggedDuplicates) {
  await merge_entities({ entityNames: [dup.entity1, dup.entity2] });
  console.log(`Cleaned up: ${dup.entity2} → ${dup.entity1}`);
}
```

---

## Summary

Memory compression provides intelligent duplicate detection and merging:

✅ **Intelligent**: Multi-factor similarity algorithm with 4 weighted factors
✅ **Safe**: Dry-run preview mode prevents accidental data loss
✅ **Flexible**: Configurable thresholds for different use cases
✅ **Preserving**: All unique observations, tags, and relations are kept
✅ **Automated**: One-command compression for routine maintenance

**Recommended Workflow:**
1. Run `find_duplicates` to assess duplicate count
2. Preview with `compress_graph({ threshold: 0.8, dryRun: true })`
3. Review `mergedEntities` list carefully
4. Execute with `compress_graph({ threshold: 0.8, dryRun: false })`
5. Validate with `validate_graph`

**Next Steps:**
- Read [HIERARCHY_GUIDE.md](HIERARCHY_GUIDE.md) for organizing entities
- Read [ARCHIVING_GUIDE.md](ARCHIVING_GUIDE.md) for memory lifecycle management
- See [API Reference](README.md#api-reference) for complete tool documentation
