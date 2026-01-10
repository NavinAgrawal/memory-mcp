#!/usr/bin/env node

/**
 * MCP Memory Server Entry Point
 *
 * This is the main entry point for the MCP memory server.
 * All core functionality is imported from @danielsimonjr/memoryjs.
 *
 * @module index
 */

import {
  logger,
  defaultMemoryPath,
  ensureMemoryFilePath,
  ManagerContext,
  // Re-export types for backward compatibility
  type Entity,
  type Relation,
  type KnowledgeGraph,
  type GraphStats,
  type ValidationReport,
  type ValidationIssue,
  type ValidationWarning,
  type SavedSearch,
  type TagAlias,
  type SearchResult,
  type BooleanQueryNode,
  type ImportResult,
  type CompressionResult,
} from '@danielsimonjr/memoryjs';
import { MCPServer } from './server/MCPServer.js';

// Re-export path utilities for backward compatibility
export { defaultMemoryPath, ensureMemoryFilePath };

// Re-export types for backward compatibility
export type {
  Entity,
  Relation,
  KnowledgeGraph,
  GraphStats,
  ValidationReport,
  ValidationIssue,
  ValidationWarning,
  SavedSearch,
  TagAlias,
  SearchResult,
  BooleanQueryNode,
  ImportResult,
  CompressionResult,
};

// Re-export ManagerContext (replaces KnowledgeGraphManager)
export { ManagerContext };

// Backward compatibility alias
export { ManagerContext as KnowledgeGraphManager };

let managerContext: ManagerContext;

async function main() {
  // Initialize memory file path with backward compatibility
  const memoryFilePath = await ensureMemoryFilePath();

  // Initialize manager context with the memory file path
  managerContext = new ManagerContext(memoryFilePath);

  // Initialize and start MCP server
  const server = new MCPServer(managerContext);
  await server.start();
}

main().catch((error) => {
  logger.error("Fatal error in main():", error);
  process.exit(1);
});
