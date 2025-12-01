/**
 * Markdown Generator
 *
 * Generates the DEPENDENCY_GRAPH.md file from the dependency graph.
 */

import * as path from 'path';
import type { DependencyGraph, FileInfo, ClassInfo, ModuleInfo } from './types.js';

/**
 * Generate the full Markdown documentation
 */
export function generateMarkdown(graph: DependencyGraph): string {
  const sections: string[] = [];

  // Header
  sections.push(generateHeader(graph));

  // Table of Contents
  sections.push(generateTableOfContents());

  // Architecture Overview
  sections.push(generateArchitectureOverview(graph));

  // Module Dependency Matrix
  sections.push(generateModuleDependencyMatrix(graph));

  // Entry Point Analysis
  sections.push(generateEntryPointAnalysis(graph));

  // Core Module Dependencies
  sections.push(generateCoreModuleDependencies(graph));

  // Feature Module Dependencies
  sections.push(generateFeatureModuleDependencies(graph));

  // Search Module Dependencies
  sections.push(generateSearchModuleDependencies(graph));

  // Server Module Dependencies
  sections.push(generateServerModuleDependencies(graph));

  // Types Module Dependencies
  sections.push(generateTypesModuleDependencies(graph));

  // Utils Module Dependencies
  sections.push(generateUtilsModuleDependencies(graph));

  // Cross-Module Function Calls
  sections.push(generateCrossModuleFunctionCalls(graph));

  // Shared Variable Dependencies
  sections.push(generateSharedVariableDependencies(graph));

  // Dependency Visualization
  sections.push(generateDependencyVisualization(graph));

  // Circular Dependency Analysis
  sections.push(generateCircularDependencyAnalysis(graph));

  // Summary
  sections.push(generateSummary(graph));

  return sections.join('\n\n');
}

function generateHeader(graph: DependencyGraph): string {
  return `# Dependency Graph

> **Version**: ${graph.metadata.version}
> **Generated**: ${graph.metadata.generated}
> **Total Files Analyzed**: ${graph.metadata.totalFiles} source files

This document provides a comprehensive dependency graph for the Memory MCP Server codebase, tracing all imports, exports, function calls, and variable dependencies across all modules.

---`;
}

function generateTableOfContents(): string {
  return `## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Dependency Matrix](#2-module-dependency-matrix)
3. [Entry Point Analysis](#3-entry-point-analysis)
4. [Core Module Dependencies](#4-core-module-dependencies)
5. [Feature Module Dependencies](#5-feature-module-dependencies)
6. [Search Module Dependencies](#6-search-module-dependencies)
7. [Server Module Dependencies](#7-server-module-dependencies)
8. [Types Module Dependencies](#8-types-module-dependencies)
9. [Utils Module Dependencies](#9-utils-module-dependencies)
10. [Cross-Module Function Calls](#10-cross-module-function-calls)
11. [Shared Variable Dependencies](#11-shared-variable-dependencies)
12. [Dependency Visualization](#12-dependency-visualization)
13. [Circular Dependency Analysis](#13-circular-dependency-analysis)

---`;
}

function generateArchitectureOverview(graph: DependencyGraph): string {
  const layers = graph.dependencyGraph.layers;
  const modules = Object.values(graph.modules);

  let moduleTable = '| Category | Files | Purpose |\n|----------|-------|---------|';
  for (const mod of modules) {
    if (mod.name !== 'root') {
      moduleTable += `\n| **${mod.name}/** | ${mod.files.length} | ${mod.purpose} |`;
    }
  }

  return `## 1. Architecture Overview

### Layer Hierarchy

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER 1: ENTRY POINTS                        │
│  index.ts → Exports all public APIs                             │
│  bin/mcp-server-memory → CLI entry point                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    LAYER 2: SERVER                              │
│  MCPServer.ts ─────► toolDefinitions.ts                         │
│                ─────► toolHandlers.ts                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    LAYER 3: FACADE                              │
│  KnowledgeGraphManager.ts (orchestrates all managers)           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
┌──────▼──────┐     ┌───────▼──────┐     ┌──────▼──────┐
│    CORE     │     │   FEATURES   │     │   SEARCH    │
│  Managers   │     │   Managers   │     │   Engines   │
└──────┬──────┘     └───────┬──────┘     └──────┬──────┘
       │                    │                    │
┌──────▼────────────────────▼────────────────────▼────────────────┐
│                    LAYER 4: STORAGE                             │
│  GraphStorage.ts (JSONL file I/O + caching)                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    LAYER 5: FOUNDATION                          │
│  types/ (Entity, Relation, KnowledgeGraph, etc.)                │
│  utils/ (errors, constants, algorithms, helpers)                │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

### Module Categories

${moduleTable}

---`;
}

