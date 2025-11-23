/**
 * Entity Types
 *
 * Core type definitions for entities, relations, and the knowledge graph structure.
 * These types form the foundation of the memory MCP server's data model.
 */

/**
 * Represents an entity in the knowledge graph.
 *
 * Entities are the primary nodes in the graph, containing:
 * - Identity (name, type)
 * - Content (observations)
 * - Metadata (timestamps, tags, importance)
 * - Hierarchy (optional parent reference)
 *
 * @example
 * ```typescript
 * const entity: Entity = {
 *   name: "Alice",
 *   entityType: "person",
 *   observations: ["Works at TechCorp", "Loves TypeScript"],
 *   createdAt: "2024-01-01T00:00:00Z",
 *   lastModified: "2024-01-02T00:00:00Z",
 *   tags: ["employee", "developer"],
 *   importance: 8,
 *   parentId: "TechCorp"
 * };
 * ```
 */
export interface Entity {
  /** Unique name identifying the entity */
  name: string;

  /** Type/category of the entity (e.g., "person", "project", "concept") */
  entityType: string;

  /** Array of observation strings describing facts about the entity */
  observations: string[];

  /** ISO 8601 timestamp when entity was created */
  createdAt?: string;

  /** ISO 8601 timestamp when entity was last modified */
  lastModified?: string;

  /** Array of lowercase tags for categorization */
  tags?: string[];

  /** Importance level from 0 (low) to 10 (high) */
  importance?: number;

  /** Optional parent entity name for hierarchical nesting */
  parentId?: string;
}

/**
 * Represents a directed relation between two entities.
 *
 * Relations form the edges of the knowledge graph, connecting entities
 * with semantic relationships.
 *
 * @example
 * ```typescript
 * const relation: Relation = {
 *   from: "Alice",
 *   to: "TechCorp",
 *   relationType: "works_at",
 *   createdAt: "2024-01-01T00:00:00Z",
 *   lastModified: "2024-01-01T00:00:00Z"
 * };
 * ```
 */
export interface Relation {
  /** Source entity name */
  from: string;

  /** Target entity name */
  to: string;

  /** Type of relationship (should be in active voice, e.g., "works_at", "manages") */
  relationType: string;

  /** ISO 8601 timestamp when relation was created */
  createdAt?: string;

  /** ISO 8601 timestamp when relation was last modified */
  lastModified?: string;
}

/**
 * Represents the complete knowledge graph structure.
 *
 * The knowledge graph consists of entities (nodes) and relations (edges),
 * forming a semantic network of interconnected information.
 *
 * @example
 * ```typescript
 * const graph: KnowledgeGraph = {
 *   entities: [
 *     { name: "Alice", entityType: "person", observations: ["Developer"] },
 *     { name: "TechCorp", entityType: "company", observations: ["Tech company"] }
 *   ],
 *   relations: [
 *     { from: "Alice", to: "TechCorp", relationType: "works_at" }
 *   ]
 * };
 * ```
 */
export interface KnowledgeGraph {
  /** Array of all entities in the graph */
  entities: Entity[];

  /** Array of all relations between entities */
  relations: Relation[];
}
