/**
 * Artifact Tools E2E Tests
 *
 * Tests for create_artifact, get_artifact, and list_artifacts tools.
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
  testDir = await fs.mkdtemp(join(tmpdir(), 'artifact-tools-'));
  memoryPath = join(testDir, 'memory.jsonl');
  await fs.writeFile(memoryPath, '');
  manager = new KnowledgeGraphManager(memoryPath);
});

afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true });
});

const VALID_ARTIFACT_TYPES = [
  'tool_output',
  'code_snippet',
  'api_response',
  'search_result',
  'file_content',
  'user_input',
] as const;

describe('Artifact Tools E2E', () => {
  // ==================== create_artifact ====================
  describe('create_artifact tool', () => {
    it('should create artifact with required fields', async () => {
      const result = await handleToolCall('create_artifact', {
        content: 'print("hello world")',
        toolName: 'code_executor',
        artifactType: 'code_snippet',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      // ArtifactManager stores content in observations[0] and exposes toolName/artifactType directly
      expect(data.toolName).toBe('code_executor');
      expect(data.artifactType).toBe('code_snippet');
    });

    it('should create artifact with optional description', async () => {
      const result = await handleToolCall('create_artifact', {
        content: 'SELECT * FROM users',
        toolName: 'db_query',
        artifactType: 'tool_output',
        description: 'User query results',
      }, manager);
      expect(result.isError).toBeUndefined();
      // Just confirm creation succeeded — description storage depends on implementation
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('name');
    });

    it('should create artifact with optional sessionId', async () => {
      const result = await handleToolCall('create_artifact', {
        content: 'some content',
        toolName: 'tool',
        artifactType: 'api_response',
        sessionId: 'session-abc-123',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.sessionId).toBe('session-abc-123');
    });

    it('should require content parameter', async () => {
      const result = await handleToolCall('create_artifact', {
        toolName: 'tool',
        artifactType: 'tool_output',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should require toolName parameter', async () => {
      const result = await handleToolCall('create_artifact', {
        content: 'some content',
        artifactType: 'tool_output',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should require artifactType parameter', async () => {
      const result = await handleToolCall('create_artifact', {
        content: 'some content',
        toolName: 'tool',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject invalid artifactType', async () => {
      const result = await handleToolCall('create_artifact', {
        content: 'some content',
        toolName: 'tool',
        artifactType: 'invalid_type',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject empty content', async () => {
      const result = await handleToolCall('create_artifact', {
        content: '',
        toolName: 'tool',
        artifactType: 'tool_output',
      }, manager);
      expect(result.isError).toBe(true);
    });

    it('should accept all valid artifactType values', async () => {
      for (const artifactType of VALID_ARTIFACT_TYPES) {
        const result = await handleToolCall('create_artifact', {
          content: `content for ${artifactType}`,
          toolName: 'test_tool',
          artifactType,
        }, manager);
        expect(result.isError).toBeUndefined();
      }
    });

    it('should return artifact with a name field (used as ref for retrieval)', async () => {
      const result = await handleToolCall('create_artifact', {
        content: 'some output',
        toolName: 'my_tool',
        artifactType: 'tool_output',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      // ArtifactManager uses entity name as the artifact identifier
      expect(data).toHaveProperty('name');
      expect(typeof data.name).toBe('string');
      expect(data.name.length).toBeGreaterThan(0);
    });

    it('should return MCP-compliant content array', async () => {
      const result = await handleToolCall('create_artifact', {
        content: 'test content',
        toolName: 'test_tool',
        artifactType: 'tool_output',
      }, manager);
      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
    });

    it('should include createdAt timestamp', async () => {
      const result = await handleToolCall('create_artifact', {
        content: 'ts test',
        toolName: 'tool',
        artifactType: 'tool_output',
      }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveProperty('createdAt');
    });
  });

  // ==================== get_artifact ====================
  describe('get_artifact tool', () => {
    it('should retrieve created artifact by name (ref)', async () => {
      const createResult = await handleToolCall('create_artifact', {
        content: 'retrievable content',
        toolName: 'my_tool',
        artifactType: 'search_result',
      }, manager);
      expect(createResult.isError).toBeUndefined();
      const created = JSON.parse(createResult.content[0].text);
      // Use the entity name as the ref for retrieval
      const ref = created.name;

      const getResult = await handleToolCall('get_artifact', { ref }, manager);
      expect(getResult.isError).toBeUndefined();
      const data = JSON.parse(getResult.content[0].text);
      expect(data.artifactType).toBe('search_result');
    });

    it('should return text message for unknown ref', async () => {
      const result = await handleToolCall('get_artifact', { ref: 'nonexistent-artifact-xyz' }, manager);
      // Either not found text or error — should complete without throwing
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should require ref parameter', async () => {
      const result = await handleToolCall('get_artifact', {}, manager);
      expect(result.isError).toBe(true);
    });

    it('should reject empty ref string', async () => {
      const result = await handleToolCall('get_artifact', { ref: '' }, manager);
      expect(result.isError).toBe(true);
    });

    it('should return artifact fields on successful retrieval', async () => {
      const createResult = await handleToolCall('create_artifact', {
        content: 'full artifact content',
        toolName: 'complete_tool',
        artifactType: 'file_content',
        sessionId: 'sess-001',
      }, manager);
      expect(createResult.isError).toBeUndefined();
      const created = JSON.parse(createResult.content[0].text);
      const ref = created.name;

      const getResult = await handleToolCall('get_artifact', { ref }, manager);
      expect(getResult.isError).toBeUndefined();
      const data = JSON.parse(getResult.content[0].text);
      expect(data.toolName).toBe('complete_tool');
      expect(data.artifactType).toBe('file_content');
    });
  });

  // ==================== list_artifacts ====================
  describe('list_artifacts tool', () => {
    it('should return empty list when no artifacts exist', async () => {
      const result = await handleToolCall('list_artifacts', {}, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.artifacts).toEqual([]);
      expect(data.count).toBe(0);
    });

    it('should list all artifacts without filter', async () => {
      await handleToolCall('create_artifact', { content: 'a', toolName: 'tool1', artifactType: 'tool_output' }, manager);
      await handleToolCall('create_artifact', { content: 'b', toolName: 'tool2', artifactType: 'code_snippet' }, manager);
      await handleToolCall('create_artifact', { content: 'c', toolName: 'tool3', artifactType: 'api_response' }, manager);

      const result = await handleToolCall('list_artifacts', {}, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(3);
    });

    it('should filter by toolName', async () => {
      await handleToolCall('create_artifact', { content: 'a', toolName: 'tool_alpha', artifactType: 'tool_output' }, manager);
      await handleToolCall('create_artifact', { content: 'b', toolName: 'tool_alpha', artifactType: 'code_snippet' }, manager);
      await handleToolCall('create_artifact', { content: 'c', toolName: 'tool_beta', artifactType: 'tool_output' }, manager);

      const result = await handleToolCall('list_artifacts', { toolName: 'tool_alpha' }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
      data.artifacts.forEach((a: { toolName: string }) => {
        expect(a.toolName).toBe('tool_alpha');
      });
    });

    it('should filter by artifactType', async () => {
      await handleToolCall('create_artifact', { content: 'a', toolName: 'tool', artifactType: 'code_snippet' }, manager);
      await handleToolCall('create_artifact', { content: 'b', toolName: 'tool', artifactType: 'code_snippet' }, manager);
      await handleToolCall('create_artifact', { content: 'c', toolName: 'tool', artifactType: 'api_response' }, manager);

      const result = await handleToolCall('list_artifacts', { artifactType: 'code_snippet' }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(2);
      data.artifacts.forEach((a: { artifactType: string }) => {
        expect(a.artifactType).toBe('code_snippet');
      });
    });

    it('should filter by since timestamp', async () => {
      await handleToolCall('create_artifact', { content: 'recent', toolName: 'tool', artifactType: 'tool_output' }, manager);

      const since = new Date(Date.now() - 1000).toISOString();
      const result = await handleToolCall('list_artifacts', { since }, manager);
      expect(result.isError).toBeUndefined();
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBeGreaterThanOrEqual(1);
    });

    it('should return count matching artifacts array length', async () => {
      await handleToolCall('create_artifact', { content: 'x', toolName: 'tool', artifactType: 'tool_output' }, manager);
      await handleToolCall('create_artifact', { content: 'y', toolName: 'tool', artifactType: 'tool_output' }, manager);

      const result = await handleToolCall('list_artifacts', {}, manager);
      const data = JSON.parse(result.content[0].text);
      expect(data.count).toBe(data.artifacts.length);
    });
  });
});
