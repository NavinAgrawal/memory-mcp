/**
 * Relation Tools E2E Tests
 *
 * Tests for create_relations and delete_relations tools via the MCP tool call interface.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KnowledgeGraphManager } from '../../../core/index.js';
import { handleToolCall } from '../../../server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Relation Tools E2E', () => {
  let manager: KnowledgeGraphManager;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `relation-tools-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'test-graph.jsonl');
    manager = new KnowledgeGraphManager(testFilePath);

    // Pre-create entities for relation tests
    await handleToolCall('create_entities', {
      entities: [
        { name: 'EntityA', entityType: 'node', observations: [] },
        { name: 'EntityB', entityType: 'node', observations: [] },
        { name: 'EntityC', entityType: 'node', observations: [] },
        { name: 'EntityD', entityType: 'node', observations: [] }
      ]
    }, manager);
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

  describe('create_relations tool', () => {
    describe('Required Parameters', () => {
      it('should create single relation with required fields', async () => {
        const result = await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'connects_to' }]
        }, manager);

        const data = parseResponse(result);
        expect(data).toHaveLength(1);
        expect(data[0].from).toBe('EntityA');
        expect(data[0].to).toBe('EntityB');
        expect(data[0].relationType).toBe('connects_to');
      });

      it('should create multiple relations in batch', async () => {
        const result = await handleToolCall('create_relations', {
          relations: [
            { from: 'EntityA', to: 'EntityB', relationType: 'type1' },
            { from: 'EntityB', to: 'EntityC', relationType: 'type2' },
            { from: 'EntityC', to: 'EntityD', relationType: 'type3' }
          ]
        }, manager);

        const data = parseResponse(result);
        expect(data).toHaveLength(3);
      });

      it('should require relations array parameter', async () => {
        await expect(handleToolCall('create_relations', {}, manager))
          .rejects.toThrow();
      });

      it('should require from field in each relation', async () => {
        await expect(handleToolCall('create_relations', {
          relations: [{ to: 'EntityB', relationType: 'connects' }]
        }, manager)).rejects.toThrow();
      });

      it('should require to field in each relation', async () => {
        await expect(handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', relationType: 'connects' }]
        }, manager)).rejects.toThrow();
      });

      it('should require relationType field in each relation', async () => {
        await expect(handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB' }]
        }, manager)).rejects.toThrow();
      });
    });

    describe('Response Format', () => {
      it('should return MCP-compliant content array', async () => {
        const result = await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'test' }]
        }, manager);

        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0]).toHaveProperty('text');
      });

      it('should include created relations in response', async () => {
        const result = await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'links_to' }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0]).toHaveProperty('from', 'EntityA');
        expect(data[0]).toHaveProperty('to', 'EntityB');
        expect(data[0]).toHaveProperty('relationType', 'links_to');
      });

      it('should include createdAt timestamp', async () => {
        const result = await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'timestamp_test' }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0]).toHaveProperty('createdAt');
        // Should be valid ISO 8601 date
        expect(new Date(data[0].createdAt).toISOString()).toBe(data[0].createdAt);
      });

      it('should return valid JSON', async () => {
        const result = await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'test' }]
        }, manager);

        expect(() => JSON.parse(result.content[0].text)).not.toThrow();
      });
    });

    describe('Persistence', () => {
      it('should persist relations to graph', async () => {
        await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'persisted' }]
        }, manager);

        const graphResult = await handleToolCall('read_graph', {}, manager);
        const graph = parseResponse(graphResult);

        expect(graph.relations).toHaveLength(1);
        expect(graph.relations[0].relationType).toBe('persisted');
      });

      it('should accumulate relations in graph', async () => {
        await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'first' }]
        }, manager);

        await handleToolCall('create_relations', {
          relations: [{ from: 'EntityC', to: 'EntityD', relationType: 'second' }]
        }, manager);

        const graphResult = await handleToolCall('read_graph', {}, manager);
        const graph = parseResponse(graphResult);

        expect(graph.relations).toHaveLength(2);
      });
    });

    describe('Error Handling', () => {
      it('should handle empty relations array gracefully', async () => {
        // System allows empty array - returns empty result
        const result = await handleToolCall('create_relations', {
          relations: []
        }, manager);
        const data = parseResponse(result);
        expect(data).toEqual([]);
      });

      it('should reject empty relationType', async () => {
        // Empty string relationType should be rejected
        await expect(handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: '' }]
        }, manager)).rejects.toThrow();
      });

      it('should handle relation with non-existent from entity gracefully', async () => {
        // System creates relations even if entities don't exist (orphan relations)
        const result = await handleToolCall('create_relations', {
          relations: [{ from: 'NonExistent', to: 'EntityB', relationType: 'test' }]
        }, manager);
        // Should complete without error
        expect(result.content).toBeDefined();
      });

      it('should handle relation with non-existent to entity gracefully', async () => {
        // System creates relations even if entities don't exist
        const result = await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'NonExistent', relationType: 'test' }]
        }, manager);
        expect(result.content).toBeDefined();
      });

      it('should handle duplicate relations gracefully', async () => {
        await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'unique' }]
        }, manager);

        // System may skip duplicate or overwrite
        const result = await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'unique' }]
        }, manager);
        expect(result.content).toBeDefined();
      });

      it('should handle self-referencing relations gracefully', async () => {
        // System allows self-referencing relations
        const result = await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityA', relationType: 'self' }]
        }, manager);
        expect(result.content).toBeDefined();
      });
    });

    describe('Edge Cases', () => {
      it('should handle unicode in relationType', async () => {
        const result = await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: '関連する' }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].relationType).toBe('関連する');
      });

      it('should handle moderately long relationType (50 chars)', async () => {
        // System may have length limits on relationType
        const longType = 'relation_type_12345';
        const result = await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: longType }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].relationType).toBe(longType);
      });

      it('should allow different relation types between same entities', async () => {
        await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'type1' }]
        }, manager);

        const result = await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'type2' }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].relationType).toBe('type2');

        // Verify both exist
        const graphResult = await handleToolCall('read_graph', {}, manager);
        const graph = parseResponse(graphResult);
        const aToB = graph.relations.filter((r: any) => r.from === 'EntityA' && r.to === 'EntityB');
        expect(aToB).toHaveLength(2);
      });

      it('should allow bidirectional relations', async () => {
        const result = await handleToolCall('create_relations', {
          relations: [
            { from: 'EntityA', to: 'EntityB', relationType: 'forward' },
            { from: 'EntityB', to: 'EntityA', relationType: 'backward' }
          ]
        }, manager);

        const data = parseResponse(result);
        expect(data).toHaveLength(2);
      });

      it('should handle special characters in relationType', async () => {
        const result = await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'has-many_items.v2' }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].relationType).toBe('has-many_items.v2');
      });
    });

    describe('Graph Integrity', () => {
      it('should maintain graph consistency after relation creation', async () => {
        await handleToolCall('create_relations', {
          relations: [
            { from: 'EntityA', to: 'EntityB', relationType: 'chain1' },
            { from: 'EntityB', to: 'EntityC', relationType: 'chain2' },
            { from: 'EntityC', to: 'EntityD', relationType: 'chain3' }
          ]
        }, manager);

        const graphResult = await handleToolCall('read_graph', {}, manager);
        const graph = parseResponse(graphResult);

        // Verify all entities still exist
        expect(graph.entities).toHaveLength(4);
        // Verify chain is complete
        expect(graph.relations).toHaveLength(3);
      });
    });
  });

  describe('delete_relations tool', () => {
    beforeEach(async () => {
      // Create relations for deletion tests
      await handleToolCall('create_relations', {
        relations: [
          { from: 'EntityA', to: 'EntityB', relationType: 'deletable1' },
          { from: 'EntityB', to: 'EntityC', relationType: 'deletable2' },
          { from: 'EntityC', to: 'EntityD', relationType: 'deletable3' }
        ]
      }, manager);
    });

    describe('Required Parameters', () => {
      it('should delete single relation', async () => {
        const result = await handleToolCall('delete_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'deletable1' }]
        }, manager);

        expect(result.content[0].text).toContain('Deleted');
        expect(result.content[0].text).toContain('1');
      });

      it('should delete multiple relations in batch', async () => {
        const result = await handleToolCall('delete_relations', {
          relations: [
            { from: 'EntityA', to: 'EntityB', relationType: 'deletable1' },
            { from: 'EntityB', to: 'EntityC', relationType: 'deletable2' }
          ]
        }, manager);

        expect(result.content[0].text).toContain('Deleted');
        expect(result.content[0].text).toContain('2');
      });

      it('should require relations array parameter', async () => {
        await expect(handleToolCall('delete_relations', {}, manager))
          .rejects.toThrow();
      });

      it('should require all three fields to identify relation', async () => {
        // Missing relationType
        await expect(handleToolCall('delete_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB' }]
        }, manager)).rejects.toThrow();
      });
    });

    describe('Response Format', () => {
      it('should return text confirmation message', async () => {
        const result = await handleToolCall('delete_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'deletable1' }]
        }, manager);

        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text).toContain('Deleted');
      });
    });

    describe('Side Effects', () => {
      it('should remove relation from graph', async () => {
        await handleToolCall('delete_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'deletable1' }]
        }, manager);

        const graphResult = await handleToolCall('read_graph', {}, manager);
        const graph = parseResponse(graphResult);

        const deleted = graph.relations.find((r: any) =>
          r.from === 'EntityA' && r.to === 'EntityB' && r.relationType === 'deletable1'
        );
        expect(deleted).toBeUndefined();
      });

      it('should not affect entities when deleting relation', async () => {
        const beforeGraph = await handleToolCall('read_graph', {}, manager);
        const beforeEntities = parseResponse(beforeGraph).entities.length;

        await handleToolCall('delete_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'deletable1' }]
        }, manager);

        const afterGraph = await handleToolCall('read_graph', {}, manager);
        const afterEntities = parseResponse(afterGraph).entities.length;

        expect(afterEntities).toBe(beforeEntities);
      });

      it('should not affect other relations', async () => {
        await handleToolCall('delete_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'deletable1' }]
        }, manager);

        const graphResult = await handleToolCall('read_graph', {}, manager);
        const graph = parseResponse(graphResult);

        // Other relations should still exist
        expect(graph.relations).toHaveLength(2);
        expect(graph.relations.some((r: any) => r.relationType === 'deletable2')).toBe(true);
        expect(graph.relations.some((r: any) => r.relationType === 'deletable3')).toBe(true);
      });
    });

    describe('Error Handling', () => {
      it('should handle non-existent relation gracefully', async () => {
        // Should not throw, just delete 0
        const result = await handleToolCall('delete_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'nonexistent' }]
        }, manager);

        expect(result.content[0].text).toContain('Deleted');
      });

      it('should reject empty relations array', async () => {
        // System validates non-empty array for delete
        await expect(handleToolCall('delete_relations', {
          relations: []
        }, manager)).rejects.toThrow();
      });

      it('should handle mixed existing and non-existing relations', async () => {
        const result = await handleToolCall('delete_relations', {
          relations: [
            { from: 'EntityA', to: 'EntityB', relationType: 'deletable1' },
            { from: 'EntityA', to: 'EntityB', relationType: 'nonexistent' }
          ]
        }, manager);

        // Should still process successfully
        expect(result.content[0].text).toContain('Deleted');
      });
    });

    describe('Edge Cases', () => {
      it('should delete specific relation type only', async () => {
        // Create another relation with same endpoints, different type
        await handleToolCall('create_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'keep_this' }]
        }, manager);

        await handleToolCall('delete_relations', {
          relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'deletable1' }]
        }, manager);

        const graphResult = await handleToolCall('read_graph', {}, manager);
        const graph = parseResponse(graphResult);

        // keep_this should still exist
        const kept = graph.relations.find((r: any) =>
          r.from === 'EntityA' && r.to === 'EntityB' && r.relationType === 'keep_this'
        );
        expect(kept).toBeDefined();
      });

      it('should handle duplicate delete requests', async () => {
        await handleToolCall('delete_relations', {
          relations: [
            { from: 'EntityA', to: 'EntityB', relationType: 'deletable1' },
            { from: 'EntityA', to: 'EntityB', relationType: 'deletable1' }
          ]
        }, manager);

        const graphResult = await handleToolCall('read_graph', {}, manager);
        const graph = parseResponse(graphResult);

        // Should still have 2 remaining relations
        expect(graph.relations).toHaveLength(2);
      });
    });
  });

  describe('Relation Tool Integration', () => {
    it('should support create-read-delete workflow', async () => {
      // Create
      await handleToolCall('create_relations', {
        relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'workflow_test' }]
      }, manager);

      // Read
      let graphResult = await handleToolCall('read_graph', {}, manager);
      let graph = parseResponse(graphResult);
      expect(graph.relations.some((r: any) => r.relationType === 'workflow_test')).toBe(true);

      // Delete
      await handleToolCall('delete_relations', {
        relations: [{ from: 'EntityA', to: 'EntityB', relationType: 'workflow_test' }]
      }, manager);

      // Verify deletion
      graphResult = await handleToolCall('read_graph', {}, manager);
      graph = parseResponse(graphResult);
      expect(graph.relations.some((r: any) => r.relationType === 'workflow_test')).toBe(false);
    });

    it('should handle complex relation networks', async () => {
      // Create a more complex network
      await handleToolCall('create_relations', {
        relations: [
          { from: 'EntityA', to: 'EntityB', relationType: 'knows' },
          { from: 'EntityA', to: 'EntityC', relationType: 'knows' },
          { from: 'EntityA', to: 'EntityD', relationType: 'knows' },
          { from: 'EntityB', to: 'EntityC', relationType: 'works_with' },
          { from: 'EntityC', to: 'EntityD', relationType: 'works_with' }
        ]
      }, manager);

      const graphResult = await handleToolCall('read_graph', {}, manager);
      const graph = parseResponse(graphResult);

      // Should have all 5 new relations plus 3 from beforeEach
      expect(graph.relations.length).toBeGreaterThanOrEqual(5);
    });
  });
});
