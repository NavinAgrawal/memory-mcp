/**
 * Transaction Manager
 *
 * Provides atomic transaction support for knowledge graph operations.
 * Ensures data consistency by allowing multiple operations to be
 * grouped together and committed atomically, with automatic rollback on failure.
 *
 * @module core/TransactionManager
 */

import type { Entity, Relation, KnowledgeGraph } from '../types/index.js';
import type { GraphStorage } from './GraphStorage.js';
import { IOManager } from '../features/IOManager.js';
import { KnowledgeGraphError } from '../utils/errors.js';

/**
 * Types of operations that can be performed in a transaction.
 */
export enum OperationType {
  CREATE_ENTITY = 'CREATE_ENTITY',
  UPDATE_ENTITY = 'UPDATE_ENTITY',
  DELETE_ENTITY = 'DELETE_ENTITY',
  CREATE_RELATION = 'CREATE_RELATION',
  DELETE_RELATION = 'DELETE_RELATION',
}

/**
 * Represents a single operation in a transaction using discriminated union.
 */
export type TransactionOperation =
  | {
      type: OperationType.CREATE_ENTITY;
      data: Omit<Entity, 'createdAt' | 'lastModified'>;
    }
  | {
      type: OperationType.UPDATE_ENTITY;
      data: { name: string; updates: Partial<Entity> };
    }
  | {
      type: OperationType.DELETE_ENTITY;
      data: { name: string };
    }
  | {
      type: OperationType.CREATE_RELATION;
      data: Omit<Relation, 'createdAt' | 'lastModified'>;
    }
  | {
      type: OperationType.DELETE_RELATION;
      data: { from: string; to: string; relationType: string };
    };

/**
 * Transaction execution result.
 */
export interface TransactionResult {
  /** Whether the transaction was successful */
  success: boolean;
  /** Number of operations executed */
  operationsExecuted: number;
  /** Error message if transaction failed */
  error?: string;
  /** Path to rollback backup if created */
  rollbackBackup?: string;
}

/**
 * Manages atomic transactions for knowledge graph operations.
 *
 * Provides ACID-like guarantees:
 * - Atomicity: All operations succeed or all fail
 * - Consistency: Graph is always in a valid state
 * - Isolation: Each transaction operates on a snapshot
 * - Durability: Changes are persisted to disk
 *
 * @example
 * ```typescript
 * const storage = new GraphStorage('/data/memory.jsonl');
 * const txManager = new TransactionManager(storage);
 *
 * // Begin transaction
 * txManager.begin();
 *
 * // Stage operations
 * txManager.createEntity({ name: 'Alice', entityType: 'person', observations: [] });
 * txManager.createRelation({ from: 'Alice', to: 'Bob', relationType: 'knows' });
 *
 * // Commit atomically (or rollback on error)
 * const result = await txManager.commit();
 * if (result.success) {
 *   console.log(`Transaction completed: ${result.operationsExecuted} operations`);
 * }
 * ```
 */
export class TransactionManager {
  private operations: TransactionOperation[] = [];
  private inTransaction: boolean = false;
  private ioManager: IOManager;
  private transactionBackup?: string;

  constructor(private storage: GraphStorage) {
    this.ioManager = new IOManager(storage);
  }

  /**
   * Begin a new transaction.
   *
   * Creates a backup of the current state for rollback purposes.
   * Only one transaction can be active at a time.
   *
   * @throws {KnowledgeGraphError} If a transaction is already in progress
   *
   * @example
   * ```typescript
   * txManager.begin();
   * // ... stage operations ...
   * await txManager.commit();
   * ```
   */
  begin(): void {
    if (this.inTransaction) {
      throw new KnowledgeGraphError('Transaction already in progress', 'TRANSACTION_ACTIVE');
    }

    this.operations = [];
    this.inTransaction = true;
  }

  /**
   * Stage a create entity operation.
   *
   * @param entity - Entity to create (without timestamps)
   *
   * @example
   * ```typescript
   * txManager.begin();
   * txManager.createEntity({
   *   name: 'Alice',
   *   entityType: 'person',
   *   observations: ['Software engineer'],
   *   importance: 8
   * });
   * ```
   */
  createEntity(entity: Omit<Entity, 'createdAt' | 'lastModified'>): void {
    this.ensureInTransaction();
    this.operations.push({
      type: OperationType.CREATE_ENTITY,
      data: entity,
    });
  }

