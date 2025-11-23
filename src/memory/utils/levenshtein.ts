/**
 * Levenshtein Distance Algorithm
 *
 * Calculates the minimum number of single-character edits (insertions,
 * deletions, or substitutions) needed to change one string into another.
 *
 * Used for fuzzy string matching to find similar entities despite typos.
 *
 * @module utils/levenshtein
 */

/**
 * Calculate Levenshtein distance between two strings.
 *
 * Returns the minimum number of single-character edits needed to change
 * one word into another.
 *
 * **Algorithm**: Dynamic programming with O(m*n) time and space complexity,
 * where m and n are the lengths of the two strings.
 *
 * @param str1 - First string to compare
 * @param str2 - Second string to compare
 * @returns Minimum number of edits required (0 = identical strings)
 *
 * @example
 * ```typescript
 * levenshteinDistance("kitten", "sitting"); // Returns 3
 * levenshteinDistance("hello", "hello");    // Returns 0
 * levenshteinDistance("abc", "");           // Returns 3
 * ```
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create 2D array for dynamic programming
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize base cases: distance from empty string
  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  // Fill dp table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        // Characters match, no edit needed
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        // Take minimum of three operations
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return dp[m][n];
}
