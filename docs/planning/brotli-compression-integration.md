# Brotli Compression Integration Planning

## Executive Summary

This document outlines a strategic plan to integrate brotli compression into the memory-mcp knowledge graph system. Brotli offers 15-20% better compression than gzip, with particular benefits for JSON data (60-75% compression typical). Integration can be phased, non-intrusive, and backward-compatible.

---

## 1. Current State Analysis

### Project Overview

**memory-mcp** is an enhanced Model Context Protocol (MCP) memory server providing enterprise-grade knowledge graph storage.

- **Version:** 8.50.24
- **Language:** TypeScript 5.6, Node.js 18+
- **Storage Backends:** JSONL (default) and SQLite (optional)
- **Scale:** Handles 2,000-100,000 entities efficiently
- **47 Tools:** Comprehensive knowledge graph management vs. 11 in the official version

### Knowledge Graph Data Storage

#### JSONL Format (Primary)
- **File:** `memory.jsonl` (line-delimited JSON)
- **Structure:** Each line is a complete JSON object (entity or relation)
- **Deduplication:** Handled on load; later entries override earlier ones
- **Auxiliary Files:**
  - `memory-saved-searches.jsonl` - Saved search queries
  - `memory-tag-aliases.jsonl` - Tag synonym mappings
  - `.backups/` directory - Timestamped backup snapshots

#### SQLite Format (Optional)
- **File:** `memory.db`
- **Engine:** better-sqlite3 (native SQLite binding)
- **Features:** FTS5 full-text search, referential integrity, WAL mode, B-tree indexes
- **Tables:** entities, relations, entities_fts

#### Entity Data Structure
```typescript
interface Entity {
  name: string;              // Unique identifier
  entityType: string;        // Classification
  observations: string[];    // Facts about the entity
  parentId?: string;         // Hierarchical nesting
  createdAt: string;         // ISO 8601 timestamp
  lastModified: string;      // ISO 8601 timestamp
  tags?: string[];           // Categorization
  importance?: number;       // 0-10 priority scale
}
```

#### Relation Data Structure
```typescript
interface Relation {
  from: string;              // Source entity name
  to: string;                // Target entity name
  relationType: string;      // Relationship type
  createdAt: string;         // ISO 8601 timestamp
  lastModified: string;      // ISO 8601 timestamp
}
```

### Typical Data Sizes

| Metric | Value | Notes |
|--------|-------|-------|
| **Max Entities** | 100,000 | Hard limit in GRAPH_LIMITS |
| **Max Relations** | 1,000,000 | Hard limit in GRAPH_LIMITS |
| **Max File Size** | 500 MB | Hard limit in GRAPH_LIMITS |
| **Typical Graph Size** | 2,000+ entities | Performs well up to 100k |
| **Avg JSON Line Size** | 200-300 bytes | Varies by content |
| **Real-World Estimate (5K entities)** | ~1.25 MB | Uncompressed |
| **Real-World Estimate (50K entities)** | ~12.5 MB | Uncompressed |

### Current Compression/Optimization Strategies

**Existing "Compression"** - Entity deduplication, NOT data compression:
- **Tools:** `find_duplicates`, `merge_entities`, `compress_graph`
- **Algorithm:** Multi-factor similarity scoring (name 40%, type 20%, observations 30%, tags 10%)
- **Performance:** 50x faster than naive O(n²) via two-level bucketing

**File Optimization Techniques:**
- Append-only pattern (reduces I/O overhead)
- Automatic compaction at 100 appends threshold
- In-memory cache with O(1) access
- Lazy initialization of managers
- Pre-computed lowercase cache

---

## 2. Brotli Compression Benefits

### Compression Ratios
| File Type | Original | gzip | brotli | brotli Savings |
|-----------|----------|------|--------|----------------|
| HTML (100KB) | 100KB | 25KB | 21KB | 16% smaller |
| CSS (50KB) | 50KB | 12KB | 10KB | 17% smaller |
| JavaScript (200KB) | 200KB | 60KB | 48KB | 20% smaller |
| JSON (80KB) | 80KB | 18KB | 15KB | 17% smaller |

**Real-World Example (jQuery):**
- Uncompressed: 290KB
- gzip: 85KB
- brotli: 72KB (15% smaller than gzip)

### Why Brotli Wins for This Project

- **JSON Optimized:** Better dictionary for JSON patterns common in knowledge graphs
- **Text-Heavy Data:** Observations, entity names, tags compress very well
- **Backup Archives:** 50-70% space reduction with minimal performance impact
- **Network Efficiency:** Fast decompression; suitable for MCP responses

