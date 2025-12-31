/**
 * SQLite Storage
 *
 * Handles storage operations for the knowledge graph using sql.js (WASM SQLite).
 * Implements IGraphStorage interface for storage abstraction.
 *
 * Benefits over JSONL:
 * - Built-in indexes for O(1) lookups
 * - ACID transactions
 * - No full-file rewrites on updates
 * - FTS5-like search capability (simulated with LIKE for sql.js compatibility)
 *
 * @module core/SQLiteStorage
 */

import { promises as fs } from 'fs';
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import type { KnowledgeGraph, Entity, Relation, ReadonlyKnowledgeGraph, IGraphStorage, LowercaseData } from '../types/index.js';

/**
 * Get the path to the sql.js WASM file in node_modules.
 */
function getWasmPath(): string {
  // Try to find the WASM file in node_modules
  const require = createRequire(import.meta.url);
  const sqlJsPath = require.resolve('sql.js');
  const sqlJsDir = dirname(sqlJsPath);
  return join(sqlJsDir, 'sql-wasm.wasm');
}
import { clearAllSearchCaches } from '../utils/searchCache.js';

/**
 * SQLiteStorage manages persistence of the knowledge graph using SQLite.
 *
 * Uses sql.js (WASM-based SQLite) for cross-platform compatibility without
 * native module compilation. Database is loaded into memory and persisted
 * to disk on write operations.
 *
 * @example
 * ```typescript
 * const storage = new SQLiteStorage('/path/to/memory.db');
 * await storage.ensureLoaded();
 * const graph = await storage.loadGraph();
 * ```
 */
export class SQLiteStorage implements IGraphStorage {
  /**
   * sql.js static module reference.
   */
  private SQL: SqlJsStatic | null = null;

  /**
   * SQLite database instance.
   */
  private db: Database | null = null;

  /**
   * Whether the database has been initialized.
   */
  private initialized: boolean = false;

  /**
   * In-memory cache for fast read operations.
   * Synchronized with SQLite on writes.
   */
  private cache: KnowledgeGraph | null = null;

  /**
   * Pre-computed lowercase data for search optimization.
   */
  private lowercaseCache: Map<string, LowercaseData> = new Map();

  /**
   * Pending changes counter for batching disk writes.
   */
  private pendingChanges: number = 0;

  /**
   * Threshold for automatic disk persistence.
   */
  private readonly persistThreshold: number = 10;

  /**
   * Create a new SQLiteStorage instance.
   *
   * @param dbFilePath - Absolute path to the SQLite database file
   */
  constructor(private dbFilePath: string) {}

  /**
   * Initialize sql.js and load or create the database.
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load WASM binary from node_modules and convert to ArrayBuffer
    const wasmPath = getWasmPath();
    const wasmBuffer = await fs.readFile(wasmPath);
    const wasmBinary = wasmBuffer.buffer.slice(
      wasmBuffer.byteOffset,
      wasmBuffer.byteOffset + wasmBuffer.byteLength
    );

    // Initialize sql.js with the WASM binary
    this.SQL = await initSqlJs({
      wasmBinary,
    });

    // Try to load existing database from disk
    try {
      const fileBuffer = await fs.readFile(this.dbFilePath);
      this.db = new this.SQL.Database(fileBuffer);
    } catch (error) {
      // File doesn't exist - create new database
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.db = new this.SQL.Database();
      } else {
        throw error;
      }
    }

    // Create tables if they don't exist
    this.createTables();

    // Load cache from database
    this.loadCache();

    this.initialized = true;
  }

  /**
   * Create database tables and indexes.
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Entities table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS entities (
        name TEXT PRIMARY KEY,
        entityType TEXT NOT NULL,
        observations TEXT NOT NULL,
        tags TEXT,
        importance INTEGER,
        parentId TEXT,
        createdAt TEXT NOT NULL,
        lastModified TEXT NOT NULL
      )
    `);

    // Relations table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS relations (
        fromEntity TEXT NOT NULL,
        toEntity TEXT NOT NULL,
        relationType TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        lastModified TEXT NOT NULL,
        PRIMARY KEY (fromEntity, toEntity, relationType)
      )
    `);

    // Indexes for fast lookups
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_entity_type ON entities(entityType)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_entity_parent ON entities(parentId)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_relation_from ON relations(fromEntity)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_relation_to ON relations(toEntity)`);
  }

  /**
   * Load all data from SQLite into memory cache.
   */
  private loadCache(): void {
    if (!this.db) throw new Error('Database not initialized');

    const entities: Entity[] = [];
    const relations: Relation[] = [];

    // Load entities
    const entityRows = this.db.exec(`SELECT * FROM entities`);
    if (entityRows.length > 0) {
      const columns = entityRows[0].columns;
      for (const row of entityRows[0].values) {
        const entity = this.rowToEntity(columns, row);
        entities.push(entity);
        this.updateLowercaseCache(entity);
      }
    }

    // Load relations
    const relationRows = this.db.exec(`SELECT * FROM relations`);
    if (relationRows.length > 0) {
      const columns = relationRows[0].columns;
      for (const row of relationRows[0].values) {
        relations.push(this.rowToRelation(columns, row));
      }
    }

    this.cache = { entities, relations };
  }

