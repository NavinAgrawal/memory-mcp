# Unused Files and Exports Analysis

**Generated**: 2026-01-08

## Summary

- **Potentially unused files**: 0
- **Potentially unused exports**: 142

## Potentially Unused Files

These files are not imported by any other file in the codebase:


## Potentially Unused Exports

These exports are not imported by any other file in the codebase:

### `src/core/TransactionManager.ts`

- `TransactionResult` (interface)
- `TransactionOperation` (type)

### `src/features/ArchiveManager.ts`

- `ArchiveCriteria` (interface)
- `ArchiveOptions` (interface)
- `ArchiveResult` (interface)

### `src/features/IOManager.ts`

- `BackupMetadata` (interface)
- `BackupInfo` (interface)
- `ExportFormat` (type)
- `ImportFormat` (type)
- `MergeStrategy` (type)

### `src/search/FuzzySearch.ts`

- `FuzzySearchOptions` (interface)
- `DEFAULT_FUZZY_THRESHOLD` (constant)

### `src/search/VectorStore.ts`

- `SQLiteStorageWithEmbeddings` (interface)

### `src/server/responseCompressor.ts`

- `decompressResponse` (function)
- `isCompressedResponse` (function)
- `estimateCompressionRatio` (function)
- `CompressedResponse` (interface)
- `ResponseCompressionOptions` (interface)

### `src/server/toolDefinitions.ts`

- `ToolDefinition` (interface)

### `src/server/toolHandlers.ts`

- `ToolResponse` (type)
- `ToolHandler` (type)
- `toolHandlers` (constant)

### `src/types/types.ts`

- `Relation` (interface)
- `KnowledgeGraph` (interface)
- `FuzzyCacheKey` (interface)
- `BooleanCacheEntry` (interface)
- `PaginatedCacheEntry` (interface)
- `TokenizedEntity` (interface)
- `SearchResult` (interface)
- `SavedSearch` (interface)
- `DocumentVector` (interface)
- `TFIDFIndex` (interface)
- `GraphStats` (interface)
- `ValidationReport` (interface)
- `ValidationIssue` (interface)
- `ValidationWarning` (interface)
- `ExportFilter` (interface)
- `ImportResult` (interface)
- `CompressionResult` (interface)
- `BackupOptions` (interface)
- `BackupResult` (interface)
- `RestoreResult` (interface)
- `BackupMetadataExtended` (interface)
- `BackupInfoExtended` (interface)
- `ExportOptions` (interface)
- `ExportResult` (interface)
- `ArchiveResultExtended` (interface)
- `CacheCompressionStats` (interface)
- `TagAlias` (interface)
- `LowercaseData` (interface)
- `StorageConfig` (interface)
- `IGraphStorage` (interface)
- `TraversalOptions` (interface)
- `TraversalResult` (interface)
- `PathResult` (interface)
- `ConnectedComponentsResult` (interface)
- `CentralityResult` (interface)
- `WeightedRelation` (interface)
- `EmbeddingService` (interface)
- `SemanticSearchResult` (interface)
- `IVectorStore` (interface)
- `VectorSearchResult` (interface)
- `EmbeddingConfig` (interface)
- `SemanticIndexOptions` (interface)
- `BatchResult` (interface)
- `BatchOptions` (interface)
- `GraphEventBase` (interface)
- `RelationCreatedEvent` (interface)
- `RelationDeletedEvent` (interface)
- `ObservationAddedEvent` (interface)
- `ObservationDeletedEvent` (interface)
- `GraphSavedEvent` (interface)
- `GraphLoadedEvent` (interface)
- `GraphEventMap` (interface)
- `QueryCostEstimate` (interface)
- `AutoSearchResult` (interface)
- `QueryCostEstimatorOptions` (interface)
- `BooleanQueryNode` (type)
- `BatchOperationType` (type)
- `BatchOperation` (type)
- `GraphEventType` (type)
- `GraphEvent` (type)
- `GraphEventListener` (type)
- `SearchMethod` (type)

### `src/utils/compressedCache.ts`

- `CompressedCacheOptions` (interface)
- `CompressedCacheStats` (interface)

### `src/utils/compressionUtil.ts`

- `CompressionOptions` (interface)
- `CompressionResult` (interface)
- `CompressionMetadata` (interface)

### `src/utils/constants.ts`

- `CompressionQuality` (type)
- `EMBEDDING_ENV_VARS` (constant)

### `src/utils/entityUtils.ts`

- `findEntityByName` (function)
- `findEntityByName` (function)
- `findEntityByName` (function)
- `findEntityByName` (function)
- `normalizeTag` (function)
- `isWithinDateRange` (function)
- `isWithinImportanceRange` (function)
- `validateFilePath` (function)
- `CommonSearchFilters` (interface)

### `src/utils/formatters.ts`

- `formatToolResponse` (function)
- `validatePagination` (function)
- `ValidatedPagination` (interface)
- `ToolResponse` (type)

### `src/utils/operationUtils.ts`

- `PhaseDefinition` (interface)

### `src/utils/schemas.ts`

- `formatZodErrors` (function)
- `validateEntity` (function)
- `ValidationResult` (interface)
- `EntityInput` (type)
- `CreateEntityInput` (type)
- `UpdateEntityInput` (type)
- `RelationInput` (type)
- `CreateRelationInput` (type)
- `SearchQuery` (type)
- `DateRange` (type)
- `TagAlias` (type)
- `ExportFormat` (type)
- `AddObservationInput` (type)
- `DeleteObservationInput` (type)
- `ArchiveCriteriaInput` (type)
- `SavedSearchInput` (type)
- `SavedSearchUpdateInput` (type)
- `ImportFormat` (type)
- `ExtendedExportFormat` (type)
- `MergeStrategy` (type)
- `ExportFilterInput` (type)
- `EntitySchema` (constant)
- `AddObservationInputSchema` (constant)
- `ArchiveCriteriaSchema` (constant)
- `SavedSearchInputSchema` (constant)
- `ImportFormatSchema` (constant)
- `OptionalTagsSchema` (constant)

### `src/utils/searchCache.ts`

- `CacheStats` (interface)

### `src/utils/taskScheduler.ts`

- `batchProcess` (function)
- `debounce` (function)
- `TaskQueue` (class)
- `Task` (interface)
- `TaskResult` (interface)
- `BatchOptions` (interface)
- `QueueStats` (interface)

### `src/workers/levenshteinWorker.ts`

- `WorkerInput` (interface)
- `MatchResult` (interface)

