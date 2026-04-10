/**
 * MCP Tool Definitions
 *
 * Extracted from MCPServer.ts to reduce file size and improve maintainability.
 * Contains all 106 tool schemas for the Knowledge Graph MCP Server.
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

  // Phase 13: Project scoping + memory versioning tools
  {
    name: 'list_projects',
    description: 'List all distinct project IDs in the knowledge graph. Returns sorted array of projectId values, excluding global/unscoped entities.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_entity_versions',
    description: 'Get the latest version of an entity. If the entity has been superseded by newer versions (via contradiction detection), returns the most recent one.',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Name of any entity in the version chain' },
      },
      required: ['entityName'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_version_chain',
    description: 'Get all versions of an entity in its version chain. Returns versions sorted by version number ascending. Works from any entity in the chain (resolves to root automatically).',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Name of any entity in the version chain' },
      },
      required: ['entityName'],
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

  // Phase 13: Temporal knowledge graph tools
  {
    name: 'invalidate_relation',
    description: 'Mark a relation as no longer valid. Sets the validUntil timestamp on the matching active relation. Use for temporal facts that have ended (e.g., "Kai no longer works on Orion").',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Source entity name' },
        relationType: { type: 'string', description: 'Relation type (e.g., works_on, assigned_to)' },
        to: { type: 'string', description: 'Target entity name' },
        ended: { type: 'string', description: 'ISO 8601 date when the relation ended. Defaults to now.' },
      },
      required: ['from', 'relationType', 'to'],
      additionalProperties: false,
    },
  },
  {
    name: 'query_as_of',
    description: 'Query relations valid at a specific point in time. Returns only relations where validFrom <= date AND (validUntil is undefined OR validUntil >= date). Time-travel query for temporal knowledge graphs.',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Entity to query relations for' },
        asOf: { type: 'string', description: 'ISO 8601 date to query at (e.g., "2026-01-15")' },
        direction: { type: 'string', enum: ['outgoing', 'incoming', 'both'], description: 'Relation direction filter. Default: both.' },
      },
      required: ['entityName', 'asOf'],
      additionalProperties: false,
    },
  },
  {
    name: 'timeline',
    description: 'Get chronological relation history for an entity. Returns ALL relations (current and expired) sorted by validFrom ascending. Shows the full story of an entity over time.',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Entity to get timeline for' },
        direction: { type: 'string', enum: ['outgoing', 'incoming', 'both'], description: 'Relation direction filter. Default: both.' },
      },
      required: ['entityName'],
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
  // Phase 11 Sprint 5: Observation Normalization
  {
    name: 'normalize_observations',
    description: 'Normalize entity observations by resolving pronouns and anchoring relative dates. Improves search matching quality.',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: {
          type: 'string',
          description: 'Entity name to normalize (omit for all entities)',
        },
        options: {
          type: 'object',
          properties: {
            resolveCoreferences: { type: 'boolean', default: true },
            anchorTimestamps: { type: 'boolean', default: true },
            extractKeywords: { type: 'boolean', default: false },
          },
          additionalProperties: false,
        },
        persist: {
          type: 'boolean',
          default: false,
          description: 'Save normalized observations to storage',
        },
      },
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
    description: 'Search entities within a date range, with optional filtering by entity type and tags. At least one of startDate or endDate should be provided.',
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
  // Phase 10 Sprint 4: Automatic search method selection
  {
    name: 'search_auto',
    description: 'Automatically select and execute the best search method based on query characteristics and graph size. Returns results along with the selected method and reasoning.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Maximum results to return (default: 10)' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  // Phase 13: Semantic forget
  {
    name: 'forget_memory',
    description: 'Forget (delete) observations matching the given content. Tries exact match first; falls back to semantic search at 0.85 similarity threshold if available. Supports dryRun to preview what would be deleted.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The content to forget (observation text)' },
        threshold: { type: 'number', description: 'Semantic similarity threshold for fallback (default: 0.85)' },
        projectId: { type: 'string', description: 'Optional project scope filter' },
        dryRun: { type: 'boolean', description: 'If true, return what would be deleted without actually deleting' },
      },
      required: ['content'],
      additionalProperties: false,
    },
  },
  // Phase 11 Sprint 2: Hybrid Search
  {
    name: 'hybrid_search',
    description:
      'Search using combined semantic, lexical, and metadata signals. Provides better recall than single-signal search by fusing multiple relevance signals.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query text',
        },
        weights: {
          type: 'object',
          description: 'Layer weights (automatically normalized to sum to 1.0)',
          properties: {
            semantic: {
              type: 'number',
              description: 'Weight for semantic/embedding similarity (default: 0.5)',
            },
            lexical: {
              type: 'number',
              description: 'Weight for keyword/TF-IDF matching (default: 0.3)',
            },
            symbolic: {
              type: 'number',
              description: 'Weight for metadata filtering (default: 0.2)',
            },
          },
          additionalProperties: false,
        },
        filters: {
          type: 'object',
          description: 'Symbolic/metadata filters',
          properties: {
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by tags',
            },
            entityTypes: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by entity types',
            },
            dateRange: {
              type: 'object',
              properties: {
                start: { type: 'string', description: 'Start date (ISO 8601)' },
                end: { type: 'string', description: 'End date (ISO 8601)' },
              },
              additionalProperties: false,
            },
            minImportance: { type: 'number', description: 'Minimum importance score (0-10)' },
            maxImportance: { type: 'number', description: 'Maximum importance score (0-10)' },
          },
          additionalProperties: false,
        },
        limit: { type: 'number', description: 'Maximum results to return (default: 10)' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  // Phase 11 Sprint 3: Query Analysis
  {
    name: 'analyze_query',
    description:
      'Analyze a search query to extract entities, temporal references, question type, and complexity. Useful for understanding query structure before searching.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The query to analyze',
        },
        includePlan: {
          type: 'boolean',
          description: 'Include execution plan in response (default: false)',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  // Phase 11 Sprint 4: Smart Search
  {
    name: 'smart_search',
    description:
      'Intelligent search with automatic query planning and reflection-based refinement. Iteratively improves results until adequate.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query text',
        },
        maxIterations: {
          type: 'number',
          description: 'Maximum reflection iterations (default: 3)',
        },
        adequacyThreshold: {
          type: 'number',
          description: 'Adequacy threshold 0-1 (default: 0.7)',
        },
        includePlan: {
          type: 'boolean',
          description: 'Include execution plan in response (default: true)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
        },
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

  // ==================== GRAPH ALGORITHM TOOLS (Phase 4 Sprint 9) ====================
  {
    name: 'find_shortest_path',
    description: 'Find the shortest path between two entities in the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source entity name' },
        target: { type: 'string', description: 'Target entity name' },
        direction: {
          type: 'string',
          enum: ['outgoing', 'incoming', 'both'],
          description: 'Direction of traversal (default: both)',
        },
        relationTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional filter for relation types to follow',
        },
      },
      required: ['source', 'target'],
      additionalProperties: false,
    },
  },
  {
    name: 'find_all_paths',
    description: 'Find all paths between two entities up to a maximum depth',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source entity name' },
        target: { type: 'string', description: 'Target entity name' },
        maxDepth: { type: 'number', description: 'Maximum path length (default: 5)' },
        direction: {
          type: 'string',
          enum: ['outgoing', 'incoming', 'both'],
          description: 'Direction of traversal (default: both)',
        },
        relationTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional filter for relation types to follow',
        },
      },
      required: ['source', 'target'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_connected_components',
    description: 'Find all connected components in the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'get_centrality',
    description: 'Calculate centrality metrics for entities in the graph',
    inputSchema: {
      type: 'object',
      properties: {
        algorithm: {
          type: 'string',
          enum: ['degree', 'betweenness', 'pagerank'],
          description: 'Centrality algorithm to use (default: degree)',
        },
        direction: {
          type: 'string',
          enum: ['in', 'out', 'both'],
          description: 'Direction for degree centrality (default: both)',
        },
        topN: { type: 'number', description: 'Number of top entities to return (default: 10)' },
        dampingFactor: { type: 'number', description: 'Damping factor for PageRank (default: 0.85)' },
        approximate: {
          type: 'boolean',
          description: 'Use approximation for faster betweenness centrality (default: false)',
        },
        sampleRate: {
          type: 'number',
          description: 'Sample rate for approximation (0.0-1.0, default: 0.2)',
          minimum: 0.01,
          maximum: 1.0,
        },
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
    description: 'Export knowledge graph in various formats with optional brotli compression and streaming for large graphs',
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
        compress: {
          type: 'boolean',
          description: 'Compress output with brotli (auto-enabled for >100KB)',
          default: false,
        },
        compressionQuality: {
          type: 'number',
          description: 'Brotli quality level 0-11 (default: 6). Higher = better compression but slower.',
          minimum: 0,
          maximum: 11,
          default: 6,
        },
        streaming: {
          type: 'boolean',
          description: 'Use streaming mode to write directly to file (requires outputPath)',
          default: false,
        },
        outputPath: {
          type: 'string',
          description: 'File path for streaming export. Auto-enables streaming for graphs with >= 5000 entities.',
        },
      },
      required: ['format'],
      additionalProperties: false,
    },
  },

  // Phase 13: Conversation ingestion tool
  {
    name: 'ingest',
    description: 'Ingest pre-normalized conversation data into the knowledge graph. Chunks messages by exchange pairs (user+assistant), creates entities with verbatim observations. Format-agnostic: normalize chat exports before calling.',
    inputSchema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant', 'system'] },
              content: { type: 'string' },
              timestamp: { type: 'string', description: 'Optional ISO 8601 timestamp' },
            },
            required: ['role', 'content'],
          },
          description: 'Array of conversation messages to ingest',
        },
        source: { type: 'string', description: 'Source identifier (e.g., filename, session ID)' },
        projectId: { type: 'string', description: 'Project to scope ingested entities to' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags to apply to all created entities' },
        chunkBy: { type: 'string', enum: ['exchange', 'paragraph', 'fixed'], description: 'Chunking strategy. Default: exchange (user+assistant pairs).' },
        dryRun: { type: 'boolean', description: 'Preview without creating entities' },
      },
      required: ['messages'],
      additionalProperties: false,
    },
  },

  // ==================== SEMANTIC SEARCH TOOLS (Phase 4 Sprint 12) ====================
  {
    name: 'semantic_search',
    description: 'Search for entities using semantic similarity. Requires embedding provider to be configured via MEMORY_EMBEDDING_PROVIDER.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        limit: { type: 'number', description: 'Maximum number of results (default: 10, max: 100)' },
        minSimilarity: {
          type: 'number',
          description: 'Minimum similarity score threshold (0.0-1.0, default: 0)',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'find_similar_entities',
    description: 'Find entities similar to a given entity using semantic similarity. Requires embedding provider.',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Name of entity to find similar entities for' },
        limit: { type: 'number', description: 'Maximum number of results (default: 10, max: 100)' },
        minSimilarity: {
          type: 'number',
          description: 'Minimum similarity score threshold (0.0-1.0, default: 0)',
        },
      },
      required: ['entityName'],
      additionalProperties: false,
    },
  },
  {
    name: 'index_embeddings',
    description: 'Index all entities for semantic search. Call this after adding entities to enable semantic search. Requires embedding provider.',
    inputSchema: {
      type: 'object',
      properties: {
        forceReindex: {
          type: 'boolean',
          description: 'Force re-indexing of all entities even if already indexed (default: false)',
        },
      },
      additionalProperties: false,
    },
  },

  // ==================== REF INDEX ====================
  {
    name: 'register_ref',
    description: 'Register a stable alias (ref) pointing to an entity name in the RefIndex for O(1) lookups',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Stable alias string to register' },
        entityName: { type: 'string', description: 'Entity name this ref resolves to' },
        description: { type: 'string', description: 'Optional human-readable description of this ref' },
      },
      required: ['ref', 'entityName'],
      additionalProperties: false,
    },
  },
  {
    name: 'resolve_ref',
    description: 'Resolve a stable alias (ref) to its entity name via the RefIndex',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Alias string to resolve' },
      },
      required: ['ref'],
      additionalProperties: false,
    },
  },
  {
    name: 'deregister_ref',
    description: 'Remove a stable alias (ref) from the RefIndex',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Alias string to deregister' },
      },
      required: ['ref'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_refs',
    description: 'List all registered refs in the RefIndex, optionally filtered by entity name',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Optional: filter refs by entity name' },
      },
      additionalProperties: false,
    },
  },

  // ==================== ARTIFACT ====================
  {
    name: 'create_artifact',
    description: 'Create an artifact entity (tool output, code snippet, API response, etc.) with a stable auto-generated ref',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Artifact content stored as an entity observation' },
        toolName: { type: 'string', description: 'Name of the tool or source that produced this artifact' },
        artifactType: {
          type: 'string',
          enum: ['tool_output', 'code_snippet', 'api_response', 'search_result', 'file_content', 'user_input'],
          description: 'Category of artifact for structured filtering',
        },
        description: { type: 'string', description: 'Optional human-readable description' },
        sessionId: { type: 'string', description: 'Optional session context for grouping related artifacts' },
      },
      required: ['content', 'toolName', 'artifactType'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_artifact',
    description: 'Retrieve an artifact entity by its stable ref or entity name',
    inputSchema: {
      type: 'object',
      properties: {
        ref: { type: 'string', description: 'Stable ref or entity name (e.g. "bash-2026-03-24-a3f2")' },
      },
      required: ['ref'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_artifacts',
    description: 'List all artifact entities, with optional filtering by tool name, type, or date',
    inputSchema: {
      type: 'object',
      properties: {
        toolName: { type: 'string', description: 'Filter by originating tool name' },
        artifactType: {
          type: 'string',
          enum: ['tool_output', 'code_snippet', 'api_response', 'search_result', 'file_content', 'user_input'],
          description: 'Filter by artifact category',
        },
        since: { type: 'string', description: 'Only return artifacts created at or after this ISO 8601 date' },
      },
      additionalProperties: false,
    },
  },

  // ==================== TEMPORAL SEARCH ====================
  {
    name: 'search_by_time',
    description: 'Search entities using a natural language time expression (e.g. "last week", "yesterday", "in January")',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language time expression to parse and search' },
        field: {
          type: 'string',
          enum: ['createdAt', 'lastModified', 'any'],
          description: 'Which timestamp field to filter on (default: any)',
        },
        includeUndated: {
          type: 'boolean',
          description: 'If true, treat entities with no timestamps as matching (default: false)',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },

  // ==================== DISTILLATION ====================
  {
    name: 'configure_distillation',
    description: 'Configure the distillation pipeline policy (default, noop, or none) that filters memories before context formatting',
    inputSchema: {
      type: 'object',
      properties: {
        policy: {
          type: 'string',
          enum: ['default', 'noop', 'none'],
          description: 'Policy to apply: default (relevance+freshness+dedup), noop (pass-through), none (clear pipeline)',
        },
      },
      required: ['policy'],
      additionalProperties: false,
    },
  },

  // ==================== FRESHNESS ====================
  {
    name: 'check_freshness',
    description: 'Calculate the freshness score (0–1) for a specific entity based on its TTL and confidence',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Name of the entity to check freshness for' },
      },
      required: ['entityName'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_stale_entities',
    description: 'Return all entities whose freshness score is below a threshold',
    inputSchema: {
      type: 'object',
      properties: {
        threshold: {
          type: 'number',
          description: 'Freshness threshold (0–1). Entities below this score are considered stale (default: 0.5)',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_expired_entities',
    description: 'Return all entities that have passed their TTL expiry',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'refresh_entity',
    description: 'Reset freshness for an entity by updating its creation timestamp to now and resetting confidence to 1.0',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Name of the entity to refresh' },
      },
      required: ['entityName'],
      additionalProperties: false,
    },
  },
  {
    name: 'freshness_report',
    description: 'Generate a freshness report across all entities showing fresh, stale, and expired counts',
    inputSchema: {
      type: 'object',
      properties: {
        threshold: {
          type: 'number',
          description: 'Freshness threshold for fresh/stale categorisation (default: 0.5)',
        },
      },
      additionalProperties: false,
    },
  },

  // ==================== LLM QUERY PLANNER ====================
  {
    name: 'query_natural_language',
    description: 'Decompose a natural language query into a structured search plan and return matching entities',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language query to plan and execute' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },

  // ==================== GOVERNANCE ====================
  {
    name: 'set_governance_policy',
    description: 'Set the active governance policy controlling which write operations (create, update, delete) are permitted for future requests',
    inputSchema: {
      type: 'object',
      properties: {
        canCreate: { type: 'boolean', description: 'Whether entity creation is allowed (default: true)' },
        canUpdate: { type: 'boolean', description: 'Whether entity updates are allowed (default: true)' },
        canDelete: { type: 'boolean', description: 'Whether entity deletion is allowed (default: true)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'audit_query',
    description: 'Query the audit log for operations matching filter criteria (operation type, agent ID, entity name, date range)',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['create', 'update', 'delete', 'merge', 'archive'],
          description: 'Filter by operation type',
        },
        agentId: { type: 'string', description: 'Filter by agent identifier' },
        entityName: { type: 'string', description: 'Filter by entity name' },
        since: { type: 'string', description: 'Only entries at or after this ISO 8601 timestamp' },
        until: { type: 'string', description: 'Only entries at or before this ISO 8601 timestamp' },
        limit: { type: 'number', description: 'Maximum number of results to return (default: 50)' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'audit_history',
    description: 'Get the full audit history for a specific entity in chronological order',
    inputSchema: {
      type: 'object',
      properties: {
        entityName: { type: 'string', description: 'Name of the entity to retrieve audit history for' },
      },
      required: ['entityName'],
      additionalProperties: false,
    },
  },
  {
    name: 'rollback_operation',
    description: 'Reverse a specific committed operation using its audit entry ID (restores entity to before-snapshot)',
    inputSchema: {
      type: 'object',
      properties: {
        auditEntryId: { type: 'string', description: 'ID of the audit entry to reverse' },
      },
      required: ['auditEntryId'],
      additionalProperties: false,
    },
  },

  // ==================== ROLE PROFILES ====================
  {
    name: 'set_agent_role',
    description: 'Apply a built-in role profile (researcher, planner, executor, reviewer, coordinator) to adjust salience weights and context budgets',
    inputSchema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: ['researcher', 'planner', 'executor', 'reviewer', 'default'],
          description: 'Role to apply to the agent memory system',
        },
      },
      required: ['role'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_role_profiles',
    description: 'List all built-in role profiles with their salience weight and context budget configurations',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },

  // ==================== ENTROPY FILTER ====================
  {
    name: 'enable_entropy_filter',
    description: 'Enable or disable the Shannon entropy gate that drops low-information memories during consolidation',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', description: 'Whether to enable the entropy filter' },
        minEntropy: {
          type: 'number',
          description: 'Minimum entropy threshold in bits (default: 1.5). Higher = stricter filtering.',
        },
        minLength: {
          type: 'number',
          description: 'Minimum text length before entropy is evaluated (default: 10)',
        },
      },
      required: ['enabled'],
      additionalProperties: false,
    },
  },
  {
    name: 'compute_entropy',
    description: 'Compute the Shannon entropy of a text string (in bits per character)',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to compute entropy for' },
        minEntropy: {
          type: 'number',
          description: 'Optional: check if text passes this minimum entropy threshold',
        },
      },
      required: ['text'],
      additionalProperties: false,
    },
  },

  // ==================== CONSOLIDATION ====================
  {
    name: 'start_consolidation',
    description: 'Start the background consolidation scheduler that periodically deduplicates and merges memories',
    inputSchema: {
      type: 'object',
      properties: {
        intervalMs: {
          type: 'number',
          description: 'Interval between consolidation runs in milliseconds (default: 3600000 = 1 hour)',
        },
        autoMergeDuplicates: {
          type: 'boolean',
          description: 'Enable duplicate detection and merge after each consolidation (default: false)',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'stop_consolidation',
    description: 'Stop the background consolidation scheduler',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'run_consolidation_now',
    description: 'Run a consolidation cycle on demand, independently of the scheduled interval',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },

  // ==================== MEMORY FORMATTER ====================
  {
    name: 'format_with_salience_budget',
    description: 'Format memories for LLM prompt consumption with proportional token allocation based on salience scores',
    inputSchema: {
      type: 'object',
      properties: {
        entityNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of entities (memories) to format',
        },
        salienceScores: {
          type: 'object',
          additionalProperties: { type: 'number' },
          description: 'Map of entityName → salience score (0–1) for proportional allocation',
        },
        totalTokenBudget: {
          type: 'number',
          description: 'Maximum total token budget for the formatted output',
        },
        header: { type: 'string', description: 'Optional header text to prepend' },
        separator: { type: 'string', description: 'Optional separator between memories (default: newline)' },
      },
      required: ['entityNames', 'salienceScores', 'totalTokenBudget'],
      additionalProperties: false,
    },
  },

  // ==================== COLLABORATIVE SYNTHESIS ====================
  {
    name: 'synthesize_collaborative_context',
    description: 'Synthesize context by traversing the graph neighbourhood from a seed entity and merging high-salience neighbors across agents',
    inputSchema: {
      type: 'object',
      properties: {
        seedEntityName: { type: 'string', description: 'Name of the entity to start traversal from' },
        maxDepth: { type: 'number', description: 'Maximum BFS depth to traverse from seed (default: 2)' },
        minNeighborSalience: {
          type: 'number',
          description: 'Minimum salience score for a neighbor to be included (default: 0.3)',
        },
        maxNeighbors: { type: 'number', description: 'Maximum number of neighbor entities to include (default: 20)' },
        queryText: { type: 'string', description: 'Optional query text for salience context scoring' },
        currentTask: { type: 'string', description: 'Optional current task identifier for salience context' },
      },
      required: ['seedEntityName'],
      additionalProperties: false,
    },
  },

  // ==================== FAILURE DISTILLATION ====================
  {
    name: 'distill_failure',
    description: 'Distill lessons from a failed session by tracing the causal chain and extracting actionable insights',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'ID of the failed session to analyze' },
        minLessonConfidence: {
          type: 'number',
          description: 'Minimum confidence required for a lesson to be persisted (default: 0.6)',
        },
        maxCauseChainLength: {
          type: 'number',
          description: 'Maximum depth to follow causal chains (default: 5)',
        },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
  },
  {
    name: 'end_session',
    description: 'End a session and trigger failure distillation if the session outcome was a failure',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'ID of the session to end' },
        outcome: {
          type: 'string',
          enum: ['success', 'failure', 'partial'],
          description: 'Outcome of the session',
        },
        distillFailures: {
          type: 'boolean',
          description: 'Whether to automatically distill lessons on failure outcome (default: true)',
        },
      },
      required: ['sessionId', 'outcome'],
      additionalProperties: false,
    },
  },

  // Phase 13: User profile + agent diary tools
  {
    name: 'get_profile',
    description: 'Get the user profile. Returns static facts (long-lived preferences) and dynamic facts (recent session context). Profiles are scoped by projectId.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Optional project scope. Omit for global profile.' },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'update_profile',
    description: 'Add a fact to the user profile. Static facts are long-lived (preferences, role, tools). Dynamic facts are recent (current project, active work).',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The fact to add' },
        type: { type: 'string', enum: ['static', 'dynamic'], description: 'Fact type: static (long-lived) or dynamic (recent)' },
        projectId: { type: 'string', description: 'Optional project scope' },
      },
      required: ['content', 'type'],
      additionalProperties: false,
    },
  },
  {
    name: 'diary_write',
    description: 'Write a timestamped diary entry for a specialist agent. Each agent gets its own persistent diary (entity: diary-{agentId}). Use for code review findings, architecture decisions, ops incidents, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent identifier (e.g., reviewer, architect, ops). Alphanumeric + hyphens/underscores only.' },
        entry: { type: 'string', description: 'The diary entry content' },
        topic: { type: 'string', description: 'Optional topic tag for filtering (e.g., security, performance)' },
      },
      required: ['agentId', 'entry'],
      additionalProperties: false,
    },
  },
  {
    name: 'diary_read',
    description: 'Read recent diary entries for a specialist agent. Returns entries in reverse chronological order. Optionally filter by topic.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'string', description: 'Agent identifier' },
        lastN: { type: 'number', description: 'Number of recent entries to return. Default: 10.' },
        topic: { type: 'string', description: 'Optional topic filter' },
      },
      required: ['agentId'],
      additionalProperties: false,
    },
  },

  // ==================== COGNITIVE LOAD ====================
  {
    name: 'analyze_cognitive_load',
    description: 'Analyze the cognitive load of a set of entities: token density, redundancy ratio, diversity score, and composite load score',
    inputSchema: {
      type: 'object',
      properties: {
        entityNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of entities to analyze',
        },
        loadThreshold: {
          type: 'number',
          description: 'Load score threshold above which context is considered overloaded (default: 0.7)',
        },
      },
      required: ['entityNames'],
      additionalProperties: false,
    },
  },
  {
    name: 'adaptive_reduce_memories',
    description: 'Adaptively reduce a set of memories until their cognitive load falls below the configured threshold by removing low-salience redundant memories',
    inputSchema: {
      type: 'object',
      properties: {
        entityNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'Names of entities to reduce',
        },
        salienceScores: {
          type: 'object',
          additionalProperties: { type: 'number' },
          description: 'Map of entityName → salience score (0–1) for prioritizing removal',
        },
        loadThreshold: {
          type: 'number',
          description: 'Target load threshold to reduce below (default: 0.7)',
        },
      },
      required: ['entityNames', 'salienceScores'],
      additionalProperties: false,
    },
  },

  // ==================== DREAM ENGINE TOOLS ====================
  {
    name: 'dream_start',
    description: 'Start the DreamEngine background memory maintenance. Runs 8 phases (temporal anchoring, freshness sweep, entropy pruning, consolidation, compression, entity enrichment, pattern promotion, graph hygiene) on a configurable interval.',
    inputSchema: {
      type: 'object',
      properties: {
        intervalMs: {
          type: 'number',
          description: 'Interval between dream cycles in milliseconds (default: 14400000 = 4 hours)',
        },
        runOnSessionEnd: {
          type: 'boolean',
          description: 'Run a dream cycle automatically when endSession() is called (default: true)',
        },
        maxDurationMs: {
          type: 'number',
          description: 'Hard limit on total cycle wall-clock time in milliseconds (default: 60000 = 60s)',
        },
        phases: {
          type: 'object',
          description: 'Per-phase enable/disable flags',
          properties: {
            temporalAnchoring: { type: 'boolean', description: 'Phase 1: Resolve relative date references to absolute ISO timestamps' },
            freshnessSweep: { type: 'boolean', description: 'Phase 2: Flag stale entities, decay confidence, expire TTL records' },
            entropyPruning: { type: 'boolean', description: 'Phase 3: Remove observations whose Shannon entropy is below threshold' },
            consolidation: { type: 'boolean', description: 'Phase 4: Merge working-memory items into long-term storage' },
            compression: { type: 'boolean', description: 'Phase 5: Deduplicate near-identical entities above similarity threshold' },
            entityEnrichment: { type: 'boolean', description: 'Phase 6: Auto-generate summary observations for entity enrichment' },
            patternPromotion: { type: 'boolean', description: 'Phase 7: Detect recurring observation themes and promote to semantic memory' },
            graphHygiene: { type: 'boolean', description: 'Phase 8: Orphan detection and dangling-relation cleanup' },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'dream_stop',
    description: 'Stop the DreamEngine background process.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'dream_run_now',
    description: 'Run a single dream cycle immediately. Returns detailed per-phase results.',
    inputSchema: {
      type: 'object',
      properties: {
        phases: {
          type: 'object',
          description: 'Per-phase enable/disable flags for this cycle',
          properties: {
            temporalAnchoring: { type: 'boolean', description: 'Phase 1: Resolve relative date references to absolute ISO timestamps' },
            freshnessSweep: { type: 'boolean', description: 'Phase 2: Flag stale entities, decay confidence, expire TTL records' },
            entropyPruning: { type: 'boolean', description: 'Phase 3: Remove observations whose Shannon entropy is below threshold' },
            consolidation: { type: 'boolean', description: 'Phase 4: Merge working-memory items into long-term storage' },
            compression: { type: 'boolean', description: 'Phase 5: Deduplicate near-identical entities above similarity threshold' },
            entityEnrichment: { type: 'boolean', description: 'Phase 6: Auto-generate summary observations for entity enrichment' },
            patternPromotion: { type: 'boolean', description: 'Phase 7: Detect recurring observation themes and promote to semantic memory' },
            graphHygiene: { type: 'boolean', description: 'Phase 8: Orphan detection and dangling-relation cleanup' },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },

  // Phase 13: Config tool
  // TODO: set_project_scope requires server state management (activeProjectId on MCPServer)
  // Skipped in this pass — implement when MCPServer exposes mutable server state to handlers.
];

// Tool categories are documented in CLAUDE.md for reference:
// - Entity Operations: create_entities, delete_entities, read_graph, open_nodes
// - Relation Operations: create_relations, delete_relations
// - Observation Management: add_observations, delete_observations
// - Search: search_nodes, search_by_date_range, search_nodes_ranked, boolean_search, fuzzy_search, get_search_suggestions, search_auto
// - Semantic Search: semantic_search, find_similar_entities, index_embeddings
// - Saved Searches: save_search, execute_saved_search, list_saved_searches, delete_saved_search, update_saved_search
// - Tag Management: add_tags, remove_tags, set_importance, add_tags_to_multiple_entities, replace_tag, merge_tags
// - Tag Aliases: add_tag_alias, list_tag_aliases, remove_tag_alias, get_aliases_for_tag, resolve_tag
// - Hierarchy: set_entity_parent, get_children, get_parent, get_ancestors, get_descendants, get_subtree, get_root_entities, get_entity_depth, move_entity
// - Graph Algorithms: find_shortest_path, find_all_paths, get_connected_components, get_centrality
// - Analytics: get_graph_stats, validate_graph
// - Compression: find_duplicates, merge_entities, compress_graph, archive_entities
// - Import/Export: import_graph, export_graph
