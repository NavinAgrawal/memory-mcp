/**
 * MCP Tool Handlers
 *
 * Contains handler functions for all 91 Knowledge Graph tools.
 * Handlers call managers directly via ManagerContext.
 * All core functionality is imported from @danielsimonjr/memoryjs.
 *
 * @module server/toolHandlers
 */

import path from 'node:path';
import {
  formatToolResponse,
  formatTextResponse,
  formatRawResponse,
  validateWithSchema,
  validateFilePath,
  BatchCreateEntitiesSchema,
  BatchCreateRelationsSchema,
  EntityNamesSchema,
  DeleteRelationsSchema,
  AddObservationsInputSchema,
  DeleteObservationsInputSchema,
  ArchiveCriteriaSchema,
  SavedSearchInputSchema,
  SavedSearchUpdateSchema,
  ImportFormatSchema,
  ExtendedExportFormatSchema,
  MergeStrategySchema,
  ExportFilterSchema,
  SearchQuerySchema,
  HybridSearchManager,
  QueryAnalyzer,
  QueryPlanner,
  ReflectionManager,
  ObservationNormalizer,
  RefIndex,
  AuditLog,
  GovernanceManager,
  FreshnessManager,
  ArtifactManager,
  CollaborativeSynthesis,
  FailureDistillation,
  CognitiveLoadAnalyzer,
  ConsolidationScheduler,
  DistillationPipeline,
  DefaultDistillationPolicy,
  NoOpDistillationPolicy,
  computeEntropy,
  passesEntropyFilter,
  EntropyFilterStage,
  getRoleProfile,
  listRoleProfiles,
  type ManagerContext,
  type AgentRole,
  type ArtifactFilter,
  type CollaborativeSynthesisConfig,
  type FailureDistillationConfig,
  type AuditFilter,
  type SalienceContext,
  type AgentEntity,
} from '@danielsimonjr/memoryjs';
import { z } from 'zod';
import { maybeCompressResponse } from './responseCompressor.js';

// ==================== SINGLETON INFRASTRUCTURE ====================
// WeakMap-based singletons keyed on ManagerContext to avoid re-instantiation per request.
// These managers are not on ManagerContext directly, so we wire them up once per ctx.

const refIndexMap = new WeakMap<ManagerContext, RefIndex>();
const auditLogMap = new WeakMap<ManagerContext, AuditLog>();
const governanceMap = new WeakMap<ManagerContext, GovernanceManager>();
const freshnessMap = new WeakMap<ManagerContext, FreshnessManager>();
const artifactManagerMap = new WeakMap<ManagerContext, ArtifactManager>();
const distillationPipelineMap = new WeakMap<ManagerContext, DistillationPipeline>();
const failureDistillationMap = new WeakMap<ManagerContext, FailureDistillation>();
const consolidationSchedulerMap = new WeakMap<ManagerContext, ConsolidationScheduler>();

function getStorageFilePath(ctx: ManagerContext): string {
  // GraphStorage exposes filePath publicly; fall back to cwd-relative default
  return (ctx.storage as unknown as { filePath?: string }).filePath ?? 'memory.jsonl';
}

function getRefIndex(ctx: ManagerContext): RefIndex {
  if (!refIndexMap.has(ctx)) {
    const storagePath = getStorageFilePath(ctx);
    const dir = path.dirname(storagePath);
    refIndexMap.set(ctx, new RefIndex(path.join(dir, 'memory-ref-index.jsonl')));
  }
  return refIndexMap.get(ctx)!;
}

function getAuditLog(ctx: ManagerContext): AuditLog {
  if (!auditLogMap.has(ctx)) {
    const storagePath = getStorageFilePath(ctx);
    const dir = path.dirname(storagePath);
    auditLogMap.set(ctx, new AuditLog(path.join(dir, 'memory-audit.jsonl')));
  }
  return auditLogMap.get(ctx)!;
}

function getGovernanceManager(ctx: ManagerContext): GovernanceManager {
  if (!governanceMap.has(ctx)) {
    // GovernanceManager constructor accepts GraphStorage; ctx.storage is GraphStorage
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    governanceMap.set(ctx, new GovernanceManager(ctx.storage as any, getAuditLog(ctx)));
  }
  return governanceMap.get(ctx)!;
}

function getFreshnessManager(ctx: ManagerContext): FreshnessManager {
  if (!freshnessMap.has(ctx)) {
    freshnessMap.set(ctx, new FreshnessManager(ctx.storage));
  }
  return freshnessMap.get(ctx)!;
}

function getArtifactManager(ctx: ManagerContext): ArtifactManager {
  if (!artifactManagerMap.has(ctx)) {
    const refIndex = getRefIndex(ctx);
    // EntityManager.registerRef() requires setRefIndex to be called first.
    ctx.entityManager.setRefIndex(refIndex);
    artifactManagerMap.set(ctx, new ArtifactManager(ctx.storage, ctx.entityManager, refIndex));
  }
  return artifactManagerMap.get(ctx)!;
}

function getDistillationPipeline(ctx: ManagerContext): DistillationPipeline {
  if (!distillationPipelineMap.has(ctx)) {
    distillationPipelineMap.set(ctx, new DistillationPipeline());
  }
  return distillationPipelineMap.get(ctx)!;
}

function getFailureDistillation(ctx: ManagerContext): FailureDistillation {
  if (!failureDistillationMap.has(ctx)) {
    failureDistillationMap.set(ctx, new FailureDistillation(ctx.storage));
  }
  return failureDistillationMap.get(ctx)!;
}

/** Simple token estimator: ~4 chars per token */
function estimateTokens(entity: AgentEntity): number {
  const text = [entity.name, entity.entityType, ...entity.observations].join(' ');
  return Math.ceil(text.length / 4);
}

/**
 * Tool response type for MCP SDK compatibility.
 * Extends base response with optional isError flag for error framing.
 */
export type ToolResponse = ReturnType<typeof formatToolResponse> & { isError?: boolean };

/**
 * Tool handler function signature.
 */
export type ToolHandler = (
  ctx: ManagerContext,
  args: Record<string, unknown>
) => Promise<ToolResponse>;

/**
 * Wrapper to apply automatic response compression for large tool responses.
 *
 * Responses exceeding 256KB are automatically compressed with brotli
 * and base64-encoded for transport. The compressed response includes
 * metadata about the compression (original size, compressed size, ratio).
 *
 * @param handler - The original handler function
 * @returns A wrapped handler that may compress the response
 */
async function withCompression(
  handler: () => Promise<ToolResponse>
): Promise<ToolResponse> {
  const result = await handler();

  // Only compress text responses
  const textContent = result.content[0];
  if (textContent?.type !== 'text') {
    return result;
  }

  const compressed = await maybeCompressResponse(textContent.text);

  // If compression was applied, wrap the response
  if (compressed.compressed) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(compressed),
        },
      ],
    };
  }

  // Return original if no compression needed
  return result;
}

/**
 * Registry of all tool handlers keyed by tool name.
 * Handlers call managers directly for reduced abstraction layers.
 *
 * Note: Tools that can return unbounded result sets (read_graph, search_nodes,
 * get_subtree, open_nodes) are wrapped with withCompression() for payloads >256KB.
 * Filtered/limited search tools (search_nodes_ranked, fuzzy_search, etc.) are not
 * wrapped because their results are bounded by query specificity or limit params.
 */
