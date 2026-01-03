# Phase 5: Folder Restructuring Plan

**Version:** 8.57.0 → 8.58.0
**Date:** 2026-01-02
**Status:** Planning

## Overview

Restructure the memory-mcp codebase to match the simpler, flatter structure used by deepthinking-mcp. This eliminates the npm workspaces pattern and moves tests to the root level.

## Current Structure

```
C:\mcp-servers\memory-mcp\
├── src/memory/                    # All source code nested here
│   ├── core/           (11 files) # EntityManager, GraphStorage, etc.
│   ├── features/       (6 files)  # TagManager, IOManager, etc.
│   ├── search/         (13 files) # SearchManager, FuzzySearch, etc.
│   ├── server/         (4 files)  # MCPServer, toolHandlers, etc.
│   ├── types/          (2 files)  # Type definitions
│   ├── utils/          (12 files) # Utilities, schemas, formatters
│   ├── __tests__/      (52 files) # Tests in unit/integration/e2e/performance
│   ├── index.ts                   # Entry point
│   ├── vitest.config.ts           # Test configuration
│   ├── package.json               # Workspace package
│   └── tsconfig.json              # Extends root tsconfig
├── package.json                   # Root package (workspaces: ["src/memory"])
└── tsconfig.json                  # Root TypeScript config
```

## Target Structure

```
C:\mcp-servers\memory-mcp\
├── src/                           # Flattened source (no /memory nesting)
│   ├── core/           (11 files)
│   ├── features/       (6 files)
│   ├── search/         (13 files)
│   ├── server/         (4 files)
│   ├── types/          (2 files)
│   ├── utils/          (12 files)
│   └── index.ts
├── tests/                         # Tests at root level (renamed from __tests__)
│   ├── unit/
│   │   ├── core/
│   │   ├── features/
│   │   ├── search/
│   │   ├── server/
│   │   └── utils/
│   ├── integration/
│   ├── e2e/
│   │   └── tools/
│   ├── performance/
│   ├── edge-cases/
│   ├── test-results/              # New: Custom reporter output
│   │   ├── json/
│   │   ├── html/
│   │   └── summary/
│   ├── knowledge-graph.test.ts
│   └── file-path.test.ts
├── vitest.config.ts               # Moved to root
├── package.json                   # Single merged package (no workspaces)
└── tsconfig.json                  # Updated for new structure
```

## Impact Analysis

| Aspect | Files Affected | Notes |
|--------|---------------|-------|
| **Source files** | 48 .ts files | Move only, no internal import changes needed |
| **Test files** | 52 .test.ts files | Move + update all import paths |
| **Config files** | 5 files | tsconfig.json, vitest.config.ts, both package.json |
| **Documentation** | 2 files | CLAUDE.md, README.md path references |

## Detailed Tasks

### Sprint 1: Preparation

1. **Create git stash backup**
   ```bash
   git stash push -m "Pre-restructuring backup v8.57.0"
   ```

2. **Document current state**
   - Verify all tests pass before restructuring
   - Note current test count: 1803 tests

### Sprint 2: Source File Migration

Move files from `src/memory/` to `src/`:

| From | To |
|------|-----|
| `src/memory/core/*.ts` | `src/core/*.ts` |
| `src/memory/features/*.ts` | `src/features/*.ts` |
| `src/memory/search/*.ts` | `src/search/*.ts` |
| `src/memory/server/*.ts` | `src/server/*.ts` |
| `src/memory/types/*.ts` | `src/types/*.ts` |
| `src/memory/utils/*.ts` | `src/utils/*.ts` |
| `src/memory/index.ts` | `src/index.ts` |

**Note:** Source files import each other using relative paths like `../core/EntityManager.js`. These paths remain valid after the move since the relative structure is preserved.

### Sprint 3: Test File Migration

Move tests from `src/memory/__tests__/` to `tests/`:

| From | To |
|------|-----|
| `src/memory/__tests__/unit/*` | `tests/unit/*` |
| `src/memory/__tests__/integration/*` | `tests/integration/*` |
| `src/memory/__tests__/e2e/*` | `tests/e2e/*` |
| `src/memory/__tests__/performance/*` | `tests/performance/*` |
| `src/memory/__tests__/edge-cases/*` | `tests/edge-cases/*` |
| `src/memory/__tests__/*.test.ts` | `tests/*.test.ts` |

