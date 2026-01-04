/**
 * Streaming Export Module
 *
 * Provides streaming export functionality for large knowledge graphs to avoid
 * loading entire graphs into memory. Supports JSONL and CSV formats with
 * incremental writing to disk.
 *
 * @module features/StreamingExporter
 */

import { createWriteStream } from 'fs';
import type { Entity, ReadonlyKnowledgeGraph } from '../types/types.js';

/**
 * Result summary from a streaming export operation.
 *
 * Provides statistics about the export including bytes written,
 * entity/relation counts, and duration.
 *
 * @example
 * ```typescript
 * const result: StreamResult = {
 *   bytesWritten: 125000,
 *   entitiesWritten: 150,
 *   relationsWritten: 320,
 *   durationMs: 1250
 * };
 * ```
 */
export interface StreamResult {
  /** Total bytes written to the output file */
  bytesWritten: number;

  /** Number of entities written */
  entitiesWritten: number;

  /** Number of relations written */
  relationsWritten: number;

  /** Duration of the export operation in milliseconds */
  durationMs: number;
}

/**
 * Streaming exporter for knowledge graphs.
 *
 * Provides memory-efficient export by streaming data directly to files
 * instead of building large strings in memory. Supports JSONL and CSV formats.
 *
 * @example
 * ```typescript
 * const exporter = new StreamingExporter('/path/to/output.jsonl');
 * const result = await exporter.streamJSONL(graph);
 * console.log(`Wrote ${result.bytesWritten} bytes in ${result.durationMs}ms`);
 * ```
 */
export class StreamingExporter {
  /**
   * Create a new streaming exporter.
   *
   * @param filePath - Path to the output file
   */
  constructor(private readonly filePath: string) {}

  /**
   * Stream a knowledge graph to JSONL format.
   *
   * Each entity and relation is written as a separate JSON line.
   * Memory usage is constant regardless of graph size.
   *
   * @param graph - The knowledge graph to export
   * @returns Promise resolving to export statistics
   *
   * @example
   * ```typescript
   * const exporter = new StreamingExporter('export.jsonl');
   * const result = await exporter.streamJSONL(graph);
   * console.log(`Exported ${result.entitiesWritten} entities`);
   * ```
   */
  async streamJSONL(graph: ReadonlyKnowledgeGraph): Promise<StreamResult> {
    const start = Date.now();
    let bytesWritten = 0;
    let entitiesWritten = 0;
    let relationsWritten = 0;

    const writeStream = createWriteStream(this.filePath);

    // Write entities
    for (const entity of graph.entities) {
      const line = JSON.stringify(entity) + '\n';
      writeStream.write(line);
      bytesWritten += Buffer.byteLength(line, 'utf-8');
      entitiesWritten++;
    }

    // Write relations
    for (const relation of graph.relations) {
      const line = JSON.stringify(relation) + '\n';
      writeStream.write(line);
      bytesWritten += Buffer.byteLength(line, 'utf-8');
      relationsWritten++;
    }

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on('error', reject);
    });

    return {
      bytesWritten,
      entitiesWritten,
      relationsWritten,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Stream a knowledge graph to CSV format.
   *
   * Exports entities as CSV rows with proper escaping for special characters.
   * Header row includes: name, type, observations, tags, importance, createdAt, lastModified.
   *
   * @param graph - The knowledge graph to export
   * @returns Promise resolving to export statistics
   *
   * @example
   * ```typescript
   * const exporter = new StreamingExporter('export.csv');
   * const result = await exporter.streamCSV(graph);
   * console.log(`Exported ${result.entitiesWritten} entities as CSV`);
   * ```
   */
  async streamCSV(graph: ReadonlyKnowledgeGraph): Promise<StreamResult> {
    const start = Date.now();
    let bytesWritten = 0;
    let entitiesWritten = 0;
    const relationsWritten = 0; // CSV format doesn't export relations

    const writeStream = createWriteStream(this.filePath);

    // Write header
    const header = 'name,type,observations,tags,importance,createdAt,lastModified\n';
    writeStream.write(header);
    bytesWritten += Buffer.byteLength(header, 'utf-8');

    // Write entity rows
    for (const entity of graph.entities) {
      const row = this.entityToCSVRow(entity) + '\n';
      writeStream.write(row);
      bytesWritten += Buffer.byteLength(row, 'utf-8');
      entitiesWritten++;
    }

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on('error', reject);
    });

    return {
      bytesWritten,
      entitiesWritten,
      relationsWritten,
      durationMs: Date.now() - start,
    };
  }

  /**
   * Convert an entity to a CSV row with proper escaping.
   *
   * Escapes double quotes by doubling them and wraps fields in quotes.
   * Arrays (observations, tags) are joined with semicolons.
   *
   * @param entity - The entity to convert
   * @returns CSV row string (without trailing newline)
   *
   * @private
   */
  private entityToCSVRow(entity: Entity): string {
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;

    return [
      escape(entity.name),
      escape(entity.entityType),
      escape(entity.observations.join('; ')),
      escape((entity.tags ?? []).join('; ')),
      entity.importance?.toString() ?? '',
      entity.createdAt ?? '',
      entity.lastModified ?? '',
    ].join(',');
  }

}
