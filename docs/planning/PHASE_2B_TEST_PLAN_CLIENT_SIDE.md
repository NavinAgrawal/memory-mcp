# Phase 2B Test Plan: MCP Client-Side Tool Testing

**Version**: 1.0.0
**Created**: 2025-12-29
**Status**: Planned
**Total Sprints**: 6
**Total Tasks**: 24 tasks organized into sprints of 4 items

---

## Executive Summary

This plan covers end-to-end testing of all 47 MCP tools through the client interface. Unlike Phase 2 (unit tests), this phase validates the complete tool call lifecycle: parameter parsing, tool execution, response formatting, and error handling via MCP protocol.

### Goals

1. **Parameter Validation**: Test all required and optional parameters for each tool
2. **Response Format**: Verify MCP-compliant response structures
3. **Error Handling**: Test invalid inputs, missing parameters, edge cases
4. **Integration Workflows**: Test multi-tool operations that simulate real usage
5. **Protocol Compliance**: Ensure all tools work via MCP `tools/call` protocol

### Current State

| Category | Tools | Current E2E Tests | Target |
|----------|-------|-------------------|--------|
| Entity Operations | 4 | 3 | 20+ |
| Relation Operations | 2 | 1 | 12+ |
| Observation Operations | 2 | 0 | 10+ |
| Search Operations | 6 | 2 | 35+ |
| Saved Search Operations | 5 | 0 | 20+ |
| Tag Operations | 6 | 0 | 25+ |
| Tag Alias Operations | 5 | 0 | 20+ |
| Hierarchy Operations | 9 | 0 | 35+ |
| Analytics Operations | 2 | 0 | 10+ |
| Compression Operations | 4 | 0 | 18+ |
| Import/Export Operations | 2 | 0 | 25+ |
| **Total** | **47** | **~6** | **~230+** |

### Test Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Test Runner (Vitest)                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                 MCP Client Test Harness                      │
│  - Simulates MCP tools/call protocol                        │
│  - Validates request/response format                        │
│  - Manages test graph lifecycle                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    MCPServer Instance                        │
│  - handleToolCall dispatcher                                │
│  - 47 registered tool handlers                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              KnowledgeGraphManager + Storage                 │
│  - Temporary JSONL files per test                           │
│  - Clean isolation between tests                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Sprint 1: Entity & Relation Tool Tests

**Priority**: CRITICAL
**Impact**: Core CRUD operations for the knowledge graph
**Target Tests**: 45+

### Task 1.1: create_entities Tool Tests

**File**: `src/memory/__tests__/e2e/tools/entity-tools.test.ts` (new)

**Test Cases**:
```typescript
describe('create_entities tool', () => {
  describe('Required Parameters', () => {
    it('should create single entity with required fields');
    it('should create multiple entities in batch');
    it('should require entities array parameter');
    it('should require name field in each entity');
    it('should require entityType field in each entity');
    it('should require observations array in each entity');
  });

  describe('Optional Parameters', () => {
    it('should accept tags array');
    it('should accept importance number (0-10)');
    it('should accept parentId for hierarchy');
  });

  describe('Response Format', () => {
    it('should return MCP-compliant content array');
    it('should include created entities in response');
    it('should include createdAt timestamp');
    it('should include lastModified timestamp');
  });

  describe('Error Handling', () => {
    it('should reject empty entities array');
    it('should reject entity without name');
    it('should reject entity without entityType');
    it('should reject duplicate entity names');
    it('should reject importance outside 0-10');
    it('should reject non-array observations');
  });

  describe('Edge Cases', () => {
    it('should handle entity with empty observations');
    it('should handle unicode in entity name');
    it('should handle special characters in observations');
    it('should handle very long entity names (1000+ chars)');
    it('should normalize tags to lowercase');
  });
});
```

**Parameter Schema Verification**:
| Parameter | Type | Required | Constraints |
|-----------|------|----------|-------------|
| entities | array | Yes | Non-empty |
| entities[].name | string | Yes | Non-empty |
| entities[].entityType | string | Yes | Non-empty |
| entities[].observations | string[] | Yes | Array of strings |
| entities[].tags | string[] | No | Normalized to lowercase |
| entities[].importance | number | No | 0-10 range |

**Acceptance Criteria**:
- [ ] 20+ tests covering all parameters
- [ ] All error cases verified
- [ ] Response format validated

---

### Task 1.2: delete_entities Tool Tests