  /**
   * Stage an update entity operation.
   *
   * @param name - Name of entity to update
   * @param updates - Partial entity updates
   *
   * @example
   * ```typescript
   * txManager.begin();
   * txManager.updateEntity('Alice', {
   *   importance: 9,
   *   observations: ['Lead software engineer']
   * });
   * ```
   */
  updateEntity(name: string, updates: Partial<Entity>): void {
    this.ensureInTransaction();
    this.operations.push({
      type: OperationType.UPDATE_ENTITY,
      data: { name, updates },
    });
  }

  /**
   * Stage a delete entity operation.
   *
   * @param name - Name of entity to delete
   *
   * @example
   * ```typescript
   * txManager.begin();
   * txManager.deleteEntity('OldEntity');
   * ```
   */
  deleteEntity(name: string): void {
    this.ensureInTransaction();
    this.operations.push({
      type: OperationType.DELETE_ENTITY,
      data: { name },
    });
  }

  /**
   * Stage a create relation operation.
   *
   * @param relation - Relation to create (without timestamps)
   *
   * @example
   * ```typescript
   * txManager.begin();
   * txManager.createRelation({
   *   from: 'Alice',
   *   to: 'Bob',
   *   relationType: 'mentors'
   * });
   * ```
   */
  createRelation(relation: Omit<Relation, 'createdAt' | 'lastModified'>): void {
    this.ensureInTransaction();
    this.operations.push({
      type: OperationType.CREATE_RELATION,
      data: relation,
    });
  }

  /**
   * Stage a delete relation operation.
   *
   * @param from - Source entity name
   * @param to - Target entity name
   * @param relationType - Type of relation
   *
   * @example
   * ```typescript
   * txManager.begin();
   * txManager.deleteRelation('Alice', 'Bob', 'mentors');
   * ```
   */
  deleteRelation(from: string, to: string, relationType: string): void {
    this.ensureInTransaction();
    this.operations.push({
      type: OperationType.DELETE_RELATION,
      data: { from, to, relationType },
    });
  }

  /**
   * Commit the transaction, applying all staged operations atomically.
   *
   * Creates a backup before applying changes. If any operation fails,
   * automatically rolls back to the pre-transaction state.
   *
   * @returns Promise resolving to transaction result
   *
   * @example
   * ```typescript
   * txManager.begin();
   * txManager.createEntity({ name: 'Alice', entityType: 'person', observations: [] });
   * txManager.createRelation({ from: 'Alice', to: 'Bob', relationType: 'knows' });
   *
   * const result = await txManager.commit();
   * if (result.success) {
   *   console.log(`Committed ${result.operationsExecuted} operations`);
   * } else {
   *   console.error(`Transaction failed: ${result.error}`);
   * }
   * ```
   */
  async commit(): Promise<TransactionResult> {
    this.ensureInTransaction();

    try {
      // Create backup for rollback
      this.transactionBackup = await this.ioManager.createBackup(
        'Transaction backup (auto-created)'
      );

      // Load mutable copy of graph for transaction
      const graph = await this.storage.getGraphForMutation();
      const timestamp = new Date().toISOString();

      // Apply all operations
      let operationsExecuted = 0;
      for (const operation of this.operations) {
        this.applyOperation(graph, operation, timestamp);
        operationsExecuted++;
      }

      // Save the modified graph
      await this.storage.saveGraph(graph);

      // Clean up transaction state
      this.inTransaction = false;
      this.operations = [];

      // Delete the transaction backup (no longer needed)
      if (this.transactionBackup) {
        await this.ioManager.deleteBackup(this.transactionBackup);
        this.transactionBackup = undefined;
      }

      return {
        success: true,
        operationsExecuted,
      };
    } catch (error) {
      // Rollback on error
      const rollbackResult = await this.rollback();

      return {
        success: false,
        operationsExecuted: 0,
        error: error instanceof Error ? error.message : String(error),
        rollbackBackup: rollbackResult.backupUsed,
      };
    }
  }

