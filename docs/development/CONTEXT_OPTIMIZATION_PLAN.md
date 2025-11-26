# Context/Token Optimization Refactoring Plan

## Executive Summary

This document outlines a comprehensive refactoring strategy to **reduce context/token usage** in the memory-mcp codebase. The focus is on lazy loading, eliminating redundancy, reducing verbosity, and applying optimizations that minimize the cognitive and computational load when AI assistants interact with this codebase.

**Current State:**
- Total Source Lines: ~9,461 lines across 45 TypeScript files
- Largest Files: MCPServer.ts (907 lines), EntityManager.ts (647 lines)
- Code Duplication: ~500-800 lines of redundant patterns
- Context Cost: High token consumption when loading manager files

**Target State:**
- 15-20% reduction in total lines of code
- 60-70% reduction in code duplication
- Lazy-loadable module architecture
- Centralized utility functions for common patterns

---

## Analysis Summary

### High-Impact Duplication Patterns

| Pattern | Occurrences | Files Affected | Estimated Lines Saved |
|---------|-------------|----------------|----------------------|
| `JSON.stringify(..., null, 2)` response | 41 | MCPServer.ts | ~80 lines |
| Entity lookup pattern | 27 | 7 files | ~50 lines |
| Tag normalization | 14 | 9 files | ~25 lines |
| Validation error handling | 8 | 3 files | ~30 lines |
| Pagination validation | 4 | 4 files | ~15 lines |
| Importance filtering | 4 | 4 files | ~20 lines |
| Search filter chain | 4 | 4 files | ~80 lines |
| **Total Estimated** | **102+** | **15+ files** | **~300+ lines** |

### Large Files Requiring Splitting

| File | Current Lines | Target Lines | Strategy |
|------|---------------|--------------|----------|
| MCPServer.ts | 907 | ~300 | Extract tool definitions & handlers |
| EntityManager.ts | 647 | ~400 | Extract tag operations & validation |
| KnowledgeGraphManager.ts | 518 | ~350 | Lazy manager initialization |
| TransactionManager.ts | 472 | ~350 | Extract operation handlers |
| ExportManager.ts | 346 | ~200 | Split into format-specific exporters |

---

## Sprint Organization

### Sprint 1: Core Utility Extraction (Quick Wins)
**Goal:** Extract frequently duplicated patterns into shared utilities
**Estimated Impact:** ~150 lines saved, 40+ duplicate occurrences eliminated

### Sprint 2: Search Module Consolidation
**Goal:** Unify search filter chains and pagination logic
**Estimated Impact:** ~100 lines saved, improved search maintainability

### Sprint 3: MCPServer Optimization
**Goal:** Reduce verbosity, extract tool definitions and handlers
**Estimated Impact:** ~300 lines saved, file reduced to ~300 lines

### Sprint 4: Manager Class Optimization
**Goal:** Extract tag operations, implement lazy loading patterns
**Estimated Impact:** ~150 lines saved, improved initialization performance

### Sprint 5: Type & Import Optimization
**Goal:** Consolidate types, implement barrel exports, tree-shaking
**Estimated Impact:** Reduced import statements, cleaner dependencies

### Sprint 6: Caching & Lazy Loading Infrastructure
**Goal:** Implement write-through caching, lazy manager initialization
**Estimated Impact:** Improved runtime performance, reduced I/O

---

## Sprint 1: Core Utility Extraction

**Duration:** 5-7 tasks
**Priority:** HIGH (Quick wins with immediate impact)

### Task 1.1: Create MCP Response Formatter Utility

**File:** `src/memory/utils/responseFormatter.ts`

**Problem:** 41 occurrences of identical JSON.stringify pattern in MCPServer.ts

**Current Pattern (repeated 41 times):**
```typescript
return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
```

**Implementation:**
```typescript
// src/memory/utils/responseFormatter.ts
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Formats data as an MCP tool response with JSON content.
 * Centralizes the response format to ensure consistency and reduce duplication.
 */
export function formatToolResponse(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
  };
}

/**
 * Formats a simple text message as an MCP tool response.
 */
export function formatTextResponse(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }]
  };
}

/**
 * Formats an error as an MCP tool response with isError flag.
 */
export function formatErrorResponse(error: Error | string): CallToolResult {
  const message = error instanceof Error ? error.message : error;
  return {
    content: [{ type: "text", text: message }],
    isError: true
  };
}
```

**Files to Update:**
- `src/memory/server/MCPServer.ts` (lines 796-898): Replace 41 JSON.stringify calls

**Verification:**
1. Run `npm run typecheck` - should pass
2. Run `npm test` - all tests should pass
3. Verify tool responses are identical in format

---

### Task 1.2: Create Tag Normalization Utility

**File:** `src/memory/utils/tagUtils.ts`

**Problem:** 14 occurrences of tag normalization across 9 files

**Current Patterns (variations):**
```typescript
// Pattern 1: With optional chaining
const normalizedTags = tags?.map(tag => tag.toLowerCase());

// Pattern 2: Direct mapping
const normalizedTags = tags.map(tag => tag.toLowerCase());

// Pattern 3: With trim
const normalizedTags = tags.map(t => t.toLowerCase().trim());
```

**Implementation:**
```typescript
// src/memory/utils/tagUtils.ts

/**
 * Normalizes tags to lowercase for consistent matching.
 * Handles undefined/null input gracefully.
 *
 * @param tags - Array of tags to normalize, or undefined
 * @returns Normalized tags array, or empty array if input is undefined
 */
export function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  return tags.map(tag => tag.toLowerCase().trim());
}

/**
 * Checks if an entity's tags include any of the specified search tags.
 * Both inputs are normalized before comparison.
 *
 * @param entityTags - Tags on the entity
 * @param searchTags - Tags to search for
 * @returns true if any search tag matches any entity tag
 */
export function hasMatchingTag(
  entityTags: string[] | undefined,
  searchTags: string[] | undefined
): boolean {
  if (!entityTags?.length || !searchTags?.length) return false;
  const normalizedEntity = normalizeTags(entityTags);
  const normalizedSearch = normalizeTags(searchTags);
  return normalizedSearch.some(tag => normalizedEntity.includes(tag));
}

/**
 * Checks if entity tags include ALL of the specified tags.
 */
export function hasAllTags(
  entityTags: string[] | undefined,
  requiredTags: string[]
): boolean {
  if (!entityTags?.length) return false;
  const normalized = normalizeTags(entityTags);
  return normalizeTags(requiredTags).every(tag => normalized.includes(tag));
}
```

