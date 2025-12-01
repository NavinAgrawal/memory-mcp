/**
 * Type definitions for the dependency graph generator
 */

export interface ImportInfo {
  module: string;
  items: string[];
  typeOnly?: boolean;
}

export interface ExportInfo {
  name: string;
  type: 'class' | 'function' | 'interface' | 'type' | 'const' | 'enum' | 'reexport';
  from?: string;
}

export interface MethodInfo {
  name: string;
  delegatesTo?: string;
  calls?: string[];
  modifiesGraph?: boolean;
  params?: string[];
  returns?: string;
}

export interface FileInfo {
  path: string;
  relativePath: string;
  type: 'entry' | 'class' | 'module' | 'types' | 'utility' | 'constants' | 'errors' | 'algorithm' | 'cache';
  imports: ImportInfo[];
  exports: ExportInfo[];
  classes: ClassInfo[];
  functions: FunctionInfo[];
  interfaces: string[];
  types: string[];
  constants: string[];
  dependencies: string[];
  usedBy: string[];
  algorithms?: string[];
  pattern?: string;
}

export interface ClassInfo {
  name: string;
  methods: MethodInfo[];
  properties: string[];
  constructor?: {
    params: string[];
    dependencies: string[];
  };
  extends?: string;
  implements?: string[];
}

export interface FunctionInfo {
  name: string;
  params: string[];
  returns?: string;
  exported: boolean;
  calls: string[];
}

export interface ModuleInfo {
  name: string;
  path: string;
  files: string[];
  purpose: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'imports' | 'creates' | 'uses' | 'calls' | 'extends' | 'implements';
}

export interface LayerInfo {
  name: string;
  level: number;
  files: string[];
}

export interface AlgorithmInfo {
  file: string;
  functions: string[];
  usedBy: string[];
  purpose: string;
  complexity?: string;
}

export interface PatternInfo {
  name: string;
  class?: string;
  instance?: string;
  file?: string;
  files?: string[];
  description: string;
}

export interface CircularDependencyInfo {
  detected: boolean;
  typeOnlyBackReferences: Array<{
    from: string;
    to: string;
    reason: string;
  }>;
}

export interface ExternalDependency {
  usedBy: string[];
  imports: string[];
}

export interface DependencyGraph {
  metadata: {
    version: string;
    generated: string;
    totalFiles: number;
    description: string;
  };
  modules: Record<string, ModuleInfo>;
  files: Record<string, FileInfo>;
  dependencyGraph: {
    layers: LayerInfo[];
    edges: DependencyEdge[];
  };
  algorithms: Record<string, AlgorithmInfo>;
  patterns: Record<string, PatternInfo>;
  circularDependencies: CircularDependencyInfo;
  externalDependencies: Record<string, ExternalDependency>;
}

export interface ToolCategories {
  [category: string]: string[];
}

export interface ScanConfig {
  rootDir: string;
  srcDir: string;
  outputDir: string;
  includePatterns: string[];
  excludePatterns: string[];
}
