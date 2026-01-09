# Future Features Roadmap

**Version:** 3.0.0
**Last Updated:** 2026-01-08
**Current Version:** 9.8.3
**Target Version:** 12.0.0

---

## Executive Summary

This document defines the **feature roadmap** for memory-mcp - new capabilities, tools, and functionality. For performance optimizations, see `PERFORMANCE_AND_CAPABILITIES.md`.

*Note: This is a **parallel development track** to `PERFORMANCE_AND_CAPABILITIES.md`. Both documents use Phase 6+ numbering independently. Features and performance optimizations can be developed concurrently.*

**Feature Goals:**
1. **Intelligent Memory System** - Transform from storage to understanding
2. **Three-Layer Hybrid Search** - Multi-signal retrieval (semantic + lexical + symbolic)
3. **Query Understanding** - Natural language query analysis and planning
4. **Semantic Compression** - Self-contained, disambiguated facts
5. **5 New MCP Tools** - hybrid_search, smart_search, search_auto, normalize_observations, analyze_query

**Inspired by**: SimpleMem three-stage semantic lossless compression architecture.

---

## Table of Contents

1. [Vision: Intelligent Memory System](#vision-intelligent-memory-system)
2. [Existing Capabilities](#existing-capabilities)
3. [Phase 6: Three-Layer Hybrid Search](#phase-6-three-layer-hybrid-search)
4. [Phase 7: Intelligent Retrieval](#phase-7-intelligent-retrieval)
5. [Phase 8: Semantic Compression](#phase-8-semantic-compression)
6. [Phase 9: Adaptive Query Intelligence](#phase-9-adaptive-query-intelligence)
7. [Phase 10: Persistent Vector Storage](#phase-10-persistent-vector-storage)
8. [New MCP Tools Summary](#new-mcp-tools-summary)
9. [Architecture Evolution](#architecture-evolution)
10. [Version Roadmap](#version-roadmap)

---

## Vision: Intelligent Memory System

Transform memory-mcp from a knowledge graph storage system into an **intelligent memory system** that:

1. **Understands queries** - Decomposes complex questions into targeted sub-queries
2. **Retrieves intelligently** - Combines semantic, lexical, and symbolic search signals
3. **Adapts dynamically** - Adjusts retrieval depth based on query complexity
4. **Compresses efficiently** - Stores self-contained, disambiguated facts
5. **Reflects on adequacy** - Iteratively refines results until sufficient

**Feature Goals** (inspired by SimpleMem benchmarks):
- **Retrieval accuracy**: 2-5x improvement via hybrid scoring with semantic + lexical + symbolic signals
- **Query understanding**: Automatic decomposition of complex multi-hop queries
- **Semantic quality**: Self-contained facts via coreference resolution and temporal anchoring

*Note: Performance improvements (token efficiency, duplicate detection speed) are tracked in `PERFORMANCE_AND_CAPABILITIES.md`.*

---

## Existing Capabilities

### Already Implemented (v9.8.3)

| Component | Status | Location |
|-----------|--------|----------|
| **Semantic Search** | ✅ Complete | `src/search/SemanticSearch.ts` |
| **Embedding Service** | ✅ OpenAI + Local | `src/search/EmbeddingService.ts` |
| **Vector Store** | ✅ In-memory | `src/search/VectorStore.ts` |
| **TF-IDF Ranked Search** | ✅ Complete | `src/search/RankedSearch.ts` |
| **Boolean Search** | ✅ AND/OR/NOT | `src/search/BooleanSearch.ts` |
| **Fuzzy Search** | ✅ Levenshtein | `src/search/FuzzySearch.ts` |
| **Query Cost Estimator** | ✅ Basic | `src/search/QueryCostEstimator.ts` |
| **NameIndex/TypeIndex** | ✅ O(1) lookups | `src/core/GraphStorage.ts` |
| **Observation Index** | ✅ Inverted index | `src/utils/indexes.ts` |
| **Worker Pool** | ✅ Parallel fuzzy | `src/workers/` |
| **Streaming Export** | ✅ Large graphs | `src/features/StreamingExporter.ts` |
| **55 MCP Tools** | ✅ Complete | `src/server/toolDefinitions.ts` |

---

## Phase 6: Three-Layer Hybrid Search

**Goal**: Implement SimpleMem's three-layer indexing architecture as a new search feature.
**Effort**: 30 hours | **New Tools**: 1 (hybrid_search)

### 6.1 Unified Search Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HYBRID SEARCH ENGINE                      │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: SEMANTIC (Dense)    │ Vector similarity via       │
│  - SemanticSearch.ts          │ embeddings (ANN search)     │
├───────────────────────────────┼─────────────────────────────┤
│  Layer 2: LEXICAL (Sparse)    │ Keyword matching via        │
│  - TF-IDF + BM25 scoring      │ inverted index              │
├───────────────────────────────┼─────────────────────────────┤
│  Layer 3: SYMBOLIC (Metadata) │ Structured filtering via    │
│  - Tags, timestamps, types    │ boolean predicates          │
└───────────────────────────────┴─────────────────────────────┘
```

### 6.2 HybridSearchManager

**File**: `src/search/HybridSearchManager.ts` (new)

```typescript
interface HybridSearchOptions {
  semanticWeight: number;      // Default: 0.5
  lexicalWeight: number;       // Default: 0.3
  symbolicWeight: number;      // Default: 0.2

  // Layer-specific options
  semantic: { minSimilarity: number; topK: number };
  lexical: { useStopwords: boolean; useStemming: boolean };
  symbolic: {
    tags?: string[];
    entityTypes?: string[];
    dateRange?: { start: string; end: string };
    importance?: { min: number; max: number };
  };
}

interface HybridSearchResult {
  entity: Entity;
  scores: {
    semantic: number;
    lexical: number;
    symbolic: number;
    combined: number;
  };
  matchedLayers: ('semantic' | 'lexical' | 'symbolic')[];
}

class HybridSearchManager {
  constructor(
    private semanticSearch: SemanticSearch,
    private rankedSearch: RankedSearch,
    private filterChain: SearchFilterChain
  ) {}

  async search(
    query: string,
    options: HybridSearchOptions
  ): Promise<HybridSearchResult[]> {
    // Execute all layers and merge results
  }

  async searchWithPlan(
    query: string,
    plan: QueryPlan
  ): Promise<HybridSearchResult[]> {
    // Execute according to query plan
  }
}
```

### 6.3 Symbolic Metadata Search

**File**: `src/search/SymbolicSearch.ts` (new)

```typescript
interface SymbolicFilters {
  persons?: string[];           // Person names mentioned
  entityTypes?: string[];       // Entity type filter
  tags?: string[];              // Tag filter
  timestampRange?: { start: string; end: string };
  importance?: { min: number; max: number };
  parentId?: string;            // Hierarchy filter
  hasObservations?: boolean;
}

class SymbolicSearch {
  /**
   * Filter entities using structured metadata predicates.
   * All filters are AND-combined.
   */
  search(entities: Entity[], filters: SymbolicFilters): SymbolicResult[] {
    // Filter by each criterion
  }
}
```

### 6.4 New MCP Tool: `hybrid_search`

```typescript
{
  name: 'hybrid_search',
  description: 'Search using combined semantic, lexical, and metadata signals',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      weights: {
        type: 'object',
        properties: {
          semantic: { type: 'number', default: 0.5 },
          lexical: { type: 'number', default: 0.3 },
          symbolic: { type: 'number', default: 0.2 }
        }
      },
      filters: {
        type: 'object',
        properties: {
          tags: { type: 'array', items: { type: 'string' } },
          entityTypes: { type: 'array', items: { type: 'string' } },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string' },
              end: { type: 'string' }
            }
          },
          minImportance: { type: 'number' }
        }
      },
      limit: { type: 'number', default: 10 }
    },
    required: ['query']
  }
}
```

---

## Phase 7: Intelligent Retrieval

**Goal**: Implement query understanding and planning-based retrieval.
**Effort**: 40 hours | **New Tools**: 2 (smart_search, analyze_query)

### 7.1 Query Analyzer

**File**: `src/search/QueryAnalyzer.ts` (new)

Extract structured information from natural language queries:

```typescript
interface QueryAnalysis {
  // Extracted entities
  persons: string[];           // "John", "Alice"
  locations: string[];         // "Paris", "office"
  organizations: string[];     // "Anthropic", "Google"

  // Temporal understanding
  temporalRange?: {
    start: string;             // ISO 8601
    end: string;
    relative?: string;         // "last week", "yesterday"
  };

  // Query characteristics
  questionType: 'factual' | 'temporal' | 'comparative' | 'aggregation' | 'multi-hop';
  complexity: 'low' | 'medium' | 'high';
  requiredInfoTypes: string[]; // What information is being asked for

  // For multi-hop queries
  subQueries?: string[];       // Decomposed questions
}

class QueryAnalyzer {
  // Rule-based extraction (fast, no LLM)
  analyzeBasic(query: string): QueryAnalysis;

  // LLM-enhanced extraction (accurate, slower)
  async analyzeWithLLM(query: string): Promise<QueryAnalysis>;
}
```

### 7.2 Query Planner

**File**: `src/search/QueryPlanner.ts` (new)

Decompose complex queries into targeted sub-queries:

```typescript
interface QueryPlan {
  originalQuery: string;
  subQueries: SubQuery[];
  executionStrategy: 'parallel' | 'sequential' | 'iterative';
  mergeStrategy: 'union' | 'intersection' | 'weighted';
  estimatedComplexity: number;
}

interface SubQuery {
  id: string;
  query: string;
  targetLayer: 'semantic' | 'lexical' | 'symbolic' | 'hybrid';
  priority: number;
  filters?: SymbolicFilters;
  dependsOn?: string[];  // IDs of queries this depends on
}

class QueryPlanner {
  // Generate execution plan
  createPlan(analysis: QueryAnalysis): QueryPlan;

  // Parallel execution of independent queries
  async executePlan(plan: QueryPlan): Promise<Map<string, Entity[]>>;

  // Merge results from multiple sub-queries
  mergeResults(results: Map<string, Entity[]>): Entity[];
}
```

**Example Plan**:
```
Query: "What meetings did John have with the marketing team last month?"

Plan:
├── SubQuery 1: semantic("meetings John") [parallel]
├── SubQuery 2: symbolic(persons: ["John"], dateRange: lastMonth) [parallel]
├── SubQuery 3: lexical("marketing team") [parallel]
└── Merge: intersection(1 ∩ 2) ∪ weighted(3)
```

### 7.3 Reflection Manager

**File**: `src/search/ReflectionManager.ts` (new)

Iteratively refine retrieval until sufficient information is gathered:

```typescript
interface ReflectionResult {
  entities: Entity[];
  isAdequate: boolean;
  missingInfo?: string[];
  additionalQueries?: string[];
  rounds: number;
}

interface ReflectionConfig {
  maxRounds: number;           // Default: 3
  adequacyThreshold: number;   // Default: 0.8
  enableLLMReflection: boolean;
}

class ReflectionManager {
  async retrieveWithReflection(
    query: string,
    config: ReflectionConfig
  ): Promise<ReflectionResult> {
    let round = 0;
    let results: Entity[] = [];

    while (round < config.maxRounds) {
      // Execute search
      const newResults = await this.search(query);
      results = this.mergeAndDeduplicate(results, newResults);

      // Check adequacy
      const adequacy = await this.checkAdequacy(query, results);
      if (adequacy.isAdequate) {
        return { entities: results, isAdequate: true, rounds: round + 1 };
      }

      // Generate refinement queries
      query = this.refineQuery(query, adequacy.missingInfo);
      round++;
    }

    return { entities: results, isAdequate: false, rounds: round };
  }
}
```

### 7.4 New MCP Tool: `smart_search`

```typescript
{
  name: 'smart_search',
  description: 'Intelligent search with query planning and reflection',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      enablePlanning: { type: 'boolean', default: true },
      enableReflection: { type: 'boolean', default: true },
      maxReflectionRounds: { type: 'number', default: 3 },
      complexity: {
        type: 'string',
        enum: ['auto', 'low', 'medium', 'high'],
        default: 'auto'
      }
    },
    required: ['query']
  }
}
```

### 7.5 New MCP Tool: `analyze_query`

```typescript
{
  name: 'analyze_query',
  description: 'Analyze a query to understand its structure and complexity',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Query to analyze' },
      detailed: { type: 'boolean', default: false }
    },
    required: ['query']
  }
}
```

---

## Phase 8: Semantic Compression

**Goal**: Store self-contained, disambiguated facts for efficient retrieval.
**Effort**: 35 hours | **New Tools**: 1 (normalize_observations)

### 8.1 Observation Normalizer

**File**: `src/features/ObservationNormalizer.ts` (new)

Transform raw observations into atomic, self-contained facts:

```typescript
interface NormalizedObservation {
  original: string;
  normalized: string;          // Disambiguated, self-contained
  keywords: string[];          // Extracted keywords for lexical search
  persons: string[];           // Extracted person names
  entities: string[];          // Extracted entity names
  timestamp?: string;          // Anchored to absolute time
}

class ObservationNormalizer {
  /**
   * Coreference Resolution: Replace pronouns with entity names
   */
  resolveCoreferences(
    observation: string,
    context: { entityName: string; recentObservations: string[] }
  ): string;

  /**
   * Temporal Anchoring: Convert relative times to absolute
   */
  anchorTimestamps(
    observation: string,
    referenceTime: Date
  ): string;

  /**
   * Full normalization pipeline
   */
  async normalize(
    observation: string,
    context: NormalizationContext
  ): Promise<NormalizedObservation>;
}
```

**Example**:
```
Input:  "He mentioned he'll call tomorrow about the project."
Context: { entityName: "John Smith", referenceTime: "2026-01-08" }
Output: "John Smith mentioned he will call on 2026-01-09 about the project."
```

### 8.2 Keyword Extractor

**File**: `src/features/KeywordExtractor.ts` (new)

Extract searchable keywords for lexical layer:

```typescript
interface ExtractionResult {
  keywords: string[];          // Core keywords
  entities: string[];          // Named entities
  topics: string[];            // Topic phrases
  importance: Map<string, number>; // Keyword importance scores
}

class KeywordExtractor {
  // Rule-based extraction (fast)
  extractBasic(text: string): ExtractionResult;

  // NLP-enhanced extraction
  extractWithNLP(text: string): ExtractionResult;

  // Build keyword index for entity
  buildEntityKeywords(entity: Entity): string[];
}
```

### 8.3 Smart Duplicate Detection

Enhanced duplicate detection using semantic similarity:

```typescript
interface DuplicateCandidate {
  entity1: Entity;
  entity2: Entity;
  similarity: {
    nameSimilarity: number;
    observationOverlap: number;
    semanticSimilarity: number;  // NEW: embedding-based
    tagOverlap: number;
  };
  combinedScore: number;
  suggestedMerge: boolean;
}

class SmartDuplicateDetector {
  // Fast pre-filter using LSH (Locality Sensitive Hashing)
  async findCandidates(entities: Entity[]): Promise<Entity[][]>;

  // Detailed comparison with semantic similarity
  async comparePair(e1: Entity, e2: Entity): Promise<DuplicateCandidate>;

  // Auto-suggest merges above threshold
  async suggestMerges(threshold: number): Promise<DuplicateCandidate[]>;
}
```

### 8.4 Enhanced Entity Model

Extend the Entity model for semantic compression:

```typescript
interface EnhancedEntity extends Entity {
  // Existing fields...

  // NEW: Semantic compression fields
  normalizedObservations?: NormalizedObservation[];
  keywords?: string[];           // Extracted keywords for BM25
  keywordImportance?: Map<string, number>;

  // NEW: Structured metadata
  extractedPersons?: string[];
  extractedEntities?: string[];
  temporalAnchors?: string[];    // Absolute timestamps mentioned

  // NEW: Embedding cache
  embeddingVersion?: string;     // Track when embedding was computed
  embeddingHash?: string;        // Detect if re-embedding needed
}
```

### 8.5 New MCP Tool: `normalize_observations`

```typescript
{
  name: 'normalize_observations',
  description: 'Normalize entity observations for better search (coreference resolution, temporal anchoring)',
  inputSchema: {
    type: 'object',
    properties: {
      entityName: { type: 'string', description: 'Entity to normalize' },
      options: {
        type: 'object',
        properties: {
          resolveCoreferences: { type: 'boolean', default: true },
          anchorTimestamps: { type: 'boolean', default: true },
          extractKeywords: { type: 'boolean', default: true }
        }
      }
    },
    required: ['entityName']
  }
}
```

---

## Phase 9: Adaptive Query Intelligence

**Goal**: Dynamic retrieval depth based on query complexity.
**Effort**: 20 hours | **New Tools**: 1 (search_auto)

### 9.1 Dynamic Layer Selection

```typescript
interface LayerSelectionResult {
  selectedLayers: ('semantic' | 'lexical' | 'symbolic')[];
  weights: { semantic: number; lexical: number; symbolic: number };
  reasoning: string;
}

function selectLayers(analysis: QueryAnalysis): LayerSelectionResult {
  // Factual queries → emphasize lexical + symbolic
  if (analysis.questionType === 'factual') {
    return {
      selectedLayers: ['lexical', 'symbolic'],
      weights: { semantic: 0.2, lexical: 0.5, symbolic: 0.3 },
      reasoning: 'Factual query benefits from exact matching'
    };
  }

  // Conceptual queries → emphasize semantic
  if (analysis.questionType === 'comparative' || analysis.complexity === 'high') {
    return {
      selectedLayers: ['semantic', 'lexical'],
      weights: { semantic: 0.6, lexical: 0.3, symbolic: 0.1 },
      reasoning: 'Conceptual query benefits from semantic similarity'
    };
  }

  // Temporal queries → emphasize symbolic
  if (analysis.temporalRange) {
    return {
      selectedLayers: ['symbolic', 'semantic'],
      weights: { semantic: 0.3, lexical: 0.2, symbolic: 0.5 },
      reasoning: 'Temporal query benefits from date filtering'
    };
  }

  // Default: balanced
  return {
    selectedLayers: ['semantic', 'lexical', 'symbolic'],
    weights: { semantic: 0.5, lexical: 0.3, symbolic: 0.2 },
    reasoning: 'Balanced search for general query'
  };
}
```

### 9.2 Cost-Aware Search

Extend QueryCostEstimator with actual cost tracking:

```typescript
interface SearchCost {
  estimated: {
    timeMs: number;
    tokensIfLLM: number;
    memoryMB: number;
  };
  actual?: {
    timeMs: number;
    tokensUsed: number;
    memoryMB: number;
  };
  recommendations: string[];
}

class CostAwareSearchManager {
  // Estimate before execution
  estimateCost(query: string, options: SearchOptions): SearchCost;

  // Execute with cost tracking
  async searchWithCostTracking(
    query: string,
    options: SearchOptions
  ): Promise<{ results: Entity[]; cost: SearchCost }>;

  // Auto-optimize based on cost budget
  async searchWithBudget(
    query: string,
    budget: { maxTimeMs?: number; maxTokens?: number }
  ): Promise<Entity[]>;
}
```

### 9.3 New MCP Tool: `search_auto`

Automatic search with optimal parameters:

```typescript
{
  name: 'search_auto',
  description: 'Automatically select best search strategy based on query analysis',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      budget: {
        type: 'object',
        properties: {
          maxTimeMs: { type: 'number' },
          maxTokens: { type: 'number' },
          maxResults: { type: 'number' }
        }
      },
      explainStrategy: { type: 'boolean', default: false }
    },
    required: ['query']
  }
}
```

---

## Phase 10: Persistent Vector Storage

**Goal**: Enable vector persistence and advanced ANN algorithms.
**Effort**: 25 hours | **New Capabilities**: Persistent embeddings

### 10.1 Persistent Vector Index

Replace in-memory VectorStore with persistent storage:

```typescript
interface PersistentVectorStore extends IVectorStore {
  // Persistence
  save(path: string): Promise<void>;
  load(path: string): Promise<void>;