**Import Path Updates Required:**

Current test imports (example from EntityManager.test.ts):
```typescript
import { EntityManager } from '../../../core/EntityManager.js';
import { GraphStorage } from '../../../core/GraphStorage.js';
import { EntityNotFoundError } from '../../../utils/errors.js';
```

New imports after restructuring:
```typescript
import { EntityManager } from '../../src/core/EntityManager.js';
import { GraphStorage } from '../../src/core/GraphStorage.js';
import { EntityNotFoundError } from '../../src/utils/errors.js';
```

**Import path mapping by test location:**

| Test Location | Old Path Prefix | New Path Prefix |
|---------------|-----------------|-----------------|
| `tests/unit/core/` | `../../../` | `../../../src/` |
| `tests/unit/features/` | `../../../` | `../../../src/` |
| `tests/unit/search/` | `../../../` | `../../../src/` |
| `tests/unit/server/` | `../../../` | `../../../src/` |
| `tests/unit/utils/` | `../../../` | `../../../src/` |
| `tests/integration/` | `../../` | `../../src/` |
| `tests/e2e/tools/` | `../../../` | `../../../src/` |
| `tests/performance/` | `../../` | `../../src/` |
| `tests/edge-cases/` | `../../` | `../../src/` |
| `tests/*.test.ts` | `../` | `../src/` |

### Sprint 4: Configuration Updates

#### 4.1 Merge package.json files

**Current root package.json:**
```json
{
  "workspaces": ["src/memory"],
  "scripts": {
    "build": "npm run build --workspace=src/memory",
    "test": "npm run test --workspace=src/memory"
  }
}
```

**New merged package.json:**
```json
{
  "name": "@danielsimonjr/memory-mcp",
  "version": "8.58.0",
  "type": "module",
  "main": "./dist/index.js",
  "bin": { "mcp-server-memory": "dist/index.js" },
  "scripts": {
    "build": "tsc",
    "test": "vitest run --coverage",
    "test:run": "cross-env VITEST_REPORT_MODE=summary vitest --run --coverage",
    "test:debug": "cross-env VITEST_REPORT_MODE=debug vitest --run --coverage",
    "test:all": "cross-env VITEST_REPORT_MODE=all vitest --run --coverage"
  }
}
```

#### 4.2 Update tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

#### 4.3 Update vitest.config.ts (move to root)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
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
      ],
    },
  },
});
```

### Sprint 5: Custom Test Reporter

Create `tests/test-results/per-file-reporter.js` adapted from deepthinking-mcp:
- Generates per-file JSON/HTML reports
- Creates summary dashboard with coverage integration
- Supports modes: summary, debug, all

### Sprint 6: Documentation Updates

Update these files with new paths:
- `CLAUDE.md` - Architecture diagrams, file counts, paths
- `README.md` - Structure references, build commands
- `docs/architecture/OVERVIEW.md` - If exists

### Sprint 7: Cleanup & Verification

1. Delete old directories:
   - `src/memory/` (after verification)
   - `src/memory/node_modules/` (workspace-specific)

2. Reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. Verify:
   ```bash
   npm run build
   npm test
   ```

4. Expected: All 1803 tests pass

## Risk Mitigation

1. **Git stash backup** before any changes
2. **Manual file moves** - No bulk scripting to avoid errors
3. **Incremental verification** - Build after source moves, test after import updates
4. **Atomic commit** - All changes in single commit for easy rollback

## Version Bump

- **Before:** 8.57.0
- **After:** 8.58.0 (minor: structural change, no new features)

## Success Criteria

- [ ] All 48 source files moved to `src/`
- [ ] All 52 test files moved to `tests/`
- [ ] All test imports updated correctly
- [ ] Single package.json (no workspaces)
- [ ] `npm run build` succeeds
- [ ] `npm test` passes all 1803 tests
- [ ] Custom per-file reporter generates reports
- [ ] CLAUDE.md and README.md updated
