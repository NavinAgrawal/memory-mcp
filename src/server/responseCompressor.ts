/**
 * MCP Response Compression Module
 *
 * Provides automatic compression for large MCP tool responses using brotli.
 * Responses exceeding the threshold (default 256KB) are automatically
 * compressed and base64-encoded for transport.
 *
 * @module server/responseCompressor
 */

import { compress, decompress, COMPRESSION_CONFIG } from '@danielsimonjr/memoryjs';

/**
 * Structure of a compressed MCP response.
 * Clients receiving this format should check the `compressed` field
 * and decompress the `data` field if true.
 */
export interface CompressedResponse {
  /** Whether the response data is compressed */
  compressed: boolean;
  /** Compression format used */
  compressionFormat: 'brotli' | 'none';
  /** Encoding of the data field */
  encoding: 'utf-8' | 'base64';
  /** Original size in bytes (only present if compressed) */
  originalSize?: number;
  /** Compressed size in bytes (only present if compressed) */
  compressedSize?: number;
  /** The response data (compressed and base64-encoded, or plain text) */
  data: string;
}

/**
 * Options for response compression.
 */
export interface ResponseCompressionOptions {
  /** Force compression regardless of size threshold */
  forceCompress?: boolean;
  /** Custom size threshold in bytes (default: 256KB from COMPRESSION_CONFIG) */
  threshold?: number;
  /** Brotli quality level 0-11 (default: 6 from COMPRESSION_CONFIG) */
  quality?: number;
}

/**
 * Conditionally compress a response based on size threshold.
 *
 * Responses smaller than the threshold are returned unchanged.
 * Responses larger than the threshold are compressed with brotli
 * and base64-encoded for safe JSON transport.
 *
 * @param content - The response content to potentially compress
 * @param options - Compression options
 * @returns A CompressedResponse object indicating compression status
 *
 * @example
 * ```typescript
 * // Auto-compress large response
 * const response = await maybeCompressResponse(largeJsonString);
 * if (response.compressed) {
 *   console.log(`Compressed from ${response.originalSize} to ${response.compressedSize}`);
 * }
 *
 * // Force compression
 * const compressed = await maybeCompressResponse(data, { forceCompress: true });
 * ```
 */
export async function maybeCompressResponse(
  content: string,
  options: ResponseCompressionOptions = {}
): Promise<CompressedResponse> {
  const threshold = options.threshold ?? COMPRESSION_CONFIG.AUTO_COMPRESS_RESPONSE_SIZE;
  const originalSize = Buffer.byteLength(content, 'utf-8');

  const shouldCompress = options.forceCompress || originalSize > threshold;

  if (!shouldCompress) {
    return {
      compressed: false,
      compressionFormat: 'none',
      encoding: 'utf-8',
      data: content,
    };
  }

  const quality = options.quality ?? COMPRESSION_CONFIG.BROTLI_QUALITY_BATCH;

  const result = await compress(content, { quality });

  return {
    compressed: true,
    compressionFormat: 'brotli',
    encoding: 'base64',
    originalSize,
    compressedSize: result.compressedSize,
    data: result.compressed.toString('base64'),
  };
}

/**
 * Decompress a compressed response back to its original string content.
 *
 * If the response is not compressed, returns the data unchanged.
 *
 * @param response - The CompressedResponse to decompress
 * @returns The original string content
 *
 * @example
 * ```typescript
 * const original = await decompressResponse(compressedResponse);
 * const parsed = JSON.parse(original);
 * ```
 */
export async function decompressResponse(
  response: CompressedResponse
): Promise<string> {
  if (!response.compressed) {
    return response.data;
  }

  const buffer = Buffer.from(response.data, 'base64');
  const decompressed = await decompress(buffer);
  return decompressed.toString('utf-8');
}

/**
 * Check if a response object is a CompressedResponse.
 *
 * @param obj - The object to check
 * @returns True if the object has the CompressedResponse structure
 */
export function isCompressedResponse(obj: unknown): obj is CompressedResponse {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const response = obj as Record<string, unknown>;
  return (
    typeof response.compressed === 'boolean' &&
    (response.compressionFormat === 'brotli' || response.compressionFormat === 'none') &&
    (response.encoding === 'utf-8' || response.encoding === 'base64') &&
    typeof response.data === 'string'
  );
}

/**
 * Calculate potential compression savings without actually compressing.
 * Useful for estimating whether compression would be beneficial.
 *
 * @param content - The content to estimate compression for
 * @returns Estimated compression ratio (0-1, lower is better compression)
 */
export function estimateCompressionRatio(content: string): number {
  // Rough heuristic: JSON and repetitive text compress well (0.25-0.35)
  // Random/binary data compresses poorly (0.9+)
  const size = Buffer.byteLength(content, 'utf-8');

  // Very small content has overhead that makes compression not worthwhile
  if (size < 1000) {
    return 1.0;
  }

  // Check for JSON-like content (compresses very well)
  const jsonIndicators = (content.match(/[{}\[\]":,]/g) || []).length;
  const jsonRatio = jsonIndicators / size;

  if (jsonRatio > 0.1) {
    // Highly JSON-like, expect 60-75% compression
    return 0.25 + (0.1 * Math.random());
  }

  // Check for repetitive content
  const uniqueChars = new Set(content).size;
  const repetitionRatio = uniqueChars / Math.min(size, 256);

  if (repetitionRatio < 0.3) {
    // Very repetitive, expect 50-70% compression
    return 0.3 + (0.15 * Math.random());
  }

  // Default estimate for mixed content
  return 0.5 + (0.2 * Math.random());
}