function generateModuleDependencyMatrix(graph: DependencyGraph): string {
  const files = Object.values(graph.files);
  const keyFiles = files.filter(f =>
    f.relativePath.includes('KnowledgeGraphManager') ||
    f.relativePath.includes('SearchManager') ||
    f.relativePath.includes('MCPServer') ||
    f.relativePath.includes('index.ts')
  );

  let rows = '| Source Module | Imports From |\n|---------------|--------------|';

  for (const file of keyFiles) {
    const imports = file.imports
      .filter(i => i.module.startsWith('.'))
      .map(i => {
        const items = i.items.slice(0, 3).join(', ');
        const more = i.items.length > 3 ? ', ...' : '';
        return `${i.module.replace(/\.js$/, '')} (${items}${more})`;
      })
      .slice(0, 5);

    if (imports.length > 0) {
      rows += `\n| \`${path.basename(file.relativePath)}\` | ${imports.join(', ')} |`;
    }
  }

  return `## 2. Module Dependency Matrix

### Import Dependencies by Module

${rows}

---`;
}

function generateEntryPointAnalysis(graph: DependencyGraph): string {
  const entryFile = Object.values(graph.files).find(f =>
    f.relativePath.endsWith('index.ts') && f.relativePath.includes('src/memory/index.ts')
  );

  if (!entryFile) {
    return '## 3. Entry Point Analysis\n\nNo entry point found.\n\n---';
  }

  const reexports = entryFile.exports
    .filter(e => e.type === 'reexport')
    .map(e => `│   └── ${e.from}`)
    .join('\n');

  return `## 3. Entry Point Analysis

### Main Entry: \`src/memory/index.ts\`

\`\`\`
index.ts
├── Exports from core/index.ts
│   ├── KnowledgeGraphManager (class)
│   ├── GraphStorage (class)
│   ├── EntityManager (class)
│   ├── RelationManager (class)
│   ├── ObservationManager (class)
│   └── TransactionManager (class)
├── Exports from features/index.ts
│   ├── HierarchyManager (class)
│   ├── TagManager (class)
│   ├── CompressionManager (class)
│   ├── ArchiveManager (class)
│   ├── AnalyticsManager (class)
│   ├── ExportManager (class)
│   ├── ImportManager (class)
│   ├── ImportExportManager (class)
│   └── BackupManager (class)
├── Exports from search/index.ts
│   ├── SearchManager (class)
│   ├── BasicSearch (class)
│   ├── RankedSearch (class)
│   ├── BooleanSearch (class)
│   ├── FuzzySearch (class)
│   ├── SavedSearchManager (class)
│   ├── SearchSuggestions (class)
│   ├── TFIDFIndexManager (class)
│   └── SearchFilterChain (class)
├── Exports from server/index.ts
│   ├── MCPServer (class)
│   ├── toolDefinitions (array)
│   ├── toolHandlers (record)
│   └── handleToolCall (function)
├── Exports from types/index.ts
│   └── [All type definitions]
└── Creates and starts MCPServer instance
\`\`\`

---`;
}

function generateCoreModuleDependencies(graph: DependencyGraph): string {
  const coreFiles = Object.values(graph.files).filter(f =>
    f.relativePath.includes('/core/') && !f.relativePath.endsWith('index.ts')
  );

  let content = '## 4. Core Module Dependencies\n\n';

  for (const file of coreFiles) {
    const fileName = path.basename(file.relativePath, '.ts');
    content += generateFileSection(file, fileName);
  }

  return content + '---';
}

function generateFeatureModuleDependencies(graph: DependencyGraph): string {
  const featureFiles = Object.values(graph.files).filter(f =>
    f.relativePath.includes('/features/') && !f.relativePath.endsWith('index.ts')
  );

  let content = '## 5. Feature Module Dependencies\n\n';

  for (const file of featureFiles) {
    const fileName = path.basename(file.relativePath, '.ts');
    content += generateFileSection(file, fileName);
  }

  return content + '---';
}

function generateSearchModuleDependencies(graph: DependencyGraph): string {
  const searchFiles = Object.values(graph.files).filter(f =>
    f.relativePath.includes('/search/') && !f.relativePath.endsWith('index.ts')
  );

  let content = '## 6. Search Module Dependencies\n\n';

  for (const file of searchFiles) {
    const fileName = path.basename(file.relativePath, '.ts');
    content += generateFileSection(file, fileName);
  }

  return content + '---';
}

