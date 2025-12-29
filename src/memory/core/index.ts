/**
 * Core Module Barrel Export
 */

export { GraphStorage } from './GraphStorage.js';
export { EntityManager } from './EntityManager.js';
export { RelationManager } from './RelationManager.js';
export { KnowledgeGraphManager } from './KnowledgeGraphManager.js';
export {
  TransactionManager,
  OperationType,
  type TransactionOperation,
  type TransactionResult,
} from './TransactionManager.js';