**Test Cases**:
```typescript
describe('delete_entities tool', () => {
  describe('Required Parameters', () => {
    it('should delete single entity by name');
    it('should delete multiple entities in batch');
    it('should require entityNames array parameter');
  });

  describe('Response Format', () => {
    it('should return success response');
    it('should include deleted entity names');
  });

  describe('Error Handling', () => {
    it('should handle non-existent entity gracefully');
    it('should reject empty entityNames array');
    it('should reject non-array entityNames');
  });

  describe('Side Effects', () => {
    it('should delete relations involving deleted entity');
    it('should update children parentId to null');
  });
});
```

**Parameter Schema Verification**:
| Parameter | Type | Required | Constraints |
|-----------|------|----------|-------------|
| entityNames | string[] | Yes | Non-empty array |

---

### Task 1.3: read_graph & open_nodes Tool Tests

**Test Cases**:
```typescript
describe('read_graph tool', () => {
  describe('Parameters', () => {
    it('should require no parameters');
    it('should ignore extra parameters');
  });

  describe('Response Format', () => {
    it('should return entities array');
    it('should return relations array');
    it('should return empty arrays for empty graph');
  });
});

describe('open_nodes tool', () => {
  describe('Required Parameters', () => {
    it('should open single node by name');
    it('should open multiple nodes');
    it('should require names array parameter');
  });

  describe('Response Format', () => {
    it('should return matching entities');
    it('should return relations between opened nodes');
    it('should exclude relations to non-opened nodes');
  });

  describe('Error Handling', () => {
    it('should return empty for non-existent names');
    it('should handle mixed existing/non-existing names');
  });
});
```

---

### Task 1.4: Relation Tools Tests

**File**: `src/memory/__tests__/e2e/tools/relation-tools.test.ts` (new)

**Test Cases**:
```typescript
describe('create_relations tool', () => {
  describe('Required Parameters', () => {
    it('should create single relation');
    it('should create multiple relations');
    it('should require from field');
    it('should require to field');
    it('should require relationType field');
  });

  describe('Response Format', () => {
    it('should return created relations');
    it('should include createdAt timestamp');
  });

  describe('Error Handling', () => {
    it('should reject relation with non-existent from entity');
    it('should reject relation with non-existent to entity');
    it('should reject duplicate relations');
    it('should reject empty relationType');
  });

  describe('Edge Cases', () => {
    it('should allow self-referencing relations');
    it('should handle unicode in relationType');
  });
});

describe('delete_relations tool', () => {
  describe('Required Parameters', () => {
    it('should delete single relation');
    it('should delete multiple relations');
    it('should require from, to, relationType');
  });

  describe('Error Handling', () => {
    it('should handle non-existent relation gracefully');
  });
});
```

**Parameter Schema Verification**:
| Parameter | Type | Required | Constraints |
|-----------|------|----------|-------------|
| relations | array | Yes | Non-empty |
| relations[].from | string | Yes | Must exist |
| relations[].to | string | Yes | Must exist |
| relations[].relationType | string | Yes | Non-empty |

---

## Sprint 2: Search Tool Tests

**Priority**: HIGH
**Impact**: Primary user-facing functionality
**Target Tests**: 55+

### Task 2.1: search_nodes Tool Tests

**File**: `src/memory/__tests__/e2e/tools/search-tools.test.ts` (new)

**Test Cases**:
```typescript
describe('search_nodes tool', () => {
  describe('Required Parameters', () => {
    it('should search by query string');
    it('should require query parameter');
  });

  describe('Optional Parameters', () => {
    it('should filter by tags array');
    it('should filter by minImportance');
    it('should filter by maxImportance');
    it('should combine all filters');
  });

  describe('Search Behavior', () => {
    it('should match entity names');
    it('should match entity types');
    it('should match observations');
    it('should be case-insensitive');
  });

  describe('Response Format', () => {
    it('should return entities array');
    it('should return relations array');
  });

  describe('Edge Cases', () => {
    it('should handle empty query string');
    it('should handle special regex characters');
    it('should handle unicode queries');
  });
});
```

**Parameter Schema Verification**:
| Parameter | Type | Required | Constraints |
|-----------|------|----------|-------------|
| query | string | Yes | Any string |
| tags | string[] | No | Filter entities |
| minImportance | number | No | 0-10 |
| maxImportance | number | No | 0-10 |

---

### Task 2.2: Advanced Search Tools Tests

