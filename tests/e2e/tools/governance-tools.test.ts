/**
 * Governance Tools E2E Tests
 *
 * Tests for governance_transaction, audit_query, audit_history, and rollback_operation tools.
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
  testDir = await fs.mkdtemp(join(tmpdir(), 'governance-tools-'));
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
      { name: 'Alice', entityType: 'person', observations: ['engineer'] },
      { name: 'Bob', entityType: 'person', observations: ['manager'] },
    ],
  }, manager);
}

describe('Governance Tools E2E', () => {
  // ==================== governance_transaction ====================
  describe('governance_transaction tool', () => {
    it('should set governance policy with all permissions allowed', async () => {
      const result = await handleToolCall('governance_transaction', {
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('canCreate=true');
      expect(result.content[0].text).toContain('canUpdate=true');
      expect(result.content[0].text).toContain('canDelete=true');
    });

    it('should set governance policy with restricted delete', async () => {
      const result = await handleToolCall('governance_transaction', {
        canCreate: true,
        canUpdate: true,
        canDelete: false,
      }, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('canDelete=false');
    });

    it('should set governance policy with all permissions denied', async () => {
      const result = await handleToolCall('governance_transaction', {
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should use defaults when no parameters provided', async () => {
      // All default to true when not specified
      const result = await handleToolCall('governance_transaction', {}, manager);
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('canCreate=true');
    });

    it('should return text response', async () => {
      const result = await handleToolCall('governance_transaction', { canCreate: true }, manager);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text.length).toBeGreaterThan(0);
    });

    it('should reject non-boolean canCreate', async () => {
      const result = await handleToolCall('governance_transaction', { canCreate: 'yes' }, manager);
      expect(result.isError).toBe(true);
    });
  });

  // ==================== audit_query ====================
  describe('audit_query tool', () => {
    it('should return empty audit log on fresh system', async () => {
      const result = await handleToolCall('audit_query', {}, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('entries');
      expect(data).toHaveProperty('count');
      expect(Array.isArray(data.entries)).toBe(true);
    });

    it('should accept operation filter', async () => {
      const result = await handleToolCall('audit_query', {
        operation: 'create',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('entries');
    });

    it('should reject invalid operation value', async () => {
      const result = await handleToolCall('audit_query', {
        operation: 'invalid_op',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should accept all valid operation values', async () => {
      const validOps = ['create', 'update', 'delete', 'merge', 'archive'];
      for (const operation of validOps) {
        const result = await handleToolCall('audit_query', { operation }, manager);
        expect(result.isError).toBeUndefined();
      }
    });

    it('should accept agentId filter', async () => {
      const result = await handleToolCall('audit_query', {
        agentId: 'agent-001',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept entityName filter', async () => {
      await seedGraph();
      const result = await handleToolCall('audit_query', {
        entityName: 'Alice',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept since and until time filters', async () => {
      const result = await handleToolCall('audit_query', {
        since: '2020-01-01',
        until: '2030-01-01',
      }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should accept limit parameter', async () => {
      const result = await handleToolCall('audit_query', {
        limit: 10,
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.entries.length).toBeLessThanOrEqual(10);
    });

    it('should reject limit exceeding max (1000)', async () => {
      const result = await handleToolCall('audit_query', { limit: 9999 }, manager);
      expect(result.isError).toBe(true);
    });

    it('should return count matching entries length', async () => {
      const result = await handleToolCall('audit_query', {}, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(data.entries.length);
    });
  });

  // ==================== audit_history ====================
  describe('audit_history tool', () => {
    it('should return history for existing entity', async () => {
      await seedGraph();
      const result = await handleToolCall('audit_history', {
        entityName: 'Alice',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.entityName).toBe('Alice');
      expect(data).toHaveProperty('entries');
      expect(data).toHaveProperty('count');
    });

    it('should return empty history for non-existent entity', async () => {
      const result = await handleToolCall('audit_history', {
        entityName: 'NonExistent',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(0);
    });

    it('should require entityName parameter', async () => {
      const result = await handleToolCall('audit_history', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject empty entityName', async () => {
      const result = await handleToolCall('audit_history', { entityName: '' }, manager);
      expect(result.isError).toBe(true);
    });

    it('should return count matching entries length', async () => {
      await seedGraph();
      const result = await handleToolCall('audit_history', { entityName: 'Alice' }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(data.entries.length);
    });
  });

  // ==================== rollback_operation ====================
  describe('rollback_operation tool', () => {
    it('should require auditEntryId parameter', async () => {
      const result = await handleToolCall('rollback_operation', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject empty auditEntryId', async () => {
      const result = await handleToolCall('rollback_operation', { auditEntryId: '' }, manager);
      expect(result.isError).toBe(true);
    });

    it('should handle rollback of non-existent entry gracefully', async () => {
      // Rollback attempt on non-existent entry — may error from GovernanceManager
      const result = await handleToolCall('rollback_operation', {
        auditEntryId: 'nonexistent-entry-id',
      }, manager);
      // Either succeeds or returns an error — should not throw
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should return text response on success or error', async () => {
      const result = await handleToolCall('rollback_operation', {
        auditEntryId: 'some-entry-id',
      }, manager);
      expect(result.content[0].type).toBe('text');
    });
  });
});
