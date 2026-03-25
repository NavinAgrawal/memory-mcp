/**
 * Advanced Tools E2E Tests
 *
 * Tests for query_natural_language, configure_distillation,
 * format_with_salience_budget, synthesize_collaborative_context,
 * distill_failure, and end_session tools.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ManagerContext as KnowledgeGraphManager } from '@danielsimonjr/memoryjs';
import { handleToolCall } from '../../../src/server/toolHandlers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let manager: KnowledgeGraphManager;
let testDir: string;
let memoryPath: string;

beforeEach(async () => {
  testDir = await fs.mkdtemp(join(tmpdir(), 'advanced-tools-'));
  memoryPath = join(testDir, 'memory.jsonl');
  await fs.writeFile(memoryPath, '');
  manager = new KnowledgeGraphManager(memoryPath);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

async function seedGraph() {
  await handleToolCall('create_entities', {
    entities: [
      { name: 'Alice', entityType: 'person', observations: ['software engineer', 'works on ProjectX'] },
      { name: 'Bob', entityType: 'person', observations: ['product manager', 'manages ProjectX'] },
      { name: 'ProjectX', entityType: 'project', observations: ['internal tool', 'TypeScript codebase'] },
    ],
  }, manager);
  await handleToolCall('create_relations', {
    relations: [
      { from: 'Alice', to: 'ProjectX', relationType: 'works_on' },
      { from: 'Bob', to: 'ProjectX', relationType: 'manages' },
    ],
  }, manager);
}

describe('Advanced Tools E2E', () => {
  // ==================== query_natural_language ====================
  describe('query_natural_language tool', () => {
    beforeEach(seedGraph);

    it('should accept a natural language query', async () => {
      const result = await handleToolCall('query_natural_language', {
        query: 'Who works on ProjectX?',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('query', 'Who works on ProjectX?');
      expect(data).toHaveProperty('entities');
      expect(data).toHaveProperty('count');
    });

    it('should return entities array', async () => {
      const result = await handleToolCall('query_natural_language', {
        query: 'software engineers',
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(Array.isArray(data.entities)).toBe(true);
    });

    it('should require query parameter', async () => {
      const result = await handleToolCall('query_natural_language', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject empty query', async () => {
      const result = await handleToolCall('query_natural_language', { query: '' }, manager);
      expect(result.isError).toBe(true);
    });

    it('should return count matching entities length', async () => {
      const result = await handleToolCall('query_natural_language', { query: 'Alice' }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(data.entities.length);
    });

    it('should return MCP-compliant content array', async () => {
      const result = await handleToolCall('query_natural_language', { query: 'find people' }, manager);
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
    });
  });

  // ==================== configure_distillation ====================
  describe('configure_distillation tool', () => {
    it('should configure with default policy', async () => {
      const result = await handleToolCall('configure_distillation', {
        policy: 'default',
      }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('default');
    });

    it('should configure with noop policy', async () => {
      const result = await handleToolCall('configure_distillation', {
        policy: 'noop',
      }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('noop');
    });

    it('should configure with none policy', async () => {
      const result = await handleToolCall('configure_distillation', {
        policy: 'none',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should require policy parameter', async () => {
      const result = await handleToolCall('configure_distillation', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject invalid policy value', async () => {
      const result = await handleToolCall('configure_distillation', {
        policy: 'aggressive',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should include policy name in response', async () => {
      const result = await handleToolCall('configure_distillation', { policy: 'default' }, manager);
      expect(result.content[0].text).toContain('default');
    });

    it('should return text response', async () => {
      const result = await handleToolCall('configure_distillation', { policy: 'noop' }, manager);
      expect(result.content[0].type).toBe('text');
    });
  });

  // ==================== format_with_salience_budget ====================
  describe('format_with_salience_budget tool', () => {
    beforeEach(seedGraph);

    it('should format entities within token budget', async () => {
      const result = await handleToolCall('format_with_salience_budget', {
        entityNames: ['Alice', 'Bob'],
        salienceScores: { Alice: 0.9, Bob: 0.5 },
        totalTokenBudget: 500,
      }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text.length).toBeGreaterThan(0);
    });

    it('should require entityNames parameter', async () => {
      const result = await handleToolCall('format_with_salience_budget', {
        salienceScores: { Alice: 0.9 },
        totalTokenBudget: 500,
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should require salienceScores parameter', async () => {
      const result = await handleToolCall('format_with_salience_budget', {
        entityNames: ['Alice'],
        totalTokenBudget: 500,
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should require totalTokenBudget parameter', async () => {
      const result = await handleToolCall('format_with_salience_budget', {
        entityNames: ['Alice'],
        salienceScores: { Alice: 0.9 },
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject zero totalTokenBudget', async () => {
      const result = await handleToolCall('format_with_salience_budget', {
        entityNames: ['Alice'],
        salienceScores: { Alice: 0.9 },
        totalTokenBudget: 0,
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should accept optional header parameter', async () => {
      const result = await handleToolCall('format_with_salience_budget', {
        entityNames: ['Alice'],
        salienceScores: { Alice: 0.9 },
        totalTokenBudget: 500,
        header: '## Memory Context',
      }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('## Memory Context');
    });

    it('should accept optional separator parameter', async () => {
      const result = await handleToolCall('format_with_salience_budget', {
        entityNames: ['Alice', 'Bob'],
        salienceScores: { Alice: 0.9, Bob: 0.5 },
        totalTokenBudget: 1000,
        separator: '---',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should return text response (formatted output)', async () => {
      const result = await handleToolCall('format_with_salience_budget', {
        entityNames: ['Alice'],
        salienceScores: { Alice: 0.9 },
        totalTokenBudget: 200,
      }, manager);
      expect(result.content[0].type).toBe('text');
    });

    it('should handle entities not in graph gracefully', async () => {
      // Non-existent entities are filtered out
      const result = await handleToolCall('format_with_salience_budget', {
        entityNames: ['NonExistent'],
        salienceScores: { NonExistent: 0.5 },
        totalTokenBudget: 500,
      }, manager);
      expect(result.isError).toBeUndefined();
    });
  });

  // ==================== synthesize_collaborative_context ====================
  describe('synthesize_collaborative_context tool', () => {
    beforeEach(seedGraph);

    it('should synthesize context from seed entity', async () => {
      const result = await handleToolCall('synthesize_collaborative_context', {
        seedEntityName: 'Alice',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should require seedEntityName parameter', async () => {
      const result = await handleToolCall('synthesize_collaborative_context', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject empty seedEntityName', async () => {
      const result = await handleToolCall('synthesize_collaborative_context', {
        seedEntityName: '',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should accept optional maxDepth parameter', async () => {
      const result = await handleToolCall('synthesize_collaborative_context', {
        seedEntityName: 'Alice',
        maxDepth: 2,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject maxDepth above 10', async () => {
      const result = await handleToolCall('synthesize_collaborative_context', {
        seedEntityName: 'Alice',
        maxDepth: 11,
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should accept optional minNeighborSalience parameter', async () => {
      const result = await handleToolCall('synthesize_collaborative_context', {
        seedEntityName: 'Alice',
        minNeighborSalience: 0.3,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject minNeighborSalience outside 0-1', async () => {
      const result = await handleToolCall('synthesize_collaborative_context', {
        seedEntityName: 'Alice',
        minNeighborSalience: 1.5,
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should accept optional maxNeighbors parameter', async () => {
      const result = await handleToolCall('synthesize_collaborative_context', {
        seedEntityName: 'Alice',
        maxNeighbors: 10,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept optional queryText context', async () => {
      const result = await handleToolCall('synthesize_collaborative_context', {
        seedEntityName: 'Alice',
        queryText: 'what projects does Alice work on?',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept optional currentTask context', async () => {
      const result = await handleToolCall('synthesize_collaborative_context', {
        seedEntityName: 'Alice',
        currentTask: 'code review',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should return valid JSON response', async () => {
      const result = await handleToolCall('synthesize_collaborative_context', {
        seedEntityName: 'Alice',
      }, manager);
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });
  });

  // ==================== distill_failure ====================
  describe('distill_failure tool', () => {
    it('should require sessionId parameter', async () => {
      const result = await handleToolCall('distill_failure', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject empty sessionId', async () => {
      const result = await handleToolCall('distill_failure', { sessionId: '' }, manager);
      expect(result.isError).toBe(true);
    });

    it('should distill failures from a session entity', async () => {
      // Create a session entity first
      await handleToolCall('create_entities', {
        entities: [{
          name: 'session-001',
          entityType: 'session',
          observations: ['task: deploy service', 'error: connection timeout', 'error: retry failed'],
        }],
      }, manager);

      const result = await handleToolCall('distill_failure', {
        sessionId: 'session-001',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should return valid JSON response', async () => {
      await handleToolCall('create_entities', {
        entities: [{
          name: 'sess-fail-01',
          entityType: 'session',
          observations: ['encountered error'],
        }],
      }, manager);

      const result = await handleToolCall('distill_failure', {
        sessionId: 'sess-fail-01',
      }, manager);
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should accept optional minLessonConfidence parameter', async () => {
      await handleToolCall('create_entities', {
        entities: [{ name: 'sess-002', entityType: 'session', observations: ['error occurred'] }],
      }, manager);

      const result = await handleToolCall('distill_failure', {
        sessionId: 'sess-002',
        minLessonConfidence: 0.7,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject minLessonConfidence outside 0-1', async () => {
      const result = await handleToolCall('distill_failure', {
        sessionId: 'sess-003',
        minLessonConfidence: 1.5,
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should accept optional maxCauseChainLength parameter', async () => {
      await handleToolCall('create_entities', {
        entities: [{ name: 'sess-004', entityType: 'session', observations: ['error'] }],
      }, manager);

      const result = await handleToolCall('distill_failure', {
        sessionId: 'sess-004',
        maxCauseChainLength: 5,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should reject maxCauseChainLength above 20', async () => {
      const result = await handleToolCall('distill_failure', {
        sessionId: 'sess-005',
        maxCauseChainLength: 25,
      }, manager);
      expect(result.isError).toBe(true);
    });
  });

  // ==================== end_session ====================
  describe('end_session tool', () => {
    it('should require sessionId parameter', async () => {
      const result = await handleToolCall('end_session', {
        outcome: 'success',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should require outcome parameter', async () => {
      const result = await handleToolCall('end_session', {
        sessionId: 'sess-001',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject invalid outcome value', async () => {
      const result = await handleToolCall('end_session', {
        sessionId: 'sess-001',
        outcome: 'unknown',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should return text message for non-existent session', async () => {
      const result = await handleToolCall('end_session', {
        sessionId: 'nonexistent-session',
        outcome: 'success',
      }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('not found');
    });

    it('should end session with success outcome', async () => {
      await handleToolCall('create_entities', {
        entities: [{ name: 'sess-success', entityType: 'session', observations: ['task completed'] }],
      }, manager);

      const result = await handleToolCall('end_session', {
        sessionId: 'sess-success',
        outcome: 'success',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.sessionId).toBe('sess-success');
      expect(data.outcome).toBe('success');
    });

    it('should end session with failure outcome and distill failures', async () => {
      await handleToolCall('create_entities', {
        entities: [{ name: 'sess-failure', entityType: 'session', observations: ['task failed', 'error: timeout'] }],
      }, manager);

      const result = await handleToolCall('end_session', {
        sessionId: 'sess-failure',
        outcome: 'failure',
        distillFailures: true,
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.outcome).toBe('failure');
    });

    it('should end session with partial outcome', async () => {
      await handleToolCall('create_entities', {
        entities: [{ name: 'sess-partial', entityType: 'session', observations: ['some tasks done'] }],
      }, manager);

      const result = await handleToolCall('end_session', {
        sessionId: 'sess-partial',
        outcome: 'partial',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.outcome).toBe('partial');
    });

    it('should accept all valid outcome values', async () => {
      const outcomes = ['success', 'failure', 'partial'];
      for (let i = 0; i < outcomes.length; i++) {
        const sessionName = `sess-outcome-${i}`;
        await handleToolCall('create_entities', {
          entities: [{ name: sessionName, entityType: 'session', observations: ['test'] }],
        }, manager);

        const result = await handleToolCall('end_session', {
          sessionId: sessionName,
          outcome: outcomes[i],
        }, manager);
        expect(result.isError).toBeUndefined();
      }
    });

    it('should include message in response', async () => {
      await handleToolCall('create_entities', {
        entities: [{ name: 'sess-msg', entityType: 'session', observations: [] }],
      }, manager);

      const result = await handleToolCall('end_session', {
        sessionId: 'sess-msg',
        outcome: 'success',
      }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('sess-msg');
    });

    it('should accept distillFailures=false to skip failure distillation', async () => {
      await handleToolCall('create_entities', {
        entities: [{ name: 'sess-no-distill', entityType: 'session', observations: ['error occurred'] }],
      }, manager);

      const result = await handleToolCall('end_session', {
        sessionId: 'sess-no-distill',
        outcome: 'failure',
        distillFailures: false,
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.distillationResult).toBeNull();
    });

    it('should return MCP-compliant content array', async () => {
      await handleToolCall('create_entities', {
        entities: [{ name: 'sess-format', entityType: 'session', observations: [] }],
      }, manager);

      const result = await handleToolCall('end_session', {
        sessionId: 'sess-format',
        outcome: 'success',
      }, manager);
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
    });
  });
});
