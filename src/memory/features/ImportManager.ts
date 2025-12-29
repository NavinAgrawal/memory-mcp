/**
 * Import Manager
 *
 * Imports knowledge graphs from various formats (JSON, CSV, GraphML) with merge strategies.
 *
 * @module features/ImportManager
 */

import type { Entity, Relation, KnowledgeGraph, ImportResult } from '../types/index.js';
import type { GraphStorage } from '../core/GraphStorage.js';

/**
 * Supported import formats.
 */
export type ImportFormat = 'json' | 'csv' | 'graphml';

/**
 * Merge strategies for handling existing entities.
 */
export type MergeStrategy = 'replace' | 'skip' | 'merge' | 'fail';

/**
 * Manages knowledge graph imports from multiple formats.
 */
export class ImportManager {
  constructor(private storage: GraphStorage) {}

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
    mergeStrategy: MergeStrategy = 'skip',
    dryRun: boolean = false
  ): Promise<ImportResult> {
    let importedGraph: KnowledgeGraph;

    try {
      switch (format) {
        case 'json':
          importedGraph = this.parseJsonImport(data);
          break;
        case 'csv':
          importedGraph = this.parseCsvImport(data);
          break;
        case 'graphml':
          importedGraph = this.parseGraphMLImport(data);
          break;
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }
    } catch (error) {
      return {
        entitiesAdded: 0,
        entitiesSkipped: 0,
        entitiesUpdated: 0,
        relationsAdded: 0,
        relationsSkipped: 0,
        errors: [`Failed to parse ${format} data: ${error instanceof Error ? error.message : String(error)}`],
      };
    }

    return await this.mergeImportedGraph(importedGraph, mergeStrategy, dryRun);
  }

  /**
   * Parse JSON format.
   */
  private parseJsonImport(data: string): KnowledgeGraph {
    const parsed = JSON.parse(data);

    if (!parsed.entities || !Array.isArray(parsed.entities)) {
      throw new Error('Invalid JSON: missing or invalid entities array');
    }
    if (!parsed.relations || !Array.isArray(parsed.relations)) {
      throw new Error('Invalid JSON: missing or invalid relations array');
    }

    return {
      entities: parsed.entities as Entity[],
      relations: parsed.relations as Relation[],
    };
  }

  /**
   * Parse CSV format.
   *
   * Expects: # ENTITIES section with header, then # RELATIONS section with header
   */
  private parseCsvImport(data: string): KnowledgeGraph {
    const lines = data
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
    const entities: Entity[] = [];
    const relations: Relation[] = [];

    let section: 'entities' | 'relations' | null = null;
    let headerParsed = false;

    const parseCsvLine = (line: string): string[] => {
      const fields: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          fields.push(current);
          current = '';
        } else {
          current += char;
        }
      }

      fields.push(current);
      return fields;
    };

    for (const line of lines) {
      if (line.startsWith('# ENTITIES')) {
        section = 'entities';
        headerParsed = false;
        continue;
      } else if (line.startsWith('# RELATIONS')) {
        section = 'relations';
        headerParsed = false;
        continue;
      }

      if (line.startsWith('#')) continue;

      if (section === 'entities') {
        if (!headerParsed) {
          headerParsed = true;
          continue;
        }

        const fields = parseCsvLine(line);
        if (fields.length >= 2) {
          const entity: Entity = {
            name: fields[0],
            entityType: fields[1],
            observations: fields[2]
              ? fields[2]
                  .split(';')
                  .map(s => s.trim())
                  .filter(s => s)
              : [],
            createdAt: fields[3] || undefined,
            lastModified: fields[4] || undefined,
            tags: fields[5]
              ? fields[5]
                  .split(';')
                  .map(s => s.trim().toLowerCase())
                  .filter(s => s)
              : undefined,
            importance: fields[6] ? parseFloat(fields[6]) : undefined,
          };
          entities.push(entity);
        }
      } else if (section === 'relations') {
        if (!headerParsed) {
          headerParsed = true;
          continue;
        }

        const fields = parseCsvLine(line);
        if (fields.length >= 3) {
          const relation: Relation = {
            from: fields[0],
            to: fields[1],
            relationType: fields[2],
            createdAt: fields[3] || undefined,
            lastModified: fields[4] || undefined,
          };
          relations.push(relation);
        }
      }
    }

    return { entities, relations };
  }

  /**
   * Parse GraphML format.
   *
   * Note: Simplified regex-based parser for basic GraphML structure.
   */
  private parseGraphMLImport(data: string): KnowledgeGraph {
    const entities: Entity[] = [];
    const relations: Relation[] = [];

    // Extract nodes
    const nodeRegex = /<node\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/node>/g;
    let nodeMatch;

    while ((nodeMatch = nodeRegex.exec(data)) !== null) {
      const nodeId = nodeMatch[1];
      const nodeContent = nodeMatch[2];

      const getDataValue = (key: string): string | undefined => {
        const dataRegex = new RegExp(`<data\\s+key="${key}">([^<]*)<\/data>`);
        const match = dataRegex.exec(nodeContent);
        return match ? match[1] : undefined;
      };

      const entity: Entity = {
        name: nodeId,
        entityType: getDataValue('d0') || getDataValue('entityType') || 'unknown',
        observations: (getDataValue('d1') || getDataValue('observations') || '')
          .split(';')
          .map(s => s.trim())
          .filter(s => s),
        createdAt: getDataValue('d2') || getDataValue('createdAt'),
        lastModified: getDataValue('d3') || getDataValue('lastModified'),
        tags: (getDataValue('d4') || getDataValue('tags') || '')
          .split(';')
          .map(s => s.trim().toLowerCase())
          .filter(s => s),
        importance: getDataValue('d5') || getDataValue('importance') ? parseFloat(getDataValue('d5') || getDataValue('importance') || '0') : undefined,
      };

      entities.push(entity);
    }

    // Extract edges
    const edgeRegex = /<edge\s+[^>]*source="([^"]+)"\s+target="([^"]+)"[^>]*>([\s\S]*?)<\/edge>/g;
    let edgeMatch;

    while ((edgeMatch = edgeRegex.exec(data)) !== null) {
      const source = edgeMatch[1];
      const target = edgeMatch[2];
      const edgeContent = edgeMatch[3];

      const getDataValue = (key: string): string | undefined => {
        const dataRegex = new RegExp(`<data\\s+key="${key}">([^<]*)<\/data>`);
        const match = dataRegex.exec(edgeContent);
        return match ? match[1] : undefined;
      };

      const relation: Relation = {
        from: source,
        to: target,
        relationType: getDataValue('e0') || getDataValue('relationType') || 'related_to',
        createdAt: getDataValue('e1') || getDataValue('createdAt'),
        lastModified: getDataValue('e2') || getDataValue('lastModified'),
      };

      relations.push(relation);
    }

    return { entities, relations };
  }

  /**
   * Merge imported graph with existing graph.
   */
  private async mergeImportedGraph(
    importedGraph: KnowledgeGraph,
    mergeStrategy: MergeStrategy,
    dryRun: boolean
  ): Promise<ImportResult> {
    const existingGraph = await this.storage.getGraphForMutation();
    const result: ImportResult = {
      entitiesAdded: 0,
      entitiesSkipped: 0,
      entitiesUpdated: 0,
      relationsAdded: 0,
      relationsSkipped: 0,
      errors: [],
    };

    const existingEntitiesMap = new Map<string, Entity>();
    for (const entity of existingGraph.entities) {
      existingEntitiesMap.set(entity.name, entity);
    }

    const existingRelationsSet = new Set<string>();
    for (const relation of existingGraph.relations) {
      existingRelationsSet.add(`${relation.from}|${relation.to}|${relation.relationType}`);
    }

    // Process entities
    for (const importedEntity of importedGraph.entities) {
      const existing = existingEntitiesMap.get(importedEntity.name);

      if (!existing) {
        result.entitiesAdded++;
        if (!dryRun) {
          existingGraph.entities.push(importedEntity);
          existingEntitiesMap.set(importedEntity.name, importedEntity);
        }
      } else {
        switch (mergeStrategy) {
          case 'replace':
            result.entitiesUpdated++;
            if (!dryRun) {
              Object.assign(existing, importedEntity);
            }
            break;

          case 'skip':
            result.entitiesSkipped++;
            break;

          case 'merge':
            result.entitiesUpdated++;
            if (!dryRun) {
              existing.observations = [
                ...new Set([...existing.observations, ...importedEntity.observations]),
              ];
              if (importedEntity.tags) {
                existing.tags = existing.tags || [];
                existing.tags = [...new Set([...existing.tags, ...importedEntity.tags])];
              }
              if (importedEntity.importance !== undefined) {
                existing.importance = importedEntity.importance;
              }
              existing.lastModified = new Date().toISOString();
            }
            break;

          case 'fail':
            result.errors.push(`Entity "${importedEntity.name}" already exists`);
            break;
        }
      }
    }

    // Process relations
    for (const importedRelation of importedGraph.relations) {
      const relationKey = `${importedRelation.from}|${importedRelation.to}|${importedRelation.relationType}`;

      if (!existingEntitiesMap.has(importedRelation.from)) {
        result.errors.push(`Relation source entity "${importedRelation.from}" does not exist`);
        continue;
      }
      if (!existingEntitiesMap.has(importedRelation.to)) {
        result.errors.push(`Relation target entity "${importedRelation.to}" does not exist`);
        continue;
      }

      if (!existingRelationsSet.has(relationKey)) {
        result.relationsAdded++;
        if (!dryRun) {
          existingGraph.relations.push(importedRelation);
          existingRelationsSet.add(relationKey);
        }
      } else {
        if (mergeStrategy === 'fail') {
          result.errors.push(`Relation "${relationKey}" already exists`);
        } else {
          result.relationsSkipped++;
        }
      }
    }

    // Save if not dry run and no blocking errors
    if (!dryRun && (mergeStrategy !== 'fail' || result.errors.length === 0)) {
      await this.storage.saveGraph(existingGraph);
    }

    return result;
  }
}
