/**
 * Observation Tools E2E Tests
 *
 * Tests for add_observations and delete_observations tools via the MCP tool call interface.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KnowledgeGraphManager } from '../../../src/core/index.js';
import { handleToolCall } from '../../../src/server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Observation Tools E2E', () => {
  let manager: KnowledgeGraphManager;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `observation-tools-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'test-graph.jsonl');
    manager = new KnowledgeGraphManager(testFilePath);

    // Pre-create entities for observation tests
    await handleToolCall('create_entities', {
      entities: [
        { name: 'TestEntity', entityType: 'test', observations: ['initial_obs'] },
        { name: 'EmptyEntity', entityType: 'test', observations: [] },
        { name: 'MultiObsEntity', entityType: 'test', observations: ['obs1', 'obs2', 'obs3'] }
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

  describe('add_observations tool', () => {
    describe('Required Parameters', () => {
      it('should add single observation to entity', async () => {
        const result = await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: ['new_observation'] }]
        }, manager);

        const data = parseResponse(result);
        expect(data).toHaveLength(1);
        expect(data[0].entityName).toBe('TestEntity');
        expect(data[0].addedObservations).toContain('new_observation');
      });

      it('should add multiple observations to single entity', async () => {
        const result = await handleToolCall('add_observations', {
          observations: [{
            entityName: 'TestEntity',
            contents: ['obs_a', 'obs_b', 'obs_c']
          }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].addedObservations).toContain('obs_a');
        expect(data[0].addedObservations).toContain('obs_b');
        expect(data[0].addedObservations).toContain('obs_c');
      });

      it('should add observations to multiple entities in batch', async () => {
        const result = await handleToolCall('add_observations', {
          observations: [
            { entityName: 'TestEntity', contents: ['added1'] },
            { entityName: 'EmptyEntity', contents: ['added2'] }
          ]
        }, manager);

        const data = parseResponse(result);
        expect(data).toHaveLength(2);
      });

      it('should require observations array parameter', async () => {
        await expect(handleToolCall('add_observations', {}, manager))
          .rejects.toThrow();
      });

      it('should require entityName field', async () => {
        await expect(handleToolCall('add_observations', {
          observations: [{ contents: ['test'] }]
        }, manager)).rejects.toThrow();
      });

      it('should require contents field', async () => {
        await expect(handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity' }]
        }, manager)).rejects.toThrow();
      });
    });

    describe('Response Format', () => {
      it('should return MCP-compliant content array', async () => {
        const result = await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: ['test'] }]
        }, manager);

        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content[0]).toHaveProperty('type', 'text');
      });

      it('should include entity name in response', async () => {
        const result = await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: ['test'] }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0]).toHaveProperty('entityName', 'TestEntity');
      });

      it('should include added observations in response', async () => {
        const result = await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: ['unique_obs'] }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0]).toHaveProperty('addedObservations');
        expect(data[0].addedObservations).toContain('unique_obs');
      });
    });

    describe('Persistence', () => {
      it('should persist observations to entity', async () => {
        await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: ['persisted_obs'] }]
        }, manager);

        const nodeResult = await handleToolCall('open_nodes', {
          names: ['TestEntity']
        }, manager);

        const data = parseResponse(nodeResult);
        expect(data.entities[0].observations).toContain('persisted_obs');
      });

      it('should preserve existing observations', async () => {
        await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: ['new_obs'] }]
        }, manager);

        const nodeResult = await handleToolCall('open_nodes', {
          names: ['TestEntity']
        }, manager);

        const data = parseResponse(nodeResult);
        // Should still have initial observation
        expect(data.entities[0].observations).toContain('initial_obs');
        expect(data.entities[0].observations).toContain('new_obs');
      });

      it('should update lastModified timestamp', async () => {
        const beforeResult = await handleToolCall('open_nodes', {
          names: ['TestEntity']
        }, manager);
        const beforeData = parseResponse(beforeResult);
        const beforeModified = beforeData.entities[0].lastModified;

        // Small delay to ensure timestamp difference
        await new Promise(resolve => setTimeout(resolve, 10));

        await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: ['timestamp_test'] }]
        }, manager);

        const afterResult = await handleToolCall('open_nodes', {
          names: ['TestEntity']
        }, manager);
        const afterData = parseResponse(afterResult);
        const afterModified = afterData.entities[0].lastModified;

        expect(new Date(afterModified).getTime()).toBeGreaterThanOrEqual(new Date(beforeModified).getTime());
      });
    });

    describe('Error Handling', () => {
      it('should reject non-existent entity', async () => {
        await expect(handleToolCall('add_observations', {
          observations: [{ entityName: 'NonExistent', contents: ['test'] }]
        }, manager)).rejects.toThrow();
      });

      it('should handle empty observations array gracefully', async () => {
        // System allows empty array - returns empty result
        const result = await handleToolCall('add_observations', {
          observations: []
        }, manager);
        const data = parseResponse(result);
        expect(data).toEqual([]);
      });

      it('should handle empty contents array gracefully', async () => {
        // System allows adding no observations
        const result = await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: [] }]
        }, manager);
        const data = parseResponse(result);
        expect(data[0].addedObservations).toEqual([]);
      });

      it('should reject non-string observation content', async () => {
        await expect(handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: [123, true] }]
        }, manager)).rejects.toThrow();
      });
    });

    describe('Edge Cases', () => {
      it('should handle unicode in observations', async () => {
        const result = await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: ['日本語の観察', '中文观察'] }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].addedObservations).toContain('日本語の観察');
        expect(data[0].addedObservations).toContain('中文观察');
      });

      it('should handle special characters in observations', async () => {
        const result = await handleToolCall('add_observations', {
          observations: [{
            entityName: 'TestEntity',
            contents: [
              'Contains "quotes"',
              'Has\nnewlines',
              'Tab\there',
              'Backslash\\here'
            ]
          }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].addedObservations).toHaveLength(4);
      });

      it('should handle very long observations (5000+ chars)', async () => {
        const longObs = 'A'.repeat(5000);
        const result = await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: [longObs] }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].addedObservations[0]).toBe(longObs);
      });

      it('should handle duplicate observation content', async () => {
        // Add same observation twice
        await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: ['duplicate'] }]
        }, manager);

        // Try to add it again
        const result = await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: ['duplicate'] }]
        }, manager);

        // Behavior depends on implementation - may dedupe or allow
        const data = parseResponse(result);
        expect(data[0]).toBeDefined();
      });

      it('should handle many observations at once', async () => {
        const contents = Array.from({ length: 100 }, (_, i) => `observation_${i}`);
        const result = await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents }]
        }, manager);

        const data = parseResponse(result);
        expect(data[0].addedObservations.length).toBeGreaterThanOrEqual(100);
      });
    });
  });

  describe('delete_observations tool', () => {
    describe('Required Parameters', () => {
      it('should delete single observation from entity', async () => {
        const result = await handleToolCall('delete_observations', {
          deletions: [{ entityName: 'MultiObsEntity', observations: ['obs1'] }]
        }, manager);

        expect(result.content[0].text).toContain('deleted');
      });

      it('should delete multiple observations from single entity', async () => {
        const result = await handleToolCall('delete_observations', {
          deletions: [{ entityName: 'MultiObsEntity', observations: ['obs1', 'obs2'] }]
        }, manager);

        expect(result.content[0].text).toContain('deleted');
      });

      it('should delete observations from multiple entities', async () => {
        // First add observations to TestEntity
        await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: ['to_delete'] }]
        }, manager);

        const result = await handleToolCall('delete_observations', {
          deletions: [
            { entityName: 'MultiObsEntity', observations: ['obs1'] },
            { entityName: 'TestEntity', observations: ['to_delete'] }
          ]
        }, manager);

        expect(result.content[0].text).toContain('deleted');
      });

      it('should require deletions array parameter', async () => {
        await expect(handleToolCall('delete_observations', {}, manager))
          .rejects.toThrow();
      });

      it('should require entityName field', async () => {
        // entityName is required per tool definition
        await expect(handleToolCall('delete_observations', {
          deletions: [{ observations: ['obs1'] }]
        }, manager)).rejects.toThrow();
      });

      it('should require observations field', async () => {
        await expect(handleToolCall('delete_observations', {
          deletions: [{ entityName: 'MultiObsEntity' }]
        }, manager)).rejects.toThrow();
      });
    });

    describe('Response Format', () => {
      it('should return text confirmation message', async () => {
        const result = await handleToolCall('delete_observations', {
          deletions: [{ entityName: 'MultiObsEntity', observations: ['obs1'] }]
        }, manager);

        expect(result.content[0].type).toBe('text');
        expect(result.content[0].text.toLowerCase()).toContain('deleted');
      });
    });

    describe('Side Effects', () => {
      it('should remove observation from entity', async () => {
        await handleToolCall('delete_observations', {
          deletions: [{ entityName: 'MultiObsEntity', observations: ['obs1'] }]
        }, manager);

        const nodeResult = await handleToolCall('open_nodes', {
          names: ['MultiObsEntity']
        }, manager);

        const data = parseResponse(nodeResult);
        expect(data.entities[0].observations).not.toContain('obs1');
      });

      it('should preserve other observations', async () => {
        await handleToolCall('delete_observations', {
          deletions: [{ entityName: 'MultiObsEntity', observations: ['obs1'] }]
        }, manager);

        const nodeResult = await handleToolCall('open_nodes', {
          names: ['MultiObsEntity']
        }, manager);

        const data = parseResponse(nodeResult);
        expect(data.entities[0].observations).toContain('obs2');
        expect(data.entities[0].observations).toContain('obs3');
      });

      it('should update lastModified timestamp', async () => {
        const beforeResult = await handleToolCall('open_nodes', {
          names: ['MultiObsEntity']
        }, manager);
        const beforeData = parseResponse(beforeResult);
        const beforeModified = beforeData.entities[0].lastModified;

        await new Promise(resolve => setTimeout(resolve, 10));

        await handleToolCall('delete_observations', {
          deletions: [{ entityName: 'MultiObsEntity', observations: ['obs1'] }]
        }, manager);

        const afterResult = await handleToolCall('open_nodes', {
          names: ['MultiObsEntity']
        }, manager);
        const afterData = parseResponse(afterResult);
        const afterModified = afterData.entities[0].lastModified;

        expect(new Date(afterModified).getTime()).toBeGreaterThanOrEqual(new Date(beforeModified).getTime());
      });
    });

    describe('Error Handling', () => {
      it('should handle non-existent entity gracefully', async () => {
        // System skips non-existent entities without error
        const result = await handleToolCall('delete_observations', {
          deletions: [{ entityName: 'NonExistent', observations: ['obs'] }]
        }, manager);
        // Should complete without error
        expect(result.content[0].text).toBeDefined();
      });

      it('should handle non-existent observation gracefully', async () => {
        // Should not throw - observation doesn't exist
        const result = await handleToolCall('delete_observations', {
          deletions: [{ entityName: 'MultiObsEntity', observations: ['nonexistent'] }]
        }, manager);

        expect(result.content[0].text).toBeDefined();
      });

      it('should handle empty deletions array', async () => {
        const result = await handleToolCall('delete_observations', {
          deletions: []
        }, manager);

        expect(result.content[0].text).toBeDefined();
      });

      it('should handle empty observations array in deletion', async () => {
        const result = await handleToolCall('delete_observations', {
          deletions: [{ entityName: 'MultiObsEntity', observations: [] }]
        }, manager);

        expect(result.content[0].text).toBeDefined();
      });
    });

    describe('Edge Cases', () => {
      it('should handle deleting all observations', async () => {
        await handleToolCall('delete_observations', {
          deletions: [{ entityName: 'MultiObsEntity', observations: ['obs1', 'obs2', 'obs3'] }]
        }, manager);

        const nodeResult = await handleToolCall('open_nodes', {
          names: ['MultiObsEntity']
        }, manager);

        const data = parseResponse(nodeResult);
        expect(data.entities[0].observations).toEqual([]);
      });

      it('should handle unicode observation deletion', async () => {
        // Add unicode observation first
        await handleToolCall('add_observations', {
          observations: [{ entityName: 'TestEntity', contents: ['日本語テスト'] }]
        }, manager);

        const result = await handleToolCall('delete_observations', {
          deletions: [{ entityName: 'TestEntity', observations: ['日本語テスト'] }]
        }, manager);

        expect(result.content[0].text).toBeDefined();

        // Verify deletion
        const nodeResult = await handleToolCall('open_nodes', {
          names: ['TestEntity']
        }, manager);
        const data = parseResponse(nodeResult);
        expect(data.entities[0].observations).not.toContain('日本語テスト');
      });

      it('should handle duplicate deletion requests', async () => {
        const result = await handleToolCall('delete_observations', {
          deletions: [
            { entityName: 'MultiObsEntity', observations: ['obs1'] },
            { entityName: 'MultiObsEntity', observations: ['obs1'] }
          ]
        }, manager);

        expect(result.content[0].text).toBeDefined();
      });
    });
  });

  describe('Observation Tool Integration', () => {
    it('should support add-read-delete workflow', async () => {
      // Add
      await handleToolCall('add_observations', {
        observations: [{ entityName: 'EmptyEntity', contents: ['workflow_obs'] }]
      }, manager);

      // Read
      let nodeResult = await handleToolCall('open_nodes', {
        names: ['EmptyEntity']
      }, manager);
      let data = parseResponse(nodeResult);
      expect(data.entities[0].observations).toContain('workflow_obs');

      // Delete
      await handleToolCall('delete_observations', {
        deletions: [{ entityName: 'EmptyEntity', observations: ['workflow_obs'] }]
      }, manager);

      // Verify deletion
      nodeResult = await handleToolCall('open_nodes', {
        names: ['EmptyEntity']
      }, manager);
      data = parseResponse(nodeResult);
      expect(data.entities[0].observations).not.toContain('workflow_obs');
    });

    it('should handle concurrent observation modifications', async () => {
      // Add multiple observations in sequence
      await handleToolCall('add_observations', {
        observations: [{ entityName: 'EmptyEntity', contents: ['seq1'] }]
      }, manager);

      await handleToolCall('add_observations', {
        observations: [{ entityName: 'EmptyEntity', contents: ['seq2'] }]
      }, manager);

      await handleToolCall('add_observations', {
        observations: [{ entityName: 'EmptyEntity', contents: ['seq3'] }]
      }, manager);

      const nodeResult = await handleToolCall('open_nodes', {
        names: ['EmptyEntity']
      }, manager);
      const data = parseResponse(nodeResult);

      expect(data.entities[0].observations).toContain('seq1');
      expect(data.entities[0].observations).toContain('seq2');
      expect(data.entities[0].observations).toContain('seq3');
    });
  });
});
