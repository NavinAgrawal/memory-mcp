/**
 * MCP Server
 *
 * Handles Model Context Protocol server initialization and tool registration.
 * Tool definitions and handlers are extracted to separate modules for maintainability.
 *
 * @module server/MCPServer
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from '../utils/logger.js';
import { toolDefinitions } from './toolDefinitions.js';
import { handleToolCall } from './toolHandlers.js';
import type { KnowledgeGraphManager } from '../index.js';

/**
 * MCP Server for Knowledge Graph operations.
 * Exposes tools for entity/relation management, search, and analysis.
 */
export class MCPServer {
  private server: Server;
  private manager: KnowledgeGraphManager;

  constructor(manager: KnowledgeGraphManager) {
    this.manager = manager;
    this.server = new Server(
      {
        name: "memory-server",
        version: "0.8.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerToolHandlers();
  }

  private registerToolHandlers() {
    // Register list tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: toolDefinitions,
      };
    });

    // Register call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return handleToolCall(name, args || {}, this.manager);
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Knowledge Graph MCP Server running on stdio');
  }
}