**Test Cases**:
```typescript
describe('search_nodes_ranked tool', () => {
  describe('Required Parameters', () => {
    it('should search with TF-IDF ranking');
    it('should require query parameter');
  });

  describe('Optional Parameters', () => {
    it('should filter by tags');
    it('should filter by importance range');
    it('should limit results');
  });

  describe('Response Format', () => {
    it('should return ranked results with scores');
    it('should sort by score descending');
  });
});

describe('boolean_search tool', () => {
  describe('Boolean Operators', () => {
    it('should handle AND operator');
    it('should handle OR operator');
    it('should handle NOT operator');
    it('should handle parentheses grouping');
    it('should handle complex expressions');
  });

  describe('Optional Parameters', () => {
    it('should combine with tag filter');
    it('should combine with importance filter');
  });
});

describe('fuzzy_search tool', () => {
  describe('Required Parameters', () => {
    it('should search with typo tolerance');
    it('should require query parameter');
  });

  describe('Optional Parameters', () => {
    it('should accept threshold (0.0-1.0)');
    it('should use default threshold of 0.7');
    it('should filter by tags');
    it('should filter by importance');
  });

  describe('Fuzzy Matching', () => {
    it('should match with 1 typo');
    it('should match with 2 typos');
    it('should respect threshold strictness');
  });
});
```

---

### Task 2.3: search_by_date_range Tool Tests

**Test Cases**:
```typescript
describe('search_by_date_range tool', () => {
  describe('Optional Parameters', () => {
    it('should filter by startDate only');
    it('should filter by endDate only');
    it('should filter by date range');
    it('should filter by entityType');
    it('should filter by tags');
    it('should combine all filters');
  });

  describe('Date Format', () => {
    it('should accept ISO 8601 dates');
    it('should handle timezone offsets');
  });

  describe('Edge Cases', () => {
    it('should return empty for no matches');
    it('should handle entities without createdAt');
  });
});
```

**Parameter Schema Verification**:
| Parameter | Type | Required | Constraints |
|-----------|------|----------|-------------|
| startDate | string | No | ISO 8601 |
| endDate | string | No | ISO 8601 |
| entityType | string | No | Filter |
| tags | string[] | No | Filter |

---

### Task 2.4: get_search_suggestions Tool Tests

**Test Cases**:
```typescript
describe('get_search_suggestions tool', () => {
  describe('Required Parameters', () => {
    it('should get suggestions for query');
    it('should require query parameter');
  });

  describe('Optional Parameters', () => {
    it('should accept maxSuggestions');
    it('should default to reasonable limit');
  });

  describe('Response Format', () => {
    it('should return string array');
    it('should return relevant suggestions');
  });
});
```

---

## Sprint 3: Saved Search & Observation Tool Tests

**Priority**: HIGH
**Impact**: Persistent search and data management
**Target Tests**: 35+

### Task 3.1: Saved Search CRUD Tools Tests

**File**: `src/memory/__tests__/e2e/tools/saved-search-tools.test.ts` (new)

**Test Cases**:
```typescript
describe('save_search tool', () => {
  describe('Required Parameters', () => {
    it('should save search with name and query');
    it('should require name parameter');
    it('should require query parameter');
  });

  describe('Optional Parameters', () => {
    it('should accept tags filter');
    it('should accept minImportance');
    it('should accept maxImportance');
    it('should accept searchType');
    it('should accept description');
  });

  describe('Response Format', () => {
    it('should return saved search object');
    it('should include createdAt');
    it('should include useCount (0)');
  });

  describe('Error Handling', () => {
    it('should reject duplicate names');
  });
});

describe('execute_saved_search tool', () => {
  describe('Required Parameters', () => {
    it('should execute by name');
    it('should require name parameter');
  });

  describe('Behavior', () => {
    it('should apply saved parameters');
    it('should increment useCount');
    it('should update lastUsed');
  });

  describe('Error Handling', () => {
    it('should error for non-existent search');
  });
});

describe('list_saved_searches tool', () => {
  it('should return all saved searches');
  it('should return empty array when none exist');
  it('should require no parameters');
});

describe('update_saved_search tool', () => {
  describe('Required Parameters', () => {
    it('should update by name');
    it('should require name parameter');
    it('should require updates object');
  });

  describe('Updatable Fields', () => {
    it('should update query');
    it('should update tags');
    it('should update importance range');
    it('should update description');
  });
});

describe('delete_saved_search tool', () => {
  it('should delete by name');
  it('should return false for non-existent');
});
```

---

### Task 3.2: Observation Tools Tests

**File**: `src/memory/__tests__/e2e/tools/observation-tools.test.ts` (new)

