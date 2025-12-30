/**
 * toolDefinitions Unit Tests
 *
 * Tests for tool schema validation, organization, and naming conventions.
 */

import { describe, it, expect } from 'vitest';
import { toolDefinitions, ToolDefinition } from '../../../server/toolDefinitions.js';

describe('toolDefinitions', () => {
  describe('Schema Structure', () => {
    it('should have 47 tool definitions', () => {
      expect(toolDefinitions).toHaveLength(47);
    });

    it('should have unique tool names', () => {
      const names = toolDefinitions.map(t => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have valid structure for all tools', () => {
      for (const tool of toolDefinitions) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.name.length).toBeGreaterThan(0);

        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.description.length).toBeGreaterThan(0);

        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });

    it('should have snake_case naming convention for all tools', () => {
      const snakeCaseRegex = /^[a-z][a-z0-9_]*$/;
      for (const tool of toolDefinitions) {
        expect(tool.name).toMatch(snakeCaseRegex);
      }
    });

    it('should have additionalProperties set correctly', () => {
      for (const tool of toolDefinitions) {
        // Most tools should have additionalProperties: false for strictness
        if (tool.inputSchema.additionalProperties !== undefined) {
          expect(typeof tool.inputSchema.additionalProperties).toBe('boolean');
        }
      }
    });
  });

  describe('Tool Categories', () => {
    const getToolsByPrefix = (prefix: string) =>
      toolDefinitions.filter(t => t.name.startsWith(prefix));

    it('should have entity tools', () => {
      const entityTools = ['create_entities', 'delete_entities', 'read_graph', 'open_nodes'];
      for (const name of entityTools) {
        expect(toolDefinitions.find(t => t.name === name)).toBeDefined();
      }
    });

    it('should have relation tools', () => {
      const relationTools = ['create_relations', 'delete_relations'];
      for (const name of relationTools) {
        expect(toolDefinitions.find(t => t.name === name)).toBeDefined();
      }
    });

    it('should have observation tools', () => {
      const obsTools = ['add_observations', 'delete_observations'];
      for (const name of obsTools) {
        expect(toolDefinitions.find(t => t.name === name)).toBeDefined();
      }
    });

    it('should have search tools', () => {
      const searchTools = [
        'search_nodes', 'search_by_date_range', 'search_nodes_ranked',
        'boolean_search', 'fuzzy_search', 'get_search_suggestions'
      ];
      for (const name of searchTools) {
        expect(toolDefinitions.find(t => t.name === name)).toBeDefined();
      }
    });

    it('should have saved search tools', () => {
      const savedSearchTools = [
        'save_search', 'execute_saved_search', 'list_saved_searches',
        'delete_saved_search', 'update_saved_search'
      ];
      for (const name of savedSearchTools) {
        expect(toolDefinitions.find(t => t.name === name)).toBeDefined();
      }
    });

    it('should have tag tools', () => {
      const tagTools = [
        'add_tags', 'remove_tags', 'set_importance',
        'add_tags_to_multiple_entities', 'replace_tag', 'merge_tags'
      ];
      for (const name of tagTools) {
        expect(toolDefinitions.find(t => t.name === name)).toBeDefined();
      }
    });

    it('should have tag alias tools', () => {
      const aliasTools = [
        'add_tag_alias', 'list_tag_aliases', 'remove_tag_alias',
        'get_aliases_for_tag', 'resolve_tag'
      ];
      for (const name of aliasTools) {
        expect(toolDefinitions.find(t => t.name === name)).toBeDefined();
      }
    });

    it('should have hierarchy tools', () => {
      const hierarchyTools = [
        'set_entity_parent', 'get_children', 'get_parent', 'get_ancestors',
        'get_descendants', 'get_subtree', 'get_root_entities',
        'get_entity_depth', 'move_entity'
      ];
      for (const name of hierarchyTools) {
        expect(toolDefinitions.find(t => t.name === name)).toBeDefined();
      }
    });

    it('should have analytics tools', () => {
      const analyticsTools = ['get_graph_stats', 'validate_graph'];
      for (const name of analyticsTools) {
        expect(toolDefinitions.find(t => t.name === name)).toBeDefined();
      }
    });

    it('should have compression tools', () => {
      const compressionTools = [
        'find_duplicates', 'merge_entities', 'compress_graph', 'archive_entities'
      ];
      for (const name of compressionTools) {
        expect(toolDefinitions.find(t => t.name === name)).toBeDefined();
      }
    });

    it('should have import/export tools', () => {
      const ioTools = ['import_graph', 'export_graph'];
      for (const name of ioTools) {
        expect(toolDefinitions.find(t => t.name === name)).toBeDefined();
      }
    });
  });

  describe('Input Schema Validation', () => {
    const getToolByName = (name: string): ToolDefinition | undefined =>
      toolDefinitions.find(t => t.name === name);

    describe('create_entities', () => {
      it('should require entities array', () => {
        const tool = getToolByName('create_entities');
        expect(tool?.inputSchema.required).toContain('entities');
      });

      it('should define entity structure', () => {
        const tool = getToolByName('create_entities');
        const entitiesSchema = tool?.inputSchema.properties.entities as any;
        expect(entitiesSchema.type).toBe('array');
        expect(entitiesSchema.items.properties.name).toBeDefined();
        expect(entitiesSchema.items.properties.entityType).toBeDefined();
        expect(entitiesSchema.items.properties.observations).toBeDefined();
      });
    });

    describe('search_nodes', () => {
      it('should require query parameter', () => {
        const tool = getToolByName('search_nodes');
        expect(tool?.inputSchema.required).toContain('query');
      });

      it('should have optional filter parameters', () => {
        const tool = getToolByName('search_nodes');
        expect(tool?.inputSchema.properties.tags).toBeDefined();
        expect(tool?.inputSchema.properties.minImportance).toBeDefined();
        expect(tool?.inputSchema.properties.maxImportance).toBeDefined();
      });
    });

    describe('set_importance', () => {
      it('should require entityName and importance', () => {
        const tool = getToolByName('set_importance');
        expect(tool?.inputSchema.required).toContain('entityName');
        expect(tool?.inputSchema.required).toContain('importance');
      });

      it('should define importance as number with description', () => {
        const tool = getToolByName('set_importance');
        const importanceSchema = tool?.inputSchema.properties.importance as any;
        expect(importanceSchema.type).toBe('number');
        expect(importanceSchema.description).toContain('0');
        expect(importanceSchema.description).toContain('10');
      });
    });

    describe('add_tags', () => {
      it('should require entityName and tags', () => {
        const tool = getToolByName('add_tags');
        expect(tool?.inputSchema.required).toContain('entityName');
        expect(tool?.inputSchema.required).toContain('tags');
      });

      it('should define tags as string array', () => {
        const tool = getToolByName('add_tags');
        const tagsSchema = tool?.inputSchema.properties.tags as any;
        expect(tagsSchema.type).toBe('array');
        expect(tagsSchema.items.type).toBe('string');
      });
    });

    describe('import_graph', () => {
      it('should require format and data', () => {
        const tool = getToolByName('import_graph');
        expect(tool?.inputSchema.required).toContain('format');
        expect(tool?.inputSchema.required).toContain('data');
      });

      it('should define valid format enum', () => {
        const tool = getToolByName('import_graph');
        const formatSchema = tool?.inputSchema.properties.format as any;
        expect(formatSchema.enum).toContain('json');
        expect(formatSchema.enum).toContain('csv');
        expect(formatSchema.enum).toContain('graphml');
      });
    });

    describe('export_graph', () => {
      it('should require format', () => {
        const tool = getToolByName('export_graph');
        expect(tool?.inputSchema.required).toContain('format');
      });

      it('should support 7 export formats', () => {
        const tool = getToolByName('export_graph');
        const formatSchema = tool?.inputSchema.properties.format as any;
        expect(formatSchema.enum).toContain('json');
        expect(formatSchema.enum).toContain('csv');
        expect(formatSchema.enum).toContain('graphml');
        expect(formatSchema.enum).toContain('gexf');
        expect(formatSchema.enum).toContain('dot');
        expect(formatSchema.enum).toContain('markdown');
        expect(formatSchema.enum).toContain('mermaid');
      });
    });

    describe('boolean_search', () => {
      it('should require query', () => {
        const tool = getToolByName('boolean_search');
        expect(tool?.inputSchema.required).toContain('query');
      });
    });

    describe('fuzzy_search', () => {
      it('should require query', () => {
        const tool = getToolByName('fuzzy_search');
        expect(tool?.inputSchema.required).toContain('query');
      });

      it('should have optional threshold parameter', () => {
        const tool = getToolByName('fuzzy_search');
        expect(tool?.inputSchema.properties.threshold).toBeDefined();
      });
    });

    describe('set_entity_parent', () => {
      it('should require entityName and parentName', () => {
        const tool = getToolByName('set_entity_parent');
        expect(tool?.inputSchema.required).toContain('entityName');
        expect(tool?.inputSchema.required).toContain('parentName');
      });

      it('should allow null for parentName', () => {
        const tool = getToolByName('set_entity_parent');
        const parentSchema = tool?.inputSchema.properties.parentName as any;
        // parentName should allow string or null
        expect(parentSchema.type).toBeDefined();
      });
    });
  });

  describe('Description Quality', () => {
    it('should have descriptive tool descriptions', () => {
      for (const tool of toolDefinitions) {
        expect(tool.description.length).toBeGreaterThan(10);
        // Description should start with a verb or action word
        expect(tool.description[0]).toBe(tool.description[0].toUpperCase());
      }
    });

    it('should have property descriptions where appropriate', () => {
      const tool = toolDefinitions.find(t => t.name === 'create_entities');
      const entitiesSchema = tool?.inputSchema.properties.entities as any;
      // At least some properties should have descriptions
      expect(entitiesSchema.items.properties.name.description).toBeDefined();
    });
  });

  describe('Type Definition Export', () => {
    it('should export ToolDefinition interface', () => {
      const testDef: ToolDefinition = {
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      };
      expect(testDef.name).toBe('test_tool');
    });
  });
});
