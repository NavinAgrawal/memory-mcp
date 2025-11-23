/**
 * Tag Types
 *
 * Type definitions for tag management, including tag aliases for synonyms.
 */

/**
 * Represents a tag alias (synonym) mapping.
 *
 * Tag aliases allow multiple tag names to map to a canonical tag,
 * enabling synonym support and tag normalization.
 *
 * @example
 * ```typescript
 * const alias: TagAlias = {
 *   alias: "dev",
 *   canonical: "developer",
 *   description: "Short form of developer",
 *   createdAt: "2024-01-01T00:00:00Z"
 * };
 * ```
 */
export interface TagAlias {
  /** The alias (synonym) tag name */
  alias: string;

  /** The canonical (official) tag name this maps to */
  canonical: string;

  /** Optional description of the alias relationship */
  description?: string;

  /** ISO 8601 timestamp when alias was created */
  createdAt: string;
}