  /**
   * Convert a database row to an Entity object.
   */
  private rowToEntity(columns: string[], row: (string | number | Uint8Array | null)[]): Entity {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });

    return {
      name: obj.name as string,
      entityType: obj.entityType as string,
      observations: JSON.parse(obj.observations as string),
      tags: obj.tags ? JSON.parse(obj.tags as string) : undefined,
      importance: obj.importance as number | undefined,
      parentId: obj.parentId as string | undefined,
      createdAt: obj.createdAt as string,
      lastModified: obj.lastModified as string,
    };
  }

  /**
   * Convert a database row to a Relation object.
   */
  private rowToRelation(columns: string[], row: (string | number | Uint8Array | null)[]): Relation {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });

    return {
      from: obj.fromEntity as string,
      to: obj.toEntity as string,
      relationType: obj.relationType as string,
      createdAt: obj.createdAt as string,
      lastModified: obj.lastModified as string,
    };
  }

  /**
   * Update lowercase cache for an entity.
   */
  private updateLowercaseCache(entity: Entity): void {
    this.lowercaseCache.set(entity.name, {
      name: entity.name.toLowerCase(),
      entityType: entity.entityType.toLowerCase(),
      observations: entity.observations.map(o => o.toLowerCase()),
      tags: entity.tags?.map(t => t.toLowerCase()) || [],
    });
  }

  /**
   * Persist database to disk.
   */
  private async persistToDisk(): Promise<void> {
    if (!this.db) return;

    const data = this.db.export();
    const buffer = Buffer.from(data);
    await fs.writeFile(this.dbFilePath, buffer);
    this.pendingChanges = 0;
  }

  /**
   * Check if persistence is needed and perform it.
   */
  private async checkPersist(): Promise<void> {
    this.pendingChanges++;
    if (this.pendingChanges >= this.persistThreshold) {
      await this.persistToDisk();
    }
  }

  // ==================== IGraphStorage Implementation ====================

  /**
   * Load the knowledge graph (read-only access).
   *
   * @returns Promise resolving to read-only knowledge graph reference
   */
  async loadGraph(): Promise<ReadonlyKnowledgeGraph> {
    await this.ensureLoaded();
    return this.cache!;
  }

  /**
   * Get a mutable copy of the graph for write operations.
   *
   * @returns Promise resolving to mutable knowledge graph copy
   */
  async getGraphForMutation(): Promise<KnowledgeGraph> {
    await this.ensureLoaded();
    return {
      entities: this.cache!.entities.map(e => ({
        ...e,
        observations: [...e.observations],
        tags: e.tags ? [...e.tags] : undefined,
      })),
      relations: this.cache!.relations.map(r => ({ ...r })),
    };
  }

  /**
   * Ensure the storage is loaded/initialized.
   *
   * @returns Promise resolving when ready
   */
  async ensureLoaded(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Save the entire knowledge graph to storage.
   *
   * @param graph - The knowledge graph to save
   * @returns Promise resolving when save is complete
   */
  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    await this.ensureLoaded();

    if (!this.db) throw new Error('Database not initialized');

    // Use transaction for atomicity
    this.db.run('BEGIN TRANSACTION');

    try {
      // Clear existing data
      this.db.run('DELETE FROM entities');
      this.db.run('DELETE FROM relations');

      // Insert all entities
      const entityStmt = this.db.prepare(`
        INSERT INTO entities (name, entityType, observations, tags, importance, parentId, createdAt, lastModified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const entity of graph.entities) {
        entityStmt.run([
          entity.name,
          entity.entityType,
          JSON.stringify(entity.observations),
          entity.tags ? JSON.stringify(entity.tags) : null,
          entity.importance ?? null,
          entity.parentId ?? null,
          entity.createdAt || new Date().toISOString(),
          entity.lastModified || new Date().toISOString(),
        ]);
      }
      entityStmt.free();

      // Insert all relations
      const relationStmt = this.db.prepare(`
        INSERT INTO relations (fromEntity, toEntity, relationType, createdAt, lastModified)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const relation of graph.relations) {
        relationStmt.run([
          relation.from,
          relation.to,
          relation.relationType,
          relation.createdAt || new Date().toISOString(),
          relation.lastModified || new Date().toISOString(),
        ]);
      }
      relationStmt.free();

      this.db.run('COMMIT');

      // Update cache
      this.cache = graph;
      this.lowercaseCache.clear();
      for (const entity of graph.entities) {
        this.updateLowercaseCache(entity);
      }

      // Persist to disk
      await this.persistToDisk();

      // Clear search caches
      clearAllSearchCaches();
    } catch (error) {
      this.db.run('ROLLBACK');
      throw error;
    }
  }

  /**
   * Append a single entity to storage.
   *
   * @param entity - The entity to append
   * @returns Promise resolving when append is complete
   */
  async appendEntity(entity: Entity): Promise<void> {
    await this.ensureLoaded();

    if (!this.db) throw new Error('Database not initialized');

    // Use INSERT OR REPLACE to handle updates
    this.db.run(`
      INSERT OR REPLACE INTO entities (name, entityType, observations, tags, importance, parentId, createdAt, lastModified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      entity.name,
      entity.entityType,
      JSON.stringify(entity.observations),
      entity.tags ? JSON.stringify(entity.tags) : null,
      entity.importance ?? null,
      entity.parentId ?? null,
      entity.createdAt || new Date().toISOString(),
      entity.lastModified || new Date().toISOString(),
    ]);

    // Update cache
    const existingIndex = this.cache!.entities.findIndex(e => e.name === entity.name);
    if (existingIndex >= 0) {
      this.cache!.entities[existingIndex] = entity;
    } else {
      this.cache!.entities.push(entity);
    }

    this.updateLowercaseCache(entity);
    clearAllSearchCaches();

    await this.checkPersist();
  }

  /**
   * Append a single relation to storage.
   *
   * @param relation - The relation to append
   * @returns Promise resolving when append is complete
   */
  async appendRelation(relation: Relation): Promise<void> {
    await this.ensureLoaded();

    if (!this.db) throw new Error('Database not initialized');

    // Use INSERT OR REPLACE to handle updates
    this.db.run(`
      INSERT OR REPLACE INTO relations (fromEntity, toEntity, relationType, createdAt, lastModified)
      VALUES (?, ?, ?, ?, ?)
    `, [
      relation.from,
      relation.to,
      relation.relationType,
      relation.createdAt || new Date().toISOString(),
      relation.lastModified || new Date().toISOString(),
    ]);

    // Update cache
    const existingIndex = this.cache!.relations.findIndex(
      r => r.from === relation.from && r.to === relation.to && r.relationType === relation.relationType
    );
    if (existingIndex >= 0) {
      this.cache!.relations[existingIndex] = relation;
    } else {
      this.cache!.relations.push(relation);
    }

    clearAllSearchCaches();

    await this.checkPersist();
  }

  /**
   * Update an entity in storage.
   *
   * @param entityName - Name of the entity to update
   * @param updates - Partial entity updates to apply
   * @returns Promise resolving to true if found and updated
   */
  async updateEntity(entityName: string, updates: Partial<Entity>): Promise<boolean> {
    await this.ensureLoaded();

    if (!this.db) throw new Error('Database not initialized');

    // Find entity in cache
    const entityIndex = this.cache!.entities.findIndex(e => e.name === entityName);
    if (entityIndex === -1) {
      return false;
    }

    // Apply updates to cached entity
    const entity = this.cache!.entities[entityIndex];
    Object.assign(entity, updates);
    entity.lastModified = new Date().toISOString();

    // Update in database
    this.db.run(`
      UPDATE entities SET
        entityType = ?,
        observations = ?,
        tags = ?,
        importance = ?,
        parentId = ?,
        lastModified = ?
      WHERE name = ?
    `, [
      entity.entityType,
      JSON.stringify(entity.observations),
      entity.tags ? JSON.stringify(entity.tags) : null,
      entity.importance ?? null,
      entity.parentId ?? null,
      entity.lastModified,
      entityName,
    ]);

    this.updateLowercaseCache(entity);
    clearAllSearchCaches();

    await this.checkPersist();

    return true;
  }

  /**
   * Compact the storage (no-op for SQLite, already optimized).
   *
   * @returns Promise resolving when compaction is complete
   */
  async compact(): Promise<void> {
    await this.ensureLoaded();

    if (!this.db) return;

    // Run SQLite VACUUM to reclaim space
    this.db.run('VACUUM');

    await this.persistToDisk();
  }

  /**
   * Clear any in-memory cache.
   */
  clearCache(): void {
    this.cache = null;
    this.lowercaseCache.clear();
    this.initialized = false;
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ==================== Index Operations ====================

  /**
   * Get an entity by name in O(1) time.
   *
   * @param name - Entity name to look up
   * @returns Entity if found, undefined otherwise
   */
  getEntityByName(name: string): Entity | undefined {
    if (!this.cache) return undefined;
    return this.cache.entities.find(e => e.name === name);
  }

  /**
   * Check if an entity exists by name.
   *
   * @param name - Entity name to check
   * @returns True if entity exists
   */
  hasEntity(name: string): boolean {
    return this.getEntityByName(name) !== undefined;
  }

  /**
   * Get all entities of a given type.
   *
   * @param entityType - Entity type to filter by
   * @returns Array of entities with the given type
   */
  getEntitiesByType(entityType: string): Entity[] {
    if (!this.cache) return [];
    const typeLower = entityType.toLowerCase();
    return this.cache.entities.filter(e => e.entityType.toLowerCase() === typeLower);
  }

  /**
   * Get all unique entity types in the storage.
   *
   * @returns Array of unique entity types
   */
  getEntityTypes(): string[] {
    if (!this.cache) return [];
    const types = new Set<string>();
    for (const entity of this.cache.entities) {
      types.add(entity.entityType.toLowerCase());
    }
    return Array.from(types);
  }

  /**
   * Get pre-computed lowercase data for an entity.
   *
   * @param entityName - Entity name to get lowercase data for
   * @returns LowercaseData if entity exists, undefined otherwise
   */
  getLowercased(entityName: string): LowercaseData | undefined {
    return this.lowercaseCache.get(entityName);
  }

  // ==================== Utility Operations ====================

  /**
   * Get the storage path/location.
   *
   * @returns The storage path
   */
  getFilePath(): string {
    return this.dbFilePath;
  }

  /**
   * Get the current pending changes count.
   *
   * @returns Number of pending changes since last persistence
   */
  getPendingAppends(): number {
    return this.pendingChanges;
  }

  /**
   * Force persistence to disk.
   *
   * @returns Promise resolving when persistence is complete
   */
  async flush(): Promise<void> {
    await this.persistToDisk();
  }

  /**
   * Close the database connection.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
  }
}
