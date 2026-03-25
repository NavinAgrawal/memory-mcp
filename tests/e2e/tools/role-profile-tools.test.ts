/**
 * Role Profile Tools E2E Tests
 *
 * Tests for set_agent_role and list_role_profiles tools.
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
  testDir = await fs.mkdtemp(join(tmpdir(), 'role-profile-tools-'));
  memoryPath = join(testDir, 'memory.jsonl');
  await fs.writeFile(memoryPath, '');
  manager = new KnowledgeGraphManager(memoryPath);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

const VALID_ROLES = ['researcher', 'planner', 'executor', 'reviewer', 'default'] as const;

describe('Role Profile Tools E2E', () => {
  // ==================== set_agent_role ====================
  describe('set_agent_role tool', () => {
    it('should set role to researcher', async () => {
      const result = await handleToolCall('set_agent_role', { role: 'researcher' }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.role).toBe('researcher');
    });

    it('should set role to planner', async () => {
      const result = await handleToolCall('set_agent_role', { role: 'planner' }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.role).toBe('planner');
    });

    it('should set role to executor', async () => {
      const result = await handleToolCall('set_agent_role', { role: 'executor' }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.role).toBe('executor');
    });

    it('should set role to reviewer', async () => {
      const result = await handleToolCall('set_agent_role', { role: 'reviewer' }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.role).toBe('reviewer');
    });

    it('should set role to default', async () => {
      const result = await handleToolCall('set_agent_role', { role: 'default' }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.role).toBe('default');
    });

    it('should return profile with label', async () => {
      const result = await handleToolCall('set_agent_role', { role: 'researcher' }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('label');
      expect(typeof data.label).toBe('string');
    });

    it('should return salienceConfig in response', async () => {
      const result = await handleToolCall('set_agent_role', { role: 'researcher' }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('salienceConfig');
    });

    it('should return contextConfig in response', async () => {
      const result = await handleToolCall('set_agent_role', { role: 'researcher' }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('contextConfig');
    });

    it('should return message with role name', async () => {
      const result = await handleToolCall('set_agent_role', { role: 'planner' }, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('planner');
    });

    it('should accept all valid role values', async () => {
      for (const role of VALID_ROLES) {
        const result = await handleToolCall('set_agent_role', { role }, manager);
        expect(result.isError).toBeUndefined();
      }
    });

    it('should require role parameter', async () => {
      const result = await handleToolCall('set_agent_role', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject invalid role value', async () => {
      const result = await handleToolCall('set_agent_role', { role: 'superhero' }, manager);
      expect(result.isError).toBe(true);
    });

    it('should return MCP-compliant content array', async () => {
      const result = await handleToolCall('set_agent_role', { role: 'default' }, manager);
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
    });
  });

  // ==================== list_role_profiles ====================
  describe('list_role_profiles tool', () => {
    it('should return list of profiles', async () => {
      const result = await handleToolCall('list_role_profiles', {}, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('profiles');
      expect(data).toHaveProperty('count');
    });

    it('should include all expected roles', async () => {
      const result = await handleToolCall('list_role_profiles', {}, manager);
      const data = JSON.parse(result.content[0].text);
      // Should contain at least the 5 known roles
      expect(data.count).toBeGreaterThanOrEqual(5);
    });

    it('should return each profile with role and label', async () => {
      const result = await handleToolCall('list_role_profiles', {}, manager);
      const data = JSON.parse(result.content[0].text);
      for (const profile of data.profiles) {
        expect(profile).toHaveProperty('role');
        expect(profile).toHaveProperty('label');
      }
    });

    it('should return count matching profiles length', async () => {
      const result = await handleToolCall('list_role_profiles', {}, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(data.profiles.length);
    });

    it('should ignore extra parameters', async () => {
      const result = await handleToolCall('list_role_profiles', { extra: 'ignored' }, manager);
      expect(result.isError).toBeUndefined();
    });

    it('should return valid JSON', async () => {
      const result = await handleToolCall('list_role_profiles', {}, manager);
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('should include all known roles in the list', async () => {
      const result = await handleToolCall('list_role_profiles', {}, manager);
      const data = JSON.parse(result.content[0].text);
      const roleNames = data.profiles.map((p: { role: string }) => p.role);
      for (const role of VALID_ROLES) {
        expect(roleNames).toContain(role);
      }
    });
  });
});