  // Incremental updates
  upsert(name: string, embedding: number[]): void;

  // ANN algorithm selection
  setAlgorithm(algo: 'flat' | 'ivf' | 'hnsw'): void;
}
```

**Options**:
- **SQLite with vec extension**: Integrated with existing SQLite storage
- **HNSW index**: Hierarchical Navigable Small World graphs for fast ANN
- **LanceDB integration**: Columnar vector database (like SimpleMem)

### 10.2 Vector Storage Configuration

```typescript
interface VectorStorageConfig {
  // Storage backend
  backend: 'memory' | 'sqlite' | 'file' | 'lancedb';

  // ANN algorithm
  algorithm: 'flat' | 'ivf' | 'hnsw';

  // HNSW parameters
  hnsw?: {
    M: number;           // Max connections per layer (default: 16)
    efConstruction: number;  // Build-time search width (default: 200)
    efSearch: number;    // Query-time search width (default: 50)
  };

  // IVF parameters
  ivf?: {
    nlist: number;       // Number of clusters (default: 100)
    nprobe: number;      // Clusters to search (default: 10)
  };
}
```

---

## New MCP Tools Summary

| Tool | Phase | Description |
|------|-------|-------------|
| `hybrid_search` | 6 | Multi-signal search combining semantic, lexical, and symbolic layers |
| `smart_search` | 7 | Intelligent search with query planning and iterative reflection |
| `analyze_query` | 7 | Analyze query structure, complexity, and recommended search strategy |
| `normalize_observations` | 8 | Normalize observations with coreference resolution and temporal anchoring |
| `search_auto` | 9 | Automatic search strategy selection based on query and budget |

**Total New Tools**: 5 (bringing total from 55 to 60)

---

## Architecture Evolution

### Current Architecture (v9.x)

```
┌─────────────────────────────────────────┐
│  MCP Protocol Layer                      │
│  55 tools, 7 categories                  │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│  Managers (ManagerContext)               │
│  Entity, Relation, Search, IO, Tag       │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│  Storage (JSONL / SQLite)                │
│  Indexes: Name, Type, Relation, Obs      │
└─────────────────────────────────────────┘
```

### Target Architecture (v12.x)

```
┌─────────────────────────────────────────────────────────────┐
│  MCP Protocol Layer                                          │
│  60+ tools including: hybrid_search, smart_search, etc.      │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│  INTELLIGENT RETRIEVAL LAYER (NEW)                           │
│  ┌─────────────┬──────────────┬──────────────┐              │
│  │ QueryAnalyzer│ QueryPlanner │ Reflection   │              │
│  │             │              │ Manager      │              │
│  └─────────────┴──────────────┴──────────────┘              │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│  THREE-LAYER HYBRID SEARCH (NEW)                             │
│  ┌──────────────┬─────────────┬─────────────────┐           │
│  │ Semantic     │ Lexical     │ Symbolic        │           │
│  │ (Embeddings) │ (BM25/TFIDF)│ (Metadata)      │           │
│  └──────────────┴─────────────┴─────────────────┘           │
│  HybridSearchManager (score aggregation)                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│  SEMANTIC COMPRESSION LAYER (NEW)                            │
│  ObservationNormalizer, KeywordExtractor, SmartDuplicates    │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│  Managers (ManagerContext)                                   │
│  Entity, Relation, Search, IO, Tag, Hierarchy                │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────┴─────────────────────────────────┐
│  Storage Layer                                               │
│  ┌──────────────┬─────────────┬─────────────────┐           │
│  │ JSONL/SQLite │ Vector Store│ Inverted Index  │           │
│  │ (entities)   │ (embeddings)│ (keywords/BM25) │           │
│  └──────────────┴─────────────┴─────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## Version Roadmap