### Compression Overhead Analysis

| Operation | Current | With Brotli | Notes |
|-----------|---------|------------|-------|
| **Entity Write** | 1-2ms | +0.5-2ms | Minimal; append-only unaffected |
| **Graph Load (5K entities)** | 50ms | +10-15ms | Negligible decompression |
| **Large Export (100K entities)** | 500ms | +50-100ms | Worthwhile for 60-75% ratio |
| **Backup Creation** | 100ms | +50ms | Worth it; infrequent operation |

---

## 3. Ideal Integration Points (Priority Order)

### Priority 1: Backup Files (Highest ROI) ⭐

**Location:** `.backups/` directory backup creation

**Current State:**
- Full JSONL backups stored uncompressed
- Timestamped snapshots in `.backups/`

**Opportunity:**
- Compress timestamped backup snapshots with brotli
- Backups are infrequently accessed (cold storage)
- High compression ratio on repetitive JSON

**Benefits:**
- 50-70% space reduction typical
- Minimal performance impact (backups infrequent)
- Zero impact on real-time operations
- Clean data lineage preservation

**Implementation File:** `src/memory/features/IOManager.ts` - `createBackup()` method

**Expected Space Savings:**
- 100 backups × 1.25 MB each = 125 MB → 37.5 MB (70% compression)
- 100 backups × 12.5 MB each = 1.25 GB → 375 MB (70% compression)

---

### Priority 2: Exported Graphs

**Location:** Export functionality in `IOManager.ts`

**Current State:**
- 7 export formats available: JSON, GraphML, GEXF, CSV, Markdown, Mermaid, DOT
- Exports sent uncompressed
- No compression metadata returned

**Opportunity:**
- Auto-compress large exports (>100KB)
- Return compression metadata (original size, compressed size)
- All formats can benefit, especially JSON/GraphML

**Benefits:**
- 60-75% compression typical on JSON/GraphML
- Users can download smaller files
- Enables efficient export archiving
- Optional compression based on size threshold

**Implementation Files:**
- `src/memory/features/IOManager.ts` - all `exportGraph*` methods
- Tool handlers that call export methods

**Compression Quality Recommendation:** 6-8 (good balance of speed/ratio)

---

### Priority 3: MCP Protocol Responses

**Location:** Tool response serialization in MCP server

**Current State:**
- All tool responses sent as raw JSON via MCP protocol
- Large graph exports/reads produce massive payloads
- No compression between MCP server and client

**Opportunity:**
- Wrap tool responses with auto-compression for large payloads
- Add compression metadata to response envelope
- Client can auto-detect and decompress

**Benefits:**
- Reduces bandwidth between Claude and MCP server
- Essential for cloud deployments
- Minimal impact on small responses
- Progressive streaming capability

**Implementation File:** `src/memory/server/MCPServer.ts` - response wrapper in `toolCall()` method

**Threshold:** Compress responses >256KB

**Response Format:**
```typescript
{
  compressed: boolean;
  compressionFormat: 'brotli' | 'none';
  originalSize?: number;
  data: string | Buffer;
}
```

---

### Priority 4: Archived Entity Data

**Location:** Entity archival operations

**Current State:**
- Archived entities written to separate files
- Stored uncompressed

**Opportunity:**
- Compress archived entity data streams
- Archived data rarely accessed (cold storage)
- Clean separation of active vs. historical data

**Benefits:**
- Efficient long-term storage
- Significant space savings for aged archives
- Doesn't impact active entity performance

**Implementation File:** `src/memory/core/EntityManager.ts` - archival methods

---

### Priority 5: In-Memory Cache Layer

**Location:** Graph caching in storage layer

**Current State:**
- Complete graph cached in RAM uncompressed
- LowercaseCache pre-computed for search optimization
- TF-IDF indexes cached in memory

**Opportunity:**
- Compress inactive/old entities in cache
- Selective compression of least-accessed data
- Decompress on access with usage metrics

**Benefits:**
- Reduces RAM footprint for 50k+ entity graphs
- Decompression overhead justified by space savings
- Better scaling for large deployments

**Implementation File:** `src/memory/core/GraphStorage.ts` or `SQLiteStorage.ts` - cache management

**Compression Quality:** 5 (optimize for fast decompression)

---

## 4. Implementation Considerations

### Storage Abstraction Pattern

**Current Architecture:**
```typescript
interface IGraphStorage {
  loadGraph(): Promise<ReadonlyKnowledgeGraph>;
  saveGraph(graph: KnowledgeGraph): Promise<void>;
  appendEntity(entity: Entity): Promise<void>;
  appendRelation(relation: Relation): Promise<void>;
  updateEntity(entityName: string, updates: Partial<Entity>): Promise<boolean>;
  compact(): Promise<void>;
}
```

