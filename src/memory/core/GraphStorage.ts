/**
 * Graph Storage
 *
 * Handles file I/O operations for the knowledge graph using JSONL format.
 * Provides persistence layer abstraction for graph data.
 *
 * @module core/GraphStorage
 */

import { promises as fs } from 'fs';
import type { KnowledgeGraph, Entity, Relation } from '../types/index.js';

/**
 * GraphStorage manages persistence of the knowledge graph to disk.
 *
 * Uses JSONL (JSON Lines) format where each line is a separate JSON object
 * representing either an entity or a relation.
 *
 * @example
 * ```typescript
 * const storage = new GraphStorage('/path/to/memory.jsonl');
 * const graph = await storage.loadGraph();
 * graph.entities.push(newEntity);
 * await storage.saveGraph(graph);
 * ```
 */
export class GraphStorage {
  /**
   * Create a new GraphStorage instance.
   *
   * @param memoryFilePath - Absolute path to the JSONL file
   */
  constructor(private memoryFilePath: string) {}

  /**
   * Load the knowledge graph from disk.
   *
   * Reads the JSONL file and reconstructs the graph structure.
   * Returns empty graph if file doesn't exist.
   *
   * @returns Promise resolving to the loaded knowledge graph
   * @throws Error if file exists but cannot be read or parsed
   */
  async loadGraph(): Promise<KnowledgeGraph> {
    try {
      const data = await fs.readFile(this.memoryFilePath, 'utf-8');
      const lines = data.split('\n').filter((line: string) => line.trim() !== '');

      return lines.reduce((graph: KnowledgeGraph, line: string) => {
        const item = JSON.parse(line);

        if (item.type === 'entity') {
          // Add createdAt if missing for backward compatibility
          if (!item.createdAt) item.createdAt = new Date().toISOString();
          // Add lastModified if missing for backward compatibility
          if (!item.lastModified) item.lastModified = item.createdAt;

          graph.entities.push(item as Entity);
        }

        if (item.type === 'relation') {
          // Add createdAt if missing for backward compatibility
          if (!item.createdAt) item.createdAt = new Date().toISOString();
          // Add lastModified if missing for backward compatibility
          if (!item.lastModified) item.lastModified = item.createdAt;

          graph.relations.push(item as Relation);
        }

        return graph;
      }, { entities: [], relations: [] });
    } catch (error) {
      // File doesn't exist - return empty graph
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        return { entities: [], relations: [] };
      }
      throw error;
    }
  }

  /**
   * Save the knowledge graph to disk.
   *
   * Writes the graph to JSONL format, with one JSON object per line.
   *
   * @param graph - The knowledge graph to save
   * @returns Promise resolving when save is complete
   * @throws Error if file cannot be written
   */
  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    const lines = [
      ...graph.entities.map(e => {
        const entityData: any = {
          type: 'entity',
          name: e.name,
          entityType: e.entityType,
          observations: e.observations,
          createdAt: e.createdAt,
          lastModified: e.lastModified,
        };

        // Only include optional fields if they exist
        if (e.tags !== undefined) entityData.tags = e.tags;
        if (e.importance !== undefined) entityData.importance = e.importance;
        if (e.parentId !== undefined) entityData.parentId = e.parentId;

        return JSON.stringify(entityData);
      }),
      ...graph.relations.map(r =>
        JSON.stringify({
          type: 'relation',
          from: r.from,
          to: r.to,
          relationType: r.relationType,
          createdAt: r.createdAt,
          lastModified: r.lastModified,
        })
      ),
    ];

    await fs.writeFile(this.memoryFilePath, lines.join('\n'));
  }

  /**
   * Get the file path being used for storage.
   *
   * @returns The memory file path
   */
  getFilePath(): string {
    return this.memoryFilePath;
  }
}
