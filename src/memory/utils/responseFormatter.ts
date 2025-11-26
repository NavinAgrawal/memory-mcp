/**
 * MCP Tool Response Formatter Utilities
 *
 * Centralizes response formatting for MCP tool calls to eliminate
 * redundant JSON.stringify patterns across the codebase.
 */

/**
 * MCP Tool Response type - uses the exact shape expected by the SDK.
 * The 'as const' assertion ensures the type literal is preserved.
 */
export type ToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

/**
 * Formats data as an MCP tool response with JSON content.
 * Centralizes the response format to ensure consistency and reduce duplication.
 *
 * @param data - Any data to be JSON stringified
 * @returns Formatted MCP tool response
 */
export function formatToolResponse(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Formats a simple text message as an MCP tool response.
 * Use for success messages that don't need JSON formatting.
 *
 * @param message - Plain text message
 * @returns Formatted MCP tool response
 */
export function formatTextResponse(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
  };
}

/**
 * Formats raw string content as an MCP tool response.
 * Use for export formats that return pre-formatted strings (markdown, CSV, etc.)
 *
 * @param content - Raw string content
 * @returns Formatted MCP tool response
 */
export function formatRawResponse(content: string) {
  return {
    content: [{ type: 'text' as const, text: content }],
  };
}

/**
 * Formats an error as an MCP tool response with isError flag.
 *
 * @param error - Error object or message string
 * @returns Formatted MCP tool error response
 */
export function formatErrorResponse(error: Error | string) {
  const message = error instanceof Error ? error.message : error;
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}
