/**
 * Knowledge Graph Manager
 *
 * Main orchestrator that coordinates all knowledge graph operations.
 *
 * @module core/KnowledgeGraphManager
 */

import * as path from 'path';
import { GraphStorage } from './GraphStorage.js';
import { EntityManager } from './EntityManager.js';
import { RelationManager } from './RelationManager.js';
import { ObservationManager } from './ObservationManager.js';
import { SearchManager } from '../search/SearchManager.js';
import { TagManager } from '../features/TagManager.js';
import { HierarchyManager } from '../features/HierarchyManager.js';
import { AnalyticsManager } from '../features/AnalyticsManager.js';
import { CompressionManager } from '../features/CompressionManager.js';
import { ArchiveManager } from '../features/ArchiveManager.js';
import { ExportManager } from '../features/ExportManager.js';
import { ImportManager } from '../features/ImportManager.js';
import { ImportExportManager } from '../features/ImportExportManager.js';

/**
 * Main orchestrator for all knowledge graph operations.
 *
 * Coordinates between core managers, search, features, and import/export.
 */
export class KnowledgeGraphManager {
  // Core storage and managers
  private storage: GraphStorage;
  private entityManager: EntityManager;
  private relationManager: RelationManager;
  private observationManager: ObservationManager;

  // Search
  private searchManager: SearchManager;

  // Features
  private tagManager: TagManager;
  private hierarchyManager: HierarchyManager;
  private analyticsManager: AnalyticsManager;
  private compressionManager: CompressionManager;
  private archiveManager: ArchiveManager;

  // Import/Export
  private importExportManager: ImportExportManager;

  constructor(memoryFilePath: string) {
    // Initialize storage
    this.storage = new GraphStorage(memoryFilePath);

    // Initialize core managers
    this.entityManager = new EntityManager(this.storage);
    this.relationManager = new RelationManager(this.storage);
    this.observationManager = new ObservationManager(this.storage);

    // Initialize search with saved searches file
    const dir = path.dirname(memoryFilePath);
    const basename = path.basename(memoryFilePath, path.extname(memoryFilePath));
    const savedSearchesFilePath = path.join(dir, `${basename}-saved-searches.jsonl`);
    this.searchManager = new SearchManager(this.storage, savedSearchesFilePath);

    // Initialize feature managers
    const tagAliasesFilePath = path.join(dir, `${basename}-tag-aliases.jsonl`);
    this.tagManager = new TagManager(tagAliasesFilePath);
    this.hierarchyManager = new HierarchyManager(this.storage);
    this.analyticsManager = new AnalyticsManager(this.storage);
    this.compressionManager = new CompressionManager(this.storage);
    this.archiveManager = new ArchiveManager(this.storage);

    // Initialize import/export
    const exportManager = new ExportManager();
    const importManager = new ImportManager(this.storage);
    this.importExportManager = new ImportExportManager(
      exportManager,
      importManager,
      this.searchManager as any // BasicSearch is accessible through SearchManager
    );
  }

  // ==================== Entity Operations ====================

  get entities() {
    return this.entityManager;
  }

  // ==================== Relation Operations ====================

  get relations() {
    return this.relationManager;
  }

  // ==================== Observation Operations ====================

  get observations() {
    return this.observationManager;
  }

  // ==================== Search Operations ====================

  get search() {
    return this.searchManager;
  }

  // ==================== Tag Operations ====================

  get tags() {
    return this.tagManager;
  }

  // ==================== Hierarchy Operations ====================

  get hierarchy() {
    return this.hierarchyManager;
  }

  // ==================== Analytics Operations ====================

  get analytics() {
    return this.analyticsManager;
  }

  // ==================== Compression Operations ====================

  get compression() {
    return this.compressionManager;
  }

  // ==================== Archive Operations ====================

  get archive() {
    return this.archiveManager;
  }

  // ==================== Import/Export Operations ====================

  get importExport() {
    return this.importExportManager;
  }
}