export const toolHandlers: Record<string, ToolHandler> = {
  // ==================== ENTITY HANDLERS ====================
  create_entities: async (ctx, args) => {
    const entities = validateWithSchema(args.entities, BatchCreateEntitiesSchema, 'Invalid entities data');
    return formatToolResponse(await ctx.entityManager.createEntities(entities));
  },

  delete_entities: async (ctx, args) => {
    const entityNames = validateWithSchema(args.entityNames, EntityNamesSchema, 'Invalid entity names');
    await ctx.entityManager.deleteEntities(entityNames);
    return formatTextResponse(`Deleted ${entityNames.length} entities`);
  },

  read_graph: async (ctx) =>
    withCompression(async () => formatToolResponse(await ctx.storage.loadGraph())),

  open_nodes: async (ctx, args) => {
    const names = args.names !== undefined
      ? validateWithSchema(args.names, z.array(z.string()), 'Invalid entity names')
      : [];
    return withCompression(async () =>
      formatToolResponse(await ctx.searchManager.openNodes(names))
    );
  },

  // ==================== RELATION HANDLERS ====================
  create_relations: async (ctx, args) => {
    const relations = validateWithSchema(args.relations, BatchCreateRelationsSchema, 'Invalid relations data');
    return formatToolResponse(await ctx.relationManager.createRelations(relations));
  },

  delete_relations: async (ctx, args) => {
    const relations = validateWithSchema(args.relations, DeleteRelationsSchema, 'Invalid relations data');
    await ctx.relationManager.deleteRelations(relations);
    return formatTextResponse(`Deleted ${relations.length} relations`);
  },

  // ==================== OBSERVATION HANDLERS ====================
  add_observations: async (ctx, args) => {
    const observations = validateWithSchema(args.observations, AddObservationsInputSchema, 'Invalid observations data');
    return formatToolResponse(await ctx.observationManager.addObservations(observations));
  },

  delete_observations: async (ctx, args) => {
    const deletions = validateWithSchema(args.deletions, DeleteObservationsInputSchema, 'Invalid deletion data');
    await ctx.observationManager.deleteObservations(deletions);
    return formatTextResponse('Observations deleted successfully');
  },

  // Phase 11 Sprint 5: Observation Normalization
  normalize_observations: async (ctx, args) => {
    const entityName = args.entityName !== undefined
      ? validateWithSchema(args.entityName, z.string().min(1), 'Invalid entity name')
      : undefined;
    const options = (args.options as {
      resolveCoreferences?: boolean;
      anchorTimestamps?: boolean;
      extractKeywords?: boolean;
    }) ?? {};
    const persist = args.persist === true;

    const normalizer = new ObservationNormalizer();
    const graph = await ctx.storage.loadGraph();

    const entities = entityName
      ? graph.entities.filter(e => e.name === entityName)
      : graph.entities;

    if (entities.length === 0 && entityName) {
      return formatTextResponse(`Entity "${entityName}" not found`);
    }

    const results = entities.map(entity => {
      const { entity: normalized, results: changes } = normalizer.normalizeEntity(entity, options);
      return {
        entityName: entity.name,
        changes: changes.filter(r => r.changes.length > 0),
        normalized: normalized.observations,
      };
    });

    if (persist) {
      // TODO: This bypasses the manager layer and writes directly to storage.
      // May leave in-memory cache stale. Ideally, normalization logic should
      // be moved into a memoryjs manager method. See code review issue #3.
      const updatedEntities = graph.entities.map(entity => {
        const result = results.find(r => r.entityName === entity.name);
        if (result && result.changes.length > 0) {
          return {
            ...entity,
            observations: result.normalized,
            lastModified: new Date().toISOString(),
          };
        }
        return entity;
      });
      await ctx.storage.saveGraph({
        entities: updatedEntities,
        relations: [...graph.relations], // spread needed: graph.relations is readonly
      });
    }

    return formatToolResponse({
      entitiesProcessed: results.length,
      persisted: persist,
      results: results.filter(r => r.changes.length > 0),
    });
  },

  // ==================== SEARCH HANDLERS ====================
  search_nodes: async (ctx, args) => {
    const query = validateWithSchema(args.query, SearchQuerySchema, 'Invalid search query');
    const tags = args.tags !== undefined ? validateWithSchema(args.tags, z.array(z.string()), 'Invalid tags') : undefined;
    const minImportance = args.minImportance !== undefined ? validateWithSchema(args.minImportance, z.number().min(0).max(10), 'Invalid minImportance') : undefined;
    const maxImportance = args.maxImportance !== undefined ? validateWithSchema(args.maxImportance, z.number().min(0).max(10), 'Invalid maxImportance') : undefined;
    return withCompression(async () =>
      formatToolResponse(await ctx.searchManager.searchNodes(query, tags, minImportance, maxImportance))
    );
  },

  search_by_date_range: async (ctx, args) => {
    const startDate = args.startDate !== undefined ? validateWithSchema(args.startDate, z.string(), 'Invalid startDate') : undefined;
    const endDate = args.endDate !== undefined ? validateWithSchema(args.endDate, z.string(), 'Invalid endDate') : undefined;
    const entityType = args.entityType !== undefined ? validateWithSchema(args.entityType, z.string(), 'Invalid entityType') : undefined;
    const tags = args.tags !== undefined ? validateWithSchema(args.tags, z.array(z.string()), 'Invalid tags') : undefined;
    return formatToolResponse(await ctx.searchManager.searchByDateRange(startDate, endDate, entityType, tags));
  },

  search_nodes_ranked: async (ctx, args) => {
    const query = validateWithSchema(args.query, SearchQuerySchema, 'Invalid search query');
    const tags = args.tags !== undefined ? validateWithSchema(args.tags, z.array(z.string()), 'Invalid tags') : undefined;
    const minImportance = args.minImportance !== undefined ? validateWithSchema(args.minImportance, z.number().min(0).max(10), 'Invalid minImportance') : undefined;
    const maxImportance = args.maxImportance !== undefined ? validateWithSchema(args.maxImportance, z.number().min(0).max(10), 'Invalid maxImportance') : undefined;
    const limit = args.limit !== undefined ? validateWithSchema(args.limit, z.number().int().positive(), 'Invalid limit') : undefined;
    return formatToolResponse(await ctx.searchManager.searchNodesRanked(query, tags, minImportance, maxImportance, limit));
  },

  boolean_search: async (ctx, args) => {
    const query = validateWithSchema(args.query, SearchQuerySchema, 'Invalid search query');
    const tags = args.tags !== undefined ? validateWithSchema(args.tags, z.array(z.string()), 'Invalid tags') : undefined;
    const minImportance = args.minImportance !== undefined ? validateWithSchema(args.minImportance, z.number().min(0).max(10), 'Invalid minImportance') : undefined;
    const maxImportance = args.maxImportance !== undefined ? validateWithSchema(args.maxImportance, z.number().min(0).max(10), 'Invalid maxImportance') : undefined;
    return formatToolResponse(await ctx.searchManager.booleanSearch(query, tags, minImportance, maxImportance));
  },

  fuzzy_search: async (ctx, args) => {
    const query = validateWithSchema(args.query, SearchQuerySchema, 'Invalid search query');
    const threshold = args.threshold !== undefined ? validateWithSchema(args.threshold, z.number().min(0).max(1), 'Invalid threshold') : undefined;
    const tags = args.tags !== undefined ? validateWithSchema(args.tags, z.array(z.string()), 'Invalid tags') : undefined;
    const minImportance = args.minImportance !== undefined ? validateWithSchema(args.minImportance, z.number().min(0).max(10), 'Invalid minImportance') : undefined;
    const maxImportance = args.maxImportance !== undefined ? validateWithSchema(args.maxImportance, z.number().min(0).max(10), 'Invalid maxImportance') : undefined;
    return formatToolResponse(await ctx.searchManager.fuzzySearch(query, threshold, tags, minImportance, maxImportance));
  },

  get_search_suggestions: async (ctx, args) => {
    const query = validateWithSchema(args.query, SearchQuerySchema, 'Invalid search query');
    const maxSuggestions = args.maxSuggestions !== undefined ? validateWithSchema(args.maxSuggestions, z.number().int().positive(), 'Invalid maxSuggestions') : undefined;
    return formatToolResponse(await ctx.searchManager.getSearchSuggestions(query, maxSuggestions));
  },

  // Phase 10 Sprint 4: Automatic search method selection
  search_auto: async (ctx, args) => {
    const query = validateWithSchema(args.query, SearchQuerySchema, 'Invalid search query');
    const limit = args.limit !== undefined ? validateWithSchema(args.limit, z.number().int().positive().max(200), 'Invalid limit') : undefined;
    return formatToolResponse(await ctx.searchManager.autoSearch(query, limit));
  },

  // Phase 11 Sprint 2: Hybrid search
  hybrid_search: async (ctx, args) => {
    const query = validateWithSchema(args.query, SearchQuerySchema, 'Invalid search query');
    const weights = args.weights as { semantic?: number; lexical?: number; symbolic?: number } | undefined;
    const filters = args.filters as {
      tags?: string[];
      entityTypes?: string[];
      dateRange?: { start: string; end: string };
      minImportance?: number;
      maxImportance?: number;
    } | undefined;
    const limit = args.limit !== undefined
      ? validateWithSchema(args.limit, z.number().int().positive().max(200), 'Invalid limit')
      : 10;

    const hybridSearch = new HybridSearchManager(ctx.semanticSearch, ctx.rankedSearch);
    const graph = await ctx.storage.loadGraph();

    const results = await hybridSearch.searchWithEntities(graph, query, {
      semanticWeight: weights?.semantic ?? 0.5,
      lexicalWeight: weights?.lexical ?? 0.3,
      symbolicWeight: weights?.symbolic ?? 0.2,
      symbolic:
        filters?.tags || filters?.entityTypes || filters?.dateRange ||
        filters?.minImportance !== undefined || filters?.maxImportance !== undefined
          ? {
              tags: filters?.tags,
              entityTypes: filters?.entityTypes,
              dateRange: filters?.dateRange,
              importance:
                filters?.minImportance !== undefined || filters?.maxImportance !== undefined
                  ? { min: filters?.minImportance, max: filters?.maxImportance }
                  : undefined,
            }
          : undefined,
      limit,
    });

    return formatToolResponse({
      query,
      weights: {
        semantic: weights?.semantic ?? 0.5,
        lexical: weights?.lexical ?? 0.3,
        symbolic: weights?.symbolic ?? 0.2,
      },
      resultCount: results.length,
      results: results.map((r) => ({
        name: r.entity.name,
        entityType: r.entity.entityType,
        scores: r.scores,
        matchedLayers: r.matchedLayers,
        observations: r.entity.observations.slice(0, 3),
        tags: r.entity.tags,
      })),
    });
  },

  // Phase 11 Sprint 3: Query Analysis
  analyze_query: async (_ctx, args) => {
    const query = validateWithSchema(args.query, z.string().min(1), 'Invalid query');
    const includePlan = args.includePlan === true;

    const analyzer = new QueryAnalyzer();
    const analysis = analyzer.analyze(query);

    let plan = undefined;
    if (includePlan) {
      const planner = new QueryPlanner();
      plan = planner.createPlan(query, analysis);
    }

    return formatToolResponse({
      query,
      analysis,
      plan,
    });
  },

  // Phase 11 Sprint 4: Smart Search
  smart_search: async (ctx, args) => {
    const query = validateWithSchema(args.query, z.string().min(1), 'Invalid query');
    const maxIterations = args.maxIterations !== undefined
      ? validateWithSchema(args.maxIterations, z.number().int().positive().max(10), 'Invalid maxIterations')
      : 3;
    const adequacyThreshold = args.adequacyThreshold !== undefined
      ? validateWithSchema(args.adequacyThreshold, z.number().min(0).max(1), 'Invalid adequacyThreshold')
      : 0.7;
    const includePlan = args.includePlan !== false;
    const limit = args.limit !== undefined
      ? validateWithSchema(args.limit, z.number().int().positive().max(200), 'Invalid limit')
      : 10;

    const analyzer = new QueryAnalyzer();
    const analysis = analyzer.analyze(query);

    let plan = undefined;
    if (includePlan) {
      const planner = new QueryPlanner();
      plan = planner.createPlan(query, analysis);
    }

    const hybridSearch = new HybridSearchManager(ctx.semanticSearch, ctx.rankedSearch);
    const reflection = new ReflectionManager(hybridSearch, analyzer);
    const graph = await ctx.storage.loadGraph();

    const result = await reflection.retrieveWithReflection(graph, query, {
      maxIterations,
      adequacyThreshold,
      searchOptions: { limit },
    });

    return formatToolResponse({
      query,
      analysis: {
        questionType: analysis.questionType,
        complexity: analysis.complexity,
        persons: analysis.persons,
        temporalRange: analysis.temporalRange,
      },
      plan,
      reflection: {
        iterations: result.iterations,
        adequate: result.adequate,
        adequacyScore: result.adequacyScore,
        refinements: result.refinements,
      },
      resultCount: result.results.length,
      results: result.results.slice(0, limit).map(r => ({
        name: r.entity.name,
        entityType: r.entity.entityType,
        scores: r.scores,
        matchedLayers: r.matchedLayers,
        observations: r.entity.observations.slice(0, 3),
      })),
    });
  },

  // ==================== SAVED SEARCH HANDLERS ====================
  save_search: async (ctx, args) => {
    const searchInput = validateWithSchema(args, SavedSearchInputSchema, 'Invalid saved search data');
    return formatToolResponse(await ctx.searchManager.saveSearch(searchInput));
  },

  execute_saved_search: async (ctx, args) => {
    const name = validateWithSchema(args.name, z.string().min(1), 'Invalid search name');
    return formatToolResponse(await ctx.searchManager.executeSavedSearch(name));
  },

  list_saved_searches: async (ctx) => formatToolResponse(await ctx.searchManager.listSavedSearches()),

  delete_saved_search: async (ctx, args) => {
    const name = validateWithSchema(args.name, z.string().min(1), 'Invalid search name');
    const deleted = await ctx.searchManager.deleteSavedSearch(name);
    return formatTextResponse(
      deleted
        ? `Saved search "${name}" deleted successfully`
        : `Saved search "${name}" not found`
    );
  },

  update_saved_search: async (ctx, args) => {
    const name = validateWithSchema(args.name, z.string().min(1), 'Invalid search name');
    const updates = validateWithSchema(args.updates, SavedSearchUpdateSchema, 'Invalid update data');
    return formatToolResponse(await ctx.searchManager.updateSavedSearch(name, updates));
  },

  // ==================== TAG HANDLERS ====================
  add_tags: async (ctx, args) => {
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entity name');
    const tags = validateWithSchema(args.tags, z.array(z.string().min(1)), 'Invalid tags');
    return formatToolResponse(await ctx.entityManager.addTags(entityName, tags));
  },

  remove_tags: async (ctx, args) => {
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entity name');
    const tags = validateWithSchema(args.tags, z.array(z.string().min(1)), 'Invalid tags');
    return formatToolResponse(await ctx.entityManager.removeTags(entityName, tags));
  },

  set_importance: async (ctx, args) => {
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entity name');
    const importance = validateWithSchema(args.importance, z.number().min(0).max(10), 'Invalid importance');
    return formatToolResponse(await ctx.entityManager.setImportance(entityName, importance));
  },

  add_tags_to_multiple_entities: async (ctx, args) => {
    const entityNames = validateWithSchema(args.entityNames, z.array(z.string().min(1)), 'Invalid entity names');
    const tags = validateWithSchema(args.tags, z.array(z.string().min(1)), 'Invalid tags');
    return formatToolResponse(await ctx.entityManager.addTagsToMultipleEntities(entityNames, tags));
  },

  replace_tag: async (ctx, args) => {
    const oldTag = validateWithSchema(args.oldTag, z.string().min(1), 'Invalid old tag');
    const newTag = validateWithSchema(args.newTag, z.string().min(1), 'Invalid new tag');
    return formatToolResponse(await ctx.entityManager.replaceTag(oldTag, newTag));
  },

  merge_tags: async (ctx, args) => {
    const tag1 = validateWithSchema(args.tag1, z.string().min(1), 'Invalid first tag');
    const tag2 = validateWithSchema(args.tag2, z.string().min(1), 'Invalid second tag');
    const targetTag = validateWithSchema(args.targetTag, z.string().min(1), 'Invalid target tag');
    return formatToolResponse(await ctx.entityManager.mergeTags(tag1, tag2, targetTag));
  },

  // ==================== TAG ALIAS HANDLERS ====================
  add_tag_alias: async (ctx, args) => {
    const alias = validateWithSchema(args.alias, z.string().min(1), 'Invalid alias');
    const canonical = validateWithSchema(args.canonical, z.string().min(1), 'Invalid canonical tag');
    const description = args.description !== undefined ? validateWithSchema(args.description, z.string(), 'Invalid description') : undefined;
    return formatToolResponse(await ctx.tagManager.addTagAlias(alias, canonical, description));
  },

  list_tag_aliases: async (ctx) => formatToolResponse(await ctx.tagManager.listTagAliases()),

  remove_tag_alias: async (ctx, args) => {
    const alias = validateWithSchema(args.alias, z.string().min(1), 'Invalid alias');
    const removed = await ctx.tagManager.removeTagAlias(alias);
    return formatTextResponse(
      removed
        ? `Tag alias "${alias}" removed successfully`
        : `Tag alias "${alias}" not found`
    );
  },

  get_aliases_for_tag: async (ctx, args) => {
    const canonicalTag = validateWithSchema(args.canonicalTag, z.string().min(1), 'Invalid canonical tag');
    return formatToolResponse(await ctx.tagManager.getAliasesForTag(canonicalTag));
  },

  resolve_tag: async (ctx, args) => {
    const tag = validateWithSchema(args.tag, z.string().min(1), 'Invalid tag');
    return formatToolResponse({
      tag,
      resolved: await ctx.tagManager.resolveTag(tag),
    });
  },

  // ==================== HIERARCHY HANDLERS ====================
  set_entity_parent: async (ctx, args) => {
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entity name');
    const parentName = args.parentName !== undefined ? validateWithSchema(args.parentName, z.string().min(1).nullable(), 'Invalid parent name') : null;
    return formatToolResponse(await ctx.hierarchyManager.setEntityParent(entityName, parentName));
  },

  get_children: async (ctx, args) => {
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entity name');
    return formatToolResponse(await ctx.hierarchyManager.getChildren(entityName));
  },

  get_parent: async (ctx, args) => {
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entity name');
    return formatToolResponse(await ctx.hierarchyManager.getParent(entityName));
  },

  get_ancestors: async (ctx, args) => {
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entity name');
    return formatToolResponse(await ctx.hierarchyManager.getAncestors(entityName));
  },

  get_descendants: async (ctx, args) => {
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entity name');
    return formatToolResponse(await ctx.hierarchyManager.getDescendants(entityName));
  },

  get_subtree: async (ctx, args) => {
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entity name');
    return withCompression(async () =>
      formatToolResponse(await ctx.hierarchyManager.getSubtree(entityName))
    );
  },

  get_root_entities: async (ctx) => formatToolResponse(await ctx.hierarchyManager.getRootEntities()),

  get_entity_depth: async (ctx, args) => {
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entity name');
    return formatToolResponse({
      entityName,
      depth: await ctx.hierarchyManager.getEntityDepth(entityName),
    });
  },

  move_entity: async (ctx, args) => {
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entity name');
    const newParentName = args.newParentName !== undefined ? validateWithSchema(args.newParentName, z.string().min(1).nullable(), 'Invalid new parent name') : null;
    return formatToolResponse(await ctx.hierarchyManager.moveEntity(entityName, newParentName));
  },

  // ==================== ANALYTICS HANDLERS ====================
  get_graph_stats: async (ctx) => formatToolResponse(await ctx.analyticsManager.getGraphStats()),

  validate_graph: async (ctx) => formatToolResponse(await ctx.analyticsManager.validateGraph()),

  // ==================== COMPRESSION HANDLERS ====================
  find_duplicates: async (ctx, args) => {
    const threshold = args.threshold !== undefined ? validateWithSchema(args.threshold, z.number().min(0).max(1), 'Invalid threshold') : undefined;
    return formatToolResponse(await ctx.compressionManager.findDuplicates(threshold));
  },

  merge_entities: async (ctx, args) => {
    const entityNames = validateWithSchema(args.entityNames, z.array(z.string().min(1)).min(2), 'Invalid entity names');
    const targetName = args.targetName !== undefined ? validateWithSchema(args.targetName, z.string().min(1), 'Invalid target name') : undefined;
    return formatToolResponse(await ctx.compressionManager.mergeEntities(entityNames, targetName));
  },

  compress_graph: async (ctx, args) => {
    const threshold = args.threshold !== undefined ? validateWithSchema(args.threshold, z.number().min(0).max(1), 'Invalid threshold') : undefined;
    const dryRun = args.dryRun !== undefined ? validateWithSchema(args.dryRun, z.boolean(), 'Invalid dryRun value') : undefined;
    return formatToolResponse(await ctx.compressionManager.compressGraph(threshold, dryRun));
  },

  archive_entities: async (ctx, args) => {
    const criteria = validateWithSchema(
      {
        olderThan: args.olderThan,
        importanceLessThan: args.importanceLessThan,
        tags: args.tags,
      },
      ArchiveCriteriaSchema,
      'Invalid archive criteria'
    );
    const dryRun = args.dryRun !== undefined ? validateWithSchema(args.dryRun, z.boolean(), 'Invalid dryRun value') : undefined;
    return formatToolResponse(await ctx.archiveManager.archiveEntities(criteria, dryRun));
  },

  // ==================== GRAPH ALGORITHM HANDLERS (Phase 4 Sprint 9) ====================
  find_shortest_path: async (ctx, args) => {
    const source = validateWithSchema(args.source, z.string().min(1), 'Invalid source entity');
    const target = validateWithSchema(args.target, z.string().min(1), 'Invalid target entity');
    const direction = args.direction !== undefined
      ? validateWithSchema(args.direction, z.enum(['outgoing', 'incoming', 'both']), 'Invalid direction')
      : undefined;
    const relationTypes = args.relationTypes !== undefined
      ? validateWithSchema(args.relationTypes, z.array(z.string()), 'Invalid relation types')
      : undefined;

    const result = await ctx.graphTraversal.findShortestPath(source, target, { direction, relationTypes });
    if (!result) {
      return formatTextResponse(`No path found between "${source}" and "${target}"`);
    }
    return formatToolResponse(result);
  },

  find_all_paths: async (ctx, args) => {
    const source = validateWithSchema(args.source, z.string().min(1), 'Invalid source entity');
    const target = validateWithSchema(args.target, z.string().min(1), 'Invalid target entity');
    const maxDepth = args.maxDepth !== undefined
      ? validateWithSchema(args.maxDepth, z.number().int().min(1).max(10), 'Invalid maxDepth (1-10)')
      : 5;
    const direction = args.direction !== undefined
      ? validateWithSchema(args.direction, z.enum(['outgoing', 'incoming', 'both']), 'Invalid direction')
      : undefined;
    const relationTypes = args.relationTypes !== undefined
      ? validateWithSchema(args.relationTypes, z.array(z.string()), 'Invalid relation types')
      : undefined;

    const results = await ctx.graphTraversal.findAllPaths(source, target, maxDepth, { direction, relationTypes });
    return formatToolResponse({ paths: results, count: results.length });
  },

  get_connected_components: async (ctx) => {
    const result = await ctx.graphTraversal.findConnectedComponents();
    return formatToolResponse(result);
  },

  get_centrality: async (ctx, args) => {
    const algorithm = args.algorithm !== undefined
      ? validateWithSchema(args.algorithm, z.enum(['degree', 'betweenness', 'pagerank']), 'Invalid algorithm')
      : 'degree';
    const topN = args.topN !== undefined
      ? validateWithSchema(args.topN, z.number().int().min(1).max(100), 'Invalid topN (1-100)')
      : 10;

    let result;
    if (algorithm === 'degree') {
      const direction = args.direction !== undefined
        ? validateWithSchema(args.direction, z.enum(['in', 'out', 'both']), 'Invalid direction')
        : 'both';
      result = await ctx.graphTraversal.calculateDegreeCentrality(direction, topN);
    } else if (algorithm === 'betweenness') {
      const approximate = args.approximate !== undefined
        ? validateWithSchema(args.approximate, z.boolean(), 'Invalid approximate value')
        : false;
      const sampleRate = args.sampleRate !== undefined
        ? validateWithSchema(args.sampleRate, z.number().min(0.01).max(1.0), 'Invalid sample rate (0.01-1.0)')
        : 0.2;
      result = await ctx.graphTraversal.calculateBetweennessCentrality({
        topN,
        approximate,
        sampleRate,
      });
    } else {
      const dampingFactor = args.dampingFactor !== undefined
        ? validateWithSchema(args.dampingFactor, z.number().min(0).max(1), 'Invalid damping factor (0-1)')
        : 0.85;
      result = await ctx.graphTraversal.calculatePageRank(dampingFactor, 100, 1e-6, topN);
    }

    // Convert Map to object for JSON serialization
    return formatToolResponse({
      algorithm: result.algorithm,
      topEntities: result.topEntities,
      totalEntities: result.scores.size,
      ...(algorithm === 'betweenness' && args.approximate ? { approximate: true } : {}),
    });
  },

  // ==================== IMPORT/EXPORT HANDLERS ====================
  import_graph: async (ctx, args) => {
    const format = validateWithSchema(args.format, ImportFormatSchema, 'Invalid import format');
    const data = validateWithSchema(args.data, z.string().min(1), 'Invalid import data');
    const mergeStrategy = args.mergeStrategy !== undefined ? validateWithSchema(args.mergeStrategy, MergeStrategySchema, 'Invalid merge strategy') : undefined;
    const dryRun = args.dryRun !== undefined ? validateWithSchema(args.dryRun, z.boolean(), 'Invalid dryRun value') : undefined;
    return formatToolResponse(await ctx.ioManager.importGraph(format, data, mergeStrategy, dryRun));
  },

  export_graph: async (ctx, args) => {
    const format = validateWithSchema(args.format, ExtendedExportFormatSchema, 'Invalid export format');
    const filter = args.filter !== undefined ? validateWithSchema(args.filter, ExportFilterSchema, 'Invalid export filter') : undefined;
    const compress = args.compress !== undefined ? validateWithSchema(args.compress, z.boolean(), 'Invalid compress value') : undefined;
    const compressionQuality = args.compressionQuality !== undefined
      ? validateWithSchema(args.compressionQuality, z.number().int().min(0).max(11), 'Invalid compression quality (must be 0-11)')
      : undefined;
    const streaming = args.streaming !== undefined ? validateWithSchema(args.streaming, z.boolean(), 'Invalid streaming value') : undefined;
    const rawOutputPath = args.outputPath !== undefined ? validateWithSchema(args.outputPath, z.string(), 'Invalid outputPath value') : undefined;
    // Validate outputPath to prevent path traversal attacks
    const outputPath = rawOutputPath !== undefined ? validateFilePath(rawOutputPath) : undefined;

    // Get filtered or full graph
    let graph;
    if (filter) {
      graph = await ctx.searchManager.searchByDateRange(
        filter.startDate,
        filter.endDate,
        filter.entityType,
        filter.tags
      );
    } else {
      graph = await ctx.storage.loadGraph();
    }

    // Export with optional compression and streaming
    const result = await ctx.ioManager.exportGraphWithCompression(graph, format, {
      filter,
      compress,
      compressionQuality,
      streaming,
      outputPath,
    });

    // Return streamed result with metadata
    if (result.streamed) {
      return formatToolResponse({
        format: result.format,
        entityCount: result.entityCount,
        relationCount: result.relationCount,
        compressed: result.compressed,
        encoding: result.encoding,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        compressionRatio: `${(result.compressionRatio * 100).toFixed(1)}%`,
        streamed: true,
        outputPath: result.outputPath,
        message: result.content,
      });
    }

    // Return compressed result with metadata, or raw content for uncompressed
    if (result.compressed) {
      return formatToolResponse({
        format: result.format,
        entityCount: result.entityCount,
        relationCount: result.relationCount,
        compressed: true,
        encoding: result.encoding,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        compressionRatio: `${(result.compressionRatio * 100).toFixed(1)}%`,
        data: result.content,
      });
    }

    // Uncompressed: return raw content for backward compatibility
    return formatRawResponse(result.content);
  },

  // ==================== SEMANTIC SEARCH HANDLERS (Phase 4 Sprint 12) ====================
  semantic_search: async (ctx, args) => {
    const semanticSearch = ctx.semanticSearch;
    if (!semanticSearch) {
      return formatTextResponse(
        'Semantic search is not available. Set MEMORY_EMBEDDING_PROVIDER environment variable to "openai" or "local".'
      );
    }

    const query = validateWithSchema(args.query, SearchQuerySchema, 'Invalid search query');
    const limit = args.limit !== undefined
      ? validateWithSchema(args.limit, z.number().int().min(1).max(100), 'Invalid limit (1-100)')
      : undefined;
    const minSimilarity = args.minSimilarity !== undefined
      ? validateWithSchema(args.minSimilarity, z.number().min(0).max(1), 'Invalid minSimilarity (0-1)')
      : undefined;

    const graph = await ctx.storage.loadGraph();
    const results = await semanticSearch.search(graph, query, limit, minSimilarity);

    return formatToolResponse({
      query,
      results: results.map(r => ({
        entity: r.entity,
        similarity: r.similarity,
      })),
      count: results.length,
    });
  },

  find_similar_entities: async (ctx, args) => {
    const semanticSearch = ctx.semanticSearch;
    if (!semanticSearch) {
      return formatTextResponse(
        'Semantic search is not available. Set MEMORY_EMBEDDING_PROVIDER environment variable to "openai" or "local".'
      );
    }

    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entity name');
    const limit = args.limit !== undefined
      ? validateWithSchema(args.limit, z.number().int().min(1).max(100), 'Invalid limit (1-100)')
      : undefined;
    const minSimilarity = args.minSimilarity !== undefined
      ? validateWithSchema(args.minSimilarity, z.number().min(0).max(1), 'Invalid minSimilarity (0-1)')
      : undefined;

    const graph = await ctx.storage.loadGraph();
    const results = await semanticSearch.findSimilar(graph, entityName, limit, minSimilarity);

    return formatToolResponse({
      entityName,
      similarEntities: results.map(r => ({
        entity: r.entity,
        similarity: r.similarity,
      })),
      count: results.length,
    });
  },

  index_embeddings: async (ctx, args) => {
    const semanticSearch = ctx.semanticSearch;
    if (!semanticSearch) {
      return formatTextResponse(
        'Semantic search is not available. Set MEMORY_EMBEDDING_PROVIDER environment variable to "openai" or "local".'
      );
    }

    const forceReindex = args.forceReindex !== undefined
      ? validateWithSchema(args.forceReindex, z.boolean(), 'Invalid forceReindex value')
      : false;

    const graph = await ctx.storage.loadGraph();
    const result = await semanticSearch.indexAll(graph, { forceReindex });

    return formatToolResponse({
      ...result,
      totalEntities: graph.entities.length,
      stats: semanticSearch.getStats(),
    });
  },

  // ==================== REF INDEX HANDLERS ====================
  register_ref: async (ctx, args) => {
    const ref = validateWithSchema(args.ref, z.string().min(1), 'Invalid ref');
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entityName');
    const description = args.description !== undefined
      ? validateWithSchema(args.description, z.string(), 'Invalid description')
      : undefined;
    const entry = await getRefIndex(ctx).register(ref, entityName, description);
    return formatToolResponse(entry);
  },

  resolve_ref: async (ctx, args) => {
    const ref = validateWithSchema(args.ref, z.string().min(1), 'Invalid ref');
    const entityName = await getRefIndex(ctx).resolve(ref);
    if (entityName === null) {
      return formatTextResponse(`Ref "${ref}" is not registered`);
    }
    return formatToolResponse({ ref, entityName });
  },

  deregister_ref: async (ctx, args) => {
    const ref = validateWithSchema(args.ref, z.string().min(1), 'Invalid ref');
    await getRefIndex(ctx).deregister(ref);
    return formatTextResponse(`Ref "${ref}" deregistered`);
  },

  list_refs: async (ctx, args) => {
    const entityName = args.entityName !== undefined
      ? validateWithSchema(args.entityName, z.string().min(1), 'Invalid entityName')
      : undefined;
    const refs = await getRefIndex(ctx).listRefs(entityName ? { entityName } : undefined);
    return formatToolResponse({ refs, count: refs.length });
  },

  // ==================== ARTIFACT HANDLERS ====================
  create_artifact: async (ctx, args) => {
    const content = validateWithSchema(args.content, z.string().min(1), 'Invalid content');
    const toolName = validateWithSchema(args.toolName, z.string().min(1), 'Invalid toolName');
    const artifactType = validateWithSchema(
      args.artifactType,
      z.enum(['tool_output', 'code_snippet', 'api_response', 'search_result', 'file_content', 'user_input']),
      'Invalid artifactType'
    );
    const description = args.description !== undefined
      ? validateWithSchema(args.description, z.string(), 'Invalid description')
      : undefined;
    const sessionId = args.sessionId !== undefined
      ? validateWithSchema(args.sessionId, z.string(), 'Invalid sessionId')
      : undefined;
    const artifact = await getArtifactManager(ctx).createArtifact({
      content,
      toolName,
      artifactType,
      description,
      sessionId,
    });
    return formatToolResponse(artifact);
  },

  get_artifact: async (ctx, args) => {
    const ref = validateWithSchema(args.ref, z.string().min(1), 'Invalid ref');
    const artifact = await getArtifactManager(ctx).getArtifact(ref);
    if (!artifact) {
      return formatTextResponse(`Artifact "${ref}" not found`);
    }
    return formatToolResponse(artifact);
  },

  list_artifacts: async (ctx, args) => {
    const filter: ArtifactFilter = {};
    if (args.toolName !== undefined) {
      filter.toolName = validateWithSchema(args.toolName, z.string(), 'Invalid toolName');
    }
    if (args.artifactType !== undefined) {
      filter.artifactType = validateWithSchema(
        args.artifactType,
        z.enum(['tool_output', 'code_snippet', 'api_response', 'search_result', 'file_content', 'user_input']),
        'Invalid artifactType'
      );
    }
    if (args.since !== undefined) {
      const sinceStr = validateWithSchema(args.since, z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/, 'since must be an ISO 8601 date string'), 'Invalid since');
      const sinceDate = new Date(sinceStr);
      if (isNaN(sinceDate.getTime())) {
        throw new Error(`Invalid since date: "${sinceStr}" is not a valid date`);
      }
      filter.since = sinceDate;
    }
    const artifacts = await getArtifactManager(ctx).listArtifacts(Object.keys(filter).length > 0 ? filter : undefined);
    return formatToolResponse({ artifacts, count: artifacts.length });
  },

  // ==================== TEMPORAL SEARCH HANDLER ====================
  search_by_time: async (ctx, args) => {
    const query = validateWithSchema(args.query, z.string().min(1), 'Invalid query');
    const options: { field?: 'createdAt' | 'lastModified' | 'any'; includeUndated?: boolean } = {};
    if (args.field !== undefined) {
      options.field = validateWithSchema(
        args.field,
        z.enum(['createdAt', 'lastModified', 'any']),
        'Invalid field'
      );
    }
    if (args.includeUndated !== undefined) {
      options.includeUndated = validateWithSchema(args.includeUndated, z.boolean(), 'Invalid includeUndated');
    }
    const entities = await ctx.searchManager.searchByTime(query, options);
    return formatToolResponse({ query, entities, count: entities.length });
  },

  // ==================== DISTILLATION HANDLER ====================
  configure_distillation: async (ctx, args) => {
    const policy = validateWithSchema(
      args.policy,
      z.enum(['default', 'noop', 'none']),
      'Invalid policy'
    );
    const pipeline = getDistillationPipeline(ctx);
    pipeline.clearPolicies();
    if (policy === 'default') {
      pipeline.addPolicy(new DefaultDistillationPolicy(), 'default');
    } else if (policy === 'noop') {
      pipeline.addPolicy(new NoOpDistillationPolicy(), 'noop');
    }
    // 'none' clears all policies — passthrough behavior
    return formatTextResponse(`Distillation pipeline configured with policy: "${policy}" (${pipeline.policyCount} policies active)`);
  },

  // ==================== FRESHNESS HANDLERS ====================
  check_freshness: async (ctx, args) => {
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entityName');
    const graph = await ctx.storage.loadGraph();
    const entity = graph.entities.find(e => e.name === entityName);
    if (!entity) {
      return formatTextResponse(`Entity "${entityName}" not found`);
    }
    const fm = getFreshnessManager(ctx);
    const annotated = fm.annotateEntity(entity);
    return formatToolResponse({
      entityName,
      freshnessScore: fm.calculateFreshness(entity),
      expiresAt: fm.computeExpiresAt(entity),
      isExpired: fm.isExpired(entity),
      annotated,
    });
  },

  get_stale_entities: async (ctx, args) => {
    const threshold = args.threshold !== undefined
      ? validateWithSchema(args.threshold, z.number().min(0).max(1), 'Invalid threshold (0-1)')
      : undefined;
    const fm = getFreshnessManager(ctx);
    const stale = await fm.getStaleEntities(ctx.storage, threshold);
    return formatToolResponse({ entities: stale, count: stale.length });
  },

  get_expired_entities: async (ctx) => {
    const fm = getFreshnessManager(ctx);
    const expired = await fm.getExpiredEntities(ctx.storage);
    return formatToolResponse({ entities: expired, count: expired.length });
  },

  refresh_entity: async (ctx, args) => {
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entityName');
    const fm = getFreshnessManager(ctx);
    const updated = await fm.refreshEntity(entityName, ctx.storage);
    return formatToolResponse({ updated, freshnessScore: fm.calculateFreshness(updated) });
  },

  freshness_report: async (ctx, args) => {
    const threshold = args.threshold !== undefined
      ? validateWithSchema(args.threshold, z.number().min(0).max(1), 'Invalid threshold (0-1)')
      : undefined;
    const fm = getFreshnessManager(ctx);
    const report = await fm.generateReport(ctx.storage, threshold);
    return formatToolResponse(report);
  },

  // ==================== LLM QUERY PLANNER HANDLER ====================
  query_natural_language: async (ctx, args) => {
    const query = validateWithSchema(args.query, z.string().min(1), 'Invalid query');
    const entities = await ctx.queryNaturalLanguage(query);
    return formatToolResponse({ query, entities, count: entities.length });
  },

  // ==================== GOVERNANCE HANDLERS ====================
  set_governance_policy: async (ctx, args) => {
    const gm = getGovernanceManager(ctx);
    // GovernancePolicy uses function callbacks; we translate boolean args into allow/deny functions
    const allowCreate = args.canCreate !== undefined
      ? validateWithSchema(args.canCreate, z.boolean(), 'Invalid canCreate')
      : true;
    const allowUpdate = args.canUpdate !== undefined
      ? validateWithSchema(args.canUpdate, z.boolean(), 'Invalid canUpdate')
      : true;
    const allowDelete = args.canDelete !== undefined
      ? validateWithSchema(args.canDelete, z.boolean(), 'Invalid canDelete')
      : true;
    gm.setPolicy({
      canCreate: allowCreate ? undefined : () => false,
      canUpdate: allowUpdate ? undefined : () => false,
      canDelete: allowDelete ? undefined : () => false,
    });
    return formatTextResponse(`Governance policy set: canCreate=${allowCreate}, canUpdate=${allowUpdate}, canDelete=${allowDelete}`);
  },

  audit_query: async (ctx, args) => {
    const filter: AuditFilter = {};
    if (args.operation !== undefined) {
      filter.operation = validateWithSchema(
        args.operation,
        z.enum(['create', 'update', 'delete', 'merge', 'archive']),
        'Invalid operation'
      ) as AuditFilter['operation'];
    }
    if (args.agentId !== undefined) {
      filter.agentId = validateWithSchema(args.agentId, z.string(), 'Invalid agentId');
    }
    if (args.entityName !== undefined) {
      filter.entityName = validateWithSchema(args.entityName, z.string(), 'Invalid entityName');
    }
    // AuditFilter uses fromTime/toTime (not since/until)
    if (args.since !== undefined) {
      filter.fromTime = validateWithSchema(args.since, z.string(), 'Invalid since');
    }
    if (args.until !== undefined) {
      filter.toTime = validateWithSchema(args.until, z.string(), 'Invalid until');
    }
    const limit = args.limit !== undefined
      ? validateWithSchema(args.limit, z.number().int().min(1).max(1000), 'Invalid limit')
      : 50;
    const al = getAuditLog(ctx);
    let entries = await al.query(filter);
    entries = entries.slice(0, limit);
    return formatToolResponse({ entries, count: entries.length });
  },

  audit_history: async (ctx, args) => {
    const entityName = validateWithSchema(args.entityName, z.string().min(1), 'Invalid entityName');
    const al = getAuditLog(ctx);
    const entries = await al.getHistory(entityName);
    return formatToolResponse({ entityName, entries, count: entries.length });
  },

  rollback_operation: async (ctx, args) => {
    const auditEntryId = validateWithSchema(args.auditEntryId, z.string().min(1), 'Invalid auditEntryId');
    const gm = getGovernanceManager(ctx);
    await gm.rollback(auditEntryId);
    return formatTextResponse(`Operation "${auditEntryId}" rolled back successfully`);
  },

  // ==================== ROLE PROFILE HANDLERS ====================
  set_agent_role: async (_ctx, args) => {
    const role = validateWithSchema(
      args.role,
      z.enum(['researcher', 'planner', 'executor', 'reviewer', 'default']),
      'Invalid role'
    ) as AgentRole;
    const profile = getRoleProfile(role);
    return formatToolResponse({
      role,
      label: profile.label,
      salienceConfig: profile.salienceConfig,
      contextConfig: profile.contextConfig,
      message: `Role profile "${role}" retrieved. Apply salienceConfig and contextConfig to your agent memory system.`,
    });
  },

  list_role_profiles: async (_ctx) => {
    const profiles = listRoleProfiles();
    return formatToolResponse({ profiles, count: profiles.length });
  },

  // ==================== ENTROPY FILTER HANDLERS ====================
  enable_entropy_filter: async (ctx, args) => {
    const enabled = validateWithSchema(args.enabled, z.boolean(), 'Invalid enabled');
    const minEntropy = args.minEntropy !== undefined
      ? validateWithSchema(args.minEntropy, z.number().min(0), 'Invalid minEntropy')
      : 1.5;
    const minLength = args.minLength !== undefined
      ? validateWithSchema(args.minLength, z.number().int().min(0), 'Invalid minLength')
      : 10;
    // Register (or clear) the entropy filter stage on the agent memory facade's pipeline
    const agentMem = ctx.agentMemory();
    const pipeline = agentMem.consolidationPipeline;
    if (enabled) {
      const stage = new EntropyFilterStage({ minEntropy, minLength });
      pipeline.registerStage(stage);
      return formatTextResponse(`Entropy filter enabled (minEntropy=${minEntropy}, minLength=${minLength}). Stage registered on consolidation pipeline.`);
    } else {
      return formatTextResponse('Entropy filter disabled. No new entropy-filter stage will be registered on the consolidation pipeline.');
    }
  },

  compute_entropy: async (_ctx, args) => {
    const text = validateWithSchema(args.text, z.string(), 'Invalid text');
    const entropy = computeEntropy(text);
    const result: Record<string, unknown> = { text: text.length > 100 ? text.slice(0, 100) + '...' : text, entropy };
    if (args.minEntropy !== undefined) {
      const minEntropy = validateWithSchema(args.minEntropy, z.number().min(0), 'Invalid minEntropy');
      result.minEntropy = minEntropy;
      result.passes = passesEntropyFilter(text, minEntropy);
    }
    return formatToolResponse(result);
  },

  // ==================== CONSOLIDATION HANDLERS ====================
  start_consolidation: async (ctx, args) => {
    const intervalMs = args.intervalMs !== undefined
      ? validateWithSchema(args.intervalMs, z.number().int().min(1000), 'Invalid intervalMs')
      : undefined;
    const autoMergeDuplicates = args.autoMergeDuplicates !== undefined
      ? validateWithSchema(args.autoMergeDuplicates, z.boolean(), 'Invalid autoMergeDuplicates')
      : undefined;
    // Prefer ctx.consolidationScheduler (set via MEMORY_AUTO_CONSOLIDATION env var).
    // Otherwise use the per-ctx singleton so stop/run_now can retrieve the same instance.
    let scheduler = ctx.consolidationScheduler ?? consolidationSchedulerMap.get(ctx);
    if (!scheduler) {
      const agentMem = ctx.agentMemory();
      scheduler = new ConsolidationScheduler(
        agentMem.consolidationPipeline,
        ctx.compressionManager,
        {
          consolidationIntervalMs: intervalMs,
          autoMergeDuplicates: autoMergeDuplicates,
        }
      );
      consolidationSchedulerMap.set(ctx, scheduler);
    }
    scheduler.start();
    return formatTextResponse(`Consolidation scheduler started (interval: ${scheduler.getInterval()}ms, autoMerge: ${scheduler.getConfig().autoMergeDuplicates})`);
  },

  stop_consolidation: async (ctx) => {
    const scheduler = ctx.consolidationScheduler ?? consolidationSchedulerMap.get(ctx);
    if (!scheduler) {
      return formatTextResponse('No active consolidation scheduler found. Start one first with start_consolidation.');
    }
    scheduler.stop();
    return formatTextResponse('Consolidation scheduler stopped');
  },

  run_consolidation_now: async (ctx) => {
    // Use ctx.consolidationScheduler or the per-ctx singleton if available,
    // otherwise create a temporary scheduler just for this one run.
    let scheduler = ctx.consolidationScheduler ?? consolidationSchedulerMap.get(ctx);
    if (!scheduler) {
      const agentMem = ctx.agentMemory();
      scheduler = new ConsolidationScheduler(agentMem.consolidationPipeline, ctx.compressionManager);
    }
    const result = await scheduler.runNow();
    return formatToolResponse(result);
  },

  // ==================== MEMORY FORMATTER HANDLER ====================
  format_with_salience_budget: async (ctx, args) => {
    const entityNames = validateWithSchema(args.entityNames, z.array(z.string().min(1)), 'Invalid entityNames');
    const salienceScoresRaw = validateWithSchema(
      args.salienceScores,
      z.record(z.string(), z.number()),
      'Invalid salienceScores'
    );
    const totalTokenBudget = validateWithSchema(args.totalTokenBudget, z.number().int().min(1), 'Invalid totalTokenBudget');
    const header = args.header !== undefined
      ? validateWithSchema(args.header, z.string(), 'Invalid header')
      : undefined;
    const separator = args.separator !== undefined
      ? validateWithSchema(args.separator, z.string(), 'Invalid separator')
      : undefined;

    const graph = await ctx.storage.loadGraph();
    const memories = graph.entities.filter(e => entityNames.includes(e.name)) as AgentEntity[];
    const salienceScores = new Map<string, number>(Object.entries(salienceScoresRaw));

    const formatted = ctx.memoryFormatter.formatWithSalienceBudget(
      memories,
      salienceScores,
      totalTokenBudget,
      { header, separator }
    );
    return formatTextResponse(formatted);
  },

  // ==================== COLLABORATIVE SYNTHESIS HANDLER ====================
  synthesize_collaborative_context: async (ctx, args) => {
    const seedEntityName = validateWithSchema(args.seedEntityName, z.string().min(1), 'Invalid seedEntityName');
    const config: CollaborativeSynthesisConfig = {};
    if (args.maxDepth !== undefined) {
      config.maxDepth = validateWithSchema(args.maxDepth, z.number().int().min(1).max(10), 'Invalid maxDepth');
    }
    if (args.minNeighborSalience !== undefined) {
      config.minNeighborSalience = validateWithSchema(args.minNeighborSalience, z.number().min(0).max(1), 'Invalid minNeighborSalience');
    }
    if (args.maxNeighbors !== undefined) {
      config.maxNeighbors = validateWithSchema(args.maxNeighbors, z.number().int().min(1).max(100), 'Invalid maxNeighbors');
    }

    const salienceContext: SalienceContext = {};
    if (args.queryText !== undefined) {
      salienceContext.queryText = validateWithSchema(args.queryText, z.string(), 'Invalid queryText');
    }
    if (args.currentTask !== undefined) {
      salienceContext.currentTask = validateWithSchema(args.currentTask, z.string(), 'Invalid currentTask');
    }

    const synthesis = new CollaborativeSynthesis(
      ctx.storage,
      ctx.graphTraversal,
      ctx.salienceEngine,
      config
    );
    return withCompression(async () => {
      const result = await synthesis.synthesize(
        seedEntityName,
        Object.keys(salienceContext).length > 0 ? salienceContext : undefined
      );
      return formatToolResponse(result);
    });
  },

  // ==================== FAILURE DISTILLATION HANDLERS ====================
  distill_failure: async (ctx, args) => {
    const sessionId = validateWithSchema(args.sessionId, z.string().min(1), 'Invalid sessionId');
    const config: FailureDistillationConfig = {};
    if (args.minLessonConfidence !== undefined) {
      config.minLessonConfidence = validateWithSchema(args.minLessonConfidence, z.number().min(0).max(1), 'Invalid minLessonConfidence');
    }
    if (args.maxCauseChainLength !== undefined) {
      config.maxCauseChainLength = validateWithSchema(args.maxCauseChainLength, z.number().int().min(1).max(20), 'Invalid maxCauseChainLength');
    }
    const fd = Object.keys(config).length > 0
      ? new FailureDistillation(ctx.storage, config)
      : getFailureDistillation(ctx);
    const result = await fd.distillFromSession(sessionId);
    return formatToolResponse(result);
  },

  end_session: async (ctx, args) => {
    const sessionId = validateWithSchema(args.sessionId, z.string().min(1), 'Invalid sessionId');
    const outcome = validateWithSchema(
      args.outcome,
      z.enum(['success', 'failure', 'partial']),
      'Invalid outcome'
    );
    const distillFailures = args.distillFailures !== undefined
      ? validateWithSchema(args.distillFailures, z.boolean(), 'Invalid distillFailures')
      : true;

    const graph = await ctx.storage.loadGraph();
    const sessionEntity = graph.entities.find(e => e.name === sessionId);
    if (!sessionEntity) {
      return formatTextResponse(`Session "${sessionId}" not found`);
    }

    // Update session outcome
    const updatedEntities = graph.entities.map(e =>
      e.name === sessionId
        ? { ...e, observations: [...e.observations, `outcome: ${outcome}`], lastModified: new Date().toISOString() }
        : e
    );
    await ctx.storage.saveGraph({ entities: updatedEntities, relations: [...graph.relations] });

    let distillationResult = null;
    if (outcome === 'failure' && distillFailures) {
      const fd = getFailureDistillation(ctx);
      distillationResult = await fd.distillFromSession(sessionId);
    }

    return formatToolResponse({
      sessionId,
      outcome,
      distillationResult,
      message: `Session "${sessionId}" ended with outcome: ${outcome}`,
    });
  },

  // ==================== COGNITIVE LOAD HANDLERS ====================
  analyze_cognitive_load: async (ctx, args) => {
    const entityNames = validateWithSchema(args.entityNames, z.array(z.string().min(1)), 'Invalid entityNames');
    const loadThreshold = args.loadThreshold !== undefined
      ? validateWithSchema(args.loadThreshold, z.number().min(0).max(1), 'Invalid loadThreshold')
      : undefined;

    const graph = await ctx.storage.loadGraph();
    const memories = graph.entities.filter((e): e is AgentEntity => entityNames.includes(e.name));

    if (memories.length === 0) {
      return formatTextResponse('No entities found matching the provided names');
    }

    const analyzer = new CognitiveLoadAnalyzer(loadThreshold ? { loadThreshold } : undefined);
    const metrics = analyzer.computeMetrics(memories, estimateTokens);
    return formatToolResponse({ entityCount: memories.length, metrics });
  },

  adaptive_reduce_memories: async (ctx, args) => {
    const entityNames = validateWithSchema(args.entityNames, z.array(z.string().min(1)), 'Invalid entityNames');
    const salienceScoresRaw = validateWithSchema(
      args.salienceScores,
      z.record(z.string(), z.number()),
      'Invalid salienceScores'
    );
    const loadThreshold = args.loadThreshold !== undefined
      ? validateWithSchema(args.loadThreshold, z.number().min(0).max(1), 'Invalid loadThreshold')
      : undefined;

    const graph = await ctx.storage.loadGraph();
    const memories = graph.entities.filter((e): e is AgentEntity => entityNames.includes(e.name)) as AgentEntity[];

    if (memories.length === 0) {
      return formatTextResponse('No entities found matching the provided names');
    }

    const salienceScores = new Map<string, number>(Object.entries(salienceScoresRaw));
    const analyzer = new CognitiveLoadAnalyzer(loadThreshold ? { loadThreshold } : undefined);
    const result = analyzer.adaptiveReduce(memories, salienceScores, estimateTokens);
    return formatToolResponse({
      retained: result.retained.map(e => e.name),
      removed: result.removed.map(e => e.name),
      retainedCount: result.retained.length,
      removedCount: result.removed.length,
      beforeMetrics: result.beforeMetrics,
      afterMetrics: result.afterMetrics,
    });
  },
};

/**
 * Handle a tool call by dispatching to the appropriate handler.
 *
 * @param name - Tool name to call
 * @param args - Tool arguments
 * @param ctx - Manager context with all manager instances
 * @returns Tool response (includes isError: true on failure)
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  ctx: ManagerContext
): Promise<ToolResponse> {
  const handler = toolHandlers[name];
  if (!handler) {
    return {
      content: [{ type: 'text' as const, text: `Error: Unknown tool: ${name}` }],
      isError: true,
    };
  }
  try {
    return await handler(ctx, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text' as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
}