**Compression Integration Advantage:**
- Can add compression to file I/O layer without changing interface
- GraphStorage already abstracts file format
- StorageFactory could offer compression option
- **Fully backward compatible** - JSONL format unchanged; compression external

### Concurrency & Mutex Impact

**Current Protection:**
- Async-mutex protects storage operations
- File writes protected from concurrent access

**Brotli Impact Analysis:**
- Compression adds CPU time, not I/O contention
- Mutex still protects file writes (no change)
- Decompression can happen before acquiring lock (pre-load)
- No deadlock risk introduced

### Backward Compatibility

**Critical Requirement:** Existing uncompressed JSONL files must work alongside compressed ones

**Solutions:**

1. **File Extension Detection:** Detect compression format on load
   - JSONL: File extension `.jsonl`
   - Brotli-compressed: File extension `.br` (Note: Brotli does NOT have reliable magic bytes)

2. **Version Metadata:** Store compression info in backup metadata
   ```typescript
   interface BackupMetadata {
     compressed: boolean;
     compressionFormat: 'brotli' | 'none';
     originalSize: number;
     compressedSize: number;
     originalChecksum: string;
     createdAt: string;
   }
   ```

3. **Graceful Fallback:** Try decompression; fallback to uncompressed

### Error Handling Considerations

- **Corrupt compressed files:** Verify checksums before/after operations
- **Decompression failures:** Retry with exponential backoff; fallback to uncompressed
- **Out-of-memory:** Stream decompression for large files
- **Partial writes:** Atomic operations with temporary file swap
- **Concurrent access:** Mutex protects decompression to cache

---

## 5. Brotli Configuration Recommendations

| Use Case | Quality Level | Speed | Ratio | When to Use |
|----------|---------------|-------|-------|------------|
| Real-time writes | 4 | Fastest | Good | Entity writes |
| Batch operations | 6-8 | Moderate | Excellent | Exports, imports |
| Archive/backup | 10-11 | Slowest | Maximum | Cold storage |
| Cache compression | 5 | Fast | Good | LRU cache eviction |

**Rationale:**
- Quality 4: 1-2ms overhead acceptable for real-time
- Quality 6-8: 50-100ms acceptable for infrequent exports/backups
- Quality 10-11: CPU time irrelevant for archive operations
- Quality 5: Balance between space and decompression speed for cache

---

## 6. New Utility Files Required

### `src/memory/utils/compressionUtil.ts`

Unified brotli interface wrapping the npm package:

```typescript
interface CompressionOptions {
  quality: number;          // 0-11, default 6
  lgwin?: number;           // Window size
  mode?: 'text' | 'generic'; // Compression mode
}

interface CompressionResult {
  compressed: Buffer;
  originalSize: number;
  compressedSize: number;
  ratio: number;            // compressedSize / originalSize
}

export async function compress(
  data: Buffer | string,
  options?: CompressionOptions
): Promise<CompressionResult>;

export async function decompress(data: Buffer): Promise<Buffer>;

export function getCompressionRatio(original: number, compressed: number): number;

export async function compressFile(
  inputPath: string,
  outputPath: string,
  options?: CompressionOptions
): Promise<CompressionResult>;

export async function decompressFile(
  inputPath: string,
  outputPath: string
): Promise<void>;

// Check if file path indicates brotli compression (check .br extension)
export function hasBrotliExtension(filePath: string): boolean;
```

### `src/memory/utils/constants.ts` Additions

```typescript
export const COMPRESSION_CONFIG = {
  BROTLI_QUALITY_REALTIME: 4,      // Entity writes
  BROTLI_QUALITY_BATCH: 6,         // Exports, imports
  BROTLI_QUALITY_ARCHIVE: 11,      // Backups, archives
  BROTLI_QUALITY_CACHE: 5,         // Cache compression

  // Thresholds for auto-compression
  AUTO_COMPRESS_EXPORT_SIZE: 100 * 1024,    // 100KB
  AUTO_COMPRESS_RESPONSE_SIZE: 256 * 1024,  // 256KB

  // File extension for compressed files
  // Note: Brotli does NOT have reliable magic bytes - use file extension instead
  BROTLI_EXTENSION: '.br',

  // Performance tuning
  COMPRESSION_CHUNK_SIZE: 65536,    // 64KB chunks for streaming
};
```

---

## 7. File Locations for Integration