**Test Cases**:
```typescript
describe('add_observations tool', () => {
  describe('Required Parameters', () => {
    it('should add observations to entity');
    it('should require observations array');
    it('should require entityName in each item');
    it('should require contents array in each item');
  });

  describe('Batch Operations', () => {
    it('should add to multiple entities');
    it('should add multiple observations per entity');
  });

  describe('Error Handling', () => {
    it('should error for non-existent entity');
  });

  describe('Side Effects', () => {
    it('should update lastModified timestamp');
  });
});

describe('delete_observations tool', () => {
  describe('Required Parameters', () => {
    it('should delete specific observations');
    it('should require deletions array');
    it('should require entityName in each item');
    it('should require observations array in each item');
  });

  describe('Behavior', () => {
    it('should only delete matching observations');
    it('should handle non-existent observations gracefully');
  });
});
```

**Parameter Schema Verification**:
| Parameter | Type | Required | Constraints |
|-----------|------|----------|-------------|
| observations | array | Yes | Non-empty |
| observations[].entityName | string | Yes | Must exist |
| observations[].contents | string[] | Yes | Non-empty |

---

### Task 3.3: Tag Tools Tests (Part 1)

**File**: `src/memory/__tests__/e2e/tools/tag-tools.test.ts` (new)

**Test Cases**:
```typescript
describe('add_tags tool', () => {
  describe('Required Parameters', () => {
    it('should add tags to entity');
    it('should require entityName');
    it('should require tags array');
  });

  describe('Behavior', () => {
    it('should normalize tags to lowercase');
    it('should not add duplicate tags');
  });
});

describe('remove_tags tool', () => {
  describe('Required Parameters', () => {
    it('should remove tags from entity');
    it('should require entityName');
    it('should require tags array');
  });
});

describe('set_importance tool', () => {
  describe('Required Parameters', () => {
    it('should set importance');
    it('should require entityName');
    it('should require importance');
  });

  describe('Validation', () => {
    it('should reject importance < 0');
    it('should reject importance > 10');
    it('should accept decimal importance');
  });
});
```

---

### Task 3.4: Tag Tools Tests (Part 2)

**Test Cases**:
```typescript
describe('add_tags_to_multiple_entities tool', () => {
  describe('Required Parameters', () => {
    it('should add tags to multiple entities');
    it('should require entityNames array');
    it('should require tags array');
  });

  describe('Error Handling', () => {
    it('should handle mix of existing/non-existing entities');
  });
});

describe('replace_tag tool', () => {
  describe('Required Parameters', () => {
    it('should replace tag across all entities');
    it('should require oldTag');
    it('should require newTag');
  });

  describe('Response', () => {
    it('should return count of affected entities');
  });
});

describe('merge_tags tool', () => {
  describe('Required Parameters', () => {
    it('should merge two tags into target');
    it('should require tag1');
    it('should require tag2');
    it('should require targetTag');
  });
});
```

---

## Sprint 4: Tag Alias & Hierarchy Tool Tests

**Priority**: MEDIUM
**Impact**: Advanced organization features
**Target Tests**: 55+

### Task 4.1: Tag Alias Tools Tests

**File**: `src/memory/__tests__/e2e/tools/tag-alias-tools.test.ts` (new)

**Test Cases**:
```typescript
describe('add_tag_alias tool', () => {
  describe('Required Parameters', () => {
    it('should add alias mapping');
    it('should require alias');
    it('should require canonical');
  });

  describe('Optional Parameters', () => {
    it('should accept description');
  });

  describe('Error Handling', () => {
    it('should reject duplicate alias');
  });
});

describe('list_tag_aliases tool', () => {
  it('should return all aliases');
  it('should return empty array when none exist');
});

describe('remove_tag_alias tool', () => {
  describe('Required Parameters', () => {
    it('should remove alias');
    it('should require alias parameter');
  });
});

describe('get_aliases_for_tag tool', () => {
  describe('Required Parameters', () => {
    it('should return aliases for canonical tag');
    it('should require canonicalTag parameter');
  });

  describe('Response', () => {
    it('should return string array');
    it('should return empty for tag without aliases');
  });
});

describe('resolve_tag tool', () => {
  describe('Required Parameters', () => {
    it('should resolve alias to canonical');
    it('should require tag parameter');
  });

  describe('Behavior', () => {
    it('should return same tag if not an alias');
    it('should handle nested aliases');
  });
});
```

---

### Task 4.2: Hierarchy Tools Tests (Parent/Child)

**File**: `src/memory/__tests__/e2e/tools/hierarchy-tools.test.ts` (new)

