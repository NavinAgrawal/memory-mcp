/**
 * Search Indexes
 *
 * Provides O(1) lookup structures to avoid repeated linear scans.
 * - NameIndex: O(1) entity lookup by name
 * - TypeIndex: O(1) entities by type
 * - LowercaseCache: Pre-computed lowercase strings to avoid repeated toLowerCase()
 *
 * @module utils/indexes
 */

import type { Entity } from '../types/index.js';

/**
 * Pre-computed lowercase data for an entity.
 * Avoids repeated toLowerCase() calls during search operations.
 */
export interface LowercaseData {
  name: string;
  entityType: string;
  observations: string[];
  tags: string[];
}

/**
 * NameIndex provides O(1) entity lookup by name.
 *
 * Uses a Map internally for constant-time access.
 */
export class NameIndex {
  private index: Map<string, Entity> = new Map();

  /**
   * Build the index from an array of entities.
   * Clears any existing index data first.
   */
  build(entities: Entity[]): void {
    this.index.clear();
    for (const entity of entities) {
      this.index.set(entity.name, entity);
    }
  }

  /**
   * Get an entity by name in O(1) time.
   */
  get(name: string): Entity | undefined {
    return this.index.get(name);
  }

  /**
   * Add a single entity to the index.
   */
  add(entity: Entity): void {
    this.index.set(entity.name, entity);
  }

  /**
   * Remove an entity from the index by name.
   */
  remove(name: string): void {
    this.index.delete(name);
  }

  /**
   * Check if an entity exists in the index.
   */
  has(name: string): boolean {
    return this.index.has(name);
  }

  /**
   * Get the number of entities in the index.
   */
  get size(): number {
    return this.index.size;
  }

  /**
   * Clear all entries from the index.
   */
  clear(): void {
    this.index.clear();
  }
}

/**
 * TypeIndex provides O(1) lookup of entities by type.
 *
 * Uses a Map<type, Set<entityName>> structure for efficient type queries.
 * Type comparisons are case-insensitive.
 */
export class TypeIndex {
  private index: Map<string, Set<string>> = new Map();

  /**
   * Build the index from an array of entities.
   * Clears any existing index data first.
   */
  build(entities: Entity[]): void {
    this.index.clear();
    for (const entity of entities) {
      this.addToIndex(entity.name, entity.entityType);
    }
  }

  /**
   * Get all entity names of a given type in O(1) time.
   * Type comparison is case-insensitive.
   */
  getNames(entityType: string): Set<string> {
    const typeLower = entityType.toLowerCase();
    return this.index.get(typeLower) ?? new Set();
  }

  /**
   * Add an entity to the type index.
   */
  add(entity: Entity): void {
    this.addToIndex(entity.name, entity.entityType);
  }

  /**
   * Remove an entity from the type index.
   * Requires the entity type to know which bucket to remove from.
   */
  remove(entityName: string, entityType: string): void {
    const typeLower = entityType.toLowerCase();
    const names = this.index.get(typeLower);
    if (names) {
      names.delete(entityName);
      if (names.size === 0) {
        this.index.delete(typeLower);
      }
    }
  }

  /**
   * Update an entity's type in the index.
   * Removes from old type and adds to new type.
   */
  updateType(entityName: string, oldType: string, newType: string): void {
    this.remove(entityName, oldType);
    this.addToIndex(entityName, newType);
  }

  /**
   * Get all unique types in the index.
   */
  getTypes(): string[] {
    return Array.from(this.index.keys());
  }

  /**
   * Clear all entries from the index.
   */
  clear(): void {
    this.index.clear();
  }

  private addToIndex(entityName: string, entityType: string): void {
    const typeLower = entityType.toLowerCase();
    let names = this.index.get(typeLower);
    if (!names) {
      names = new Set();
      this.index.set(typeLower, names);
    }
    names.add(entityName);
  }
}

/**
 * LowercaseCache pre-computes lowercase versions of all searchable fields.
 *
 * Eliminates the need for repeated toLowerCase() calls during search,
 * which is expensive with many entities and observations.
 */
export class LowercaseCache {
  private cache: Map<string, LowercaseData> = new Map();

  /**
   * Build the cache from an array of entities.
   * Clears any existing cache data first.
   */
  build(entities: Entity[]): void {
    this.cache.clear();
    for (const entity of entities) {
      this.cache.set(entity.name, this.computeLowercase(entity));
    }
  }

  /**
   * Get pre-computed lowercase data for an entity.
   */
  get(entityName: string): LowercaseData | undefined {
    return this.cache.get(entityName);
  }

  /**
   * Add or update an entity in the cache.
   */
  set(entity: Entity): void {
    this.cache.set(entity.name, this.computeLowercase(entity));
  }

  /**
   * Remove an entity from the cache.
   */
  remove(entityName: string): void {
    this.cache.delete(entityName);
  }

  /**
   * Check if an entity exists in the cache.
   */
  has(entityName: string): boolean {
    return this.cache.has(entityName);
  }

  /**
   * Clear all entries from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of entries in the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  private computeLowercase(entity: Entity): LowercaseData {
    return {
      name: entity.name.toLowerCase(),
      entityType: entity.entityType.toLowerCase(),
      observations: entity.observations.map(o => o.toLowerCase()),
      tags: entity.tags?.map(t => t.toLowerCase()) ?? [],
    };
  }
}