  /**
   * Rollback the current transaction.
   *
   * Restores the graph to the pre-transaction state using the backup.
   * Automatically called by commit() on failure.
   *
   * @returns Promise resolving to rollback result
   *
   * @example
   * ```typescript
   * txManager.begin();
   * txManager.createEntity({ name: 'Test', entityType: 'temp', observations: [] });
   *
   * // Explicit rollback (e.g., user cancellation)
   * const result = await txManager.rollback();
   * console.log(`Rolled back, restored from: ${result.backupUsed}`);
   * ```
   */
  async rollback(): Promise<{ success: boolean; backupUsed?: string }> {
    if (!this.transactionBackup) {
      this.inTransaction = false;
      this.operations = [];
      return { success: false };
    }

    try {
      // Restore from backup
      await this.ioManager.restoreFromBackup(this.transactionBackup);

      // Clean up
      const backupUsed = this.transactionBackup;
      await this.ioManager.deleteBackup(this.transactionBackup);

      this.inTransaction = false;
      this.operations = [];
      this.transactionBackup = undefined;

      return { success: true, backupUsed };
    } catch (error) {
      // Rollback failed - keep backup for manual recovery
      this.inTransaction = false;
      this.operations = [];

      return { success: false, backupUsed: this.transactionBackup };
    }
  }

  /**
   * Check if a transaction is currently in progress.
   *
   * @returns True if transaction is active
   */
  isInTransaction(): boolean {
    return this.inTransaction;
  }

  /**
   * Get the number of staged operations in the current transaction.
   *
   * @returns Number of operations staged
   */
  getOperationCount(): number {
    return this.operations.length;
  }

  /**
   * Ensure a transaction is in progress, or throw an error.
   *
   * @private
   */
  private ensureInTransaction(): void {
    if (!this.inTransaction) {
      throw new KnowledgeGraphError('No transaction in progress. Call begin() first.', 'NO_TRANSACTION');
    }
  }

  /**
   * Apply a single operation to the graph.
   *
   * @private
   */
  private applyOperation(graph: KnowledgeGraph, operation: TransactionOperation, timestamp: string): void {
    switch (operation.type) {
      case OperationType.CREATE_ENTITY: {
        const entity: Entity = {
          ...operation.data,
          createdAt: timestamp,
          lastModified: timestamp,
        };
        // Check for duplicates
        if (graph.entities.some(e => e.name === entity.name)) {
          throw new KnowledgeGraphError(`Entity "${entity.name}" already exists`, 'DUPLICATE_ENTITY');
        }
        graph.entities.push(entity);
        break;
      }

      case OperationType.UPDATE_ENTITY: {
        const { name, updates } = operation.data;
        const entity = graph.entities.find(e => e.name === name);
        if (!entity) {
          throw new KnowledgeGraphError(`Entity "${name}" not found`, 'ENTITY_NOT_FOUND');
        }
        Object.assign(entity, updates);
        entity.lastModified = timestamp;
        break;
      }

      case OperationType.DELETE_ENTITY: {
        const { name } = operation.data;
        const index = graph.entities.findIndex(e => e.name === name);
        if (index === -1) {
          throw new KnowledgeGraphError(`Entity "${name}" not found`, 'ENTITY_NOT_FOUND');
        }
        graph.entities.splice(index, 1);
        // Delete related relations
        graph.relations = graph.relations.filter(r => r.from !== name && r.to !== name);
        break;
      }

      case OperationType.CREATE_RELATION: {
        const relation: Relation = {
          ...operation.data,
          createdAt: timestamp,
          lastModified: timestamp,
        };
        // Check for duplicates
        const exists = graph.relations.some(
          r => r.from === relation.from && r.to === relation.to && r.relationType === relation.relationType
        );
        if (exists) {
          throw new KnowledgeGraphError(
            `Relation "${relation.from}" -> "${relation.to}" (${relation.relationType}) already exists`,
            'DUPLICATE_RELATION'
          );
        }
        graph.relations.push(relation);
        break;
      }

      case OperationType.DELETE_RELATION: {
        const { from, to, relationType } = operation.data;
        const index = graph.relations.findIndex(
          r => r.from === from && r.to === to && r.relationType === relationType
        );
        if (index === -1) {
          throw new KnowledgeGraphError(
            `Relation "${from}" -> "${to}" (${relationType}) not found`,
            'RELATION_NOT_FOUND'
          );
        }
        graph.relations.splice(index, 1);
        break;
      }

      default: {
        // Exhaustiveness check - TypeScript will error if we miss a case
        const _exhaustiveCheck: never = operation;
        throw new KnowledgeGraphError(`Unknown operation type: ${(_exhaustiveCheck as TransactionOperation).type}`, 'UNKNOWN_OPERATION');
      }
    }
  }
}
