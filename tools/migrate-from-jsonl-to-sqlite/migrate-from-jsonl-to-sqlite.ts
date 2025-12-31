#!/usr/bin/env node
/**
 * Memory MCP Migration Tool
 *
 * Migrates knowledge graph data between JSONL and SQLite storage formats.
 * This is a standalone tool that uses the @danielsimonjr/memory-mcp package.
 *
 * Usage:
 *   npx migrate-from-jsonl-to-sqlite --from memory.jsonl --to memory.db
 *   npx migrate-from-jsonl-to-sqlite --from memory.db --to memory.jsonl
 *
 * @module tools/migrate-from-jsonl-to-sqlite
 */

import { resolve, extname } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { readFile } from 'fs/promises';
import { createRequire } from 'module';
import { dirname, join } from 'path';

// ============================================================================
// Types (inline to avoid external dependencies)
// ============================================================================

interface Entity {
  name: string;
  entityType: string;
  observations: string[];
  createdAt?: string;
  lastModified?: string;
  tags?: string[];
  importance?: number | null;
  parentId?: string | null;
}

interface Relation {
  from: string;
  to: string;
  relationType: string;
  createdAt?: string;
  lastModified?: string;
}

interface KnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

interface MigrationOptions {
  from: string;
  to: string;
  verbose?: boolean;
}

// ============================================================================
// JSONL Storage (inline implementation)
// ============================================================================

async function loadFromJsonl(filePath: string): Promise<KnowledgeGraph> {
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    return { entities: [], relations: [] };
  }

  const content = readFileSync(absolutePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());

  const entities: Entity[] = [];
  const relations: Relation[] = [];
  const entityMap = new Map<string, Entity>();

  for (const line of lines) {
    try {
      const item = JSON.parse(line);
      if (item.type === 'entity') {
        const entity: Entity = {
          name: item.name,
          entityType: item.entityType,
          observations: item.observations || [],
          createdAt: item.createdAt,
          lastModified: item.lastModified,
          tags: item.tags,
          importance: item.importance,
          parentId: item.parentId,
        };
        entityMap.set(entity.name, entity);
      } else if (item.type === 'relation') {
        relations.push({
          from: item.from,
          to: item.to,
          relationType: item.relationType,
          createdAt: item.createdAt,
          lastModified: item.lastModified,
        });
      }
    } catch {
      // Skip invalid lines
    }
  }

  entities.push(...entityMap.values());
  return { entities, relations };
}

function saveToJsonl(filePath: string, graph: KnowledgeGraph): void {
  const absolutePath = resolve(filePath);
  const dir = dirname(absolutePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const lines: string[] = [];

  for (const entity of graph.entities) {
    lines.push(
      JSON.stringify({
        type: 'entity',
        name: entity.name,
        entityType: entity.entityType,
        observations: entity.observations,
        createdAt: entity.createdAt,
        lastModified: entity.lastModified,
        tags: entity.tags,
        importance: entity.importance,
        parentId: entity.parentId,
      })
    );
  }

  for (const relation of graph.relations) {
    lines.push(
      JSON.stringify({
        type: 'relation',
        from: relation.from,
        to: relation.to,
        relationType: relation.relationType,
        createdAt: relation.createdAt,
        lastModified: relation.lastModified,
      })
    );
  }

  writeFileSync(absolutePath, lines.join('\n') + '\n', 'utf-8');
}

// ============================================================================
// SQLite Storage (using sql.js)
// ============================================================================

let SQL: any = null;

async function initSqlJs(): Promise<any> {
  if (SQL) return SQL;

  const initSqlJs = (await import('sql.js')).default;

  // Load WASM binary from node_modules
  const require = createRequire(import.meta.url);
  const sqlJsPath = require.resolve('sql.js');
  const sqlJsDir = dirname(sqlJsPath);
  const wasmPath = join(sqlJsDir, 'sql-wasm.wasm');

  const wasmBuffer = await readFile(wasmPath);
  const wasmBinary = wasmBuffer.buffer.slice(
    wasmBuffer.byteOffset,
    wasmBuffer.byteOffset + wasmBuffer.byteLength
  );

  SQL = await initSqlJs({ wasmBinary });
  return SQL;
}

async function loadFromSqlite(filePath: string): Promise<KnowledgeGraph> {
  const absolutePath = resolve(filePath);
  const SQL = await initSqlJs();

  let db: any;

  if (existsSync(absolutePath)) {
    const buffer = readFileSync(absolutePath);
    db = new SQL.Database(buffer);
  } else {
    return { entities: [], relations: [] };
  }

  try {
    const entities: Entity[] = [];
    const relations: Relation[] = [];

    // Check if tables exist
    const tableCheck = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('entities', 'relations')"
    );
    if (tableCheck.length === 0 || tableCheck[0].values.length === 0) {
      return { entities: [], relations: [] };
    }

    // Load entities
    const entityResults = db.exec('SELECT * FROM entities');
    if (entityResults.length > 0) {
      const columns = entityResults[0].columns;
      for (const row of entityResults[0].values) {
        const entity: any = {};
        columns.forEach((col: string, i: number) => {
          entity[col] = row[i];
        });

        entities.push({
          name: entity.name,
          entityType: entity.entityType,
          observations: entity.observations ? JSON.parse(entity.observations) : [],
          createdAt: entity.createdAt,
          lastModified: entity.lastModified,
          tags: entity.tags ? JSON.parse(entity.tags) : undefined,
          importance: entity.importance,
          parentId: entity.parentId,
        });
      }
    }

    // Load relations
    const relationResults = db.exec('SELECT * FROM relations');
    if (relationResults.length > 0) {
      const columns = relationResults[0].columns;
      for (const row of relationResults[0].values) {
        const relation: any = {};
        columns.forEach((col: string, i: number) => {
          relation[col] = row[i];
        });

        relations.push({
          from: relation.fromEntity,
          to: relation.toEntity,
          relationType: relation.relationType,
          createdAt: relation.createdAt,
          lastModified: relation.lastModified,
        });
      }
    }

    return { entities, relations };
  } finally {
    db.close();
  }
}

