/**
 * MCP Tool Handlers
 *
 * Contains handler functions for all 47 Knowledge Graph tools.
 * Handlers call managers directly via ManagerContext.
 * Phase 4: Updated to use specialized managers for single responsibility.
 *
 * @module server/toolHandlers
 */

import { formatToolResponse, formatTextResponse, formatRawResponse } from '../utils/index.js';
import type { ManagerContext } from '../core/ManagerContext.js';
import type { SavedSearch } from '../types/index.js';

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
  create_entities: async (ctx, args) =>
    formatToolResponse(await ctx.entityManager.createEntities(args.entities as any[])),

  delete_entities: async (ctx, args) => {
    await ctx.entityManager.deleteEntities(args.entityNames as string[]);
    return formatTextResponse(`Deleted ${(args.entityNames as string[]).length} entities`);
  },

  read_graph: async (ctx) => formatToolResponse(await ctx.storage.loadGraph()),

  open_nodes: async (ctx, args) =>
    formatToolResponse(await ctx.searchManager.openNodes(args.names as string[])),

  // ==================== RELATION HANDLERS ====================
  create_relations: async (ctx, args) =>
    formatToolResponse(await ctx.relationManager.createRelations(args.relations as any[])),

  delete_relations: async (ctx, args) => {
    await ctx.relationManager.deleteRelations(args.relations as any[]);
    return formatTextResponse(`Deleted ${(args.relations as any[]).length} relations`);
  },

  // ==================== OBSERVATION HANDLERS ====================
  add_observations: async (ctx, args) =>
    formatToolResponse(await ctx.observationManager.addObservations(args.observations as any[])),

  delete_observations: async (ctx, args) => {
    await ctx.observationManager.deleteObservations(args.deletions as any[]);
    return formatTextResponse('Observations deleted successfully');
  },

  // ==================== SEARCH HANDLERS ====================
  search_nodes: async (ctx, args) =>
    formatToolResponse(
      await ctx.searchManager.searchNodes(
        args.query as string,
        args.tags as string[] | undefined,
        args.minImportance as number | undefined,
        args.maxImportance as number | undefined
      )
    ),

  search_by_date_range: async (ctx, args) =>
    formatToolResponse(
      await ctx.searchManager.searchByDateRange(
        args.startDate as string | undefined,
        args.endDate as string | undefined,
        args.entityType as string | undefined,
        args.tags as string[] | undefined
      )
    ),

  search_nodes_ranked: async (ctx, args) =>
    formatToolResponse(
      await ctx.searchManager.searchNodesRanked(
        args.query as string,
        args.tags as string[] | undefined,
        args.minImportance as number | undefined,
        args.maxImportance as number | undefined,
        args.limit as number | undefined
      )
    ),

  boolean_search: async (ctx, args) =>
    formatToolResponse(
      await ctx.searchManager.booleanSearch(
        args.query as string,
        args.tags as string[] | undefined,
        args.minImportance as number | undefined,
        args.maxImportance as number | undefined
      )
    ),

  fuzzy_search: async (ctx, args) =>
    formatToolResponse(
      await ctx.searchManager.fuzzySearch(
        args.query as string,
        args.threshold as number | undefined,
        args.tags as string[] | undefined,
        args.minImportance as number | undefined,
        args.maxImportance as number | undefined
      )
    ),

  get_search_suggestions: async (ctx, args) =>
    formatToolResponse(
      await ctx.searchManager.getSearchSuggestions(args.query as string, args.maxSuggestions as number | undefined)
    ),

  // ==================== SAVED SEARCH HANDLERS ====================
  save_search: async (ctx, args) =>
    formatToolResponse(
      await ctx.searchManager.saveSearch(args as Omit<SavedSearch, 'createdAt' | 'useCount' | 'lastUsed'>)
    ),

  execute_saved_search: async (ctx, args) =>
    formatToolResponse(await ctx.searchManager.executeSavedSearch(args.name as string)),

  list_saved_searches: async (ctx) => formatToolResponse(await ctx.searchManager.listSavedSearches()),

  delete_saved_search: async (ctx, args) => {
    const deleted = await ctx.searchManager.deleteSavedSearch(args.name as string);
    return formatTextResponse(
      deleted
        ? `Saved search "${args.name}" deleted successfully`
        : `Saved search "${args.name}" not found`
    );
  },

  update_saved_search: async (ctx, args) =>
    formatToolResponse(await ctx.searchManager.updateSavedSearch(args.name as string, args.updates as any)),

  // ==================== TAG HANDLERS ====================
  add_tags: async (ctx, args) =>
    formatToolResponse(await ctx.entityManager.addTags(args.entityName as string, args.tags as string[])),

  remove_tags: async (ctx, args) =>
    formatToolResponse(await ctx.entityManager.removeTags(args.entityName as string, args.tags as string[])),

  set_importance: async (ctx, args) =>
    formatToolResponse(await ctx.entityManager.setImportance(args.entityName as string, args.importance as number)),

  add_tags_to_multiple_entities: async (ctx, args) =>
    formatToolResponse(
      await ctx.entityManager.addTagsToMultipleEntities(args.entityNames as string[], args.tags as string[])
    ),

  replace_tag: async (ctx, args) =>
    formatToolResponse(await ctx.entityManager.replaceTag(args.oldTag as string, args.newTag as string)),

  merge_tags: async (ctx, args) =>
    formatToolResponse(
      await ctx.entityManager.mergeTags(args.tag1 as string, args.tag2 as string, args.targetTag as string)
    ),

  // ==================== TAG ALIAS HANDLERS ====================
  add_tag_alias: async (ctx, args) =>
    formatToolResponse(
      await ctx.tagManager.addTagAlias(
        args.alias as string,
        args.canonical as string,
        args.description as string | undefined
      )
    ),

  list_tag_aliases: async (ctx) => formatToolResponse(await ctx.tagManager.listTagAliases()),

  remove_tag_alias: async (ctx, args) => {
    const removed = await ctx.tagManager.removeTagAlias(args.alias as string);
    return formatTextResponse(
      removed
        ? `Tag alias "${args.alias}" removed successfully`
        : `Tag alias "${args.alias}" not found`
    );
  },

  get_aliases_for_tag: async (ctx, args) =>
    formatToolResponse(await ctx.tagManager.getAliasesForTag(args.canonicalTag as string)),

  resolve_tag: async (ctx, args) =>
    formatToolResponse({
      tag: args.tag,
      resolved: await ctx.tagManager.resolveTag(args.tag as string),
    }),

  // ==================== HIERARCHY HANDLERS ====================
  set_entity_parent: async (ctx, args) =>
    formatToolResponse(
      await ctx.hierarchyManager.setEntityParent(args.entityName as string, args.parentName as string | null)
    ),

  get_children: async (ctx, args) =>
    formatToolResponse(await ctx.hierarchyManager.getChildren(args.entityName as string)),

  get_parent: async (ctx, args) =>
    formatToolResponse(await ctx.hierarchyManager.getParent(args.entityName as string)),

  get_ancestors: async (ctx, args) =>
    formatToolResponse(await ctx.hierarchyManager.getAncestors(args.entityName as string)),

  get_descendants: async (ctx, args) =>
    formatToolResponse(await ctx.hierarchyManager.getDescendants(args.entityName as string)),

  get_subtree: async (ctx, args) =>
    formatToolResponse(await ctx.hierarchyManager.getSubtree(args.entityName as string)),

  get_root_entities: async (ctx) => formatToolResponse(await ctx.hierarchyManager.getRootEntities()),

  get_entity_depth: async (ctx, args) =>
    formatToolResponse({
      entityName: args.entityName,
      depth: await ctx.hierarchyManager.getEntityDepth(args.entityName as string),
    }),

  move_entity: async (ctx, args) =>
    formatToolResponse(
      await ctx.hierarchyManager.moveEntity(args.entityName as string, args.newParentName as string | null)
    ),

  // ==================== ANALYTICS HANDLERS ====================
  get_graph_stats: async (ctx) => formatToolResponse(await ctx.analyticsManager.getGraphStats()),

  validate_graph: async (ctx) => formatToolResponse(await ctx.analyticsManager.validateGraph()),

  // ==================== COMPRESSION HANDLERS ====================
  find_duplicates: async (ctx, args) =>
    formatToolResponse(await ctx.compressionManager.findDuplicates(args.threshold as number | undefined)),

  merge_entities: async (ctx, args) =>
    formatToolResponse(
      await ctx.compressionManager.mergeEntities(args.entityNames as string[], args.targetName as string | undefined)
    ),

  compress_graph: async (ctx, args) =>
    formatToolResponse(
      await ctx.compressionManager.compressGraph(args.threshold as number | undefined, args.dryRun as boolean | undefined)
    ),

  archive_entities: async (ctx, args) =>
    formatToolResponse(
      await ctx.archiveManager.archiveEntities(
        {
          olderThan: args.olderThan as string | undefined,
          importanceLessThan: args.importanceLessThan as number | undefined,
          tags: args.tags as string[] | undefined,
        },
        args.dryRun as boolean | undefined
      )
    ),

  // ==================== IMPORT/EXPORT HANDLERS ====================
  import_graph: async (ctx, args) =>
    formatToolResponse(
      await ctx.ioManager.importGraph(
        args.format as 'json' | 'csv' | 'graphml',
        args.data as string,
        args.mergeStrategy as 'replace' | 'skip' | 'merge' | 'fail' | undefined,
        args.dryRun as boolean | undefined
      )
    ),

  export_graph: async (ctx, args) => {
    const filter = args.filter as { startDate?: string; endDate?: string; entityType?: string; tags?: string[] } | undefined;

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

    return formatRawResponse(
      ctx.ioManager.exportGraph(
        graph,
        args.format as 'json' | 'csv' | 'graphml' | 'gexf' | 'dot' | 'markdown' | 'mermaid'
      )
    );
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
