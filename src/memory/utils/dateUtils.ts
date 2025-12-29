/**
 * Date Utilities
 *
 * Helper functions for date parsing, validation, and range filtering.
 * All dates use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ).
 *
 * @module utils/dateUtils
 */

/**
 * Check if a date falls within a specified range.
 *
 * @param date - ISO 8601 date string to check (may be undefined)
 * @param start - Optional start date (inclusive)
 * @param end - Optional end date (inclusive)
 * @returns True if date is within range or no filters are set
 *
 * @example
 * ```typescript
 * isWithinDateRange('2024-06-15T00:00:00Z', '2024-01-01T00:00:00Z', '2024-12-31T23:59:59Z'); // true
 * isWithinDateRange('2024-06-15T00:00:00Z', '2024-07-01T00:00:00Z'); // false
 * isWithinDateRange(undefined); // true (no filters)
 * isWithinDateRange(undefined, '2024-01-01T00:00:00Z'); // false (has filter but no date)
 * ```
 */
export function isWithinDateRange(
  date: string | undefined,
  start?: string,
  end?: string
): boolean {
  // If no filters set, always pass
  if (!start && !end) {
    return true;
  }

  // If date is undefined but we have filters, fail
  if (!date) {
    return false;
  }

  const dateObj = new Date(date);

  if (isNaN(dateObj.getTime())) {
    return false;
  }

  if (start) {
    const startObj = new Date(start);
    if (isNaN(startObj.getTime())) {
      return false;
    }
    if (dateObj < startObj) {
      return false;
    }
  }

  if (end) {
    const endObj = new Date(end);
    if (isNaN(endObj.getTime())) {
      return false;
    }
    if (dateObj > endObj) {
      return false;
    }
  }

  return true;
}

/**
 * Parse and validate date range strings.
 *
 * @param startDate - Optional ISO 8601 start date
 * @param endDate - Optional ISO 8601 end date
 * @returns Parsed Date objects or null
 */
export function parseDateRange(
  startDate?: string,
  endDate?: string
): { start: Date | null; end: Date | null } {
  let start: Date | null = null;
  let end: Date | null = null;

  if (startDate) {
    start = new Date(startDate);
    if (isNaN(start.getTime())) {
      start = null;
    }
  }

  if (endDate) {
    end = new Date(endDate);
    if (isNaN(end.getTime())) {
      end = null;
    }
  }

  return { start, end };
}

/**
 * Validate if a string is a valid ISO 8601 date.
 *
 * @param date - Date string to validate
 * @returns True if valid ISO 8601 date
 */
export function isValidISODate(date: string): boolean {
  const dateObj = new Date(date);
  return !isNaN(dateObj.getTime()) && dateObj.toISOString() === date;
}

/**
 * Get current timestamp in ISO 8601 format.
 *
 * @returns Current timestamp string
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
