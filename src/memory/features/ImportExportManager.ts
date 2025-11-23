/**
 * Import/Export Manager
 *
 * Orchestrates import and export operations with optional filtering.
 *
 * @module features/ImportExportManager
 */

import type { KnowledgeGraph, ImportResult } from '../types/index.js';
import type { BasicSearch } from '../search/BasicSearch.js';
import { ExportManager, type ExportFormat } from './ExportManager.js';
import { ImportManager, type ImportFormat, type MergeStrategy } from './ImportManager.js';

/**
 * Export filter criteria.
 */
export interface ExportFilter {
  /** Start date for filtering (ISO 8601) */
  startDate?: string;
  /** End date for filtering (ISO 8601) */
  endDate?: string;
  /** Entity type filter */
  entityType?: string;
  /** Tags filter */
  tags?: string[];
}

/**
 * Orchestrates import and export operations.
 */
export class ImportExportManager {
  private exportManager: ExportManager;
  private importManager: ImportManager;

  constructor(
    exportManager: ExportManager,
    importManager: ImportManager,
    private basicSearch: BasicSearch
  ) {
    this.exportManager = exportManager;
    this.importManager = importManager;
  }

  /**
   * Export graph to specified format with optional filtering.
   *
   * @param format - Export format
   * @param filter - Optional export filter
   * @returns Formatted export string
   */
  async exportGraph(format: ExportFormat, filter?: ExportFilter): Promise<string> {
    let graph: KnowledgeGraph;

    if (filter) {
      graph = await this.basicSearch.searchByDateRange(
        filter.startDate,
        filter.endDate,
        filter.entityType,
        filter.tags
      );
    } else {
      // Get full graph via basicSearch's storage
      graph = await (this.basicSearch as any).storage.loadGraph();
    }

    return this.exportManager.exportGraph(graph, format);
  }

  /**
   * Import graph from formatted data.
   *
   * @param format - Import format
   * @param data - Import data string
   * @param mergeStrategy - How to handle conflicts
   * @param dryRun - If true, preview changes without applying
   * @returns Import result with statistics
   */
  async importGraph(
    format: ImportFormat,
    data: string,
    mergeStrategy?: MergeStrategy,
    dryRun?: boolean
  ): Promise<ImportResult> {
    return this.importManager.importGraph(format, data, mergeStrategy, dryRun);
  }
}