**Test Cases**:
```typescript
describe('set_entity_parent tool', () => {
  describe('Required Parameters', () => {
    it('should set parent for entity');
    it('should require entityName');
    it('should require parentName (string or null)');
  });

  describe('Behavior', () => {
    it('should allow null to remove parent');
    it('should update child references');
  });

  describe('Cycle Detection', () => {
    it('should reject self as parent');
    it('should reject child as parent (direct cycle)');
    it('should reject descendant as parent (indirect cycle)');
  });
});

describe('get_children tool', () => {
  describe('Required Parameters', () => {
    it('should return direct children');
    it('should require entityName');
  });

  describe('Response', () => {
    it('should return entity array');
    it('should return empty for leaf nodes');
  });
});

describe('get_parent tool', () => {
  describe('Required Parameters', () => {
    it('should return parent entity');
    it('should require entityName');
  });

  describe('Response', () => {
    it('should return null for root entities');
  });
});
```

---

### Task 4.3: Hierarchy Tools Tests (Ancestors/Descendants)

**Test Cases**:
```typescript
describe('get_ancestors tool', () => {
  describe('Required Parameters', () => {
    it('should return all ancestors');
    it('should require entityName');
  });

  describe('Response', () => {
    it('should return entities in order (parent first)');
    it('should return empty for root entities');
    it('should handle deep hierarchies');
  });
});

describe('get_descendants tool', () => {
  describe('Required Parameters', () => {
    it('should return all descendants');
    it('should require entityName');
  });

  describe('Response', () => {
    it('should include all levels');
    it('should return empty for leaf nodes');
  });
});

describe('get_subtree tool', () => {
  describe('Required Parameters', () => {
    it('should return entity and descendants');
    it('should require entityName');
  });

  describe('Response', () => {
    it('should include root entity');
    it('should include all descendants');
    it('should include relations within subtree');
  });
});
```

---

### Task 4.4: Hierarchy Tools Tests (Navigation)

**Test Cases**:
```typescript
describe('get_root_entities tool', () => {
  it('should return entities without parents');
  it('should return all entities when no hierarchy');
  it('should require no parameters');
});

describe('get_entity_depth tool', () => {
  describe('Required Parameters', () => {
    it('should return depth in hierarchy');
    it('should require entityName');
  });

  describe('Response', () => {
    it('should return 0 for root entities');
    it('should return 1 for direct children of root');
    it('should handle deep hierarchies');
  });
});

describe('move_entity tool', () => {
  describe('Required Parameters', () => {
    it('should move to new parent');
    it('should require entityName');
    it('should require newParentName (string or null)');
  });

  describe('Cycle Detection', () => {
    it('should reject moving to descendant');
  });
});
```

---

## Sprint 5: Analytics & Compression Tool Tests

**Priority**: MEDIUM
**Impact**: Graph maintenance and analysis
**Target Tests**: 30+

### Task 5.1: Analytics Tools Tests

**File**: `src/memory/__tests__/e2e/tools/analytics-tools.test.ts` (new)

**Test Cases**:
```typescript
describe('get_graph_stats tool', () => {
  it('should return statistics');
  it('should require no parameters');

  describe('Response Fields', () => {
    it('should include totalEntities');
    it('should include totalRelations');
    it('should include entityTypesCounts');
    it('should include relationTypesCounts');
    it('should include oldestEntity');
    it('should include newestEntity');
    it('should include entityDateRange');
    it('should include relationDateRange');
  });

  describe('Edge Cases', () => {
    it('should handle empty graph');
    it('should handle graph with no relations');
  });
});

describe('validate_graph tool', () => {
  it('should validate graph integrity');
  it('should require no parameters');

  describe('Issue Detection', () => {
    it('should detect orphaned relations');
    it('should detect duplicate entities');
    it('should detect invalid entity data');
  });

  describe('Warning Detection', () => {
    it('should warn about isolated entities');
    it('should warn about empty observations');
    it('should warn about missing timestamps');
  });

  describe('Response Format', () => {
    it('should return isValid boolean');
    it('should return issues array');
    it('should return warnings array');
    it('should return summary');
  });
});
```

---

### Task 5.2: Compression Tools Tests (Find & Merge)

**File**: `src/memory/__tests__/e2e/tools/compression-tools.test.ts` (new)

**Test Cases**:
```typescript
describe('find_duplicates tool', () => {
  describe('Optional Parameters', () => {
    it('should find duplicates with default threshold');
    it('should accept threshold (0.0-1.0)');
  });

  describe('Response Format', () => {
    it('should return duplicate groups');
    it('should include similarity scores');
  });

  describe('Similarity Detection', () => {
    it('should detect name similarity');
    it('should detect observation similarity');
    it('should detect type similarity');
  });
});

describe('merge_entities tool', () => {
  describe('Required Parameters', () => {
    it('should merge multiple entities');
    it('should require entityNames array (2+)');
  });

  describe('Optional Parameters', () => {
    it('should accept targetName');
    it('should use first entity name as default');
  });

  describe('Merge Behavior', () => {
    it('should combine observations');
    it('should combine tags');
    it('should preserve earliest createdAt');
    it('should update lastModified');
    it('should redirect relations');
  });

  describe('Error Handling', () => {
    it('should require at least 2 entities');
    it('should reject non-existent entities');
  });
});
```