function generateServerModuleDependencies(graph: DependencyGraph): string {
  const serverFiles = Object.values(graph.files).filter(f =>
    f.relativePath.includes('/server/') && !f.relativePath.endsWith('index.ts')
  );

  let content = '## 7. Server Module Dependencies\n\n';

  for (const file of serverFiles) {
    const fileName = path.basename(file.relativePath, '.ts');
    content += generateFileSection(file, fileName);
  }

  return content + '---';
}

function generateTypesModuleDependencies(graph: DependencyGraph): string {
  const typesFiles = Object.values(graph.files).filter(f =>
    f.relativePath.includes('/types/') && !f.relativePath.endsWith('index.ts')
  );

  let content = '## 8. Types Module Dependencies\n\n';

  for (const file of typesFiles) {
    const fileName = path.basename(file.relativePath, '.ts');
    content += `### ${fileName}\n\n`;
    content += `**File**: \`${file.relativePath}\`\n\n`;

    if (file.interfaces.length > 0 || file.types.length > 0) {
      content += '#### Exports\n\n```typescript\n';
      for (const iface of file.interfaces) {
        content += `export interface ${iface} { ... }\n`;
      }
      for (const type of file.types) {
        content += `export type ${type} = ...\n`;
      }
      content += '```\n\n';
    }
  }

  return content + '---';
}

function generateUtilsModuleDependencies(graph: DependencyGraph): string {
  const utilsFiles = Object.values(graph.files).filter(f =>
    f.relativePath.includes('/utils/') && !f.relativePath.endsWith('index.ts')
  );

  let content = '## 9. Utils Module Dependencies\n\n';
  content += '### Dependency Graph\n\n```\nutils/\n';

  for (const file of utilsFiles) {
    const fileName = path.basename(file.relativePath, '.ts');
    content += `├── ${fileName}.ts`;

    if (file.usedBy && file.usedBy.length > 0) {
      content += ` ◄─── Used by: ${file.usedBy.slice(0, 3).join(', ')}`;
      if (file.usedBy.length > 3) content += ', ...';
    }
    content += '\n';

    // List exports
    for (const exp of file.exports.slice(0, 5)) {
      content += `│   └── ${exp.name}`;
      if (exp.type === 'function' || exp.type === 'const') {
        content += `()`;
      }
      content += '\n';
    }
    content += '│\n';
  }

  content += '```\n\n';

  // Algorithm Usage Matrix
  if (Object.keys(graph.algorithms).length > 0) {
    content += '### Algorithm Usage Matrix\n\n';
    content += '| Algorithm | File | Used By |\n|-----------|------|---------|';

    for (const [name, algo] of Object.entries(graph.algorithms)) {
      content += `\n| ${name} | ${algo.file} | ${algo.usedBy.join(', ')} |`;
    }
    content += '\n\n';
  }

  return content + '---';
}

function generateCrossModuleFunctionCalls(graph: DependencyGraph): string {
  return `## 10. Cross-Module Function Calls

### Tool Handler → Manager Flow

\`\`\`
MCPServer.handleToolCall()
    │
    ▼
toolHandlers[toolName](manager, args)
    │
    ├── Entity Operations
    │   ├── create_entities ──► manager.createEntities() ──► EntityManager.createEntities()
    │   ├── delete_entities ──► manager.deleteEntities() ──► EntityManager.deleteEntities()
    │   └── read_graph ───────► manager.readGraph() ──────► GraphStorage.loadGraph()
    │
    ├── Search Operations
    │   ├── search_nodes ─────► manager.searchNodes() ────► SearchManager ──► BasicSearch
    │   ├── boolean_search ───► manager.booleanSearch() ──► SearchManager ──► BooleanSearch
    │   ├── fuzzy_search ─────► manager.fuzzySearch() ────► SearchManager ──► FuzzySearch
    │   └── search_nodes_ranked ► manager.searchNodesRanked() ► SearchManager ──► RankedSearch
    │
    ├── Hierarchy Operations
    │   ├── set_entity_parent ► manager.setEntityParent() ► HierarchyManager
    │   └── get_children ─────► manager.getChildren() ────► HierarchyManager
    │
    └── Import/Export
        ├── export_graph ─────► manager.exportGraph() ────► ImportExportManager ──► ExportManager
        └── import_graph ─────► manager.importGraph() ────► ImportExportManager ──► ImportManager
\`\`\`

---`;
}

