#!/usr/bin/env node
/**
 * Memory MCP Migration Tool
 *
 * Migrates knowledge graph data between JSONL and SQLite storage formats.
 *
 * Usage:
 *   npx mcp-memory-migrate --from memory.jsonl --to memory.db
 *   npx mcp-memory-migrate --from memory.db --to memory.jsonl
 *
 * @module tools/migrate
 */

import { GraphStorage } from '../core/GraphStorage.js';
import { SQLiteStorage } from '../core/SQLiteStorage.js';
import type { IGraphStorage } from '../types/index.js';
import { resolve, extname } from 'path';

interface MigrationOptions {
  from: string;
  to: string;
  verbose?: boolean;
}

/**
 * Detect storage type from file extension
 */
function detectStorageType(filePath: string): 'jsonl' | 'sqlite' {
  const ext = extname(filePath).toLowerCase();
  if (ext === '.jsonl' || ext === '.json') {
    return 'jsonl';
  }
  if (ext === '.db' || ext === '.sqlite' || ext === '.sqlite3') {
    return 'sqlite';
  }
  // Default to jsonl for unknown extensions
  console.warn(`Unknown extension "${ext}", assuming JSONL format`);
  return 'jsonl';
}

/**
 * Create storage instance based on type
 */
function createStorage(filePath: string, type: 'jsonl' | 'sqlite'): IGraphStorage {
  const absolutePath = resolve(filePath);
  if (type === 'sqlite') {
    return new SQLiteStorage(absolutePath);
  }
  return new GraphStorage(absolutePath);
}

/**
 * Migrate data between storage backends
 */
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

  // Create storage instances
  const sourceStorage = createStorage(from, fromType);
  const targetStorage = createStorage(to, toType);

  try {
    // Load data from source
    console.log('\n📖 Loading source data...');
    const sourceGraph = await sourceStorage.loadGraph();

    const entityCount = sourceGraph.entities.length;
    const relationCount = sourceGraph.relations.length;

    if (entityCount === 0 && relationCount === 0) {
      console.log('⚠️  Source graph is empty. Nothing to migrate.');
      return;
    }

    console.log(`   Found ${entityCount} entities and ${relationCount} relations`);

    // Create mutable copy for saveGraph (which expects mutable KnowledgeGraph)
    const graph = {
      entities: [...sourceGraph.entities],
      relations: [...sourceGraph.relations],
    };

    // Write to target
    console.log('\n💾 Writing to target...');
    await targetStorage.saveGraph(graph);

    // Verify by reading back
    console.log('\n✅ Verifying migration...');
    const verifyGraph = await targetStorage.loadGraph();

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

/**
 * Parse command line arguments
 */
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
      // Positional arguments: first is source, second is target
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

/**
 * Print usage help
 */
function printHelp(): void {
  console.log(`
Memory MCP Migration Tool
=========================

Migrate knowledge graph data between JSONL and SQLite storage formats.

USAGE:
  npx mcp-memory-migrate --from <source> --to <target> [options]
  npx mcp-memory-migrate <source> <target> [options]

ARGUMENTS:
  --from, -f <path>    Source file path (JSONL or SQLite)
  --to, -t <path>      Target file path (JSONL or SQLite)
  --verbose, -v        Show detailed progress
  --help, -h           Show this help message

EXAMPLES:
  # Migrate JSONL to SQLite
  npx mcp-memory-migrate --from memory.jsonl --to memory.db

  # Migrate SQLite to JSONL
  npx mcp-memory-migrate --from memory.db --to memory.jsonl

  # Using positional arguments
  npx mcp-memory-migrate memory.jsonl memory.db

  # Verbose output
  npx mcp-memory-migrate -f memory.jsonl -t memory.db -v

FILE EXTENSIONS:
  JSONL: .jsonl, .json
  SQLite: .db, .sqlite, .sqlite3

NOTES:
  - The target file will be created if it doesn't exist
  - If the target file exists, it will be overwritten
  - Migration preserves all entities, relations, and metadata
  - Both saved searches and tag aliases are NOT migrated (they use separate files)
`);
}

// Run migration
const options = parseArgs();
migrate(options).catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