**Files to Update:**
1. `src/memory/core/EntityManager.ts` - 8 occurrences (lines ~442, 479, 541, etc.)
2. `src/memory/features/ArchiveManager.ts` - 2 occurrences (lines ~79-81)
3. `src/memory/search/BasicSearch.ts` - 1 occurrence
4. `src/memory/search/BooleanSearch.ts` - 1 occurrence
5. `src/memory/search/FuzzySearch.ts` - 1 occurrence
6. `src/memory/search/RankedSearch.ts` - 1 occurrence

**Verification:**
1. Search for `toLowerCase()` in tag contexts - should only appear in tagUtils.ts
2. Run `npm test` - all tag-related tests should pass
3. Run `npm run typecheck` - should pass

---

### Task 1.3: Create Entity Lookup Helper

**File:** `src/memory/utils/entityUtils.ts`

**Problem:** 27 occurrences of entity lookup pattern across 7 files

**Current Pattern:**
```typescript
const entity = graph.entities.find(e => e.name === entityName);
if (!entity) {
  throw new EntityNotFoundError(entityName);
}
```

**Implementation:**
```typescript
// src/memory/utils/entityUtils.ts
import type { Entity, KnowledgeGraph } from '../types/entity.types.js';
import { EntityNotFoundError } from './errors.js';

/**
 * Finds an entity by name in the graph.
 *
 * @param graph - The knowledge graph to search
 * @param name - The entity name to find
 * @param throwIfNotFound - Whether to throw if entity doesn't exist (default: true)
 * @returns The entity if found, null if not found and throwIfNotFound is false
 * @throws EntityNotFoundError if entity not found and throwIfNotFound is true
 */
export function findEntityByName(
  graph: KnowledgeGraph,
  name: string,
  throwIfNotFound: true
): Entity;
export function findEntityByName(
  graph: KnowledgeGraph,
  name: string,
  throwIfNotFound: false
): Entity | null;
export function findEntityByName(
  graph: KnowledgeGraph,
  name: string,
  throwIfNotFound: boolean = true
): Entity | null {
  const entity = graph.entities.find(e => e.name === name);
  if (!entity && throwIfNotFound) {
    throw new EntityNotFoundError(name);
  }
  return entity ?? null;
}

/**
 * Finds multiple entities by name.
 *
 * @param graph - The knowledge graph to search
 * @param names - Array of entity names to find
 * @param throwIfAnyNotFound - Whether to throw if any entity doesn't exist
 * @returns Array of found entities
 */
export function findEntitiesByNames(
  graph: KnowledgeGraph,
  names: string[],
  throwIfAnyNotFound: boolean = true
): Entity[] {
  const entities: Entity[] = [];
  for (const name of names) {
    const entity = findEntityByName(graph, name, throwIfAnyNotFound as true);
    if (entity) entities.push(entity);
  }
  return entities;
}

/**
 * Checks if an entity exists in the graph.
 */
export function entityExists(graph: KnowledgeGraph, name: string): boolean {
  return graph.entities.some(e => e.name === name);
}
```

**Files to Update:**
1. `src/memory/core/EntityManager.ts` - 9 occurrences
2. `src/memory/features/HierarchyManager.ts` - 10 occurrences
3. `src/memory/core/TransactionManager.ts` - 1 occurrence
4. `src/memory/core/ObservationManager.ts` - 2 occurrences
5. `src/memory/search/TFIDFIndexManager.ts` - 1 occurrence
6. Other files with entity lookups

**Verification:**
1. Search for `.find(e => e.name ===` - should be significantly reduced
2. Run all entity-related tests
3. Verify EntityNotFoundError is thrown correctly

---

### Task 1.4: Create Validation Helper Utility

**File:** `src/memory/utils/validationHelper.ts`

**Problem:** 8 occurrences of Zod validation pattern across manager files

**Current Pattern:**
```typescript
const validation = SomeSchema.safeParse(data);
if (!validation.success) {
  const errors = validation.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`);
  throw new ValidationError('Invalid data', errors);
}
const validData = validation.data;
```

**Implementation:**
```typescript
// src/memory/utils/validationHelper.ts
import { type ZodSchema, type ZodError } from 'zod';
import { ValidationError } from './errors.js';

/**
 * Validates data against a Zod schema and returns the typed result.
 * Throws ValidationError with formatted error messages on failure.
 *
 * @param data - The data to validate
 * @param schema - The Zod schema to validate against
 * @param errorMessage - Custom error message prefix
 * @returns The validated and typed data
 * @throws ValidationError if validation fails
 */
export function validateWithSchema<T>(
  data: unknown,
  schema: ZodSchema<T>,
  errorMessage: string = 'Validation failed'
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = formatZodErrors(result.error);
    throw new ValidationError(errorMessage, errors);
  }
  return result.data;
}

/**
 * Formats Zod errors into human-readable strings.
 */
export function formatZodErrors(error: ZodError): string[] {
  return error.issues.map(issue => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });
}

/**
 * Validates data and returns a result object instead of throwing.
 */
export function validateSafe<T>(
  data: unknown,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: formatZodErrors(result.error) };
}
```

**Files to Update:**
1. `src/memory/core/EntityManager.ts` - 6 validation patterns
2. `src/memory/core/RelationManager.ts` - 2 validation patterns
3. Any other files with Zod validation

**Verification:**
1. Run `npm run typecheck`
2. Run validation-related tests
3. Verify error messages remain identical

---

### Task 1.5: Create Pagination Utility

**File:** `src/memory/utils/paginationUtils.ts`

**Problem:** 4 occurrences of identical pagination validation in search files

**Current Pattern:**
```typescript
const validatedOffset = Math.max(0, offset);
const validatedLimit = Math.min(Math.max(SEARCH_LIMITS.MIN, limit), SEARCH_LIMITS.MAX);
```

**Implementation:**
```typescript
// src/memory/utils/paginationUtils.ts
import { SEARCH_LIMITS } from './constants.js';

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface ValidatedPagination {
  offset: number;
  limit: number;
  hasMore: (totalCount: number) => boolean;
}

/**
 * Validates and normalizes pagination parameters.
 *
 * @param offset - Starting position (default: 0)
 * @param limit - Maximum results to return (default: SEARCH_LIMITS.DEFAULT)
 * @returns Validated pagination parameters with helper methods
 */