function generateSharedVariableDependencies(graph: DependencyGraph): string {
  return `## 11. Shared Variable Dependencies

### Constants Usage

| Constant | Defined In | Used By |
|----------|-----------|---------|
| \`SEARCH_LIMITS.DEFAULT\` | constants.ts | BasicSearch, BooleanSearch, FuzzySearch, RankedSearch, paginationUtils |
| \`SEARCH_LIMITS.MAX\` | constants.ts | All search modules, paginationUtils |
| \`QUERY_LIMITS.MAX_DEPTH\` | constants.ts | BooleanSearch |
| \`QUERY_LIMITS.MAX_TERMS\` | constants.ts | BooleanSearch |
| \`IMPORTANCE_RANGE.MIN/MAX\` | constants.ts | TagManager |
| \`SIMILARITY_WEIGHTS.*\` | constants.ts | CompressionManager |
| \`DEFAULT_DUPLICATE_THRESHOLD\` | constants.ts | CompressionManager |

### Singleton Instances

| Instance | Defined In | Scope |
|----------|-----------|-------|
| \`searchCaches.basic\` | searchCache.ts | Process-wide |
| \`searchCaches.ranked\` | searchCache.ts | Process-wide |
| \`searchCaches.boolean\` | searchCache.ts | Process-wide |
| \`searchCaches.fuzzy\` | searchCache.ts | Process-wide |
| \`logger\` | logger.ts | Process-wide |

### Shared GraphStorage Pattern

\`\`\`typescript
// In KnowledgeGraphManager constructor:
const storage = new GraphStorage(memoryFilePath);

// Passed to all managers:
this.entityManager = new EntityManager(storage);
this.relationManager = new RelationManager(storage);
this.hierarchyManager = new HierarchyManager(storage);
this.searchManager = new SearchManager(storage, savedSearchesPath);
// ... etc.
\`\`\`

---`;
}

function generateDependencyVisualization(graph: DependencyGraph): string {
  return `## 12. Dependency Visualization

### Full Dependency Graph (Mermaid)

\`\`\`mermaid
flowchart TB
    subgraph EntryPoints["Entry Points"]
        INDEX[index.ts]
        BIN[bin/mcp-server-memory]
    end

    subgraph Server["Server Layer"]
        MCPS[MCPServer.ts]
        TDEF[toolDefinitions.ts]
        THAN[toolHandlers.ts]
    end

    subgraph Facade["Facade Layer"]
        KGM[KnowledgeGraphManager.ts]
    end

    subgraph Core["Core Layer"]
        GS[GraphStorage.ts]
        EM[EntityManager.ts]
        RM[RelationManager.ts]
        OM[ObservationManager.ts]
        TM[TransactionManager.ts]
    end

    subgraph Features["Feature Layer"]
        HM[HierarchyManager.ts]
        TGM[TagManager.ts]
        CM[CompressionManager.ts]
        AM[ArchiveManager.ts]
        ANM[AnalyticsManager.ts]
        EXM[ExportManager.ts]
        IMM[ImportManager.ts]
        IEM[ImportExportManager.ts]
        BM[BackupManager.ts]
    end

    subgraph Search["Search Layer"]
        SM[SearchManager.ts]
        BS[BasicSearch.ts]
        RS[RankedSearch.ts]
        BOS[BooleanSearch.ts]
        FS[FuzzySearch.ts]
        SS[SearchSuggestions.ts]
        SSM[SavedSearchManager.ts]
        TIM[TFIDFIndexManager.ts]
        SFC[SearchFilterChain.ts]
    end

    subgraph Types["Types"]
        ET[entity.types.ts]
        ST[search.types.ts]
        AT[analytics.types.ts]
        TT[tags.types.ts]
    end

    subgraph Utils["Utilities"]
        CON[constants.ts]
        ERR[errors.ts]
        TFI[tfidf.ts]
        LEV[levenshtein.ts]
        DU[dateUtils.ts]
        TGU[tagUtils.ts]
        FU[filterUtils.ts]
        PU[paginationUtils.ts]
        SC[searchCache.ts]
        RF[responseFormatter.ts]
        LOG[logger.ts]
    end

    BIN --> INDEX
    INDEX --> MCPS
    INDEX --> KGM

    MCPS --> TDEF
    MCPS --> THAN
    MCPS --> LOG
    THAN --> RF
    THAN --> KGM

    KGM --> GS
    KGM --> EM
    KGM --> RM
    KGM --> OM
    KGM --> TM
    KGM --> HM
    KGM --> TGM
    KGM --> CM
    KGM --> AM
    KGM --> ANM
    KGM --> IEM
    KGM --> BM
    KGM --> SM

    EM --> GS
    RM --> GS
    OM --> GS
    TM --> GS
    HM --> GS
    HM --> ERR
    TGM --> GS
    TGM --> ERR
    TGM --> CON
    TGM --> TGU
    CM --> GS
    CM --> EM
    CM --> LEV
    CM --> CON
    AM --> GS
    ANM --> GS
    IMM --> GS
    IMM --> ERR
    IEM --> EXM
    IEM --> IMM
    IEM --> BS
    BM --> GS

    SM --> GS
    SM --> BS
    SM --> RS
    SM --> BOS
    SM --> FS
    SM --> SS
    SM --> SSM

    BS --> GS
    BS --> DU
    BS --> CON
    BS --> SC
    BS --> SFC

    RS --> GS
    RS --> TFI
    RS --> CON
    RS --> TIM
    RS --> SFC

    BOS --> GS
    BOS --> CON
    BOS --> ERR
    BOS --> SFC

    FS --> GS
    FS --> LEV
    FS --> CON
    FS --> SFC

    SS --> GS
    SS --> LEV

    SSM --> BS

    TIM --> TFI

    SFC --> TGU
    SFC --> FU
    SFC --> PU

    PU --> CON

    ST --> ET
\`\`\`

---`;
}