| File | Current Purpose | Integration Point | Priority |
|------|-----------------|-------------------|----------|
| `src/memory/features/IOManager.ts` | Import/export/backup | Compress backups & exports | P1 |
| `src/memory/core/GraphStorage.ts` | JSONL storage | Transparent compression wrapper | P2 |
| `src/memory/server/MCPServer.ts` | MCP protocol | Response compression | P2 |
| `src/memory/core/EntityManager.ts` | Entity management | Archive compression | P3 |
| `src/memory/utils/compressionUtil.ts` | **NEW** | Unified brotli interface | P0 |
| `src/memory/utils/constants.ts` | Configuration | Compression constants | P0 |
| `src/memory/__tests__/` | Tests | Compression test suite | P0 |
| `package.json` | Dependencies | Verify Node.js engines >= 11.7.0 | P0 |
| `docs/guides/COMPRESSION.md` | **NEW** | Usage documentation | P3 |

---

## 8. Implementation Phases (Recommended Order)

### Phase 1: Foundation & Backup Compression
- [ ] Verify Node.js version >= 11.7.0 for built-in brotli (via `zlib` module)
- [ ] Create `utils/compressionUtil.ts` with unified API
- [ ] Add compression configuration to `constants.ts`
- [ ] Implement backup compression in `IOManager.createBackup()`
- [ ] Add compression metadata tracking
- [ ] Write comprehensive unit tests
- [ ] **Benefit:** Immediate 50-70% backup space reduction

### Phase 2: Export Compression
- [ ] Implement auto-compression for large exports (>100KB)
- [ ] Add compression option to `export_graph` tool
- [ ] Return compression metadata in tool responses
- [ ] Test all 7 export formats (JSON, GraphML, GEXF, CSV, Markdown, Mermaid, DOT)
- [ ] Update tool documentation
- [ ] **Benefit:** 60-75% reduction on exported graphs

### Phase 3: MCP Protocol Response Compression
- [ ] Wrap tool responses with auto-compression in `MCPServer.ts`
- [ ] Add configuration for response size threshold
- [ ] Implement response decompression in client examples
- [ ] Document compression in API reference
- [ ] Create client-side decompression utilities
- [ ] **Benefit:** Reduced bandwidth between Claude and MCP server

### Phase 4: Archive & Cache Compression
- [ ] Implement archive compression in `EntityManager.ts`
- [ ] Add cache layer compression (LRU with eviction)
- [ ] Implement incremental backup compression
- [ ] Add compression statistics to graph analytics
- [ ] **Benefit:** Efficient long-term storage, reduced RAM usage

### Phase 5: Optimization & Documentation
- [ ] Tune brotli quality levels for different operations
- [ ] Performance benchmarking and profiling
- [ ] Create migration guide for compressed archives
- [ ] Update CLAUDE.md with compression guidance
- [ ] Create `docs/guides/COMPRESSION.md` with configuration details
- [ ] **Benefit:** Production-ready implementation with clear guidance

---

## 9. Testing Strategy

### Unit Tests

**File:** `src/memory/__tests__/compressionUtil.test.ts`

- Test compress/decompress roundtrip
- Test brotli magic byte detection
- Test different quality levels
- Test large buffer compression
- Test error handling (corrupt data)
- Test file compression/decompression
- Benchmark compression ratios by quality level

### Integration Tests

**File:** `src/memory/__tests__/IOManager.test.ts` (extend)

- Test backup compression end-to-end
- Test export compression with all formats
- Test backward compatibility (uncompressed → compressed)
- Test backup restoration from compressed files

### Performance Tests

- Measure compression overhead for different quality levels
- Benchmark real-world graph compression
- Compare backup creation with/without compression
- Profile memory usage with cache compression

---

## 10. Data Flow Visualization