export function validatePagination(
  offset: number = 0,
  limit: number = SEARCH_LIMITS.DEFAULT
): ValidatedPagination {
  const validatedOffset = Math.max(0, offset);
  const validatedLimit = Math.min(
    Math.max(SEARCH_LIMITS.MIN, limit),
    SEARCH_LIMITS.MAX
  );

  return {
    offset: validatedOffset,
    limit: validatedLimit,
    hasMore: (totalCount: number) => validatedOffset + validatedLimit < totalCount
  };
}

/**
 * Applies pagination to an array of results.
 *
 * @param items - Array to paginate
 * @param pagination - Validated pagination parameters
 * @returns Paginated slice of the array
 */
export function applyPagination<T>(
  items: T[],
  pagination: ValidatedPagination
): T[] {
  return items.slice(pagination.offset, pagination.offset + pagination.limit);
}
```

**Files to Update:**
1. `src/memory/search/BasicSearch.ts` (lines 57-59)
2. `src/memory/search/BooleanSearch.ts` (lines 70-72)
3. `src/memory/search/FuzzySearch.ts` (lines 54-56)
4. `src/memory/search/RankedSearch.ts`

**Verification:**
1. Run search-related tests
2. Verify pagination behavior is unchanged
3. Test edge cases (negative offset, limit > MAX)

---

### Task 1.6: Create Importance Filter Utility

**File:** `src/memory/utils/filterUtils.ts`

**Problem:** 4 occurrences of identical importance filtering logic in search files

**Current Pattern:**
```typescript
if (minImportance !== undefined && (e.importance === undefined || e.importance < minImportance)) {
  return false;
}
if (maxImportance !== undefined && (e.importance === undefined || e.importance > maxImportance)) {
  return false;
}
```

**Implementation:**
```typescript
// src/memory/utils/filterUtils.ts
import type { Entity } from '../types/entity.types.js';

/**
 * Checks if an entity's importance is within the specified range.
 * Entities without importance are treated as not matching if any filter is set.
 *
 * @param importance - The entity's importance value (may be undefined)
 * @param minImportance - Minimum importance filter (inclusive)
 * @param maxImportance - Maximum importance filter (inclusive)
 * @returns true if importance is within range or no filters are set
 */
export function isWithinImportanceRange(
  importance: number | undefined,
  minImportance?: number,
  maxImportance?: number
): boolean {
  if (minImportance !== undefined) {
    if (importance === undefined || importance < minImportance) {
      return false;
    }
  }
  if (maxImportance !== undefined) {
    if (importance === undefined || importance > maxImportance) {
      return false;
    }
  }
  return true;
}

/**
 * Filters entities by importance range.
 */
export function filterByImportance(
  entities: Entity[],
  minImportance?: number,
  maxImportance?: number
): Entity[] {
  if (minImportance === undefined && maxImportance === undefined) {
    return entities;
  }
  return entities.filter(e =>
    isWithinImportanceRange(e.importance, minImportance, maxImportance)
  );
}

/**
 * Filters entities by date range on a specified date field.
 */
export function isWithinDateRange(
  dateValue: string | undefined,
  startDate?: string,
  endDate?: string
): boolean {
  if (!dateValue) return startDate === undefined && endDate === undefined;

  const date = new Date(dateValue);
  if (startDate && date < new Date(startDate)) return false;
  if (endDate && date > new Date(endDate)) return false;
  return true;
}
```

**Files to Update:**
1. `src/memory/search/BasicSearch.ts` (lines 79-84)
2. `src/memory/search/BooleanSearch.ts` (lines 89-95)
3. `src/memory/search/FuzzySearch.ts` (lines 85-91)
4. `src/memory/search/RankedSearch.ts`

**Verification:**
1. Run importance-related search tests
2. Test edge cases (undefined importance, boundary values)

---

### Task 1.7: Update Utility Barrel Export

**File:** `src/memory/utils/index.ts`

**Implementation:**
Update the barrel export to include all new utilities:

```typescript
// src/memory/utils/index.ts

// Existing exports
export * from './constants.js';
export * from './errors.js';
export * from './levenshtein.js';
export * from './dateUtils.js';
export * from './tfidf.js';
export * from './schemas.js';

// New exports - Sprint 1
export * from './responseFormatter.js';
export * from './tagUtils.js';
export * from './entityUtils.js';
export * from './validationHelper.js';
export * from './paginationUtils.js';
export * from './filterUtils.js';
```

**Verification:**
1. Run `npm run typecheck` - should pass
2. Run `npm run build` - should succeed
3. Verify imports work from both direct and barrel paths

---

## Sprint 2: Search Module Consolidation

**Duration:** 6 tasks
**Priority:** HIGH (Significant duplication in search code)

### Task 2.1: Create SearchFilterChain Utility

**File:** `src/memory/search/SearchFilterChain.ts`

**Problem:** BasicSearch, BooleanSearch, FuzzySearch, RankedSearch all implement nearly identical filter chains

**Implementation:**
```typescript
// src/memory/search/SearchFilterChain.ts
import type { Entity } from '../types/entity.types.js';
import { normalizeTags, hasMatchingTag } from '../utils/tagUtils.js';
import { isWithinImportanceRange } from '../utils/filterUtils.js';

export interface SearchFilters {
  tags?: string[];
  minImportance?: number;
  maxImportance?: number;
  entityTypes?: string[];
  createdAfter?: string;
  createdBefore?: string;
  modifiedAfter?: string;
  modifiedBefore?: string;
}

/**
 * Centralized filter chain for all search implementations.
 * Ensures consistent filtering behavior across search types.
 */
export class SearchFilterChain {
  /**
   * Applies all filters to an array of entities.
   * Short-circuits on first failing filter for performance.
   */
  static applyFilters(entities: Entity[], filters: SearchFilters): Entity[] {
    if (!this.hasActiveFilters(filters)) {
      return entities;
    }

    return entities.filter(entity => this.entityPassesFilters(entity, filters));
  }

