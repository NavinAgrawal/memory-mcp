/**
 * MCP Tool Handlers
 *
 * Extracted from MCPServer.ts to reduce file size and improve maintainability.
 * Contains handler functions for all 45 Knowledge Graph tools.
 *
 * @module server/toolHandlers
 */

import { formatToolResponse, formatTextResponse, formatRawResponse } from '../utils/responseFormatter.js';
import type { KnowledgeGraphManager } from '../core/KnowledgeGraphManager.js';
import type { SavedSearch } from '../types/index.js';

/**
 * Tool response type for MCP SDK compatibility.
 */
export type ToolResponse = ReturnType<typeof formatToolResponse>;

/**
 * Tool handler function signature.
 */
export type ToolHandler = (
  manager: KnowledgeGraphManager,
  args: Record<string, unknown>
) => Promise<ToolResponse>;

/**
 * Registry of all tool handlers keyed by tool name.
 */
export const toolHandlers: Record<string, ToolHandler> = {
  // ==================== ENTITY HANDLERS ====================
  create_entities: async (manager, args) =>
    formatToolResponse(await manager.createEntities(args.entities as any[])),

  delete_entities: async (manager, args) => {
    await manager.deleteEntities(args.entityNames as string[]);
    return formatTextResponse(`Deleted ${(args.entityNames as string[]).length} entities`);
  },

  read_graph: async (manager) => formatToolResponse(await manager.readGraph()),

  open_nodes: async (manager, args) =>
    formatToolResponse(await manager.openNodes(args.names as string[])),

  // ==================== RELATION HANDLERS ====================
  create_relations: async (manager, args) =>
    formatToolResponse(await manager.createRelations(args.relations as any[])),

  delete_relations: async (manager, args) => {
    await manager.deleteRelations(args.relations as any[]);
    return formatTextResponse(`Deleted ${(args.relations as any[]).length} relations`);
  },

  // ==================== OBSERVATION HANDLERS ====================
  add_observations: async (manager, args) =>
    formatToolResponse(await manager.addObservations(args.observations as any[])),

  delete_observations: async (manager, args) => {
    await manager.deleteObservations(args.deletions as any[]);
    return formatTextResponse('Observations deleted successfully');
  },

  // ==================== SEARCH HANDLERS ====================
  search_nodes: async (manager, args) =>
    formatToolResponse(
      await manager.searchNodes(
        args.query as string,
        args.tags as string[] | undefined,
        args.minImportance as number | undefined,
        args.maxImportance as number | undefined
      )
    ),

  search_by_date_range: async (manager, args) =>
    formatToolResponse(
      await manager.searchByDateRange(
        args.startDate as string | undefined,
        args.endDate as string | undefined,
        args.entityType as string | undefined,
        args.tags as string[] | undefined
      )
    ),

  search_nodes_ranked: async (manager, args) =>
    formatToolResponse(
      await manager.searchNodesRanked(
        args.query as string,
        args.tags as string[] | undefined,
        args.minImportance as number | undefined,
        args.maxImportance as number | undefined,
        args.limit as number | undefined
      )
    ),

  boolean_search: async (manager, args) =>
    formatToolResponse(
      await manager.booleanSearch(
        args.query as string,
        args.tags as string[] | undefined,
        args.minImportance as number | undefined,
        args.maxImportance as number | undefined
      )
    ),

  fuzzy_search: async (manager, args) =>
    formatToolResponse(
      await manager.fuzzySearch(
        args.query as string,
        args.threshold as number | undefined,
        args.tags as string[] | undefined,
        args.minImportance as number | undefined,
        args.maxImportance as number | undefined
      )
    ),

  get_search_suggestions: async (manager, args) =>
    formatToolResponse(
      await manager.getSearchSuggestions(args.query as string, args.maxSuggestions as number | undefined)
    ),

  // ==================== SAVED SEARCH HANDLERS ====================
  save_search: async (manager, args) =>
    formatToolResponse(
      await manager.saveSearch(args as Omit<SavedSearch, 'createdAt' | 'useCount' | 'lastUsed'>)
    ),

  execute_saved_search: async (manager, args) =>
    formatToolResponse(await manager.executeSavedSearch(args.name as string)),

  list_saved_searches: async (manager) => formatToolResponse(await manager.listSavedSearches()),

  delete_saved_search: async (manager, args) => {
    const deleted = await manager.deleteSavedSearch(args.name as string);
    return formatTextResponse(
      deleted
        ? `Saved search "${args.name}" deleted successfully`
        : `Saved search "${args.name}" not found`
    );
  },

  update_saved_search: async (manager, args) =>
    formatToolResponse(await manager.updateSavedSearch(args.name as string, args.updates as any)),

  // ==================== TAG HANDLERS ====================
  add_tags: async (manager, args) =>
    formatToolResponse(await manager.addTags(args.entityName as string, args.tags as string[])),

  remove_tags: async (manager, args) =>
    formatToolResponse(await manager.removeTags(args.entityName as string, args.tags as string[])),

  set_importance: async (manager, args) =>
    formatToolResponse(await manager.setImportance(args.entityName as string, args.importance as number)),

  add_tags_to_multiple_entities: async (manager, args) =>
    formatToolResponse(
      await manager.addTagsToMultipleEntities(args.entityNames as string[], args.tags as string[])
    ),

  replace_tag: async (manager, args) =>
    formatToolResponse(await manager.replaceTag(args.oldTag as string, args.newTag as string)),

  merge_tags: async (manager, args) =>
    formatToolResponse(
      await manager.mergeTags(args.tag1 as string, args.tag2 as string, args.targetTag as string)
    ),

  // ==================== TAG ALIAS HANDLERS ====================
  add_tag_alias: async (manager, args) =>
    formatToolResponse(
      await manager.addTagAlias(
        args.alias as string,
        args.canonical as string,
        args.description as string | undefined
      )
    ),

  list_tag_aliases: async (manager) => formatToolResponse(await manager.listTagAliases()),

  remove_tag_alias: async (manager, args) => {
    const removed = await manager.removeTagAlias(args.alias as string);
    return formatTextResponse(
      removed
        ? `Tag alias "${args.alias}" removed successfully`
        : `Tag alias "${args.alias}" not found`
    );
  },

  get_aliases_for_tag: async (manager, args) =>
    formatToolResponse(await manager.getAliasesForTag(args.canonicalTag as string)),

  resolve_tag: async (manager, args) =>
    formatToolResponse({
      tag: args.tag,
      resolved: await manager.resolveTag(args.tag as string),
    }),

  // ==================== HIERARCHY HANDLERS ====================
  set_entity_parent: async (manager, args) =>
    formatToolResponse(
      await manager.setEntityParent(args.entityName as string, args.parentName as string | null)
    ),

  get_children: async (manager, args) =>
    formatToolResponse(await manager.getChildren(args.entityName as string)),

  get_parent: async (manager, args) =>
    formatToolResponse(await manager.getParent(args.entityName as string)),

  get_ancestors: async (manager, args) =>
    formatToolResponse(await manager.getAncestors(args.entityName as string)),

  get_descendants: async (manager, args) =>
    formatToolResponse(await manager.getDescendants(args.entityName as string)),

  get_subtree: async (manager, args) =>
    formatToolResponse(await manager.getSubtree(args.entityName as string)),

  get_root_entities: async (manager) => formatToolResponse(await manager.getRootEntities()),

  get_entity_depth: async (manager, args) =>
    formatToolResponse({
      entityName: args.entityName,
      depth: await manager.getEntityDepth(args.entityName as string),
    }),

  move_entity: async (manager, args) =>
    formatToolResponse(
      await manager.moveEntity(args.entityName as string, args.newParentName as string | null)
    ),

  // ==================== ANALYTICS HANDLERS ====================
  get_graph_stats: async (manager) => formatToolResponse(await manager.getGraphStats()),

  validate_graph: async (manager) => formatToolResponse(await manager.validateGraph()),

  // ==================== COMPRESSION HANDLERS ====================
  find_duplicates: async (manager, args) =>
    formatToolResponse(await manager.findDuplicates(args.threshold as number | undefined)),

  merge_entities: async (manager, args) =>
    formatToolResponse(
      await manager.mergeEntities(args.entityNames as string[], args.targetName as string | undefined)
    ),

  compress_graph: async (manager, args) =>
    formatToolResponse(
      await manager.compressGraph(args.threshold as number | undefined, args.dryRun as boolean | undefined)
    ),

  archive_entities: async (manager, args) =>
    formatToolResponse(
      await manager.archiveEntities(
        {
          olderThan: args.olderThan as string | undefined,
          importanceLessThan: args.importanceLessThan as number | undefined,
          tags: args.tags as string[] | undefined,
        },
        args.dryRun as boolean | undefined
      )
    ),

  // ==================== IMPORT/EXPORT HANDLERS ====================
  import_graph: async (manager, args) =>
    formatToolResponse(
      await manager.importGraph(
        args.format as 'json' | 'csv' | 'graphml',
        args.data as string,
        args.mergeStrategy as 'replace' | 'skip' | 'merge' | 'fail' | undefined,
        args.dryRun as boolean | undefined
      )
    ),

  export_graph: async (manager, args) =>
    formatRawResponse(
      await manager.exportGraph(
        args.format as 'json' | 'csv' | 'graphml' | 'gexf' | 'dot' | 'markdown' | 'mermaid',
        args.filter as { startDate?: string; endDate?: string; entityType?: string; tags?: string[] } | undefined
      )
    ),
};

/**
 * Handle a tool call by dispatching to the appropriate handler.
 *
 * @param name - Tool name to call
 * @param args - Tool arguments
 * @param manager - Knowledge graph manager instance
 * @returns Tool response
 * @throws Error if tool name is unknown
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  manager: KnowledgeGraphManager
): Promise<ToolResponse> {
  const handler = toolHandlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return handler(manager, args);
}
