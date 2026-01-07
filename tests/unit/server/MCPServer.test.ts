/**
 * MCPServer Unit Tests
 *
 * Tests for MCP Server initialization, tool registration, and request handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPServer } from '../../../src/server/MCPServer.js';
import { KnowledgeGraphManager } from '../../../src/core/index.js';
import { toolDefinitions } from '../../../src/server/toolDefinitions.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Store mock instances for test assertions
let mockServerInstance: {
  info: unknown;
  options: unknown;
  setRequestHandler: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  _handlers: Map<unknown, unknown>;
  _getHandler: (schema: unknown) => unknown;
} | null = null;

let mockTransportInstance: {
  start: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
} | null = null;

// Mock the MCP SDK modules
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  // Create a mock class that can be instantiated with `new`
  const MockServer = class {
    info: unknown;
    options: unknown;
    setRequestHandler: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    _handlers: Map<unknown, unknown>;
    _getHandler: (schema: unknown) => unknown;

    constructor(info: unknown, options: unknown) {
      this.info = info;
      this.options = options;
      this._handlers = new Map();
      this.setRequestHandler = vi.fn((schema: unknown, handler: unknown) => {
        this._handlers.set(schema, handler);
      });
      this.connect = vi.fn().mockResolvedValue(undefined);
      this._getHandler = (schema: unknown) => this._handlers.get(schema);
      mockServerInstance = this;
    }
  };

  return {
    Server: MockServer,
  };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  const MockStdioServerTransport = class {
    start: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;

    constructor() {
      this.start = vi.fn();
      this.close = vi.fn();
      mockTransportInstance = this;
    }
  };

  return {
    StdioServerTransport: MockStdioServerTransport,
  };
});

vi.mock('@modelcontextprotocol/sdk/types.js', () => {
  return {
    ListToolsRequestSchema: { method: 'tools/list' },
    CallToolRequestSchema: { method: 'tools/call' },
  };
});

// Mock logger to avoid console output during tests
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('MCPServer', () => {
  let server: MCPServer;
  let manager: KnowledgeGraphManager;
  let testDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockServerInstance = null;
    mockTransportInstance = null;
    testDir = join(tmpdir(), `mcp-server-test-${Date.now()}-${Math.random()}`);
    await fs.mkdir(testDir, { recursive: true });
    testFilePath = join(testDir, 'test-graph.jsonl');
    manager = new KnowledgeGraphManager(testFilePath);
    server = new MCPServer(manager);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create server instance with manager context', () => {
      expect(server).toBeDefined();
    });

    it('should initialize MCP Server with correct name and version', () => {
      expect(mockServerInstance).toBeDefined();
      expect(mockServerInstance!.info).toEqual({
        name: 'memory-server',
        version: '0.8.0',
      });
      expect(mockServerInstance!.options).toEqual({
        capabilities: {
          tools: {},
        },
      });
    });

    it('should register tool handlers on construction', () => {
      expect(mockServerInstance).toBeDefined();
      expect(mockServerInstance!.setRequestHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('tool registration', () => {
    it('should register ListToolsRequestSchema handler', async () => {
      const { ListToolsRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      expect(mockServerInstance!.setRequestHandler).toHaveBeenCalledWith(
        ListToolsRequestSchema,
        expect.any(Function)
      );
    });

    it('should register CallToolRequestSchema handler', async () => {
      const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      expect(mockServerInstance!.setRequestHandler).toHaveBeenCalledWith(
        CallToolRequestSchema,
        expect.any(Function)
      );
    });

    it('should return all tool definitions when listing tools', async () => {
      const { ListToolsRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      const handler = mockServerInstance!._getHandler(ListToolsRequestSchema) as () => Promise<{ tools: typeof toolDefinitions }>;
      const result = await handler();

      expect(result).toEqual({ tools: toolDefinitions });
      expect(result.tools.length).toBeGreaterThan(0);
    });
  });

  describe('tool call handling', () => {
    it('should dispatch tool calls to handler', async () => {
      const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      const handler = mockServerInstance!._getHandler(CallToolRequestSchema) as (req: { params: { name: string; arguments: unknown } }) => Promise<{ content: Array<{ type: string; text: string }> }>;

      const result = await handler({
        params: {
          name: 'read_graph',
          arguments: {},
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should pass arguments to tool handler', async () => {
      const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      const handler = mockServerInstance!._getHandler(CallToolRequestSchema) as (req: { params: { name: string; arguments: unknown } }) => Promise<{ content: Array<{ type: string; text: string }> }>;

      const result = await handler({
        params: {
          name: 'create_entities',
          arguments: {
            entities: [
              { name: 'TestEntity', entityType: 'test', observations: ['Test observation'] },
            ],
          },
        },
      });

      expect(result.content[0].text).toContain('TestEntity');
    });

    it('should handle missing arguments gracefully', async () => {
      const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      const handler = mockServerInstance!._getHandler(CallToolRequestSchema) as (req: { params: { name: string; arguments: unknown } }) => Promise<{ content: Array<{ type: string; text: string }> }>;

      const result = await handler({
        params: {
          name: 'read_graph',
          arguments: undefined,
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should throw error for unknown tool', async () => {
      const { CallToolRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      const handler = mockServerInstance!._getHandler(CallToolRequestSchema) as (req: { params: { name: string; arguments: unknown } }) => Promise<{ content: Array<{ type: string; text: string }> }>;

      await expect(
        handler({
          params: {
            name: 'nonexistent_tool',
            arguments: {},
          },
        })
      ).rejects.toThrow('Unknown tool: nonexistent_tool');
    });
  });

  describe('start', () => {
    it('should connect to stdio transport', async () => {
      await server.start();

      expect(mockServerInstance!.connect).toHaveBeenCalledTimes(1);
    });

    it('should create StdioServerTransport', async () => {
      await server.start();

      expect(mockTransportInstance).toBeDefined();
    });

    it('should log startup message', async () => {
      const { logger } = await import('../../../src/utils/logger.js');

      await server.start();

      expect(logger.info).toHaveBeenCalledWith('Knowledge Graph MCP Server running on stdio');
    });
  });

  describe('server capabilities', () => {
    it('should declare tools capability', () => {
      expect(mockServerInstance).toBeDefined();
      expect(mockServerInstance!.options).toEqual({
        capabilities: {
          tools: {},
        },
      });
    });
  });

  describe('tool definitions consistency', () => {
    it('should have all tools available in definitions', async () => {
      const { ListToolsRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      const handler = mockServerInstance!._getHandler(ListToolsRequestSchema) as () => Promise<{ tools: Array<{ name: string; description: string; inputSchema: unknown }> }>;
      const result = await handler();

      // Verify we have a substantial number of tools
      expect(result.tools.length).toBeGreaterThanOrEqual(50);

      // Verify each tool has required properties
      for (const tool of result.tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe('string');
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe('string');
        expect(tool.inputSchema).toBeDefined();
      }
    });

    it('should include core entity tools', async () => {
      const { ListToolsRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      const handler = mockServerInstance!._getHandler(ListToolsRequestSchema) as () => Promise<{ tools: Array<{ name: string }> }>;
      const result = await handler();
      const toolNames = result.tools.map((t) => t.name);

      expect(toolNames).toContain('create_entities');
      expect(toolNames).toContain('delete_entities');
      expect(toolNames).toContain('read_graph');
      expect(toolNames).toContain('open_nodes');
    });

    it('should include search tools', async () => {
      const { ListToolsRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      const handler = mockServerInstance!._getHandler(ListToolsRequestSchema) as () => Promise<{ tools: Array<{ name: string }> }>;
      const result = await handler();
      const toolNames = result.tools.map((t) => t.name);

      expect(toolNames).toContain('search_nodes');
      expect(toolNames).toContain('fuzzy_search');
      expect(toolNames).toContain('boolean_search');
    });

    it('should include hierarchy tools', async () => {
      const { ListToolsRequestSchema } = await import('@modelcontextprotocol/sdk/types.js');

      const handler = mockServerInstance!._getHandler(ListToolsRequestSchema) as () => Promise<{ tools: Array<{ name: string }> }>;
      const result = await handler();
      const toolNames = result.tools.map((t) => t.name);

      expect(toolNames).toContain('set_entity_parent');
      expect(toolNames).toContain('get_children');
      expect(toolNames).toContain('get_ancestors');
    });
  });
});