---

### Task 5.3: Compression Tools Tests (Compress & Archive)

**Test Cases**:
```typescript
describe('compress_graph tool', () => {
  describe('Optional Parameters', () => {
    it('should compress with default threshold');
    it('should accept threshold');
    it('should accept dryRun');
  });

  describe('Dry Run Mode', () => {
    it('should preview without changes');
    it('should return would-be-merged entities');
  });

  describe('Actual Compression', () => {
    it('should merge similar entities');
    it('should return merge count');
  });
});

describe('archive_entities tool', () => {
  describe('Optional Parameters', () => {
    it('should archive by olderThan date');
    it('should archive by importanceLessThan');
    it('should archive by tags');
    it('should combine criteria');
    it('should accept dryRun');
  });

  describe('Dry Run Mode', () => {
    it('should preview without changes');
    it('should return would-be-archived entities');
  });

  describe('Actual Archive', () => {
    it('should remove matching entities');
    it('should remove related relations');
    it('should return archived count');
  });
});
```

---

### Task 5.4: Compression Edge Cases

**Test Cases**:
```typescript
describe('Compression Edge Cases', () => {
  describe('find_duplicates', () => {
    it('should handle empty graph');
    it('should handle graph with no duplicates');
    it('should handle very similar names');
    it('should respect threshold boundary');
  });

  describe('merge_entities', () => {
    it('should handle entities with no observations');
    it('should handle entities with no tags');
    it('should handle hierarchical entities');
    it('should preserve parent-child relationships');
  });

  describe('archive_entities', () => {
    it('should handle entities without lastModified');
    it('should handle entities without importance');
    it('should handle archiving all entities');
  });
});
```

---

## Sprint 6: Import/Export & Integration Tests

**Priority**: MEDIUM
**Impact**: Data portability and complete workflows
**Target Tests**: 50+

### Task 6.1: import_graph Tool Tests

**File**: `src/memory/__tests__/e2e/tools/import-export-tools.test.ts` (new)

**Test Cases**:
```typescript
describe('import_graph tool', () => {
  describe('Required Parameters', () => {
    it('should require format parameter');
    it('should require data parameter');
  });

  describe('JSON Format', () => {
    it('should import valid JSON');
    it('should import entities and relations');
    it('should reject invalid JSON');
  });

  describe('CSV Format', () => {
    it('should import entity CSV');
    it('should handle missing columns gracefully');
  });

  describe('GraphML Format', () => {
    it('should import valid GraphML');
    it('should preserve node attributes');
    it('should preserve edge attributes');
  });

  describe('Merge Strategies', () => {
    it('should replace with mergeStrategy=replace');
    it('should skip duplicates with mergeStrategy=skip');
    it('should merge data with mergeStrategy=merge');
    it('should fail on conflict with mergeStrategy=fail');
  });

  describe('Dry Run Mode', () => {
    it('should preview without changes');
    it('should return import summary');
  });
});
```

**Parameter Schema Verification**:
| Parameter | Type | Required | Constraints |
|-----------|------|----------|-------------|
| format | string | Yes | 'json' \| 'csv' \| 'graphml' |
| data | string | Yes | Format-valid string |
| mergeStrategy | string | No | 'replace' \| 'skip' \| 'merge' \| 'fail' |
| dryRun | boolean | No | Default: false |

---

### Task 6.2: export_graph Tool Tests

**Test Cases**:
```typescript
describe('export_graph tool', () => {
  describe('Required Parameters', () => {
    it('should require format parameter');
  });

  describe('JSON Export', () => {
    it('should export valid JSON');
    it('should include all entities');
    it('should include all relations');
  });

  describe('CSV Export', () => {
    it('should export valid CSV');
    it('should escape special characters');
  });

  describe('GraphML Export', () => {
    it('should export valid GraphML XML');
    it('should include node attributes');
    it('should include edge attributes');
  });

  describe('GEXF Export', () => {
    it('should export valid GEXF XML');
  });

  describe('DOT Export', () => {
    it('should export valid DOT graph');
  });

  describe('Markdown Export', () => {
    it('should export readable Markdown');
    it('should include entity sections');
    it('should include relation sections');
  });

  describe('Mermaid Export', () => {
    it('should export valid Mermaid diagram');
  });

  describe('Filter Option', () => {
    it('should filter by startDate');
    it('should filter by endDate');
    it('should filter by entityType');
    it('should filter by tags');
  });
});
```

