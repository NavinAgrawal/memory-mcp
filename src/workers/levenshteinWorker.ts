/**
 * Levenshtein Worker
 *
 * Worker thread for calculating Levenshtein distances in parallel.
 *
 * @module workers/levenshteinWorker
 */

import { parentPort, workerData } from 'worker_threads';

/**
 * Input data structure for the worker.
 */
interface WorkerInput {
  /** Search query string */
  query: string;
  /** Array of entities to search */
  entities: Array<{
    name: string;
    nameLower: string;
    observations: string[];
  }>;
  /** Similarity threshold (0.0 to 1.0) */
  threshold: number;
}

/**
 * Match result returned by the worker.
 */
interface MatchResult {
  /** Entity name that matched */
  name: string;
  /** Similarity score (0.0 to 1.0) */
  score: number;
  /** Where the match occurred */
  matchedIn: 'name' | 'observation';
}

/**
 * Calculate Levenshtein distance between two strings.
 *
 * Uses dynamic programming matrix for efficient computation.
 *
 * @param s1 - First string
 * @param s2 - Second string
 * @returns Levenshtein distance (number of edits)
 */
function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity score between two strings.
 *
 * @param s1 - First string
 * @param s2 - Second string
 * @returns Similarity score (0.0 to 1.0, where 1.0 is identical)
 */
function similarity(s1: string, s2: string): number {
  // Exact match
  if (s1 === s2) return 1.0;

  // One contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 1.0;

  // Calculate Levenshtein-based similarity
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}

/**
 * Main worker logic: process entities and find fuzzy matches.
 */
if (parentPort) {
  const { query, entities, threshold } = workerData as WorkerInput;
  const queryLower = query.toLowerCase();
  const results: MatchResult[] = [];

  for (const entity of entities) {
    // Check name similarity
    const nameScore = similarity(queryLower, entity.nameLower);
    if (nameScore >= threshold) {
      results.push({ name: entity.name, score: nameScore, matchedIn: 'name' });
      continue;
    }

    // Check observations
    for (const obs of entity.observations) {
      const obsScore = similarity(queryLower, obs);
      if (obsScore >= threshold) {
        results.push({ name: entity.name, score: obsScore, matchedIn: 'observation' });
        break;
      }
    }
  }

  // Send results back to parent thread
  parentPort.postMessage(results);
}
