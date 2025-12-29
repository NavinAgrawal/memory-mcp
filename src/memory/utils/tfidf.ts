/**
 * TF-IDF (Term Frequency-Inverse Document Frequency) Utilities
 *
 * Algorithms for calculating TF-IDF scores used in ranked search.
 * TF-IDF measures how important a term is to a document in a collection.
 *
 * @module utils/tfidf
 */

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