**Parameter Schema Verification**:
| Parameter | Type | Required | Constraints |
|-----------|------|----------|-------------|
| format | string | Yes | 'json' \| 'csv' \| 'graphml' \| 'gexf' \| 'dot' \| 'markdown' \| 'mermaid' |
| filter | object | No | Contains startDate, endDate, entityType, tags |

---

### Task 6.3: Multi-Tool Workflow Tests

**File**: `src/memory/__tests__/e2e/workflows/tool-workflows.test.ts` (new)

**Test Cases**:
```typescript
describe('Tool Workflows', () => {
  describe('CRUD Workflow', () => {
    it('should create, read, update, delete entity');
    it('should create entity, add relations, search, delete');
  });

  describe('Hierarchy Workflow', () => {
    it('should create parent-child structure');
    it('should navigate hierarchy up and down');
    it('should move entities between parents');
  });

  describe('Search Workflow', () => {
    it('should save search, execute, and update');
    it('should use different search types on same data');
  });

  describe('Tag Workflow', () => {
    it('should add tags, create alias, resolve');
    it('should replace and merge tags');
  });

  describe('Maintenance Workflow', () => {
    it('should find duplicates and merge');
    it('should validate, fix issues, validate again');
    it('should backup, modify, restore');
  });

  describe('Import/Export Workflow', () => {
    it('should export, clear, import same data');
    it('should export in one format, verify content');
  });
});
```

---

### Task 6.4: Error Response Format Tests

**File**: `src/memory/__tests__/e2e/tools/error-handling.test.ts` (new)

**Test Cases**:
```typescript
describe('Error Response Format', () => {
  describe('MCP Error Format', () => {
    it('should return isError: true on error');
    it('should include error message in content');
    it('should use text content type');
  });

  describe('Validation Errors', () => {
    it('should report missing required parameters');
    it('should report invalid parameter types');
    it('should report constraint violations');
  });

  describe('Business Logic Errors', () => {
    it('should report entity not found');
    it('should report relation not found');
    it('should report cycle detected');
    it('should report duplicate entity');
  });

  describe('Unknown Tool', () => {
    it('should error for unknown tool name');
  });
});
```

---

## Appendix A: Test File Checklist

### New Test Files to Create (9 files)

| Sprint | Test File | Target Tests |
|--------|-----------|--------------|
| 1 | `e2e/tools/entity-tools.test.ts` | 25+ |
| 1 | `e2e/tools/relation-tools.test.ts` | 15+ |
| 2 | `e2e/tools/search-tools.test.ts` | 35+ |
| 3 | `e2e/tools/saved-search-tools.test.ts` | 20+ |
| 3 | `e2e/tools/observation-tools.test.ts` | 12+ |
| 3 | `e2e/tools/tag-tools.test.ts` | 25+ |
| 4 | `e2e/tools/tag-alias-tools.test.ts` | 18+ |
| 4 | `e2e/tools/hierarchy-tools.test.ts` | 35+ |
| 5 | `e2e/tools/analytics-tools.test.ts` | 15+ |
| 5 | `e2e/tools/compression-tools.test.ts` | 20+ |
| 6 | `e2e/tools/import-export-tools.test.ts` | 30+ |
| 6 | `e2e/workflows/tool-workflows.test.ts` | 15+ |
| 6 | `e2e/tools/error-handling.test.ts` | 12+ |

---

## Appendix B: Parameter Reference by Tool

### Entity Tools (4)

| Tool | Required Params | Optional Params |
|------|-----------------|-----------------|
| create_entities | entities[].name, entities[].entityType, entities[].observations | tags, importance, parentId |
| delete_entities | entityNames | - |
| read_graph | - | - |
| open_nodes | names | - |

### Relation Tools (2)

| Tool | Required Params | Optional Params |
|------|-----------------|-----------------|
| create_relations | relations[].from, relations[].to, relations[].relationType | - |
| delete_relations | relations[].from, relations[].to, relations[].relationType | - |

### Observation Tools (2)

| Tool | Required Params | Optional Params |
|------|-----------------|-----------------|
| add_observations | observations[].entityName, observations[].contents | - |
| delete_observations | deletions[].entityName, deletions[].observations | - |

### Search Tools (6)