async function saveToSqlite(filePath: string, graph: KnowledgeGraph): Promise<void> {
  const absolutePath = resolve(filePath);
  const SQL = await initSqlJs();
  const dir = dirname(absolutePath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const db = new SQL.Database();

  try {
    // Create tables
    db.run(`
      CREATE TABLE IF NOT EXISTS entities (
        name TEXT PRIMARY KEY,
        entityType TEXT NOT NULL,
        observations TEXT NOT NULL,
        createdAt TEXT,
        lastModified TEXT,
        tags TEXT,
        importance REAL,
        parentId TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fromEntity TEXT NOT NULL,
        toEntity TEXT NOT NULL,
        relationType TEXT NOT NULL,
        createdAt TEXT,
        lastModified TEXT,
        UNIQUE(fromEntity, toEntity, relationType)
      )
    `);

    // Create indexes
    db.run('CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entityType)');
    db.run('CREATE INDEX IF NOT EXISTS idx_entities_parent ON entities(parentId)');
    db.run('CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(fromEntity)');
    db.run('CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(toEntity)');

    // Insert entities
    const insertEntity = db.prepare(`
      INSERT OR REPLACE INTO entities
      (name, entityType, observations, createdAt, lastModified, tags, importance, parentId)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const entity of graph.entities) {
      insertEntity.run([
        entity.name,
        entity.entityType,
        JSON.stringify(entity.observations),
        entity.createdAt || null,
        entity.lastModified || null,
        entity.tags ? JSON.stringify(entity.tags) : null,
        entity.importance ?? null,
        entity.parentId || null,
      ]);
    }
    insertEntity.free();

    // Insert relations
    const insertRelation = db.prepare(`
      INSERT OR REPLACE INTO relations
      (fromEntity, toEntity, relationType, createdAt, lastModified)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const relation of graph.relations) {
      insertRelation.run([
        relation.from,
        relation.to,
        relation.relationType,
        relation.createdAt || null,
        relation.lastModified || null,
      ]);
    }
    insertRelation.free();

    // Save to file
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(absolutePath, buffer);
  } finally {
    db.close();
  }
}

// ============================================================================
// Migration Logic
// ============================================================================

function detectStorageType(filePath: string): 'jsonl' | 'sqlite' {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.jsonl' || ext === '.json') {
    return 'jsonl';
  }
  if (ext === '.db' || ext === '.sqlite' || ext === '.sqlite3') {
    return 'sqlite';
  }
  console.warn(`Unknown extension "${ext}", assuming JSONL format`);
  return 'jsonl';
}

