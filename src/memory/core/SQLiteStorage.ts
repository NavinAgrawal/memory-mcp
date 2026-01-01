/**
 * SQLite Storage
 *
 * Handles storage operations for the knowledge graph using better-sqlite3 (native SQLite).
 * Implements IGraphStorage interface for storage abstraction.
 *
 * Benefits over sql.js (WASM):
 * - 3-10x faster than WASM-based SQLite
 * - Native FTS5 full-text search support
 * - ACID transactions with proper durability
 * - Concurrent read access support
 * - No memory overhead from WASM runtime
 * - Direct disk I/O (no manual export/import)
 *
 * Features:
 * - Built-in indexes for O(1) lookups
 * - Referential integrity with ON DELETE CASCADE
 * - FTS5 full-text search on entity names and observations
 *
 * @module core/SQLiteStorage
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { KnowledgeGraph, Entity, Relation, ReadonlyKnowledgeGraph, IGraphStorage, LowercaseData } from '../types/index.js';
import { clearAllSearchCaches } from '../utils/searchCache.js';

/**
 * SQLiteStorage manages persistence of the knowledge graph using native SQLite.
 *
 * Uses better-sqlite3 for native SQLite bindings with full FTS5 support,
 * referential integrity, and proper ACID transactions.
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
   * SQLite database instance.
   */
  private db: DatabaseType | null = null;

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
   * Note: better-sqlite3 writes to disk immediately, but we track for API compatibility.
   */
  private pendingChanges: number = 0;

  /**
   * Create a new SQLiteStorage instance.
   *
   * @param dbFilePath - Absolute path to the SQLite database file
   */
  constructor(private dbFilePath: string) {}

  /**
   * Initialize the database connection and schema.
   */
  private initialize(): void {
    if (this.initialized) return;

    // Open database (creates file if it doesn't exist)
    this.db = new Database(this.dbFilePath);

    // Enable foreign keys and WAL mode for better performance
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');

    // Create tables and indexes
    this.createTables();

    // Load cache from database
    this.loadCache();

    this.initialized = true;
  }

  /**
   * Create database tables, indexes, and FTS5 virtual table.
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Entities table with referential integrity for parentId
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        name TEXT PRIMARY KEY,
        entityType TEXT NOT NULL,
        observations TEXT NOT NULL,
        tags TEXT,
        importance INTEGER,
        parentId TEXT REFERENCES entities(name) ON DELETE SET NULL,
        createdAt TEXT NOT NULL,
        lastModified TEXT NOT NULL
      )
    `);

    // Relations table with referential integrity (CASCADE delete)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS relations (
        fromEntity TEXT NOT NULL REFERENCES entities(name) ON DELETE CASCADE,
        toEntity TEXT NOT NULL REFERENCES entities(name) ON DELETE CASCADE,
        relationType TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        lastModified TEXT NOT NULL,
        PRIMARY KEY (fromEntity, toEntity, relationType)
      )
    `);

    // Indexes for fast lookups
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_entity_type ON entities(entityType)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_entity_parent ON entities(parentId)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_relation_from ON relations(fromEntity)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_relation_to ON relations(toEntity)`);

    // FTS5 virtual table for full-text search
    // content='' makes it an external content table (we manage content ourselves)
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
        name,
        entityType,
        observations,
        tags,
        content='entities',
        content_rowid='rowid'
      )
    `);

    // Triggers to keep FTS5 index in sync with entities table
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
        INSERT INTO entities_fts(rowid, name, entityType, observations, tags)
        VALUES (NEW.rowid, NEW.name, NEW.entityType, NEW.observations, NEW.tags);
      END
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
        INSERT INTO entities_fts(entities_fts, rowid, name, entityType, observations, tags)
        VALUES ('delete', OLD.rowid, OLD.name, OLD.entityType, OLD.observations, OLD.tags);
      END
    `);

    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
        INSERT INTO entities_fts(entities_fts, rowid, name, entityType, observations, tags)
        VALUES ('delete', OLD.rowid, OLD.name, OLD.entityType, OLD.observations, OLD.tags);
        INSERT INTO entities_fts(rowid, name, entityType, observations, tags)
        VALUES (NEW.rowid, NEW.name, NEW.entityType, NEW.observations, NEW.tags);
      END
    `);
  }

  /**
   * Load all data from SQLite into memory cache.
   */
  private loadCache(): void {
    if (!this.db) throw new Error('Database not initialized');

    const entities: Entity[] = [];
    const relations: Relation[] = [];

    // Load entities
    const entityRows = this.db.prepare(`SELECT * FROM entities`).all() as EntityRow[];
    for (const row of entityRows) {
      const entity = this.rowToEntity(row);
      entities.push(entity);
      this.updateLowercaseCache(entity);
    }

    // Load relations
    const relationRows = this.db.prepare(`SELECT * FROM relations`).all() as RelationRow[];
    for (const row of relationRows) {
      relations.push(this.rowToRelation(row));
    }

    this.cache = { entities, relations };
  }

  /**
   * Convert a database row to an Entity object.
   */
  private rowToEntity(row: EntityRow): Entity {
    return {
      name: row.name,
      entityType: row.entityType,
      observations: JSON.parse(row.observations),
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      importance: row.importance ?? undefined,
      parentId: row.parentId ?? undefined,
      createdAt: row.createdAt,
      lastModified: row.lastModified,
    };
  }

  /**
   * Convert a database row to a Relation object.
   */
  private rowToRelation(row: RelationRow): Relation {
    return {
      from: row.fromEntity,
      to: row.toEntity,
      relationType: row.relationType,
      createdAt: row.createdAt,
      lastModified: row.lastModified,
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
      this.initialize();
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

    // Disable foreign keys for bulk replace operation
    // This allows inserting entities with parentId references that may not exist
    // and relations with dangling references (which matches the original JSONL behavior)
    this.db.pragma('foreign_keys = OFF');

    // Use transaction for atomicity
    const transaction = this.db.transaction(() => {
      // Clear existing data
      this.db!.exec('DELETE FROM relations');
      this.db!.exec('DELETE FROM entities');

      // Insert all entities
      const entityStmt = this.db!.prepare(`
        INSERT INTO entities (name, entityType, observations, tags, importance, parentId, createdAt, lastModified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const entity of graph.entities) {
        entityStmt.run(
          entity.name,
          entity.entityType,
          JSON.stringify(entity.observations),
          entity.tags ? JSON.stringify(entity.tags) : null,
          entity.importance ?? null,
          entity.parentId ?? null,
          entity.createdAt || new Date().toISOString(),
          entity.lastModified || new Date().toISOString(),
        );
      }

      // Insert all relations
      const relationStmt = this.db!.prepare(`
        INSERT INTO relations (fromEntity, toEntity, relationType, createdAt, lastModified)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const relation of graph.relations) {
        relationStmt.run(
          relation.from,
          relation.to,
          relation.relationType,
          relation.createdAt || new Date().toISOString(),
          relation.lastModified || new Date().toISOString(),
        );
      }
    });

    transaction();

    // Re-enable foreign keys for future operations
    this.db.pragma('foreign_keys = ON');

    // Update cache
    this.cache = graph;
    this.lowercaseCache.clear();
    for (const entity of graph.entities) {
      this.updateLowercaseCache(entity);
    }

    this.pendingChanges = 0;

    // Clear search caches
    clearAllSearchCaches();
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
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entities (name, entityType, observations, tags, importance, parentId, createdAt, lastModified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entity.name,
      entity.entityType,
      JSON.stringify(entity.observations),
      entity.tags ? JSON.stringify(entity.tags) : null,
      entity.importance ?? null,
      entity.parentId ?? null,
      entity.createdAt || new Date().toISOString(),
      entity.lastModified || new Date().toISOString(),
    );

    // Update cache
    const existingIndex = this.cache!.entities.findIndex(e => e.name === entity.name);
    if (existingIndex >= 0) {
      this.cache!.entities[existingIndex] = entity;
    } else {
      this.cache!.entities.push(entity);
    }

    this.updateLowercaseCache(entity);
    clearAllSearchCaches();

    this.pendingChanges++;
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
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO relations (fromEntity, toEntity, relationType, createdAt, lastModified)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      relation.from,
      relation.to,
      relation.relationType,
      relation.createdAt || new Date().toISOString(),
      relation.lastModified || new Date().toISOString(),
    );

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

    this.pendingChanges++;
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
    const stmt = this.db.prepare(`
      UPDATE entities SET
        entityType = ?,
        observations = ?,
        tags = ?,
        importance = ?,
        parentId = ?,
        lastModified = ?
      WHERE name = ?
    `);

    stmt.run(
      entity.entityType,
      JSON.stringify(entity.observations),
      entity.tags ? JSON.stringify(entity.tags) : null,
      entity.importance ?? null,
      entity.parentId ?? null,
      entity.lastModified,
      entityName,
    );

    this.updateLowercaseCache(entity);
    clearAllSearchCaches();

    this.pendingChanges++;

    return true;
  }

  /**
   * Compact the storage (runs VACUUM to reclaim space).
   *
   * @returns Promise resolving when compaction is complete
   */
  async compact(): Promise<void> {
    await this.ensureLoaded();

    if (!this.db) return;

    // Run SQLite VACUUM to reclaim space and defragment
    this.db.exec('VACUUM');

    // Rebuild FTS index for optimal search performance
    this.db.exec(`INSERT INTO entities_fts(entities_fts) VALUES('rebuild')`);

    this.pendingChanges = 0;
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

  // ==================== FTS5 Full-Text Search ====================

  /**
   * Perform full-text search using FTS5.
   *
   * @param query - Search query (supports FTS5 query syntax)
   * @returns Array of matching entity names with relevance scores
   */
  fullTextSearch(query: string): Array<{ name: string; score: number }> {
    if (!this.db || !this.initialized) return [];

    try {
      // Use FTS5 MATCH for full-text search with BM25 ranking
      const stmt = this.db.prepare(`
        SELECT name, bm25(entities_fts, 10, 5, 3, 1) as score
        FROM entities_fts
        WHERE entities_fts MATCH ?
        ORDER BY score
        LIMIT 100
      `);

      const results = stmt.all(query) as Array<{ name: string; score: number }>;
      return results;
    } catch {
      // If FTS query fails (invalid syntax), fall back to empty results
      return [];
    }
  }

  /**
   * Perform a simple text search (LIKE-based, case-insensitive).
   *
   * @param searchTerm - Term to search for
   * @returns Array of matching entity names
   */
  simpleSearch(searchTerm: string): string[] {
    if (!this.db || !this.initialized) return [];

    const pattern = `%${searchTerm}%`;
    const stmt = this.db.prepare(`
      SELECT name FROM entities
      WHERE name LIKE ? COLLATE NOCASE
         OR entityType LIKE ? COLLATE NOCASE
         OR observations LIKE ? COLLATE NOCASE
         OR tags LIKE ? COLLATE NOCASE
    `);

    const results = stmt.all(pattern, pattern, pattern, pattern) as Array<{ name: string }>;
    return results.map(r => r.name);
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
   * @returns Number of pending changes since last reset
   */
  getPendingAppends(): number {
    return this.pendingChanges;
  }

  /**
   * Force persistence to disk (no-op for better-sqlite3 as it writes immediately).
   *
   * @returns Promise resolving when persistence is complete
   */
  async flush(): Promise<void> {
    // better-sqlite3 writes to disk immediately, but we run a checkpoint for WAL mode
    if (this.db) {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    }
    this.pendingChanges = 0;
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

// ==================== Type Definitions for Database Rows ====================

interface EntityRow {
  name: string;
  entityType: string;
  observations: string;
  tags: string | null;
  importance: number | null;
  parentId: string | null;
  createdAt: string;
  lastModified: string;
}

interface RelationRow {
  fromEntity: string;
  toEntity: string;
  relationType: string;
  createdAt: string;
  lastModified: string;
}