  /**
   * Checks if an entity passes all active filters.
   */
  static entityPassesFilters(entity: Entity, filters: SearchFilters): boolean {
    // Tag filter
    if (filters.tags?.length && !hasMatchingTag(entity.tags, filters.tags)) {
      return false;
    }

    // Importance filter
    if (!isWithinImportanceRange(entity.importance, filters.minImportance, filters.maxImportance)) {
      return false;
    }

    // Entity type filter
    if (filters.entityTypes?.length && !filters.entityTypes.includes(entity.entityType)) {
      return false;
    }

    // Date filters
    if (filters.createdAfter && (!entity.createdAt || entity.createdAt < filters.createdAfter)) {
      return false;
    }
    if (filters.createdBefore && (!entity.createdAt || entity.createdAt > filters.createdBefore)) {
      return false;
    }
    if (filters.modifiedAfter && (!entity.lastModified || entity.lastModified < filters.modifiedAfter)) {
      return false;
    }
    if (filters.modifiedBefore && (!entity.lastModified || entity.lastModified > filters.modifiedBefore)) {
      return false;
    }

    return true;
  }

  /**
   * Checks if any filters are actually set.
   */
  static hasActiveFilters(filters: SearchFilters): boolean {
    return !!(
      filters.tags?.length ||
      filters.minImportance !== undefined ||
      filters.maxImportance !== undefined ||
      filters.entityTypes?.length ||
      filters.createdAfter ||
      filters.createdBefore ||
      filters.modifiedAfter ||
      filters.modifiedBefore
    );
  }
}
```

**Files to Update:**
1. `src/memory/search/BasicSearch.ts` - Replace inline filter logic
2. `src/memory/search/BooleanSearch.ts` - Replace inline filter logic
3. `src/memory/search/FuzzySearch.ts` - Replace inline filter logic
4. `src/memory/search/RankedSearch.ts` - Replace inline filter logic

---

### Task 2.2: Refactor BasicSearch to Use Filter Chain

**File:** `src/memory/search/BasicSearch.ts`

**Changes:**
1. Import `SearchFilterChain` and `validatePagination`
2. Replace inline filter code with `SearchFilterChain.applyFilters()`
3. Replace pagination validation with `validatePagination()`
4. Remove redundant local filter functions

**Before (~150 lines of filter logic):**
```typescript
// Inline filtering repeated
if (tags?.length) {
  const normalizedTags = tags.map(t => t.toLowerCase());
  // ... filtering logic
}
if (minImportance !== undefined) {
  // ... filtering logic
}
```

**After (~20 lines):**
```typescript
import { SearchFilterChain, type SearchFilters } from './SearchFilterChain.js';
import { validatePagination, applyPagination } from '../utils/paginationUtils.js';

// In search method:
const filters: SearchFilters = { tags, minImportance, maxImportance };
const filtered = SearchFilterChain.applyFilters(matchedEntities, filters);
const pagination = validatePagination(offset, limit);
const paginated = applyPagination(filtered, pagination);
```

---

### Task 2.3: Refactor BooleanSearch to Use Filter Chain

**File:** `src/memory/search/BooleanSearch.ts`

Apply same pattern as Task 2.2. This file has additional complexity with boolean query parsing, but the post-filter logic should use SearchFilterChain.

---

### Task 2.4: Refactor FuzzySearch to Use Filter Chain

**File:** `src/memory/search/FuzzySearch.ts`

Apply same pattern as Task 2.2.

---

### Task 2.5: Refactor RankedSearch to Use Filter Chain

**File:** `src/memory/search/RankedSearch.ts`

Apply same pattern as Task 2.2. Note: This file also has TF-IDF scoring logic that remains unchanged.

---

### Task 2.6: Update Search Module Barrel Export

**File:** `src/memory/search/index.ts`

Add export for SearchFilterChain:
```typescript
export * from './SearchFilterChain.js';
```

**Verification for Sprint 2:**
1. Run all search tests: `npx vitest run src/memory/__tests__/unit/search/`
2. Run integration tests
3. Verify search results are identical before/after refactoring

---

## Sprint 3: MCPServer Optimization

**Duration:** 8 tasks
**Priority:** HIGH (Largest file, most token impact)

### Task 3.1: Extract Tool Definitions to Separate File

**File:** `src/memory/server/toolDefinitions.ts`

**Problem:** MCPServer.ts contains 45 inline tool definitions (lines 60-792, ~730 lines)

**Implementation:**
Create a dedicated file with tool definitions exported as a constant array:

```typescript
// src/memory/server/toolDefinitions.ts
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Entity management tool definitions
 */
const entityTools: Tool[] = [
  {
    name: "create_entities",
    description: "Create multiple new entities in the knowledge graph",
    inputSchema: {
      type: "object",
      properties: {
        entities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Unique entity name" },
              entityType: { type: "string", description: "Type classification" },
              observations: {
                type: "array",
                items: { type: "string" },
                description: "Initial observations"
              },
              // ... other properties
            },
            required: ["name", "entityType", "observations"]
          }
        }
      },
      required: ["entities"]
    }
  },
  // ... more entity tools
];

/**
 * Search tool definitions
 */
const searchTools: Tool[] = [
  // ... search tools
];

/**
 * All tool definitions combined
 */
export const allTools: Tool[] = [
  ...entityTools,
  ...searchTools,
  // ... other tool groups
];

/**
 * Tool name to category mapping for organized documentation
 */
export const toolCategories: Record<string, string[]> = {
  entity: ['create_entities', 'delete_entities', 'read_graph'],
  search: ['search_nodes', 'search_nodes_ranked', 'boolean_search', 'fuzzy_search'],
  // ... other categories
};
```

---

### Task 3.2: Create Tool Handler Registry

**File:** `src/memory/server/toolHandlers.ts`

**Problem:** 41 case statements in switch block with repetitive JSON.stringify

**Implementation:**
```typescript
// src/memory/server/toolHandlers.ts
import type { KnowledgeGraphManager } from '../core/KnowledgeGraphManager.js';
import { formatToolResponse, formatTextResponse } from '../utils/responseFormatter.js';
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

type ToolHandler = (
  args: Record<string, unknown>,
  manager: KnowledgeGraphManager
) => Promise<CallToolResult>;

/**
 * Registry of tool handlers mapped by tool name.
 * Each handler receives args and manager, returns formatted response.
 */
export const toolHandlers: Record<string, ToolHandler> = {
  // Entity tools
  create_entities: async (args, manager) => {
    const result = await manager.createEntities(args.entities as any);
    return formatToolResponse(result);
  },

  delete_entities: async (args, manager) => {
    await manager.deleteEntities(args.entityNames as string[]);
    return formatTextResponse("Entities deleted successfully");
  },

  read_graph: async (_args, manager) => {
    const result = await manager.readGraph();
    return formatToolResponse(result);
  },

  // Search tools
  search_nodes: async (args, manager) => {
    const result = await manager.searchNodes(
      args.query as string,
      args.tags as string[] | undefined,
      args.minImportance as number | undefined,
      args.maxImportance as number | undefined,
      args.limit as number | undefined,
      args.offset as number | undefined
    );
    return formatToolResponse(result);
  },

  // ... all other handlers
};

