/**
 * MCP Tool Definitions
 *
 * Extracted from MCPServer.ts to reduce file size and improve maintainability.
 * Contains all 45 tool schemas for the Knowledge Graph MCP Server.
 *
 * @module server/toolDefinitions
 */

/**
 * Tool definition type matching MCP SDK expectations.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

/**
 * All tool definitions for the Knowledge Graph MCP Server.
 * Organized by category for easier maintenance.
 */
export const toolDefinitions: ToolDefinition[] = [
  // ==================== ENTITY TOOLS ====================
  {
    name: 'create_entities',
    description: 'Create multiple new entities in the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        entities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'The name of the entity' },
              entityType: { type: 'string', description: 'The type of the entity' },
              observations: {
                type: 'array',
                items: { type: 'string' },
                description: 'An array of observation contents associated with the entity',
              },
            },
            required: ['name', 'entityType', 'observations'],
            additionalProperties: false,
          },
        },
      },
      required: ['entities'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_entities',
    description: 'Delete multiple entities from the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        entityNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'An array of entity names to delete',
        },
      },
      required: ['entityNames'],
      additionalProperties: false,
    },
  },
  {
    name: 'read_graph',
    description: 'Read the entire knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'open_nodes',
    description: 'Open specific nodes by their names',
    inputSchema: {
      type: 'object',
      properties: {
        names: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of entity names to retrieve',
        },
      },
      required: ['names'],
      additionalProperties: false,
    },
  },

  // ==================== RELATION TOOLS ====================
  {
    name: 'create_relations',
    description:
      'Create multiple new relations between entities in the knowledge graph. Relations should be in active voice',
    inputSchema: {
      type: 'object',
      properties: {
        relations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'The name of the entity where the relation starts' },
              to: { type: 'string', description: 'The name of the entity where the relation ends' },
              relationType: {
                type: 'string',
                description: "The type of the relation in active voice (e.g., 'works_at', 'knows')",
              },
            },
            required: ['from', 'to', 'relationType'],
            additionalProperties: false,
          },
        },
      },
      required: ['relations'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_relations',
    description: 'Delete multiple relations from the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        relations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              relationType: { type: 'string' },
            },
            required: ['from', 'to', 'relationType'],
            additionalProperties: false,
          },
        },
      },
      required: ['relations'],
      additionalProperties: false,
    },
  },

  // ==================== OBSERVATION TOOLS ====================
  {
    name: 'add_observations',
    description: 'Add new observations to existing entities in the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        observations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entityName: { type: 'string', description: 'The name of the entity to add observations to' },
              contents: {
                type: 'array',
                items: { type: 'string' },
                description: 'An array of observation contents to add',
              },
            },
            required: ['entityName', 'contents'],
            additionalProperties: false,
          },
        },
      },
      required: ['observations'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_observations',
    description: 'Delete specific observations from entities',
    inputSchema: {
      type: 'object',
      properties: {
        deletions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entityName: { type: 'string' },
              observations: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['entityName', 'observations'],
          },
        },
      },
      required: ['deletions'],
      additionalProperties: false,
    },
  },

  // ==================== SEARCH TOOLS ====================
  {
    name: 'search_nodes',
    description:
      'Search for nodes in the knowledge graph based on query string, with optional tag and importance filtering',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of tags to filter by',
        },
        minImportance: { type: 'number', description: 'Optional minimum importance score (0-10)' },
        maxImportance: { type: 'number', description: 'Optional maximum importance score (0-10)' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_by_date_range',
    description: 'Search entities within a date range, with optional filtering by entity type and tags',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date in ISO 8601 format' },
        endDate: { type: 'string', description: 'End date in ISO 8601 format' },
        entityType: { type: 'string', description: 'Optional entity type to filter by' },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of tags to filter by',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'search_nodes_ranked',
    description: 'Perform TF-IDF ranked search',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        tags: { type: 'array', items: { type: 'string' } },
        minImportance: { type: 'number' },
        maxImportance: { type: 'number' },
        limit: { type: 'number', description: 'Max results' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'boolean_search',
    description: 'Perform boolean search with AND, OR, NOT operators',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "Boolean query (e.g., 'alice AND bob')" },
        tags: { type: 'array', items: { type: 'string' } },
        minImportance: { type: 'number' },
        maxImportance: { type: 'number' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'fuzzy_search',
    description: 'Perform fuzzy search with typo tolerance',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        threshold: { type: 'number', description: 'Similarity threshold (0.0-1.0)' },
        tags: { type: 'array', items: { type: 'string' } },
        minImportance: { type: 'number' },
        maxImportance: { type: 'number' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_search_suggestions',
    description: 'Get search suggestions for a query',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxSuggestions: { type: 'number', description: 'Max suggestions to return' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },

  // ==================== SAVED SEARCH TOOLS ====================
  {
    name: 'save_search',
    description: 'Save a search query for later reuse',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the saved search' },
        query: { type: 'string', description: 'Search query' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags filter' },
        minImportance: { type: 'number', description: 'Optional minimum importance' },
        maxImportance: { type: 'number', description: 'Optional maximum importance' },
        searchType: { type: 'string', description: 'Type of search (basic, boolean, fuzzy, ranked)' },
        description: { type: 'string', description: 'Optional description of the search' },
      },
      required: ['name', 'query'],
      additionalProperties: false,
    },
  },
  {
    name: 'execute_saved_search',
    description: 'Execute a previously saved search by name',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the saved search' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_saved_searches',
    description: 'List all saved searches',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'delete_saved_search',
    description: 'Delete a saved search',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the saved search to delete' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_saved_search',
    description: 'Update a saved search',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the saved search' },
        updates: { type: 'object', description: 'Fields to update' },
      },
      required: ['name', 'updates'],
      additionalProperties: false,
    },
  },

  // ==================== TAG TOOLS ====================
  {
    name: 'add_tags',
    description: 'Add tags to an entity',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Name of the entity' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Array of tags to add' },
      },
      required: ['entityName', 'tags'],
      additionalProperties: false,
    },
  },
  {
    name: 'remove_tags',
    description: 'Remove tags from an entity',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Name of the entity' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Array of tags to remove' },
      },
      required: ['entityName', 'tags'],
      additionalProperties: false,
    },
  },
  {
    name: 'set_importance',
    description: 'Set the importance score of an entity (0-10)',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Name of the entity' },
        importance: { type: 'number', description: 'Importance score between 0 and 10' },
      },
      required: ['entityName', 'importance'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_tags_to_multiple_entities',
    description: 'Add the same tags to multiple entities at once',
    inputSchema: {
      type: 'object',
      properties: {
        entityNames: { type: 'array', items: { type: 'string' }, description: 'Array of entity names' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Array of tags to add to all entities' },
      },
      required: ['entityNames', 'tags'],
      additionalProperties: false,
    },
  },
  {
    name: 'replace_tag',
    description: 'Replace a tag with a new tag across all entities',
    inputSchema: {
      type: 'object',
      properties: {
        oldTag: { type: 'string', description: 'The tag to replace' },
        newTag: { type: 'string', description: 'The new tag' },
      },
      required: ['oldTag', 'newTag'],
      additionalProperties: false,
    },
  },
  {
    name: 'merge_tags',
    description: 'Merge two tags into a target tag across all entities',
    inputSchema: {
      type: 'object',
      properties: {
        tag1: { type: 'string', description: 'First tag to merge' },
        tag2: { type: 'string', description: 'Second tag to merge' },
        targetTag: { type: 'string', description: 'Target tag to merge into' },
      },
      required: ['tag1', 'tag2', 'targetTag'],
      additionalProperties: false,
    },
  },

  // ==================== TAG ALIAS TOOLS ====================
  {
    name: 'add_tag_alias',
    description: 'Add a tag alias (synonym mapping)',
    inputSchema: {
      type: 'object',
      properties: {
        alias: { type: 'string', description: 'The alias/synonym' },
        canonical: { type: 'string', description: 'The canonical tag' },
        description: { type: 'string', description: 'Optional description' },
      },
      required: ['alias', 'canonical'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_tag_aliases',
    description: 'List all tag aliases',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'remove_tag_alias',
    description: 'Remove a tag alias',
    inputSchema: {
      type: 'object',
      properties: {
        alias: { type: 'string', description: 'The alias to remove' },
      },
      required: ['alias'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_aliases_for_tag',
    description: 'Get all aliases for a canonical tag',
    inputSchema: {
      type: 'object',
      properties: {
        canonicalTag: { type: 'string', description: 'The canonical tag' },
      },
      required: ['canonicalTag'],
      additionalProperties: false,
    },
  },
  {
    name: 'resolve_tag',
    description: 'Resolve a tag to its canonical form',
    inputSchema: {
      type: 'object',
      properties: {
        tag: { type: 'string', description: 'Tag to resolve' },
      },
      required: ['tag'],
      additionalProperties: false,
    },
  },

  // ==================== HIERARCHY TOOLS ====================
  {
    name: 'set_entity_parent',
    description: 'Set the parent of an entity for hierarchical organization',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string' },
        parentName: { type: ['string', 'null'], description: 'Parent entity name or null to remove parent' },
      },
      required: ['entityName', 'parentName'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_children',
    description: 'Get all child entities of an entity',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string' },
      },
      required: ['entityName'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_parent',
    description: 'Get the parent entity of an entity',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string' },
      },
      required: ['entityName'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_ancestors',
    description: 'Get all ancestor entities of an entity',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string' },
      },
      required: ['entityName'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_descendants',
    description: 'Get all descendant entities of an entity',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string' },
      },
      required: ['entityName'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_subtree',
    description: 'Get entity and all its descendants as a subgraph',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string' },
      },
      required: ['entityName'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_root_entities',
    description: 'Get all root entities (entities without parents)',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'get_entity_depth',
    description: 'Get the depth of an entity in the hierarchy',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string' },
      },
      required: ['entityName'],
      additionalProperties: false,
    },
  },
  {
    name: 'move_entity',
    description: 'Move an entity to a new parent',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string' },
        newParentName: { type: ['string', 'null'] },
      },
      required: ['entityName', 'newParentName'],
      additionalProperties: false,
    },
  },

  // ==================== ANALYTICS TOOLS ====================
  {
    name: 'get_graph_stats',
    description: 'Get statistics about the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'validate_graph',
    description: 'Validate the knowledge graph for integrity issues',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },

  // ==================== COMPRESSION TOOLS ====================
  {
    name: 'find_duplicates',
    description: 'Find potential duplicate entities based on similarity',
    inputSchema: {
      type: 'object',
      properties: {
        threshold: { type: 'number', description: 'Similarity threshold (0.0-1.0)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'merge_entities',
    description: 'Merge multiple entities into one',
    inputSchema: {
      type: 'object',
      properties: {
        entityNames: { type: 'array', items: { type: 'string' }, description: 'Entities to merge' },
        targetName: { type: 'string', description: 'Optional target entity name' },
      },
      required: ['entityNames'],
      additionalProperties: false,
    },
  },
  {
    name: 'compress_graph',
    description: 'Compress the graph by merging similar entities',
    inputSchema: {
      type: 'object',
      properties: {
        threshold: { type: 'number', description: 'Similarity threshold' },
        dryRun: { type: 'boolean', description: 'Preview without applying changes' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'archive_entities',
    description: 'Archive old or low-importance entities',
    inputSchema: {
      type: 'object',
      properties: {
        olderThan: { type: 'string', description: 'Archive entities older than this date (ISO 8601)' },
        importanceLessThan: { type: 'number', description: 'Archive entities below this importance' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Archive entities with these tags' },
        dryRun: { type: 'boolean', description: 'Preview without applying changes' },
      },
      additionalProperties: false,
    },
  },

  // ==================== IMPORT/EXPORT TOOLS ====================
  {
    name: 'import_graph',
    description: 'Import knowledge graph from various formats',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['json', 'csv', 'graphml'] },
        data: { type: 'string', description: 'Import data as string' },
        mergeStrategy: {
          type: 'string',
          enum: ['replace', 'skip', 'merge', 'fail'],
          description: 'How to handle conflicts',
        },
        dryRun: { type: 'boolean', description: 'Preview without applying changes' },
      },
      required: ['format', 'data'],
      additionalProperties: false,
    },
  },
  {
    name: 'export_graph',
    description: 'Export knowledge graph in various formats',
    inputSchema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          enum: ['json', 'csv', 'graphml', 'gexf', 'dot', 'markdown', 'mermaid'],
          description: 'Export format',
        },
        filter: {
          type: 'object',
          properties: {
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            entityType: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
          description: 'Optional filter',
        },
      },
      required: ['format'],
      additionalProperties: false,
    },
  },
];

/**
 * Get tool definitions by category.
 */
export const toolCategories = {
  entity: ['create_entities', 'delete_entities', 'read_graph', 'open_nodes'],
  relation: ['create_relations', 'delete_relations'],
  observation: ['add_observations', 'delete_observations'],
  search: ['search_nodes', 'search_by_date_range', 'search_nodes_ranked', 'boolean_search', 'fuzzy_search', 'get_search_suggestions'],
  savedSearch: ['save_search', 'execute_saved_search', 'list_saved_searches', 'delete_saved_search', 'update_saved_search'],
  tag: ['add_tags', 'remove_tags', 'set_importance', 'add_tags_to_multiple_entities', 'replace_tag', 'merge_tags'],
  tagAlias: ['add_tag_alias', 'list_tag_aliases', 'remove_tag_alias', 'get_aliases_for_tag', 'resolve_tag'],
  hierarchy: ['set_entity_parent', 'get_children', 'get_parent', 'get_ancestors', 'get_descendants', 'get_subtree', 'get_root_entities', 'get_entity_depth', 'move_entity'],
  analytics: ['get_graph_stats', 'validate_graph'],
  compression: ['find_duplicates', 'merge_entities', 'compress_graph', 'archive_entities'],
  importExport: ['import_graph', 'export_graph'],
} as const;
