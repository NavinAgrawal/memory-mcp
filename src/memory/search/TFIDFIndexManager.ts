/**
 * TF-IDF Index Manager
 *
 * Manages pre-calculated TF-IDF indexes for fast ranked search.
 * Handles index building, incremental updates, and persistence.
 *
 * @module search/TFIDFIndexManager
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { TFIDFIndex, DocumentVector, KnowledgeGraph, ReadonlyKnowledgeGraph } from '../types/index.js';
import { calculateIDFFromTokenSets, tokenize } from '../utils/index.js';

const INDEX_VERSION = '1.0';
const INDEX_FILENAME = 'tfidf-index.json';

/**
 * Serializable version of TFIDFIndex for JSON storage.
 */
interface SerializedTFIDFIndex {
  version: string;
  lastUpdated: string;
  documents: Array<[string, DocumentVector]>;
  idf: Array<[string, number]>;
}

/**
 * Manages TF-IDF index lifecycle: building, updating, and persistence.
 */
export class TFIDFIndexManager {
  private indexPath: string;
  private index: TFIDFIndex | null = null;

  constructor(storageDir: string) {
    this.indexPath = path.join(storageDir, '.indexes', INDEX_FILENAME);
  }

  /**
   * Build a complete TF-IDF index from a knowledge graph.
   *
   * @param graph - Knowledge graph to index
   * @returns Newly built TF-IDF index
   */
  async buildIndex(graph: ReadonlyKnowledgeGraph): Promise<TFIDFIndex> {
    const documents = new Map<string, DocumentVector>();
    const allTokenSets: Set<string>[] = [];

    // Build document vectors - tokenize once per document
    for (const entity of graph.entities) {
      const documentText = [
        entity.name,
        entity.entityType,
        ...entity.observations,
      ].join(' ');

      const tokens = tokenize(documentText);
      const tokenSet = new Set(tokens);
      allTokenSets.push(tokenSet);

      // Calculate term frequencies
      const termFreq: Record<string, number> = {};
      for (const term of tokens) {
        termFreq[term] = (termFreq[term] || 0) + 1;
      }

      documents.set(entity.name, {
        entityName: entity.name,
        terms: termFreq,
        documentText,
      });
    }

    // Calculate IDF for all terms using pre-tokenized sets (O(1) lookup per document)
    const idf = new Map<string, number>();
    const allTerms = new Set(allTokenSets.flatMap(s => Array.from(s)));

    for (const term of allTerms) {
      const idfScore = calculateIDFFromTokenSets(term, allTokenSets);
      idf.set(term, idfScore);
    }

    this.index = {
      version: INDEX_VERSION,
      lastUpdated: new Date().toISOString(),
      documents,
      idf,
    };

    return this.index;
  }

  /**
   * Update the index incrementally when entities change.
   *
   * More efficient than rebuilding the entire index.
   *
   * @param graph - Updated knowledge graph
   * @param changedEntityNames - Names of entities that changed
   */
  async updateIndex(graph: ReadonlyKnowledgeGraph, changedEntityNames: Set<string>): Promise<TFIDFIndex> {
    if (!this.index) {
      // No existing index, build from scratch
      return this.buildIndex(graph);
    }

    // Rebuild document vectors for changed entities
    const allTokenSets: Set<string>[] = [];
    const updatedDocuments = new Map(this.index.documents);

    // Remove deleted entities
    for (const entityName of changedEntityNames) {
      const entity = graph.entities.find(e => e.name === entityName);
      if (!entity) {
        updatedDocuments.delete(entityName);
      }
    }

    // Update/add changed entities - tokenize once per document
    for (const entity of graph.entities) {
      const documentText = [
        entity.name,
        entity.entityType,
        ...entity.observations,
      ].join(' ');

      const tokens = tokenize(documentText);
      const tokenSet = new Set(tokens);
      allTokenSets.push(tokenSet);

      if (changedEntityNames.has(entity.name)) {
        // Calculate term frequencies for changed entity
        const termFreq: Record<string, number> = {};
        for (const term of tokens) {
          termFreq[term] = (termFreq[term] || 0) + 1;
        }

        updatedDocuments.set(entity.name, {
          entityName: entity.name,
          terms: termFreq,
          documentText,
        });
      }
    }

    // Recalculate IDF using pre-tokenized sets (O(1) lookup per document)
    const idf = new Map<string, number>();
    const allTerms = new Set(allTokenSets.flatMap(s => Array.from(s)));

    for (const term of allTerms) {
      const idfScore = calculateIDFFromTokenSets(term, allTokenSets);
      idf.set(term, idfScore);
    }

    this.index = {
      version: INDEX_VERSION,
      lastUpdated: new Date().toISOString(),
      documents: updatedDocuments,
      idf,
    };

    return this.index;
  }

  /**
   * Load index from disk.
   *
   * @returns Loaded index or null if not found
   */
  async loadIndex(): Promise<TFIDFIndex | null> {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      const serialized: SerializedTFIDFIndex = JSON.parse(data);

      this.index = {
        version: serialized.version,
        lastUpdated: serialized.lastUpdated,
        documents: new Map(serialized.documents),
        idf: new Map(serialized.idf),
      };

      return this.index;
    } catch (error) {
      // Index doesn't exist or is invalid
      return null;
    }
  }

  /**
   * Save index to disk.
   *
   * @param index - Index to save (uses cached index if not provided)
   */
  async saveIndex(index?: TFIDFIndex): Promise<void> {
    const indexToSave = index || this.index;
    if (!indexToSave) {
      throw new Error('No index to save');
    }

    // Ensure index directory exists
    const indexDir = path.dirname(this.indexPath);
    await fs.mkdir(indexDir, { recursive: true });

    // Serialize Map objects to arrays for JSON
    const serialized: SerializedTFIDFIndex = {
      version: indexToSave.version,
      lastUpdated: indexToSave.lastUpdated,
      documents: Array.from(indexToSave.documents.entries()),
      idf: Array.from(indexToSave.idf.entries()),
    };

    await fs.writeFile(this.indexPath, JSON.stringify(serialized, null, 2), 'utf-8');
  }

  /**
   * Get the current cached index.
   *
   * @returns Cached index or null if not loaded
   */
  getIndex(): TFIDFIndex | null {
    return this.index;
  }

  /**
   * Clear the cached index and delete from disk.
   */
  async clearIndex(): Promise<void> {
    this.index = null;
    try {
      await fs.unlink(this.indexPath);
    } catch {
      // Index file doesn't exist, nothing to delete
    }
  }

  /**
   * Check if the index needs rebuilding based on graph state.
   *
   * @param graph - Current knowledge graph
   * @returns True if index should be rebuilt
   */
  needsRebuild(graph: KnowledgeGraph): boolean {
    if (!this.index) {
      return true;
    }

    // Check if entity count matches
    if (this.index.documents.size !== graph.entities.length) {
      return true;
    }

    // Check if all entities are in index
    for (const entity of graph.entities) {
      if (!this.index.documents.has(entity.name)) {
        return true;
      }
    }

    return false;
  }
}
