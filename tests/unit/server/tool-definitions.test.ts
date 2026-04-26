/**
 * Tool definition contract tests.
 *
 * Asserts that advertised JSON Schemas in toolDefinitions match what the
 * underlying memoryjs Zod validators actually accept. A mismatch is a
 * contract lie — clients see an advertised field, pass it, then get
 * validation rejection.
 */

import { describe, it, expect } from 'vitest';
import { toolDefinitions } from '../../../src/server/toolDefinitions.js';

describe('toolDefinitions contract', () => {
  describe('save_search', () => {
    const def = toolDefinitions.find(t => t.name === 'save_search');

    it('exists', () => {
      expect(def).toBeDefined();
    });

    it('does NOT advertise `searchType` — Zod SavedSearchInputSchema is .strict() and rejects it', () => {
      // Smoke-test 2026-04-25 finding: tool def advertised `searchType`
      // but the underlying Zod schema in memoryjs rejected the call with
      // "Invalid saved search data". Removing the field makes the
      // contract honest.
      const props = def?.inputSchema?.properties as Record<string, unknown> | undefined;
      expect(props).toBeDefined();
      expect(props && 'searchType' in props).toBe(false);
    });

    it('preserves required = [name, query]', () => {
      expect(def?.inputSchema?.required).toEqual(['name', 'query']);
    });

    it('preserves additionalProperties: false', () => {
      expect(def?.inputSchema?.additionalProperties).toBe(false);
    });
  });
});