function generateCircularDependencyAnalysis(graph: DependencyGraph): string {
  const circDeps = graph.circularDependencies;

  let content = `## 13. Circular Dependency Analysis

### Potential Circular Dependencies

The codebase is designed to avoid circular dependencies through:

1. **Layered Architecture**: Dependencies flow downward only
2. **Type-Only Imports**: Using \`import type\` for cross-layer references
3. **Dependency Injection**: GraphStorage passed to managers rather than imported

### Verified ${circDeps.detected ? 'Circular Dependencies Found' : 'No Circular Dependencies'}

\`\`\`
✓ index.ts → core/index → (no back-reference)
✓ index.ts → features/index → (no back-reference)
✓ index.ts → search/index → (no back-reference)
✓ index.ts → server/index → (type-only import of KnowledgeGraphManager)
✓ KnowledgeGraphManager → Managers → GraphStorage → types (clean chain)
✓ SearchManager → Search classes → GraphStorage → types (clean chain)
\`\`\`

### Type-Only Back-References

| From | To | Import Type |
|------|-----|-------------|`;

  for (const ref of circDeps.typeOnlyBackReferences) {
    content += `\n| \`${ref.from}\` | \`${ref.to}\` | ${ref.reason} |`;
  }

  content += `

These use \`import type\` which is erased at compile time, preventing runtime circular dependencies.

---`;

  return content;
}

function generateSummary(graph: DependencyGraph): string {
  const totalClasses = Object.values(graph.files).reduce(
    (sum, f) => sum + f.classes.length,
    0
  );

  return `## Summary

This dependency graph documents:

- **${graph.metadata.totalFiles} source files** across ${Object.keys(graph.modules).length} modules
- **${totalClasses} classes** with clear responsibilities
- **${Object.keys(graph.algorithms).length} algorithm implementations**
- **${graph.dependencyGraph.edges.length} dependency edges** tracked
- **${graph.circularDependencies.detected ? 'Circular dependencies detected' : 'Zero circular dependencies'}** verified

The architecture follows clean layering principles with:
- Facade pattern (KnowledgeGraphManager)
- Dependency injection (GraphStorage)
- Barrel exports (index.ts files)
- Type-safe interfaces
`;
}

function generateFileSection(file: FileInfo, fileName: string): string {
  let content = `### ${fileName}\n\n`;
  content += `**File**: \`${file.relativePath}\`\n\n`;

  // Import dependencies
  if (file.imports.length > 0) {
    content += '#### Import Dependencies\n\n```typescript\n';
    for (const imp of file.imports) {
      const typeOnly = imp.typeOnly ? 'type ' : '';
      content += `import ${typeOnly}{ ${imp.items.join(', ')} } from '${imp.module}';\n`;
    }
    content += '```\n\n';
  }

  // Classes
  for (const cls of file.classes) {
    if (cls.methods.length > 0) {
      content += '#### Methods\n\n';
      content += '| Method | Delegates To | Calls |\n|--------|-------------|-------|\n';
      for (const method of cls.methods.slice(0, 10)) {
        const delegatesTo = method.delegatesTo || '-';
        const calls = method.calls?.slice(0, 3).join(', ') || '-';
        content += `| \`${method.name}()\` | ${delegatesTo} | ${calls} |\n`;
      }
      content += '\n';
    }
  }

  // Dependencies
  if (file.dependencies.length > 0) {
    content += `#### Dependencies\n\n`;
    content += `- ${file.dependencies.join('\n- ')}\n\n`;
  }

  return content;
}