/**
 * Handles a tool call by name.
 * Throws if tool is not found.
 */
export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown> | undefined,
  manager: KnowledgeGraphManager
): Promise<CallToolResult> {
  const handler = toolHandlers[toolName];
  if (!handler) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return handler(args ?? {}, manager);
}
```

---

### Task 3.3: Refactor MCPServer to Use Extracted Modules

**File:** `src/memory/server/MCPServer.ts`

**Target:** Reduce from ~907 lines to ~150 lines

**After Refactoring:**
```typescript
// src/memory/server/MCPServer.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { KnowledgeGraphManager } from '../core/KnowledgeGraphManager.js';
import { allTools } from './toolDefinitions.js';
import { handleToolCall } from './toolHandlers.js';

export class MCPServer {
  private server: Server;
  private manager: KnowledgeGraphManager;

  constructor(memoryFilePath: string) {
    this.manager = new KnowledgeGraphManager(memoryFilePath);
    this.server = new Server(
      { name: "memory-server", version: "0.9.0" },
      { capabilities: { tools: {} } }
    );
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: allTools
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return handleToolCall(name, args, this.manager);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Knowledge Graph MCP Server running on stdio");
  }
}
```

---

### Task 3.4: Group Tool Handlers by Domain

Split `toolHandlers.ts` into domain-specific files for maintainability:

**Files to Create:**
- `src/memory/server/handlers/entityHandlers.ts`
- `src/memory/server/handlers/searchHandlers.ts`
- `src/memory/server/handlers/tagHandlers.ts`
- `src/memory/server/handlers/hierarchyHandlers.ts`
- `src/memory/server/handlers/analyticsHandlers.ts`
- `src/memory/server/handlers/index.ts` (combines all)

Each handler file exports a partial handler map:
```typescript
// src/memory/server/handlers/entityHandlers.ts
export const entityHandlers: Record<string, ToolHandler> = {
  create_entities: async (args, manager) => { /* ... */ },
  delete_entities: async (args, manager) => { /* ... */ },
  // ...
};
```

---

### Task 3.5: Group Tool Definitions by Domain

Similar to handlers, split tool definitions:

**Files to Create:**
- `src/memory/server/tools/entityTools.ts`
- `src/memory/server/tools/searchTools.ts`
- `src/memory/server/tools/tagTools.ts`
- `src/memory/server/tools/hierarchyTools.ts`
- `src/memory/server/tools/analyticsTools.ts`
- `src/memory/server/tools/index.ts` (combines all)

---

### Task 3.6: Add Tool Schema Type Safety

**File:** `src/memory/server/types.ts`

Create type-safe argument interfaces for each tool:

```typescript
// src/memory/server/types.ts
export interface CreateEntitiesArgs {
  entities: Array<{
    name: string;
    entityType: string;
    observations: string[];
    tags?: string[];
    importance?: number;
    parentId?: string;
  }>;
}

export interface SearchNodesArgs {
  query: string;
  tags?: string[];
  minImportance?: number;
  maxImportance?: number;
  limit?: number;
  offset?: number;
}

// ... more arg interfaces

export type ToolArgs =
  | { name: 'create_entities'; args: CreateEntitiesArgs }
  | { name: 'search_nodes'; args: SearchNodesArgs }
  // ... more tool arg types
  ;
```

---

### Task 3.7: Add Tool Handler Tests

**File:** `src/memory/__tests__/unit/server/toolHandlers.test.ts`

Create unit tests for the extracted tool handlers to ensure correct behavior after refactoring.

---

### Task 3.8: Update Server Module Barrel Export

**File:** `src/memory/server/index.ts`

```typescript
export { MCPServer } from './MCPServer.js';
export { allTools, toolCategories } from './toolDefinitions.js';
export { handleToolCall, toolHandlers } from './toolHandlers.js';
export type * from './types.js';
```

**Verification for Sprint 3:**
1. Run `npm run typecheck`
2. Run `npm test` - all existing tests should pass
3. Test MCP server manually with a client
4. Verify MCPServer.ts is now ~150 lines (down from 907)

---

## Sprint 4: Manager Class Optimization

**Duration:** 7 tasks
**Priority:** MEDIUM (Improves maintainability and reduces context)

### Task 4.1: Extract Tag Operations from EntityManager

**File:** `src/memory/core/TagOperationsMixin.ts`

**Problem:** EntityManager.ts (647 lines) contains significant tag-related code that could be separate

**Implementation:**
Extract tag-specific methods into a mixin or helper class:

```typescript
// src/memory/core/TagOperationsMixin.ts
import type { GraphStorage } from './GraphStorage.js';
import type { Entity } from '../types/entity.types.js';
import { normalizeTags, hasMatchingTag } from '../utils/tagUtils.js';
import { findEntityByName } from '../utils/entityUtils.js';

export class TagOperations {
  constructor(private storage: GraphStorage) {}

  async addTags(entityName: string, tags: string[]): Promise<Entity> {
    const graph = await this.storage.loadGraph();
    const entity = findEntityByName(graph, entityName, true);

    const normalizedNewTags = normalizeTags(tags);
    const existingTags = normalizeTags(entity.tags);
    const uniqueNewTags = normalizedNewTags.filter(t => !existingTags.includes(t));

    entity.tags = [...existingTags, ...uniqueNewTags];
    entity.lastModified = new Date().toISOString();

    await this.storage.saveGraph(graph);
    return entity;
  }

  async removeTags(entityName: string, tags: string[]): Promise<Entity> {
    const graph = await this.storage.loadGraph();
    const entity = findEntityByName(graph, entityName, true);

    const tagsToRemove = normalizeTags(tags);
    entity.tags = (entity.tags || []).filter(t =>
      !tagsToRemove.includes(t.toLowerCase())
    );
    entity.lastModified = new Date().toISOString();

    await this.storage.saveGraph(graph);
    return entity;
  }

  // ... other tag methods
}
```

---

### Task 4.2: Refactor EntityManager to Use Tag Operations

**File:** `src/memory/core/EntityManager.ts`

Delegate tag operations to the extracted class:

```typescript
import { TagOperations } from './TagOperationsMixin.js';

