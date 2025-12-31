/**
 * Core Module Barrel Export
 */

export { GraphStorage } from './GraphStorage.js';
export { SQLiteStorage } from './SQLiteStorage.js';
export { EntityManager, type ArchiveCriteria, type ArchiveResult } from './EntityManager.js';
export { RelationManager } from './RelationManager.js';
export { ManagerContext } from './ManagerContext.js';
// Backward compatibility alias
export { ManagerContext as KnowledgeGraphManager } from './ManagerContext.js';
export {
  TransactionManager,
  OperationType,
  type TransactionOperation,
  type TransactionResult,
} from './TransactionManager.js';
export { createStorage, createStorageFromPath } from './StorageFactory.js';
