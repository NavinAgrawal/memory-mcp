import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Vitest's 5s default is too tight for the Windows CI leg. These suites are
    // I/O-bound (every test builds a real JSONL graph under tmpdir) and run
    // heavily parallel — a failing run logged 162s of test time inside 63s of
    // wall clock, i.e. ~3x oversubscription. Under that contention a single
    // `add_observations` call — trivial work — blew the 5s budget and failed
    // `ci (windows-latest, 24.x)` while the identical commit passed on
    // ubuntu, on windows/Node 22, and on a plain re-run of the same job.
    // That intermittent red blocked Dependabot PRs from merging, which is what
    // produced the recurring `pull_request_exists_for_security_update` failures.
    // The budget is a flake guard, not a performance target: real hangs still
    // fail, just not on runner scheduling jitter.
    testTimeout: 30_000,
    // beforeEach/afterEach do recursive mkdir + rm under tmpdir, which is the
    // slowest thing on a Windows runner (Defender scans every created file).
    hookTimeout: 30_000,
    exclude: process.env.SKIP_BENCHMARKS
      ? ['**/node_modules/**', '**/benchmarks/**']
      : ['**/node_modules/**'],
    reporters: [
      'default',
      './tests/test-results/per-file-reporter.js',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/tests/**',
        'src/**/index.ts',
      ],
    },
  },
});
