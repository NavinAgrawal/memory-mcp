#!/usr/bin/env node

import { logger, defaultMemoryPath, ensureMemoryFilePath } from './utils/index.js';
import { ManagerContext } from './core/ManagerContext.js';
import { MCPServer } from './server/MCPServer.js';
import type {
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
} from './types/index.js';

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
