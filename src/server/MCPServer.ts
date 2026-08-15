/**
 * MCP Server
 *
 * Handles Model Context Protocol server initialization and tool registration.
 * Tool definitions and handlers are extracted to separate modules for maintainability.
 *
 * @module server/MCPServer
 */

import { createRequire } from 'node:module';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { logger, type ManagerContext } from '@danielsimonjr/memoryjs';
import { toolDefinitions } from './toolDefinitions.js';
import { handleToolCall } from './toolHandlers.js';

const require = createRequire(import.meta.url);
/**
 * Injected by scripts/build-bundle.mjs (esbuild `define`) for the plugin bundle;
 * undefined in the plain `tsc` build, which falls back to reading package.json.
 */
declare const __PKG_VERSION__: string | undefined;

// `require('../../package.json')` resolves from dist/server/ but NOT from
// bundle/index.mjs, where it threw "Cannot find module '../../package.json'" and
// killed the server on startup. The injected constant is used when present; the
// `typeof` guard is safe on an undeclared identifier and lets esbuild
// dead-code-eliminate the require branch in the bundle.
const version: string =
  typeof __PKG_VERSION__ === 'string'
    ? __PKG_VERSION__
    : (require('../../package.json') as { version: string }).version;

/**
 * MCP Server for Knowledge Graph operations.
 * Exposes tools for entity/relation management, search, and analysis.
 */
export class MCPServer {
  private server: Server;
  private ctx: ManagerContext;

  constructor(ctx: ManagerContext) {
    this.ctx = ctx;
    this.server = new Server(
      {
        name: "memory-server",
        version,
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
      return handleToolCall(name, args || {}, this.ctx);
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('Knowledge Graph MCP Server running on stdio');
  }
}
