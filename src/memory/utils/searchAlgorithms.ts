/**
 * Search Algorithms
 *
 * Algorithms for search operations: Levenshtein distance for fuzzy matching
 * and TF-IDF for relevance scoring.
 *
 * @module utils/searchAlgorithms
 */

// ==================== Levenshtein Distance ====================

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

// ==================== TF-IDF ====================

/**
 * Calculate Term Frequency (TF) for a term in a document.
 *
 * TF = (Number of times term appears in document) / (Total terms in document)
 *
 * @param term - The search term
 * @param document - The document text
 * @returns Term frequency (0.0 to 1.0)
 */
export function calculateTF(term: string, document: string): number {
  const termLower = term.toLowerCase();
  const tokens = tokenize(document);

  if (tokens.length === 0) return 0;

  const termCount = tokens.filter(t => t === termLower).length;
  return termCount / tokens.length;
}

/**
 * Calculate Inverse Document Frequency (IDF) for a term across documents.
 *
 * IDF = log(Total documents / Documents containing term)
 *
 * @param term - The search term
 * @param documents - Array of document texts
 * @returns Inverse document frequency
 */
export function calculateIDF(term: string, documents: string[]): number {
  if (documents.length === 0) return 0;

  const termLower = term.toLowerCase();
  const docsWithTerm = documents.filter(doc =>
    tokenize(doc).includes(termLower)
  ).length;

  if (docsWithTerm === 0) return 0;

  return Math.log(documents.length / docsWithTerm);
}

/**
 * Calculate TF-IDF score for a term in a document.
 *
 * TF-IDF = TF * IDF
 *
 * Higher scores indicate more important/relevant terms.
 *
 * @param term - The search term
 * @param document - The document text
 * @param documents - Array of all documents
 * @returns TF-IDF score
 */
export function calculateTFIDF(
  term: string,
  document: string,
  documents: string[]
): number {
  const tf = calculateTF(term, document);
  const idf = calculateIDF(term, documents);
  return tf * idf;
}

/**
 * Tokenize text into lowercase words.
 *
 * Splits on whitespace and removes punctuation.
 *
 * @param text - Text to tokenize
 * @returns Array of lowercase tokens
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);
}
