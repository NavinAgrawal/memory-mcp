/**
 * Tag Manager
 *
 * Manages tag aliases and canonical tag resolution.
 *
 * @module features/TagManager
 */

import * as fs from 'fs/promises';
import type { TagAlias } from '../types/index.js';

/**
 * Manages tag alias system for synonym mapping.
 */
export class TagManager {
  constructor(private tagAliasesFilePath: string) {}

  /**
   * Load all tag aliases from JSONL file.
   *
   * @returns Array of tag aliases
   */
  private async loadTagAliases(): Promise<TagAlias[]> {
    try {
      const data = await fs.readFile(this.tagAliasesFilePath, 'utf-8');
      const lines = data.split('\n').filter((line: string) => line.trim() !== '');
      return lines.map((line: string) => JSON.parse(line) as TagAlias);
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Save tag aliases to JSONL file.
   *
   * @param aliases - Array of tag aliases
   */
  private async saveTagAliases(aliases: TagAlias[]): Promise<void> {
    const lines = aliases.map(a => JSON.stringify(a));
    await fs.writeFile(this.tagAliasesFilePath, lines.join('\n'));
  }

  /**
   * Resolve a tag through aliases to get its canonical form.
   *
   * If the tag is an alias, returns the canonical tag.
   * Otherwise, returns the tag as-is (normalized to lowercase).
   *
   * @param tag - Tag to resolve (can be alias or canonical)
   * @returns Canonical tag name (lowercase)
   */
  async resolveTag(tag: string): Promise<string> {
    const aliases = await this.loadTagAliases();
    const normalized = tag.toLowerCase();

    // Check if this tag is an alias
    const alias = aliases.find(a => a.alias === normalized);
    if (alias) {
      return alias.canonical;
    }

    // Return as-is (might be canonical or unaliased tag)
    return normalized;
  }

  /**
   * Add a tag alias (synonym mapping).
   *
   * Prevents:
   * - Duplicate aliases
   * - Aliasing to another alias (must alias to canonical tags)
   *
   * @param alias - The alias/synonym
   * @param canonical - The canonical (main) tag name
   * @param description - Optional description of the alias
   * @returns Newly created tag alias
   * @throws Error if alias already exists or would create chained aliases
   */
  async addTagAlias(alias: string, canonical: string, description?: string): Promise<TagAlias> {
    const aliases = await this.loadTagAliases();
    const normalizedAlias = alias.toLowerCase();
    const normalizedCanonical = canonical.toLowerCase();

    // Check if alias already exists
    if (aliases.some(a => a.alias === normalizedAlias)) {
      throw new Error(`Tag alias "${alias}" already exists`);
    }

    // Prevent aliasing to another alias (aliases should point to canonical tags)
    if (aliases.some(a => a.canonical === normalizedAlias)) {
      throw new Error(
        `Cannot create alias to "${alias}" because it is a canonical tag with existing aliases`
      );
    }

    const newAlias: TagAlias = {
      alias: normalizedAlias,
      canonical: normalizedCanonical,
      description,
      createdAt: new Date().toISOString(),
    };

    aliases.push(newAlias);
    await this.saveTagAliases(aliases);

    return newAlias;
  }

  /**
   * List all tag aliases.
   *
   * @returns Array of all tag aliases
   */
  async listTagAliases(): Promise<TagAlias[]> {
    return await this.loadTagAliases();
  }

  /**
   * Remove a tag alias.
   *
   * @param alias - Alias to remove
   * @returns True if removed, false if not found
   */
  async removeTagAlias(alias: string): Promise<boolean> {
    const aliases = await this.loadTagAliases();
    const normalizedAlias = alias.toLowerCase();
    const initialLength = aliases.length;
    const filtered = aliases.filter(a => a.alias !== normalizedAlias);

    if (filtered.length === initialLength) {
      return false; // Alias not found
    }

    await this.saveTagAliases(filtered);
    return true;
  }

  /**
   * Get all aliases for a canonical tag.
   *
   * @param canonicalTag - Canonical tag name
   * @returns Array of alias names
   */
  async getAliasesForTag(canonicalTag: string): Promise<string[]> {
    const aliases = await this.loadTagAliases();
    const normalized = canonicalTag.toLowerCase();
    return aliases.filter(a => a.canonical === normalized).map(a => a.alias);
  }
}