async function migrate(options: MigrationOptions): Promise<void> {
  const { from, to, verbose = false } = options;

  const fromType = detectStorageType(from);
  const toType = detectStorageType(to);

  if (fromType === toType) {
    console.warn(`Warning: Both source and destination are ${fromType} format.`);
    console.warn('This will copy the data but not change the storage format.');
  }

  if (verbose) {
    console.log(`Migrating from ${fromType.toUpperCase()} to ${toType.toUpperCase()}`);
    console.log(`  Source: ${resolve(from)}`);
    console.log(`  Target: ${resolve(to)}`);
  }

  try {
    // Load data from source
    console.log('\n📖 Loading source data...');
    let graph: KnowledgeGraph;

    if (fromType === 'jsonl') {
      graph = await loadFromJsonl(from);
    } else {
      graph = await loadFromSqlite(from);
    }

    const entityCount = graph.entities.length;
    const relationCount = graph.relations.length;

    if (entityCount === 0 && relationCount === 0) {
      console.log('⚠️  Source graph is empty. Nothing to migrate.');
      return;
    }

    console.log(`   Found ${entityCount} entities and ${relationCount} relations`);

    // Write to target
    console.log('\n💾 Writing to target...');

    if (toType === 'jsonl') {
      saveToJsonl(to, graph);
    } else {
      await saveToSqlite(to, graph);
    }

    // Verify by reading back
    console.log('\n✅ Verifying migration...');
    let verifyGraph: KnowledgeGraph;

    if (toType === 'jsonl') {
      verifyGraph = await loadFromJsonl(to);
    } else {
      verifyGraph = await loadFromSqlite(to);
    }

    const verifyEntityCount = verifyGraph.entities.length;
    const verifyRelationCount = verifyGraph.relations.length;

    if (verifyEntityCount !== entityCount || verifyRelationCount !== relationCount) {
      console.error('❌ Verification failed!');
      console.error(`   Expected: ${entityCount} entities, ${relationCount} relations`);
      console.error(`   Got: ${verifyEntityCount} entities, ${verifyRelationCount} relations`);
      process.exit(1);
    }

    console.log('\n✨ Migration completed successfully!');
    console.log(`   Migrated ${entityCount} entities and ${relationCount} relations`);
    console.log(`   From: ${from} (${fromType})`);
    console.log(`   To:   ${to} (${toType})`);
  } catch (error) {
    console.error('\n❌ Migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// ============================================================================
// CLI
// ============================================================================

function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: Partial<MigrationOptions> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--from' || arg === '-f') {
      options.from = args[++i];
    } else if (arg === '--to' || arg === '-t') {
      options.to = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      if (!options.from) {
        options.from = arg;
      } else if (!options.to) {
        options.to = arg;
      }
    }
  }

  if (!options.from || !options.to) {
    console.error('Error: Both source (--from) and target (--to) paths are required.\n');
    printHelp();
    process.exit(1);
  }

  return options as MigrationOptions;
}

function printHelp(): void {
  console.log(`
Memory MCP Migration Tool
=========================

Migrate knowledge graph data between JSONL and SQLite storage formats.

USAGE:
  migrate-from-jsonl-to-sqlite --from <source> --to <target> [options]
  migrate-from-jsonl-to-sqlite <source> <target> [options]

ARGUMENTS:
  --from, -f <path>    Source file path (JSONL or SQLite)
  --to, -t <path>      Target file path (JSONL or SQLite)
  --verbose, -v        Show detailed progress
  --help, -h           Show this help message

EXAMPLES:
  # Migrate JSONL to SQLite
  migrate-from-jsonl-to-sqlite --from memory.jsonl --to memory.db

  # Migrate SQLite to JSONL
  migrate-from-jsonl-to-sqlite --from memory.db --to memory.jsonl

  # Using positional arguments
  migrate-from-jsonl-to-sqlite memory.jsonl memory.db

  # Verbose output
  migrate-from-jsonl-to-sqlite -f memory.jsonl -t memory.db -v

FILE EXTENSIONS:
  JSONL: .jsonl, .json
  SQLite: .db, .sqlite, .sqlite3

NOTES:
  - The target file will be created if it doesn't exist
  - If the target file exists, it will be overwritten
  - Migration preserves all entities, relations, and metadata
  - Saved searches and tag aliases are NOT migrated (they use separate files)
`);
}

// Run migration
const options = parseArgs();
migrate(options).catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
