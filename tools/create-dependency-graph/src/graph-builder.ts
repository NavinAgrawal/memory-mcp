/**
 * Dependency Graph Builder
 *
 * Constructs the dependency graph from parsed file information.
 */

import * as path from 'path';
import type {
  FileInfo,
  ModuleInfo,
  DependencyGraph,
  DependencyEdge,
  LayerInfo,
  AlgorithmInfo,
  PatternInfo,
  ExternalDependency,
} from './types.js';

/**
 * Build the complete dependency graph from parsed files
 */
export function buildDependencyGraph(
  files: Map<string, FileInfo>,
  modules: Map<string, ModuleInfo>,
  version: string
): DependencyGraph {
  // Build dependency edges
  const edges = buildDependencyEdges(files);

  // Calculate which files use which
  calculateUsedBy(files, edges);

  // Build layer information
  const layers = buildLayers(files);

  // Extract algorithm information
  const algorithms = extractAlgorithms(files);

  // Extract design patterns
  const patterns = extractPatterns(files);

  // Analyze circular dependencies
  const circularDependencies = analyzeCircularDependencies(files, edges);

  // Extract external dependencies
  const externalDependencies = extractExternalDependencies(files);

  // Convert modules Map to object
  const modulesObj: Record<string, ModuleInfo> = {};
  for (const [name, info] of modules) {
    modulesObj[name] = info;
  }

  // Convert files Map to object
  const filesObj: Record<string, FileInfo> = {};
  for (const [filePath, info] of files) {
    filesObj[filePath] = info;
  }

  return {
    metadata: {
      version,
      generated: new Date().toISOString().split('T')[0],
      totalFiles: files.size,
      description: 'Comprehensive dependency graph for Memory MCP Server',
    },
    modules: modulesObj,
    files: filesObj,
    dependencyGraph: {
      layers,
      edges,
    },
    algorithms,
    patterns,
    circularDependencies,
    externalDependencies,
  };
}

/**
 * Build dependency edges from imports
 */
