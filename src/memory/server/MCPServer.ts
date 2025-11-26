/**
 * MCP Server
 *
 * Handles Model Context Protocol server initialization and tool registration.
 *
 * @module server/MCPServer
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from '../utils/logger.js';
import { formatToolResponse, formatTextResponse, formatRawResponse } from '../utils/responseFormatter.js';
import type { KnowledgeGraphManager } from '../index.js';
import type { SavedSearch } from '../types/index.js';

/**
 * MCP Server for Knowledge Graph operations.
 * Exposes tools for entity/relation management, search, and analysis.
 */
export class MCPServer {
  private server: Server;
  private manager: KnowledgeGraphManager;

  constructor(manager: KnowledgeGraphManager) {
    this.manager = manager;
    this.server = new Server(
      {
        name: "memory-server",
        version: "0.8.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerToolHandlers();
  }

  private registerToolHandlers() {
    // Register list tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getToolDefinitions(),
      };
    });

    // Register call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return this.handleToolCall(name, args || {});
    });
  }

  private getToolDefinitions() {
    return [
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
                  name: { type: "string", description: "The name of the entity" },
                  entityType: { type: "string", description: "The type of the entity" },
                  observations: {
                    type: "array",
                    items: { type: "string" },
                    description: "An array of observation contents associated with the entity"
                  },
                },
                required: ["name", "entityType", "observations"],
                additionalProperties: false,
              },
            },
          },
          required: ["entities"],
          additionalProperties: false,
        },
      },
      {
        name: "create_relations",
        description: "Create multiple new relations between entities in the knowledge graph. Relations should be in active voice",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "The name of the entity where the relation starts" },
                  to: { type: "string", description: "The name of the entity where the relation ends" },
                  relationType: { type: "string", description: "The type of the relation in active voice (e.g., 'works_at', 'knows')" },
                },
                required: ["from", "to", "relationType"],
                additionalProperties: false,
              },
            },
          },
          required: ["relations"],
          additionalProperties: false,
        },
      },
      {
        name: "add_observations",
        description: "Add new observations to existing entities in the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            observations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string", description: "The name of the entity to add observations to" },
                  contents: {
                    type: "array",
                    items: { type: "string" },
                    description: "An array of observation contents to add"
                  },
                },
                required: ["entityName", "contents"],
                additionalProperties: false,
              },
            },
          },
          required: ["observations"],
          additionalProperties: false,
        },
      },
      {
        name: "delete_entities",
        description: "Delete multiple entities from the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            entityNames: {
              type: "array",
              items: { type: "string" },
              description: "An array of entity names to delete"
            },
          },
          required: ["entityNames"],
          additionalProperties: false,
        },
      },
      {
        name: "delete_observations",
        description: "Delete specific observations from entities",
        inputSchema: {
          type: "object",
          properties: {
            deletions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  entityName: { type: "string" },
                  observations: {
                    type: "array",
                    items: { type: "string" }
                  },
                },
                required: ["entityName", "observations"],
              },
            },
          },
          required: ["deletions"],
          additionalProperties: false,
        },
      },
      {
        name: "delete_relations",
        description: "Delete multiple relations from the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: { type: "string" },
                  to: { type: "string" },
                  relationType: { type: "string" },
                },
                required: ["from", "to", "relationType"],
                additionalProperties: false,
              },
            },
          },
          required: ["relations"],
          additionalProperties: false,
        },
      },
      {
        name: "read_graph",
        description: "Read the entire knowledge graph",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "search_nodes",
        description: "Search for nodes in the knowledge graph based on query string, with optional tag and importance filtering",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query" },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional array of tags to filter by"
            },
            minImportance: { type: "number", description: "Optional minimum importance score (0-10)" },
            maxImportance: { type: "number", description: "Optional maximum importance score (0-10)" },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
      {
        name: "open_nodes",
        description: "Open specific nodes by their names",
        inputSchema: {
          type: "object",
          properties: {
            names: {
              type: "array",
              items: { type: "string" },
              description: "Array of entity names to retrieve"
            },
          },
          required: ["names"],
          additionalProperties: false,
        },
      },
      {
        name: "search_by_date_range",
        description: "Search entities within a date range, with optional filtering by entity type and tags",
        inputSchema: {
          type: "object",
          properties: {
            startDate: { type: "string", description: "Start date in ISO 8601 format" },
            endDate: { type: "string", description: "End date in ISO 8601 format" },
            entityType: { type: "string", description: "Optional entity type to filter by" },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional array of tags to filter by"
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "add_tags",
        description: "Add tags to an entity",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string", description: "Name of the entity" },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Array of tags to add"
            },
          },
          required: ["entityName", "tags"],
          additionalProperties: false,
        },
      },
      {
        name: "remove_tags",
        description: "Remove tags from an entity",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string", description: "Name of the entity" },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Array of tags to remove"
            },
          },
          required: ["entityName", "tags"],
          additionalProperties: false,
        },
      },
      {
        name: "set_importance",
        description: "Set the importance score of an entity (0-10)",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string", description: "Name of the entity" },
            importance: { type: "number", description: "Importance score between 0 and 10" },
          },
          required: ["entityName", "importance"],
          additionalProperties: false,
        },
      },
      {
        name: "add_tags_to_multiple_entities",
        description: "Add the same tags to multiple entities at once",
        inputSchema: {
          type: "object",
          properties: {
            entityNames: {
              type: "array",
              items: { type: "string" },
              description: "Array of entity names"
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Array of tags to add to all entities"
            },
          },
          required: ["entityNames", "tags"],
          additionalProperties: false,
        },
      },
      {
        name: "replace_tag",
        description: "Replace a tag with a new tag across all entities",
        inputSchema: {
          type: "object",
          properties: {
            oldTag: { type: "string", description: "The tag to replace" },
            newTag: { type: "string", description: "The new tag" },
          },
          required: ["oldTag", "newTag"],
          additionalProperties: false,
        },
      },
      {
        name: "merge_tags",
        description: "Merge two tags into a target tag across all entities",
        inputSchema: {
          type: "object",
          properties: {
            tag1: { type: "string", description: "First tag to merge" },
            tag2: { type: "string", description: "Second tag to merge" },
            targetTag: { type: "string", description: "Target tag to merge into" },
          },
          required: ["tag1", "tag2", "targetTag"],
          additionalProperties: false,
        },
      },
      {
        name: "get_graph_stats",
        description: "Get statistics about the knowledge graph",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "validate_graph",
        description: "Validate the knowledge graph for integrity issues",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "save_search",
        description: "Save a search query for later reuse",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the saved search" },
            query: { type: "string", description: "Search query" },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional tags filter"
            },
            minImportance: { type: "number", description: "Optional minimum importance" },
            maxImportance: { type: "number", description: "Optional maximum importance" },
            searchType: { type: "string", description: "Type of search (basic, boolean, fuzzy, ranked)" },
            description: { type: "string", description: "Optional description of the search" },
          },
          required: ["name", "query"],
          additionalProperties: false,
        },
      },
      {
        name: "execute_saved_search",
        description: "Execute a previously saved search by name",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the saved search" },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
      {
        name: "list_saved_searches",
        description: "List all saved searches",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "delete_saved_search",
        description: "Delete a saved search",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the saved search to delete" },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
      {
        name: "update_saved_search",
        description: "Update a saved search",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the saved search" },
            updates: {
              type: "object",
              description: "Fields to update",
            },
          },
          required: ["name", "updates"],
          additionalProperties: false,
        },
      },
      {
        name: "boolean_search",
        description: "Perform boolean search with AND, OR, NOT operators",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Boolean query (e.g., 'alice AND bob')" },
            tags: {
              type: "array",
              items: { type: "string" },
            },
            minImportance: { type: "number" },
            maxImportance: { type: "number" },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
      {
        name: "fuzzy_search",
        description: "Perform fuzzy search with typo tolerance",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            threshold: { type: "number", description: "Similarity threshold (0.0-1.0)" },
            tags: {
              type: "array",
              items: { type: "string" },
            },
            minImportance: { type: "number" },
            maxImportance: { type: "number" },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
      {
        name: "search_nodes_ranked",
        description: "Perform TF-IDF ranked search",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            tags: {
              type: "array",
              items: { type: "string" },
            },
            minImportance: { type: "number" },
            maxImportance: { type: "number" },
            limit: { type: "number", description: "Max results" },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
      {
        name: "get_search_suggestions",
        description: "Get search suggestions for a query",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            maxSuggestions: { type: "number", description: "Max suggestions to return" },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
      {
        name: "add_tag_alias",
        description: "Add a tag alias (synonym mapping)",
        inputSchema: {
          type: "object",
          properties: {
            alias: { type: "string", description: "The alias/synonym" },
            canonical: { type: "string", description: "The canonical tag" },
            description: { type: "string", description: "Optional description" },
          },
          required: ["alias", "canonical"],
          additionalProperties: false,
        },
      },
      {
        name: "list_tag_aliases",
        description: "List all tag aliases",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "remove_tag_alias",
        description: "Remove a tag alias",
        inputSchema: {
          type: "object",
          properties: {
            alias: { type: "string", description: "The alias to remove" },
          },
          required: ["alias"],
          additionalProperties: false,
        },
      },
      {
        name: "get_aliases_for_tag",
        description: "Get all aliases for a canonical tag",
        inputSchema: {
          type: "object",
          properties: {
            canonicalTag: { type: "string", description: "The canonical tag" },
          },
          required: ["canonicalTag"],
          additionalProperties: false,
        },
      },
      {
        name: "resolve_tag",
        description: "Resolve a tag to its canonical form",
        inputSchema: {
          type: "object",
          properties: {
            tag: { type: "string", description: "Tag to resolve" },
          },
          required: ["tag"],
          additionalProperties: false,
        },
      },
      {
        name: "set_entity_parent",
        description: "Set the parent of an entity for hierarchical organization",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string" },
            parentName: { type: ["string", "null"], description: "Parent entity name or null to remove parent" },
          },
          required: ["entityName", "parentName"],
          additionalProperties: false,
        },
      },
      {
        name: "get_children",
        description: "Get all child entities of an entity",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string" },
          },
          required: ["entityName"],
          additionalProperties: false,
        },
      },
      {
        name: "get_parent",
        description: "Get the parent entity of an entity",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string" },
          },
          required: ["entityName"],
          additionalProperties: false,
        },
      },
      {
        name: "get_ancestors",
        description: "Get all ancestor entities of an entity",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string" },
          },
          required: ["entityName"],
          additionalProperties: false,
        },
      },
      {
        name: "get_descendants",
        description: "Get all descendant entities of an entity",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string" },
          },
          required: ["entityName"],
          additionalProperties: false,
        },
      },
      {
        name: "get_subtree",
        description: "Get entity and all its descendants as a subgraph",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string" },
          },
          required: ["entityName"],
          additionalProperties: false,
        },
      },
      {
        name: "get_root_entities",
        description: "Get all root entities (entities without parents)",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "get_entity_depth",
        description: "Get the depth of an entity in the hierarchy",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string" },
          },
          required: ["entityName"],
          additionalProperties: false,
        },
      },
      {
        name: "move_entity",
        description: "Move an entity to a new parent",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { type: "string" },
            newParentName: { type: ["string", "null"] },
          },
          required: ["entityName", "newParentName"],
          additionalProperties: false,
        },
      },
      {
        name: "find_duplicates",
        description: "Find potential duplicate entities based on similarity",
        inputSchema: {
          type: "object",
          properties: {
            threshold: { type: "number", description: "Similarity threshold (0.0-1.0)" },
          },
          additionalProperties: false,
        },
      },
      {
        name: "merge_entities",
        description: "Merge multiple entities into one",
        inputSchema: {
          type: "object",
          properties: {
            entityNames: {
              type: "array",
              items: { type: "string" },
              description: "Entities to merge"
            },
            targetName: { type: "string", description: "Optional target entity name" },
          },
          required: ["entityNames"],
          additionalProperties: false,
        },
      },
      {
        name: "compress_graph",
        description: "Compress the graph by merging similar entities",
        inputSchema: {
          type: "object",
          properties: {
            threshold: { type: "number", description: "Similarity threshold" },
            dryRun: { type: "boolean", description: "Preview without applying changes" },
          },
          additionalProperties: false,
        },
      },
      {
        name: "archive_entities",
        description: "Archive old or low-importance entities",
        inputSchema: {
          type: "object",
          properties: {
            olderThan: { type: "string", description: "Archive entities older than this date (ISO 8601)" },
            importanceLessThan: { type: "number", description: "Archive entities below this importance" },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Archive entities with these tags"
            },
            dryRun: { type: "boolean", description: "Preview without applying changes" },
          },
          additionalProperties: false,
        },
      },
      {
        name: "import_graph",
        description: "Import knowledge graph from various formats",
        inputSchema: {
          type: "object",
          properties: {
            format: { type: "string", enum: ["json", "csv", "graphml"] },
            data: { type: "string", description: "Import data as string" },
            mergeStrategy: {
              type: "string",
              enum: ["replace", "skip", "merge", "fail"],
              description: "How to handle conflicts"
            },
            dryRun: { type: "boolean", description: "Preview without applying changes" },
          },
          required: ["format", "data"],
          additionalProperties: false,
        },
      },
      {
        name: "export_graph",
        description: "Export knowledge graph in various formats",
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["json", "csv", "graphml", "gexf", "dot", "markdown", "mermaid"],
              description: "Export format"
            },
            filter: {
              type: "object",
              properties: {
                startDate: { type: "string" },
                endDate: { type: "string" },
                entityType: { type: "string" },
                tags: {
                  type: "array",
                  items: { type: "string" }
                },
              },
              description: "Optional filter"
            },
          },
          required: ["format"],
          additionalProperties: false,
        },
      },
    ];
  }

  private async handleToolCall(name: string, args: Record<string, unknown>) {
    switch (name) {
      case "create_entities":
        return formatToolResponse(await this.manager.createEntities(args.entities as any[]));
      case "create_relations":
        return formatToolResponse(await this.manager.createRelations(args.relations as any[]));
      case "add_observations":
        return formatToolResponse(await this.manager.addObservations(args.observations as any[]));
      case "delete_entities":
        await this.manager.deleteEntities(args.entityNames as string[]);
        return formatTextResponse(`Deleted ${(args.entityNames as string[]).length} entities`);
      case "delete_observations":
        await this.manager.deleteObservations(args.deletions as any[]);
        return formatTextResponse("Observations deleted successfully");
      case "delete_relations":
        await this.manager.deleteRelations(args.relations as any[]);
        return formatTextResponse(`Deleted ${(args.relations as any[]).length} relations`);
      case "read_graph":
        return formatToolResponse(await this.manager.readGraph());
      case "search_nodes":
        return formatToolResponse(await this.manager.searchNodes(args.query as string, args.tags as string[] | undefined, args.minImportance as number | undefined, args.maxImportance as number | undefined));
      case "open_nodes":
        return formatToolResponse(await this.manager.openNodes(args.names as string[]));
      case "search_nodes_ranked":
        return formatToolResponse(await this.manager.searchNodesRanked(args.query as string, args.tags as string[] | undefined, args.minImportance as number | undefined, args.maxImportance as number | undefined, args.limit as number | undefined));
      case "list_saved_searches":
        return formatToolResponse(await this.manager.listSavedSearches());
      case "search_by_date_range":
        return formatToolResponse(await this.manager.searchByDateRange(args.startDate as string | undefined, args.endDate as string | undefined, args.entityType as string | undefined, args.tags as string[] | undefined));
      case "add_tags":
        return formatToolResponse(await this.manager.addTags(args.entityName as string, args.tags as string[]));
      case "remove_tags":
        return formatToolResponse(await this.manager.removeTags(args.entityName as string, args.tags as string[]));
      case "set_importance":
        return formatToolResponse(await this.manager.setImportance(args.entityName as string, args.importance as number));
      case "add_tags_to_multiple_entities":
        return formatToolResponse(await this.manager.addTagsToMultipleEntities(args.entityNames as string[], args.tags as string[]));
      case "replace_tag":
        return formatToolResponse(await this.manager.replaceTag(args.oldTag as string, args.newTag as string));
      case "merge_tags":
        return formatToolResponse(await this.manager.mergeTags(args.tag1 as string, args.tag2 as string, args.targetTag as string));
      case "save_search":
        return formatToolResponse(await this.manager.saveSearch(args as Omit<SavedSearch, 'createdAt' | 'useCount' | 'lastUsed'>));
      case "execute_saved_search":
        return formatToolResponse(await this.manager.executeSavedSearch(args.name as string));
      case "delete_saved_search":
        const deleted = await this.manager.deleteSavedSearch(args.name as string);
        return formatTextResponse(deleted ? `Saved search "${args.name}" deleted successfully` : `Saved search "${args.name}" not found`);
      case "update_saved_search":
        return formatToolResponse(await this.manager.updateSavedSearch(args.name as string, args.updates as any));
      case "boolean_search":
        return formatToolResponse(await this.manager.booleanSearch(args.query as string, args.tags as string[] | undefined, args.minImportance as number | undefined, args.maxImportance as number | undefined));
      case "fuzzy_search":
        return formatToolResponse(await this.manager.fuzzySearch(args.query as string, args.threshold as number | undefined, args.tags as string[] | undefined, args.minImportance as number | undefined, args.maxImportance as number | undefined));
      case "get_search_suggestions":
        return formatToolResponse(await this.manager.getSearchSuggestions(args.query as string, args.maxSuggestions as number | undefined));
      case "add_tag_alias":
        return formatToolResponse(await this.manager.addTagAlias(args.alias as string, args.canonical as string, args.description as string | undefined));
      case "list_tag_aliases":
        return formatToolResponse(await this.manager.listTagAliases());
      case "remove_tag_alias":
        const removed = await this.manager.removeTagAlias(args.alias as string);
        return formatTextResponse(removed ? `Tag alias "${args.alias}" removed successfully` : `Tag alias "${args.alias}" not found`);
      case "get_aliases_for_tag":
        return formatToolResponse(await this.manager.getAliasesForTag(args.canonicalTag as string));
      case "resolve_tag":
        return formatToolResponse({ tag: args.tag, resolved: await this.manager.resolveTag(args.tag as string) });
      case "set_entity_parent":
        return formatToolResponse(await this.manager.setEntityParent(args.entityName as string, args.parentName as string | null));
      case "get_children":
        return formatToolResponse(await this.manager.getChildren(args.entityName as string));
      case "get_parent":
        return formatToolResponse(await this.manager.getParent(args.entityName as string));
      case "get_ancestors":
        return formatToolResponse(await this.manager.getAncestors(args.entityName as string));
      case "get_descendants":
        return formatToolResponse(await this.manager.getDescendants(args.entityName as string));
      case "get_subtree":
        return formatToolResponse(await this.manager.getSubtree(args.entityName as string));
      case "get_root_entities":
        return formatToolResponse(await this.manager.getRootEntities());
      case "get_entity_depth":
        return formatToolResponse({ entityName: args.entityName, depth: await this.manager.getEntityDepth(args.entityName as string) });
      case "move_entity":
        return formatToolResponse(await this.manager.moveEntity(args.entityName as string, args.newParentName as string | null));
      case "get_graph_stats":
        return formatToolResponse(await this.manager.getGraphStats());
      case "validate_graph":
        return formatToolResponse(await this.manager.validateGraph());
      case "find_duplicates":
        return formatToolResponse(await this.manager.findDuplicates(args.threshold as number | undefined));
      case "merge_entities":
        return formatToolResponse(await this.manager.mergeEntities(args.entityNames as string[], args.targetName as string | undefined));
      case "compress_graph":
        return formatToolResponse(await this.manager.compressGraph(args.threshold as number | undefined, args.dryRun as boolean | undefined));
      case "archive_entities":
        return formatToolResponse(await this.manager.archiveEntities({ olderThan: args.olderThan as string | undefined, importanceLessThan: args.importanceLessThan as number | undefined, tags: args.tags as string[] | undefined }, args.dryRun as boolean | undefined));
      case "import_graph":
        return formatToolResponse(await this.manager.importGraph(args.format as 'json' | 'csv' | 'graphml', args.data as string, args.mergeStrategy as 'replace' | 'skip' | 'merge' | 'fail' | undefined, args.dryRun as boolean | undefined));
      case "export_graph":
        return formatRawResponse(await this.manager.exportGraph(args.format as 'json' | 'csv' | 'graphml' | 'gexf' | 'dot' | 'markdown' | 'mermaid', args.filter as { startDate?: string; endDate?: string; entityType?: string; tags?: string[] } | undefined));
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Knowledge Graph MCP Server running on stdio');
  }
}