| Tool | Required Params | Optional Params |
|------|-----------------|-----------------|
| search_nodes | query | tags, minImportance, maxImportance |
| search_by_date_range | - | startDate, endDate, entityType, tags |
| search_nodes_ranked | query | tags, minImportance, maxImportance, limit |
| boolean_search | query | tags, minImportance, maxImportance |
| fuzzy_search | query | threshold, tags, minImportance, maxImportance |
| get_search_suggestions | query | maxSuggestions |

### Saved Search Tools (5)

| Tool | Required Params | Optional Params |
|------|-----------------|-----------------|
| save_search | name, query | tags, minImportance, maxImportance, searchType, description |
| execute_saved_search | name | - |
| list_saved_searches | - | - |
| delete_saved_search | name | - |
| update_saved_search | name, updates | - |

### Tag Tools (6)

| Tool | Required Params | Optional Params |
|------|-----------------|-----------------|
| add_tags | entityName, tags | - |
| remove_tags | entityName, tags | - |
| set_importance | entityName, importance | - |
| add_tags_to_multiple_entities | entityNames, tags | - |
| replace_tag | oldTag, newTag | - |
| merge_tags | tag1, tag2, targetTag | - |

### Tag Alias Tools (5)

| Tool | Required Params | Optional Params |
|------|-----------------|-----------------|
| add_tag_alias | alias, canonical | description |
| list_tag_aliases | - | - |
| remove_tag_alias | alias | - |
| get_aliases_for_tag | canonicalTag | - |
| resolve_tag | tag | - |

### Hierarchy Tools (9)

| Tool | Required Params | Optional Params |
|------|-----------------|-----------------|
| set_entity_parent | entityName, parentName | - |
| get_children | entityName | - |
| get_parent | entityName | - |
| get_ancestors | entityName | - |
| get_descendants | entityName | - |
| get_subtree | entityName | - |
| get_root_entities | - | - |
| get_entity_depth | entityName | - |
| move_entity | entityName, newParentName | - |

### Analytics Tools (2)

| Tool | Required Params | Optional Params |
|------|-----------------|-----------------|
| get_graph_stats | - | - |
| validate_graph | - | - |

### Compression Tools (4)

| Tool | Required Params | Optional Params |
|------|-----------------|-----------------|
| find_duplicates | - | threshold |
| merge_entities | entityNames | targetName |
| compress_graph | - | threshold, dryRun |
| archive_entities | - | olderThan, importanceLessThan, tags, dryRun |

### Import/Export Tools (2)

| Tool | Required Params | Optional Params |
|------|-----------------|-----------------|
| import_graph | format, data | mergeStrategy, dryRun |
| export_graph | format | filter.startDate, filter.endDate, filter.entityType, filter.tags |

---

## Appendix C: Test Helper Functions

```typescript
// Suggested test helpers for e2e tests

/**
 * Create a fresh MCPServer instance with temporary storage
 */
async function createTestServer(): Promise<{
  server: MCPServer;
  manager: KnowledgeGraphManager;
  cleanup: () => Promise<void>;
}>;

/**
 * Call a tool and return the parsed response
 */
async function callTool(
  server: MCPServer,
  toolName: string,
  args: Record<string, unknown>
): Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

/**
 * Seed the graph with test data
 */
async function seedTestData(
  manager: KnowledgeGraphManager,
  options?: {
    entityCount?: number;
    relationCount?: number;
    withHierarchy?: boolean;
    withTags?: boolean;
  }
): Promise<void>;

/**
 * Assert MCP response format
 */
function assertValidMCPResponse(response: unknown): void;
```

---

## Appendix D: Estimated Effort

| Sprint | Tasks | New Tests | Hours |
|--------|-------|-----------|-------|
| Sprint 1 | 4 | ~45 | 6 |
| Sprint 2 | 4 | ~55 | 8 |
| Sprint 3 | 4 | ~35 | 5 |
| Sprint 4 | 4 | ~55 | 7 |
| Sprint 5 | 4 | ~30 | 5 |
| Sprint 6 | 4 | ~50 | 7 |
| **Total** | **24** | **~270** | **38** |

---

## Appendix E: Success Criteria

### Per-Sprint Verification

After each sprint, verify:
1. All new tests pass
2. No regressions in existing tests
3. All tool parameters exercised
4. Error cases tested
5. Response format validated

### Final Verification

After all sprints complete:
1. All 47 tools have client-side tests
2. All required parameters tested
3. All optional parameters tested
4. All error cases covered
5. Multi-tool workflows validated
6. Total e2e tests: 270+

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-29 | 1.0.0 | Initial client-side test plan |