export class EntityManager {
  private tagOps: TagOperations;

  constructor(private storage: GraphStorage) {
    this.tagOps = new TagOperations(storage);
  }

  // Delegate tag methods
  addTags = this.tagOps.addTags.bind(this.tagOps);
  removeTags = this.tagOps.removeTags.bind(this.tagOps);
  // ... other delegations
}
```

---

### Task 4.3: Implement Lazy Manager Initialization

**File:** `src/memory/core/KnowledgeGraphManager.ts`

**Problem:** All 11 managers are initialized on construction, even if not used

**Implementation:**
Use getters with lazy initialization:

```typescript
export class KnowledgeGraphManager {
  private storage: GraphStorage;

  // Lazy-initialized managers
  private _entityManager?: EntityManager;
  private _relationManager?: RelationManager;
  private _searchManager?: SearchManager;
  // ... other managers

  constructor(memoryFilePath: string) {
    this.storage = new GraphStorage(memoryFilePath);
    // Don't initialize managers here!
  }

  private get entityManager(): EntityManager {
    if (!this._entityManager) {
      this._entityManager = new EntityManager(this.storage);
    }
    return this._entityManager;
  }

  private get relationManager(): RelationManager {
    if (!this._relationManager) {
      this._relationManager = new RelationManager(this.storage);
    }
    return this._relationManager;
  }

  private get searchManager(): SearchManager {
    if (!this._searchManager) {
      this._searchManager = new SearchManager(this.storage);
    }
    return this._searchManager;
  }

  // Public methods delegate to lazy managers
  async createEntities(entities: EntityInput[]): Promise<Entity[]> {
    return this.entityManager.createEntities(entities);
  }

  // ... other delegations
}
```

---

### Task 4.4: Extract TransactionManager Operation Handlers

**File:** `src/memory/core/transactionHandlers.ts`

**Problem:** TransactionManager.ts (472 lines) has verbose discriminated union handling

**Implementation:**
Extract operation handlers into a registry:

```typescript
// src/memory/core/transactionHandlers.ts
import type { KnowledgeGraph } from '../types/entity.types.js';
import type { TransactionOperation } from './TransactionManager.js';

type OperationHandler = (
  graph: KnowledgeGraph,
  operation: TransactionOperation
) => void;

export const operationHandlers: Record<string, OperationHandler> = {
  createEntity: (graph, op) => {
    if (op.type !== 'createEntity') return;
    graph.entities.push(op.entity);
  },

  deleteEntity: (graph, op) => {
    if (op.type !== 'deleteEntity') return;
    const index = graph.entities.findIndex(e => e.name === op.entityName);
    if (index !== -1) graph.entities.splice(index, 1);
  },

  // ... other handlers
};

export function applyOperation(
  graph: KnowledgeGraph,
  operation: TransactionOperation
): void {
  const handler = operationHandlers[operation.type];
  if (handler) {
    handler(graph, operation);
  }
}
```

---

### Task 4.5: Consolidate Duplicate SIMILARITY_WEIGHTS

**Problem:** `SIMILARITY_WEIGHTS` defined in both CompressionManager.ts and constants.ts

**Files to Update:**
1. Remove definition from `src/memory/features/CompressionManager.ts` (lines 25-34)
2. Keep only in `src/memory/utils/constants.ts`
3. Update import in CompressionManager

---

### Task 4.6: Split ExportManager into Format-Specific Modules

**Files to Create:**
- `src/memory/features/exporters/JsonExporter.ts`
- `src/memory/features/exporters/CsvExporter.ts`
- `src/memory/features/exporters/GraphMLExporter.ts`
- `src/memory/features/exporters/GexfExporter.ts`
- `src/memory/features/exporters/DotExporter.ts`
- `src/memory/features/exporters/MarkdownExporter.ts`
- `src/memory/features/exporters/MermaidExporter.ts`
- `src/memory/features/exporters/index.ts`

Each exporter implements a common interface:
```typescript
export interface Exporter {
  export(graph: KnowledgeGraph, options?: ExportOptions): string;
}
```

---

### Task 4.7: Refactor ExportManager to Use Exporters

**File:** `src/memory/features/ExportManager.ts`

Reduce from ~346 lines to ~100 lines:

```typescript
import * as exporters from './exporters/index.js';

export class ExportManager {
  private exporterMap: Record<string, Exporter> = {
    json: new exporters.JsonExporter(),
    csv: new exporters.CsvExporter(),
    graphml: new exporters.GraphMLExporter(),
    gexf: new exporters.GexfExporter(),
    dot: new exporters.DotExporter(),
    markdown: new exporters.MarkdownExporter(),
    mermaid: new exporters.MermaidExporter(),
  };

  async exportGraph(
    format: ExportFormat,
    filter?: ExportFilter
  ): Promise<string> {
    const graph = await this.getFilteredGraph(filter);
    const exporter = this.exporterMap[format];
    if (!exporter) {
      throw new Error(`Unsupported export format: ${format}`);
    }
    return exporter.export(graph);
  }
}
```

**Verification for Sprint 4:**
1. Run `npm run typecheck`
2. Run `npm test` - all tests should pass
3. Verify lazy initialization works (managers only created when accessed)
4. Verify export functionality unchanged

---

## Sprint 5: Type & Import Optimization

**Duration:** 5 tasks
**Priority:** MEDIUM (Code organization improvement)

### Task 5.1: Consolidate Type Re-exports

**File:** `src/memory/types/index.ts`

Ensure all types are exported from a single barrel:

```typescript
// Types barrel export
export type * from './entity.types.js';
export type * from './search.types.js';
export type * from './analytics.types.js';
export type * from './tag.types.js';
export type * from './import-export.types.js';
```

---

### Task 5.2: Create Common Import Groups

**File:** `src/memory/common.ts`

Create a common imports file for frequently used items:

```typescript
// src/memory/common.ts
// Re-export commonly used items for convenient importing

// Types
export type { Entity, Relation, KnowledgeGraph } from './types/index.js';
export type { SearchResult, SearchFilters } from './types/search.types.js';

// Utilities
export {
  normalizeTags,
  hasMatchingTag
} from './utils/tagUtils.js';
export {
  findEntityByName,
  entityExists
} from './utils/entityUtils.js';
export {
  validatePagination
} from './utils/paginationUtils.js';

