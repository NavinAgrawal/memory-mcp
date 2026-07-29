// Build the self-contained plugin bundle consumed by .mcp.json
// (${CLAUDE_PLUGIN_ROOT}/bundle/index.mjs).
//
// Previously this bundle was produced ad hoc, with no committed recipe — so
// reproducing it meant reverse-engineering the flags out of the shipped artifact.
// Two of them are load-bearing and not obvious:
//
//   banner    memoryjs and @danielsimonjr/workerpool call require() at runtime
//             (e.g. require('worker_threads')). In an ESM bundle there is no
//             `require`, so esbuild emits a stub that throws
//             "Dynamic require of X is not supported" and the server dies on
//             startup. The banner re-creates require/__filename/__dirname.
//
//   external  better-sqlite3 is a native .node addon and cannot be bundled.
//             The rest are optional heavy deps memoryjs loads lazily.
//
// Run: node scripts/build-bundle.mjs
import { build } from 'esbuild';

const BANNER = [
  "import { createRequire as __createRequire } from 'node:module';",
  "import { fileURLToPath as __fileURLToPath } from 'node:url';",
  "import { dirname as __dirnameOf } from 'node:path';",
  'const require = __createRequire(import.meta.url);',
  'const __filename = __fileURLToPath(import.meta.url);',
  'const __dirname = __dirnameOf(__filename);',
].join('');

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile: process.env.BUNDLE_OUT ?? 'bundle/index.mjs',
  // No shebang here: esbuild already preserves the one on src/index.ts. Adding a second
  // puts it on line 2, where it is a syntax error rather than a comment.
  banner: { js: BANNER },
  external: [
    'better-sqlite3',
    'fsevents',
    'sharp',
    'onnxruntime-node',
    '@huggingface/transformers',
  ],
  logLevel: 'info',
});
