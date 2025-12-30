/**
 * Core Module Barrel Export
 */

export { GraphStorage } from './GraphStorage.js';
export { EntityManager, type ArchiveCriteria, type ArchiveResult } from './EntityManager.js';
export { RelationManager } from './RelationManager.js';
export { KnowledgeGraphManager } from './KnowledgeGraphManager.js';
export {
  TransactionManager,
  OperationType,
  type TransactionOperation,
  type TransactionResult,
} from './TransactionManager.js';
