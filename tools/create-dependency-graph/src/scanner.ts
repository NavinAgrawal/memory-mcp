/**
 * File Scanner
 *
 * Scans the codebase to find all TypeScript files and organize them by module.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ScanConfig, ModuleInfo } from './types.js';

export interface ScanResult {
  files: string[];
  modules: Map<string, ModuleInfo>;
}

/**
 * Recursively find all TypeScript files in a directory
 */
function findTypeScriptFiles(dir: string, excludePatterns: string[]): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(process.cwd(), fullPath);

    // Check if excluded
    const shouldExclude = excludePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(relativePath);
      }
      return relativePath.includes(pattern);
    });

    if (shouldExclude) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...findTypeScriptFiles(fullPath, excludePatterns));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Determine the module a file belongs to based on its path
 */
function getModuleName(filePath: string, srcDir: string): string {
  const relativePath = path.relative(srcDir, filePath);
  const parts = relativePath.split(path.sep);

  if (parts.length >= 2) {
    return parts[0]; // e.g., 'core', 'features', 'search', etc.
  }

  return 'root';
}

/**
 * Get the purpose description for a module
 */
function getModulePurpose(moduleName: string): string {
  const purposes: Record<string, string> = {
    core: 'Core graph operations (entities, relations, observations, storage)',
    features: 'Advanced features (hierarchy, tags, compression, import/export)',
    search: 'Search algorithms (basic, ranked, boolean, fuzzy, saved)',
    server: 'MCP protocol layer (tool definitions, handlers)',
    types: 'TypeScript type definitions',
    utils: 'Utility functions (algorithms, helpers, constants)',
    root: 'Entry points and exports',
  };

  return purposes[moduleName] || `${moduleName} module`;
}

/**
 * Scan the source directory for TypeScript files
 */
export function scanDirectory(config: ScanConfig): ScanResult {
  const files = findTypeScriptFiles(config.srcDir, config.excludePatterns);
  const modules = new Map<string, ModuleInfo>();

  for (const file of files) {
    const moduleName = getModuleName(file, config.srcDir);
    const relativePath = path.relative(config.rootDir, file);

    if (!modules.has(moduleName)) {
      modules.set(moduleName, {
        name: moduleName,
        path: path.join(path.relative(config.rootDir, config.srcDir), moduleName),
        files: [],
        purpose: getModulePurpose(moduleName),
      });
    }

    const moduleInfo = modules.get(moduleName)!;
    moduleInfo.files.push(relativePath);
  }

  return { files, modules };
}

/**
 * Read file content
 */
export function readFileContent(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Get file stats
 */
export function getFileStats(filePath: string): fs.Stats {
  return fs.statSync(filePath);
}
