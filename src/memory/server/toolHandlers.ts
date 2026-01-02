/**
 * MCP Tool Handlers
 *
 * Contains handler functions for all 47 Knowledge Graph tools.
 * Handlers call managers directly via ManagerContext.
 * Phase 4: Updated to use specialized managers for single responsibility.
 * Phase 6: Updated to use Zod validation instead of type assertions.
 *
 * @module server/toolHandlers
 */

import {
  formatToolResponse,
  formatTextResponse,
  formatRawResponse,
  validateWithSchema,
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
} from '../utils/index.js';
import type { ManagerContext } from '../core/ManagerContext.js';
import { z } from 'zod';

/**
 * Tool response type for MCP SDK compatibility.
 */
export type ToolResponse = ReturnType<typeof formatToolResponse>;

/**
 * Tool handler function signature.
 */
export type ToolHandler = (
  ctx: ManagerContext,
  args: Record<string, unknown>
) => Promise<ToolResponse>;

/**
 * Registry of all tool handlers keyed by tool name.
 * Handlers call managers directly for reduced abstraction layers.
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

  read_graph: async (ctx) => formatToolResponse(await ctx.storage.loadGraph()),

  open_nodes: async (ctx, args) => {
    const names = args.names !== undefined
      ? validateWithSchema(args.names, z.array(z.string()), 'Invalid entity names')
      : [];
    return formatToolResponse(await ctx.searchManager.openNodes(names));
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

  // ==================== SEARCH HANDLERS ====================
  search_nodes: async (ctx, args) => {
    const query = validateWithSchema(args.query, SearchQuerySchema, 'Invalid search query');
    const tags = args.tags !== undefined ? validateWithSchema(args.tags, z.array(z.string()), 'Invalid tags') : undefined;
    const minImportance = args.minImportance !== undefined ? validateWithSchema(args.minImportance, z.number().min(0).max(10), 'Invalid minImportance') : undefined;
    const maxImportance = args.maxImportance !== undefined ? validateWithSchema(args.maxImportance, z.number().min(0).max(10), 'Invalid maxImportance') : undefined;
    return formatToolResponse(await ctx.searchManager.searchNodes(query, tags, minImportance, maxImportance));
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
    return formatToolResponse(await ctx.hierarchyManager.getSubtree(entityName));
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

    // Export with optional compression
    const result = await ctx.ioManager.exportGraphWithCompression(graph, format, {
      filter,
      compress,
      compressionQuality,
    });

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
};

/**
 * Handle a tool call by dispatching to the appropriate handler.
 *
 * @param name - Tool name to call
 * @param args - Tool arguments
 * @param ctx - Manager context with all manager instances
 * @returns Tool response
 * @throws Error if tool name is unknown
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  ctx: ManagerContext
): Promise<ToolResponse> {
  const handler = toolHandlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return handler(ctx, args);
}