```
┌─────────────────────────────────────────────────────────────┐
│                   MCP Client (Claude)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                    Tool Call Request
                    (tool_name, args)
                         │
        ┌────────────────▼─────────────────┐
        │ MCPServer.ts                      │
        │ (toolCall dispatcher)             │
        │ ↓ Auto-compress responses >256KB  │ P3
        └────────────────┬──────────────────┘
                         │
         ┌───────────────▼────────────────────┐
         │ toolHandlers.ts (47 handlers)      │
         │ - create_entities                  │
         │ - export_graph → compress >100KB   │ P2
         │ - compress_graph                   │
         │ - archive_entities                 │ P4
         └───────────────┬────────────────────┘
                         │
         ┌───────────────▼────────────────────┐
         │ Managers (EntityManager, etc.)     │
         │ - Heavy lifting                    │
         │ - Coordinate storage/search        │
         └───────────────┬────────────────────┘
                         │
         ┌───────────────▼────────────────────────────┐
         │ Storage Layer                              │
         ├─────────────────────────────────────────────┤
         │ GraphStorage.ts (JSONL)                    │
         │ - appendEntity() → serialize → write       │
         │ - loadGraph() → read → deserialize         │
         │                                            │
         │ SQLiteStorage.ts (Native SQLite)           │
         │ - appendEntity() → SQL insert              │
         │ - loadGraph() → SQL select                 │
         └────────────────┬────────────────────────────┘
                         │
         ┌───────────────▼──────────────────────┐
         │ FILE I/O + Compression (P0-P3)       │
         │ memory.jsonl                         │
         │ memory.db                            │
         │ .backups/backup_*.jsonl              │
         │ .backups/backup_*.jsonl.br ← NEW    │ P1
         └─────────────────────────────────────┘

INTEGRATION PHASES:
├─ P0: Utility functions (compressionUtil.ts, constants.ts)
├─ P1: Backup compression (.backups/ directory)
├─ P2: Export compression (all 7 formats)
├─ P3: Response compression (MCP protocol)
├─ P4: Archive & cache compression (EntityManager, GraphStorage)
└─ P5: Documentation & tuning
```

---

## 11. Success Metrics

### Space Efficiency
- [ ] Backups reduced by 50-70% per file
- [ ] Exports >100KB reduced by 60-75%
- [ ] Overall disk usage reduced by 30-50% (if all phases implemented)

### Performance Impact
- [ ] Entity writes remain <3ms overhead
- [ ] Export operations remain <50-100ms overhead (acceptable)
- [ ] Graph load time increase <10-15ms
- [ ] Cache decompression <5ms

### User Experience
- [ ] Seamless backup compression (no user action required)
- [ ] Optional export compression (flag available)
- [ ] Automatic MCP response compression (transparent)
- [ ] Clear documentation on configuration

### Adoption Metrics
- [ ] Zero breaking changes for existing graphs
- [ ] Backward compatibility with pre-compressed backups
- [ ] Clear migration path from old backups

---

## 12. Risk Assessment & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| **Corrupt compressed files** | Low | High | Verify checksums; graceful fallback |
| **Decompression failures** | Low | Medium | Error handling with retry logic |
| **Out-of-memory on large decompress** | Medium | Medium | Stream decompression for files >100MB |
| **Backward compatibility issues** | Low | High | Magic byte detection; extensive testing |
| **Performance regression** | Low | Medium | Comprehensive benchmarking in Phase 5 |
| **Complexity in code** | Medium | Low | Use compressionUtil abstraction |

---

## 13. Conclusion

Brotli compression is an excellent fit for memory-mcp:

✅ **Strong Storage Abstraction** - IGraphStorage interface isolates compression logic  
✅ **Multiple Integration Points** - Backups, exports, responses, caching all benefit  
✅ **Clear Data Flow** - Append-only pattern and deduplication suit compression well  
✅ **No Core Changes** - Can add compression incrementally without refactoring  
✅ **Backward Compatible** - Existing uncompressed files work alongside compressed ones  
✅ **Immediate ROI** - Backup compression delivers 50-70% space savings immediately  

### Biggest Win
**Priority 1 (Backup Compression)** - Immediate 50-70% space savings with minimal code changes and zero performance impact on real-time operations.

### Strategic Value
Brotli compression enables memory-mcp to scale efficiently to 100k+ entity graphs, especially for cloud deployments where bandwidth and storage costs are critical factors.

### Next Steps
1. Verify Node.js 11.7.0+ for built-in zlib brotli support
2. Create compressionUtil.ts wrapper using Node.js zlib module
3. Implement backup compression (Phase 1)
4. Measure space/performance improvements
5. Proceed with Phases 2-5 based on priorities

---

## Appendix: Quick Reference

### Node.js Built-in Brotli Support

Node.js 11.7.0+ includes built-in brotli compression via the `zlib` module. **No external dependencies required.**

### Basic Usage
```typescript
import { brotliCompress, brotliDecompress, constants } from 'zlib';
import { promisify } from 'util';

const compress = promisify(brotliCompress);
const decompress = promisify(brotliDecompress);

const data = Buffer.from('your data');

// Compress with quality level
const compressed = await compress(data, {
  params: {
    [constants.BROTLI_PARAM_QUALITY]: 6,  // 0-11, default 11
  },
});

const decompressed = await decompress(compressed);
```

### Quality Levels
- **0-4**: Fast compression, lower ratio (real-time use)
- **5-8**: Balanced speed and ratio (batch operations)
- **9-11**: Maximum compression, slower (archives)