// Errors
export {
  EntityNotFoundError,
  ValidationError,
  RelationNotFoundError
} from './utils/errors.js';
```

---

### Task 5.3: Reduce Import Statement Verbosity

Review and consolidate imports across files. Replace:

```typescript
// Before: Multiple import lines
import { Entity } from '../types/entity.types.js';
import { SearchResult } from '../types/search.types.js';
import { normalizeTags } from '../utils/tagUtils.js';
import { findEntityByName } from '../utils/entityUtils.js';
import { EntityNotFoundError } from '../utils/errors.js';
```

With:

```typescript
// After: Single import from common
import {
  Entity,
  SearchResult,
  normalizeTags,
  findEntityByName,
  EntityNotFoundError
} from '../common.js';
```

---

### Task 5.4: Add JSDoc Module Documentation

Add module-level JSDoc comments to key files:

```typescript
/**
 * @module EntityManager
 * @description Handles CRUD operations for entities in the knowledge graph.
 *
 * @example
 * const manager = new EntityManager(storage);
 * await manager.createEntities([{ name: 'Alice', entityType: 'person', observations: [] }]);
 */
```

---

### Task 5.5: Update Package Exports Map

**File:** `package.json`

Add exports map for tree-shaking and direct imports:

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/types/index.js",
    "./utils": "./dist/utils/index.js",
    "./core": "./dist/core/index.js",
    "./search": "./dist/search/index.js"
  }
}
```

---

## Sprint 6: Caching & Lazy Loading Infrastructure

**Duration:** 6 tasks
**Priority:** LOW (Performance optimization, not context reduction)

### Task 6.1: Implement Graph Cache in GraphStorage

**File:** `src/memory/core/GraphStorage.ts`

Add in-memory caching with cache invalidation:

```typescript
export class GraphStorage {
  private cache: KnowledgeGraph | null = null;
  private cacheTimestamp: number = 0;
  private readonly cacheTTL = 5000; // 5 seconds

  async loadGraph(): Promise<KnowledgeGraph> {
    if (this.cache && Date.now() - this.cacheTimestamp < this.cacheTTL) {
      return this.cache;
    }

    const graph = await this.loadFromDisk();
    this.cache = graph;
    this.cacheTimestamp = Date.now();
    return graph;
  }

  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    await this.saveToDisk(graph);
    this.cache = graph;
    this.cacheTimestamp = Date.now();
  }

  invalidateCache(): void {
    this.cache = null;
  }
}
```

---

### Task 6.2: Add Entity Index for Fast Lookups

**File:** `src/memory/core/GraphStorage.ts`

Add entity name index:

```typescript
private entityIndex: Map<string, number> = new Map();

private rebuildIndex(graph: KnowledgeGraph): void {
  this.entityIndex.clear();
  graph.entities.forEach((entity, index) => {
    this.entityIndex.set(entity.name, index);
  });
}

getEntityIndex(name: string): number | undefined {
  return this.entityIndex.get(name);
}
```

---

### Task 6.3: Implement Lazy TF-IDF Index

**File:** `src/memory/search/TFIDFIndexManager.ts`

Only build TF-IDF index when first search is performed:

```typescript
export class TFIDFIndexManager {
  private index: TFIDFIndex | null = null;
  private indexVersion: number = 0;

  async getIndex(graph: KnowledgeGraph): Promise<TFIDFIndex> {
    const currentVersion = this.calculateVersion(graph);
    if (!this.index || this.indexVersion !== currentVersion) {
      this.index = this.buildIndex(graph);
      this.indexVersion = currentVersion;
    }
    return this.index;
  }

  private calculateVersion(graph: KnowledgeGraph): number {
    // Simple hash based on entity count and last modified
    return graph.entities.length;
  }
}
```

---

### Task 6.4: Add Batch Operation Support

Create batch operation helper to reduce I/O:

```typescript
// src/memory/core/BatchOperations.ts
export class BatchOperations {
  private operations: Array<() => void> = [];
  private graph: KnowledgeGraph | null = null;

  constructor(private storage: GraphStorage) {}

  async begin(): Promise<void> {
    this.graph = await this.storage.loadGraph();
  }

  addOperation(op: (graph: KnowledgeGraph) => void): void {
    if (!this.graph) throw new Error('Batch not started');
    this.operations.push(() => op(this.graph!));
  }

  async commit(): Promise<void> {
    if (!this.graph) throw new Error('Batch not started');
    this.operations.forEach(op => op());
    await this.storage.saveGraph(this.graph);
    this.operations = [];
    this.graph = null;
  }

  async rollback(): Promise<void> {
    this.operations = [];
    this.graph = null;
  }
}
```

---

### Task 6.5: Add Performance Monitoring

**File:** `src/memory/utils/perfMonitor.ts`

```typescript
export class PerfMonitor {
  private static metrics: Map<string, number[]> = new Map();

  static measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);

    return result;
  }

  static getStats(name: string): { avg: number; max: number; count: number } | null {
    const data = this.metrics.get(name);
    if (!data?.length) return null;
    return {
      avg: data.reduce((a, b) => a + b, 0) / data.length,
      max: Math.max(...data),
      count: data.length
    };
  }
}
```

---

### Task 6.6: Document Performance Optimizations

**File:** `docs/development/PERFORMANCE.md`

Document all caching strategies, lazy loading patterns, and batch operation usage.

---

## Success Metrics

### Code Quality Targets

| Metric | Before | Target | Measurement |
|--------|--------|--------|-------------|
| Total Lines | ~9,461 | ~8,000 | `find src -name "*.ts" | xargs wc -l` |
| MCPServer.ts | 907 | <200 | Line count |
| EntityManager.ts | 647 | <450 | Line count |
| Duplicate patterns | 102+ | <30 | Grep for patterns |
| Avg file size | ~210 | <180 | Total lines / file count |

### Performance Targets

| Operation | Current | Target |
|-----------|---------|--------|
| Cold start | ~200ms | <150ms |
| loadGraph (cached) | ~50ms | <5ms |
| Search (1000 entities) | ~100ms | <50ms |

### Context Reduction

| Area | Before | After |
|------|--------|-------|
| Utility imports | Scattered | Centralized barrel |
| Response formatting | 41 inline | 1 utility call |
| Entity lookup | 27 inline | 1 utility call |
| Filter logic | 4 copies | 1 shared class |

---

## Implementation Checklist

