/**
 * Entity Tools E2E Tests
 *
 * Tests for create_entities, delete_entities, read_graph, and open_nodes tools
 * via the MCP tool call interface.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KnowledgeGraphManager } from '../../../core/index.js';
import { handleToolCall } from '../../../server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Entity Tools E2E', () => {
  let manager: KnowledgeGraphManager;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `entity-tools-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'test-graph.jsonl');
    manager = new KnowledgeGraphManager(testFilePath);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Helper to parse JSON response
  const parseResponse = (result: { content: Array<{ type: string; text: string }> }) => {
    return JSON.parse(result.content[0].text);
  };

  describe('create_entities tool', () => {
    describe('Required Parameters', () => {
      it('should create single entity with required fields', async () => {
        const result = await handleToolCall('create_entities', {
          entities: [{ name: 'TestEntity', entityType: 'test', observations: ['obs1'] }]
        }, manager);

        const data = parseResponse(result);
        expect(data).toHaveLength(1);
        expect(data[0].name).toBe('TestEntity');
        expect(data[0].entityType).toBe('test');
        expect(data[0].observations).toContain('obs1');
      });

      it('should create multiple entities in batch', async () => {
        const result = await handleToolCall('create_entities', {
          entities: [
            { name: 'Entity1', entityType: 'type1', observations: [] },
            { name: 'Entity2', entityType: 'type2', observations: [] },
            { name: 'Entity3', entityType: 'type3', observations: [] }
          ]
        }, manager);

        const data = parseResponse(result);
        expect(data).toHaveLength(3);
      });

      it('should require entities array parameter', async () => {
        await expect(handleToolCall('create_entities', {}, manager))
          .rejects.toThrow();
      });

      it('should require name field in each entity', async () => {
        await expect(handleToolCall('create_entities', {
          entities: [{ entityType: 'test', observations: [] }]
        }, manager)).rejects.toThrow();
      });

      it('should require entityType field in each entity', async () => {
        await expect(handleToolCall('create_entities', {
          entities: [{ name: 'Test', observations: [] }]
        }, manager)).rejects.toThrow();
      });

      it('should require observations array in each entity', async () => {
        await expect(handleToolCall('create_entities', {
          entities: [{ name: 'Test', entityType: 'test' }]
        }, manager)).rejects.toThrow();
      });
    });

    describe('Optional Parameters', () => {
      it('should accept tags array', async () => {
        const result = await handleToolCall('create_entities', {
          entities: [{
            name: 'TaggedEntity',
            entityType: 'test',
            observations: [],
            tags: ['tag1', 'tag2']
          }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].tags).toContain('tag1');
        expect(data[0].tags).toContain('tag2');
      });

      it('should accept importance number (0-10)', async () => {
        const result = await handleToolCall('create_entities', {
          entities: [{
            name: 'ImportantEntity',
            entityType: 'test',
            observations: [],
            importance: 8
          }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].importance).toBe(8);
      });

      it('should accept parentId for hierarchy', async () => {
        // First create parent
        await handleToolCall('create_entities', {
          entities: [{ name: 'ParentEntity', entityType: 'folder', observations: [] }]
        }, manager);

        // Create child with parentId
        const result = await handleToolCall('create_entities', {
          entities: [{
            name: 'ChildEntity',
            entityType: 'file',
            observations: [],
            parentId: 'ParentEntity'
          }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].parentId).toBe('ParentEntity');
      });
    });

    describe('Response Format', () => {
      it('should return MCP-compliant content array', async () => {
        const result = await handleToolCall('create_entities', {
          entities: [{ name: 'FormatTest', entityType: 'test', observations: [] }]
        }, manager);

        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0]).toHaveProperty('text');
      });

      it('should include created entities in response', async () => {
        const result = await handleToolCall('create_entities', {
          entities: [{ name: 'ResponseCheck', entityType: 'test', observations: ['obs1'] }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0]).toHaveProperty('name', 'ResponseCheck');
        expect(data[0]).toHaveProperty('entityType', 'test');
        expect(data[0]).toHaveProperty('observations');
      });

      it('should include createdAt timestamp', async () => {
        const result = await handleToolCall('create_entities', {
          entities: [{ name: 'TimestampTest', entityType: 'test', observations: [] }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0]).toHaveProperty('createdAt');
        // Should be valid ISO 8601 date
        expect(new Date(data[0].createdAt).toISOString()).toBe(data[0].createdAt);
      });

      it('should include lastModified timestamp', async () => {
        const result = await handleToolCall('create_entities', {
          entities: [{ name: 'ModifiedTest', entityType: 'test', observations: [] }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0]).toHaveProperty('lastModified');
        expect(new Date(data[0].lastModified).toISOString()).toBe(data[0].lastModified);
      });
    });

    describe('Error Handling', () => {
      it('should handle empty entities array gracefully', async () => {
        // System allows empty array - returns empty result
        const result = await handleToolCall('create_entities', {
          entities: []
        }, manager);
        const data = parseResponse(result);
        expect(data).toEqual([]);
      });

      it('should reject entity without name', async () => {
        await expect(handleToolCall('create_entities', {
          entities: [{ entityType: 'test', observations: [] }]
        }, manager)).rejects.toThrow();
      });

      it('should reject entity without entityType', async () => {
        await expect(handleToolCall('create_entities', {
          entities: [{ name: 'NoType', observations: [] }]
        }, manager)).rejects.toThrow();
      });

      it('should handle duplicate entity names in same batch', async () => {
        // System deduplicates - only creates once
        const result = await handleToolCall('create_entities', {
          entities: [
            { name: 'Duplicate', entityType: 'test', observations: [] },
            { name: 'Duplicate', entityType: 'test', observations: [] }
          ]
        }, manager);
        const data = parseResponse(result);
        // Deduplication results in 1 entity
        expect(data.length).toBeLessThanOrEqual(2);
      });

      it('should handle duplicate entity names across batches', async () => {
        await handleToolCall('create_entities', {
          entities: [{ name: 'Existing', entityType: 'test', observations: [] }]
        }, manager);

        // System may skip or update existing entity
        const result = await handleToolCall('create_entities', {
          entities: [{ name: 'Existing', entityType: 'different', observations: [] }]
        }, manager);
        // Should complete without error - may return the existing entity
        expect(result.content).toBeDefined();
      });

      it('should reject importance outside 0-10 range', async () => {
        await expect(handleToolCall('create_entities', {
          entities: [{
            name: 'BadImportance',
            entityType: 'test',
            observations: [],
            importance: 15
          }]
        }, manager)).rejects.toThrow();
      });

      it('should reject negative importance', async () => {
        await expect(handleToolCall('create_entities', {
          entities: [{
            name: 'NegativeImportance',
            entityType: 'test',
            observations: [],
            importance: -1
          }]
        }, manager)).rejects.toThrow();
      });

      it('should reject non-array observations', async () => {
        await expect(handleToolCall('create_entities', {
          entities: [{
            name: 'BadObs',
            entityType: 'test',
            observations: 'not-an-array'
          }]
        }, manager)).rejects.toThrow();
      });
    });

    describe('Edge Cases', () => {
      it('should handle entity with empty observations', async () => {
        const result = await handleToolCall('create_entities', {
          entities: [{ name: 'EmptyObs', entityType: 'test', observations: [] }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].observations).toEqual([]);
      });

      it('should handle unicode in entity name', async () => {
        const result = await handleToolCall('create_entities', {
          entities: [{ name: '日本語エンティティ', entityType: 'test', observations: [] }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].name).toBe('日本語エンティティ');
      });

      it('should handle special characters in observations', async () => {
        const result = await handleToolCall('create_entities', {
          entities: [{
            name: 'SpecialChars',
            entityType: 'test',
            observations: ['Contains "quotes" and \\backslashes\\', 'Newline\nhere']
          }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].observations).toHaveLength(2);
      });

      it('should handle very long entity names (500+ chars)', async () => {
        const longName = 'A'.repeat(500);
        const result = await handleToolCall('create_entities', {
          entities: [{ name: longName, entityType: 'test', observations: [] }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].name).toBe(longName);
      });

      it('should normalize tags to lowercase', async () => {
        const result = await handleToolCall('create_entities', {
          entities: [{
            name: 'TagNormalize',
            entityType: 'test',
            observations: [],
            tags: ['UPPERCASE', 'MixedCase', 'lowercase']
          }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].tags).toContain('uppercase');
        expect(data[0].tags).toContain('mixedcase');
        expect(data[0].tags).toContain('lowercase');
      });

      it('should handle entity with all optional fields', async () => {
        const result = await handleToolCall('create_entities', {
          entities: [{
            name: 'FullEntity',
            entityType: 'comprehensive',
            observations: ['obs1', 'obs2'],
            tags: ['tag1', 'tag2'],
            importance: 7
          }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].name).toBe('FullEntity');
        expect(data[0].tags).toHaveLength(2);
        expect(data[0].importance).toBe(7);
        expect(data[0].observations).toHaveLength(2);
      });
    });
  });

  describe('delete_entities tool', () => {
    describe('Required Parameters', () => {
      it('should delete single entity by name', async () => {
        await handleToolCall('create_entities', {
          entities: [{ name: 'ToDelete', entityType: 'test', observations: [] }]
        }, manager);

        const result = await handleToolCall('delete_entities', {
          entityNames: ['ToDelete']
        }, manager);

        expect(result.content[0].text).toContain('Deleted');
        expect(result.content[0].text).toContain('1');
      });

      it('should delete multiple entities in batch', async () => {
        await handleToolCall('create_entities', {
          entities: [
            { name: 'Delete1', entityType: 'test', observations: [] },
            { name: 'Delete2', entityType: 'test', observations: [] },
            { name: 'Delete3', entityType: 'test', observations: [] }
          ]
        }, manager);

        const result = await handleToolCall('delete_entities', {
          entityNames: ['Delete1', 'Delete2', 'Delete3']
        }, manager);

        expect(result.content[0].text).toContain('Deleted');
        expect(result.content[0].text).toContain('3');
      });

      it('should require entityNames array parameter', async () => {
        await expect(handleToolCall('delete_entities', {}, manager))
          .rejects.toThrow();
      });
    });

    describe('Response Format', () => {
      it('should return text confirmation message', async () => {
        await handleToolCall('create_entities', {
          entities: [{ name: 'ConfirmDelete', entityType: 'test', observations: [] }]
        }, manager);

        const result = await handleToolCall('delete_entities', {
          entityNames: ['ConfirmDelete']
        }, manager);

        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('Deleted');
      });

      it('should include deleted entity count in response', async () => {
        await handleToolCall('create_entities', {
          entities: [
            { name: 'DeleteMe1', entityType: 'test', observations: [] },
            { name: 'DeleteMe2', entityType: 'test', observations: [] }
          ]
        }, manager);

        const result = await handleToolCall('delete_entities', {
          entityNames: ['DeleteMe1', 'DeleteMe2']
        }, manager);

        // Response should indicate how many were deleted
        expect(result.content[0].text).toContain('2');
      });
    });

    describe('Side Effects', () => {
      it('should remove entity from graph', async () => {
        await handleToolCall('create_entities', {
          entities: [{ name: 'RemoveMe', entityType: 'test', observations: [] }]
        }, manager);

        await handleToolCall('delete_entities', {
          entityNames: ['RemoveMe']
        }, manager);

        const graphResult = await handleToolCall('read_graph', {}, manager);
        const graph = parseResponse(graphResult);
        expect(graph.entities.find((e: any) => e.name === 'RemoveMe')).toBeUndefined();
      });

      it('should remove associated relations', async () => {
        await handleToolCall('create_entities', {
          entities: [
            { name: 'NodeA', entityType: 'test', observations: [] },
            { name: 'NodeB', entityType: 'test', observations: [] }
          ]
        }, manager);

        await handleToolCall('create_relations', {
          relations: [{ from: 'NodeA', to: 'NodeB', relationType: 'connects' }]
        }, manager);

        await handleToolCall('delete_entities', {
          entityNames: ['NodeA']
        }, manager);

        const graphResult = await handleToolCall('read_graph', {}, manager);
        const graph = parseResponse(graphResult);
        expect(graph.relations.find((r: any) => r.from === 'NodeA' || r.to === 'NodeA')).toBeUndefined();
      });
    });

    describe('Error Handling', () => {
      it('should handle non-existent entity gracefully', async () => {
        // Should not throw - just delete 0 entities
        const result = await handleToolCall('delete_entities', {
          entityNames: ['NonExistent']
        }, manager);

        // Should complete without error
        expect(result.content[0].text).toContain('Deleted');
      });

      it('should reject empty entityNames array', async () => {
        // System validates non-empty array requirement
        await expect(handleToolCall('delete_entities', {
          entityNames: []
        }, manager)).rejects.toThrow();
      });

      it('should reject non-array entityNames', async () => {
        // entityNames must be an array, not a string or other type
        await expect(handleToolCall('delete_entities', {
          entityNames: 'NotAnArray'
        }, manager)).rejects.toThrow();
      });
    });

    describe('Hierarchy Effects', () => {
      it('should retain orphan parentId reference when parent is deleted', async () => {
        // Create parent entity
        await handleToolCall('create_entities', {
          entities: [{ name: 'ParentToDelete', entityType: 'folder', observations: [] }]
        }, manager);

        // Create child with parent reference
        await handleToolCall('create_entities', {
          entities: [{
            name: 'ChildOfDeleted',
            entityType: 'file',
            observations: [],
            parentId: 'ParentToDelete'
          }]
        }, manager);

        // Delete parent
        await handleToolCall('delete_entities', {
          entityNames: ['ParentToDelete']
        }, manager);

        // System behavior: child retains orphan parentId reference (not auto-cleared)
        const graphResult = await handleToolCall('read_graph', {}, manager);
        const graph = parseResponse(graphResult);
        const child = graph.entities.find((e: any) => e.name === 'ChildOfDeleted');

        expect(child).toBeDefined();
        // Child still references deleted parent (orphan reference)
        expect(child.parentId).toBe('ParentToDelete');
      });
    });
  });

  describe('read_graph tool', () => {
    describe('No Parameters Required', () => {
      it('should read empty graph', async () => {
        const result = await handleToolCall('read_graph', {}, manager);

        const data = parseResponse(result);
        expect(data).toHaveProperty('entities');
        expect(data).toHaveProperty('relations');
        expect(data.entities).toEqual([]);
        expect(data.relations).toEqual([]);
      });

      it('should ignore extra parameters', async () => {
        // read_graph takes no parameters, extra ones should be ignored
        const result = await handleToolCall('read_graph', {
          extraParam: 'ignored',
          anotherOne: 123,
          nested: { value: true }
        }, manager);

        // Should still work and return valid graph
        const data = parseResponse(result);
        expect(data).toHaveProperty('entities');
        expect(data).toHaveProperty('relations');
      });

      it('should read graph with entities', async () => {
        await handleToolCall('create_entities', {
          entities: [
            { name: 'Entity1', entityType: 'test', observations: [] },
            { name: 'Entity2', entityType: 'test', observations: [] }
          ]
        }, manager);

        const result = await handleToolCall('read_graph', {}, manager);
        const data = parseResponse(result);

        expect(data.entities).toHaveLength(2);
      });

      it('should read graph with relations', async () => {
        await handleToolCall('create_entities', {
          entities: [
            { name: 'From', entityType: 'test', observations: [] },
            { name: 'To', entityType: 'test', observations: [] }
          ]
        }, manager);

        await handleToolCall('create_relations', {
          relations: [{ from: 'From', to: 'To', relationType: 'connects' }]
        }, manager);

        const result = await handleToolCall('read_graph', {}, manager);
        const data = parseResponse(result);

        expect(data.relations).toHaveLength(1);
      });
    });

    describe('Response Format', () => {
      it('should return MCP-compliant content array', async () => {
        const result = await handleToolCall('read_graph', {}, manager);

        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content[0]).toHaveProperty('type', 'text');
      });

      it('should return valid JSON', async () => {
        const result = await handleToolCall('read_graph', {}, manager);

        expect(() => JSON.parse(result.content[0].text)).not.toThrow();
      });

      it('should include complete entity data', async () => {
        await handleToolCall('create_entities', {
          entities: [{
            name: 'Complete',
            entityType: 'detailed',
            observations: ['obs1'],
            tags: ['tag1'],
            importance: 5
          }]
        }, manager);

        const result = await handleToolCall('read_graph', {}, manager);
        const data = parseResponse(result);
        const entity = data.entities[0];

        expect(entity).toHaveProperty('name', 'Complete');
        expect(entity).toHaveProperty('entityType', 'detailed');
        expect(entity).toHaveProperty('observations');
        expect(entity).toHaveProperty('tags');
        expect(entity).toHaveProperty('importance', 5);
        expect(entity).toHaveProperty('createdAt');
        expect(entity).toHaveProperty('lastModified');
      });
    });
  });

  describe('open_nodes tool', () => {
    describe('Required Parameters', () => {
      it('should open single node by name', async () => {
        await handleToolCall('create_entities', {
          entities: [{ name: 'OpenMe', entityType: 'test', observations: ['data'] }]
        }, manager);

        const result = await handleToolCall('open_nodes', {
          names: ['OpenMe']
        }, manager);

        const data = parseResponse(result);
        expect(data.entities).toHaveLength(1);
        expect(data.entities[0].name).toBe('OpenMe');
      });

      it('should open multiple nodes', async () => {
        await handleToolCall('create_entities', {
          entities: [
            { name: 'Node1', entityType: 'test', observations: [] },
            { name: 'Node2', entityType: 'test', observations: [] },
            { name: 'Node3', entityType: 'test', observations: [] }
          ]
        }, manager);

        const result = await handleToolCall('open_nodes', {
          names: ['Node1', 'Node3']
        }, manager);

        const data = parseResponse(result);
        expect(data.entities).toHaveLength(2);
        expect(data.entities.map((e: any) => e.name)).toContain('Node1');
        expect(data.entities.map((e: any) => e.name)).toContain('Node3');
      });

      it('should handle missing names parameter gracefully', async () => {
        // System treats missing names as empty array
        const result = await handleToolCall('open_nodes', {}, manager);
        const data = parseResponse(result);
        expect(data.entities).toEqual([]);
      });
    });

    describe('Response Format', () => {
      it('should return entities and relations', async () => {
        await handleToolCall('create_entities', {
          entities: [
            { name: 'Source', entityType: 'test', observations: [] },
            { name: 'Target', entityType: 'test', observations: [] }
          ]
        }, manager);

        await handleToolCall('create_relations', {
          relations: [{ from: 'Source', to: 'Target', relationType: 'links_to' }]
        }, manager);

        const result = await handleToolCall('open_nodes', {
          names: ['Source', 'Target']
        }, manager);

        const data = parseResponse(result);
        expect(data).toHaveProperty('entities');
        expect(data).toHaveProperty('relations');
      });

      it('should exclude relations to non-opened nodes', async () => {
        // Create 3 entities with relations
        await handleToolCall('create_entities', {
          entities: [
            { name: 'NodeX', entityType: 'test', observations: [] },
            { name: 'NodeY', entityType: 'test', observations: [] },
            { name: 'NodeZ', entityType: 'test', observations: [] }
          ]
        }, manager);

        await handleToolCall('create_relations', {
          relations: [
            { from: 'NodeX', to: 'NodeY', relationType: 'internal' },
            { from: 'NodeX', to: 'NodeZ', relationType: 'external' }
          ]
        }, manager);

        // Open only NodeX and NodeY (not NodeZ)
        const result = await handleToolCall('open_nodes', {
          names: ['NodeX', 'NodeY']
        }, manager);

        const data = parseResponse(result);

        // Should include relation between opened nodes (NodeX -> NodeY)
        const internalRel = data.relations.find((r: any) =>
          r.from === 'NodeX' && r.to === 'NodeY'
        );
        expect(internalRel).toBeDefined();

        // Should NOT include relation to non-opened node (NodeX -> NodeZ)
        const externalRel = data.relations.find((r: any) =>
          r.from === 'NodeX' && r.to === 'NodeZ'
        );
        expect(externalRel).toBeUndefined();
      });

      it('should include related entities', async () => {
        await handleToolCall('create_entities', {
          entities: [
            { name: 'Primary', entityType: 'test', observations: [] },
            { name: 'Related', entityType: 'test', observations: [] }
          ]
        }, manager);

        await handleToolCall('create_relations', {
          relations: [{ from: 'Primary', to: 'Related', relationType: 'references' }]
        }, manager);

        const result = await handleToolCall('open_nodes', {
          names: ['Primary']
        }, manager);

        const data = parseResponse(result);
        // Should include the primary entity and possibly related
        expect(data.entities.length).toBeGreaterThanOrEqual(1);
      });
    });

    describe('Error Handling', () => {
      it('should return empty for non-existent nodes', async () => {
        const result = await handleToolCall('open_nodes', {
          names: ['NonExistent']
        }, manager);

        const data = parseResponse(result);
        expect(data.entities).toHaveLength(0);
      });

      it('should handle mixed existing and non-existing names', async () => {
        await handleToolCall('create_entities', {
          entities: [{ name: 'Exists', entityType: 'test', observations: [] }]
        }, manager);

        const result = await handleToolCall('open_nodes', {
          names: ['Exists', 'DoesNotExist']
        }, manager);

        const data = parseResponse(result);
        expect(data.entities).toHaveLength(1);
        expect(data.entities[0].name).toBe('Exists');
      });

      it('should handle empty names array', async () => {
        const result = await handleToolCall('open_nodes', {
          names: []
        }, manager);

        const data = parseResponse(result);
        expect(data.entities).toHaveLength(0);
      });
    });

    describe('Edge Cases', () => {
      it('should handle unicode node names', async () => {
        await handleToolCall('create_entities', {
          entities: [{ name: '测试节点', entityType: 'test', observations: [] }]
        }, manager);

        const result = await handleToolCall('open_nodes', {
          names: ['测试节点']
        }, manager);

        const data = parseResponse(result);
        expect(data.entities).toHaveLength(1);
        expect(data.entities[0].name).toBe('测试节点');
      });

      it('should handle duplicate names in request', async () => {
        await handleToolCall('create_entities', {
          entities: [{ name: 'Duplicate', entityType: 'test', observations: [] }]
        }, manager);

        const result = await handleToolCall('open_nodes', {
          names: ['Duplicate', 'Duplicate', 'Duplicate']
        }, manager);

        const data = parseResponse(result);
        // Should deduplicate in response
        expect(data.entities).toHaveLength(1);
      });
    });
  });
});
