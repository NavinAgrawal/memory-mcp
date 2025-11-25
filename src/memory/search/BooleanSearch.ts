/**
 * Boolean Search
 *
 * Advanced search with boolean operators (AND, OR, NOT) and field-specific queries.
 *
 * @module search/BooleanSearch
 */

import type { BooleanQueryNode, Entity, KnowledgeGraph } from '../types/index.js';
import type { GraphStorage } from '../core/GraphStorage.js';
import { SEARCH_LIMITS, QUERY_LIMITS } from '../utils/constants.js';
import { ValidationError } from '../utils/errors.js';

/**
 * Performs boolean search with query parsing and AST evaluation.
 */
export class BooleanSearch {
  constructor(private storage: GraphStorage) {}

  /**
   * Boolean search with support for AND, OR, NOT operators, field-specific queries, and pagination.
   *
   * Query syntax examples:
   * - "alice AND programming" - Both terms must match
   * - "type:person OR type:organization" - Either type matches
   * - "NOT archived" - Exclude archived items
   * - "name:alice AND (observation:coding OR observation:teaching)"
   *
   * @param query - Boolean query string
   * @param tags - Optional tags filter
   * @param minImportance - Optional minimum importance
   * @param maxImportance - Optional maximum importance
   * @param offset - Number of results to skip (default: 0)
   * @param limit - Maximum number of results (default: 50, max: 200)
   * @returns Filtered knowledge graph matching the boolean query with pagination applied
   */
  async booleanSearch(
    query: string,
    tags?: string[],
    minImportance?: number,
    maxImportance?: number,
    offset: number = 0,
    limit: number = SEARCH_LIMITS.DEFAULT
  ): Promise<KnowledgeGraph> {
    // Validate query length
    if (query.length > QUERY_LIMITS.MAX_QUERY_LENGTH) {
      throw new ValidationError(
        'Query too long',
        [`Query length ${query.length} exceeds maximum of ${QUERY_LIMITS.MAX_QUERY_LENGTH} characters`]
      );
    }

    const graph = await this.storage.loadGraph();

    // Parse the query into an AST
    let queryAst: BooleanQueryNode;
    try {
      queryAst = this.parseBooleanQuery(query);
    } catch (error) {
      throw new Error(
        `Failed to parse boolean query: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Validate query complexity
    this.validateQueryComplexity(queryAst);

    const normalizedTags = tags?.map(tag => tag.toLowerCase());

    // Validate pagination parameters
    const validatedOffset = Math.max(0, offset);
    const validatedLimit = Math.min(Math.max(SEARCH_LIMITS.MIN, limit), SEARCH_LIMITS.MAX);

    // Filter entities
    const filteredEntities = graph.entities.filter(e => {
      // Evaluate boolean query
      if (!this.evaluateBooleanQuery(queryAst, e)) {
        return false;
      }

      // Apply tag filter
      if (normalizedTags && normalizedTags.length > 0) {
        if (!e.tags || e.tags.length === 0) return false;
        const entityTags = e.tags.map(tag => tag.toLowerCase());
        const hasMatchingTag = normalizedTags.some(tag => entityTags.includes(tag));
        if (!hasMatchingTag) return false;
      }

      // Apply importance filter
      if (minImportance !== undefined && (e.importance === undefined || e.importance < minImportance)) {
        return false;
      }
      if (maxImportance !== undefined && (e.importance === undefined || e.importance > maxImportance)) {
        return false;
      }

      return true;
    });

    // Apply pagination
    const paginatedEntities = filteredEntities.slice(validatedOffset, validatedOffset + validatedLimit);

    const filteredEntityNames = new Set(paginatedEntities.map(e => e.name));
    const filteredRelations = graph.relations.filter(
      r => filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );

    return { entities: paginatedEntities, relations: filteredRelations };
  }

  /**
   * Tokenize a boolean query into tokens.
   *
   * Handles quoted strings, parentheses, and operators.
   */
  private tokenizeBooleanQuery(query: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < query.length; i++) {
      const char = query[i];

      if (char === '"') {
        if (inQuotes) {
          // End of quoted string
          tokens.push(current);
          current = '';
          inQuotes = false;
        } else {
          // Start of quoted string
          if (current.trim()) {
            tokens.push(current.trim());
            current = '';
          }
          inQuotes = true;
        }
      } else if (!inQuotes && (char === '(' || char === ')')) {
        // Parentheses are separate tokens
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        tokens.push(char);
      } else if (!inQuotes && /\s/.test(char)) {
        // Whitespace outside quotes
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      tokens.push(current.trim());
    }

    return tokens;
  }

  /**
   * Parse a boolean search query into an AST.
   *
   * Supports: AND, OR, NOT, parentheses, field-specific queries (field:value)
   */
  private parseBooleanQuery(query: string): BooleanQueryNode {
    const tokens = this.tokenizeBooleanQuery(query);
    let position = 0;

    const peek = (): string | undefined => tokens[position];
    const consume = (): string | undefined => tokens[position++];

    // Parse OR expressions (lowest precedence)
    const parseOr = (): BooleanQueryNode => {
      let left = parseAnd();

      while (peek()?.toUpperCase() === 'OR') {
        consume(); // consume 'OR'
        const right = parseAnd();
        left = { type: 'OR', children: [left, right] };
      }

      return left;
    };

    // Parse AND expressions
    const parseAnd = (): BooleanQueryNode => {
      let left = parseNot();

      while (peek() && peek()?.toUpperCase() !== 'OR' && peek() !== ')') {
        // Implicit AND if next token is not OR or )
        if (peek()?.toUpperCase() === 'AND') {
          consume(); // consume 'AND'
        }
        const right = parseNot();
        left = { type: 'AND', children: [left, right] };
      }

      return left;
    };

    // Parse NOT expressions
    const parseNot = (): BooleanQueryNode => {
      if (peek()?.toUpperCase() === 'NOT') {
        consume(); // consume 'NOT'
        const child = parseNot();
        return { type: 'NOT', child };
      }
      return parsePrimary();
    };

    // Parse primary expressions (terms, field queries, parentheses)
    const parsePrimary = (): BooleanQueryNode => {
      const token = peek();

      if (!token) {
        throw new Error('Unexpected end of query');
      }

      // Parentheses
      if (token === '(') {
        consume(); // consume '('
        const node = parseOr();
        if (consume() !== ')') {
          throw new Error('Expected closing parenthesis');
        }
        return node;
      }

      // Field-specific query (field:value)
      if (token.includes(':')) {
        consume();
        const [field, ...valueParts] = token.split(':');
        const value = valueParts.join(':'); // Handle colons in value
        return { type: 'TERM', field: field.toLowerCase(), value: value.toLowerCase() };
      }

      // Regular term
      consume();
      return { type: 'TERM', value: token.toLowerCase() };
    };

    const result = parseOr();

    // Check for unconsumed tokens
    if (position < tokens.length) {
      throw new Error(`Unexpected token: ${tokens[position]}`);
    }

    return result;
  }

  /**
   * Evaluate a boolean query AST against an entity.
   */
  private evaluateBooleanQuery(node: BooleanQueryNode, entity: Entity): boolean {
    switch (node.type) {
      case 'AND':
        return node.children.every(child => this.evaluateBooleanQuery(child, entity));

      case 'OR':
        return node.children.some(child => this.evaluateBooleanQuery(child, entity));

      case 'NOT':
        return !this.evaluateBooleanQuery(node.child, entity);

      case 'TERM': {
        const value = node.value;

        // Field-specific search
        if (node.field) {
          switch (node.field) {
            case 'name':
              return entity.name.toLowerCase().includes(value);
            case 'type':
            case 'entitytype':
              return entity.entityType.toLowerCase().includes(value);
            case 'observation':
            case 'observations':
              return entity.observations.some(obs => obs.toLowerCase().includes(value));
            case 'tag':
            case 'tags':
              return entity.tags ? entity.tags.some(tag => tag.toLowerCase().includes(value)) : false;
            default:
              // Unknown field, search all text fields
              return this.entityMatchesTerm(entity, value);
          }
        }

        // General search across all fields
        return this.entityMatchesTerm(entity, value);
      }
    }
  }

  /**
   * Check if entity matches a search term in any text field.
   */
  private entityMatchesTerm(entity: Entity, term: string): boolean {
    const termLower = term.toLowerCase();

    return (
      entity.name.toLowerCase().includes(termLower) ||
      entity.entityType.toLowerCase().includes(termLower) ||
      entity.observations.some(obs => obs.toLowerCase().includes(termLower)) ||
      (entity.tags?.some(tag => tag.toLowerCase().includes(termLower)) || false)
    );
  }

  /**
   * Validate query complexity to prevent resource exhaustion.
   * Checks nesting depth, term count, and operator count against configured limits.
   */
  private validateQueryComplexity(node: BooleanQueryNode, depth: number = 0): void {
    // Check nesting depth
    if (depth > QUERY_LIMITS.MAX_DEPTH) {
      throw new ValidationError(
        'Query too complex',
        [`Query nesting depth ${depth} exceeds maximum of ${QUERY_LIMITS.MAX_DEPTH}`]
      );
    }

    // Count terms and operators recursively
    const complexity = this.calculateQueryComplexity(node);

    if (complexity.terms > QUERY_LIMITS.MAX_TERMS) {
      throw new ValidationError(
        'Query too complex',
        [`Query has ${complexity.terms} terms, exceeds maximum of ${QUERY_LIMITS.MAX_TERMS}`]
      );
    }

    if (complexity.operators > QUERY_LIMITS.MAX_OPERATORS) {
      throw new ValidationError(
        'Query too complex',
        [`Query has ${complexity.operators} operators, exceeds maximum of ${QUERY_LIMITS.MAX_OPERATORS}`]
      );
    }
  }

  /**
   * Calculate query complexity metrics.
   */
  private calculateQueryComplexity(
    node: BooleanQueryNode,
    depth: number = 0
  ): { terms: number; operators: number; maxDepth: number } {
    switch (node.type) {
      case 'AND':
      case 'OR':
        const childResults = node.children.map(child => this.calculateQueryComplexity(child, depth + 1));
        return {
          terms: childResults.reduce((sum, r) => sum + r.terms, 0),
          operators: childResults.reduce((sum, r) => sum + r.operators, 1), // +1 for current operator
          maxDepth: Math.max(depth, ...childResults.map(r => r.maxDepth)),
        };

      case 'NOT':
        const notResult = this.calculateQueryComplexity(node.child, depth + 1);
        return {
          terms: notResult.terms,
          operators: notResult.operators + 1,
          maxDepth: Math.max(depth, notResult.maxDepth),
        };

      case 'TERM':
        return {
          terms: 1,
          operators: 0,
          maxDepth: depth,
        };
    }
  }
}
