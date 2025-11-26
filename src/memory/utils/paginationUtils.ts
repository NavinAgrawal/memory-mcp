/**
 * Pagination Utilities
 *
 * Centralizes pagination validation and application logic
 * to eliminate duplicate patterns across search implementations.
 */

import { SEARCH_LIMITS } from './constants.js';

/**
 * Validated pagination parameters with helper methods.
 */
export interface ValidatedPagination {
  /** Validated offset (guaranteed >= 0) */
  offset: number;
  /** Validated limit (guaranteed within SEARCH_LIMITS.MIN to SEARCH_LIMITS.MAX) */
  limit: number;
  /**
   * Check if there are more results beyond the current page.
   * @param totalCount - Total number of items
   * @returns true if there are more items after this page
   */
  hasMore: (totalCount: number) => boolean;
}

/**
 * Validates and normalizes pagination parameters.
 * Ensures offset is non-negative and limit is within configured bounds.
 *
 * @param offset - Starting position (default: 0)
 * @param limit - Maximum results to return (default: SEARCH_LIMITS.DEFAULT)
 * @returns Validated pagination parameters with helper methods
 *
 * @example
 * ```typescript
 * const pagination = validatePagination(10, 50);
 * const results = items.slice(pagination.offset, pagination.offset + pagination.limit);
 * if (pagination.hasMore(items.length)) {
 *   console.log('More results available');
 * }
 * ```
 */
export function validatePagination(
  offset: number = 0,
  limit: number = SEARCH_LIMITS.DEFAULT
): ValidatedPagination {
  const validatedOffset = Math.max(0, offset);
  const validatedLimit = Math.min(
    Math.max(SEARCH_LIMITS.MIN, limit),
    SEARCH_LIMITS.MAX
  );

  return {
    offset: validatedOffset,
    limit: validatedLimit,
    hasMore: (totalCount: number) => validatedOffset + validatedLimit < totalCount,
  };
}

/**
 * Applies pagination to an array of items.
 *
 * @param items - Array to paginate
 * @param pagination - Validated pagination parameters
 * @returns Paginated slice of the array
 *
 * @example
 * ```typescript
 * const pagination = validatePagination(offset, limit);
 * const pageResults = applyPagination(allResults, pagination);
 * ```
 */
export function applyPagination<T>(
  items: T[],
  pagination: ValidatedPagination
): T[] {
  return items.slice(pagination.offset, pagination.offset + pagination.limit);
}

/**
 * Applies pagination using raw offset and limit values.
 * Combines validation and application in one call.
 *
 * @param items - Array to paginate
 * @param offset - Starting position
 * @param limit - Maximum results
 * @returns Paginated slice of the array
 */
export function paginateArray<T>(
  items: T[],
  offset: number = 0,
  limit: number = SEARCH_LIMITS.DEFAULT
): T[] {
  const pagination = validatePagination(offset, limit);
  return applyPagination(items, pagination);
}

/**
 * Calculates pagination metadata for a result set.
 *
 * @param totalCount - Total number of items
 * @param offset - Current offset
 * @param limit - Current limit
 * @returns Pagination metadata
 */
export function getPaginationMeta(
  totalCount: number,
  offset: number = 0,
  limit: number = SEARCH_LIMITS.DEFAULT
): {
  totalCount: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  pageNumber: number;
  totalPages: number;
} {
  const pagination = validatePagination(offset, limit);

  return {
    totalCount,
    offset: pagination.offset,
    limit: pagination.limit,
    hasMore: pagination.hasMore(totalCount),
    pageNumber: Math.floor(pagination.offset / pagination.limit) + 1,
    totalPages: Math.ceil(totalCount / pagination.limit),
  };
}
