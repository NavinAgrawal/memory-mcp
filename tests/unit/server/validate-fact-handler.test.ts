/**
 * Unit tests for the `validate_fact_against_world` handler's
 * embedding-provider-unavailable graceful path.
 *
 * Discovered via smoke test 2026-04-25: when memoryjs's local embedding
 * provider is selected but `@xenova/transformers` isn't installed,
 * `MemoryValidator.validateConsistency` raises a raw module-resolution
 * error that propagates verbatim through the MCP transport. This
 * exposes Node internals to LLM clients and obscures the actual
 * configuration issue. The handler should catch this specific class of
 * error and return the documented "Returns null if no validator is
 * wired" semantics with a structured reason code instead.
 */

import { describe, it, expect, vi } from 'vitest';
import { handleToolCall } from '../../../src/server/toolHandlers.js';
import type { ManagerContext } from '@danielsimonjr/memoryjs';

function makeStubCtx(validateFactImpl: () => Promise<unknown>): ManagerContext {
  return {
    worldModelManager: {
      validateFact: validateFactImpl,
    },
  } as unknown as ManagerContext;
}

describe('validate_fact_against_world handler', () => {
  it('translates "Failed to initialize ... embedding service" into a clean null result with reason code', async () => {
    const memoryjsError = new Error(
      'Failed to initialize local embedding service: ' +
      "Cannot find package '@xenova/transformers' imported from C:\\app\\dist\\index.js. " +
      'Make sure @xenova/transformers is installed.'
    );
    const ctx = makeStubCtx(() => Promise.reject(memoryjsError));

    const res = await handleToolCall(
      'validate_fact_against_world',
      { observation: 'storm hit', entityName: 'Storm' },
      ctx
    );

    expect(res.isError).toBeUndefined();
    const text = res.content?.[0]?.text;
    const payload = JSON.parse(text as string);
    expect(payload.result).toBeNull();
    expect(payload.reason).toBe('embedding_provider_unavailable');
    expect(payload.observation).toBe('storm hit');
    expect(payload.entityName).toBe('Storm');
    // Detail should reference the underlying cause for operator debugging
    expect(payload.detail).toMatch(/embedding|transformers/i);
  });

  it('also catches the @xenova/transformers package-name signal alone', async () => {
    // Defensive: if memoryjs changes the prefix wording, we still catch
    // the package-not-installed case via the package name itself.
    // Node's import resolver always quotes the package name in
    // "Cannot find package '<name>'" — see import resolution spec.
    const memoryjsError = new Error(
      "Some other wrapper text — Cannot find package '@xenova/transformers'"
    );
    const ctx = makeStubCtx(() => Promise.reject(memoryjsError));

    const res = await handleToolCall(
      'validate_fact_against_world',
      { observation: 'x', entityName: 'Y' },
      ctx
    );

    expect(res.isError).toBeUndefined();
    const payload = JSON.parse(res.content?.[0]?.text as string);
    expect(payload.result).toBeNull();
    expect(payload.reason).toBe('embedding_provider_unavailable');
  });

  it('propagates unrelated errors as isError: true (no swallowing)', async () => {
    const realError = new Error('Entity not found: Storm');
    const ctx = makeStubCtx(() => Promise.reject(realError));

    const res = await handleToolCall(
      'validate_fact_against_world',
      { observation: 'storm hit', entityName: 'Storm' },
      ctx
    );

    expect(res.isError).toBe(true);
    expect(res.content?.[0]?.text).toContain('Entity not found: Storm');
  });

  it('passes through the validator result when validateFact succeeds', async () => {
    const validatorResult = { consistent: true, conflicts: [] };
    const validateFact = vi.fn().mockResolvedValue(validatorResult);
    const ctx = makeStubCtx(validateFact);

    const res = await handleToolCall(
      'validate_fact_against_world',
      { observation: 'storm hit', entityName: 'Storm' },
      ctx
    );

    expect(res.isError).toBeUndefined();
    const payload = JSON.parse(res.content?.[0]?.text as string);
    expect(payload.result).toEqual(validatorResult);
    expect(payload.reason).toBeUndefined();
    expect(validateFact).toHaveBeenCalledWith('storm hit', 'Storm');
  });
});