### Sprint 1: Core Utility Extraction
- [ ] Task 1.1: Create responseFormatter.ts
- [ ] Task 1.2: Create tagUtils.ts
- [ ] Task 1.3: Create entityUtils.ts
- [ ] Task 1.4: Create validationHelper.ts
- [ ] Task 1.5: Create paginationUtils.ts
- [ ] Task 1.6: Create filterUtils.ts
- [ ] Task 1.7: Update utils barrel export

### Sprint 2: Search Module Consolidation
- [ ] Task 2.1: Create SearchFilterChain.ts
- [ ] Task 2.2: Refactor BasicSearch
- [ ] Task 2.3: Refactor BooleanSearch
- [ ] Task 2.4: Refactor FuzzySearch
- [ ] Task 2.5: Refactor RankedSearch
- [ ] Task 2.6: Update search barrel export

### Sprint 3: MCPServer Optimization
- [ ] Task 3.1: Extract toolDefinitions.ts
- [ ] Task 3.2: Create toolHandlers.ts
- [ ] Task 3.3: Refactor MCPServer.ts
- [ ] Task 3.4: Split handlers by domain
- [ ] Task 3.5: Split tools by domain
- [ ] Task 3.6: Add type safety
- [ ] Task 3.7: Add handler tests
- [ ] Task 3.8: Update server barrel export

### Sprint 4: Manager Class Optimization
- [ ] Task 4.1: Extract TagOperationsMixin
- [ ] Task 4.2: Refactor EntityManager
- [ ] Task 4.3: Implement lazy initialization
- [ ] Task 4.4: Extract transaction handlers
- [ ] Task 4.5: Consolidate SIMILARITY_WEIGHTS
- [ ] Task 4.6: Create format-specific exporters
- [ ] Task 4.7: Refactor ExportManager

### Sprint 5: Type & Import Optimization
- [ ] Task 5.1: Consolidate type re-exports
- [ ] Task 5.2: Create common imports file
- [ ] Task 5.3: Reduce import verbosity
- [ ] Task 5.4: Add JSDoc documentation
- [ ] Task 5.5: Update package exports map

### Sprint 6: Caching & Lazy Loading
- [ ] Task 6.1: Implement graph cache
- [ ] Task 6.2: Add entity index
- [ ] Task 6.3: Implement lazy TF-IDF
- [ ] Task 6.4: Add batch operations
- [ ] Task 6.5: Add performance monitoring
- [ ] Task 6.6: Document optimizations

---

## Risk Assessment

### Low Risk
- Utility extraction (Sprint 1): Pure refactoring, no behavior change
- Type consolidation (Sprint 5): No runtime impact

### Medium Risk
- Search refactoring (Sprint 2): Need thorough testing of filter behavior
- MCPServer split (Sprint 3): Must verify all 45 tools work identically

### Higher Risk
- Lazy initialization (Sprint 4): Could introduce timing issues
- Caching (Sprint 6): Must handle cache invalidation correctly

### Mitigation
1. Run full test suite after each task
2. Create before/after comparison tests for critical paths
3. Use feature flags for risky changes
4. Implement changes incrementally with git commits

---

## Appendix: File Reference

### Files to Create
```
src/memory/
├── utils/
│   ├── responseFormatter.ts    (Task 1.1)
│   ├── tagUtils.ts             (Task 1.2)
│   ├── entityUtils.ts          (Task 1.3)
│   ├── validationHelper.ts     (Task 1.4)
│   ├── paginationUtils.ts      (Task 1.5)
│   ├── filterUtils.ts          (Task 1.6)
│   └── perfMonitor.ts          (Task 6.5)
├── search/
│   └── SearchFilterChain.ts    (Task 2.1)
├── server/
│   ├── toolDefinitions.ts      (Task 3.1)
│   ├── toolHandlers.ts         (Task 3.2)
│   ├── types.ts                (Task 3.6)
│   ├── handlers/
│   │   ├── entityHandlers.ts   (Task 3.4)
│   │   ├── searchHandlers.ts   (Task 3.4)
│   │   ├── tagHandlers.ts      (Task 3.4)
│   │   ├── hierarchyHandlers.ts(Task 3.4)
│   │   ├── analyticsHandlers.ts(Task 3.4)
│   │   └── index.ts            (Task 3.4)
│   └── tools/
│       ├── entityTools.ts      (Task 3.5)
│       ├── searchTools.ts      (Task 3.5)
│       └── index.ts            (Task 3.5)
├── core/
│   ├── TagOperationsMixin.ts   (Task 4.1)
│   ├── transactionHandlers.ts  (Task 4.4)
│   └── BatchOperations.ts      (Task 6.4)
├── features/
│   └── exporters/
│       ├── JsonExporter.ts     (Task 4.6)
│       ├── CsvExporter.ts      (Task 4.6)
│       ├── GraphMLExporter.ts  (Task 4.6)
│       ├── GexfExporter.ts     (Task 4.6)
│       ├── DotExporter.ts      (Task 4.6)
│       ├── MarkdownExporter.ts (Task 4.6)
│       ├── MermaidExporter.ts  (Task 4.6)
│       └── index.ts            (Task 4.6)
└── common.ts                   (Task 5.2)
```

### Files to Modify
```
src/memory/
├── server/MCPServer.ts         (Tasks 3.3, 3.8)
├── core/
│   ├── EntityManager.ts        (Tasks 1.2-1.6, 4.1-4.2)
│   ├── KnowledgeGraphManager.ts(Task 4.3)
│   ├── TransactionManager.ts   (Task 4.4)
│   └── GraphStorage.ts         (Tasks 6.1, 6.2)
├── search/
│   ├── BasicSearch.ts          (Tasks 1.5-1.6, 2.2)
│   ├── BooleanSearch.ts        (Tasks 1.5-1.6, 2.3)
│   ├── FuzzySearch.ts          (Tasks 1.5-1.6, 2.4)
│   ├── RankedSearch.ts         (Tasks 1.5-1.6, 2.5)
│   ├── TFIDFIndexManager.ts    (Task 6.3)
│   └── index.ts                (Task 2.6)
├── features/
│   ├── ArchiveManager.ts       (Task 1.2)
│   ├── CompressionManager.ts   (Task 4.5)
│   └── ExportManager.ts        (Task 4.7)
├── utils/
│   ├── constants.ts            (Task 4.5)
│   └── index.ts                (Task 1.7)
├── types/index.ts              (Task 5.1)
└── common.ts                   (Task 5.2)
```

---

**Document Version:** 1.0
**Created:** 2025-11-26
**Status:** Ready for Implementation