function buildDependencyEdges(files: Map<string, FileInfo>): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  const filePathMap = new Map<string, string>();

  // Build a map of file names to full paths
  for (const [filePath] of files) {
    const fileName = path.basename(filePath, '.ts');
    filePathMap.set(fileName, filePath);
    filePathMap.set(path.basename(filePath), filePath);
  }

  for (const [filePath, fileInfo] of files) {
    const fromFile = path.basename(filePath);

    for (const imp of fileInfo.imports) {
      // Skip node built-ins
      if (imp.module.startsWith('fs') || imp.module.startsWith('path') || imp.module.startsWith('node:')) {
        continue;
      }

      // Skip external packages
      if (!imp.module.startsWith('.') && !imp.module.startsWith('/')) {
        continue;
      }

      // Resolve the import path
      const importPath = resolveImportPath(filePath, imp.module);
      const toFile = path.basename(importPath);

      // Determine edge type
      let edgeType: DependencyEdge['type'] = imp.typeOnly ? 'imports' : 'imports';

      // Check if this file creates instances of the imported class
      for (const cls of fileInfo.classes) {
        if (cls.constructor?.dependencies.some(dep => imp.items.includes(dep))) {
          edgeType = 'creates';
          break;
        }
      }

      edges.push({
        from: fromFile,
        to: toFile,
        type: edgeType,
      });
    }

    // Add edges for class relationships
    for (const cls of fileInfo.classes) {
      // Extends relationships
      if (cls.extends) {
        const extendedFile = findFileByClassName(files, cls.extends);
        if (extendedFile) {
          edges.push({
            from: fromFile,
            to: path.basename(extendedFile),
            type: 'extends',
          });
        }
      }

      // Implements relationships
      if (cls.implements) {
        for (const impl of cls.implements) {
          const implFile = findFileByClassName(files, impl);
          if (implFile) {
            edges.push({
              from: fromFile,
              to: path.basename(implFile),
              type: 'implements',
            });
          }
        }
      }

      // Method delegation relationships
      for (const method of cls.methods) {
        if (method.delegatesTo) {
          const delegateFile = findFileByClassName(files, method.delegatesTo);
          if (delegateFile) {
            // Check if edge already exists
            const existingEdge = edges.find(
              e => e.from === fromFile && e.to === path.basename(delegateFile)
            );
            if (!existingEdge) {
              edges.push({
                from: fromFile,
                to: path.basename(delegateFile),
                type: 'uses',
              });
            }
          }
        }
      }
    }
  }

  // Remove duplicate edges
  const uniqueEdges: DependencyEdge[] = [];
  const seen = new Set<string>();

  for (const edge of edges) {
    const key = `${edge.from}-${edge.to}-${edge.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEdges.push(edge);
    }
  }

  return uniqueEdges;
}

/**
 * Find which file contains a given class name
 */
function findFileByClassName(files: Map<string, FileInfo>, className: string): string | undefined {
  for (const [filePath, fileInfo] of files) {
    for (const cls of fileInfo.classes) {
      if (cls.name === className) {
        return filePath;
      }
    }
    // Also check exported types/interfaces
    if (fileInfo.interfaces.includes(className)) {
      return filePath;
    }
  }
  return undefined;
}

/**
 * Resolve an import path to an absolute file path
 */
function resolveImportPath(fromFile: string, importPath: string): string {
  const dir = path.dirname(fromFile);
  let resolved = path.resolve(dir, importPath);

  // Remove .js extension if present (TypeScript imports)
  if (resolved.endsWith('.js')) {
    resolved = resolved.slice(0, -3) + '.ts';
  }

  // Add .ts extension if not present
  if (!resolved.endsWith('.ts')) {
    resolved += '.ts';
  }

  return resolved;
}

/**
 * Calculate which files use which other files (reverse dependencies)
 */
function calculateUsedBy(files: Map<string, FileInfo>, edges: DependencyEdge[]): void {
  const usedByMap = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!usedByMap.has(edge.to)) {
      usedByMap.set(edge.to, new Set());
    }
    usedByMap.get(edge.to)!.add(edge.from);
  }

  for (const [filePath, fileInfo] of files) {
    const fileName = path.basename(filePath);
    const usedBy = usedByMap.get(fileName);
    if (usedBy) {
      fileInfo.usedBy = Array.from(usedBy);
    }
  }
}

/**
 * Build layer information based on file paths and dependencies
 */
function buildLayers(files: Map<string, FileInfo>): LayerInfo[] {
  const layers: LayerInfo[] = [
    { name: 'Entry Points', level: 0, files: [] },
    { name: 'Server Layer', level: 1, files: [] },
    { name: 'Facade Layer', level: 2, files: [] },
    { name: 'Manager Layer', level: 3, files: [] },
    { name: 'Search Engine Layer', level: 4, files: [] },
    { name: 'Storage Layer', level: 5, files: [] },
    { name: 'Foundation Layer', level: 6, files: [] },
  ];

  for (const [filePath] of files) {
    const relativePath = filePath;
    const fileName = path.basename(filePath, '.ts');

    if (fileName === 'index' && filePath.includes('src/memory/index.ts')) {
      layers[0].files.push(relativePath);
    } else if (filePath.includes('/server/')) {
      layers[1].files.push(relativePath);
    } else if (fileName === 'KnowledgeGraphManager') {
      layers[2].files.push(relativePath);
    } else if (
      filePath.includes('/core/') &&
      fileName !== 'KnowledgeGraphManager' &&
      fileName !== 'GraphStorage' &&
      fileName !== 'index'
    ) {
      layers[3].files.push(relativePath);
    } else if (filePath.includes('/features/') && fileName !== 'index') {
      layers[3].files.push(relativePath);
    } else if (fileName === 'SearchManager') {
      layers[3].files.push(relativePath);
    } else if (filePath.includes('/search/') && fileName !== 'SearchManager' && fileName !== 'index') {
      layers[4].files.push(relativePath);
    } else if (fileName === 'GraphStorage') {
      layers[5].files.push(relativePath);
    } else if (filePath.includes('/types/') || filePath.includes('/utils/')) {
      layers[6].files.push(relativePath);
    }
  }

  return layers;
}

/**
 * Extract algorithm information from parsed files
 */
function extractAlgorithms(files: Map<string, FileInfo>): Record<string, AlgorithmInfo> {
  const algorithms: Record<string, AlgorithmInfo> = {};

  for (const [filePath, fileInfo] of files) {
    const fileName = path.basename(filePath, '.ts');

    if (fileName === 'tfidf') {
      algorithms['tfidf'] = {
        file: fileInfo.relativePath,
        functions: fileInfo.functions.map(f => f.name),
        usedBy: fileInfo.usedBy || [],
        purpose: 'Term frequency-inverse document frequency for relevance ranking',
      };
    }

    if (fileName === 'levenshtein') {
      algorithms['levenshtein'] = {
        file: fileInfo.relativePath,
        functions: fileInfo.functions.map(f => f.name),
        usedBy: fileInfo.usedBy || [],
        purpose: 'String edit distance for fuzzy matching and similarity detection',
        complexity: 'O(m*n)',
      };
    }

    if (fileName === 'searchCache') {
      algorithms['lruCache'] = {
        file: fileInfo.relativePath,
        functions: ['SearchCache'],
        usedBy: fileInfo.usedBy || [],
        purpose: 'LRU cache with TTL for search result caching',
      };
    }
  }

  return algorithms;
}

/**
 * Extract design patterns from the codebase
 */
function extractPatterns(files: Map<string, FileInfo>): Record<string, PatternInfo> {
  const patterns: Record<string, PatternInfo> = {};

  for (const [filePath, fileInfo] of files) {
    const fileName = path.basename(filePath, '.ts');

    // Facade pattern - KnowledgeGraphManager
    if (fileName === 'KnowledgeGraphManager') {
      patterns['facade'] = {
        name: 'Facade',
        class: 'KnowledgeGraphManager',
        file: fileInfo.relativePath,
        description: 'Provides unified API to all subsystem managers',
      };
    }

    // Orchestrator pattern - SearchManager
    if (fileName === 'SearchManager') {
      patterns['orchestrator'] = {
        name: 'Orchestrator',
        class: 'SearchManager',
        file: fileInfo.relativePath,
        description: 'Orchestrates all search engine implementations',
      };
    }

    // Dependency Injection - GraphStorage
    if (fileName === 'GraphStorage') {
      patterns['dependencyInjection'] = {
        name: 'Dependency Injection',
        instance: 'GraphStorage',
        description: 'Single GraphStorage instance injected into all managers',
      };
    }
  }

  // Barrel exports pattern
  const barrelFiles: string[] = [];
  for (const [filePath] of files) {
    if (path.basename(filePath) === 'index.ts') {
      barrelFiles.push(filePath);
    }
  }
  if (barrelFiles.length > 0) {
    patterns['barrelExports'] = {
      name: 'Barrel Exports',
      files: barrelFiles,
      description: 'Each module uses barrel exports for clean imports',
    };
  }

  return patterns;
}

/**
 * Analyze for circular dependencies
 */
function analyzeCircularDependencies(
  files: Map<string, FileInfo>,
  edges: DependencyEdge[]
): {
  detected: boolean;
  typeOnlyBackReferences: Array<{ from: string; to: string; reason: string }>;
} {
  const typeOnlyBackReferences: Array<{ from: string; to: string; reason: string }> = [];

  // Check for type-only back references (these are safe)
  for (const [filePath, fileInfo] of files) {
    for (const imp of fileInfo.imports) {
      if (imp.typeOnly && imp.module.includes('index')) {
        typeOnlyBackReferences.push({
          from: fileInfo.relativePath,
          to: imp.module,
          reason: `Type-only import of ${imp.items.join(', ')}`,
        });
      }
    }
  }

  // Simple cycle detection using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  let hasCycle = false;

  function dfs(node: string): void {
    visited.add(node);
    recursionStack.add(node);

    const outgoingEdges = edges.filter(e => e.from === node);
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.to)) {
        dfs(edge.to);
      } else if (recursionStack.has(edge.to)) {
        // Found a cycle, but check if it's type-only
        const isTypeOnly = typeOnlyBackReferences.some(
          ref => ref.from.includes(node) || ref.to.includes(edge.to)
        );
        if (!isTypeOnly) {
          hasCycle = true;
        }
      }
    }

    recursionStack.delete(node);
  }

  for (const [filePath] of files) {
    const fileName = path.basename(filePath);
    if (!visited.has(fileName)) {
      dfs(fileName);
    }
  }

  return {
    detected: hasCycle,
    typeOnlyBackReferences,
  };
}

/**
 * Extract external (npm) dependencies
 */
function extractExternalDependencies(
  files: Map<string, FileInfo>
): Record<string, ExternalDependency> {
  const external: Record<string, ExternalDependency> = {};

  for (const [filePath, fileInfo] of files) {
    const fileName = path.basename(filePath);

    for (const imp of fileInfo.imports) {
      // External packages don't start with . or /
      if (!imp.module.startsWith('.') && !imp.module.startsWith('/')) {
        // Get package name (handle scoped packages)
        let pkgName = imp.module;
        if (pkgName.startsWith('@')) {
          // Scoped package: @scope/package/subpath -> @scope/package
          const parts = pkgName.split('/');
          pkgName = parts.slice(0, 2).join('/');
        } else {
          // Regular package: package/subpath -> package
          pkgName = pkgName.split('/')[0];
        }

        // Skip Node.js built-ins
        if (['fs', 'path', 'os', 'crypto', 'util', 'events', 'stream', 'buffer', 'url'].includes(pkgName)) {
          const builtinKey = pkgName === 'fs' ? 'fs/promises' : pkgName;
          if (!external[builtinKey]) {
            external[builtinKey] = { usedBy: [], imports: [] };
          }
          if (!external[builtinKey].usedBy.includes(fileName)) {
            external[builtinKey].usedBy.push(fileName);
          }
          for (const item of imp.items) {
            if (!external[builtinKey].imports.includes(item)) {
              external[builtinKey].imports.push(item);
            }
          }
          continue;
        }

        if (!external[pkgName]) {
          external[pkgName] = { usedBy: [], imports: [] };
        }

        if (!external[pkgName].usedBy.includes(fileName)) {
          external[pkgName].usedBy.push(fileName);
        }

        for (const item of imp.items) {
          if (!external[pkgName].imports.includes(item)) {
            external[pkgName].imports.push(item);
          }
        }
      }
    }
  }

  return external;
}
