#!/usr/bin/env node

/**
 * Create Dependency Graph CLI
 *
 * Scans the Memory MCP Server codebase and generates:
 * - DEPENDENCY_GRAPH.md - Human-readable documentation
 * - DEPENDENCY_GRAPH.json - Machine-readable data
 *
 * Usage:
 *   npx tsx tools/create-dependency-graph/src/index.ts
 *   npm run build && node tools/create-dependency-graph/dist/index.js
 */

import * as fs from 'fs';
import * as path from 'path';
import { scanDirectory, readFileContent } from './scanner.js';
import { parseTypeScriptFile } from './parser.js';
import { buildDependencyGraph } from './graph-builder.js';
import { generateMarkdown } from './md-generator.js';
import { generateJSON } from './json-generator.js';
import type { FileInfo, ScanConfig } from './types.js';

// Configuration
const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, 'src', 'memory');
const OUTPUT_DIR = path.join(ROOT_DIR, 'docs', 'architecture');

const config: ScanConfig = {
  rootDir: ROOT_DIR,
  srcDir: SRC_DIR,
  outputDir: OUTPUT_DIR,
  includePatterns: ['**/*.ts'],
  excludePatterns: [
    'node_modules',
    'dist',
    '__tests__',
    '*.test.ts',
    '*.spec.ts',
    '.d.ts',
  ],
};

/**
 * Get the version from package.json
 */
function getVersion(): string {
  try {
    const packageJsonPath = path.join(ROOT_DIR, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('📊 Creating Dependency Graph...\n');

  // Check if source directory exists
  if (!fs.existsSync(config.srcDir)) {
    console.error(`❌ Source directory not found: ${config.srcDir}`);
    console.error('   Make sure you are running this from the project root.');
    process.exit(1);
  }

  // Scan for TypeScript files
  console.log(`📁 Scanning ${config.srcDir}...`);
  const { files: filePaths, modules } = scanDirectory(config);
  console.log(`   Found ${filePaths.length} TypeScript files in ${modules.size} modules\n`);

  // Parse each file
  console.log('🔍 Parsing TypeScript files...');
  const parsedFiles = new Map<string, FileInfo>();

  for (const filePath of filePaths) {
    try {
      const content = readFileContent(filePath);
      const fileInfo = parseTypeScriptFile(filePath, content, config.rootDir);
      parsedFiles.set(fileInfo.relativePath, fileInfo);
      process.stdout.write('.');
    } catch (error) {
      console.error(`\n   Warning: Could not parse ${filePath}:`, error);
    }
  }
  console.log(`\n   Parsed ${parsedFiles.size} files\n`);

  // Build dependency graph
  console.log('🔗 Building dependency graph...');
  const version = getVersion();
  const graph = buildDependencyGraph(parsedFiles, modules, version);
  console.log(`   Created graph with ${graph.dependencyGraph.edges.length} edges\n`);

  // Ensure output directory exists
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${config.outputDir}\n`);
  }

  // Generate Markdown
  console.log('📝 Generating DEPENDENCY_GRAPH.md...');
  const markdown = generateMarkdown(graph);
  const mdPath = path.join(config.outputDir, 'DEPENDENCY_GRAPH.md');
  fs.writeFileSync(mdPath, markdown, 'utf-8');
  console.log(`   Written to ${mdPath}\n`);

  // Generate JSON
  console.log('📄 Generating DEPENDENCY_GRAPH.json...');
  const json = generateJSON(graph);
  const jsonPath = path.join(config.outputDir, 'DEPENDENCY_GRAPH.json');
  fs.writeFileSync(jsonPath, json, 'utf-8');
  console.log(`   Written to ${jsonPath}\n`);

  // Summary
  console.log('✅ Dependency graph created successfully!\n');
  console.log('Summary:');
  console.log(`  - Version: ${graph.metadata.version}`);
  console.log(`  - Total files: ${graph.metadata.totalFiles}`);
  console.log(`  - Modules: ${Object.keys(graph.modules).length}`);
  console.log(`  - Dependency edges: ${graph.dependencyGraph.edges.length}`);
  console.log(`  - Circular dependencies: ${graph.circularDependencies.detected ? 'Yes ⚠️' : 'None ✓'}`);
  console.log(`  - Algorithms tracked: ${Object.keys(graph.algorithms).length}`);
  console.log(`  - Design patterns: ${Object.keys(graph.patterns).length}`);
  console.log(`\nOutput files:`);
  console.log(`  - ${mdPath}`);
  console.log(`  - ${jsonPath}`);
}

// Run if executed directly
main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