| Version | Phase | Key Features | Tools Added |
|---------|-------|--------------|-------------|
| **v10.0** | 6 | Three-layer hybrid search, HybridSearchManager | hybrid_search |
| **v10.5** | 7 | Intelligent retrieval, query planning | smart_search, analyze_query |
| **v11.0** | 8 | Semantic compression, observation normalization | normalize_observations |
| **v11.5** | 9 | Adaptive query intelligence | search_auto |
| **v12.0** | 10 | Persistent vector storage, HNSW indexing | - |

---

## Testing & Validation

### Feature Test Suite

```bash
# Run feature tests
npm test -- tests/features/

# Run specific feature tests
npx vitest run tests/features/hybrid-search.test.ts
npx vitest run tests/features/query-analyzer.test.ts
npx vitest run tests/features/observation-normalizer.test.ts
```

### Feature Validation Checklist

- [ ] **hybrid_search**: Returns results from all three layers with correct score aggregation
- [ ] **smart_search**: Correctly decomposes multi-hop queries
- [ ] **analyze_query**: Accurately identifies query type and complexity
- [ ] **normalize_observations**: Properly resolves coreferences and anchors timestamps
- [ ] **search_auto**: Selects appropriate strategy based on query characteristics

---

## Contributing

When implementing features from this roadmap:

1. Create feature branch: `feature/phase-X-feature-name`
2. Add feature tests first
3. Implement feature following existing patterns
4. Update this roadmap with completion status
5. Add tool definition to `toolDefinitions.ts`
6. Add handler to `toolHandlers.ts`
7. Update CLAUDE.md tool counts
8. Add changelog entry

---

*Document Version: 3.0.0 | Last Updated: 2026-01-08*
*Feature design inspired by: SimpleMem three-stage semantic lossless compression architecture*
