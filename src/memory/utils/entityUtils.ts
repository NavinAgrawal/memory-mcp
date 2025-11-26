/**
 * Entity Lookup and Utility Functions
 *
 * Centralizes entity lookup patterns to eliminate redundant code across managers.
 * Provides type-safe entity finding with optional error throwing.
 */

import type { Entity, KnowledgeGraph } from '../types/entity.types.js';
import { EntityNotFoundError } from './errors.js';

/**
 * Finds an entity by name in the graph.
 * Overloaded to provide type-safe returns based on throwIfNotFound parameter.
 *
 * @param graph - The knowledge graph to search
 * @param name - The entity name to find
 * @param throwIfNotFound - Whether to throw if entity doesn't exist (default: true)
 * @returns The entity if found, null if not found and throwIfNotFound is false
 * @throws EntityNotFoundError if entity not found and throwIfNotFound is true
 */
export function findEntityByName(
  graph: KnowledgeGraph,
  name: string,
  throwIfNotFound: true
): Entity;
export function findEntityByName(
  graph: KnowledgeGraph,
  name: string,
  throwIfNotFound: false
): Entity | null;
export function findEntityByName(
  graph: KnowledgeGraph,
  name: string,
  throwIfNotFound?: boolean
): Entity | null;
export function findEntityByName(
  graph: KnowledgeGraph,
  name: string,
  throwIfNotFound: boolean = true
): Entity | null {
  const entity = graph.entities.find(e => e.name === name);
  if (!entity && throwIfNotFound) {
    throw new EntityNotFoundError(name);
  }
  return entity ?? null;
}

/**
 * Finds multiple entities by name.
 *
 * @param graph - The knowledge graph to search
 * @param names - Array of entity names to find
 * @param throwIfAnyNotFound - Whether to throw if any entity doesn't exist (default: true)
 * @returns Array of found entities (may be shorter than names if throwIfAnyNotFound is false)
 * @throws EntityNotFoundError if any entity not found and throwIfAnyNotFound is true
 */
export function findEntitiesByNames(
  graph: KnowledgeGraph,
  names: string[],
  throwIfAnyNotFound: boolean = true
): Entity[] {
  const entities: Entity[] = [];

  for (const name of names) {
    const entity = findEntityByName(graph, name, false);
    if (entity) {
      entities.push(entity);
    } else if (throwIfAnyNotFound) {
      throw new EntityNotFoundError(name);
    }
  }

  return entities;
}

/**
 * Checks if an entity exists in the graph.
 *
 * @param graph - The knowledge graph to search
 * @param name - The entity name to check
 * @returns true if entity exists, false otherwise
 */
export function entityExists(graph: KnowledgeGraph, name: string): boolean {
  return graph.entities.some(e => e.name === name);
}

/**
 * Gets the index of an entity in the graph's entities array.
 *
 * @param graph - The knowledge graph to search
 * @param name - The entity name to find
 * @returns The index if found, -1 otherwise
 */
export function getEntityIndex(graph: KnowledgeGraph, name: string): number {
  return graph.entities.findIndex(e => e.name === name);
}

/**
 * Removes an entity from the graph by name.
 * Mutates the graph's entities array in place.
 *
 * @param graph - The knowledge graph to modify
 * @param name - The entity name to remove
 * @returns true if entity was removed, false if not found
 */
export function removeEntityByName(graph: KnowledgeGraph, name: string): boolean {
  const index = getEntityIndex(graph, name);
  if (index === -1) return false;
  graph.entities.splice(index, 1);
  return true;
}

/**
 * Gets all entity names as a Set for fast lookup.
 *
 * @param graph - The knowledge graph
 * @returns Set of all entity names
 */
export function getEntityNameSet(graph: KnowledgeGraph): Set<string> {
  return new Set(graph.entities.map(e => e.name));
}

/**
 * Groups entities by their type.
 *
 * @param entities - Array of entities to group
 * @returns Map of entity type to array of entities
 */
export function groupEntitiesByType(entities: Entity[]): Map<string, Entity[]> {
  const groups = new Map<string, Entity[]>();

  for (const entity of entities) {
    const type = entity.entityType;
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    groups.get(type)!.push(entity);
  }

  return groups;
}

/**
 * Updates the lastModified timestamp on an entity.
 * Mutates the entity in place.
 *
 * @param entity - The entity to update
 * @returns The updated entity (same reference)
 */
export function touchEntity(entity: Entity): Entity {
  entity.lastModified = new Date().toISOString();
  return entity;
}
