/**
 * JSON Generator
 *
 * Generates the DEPENDENCY_GRAPH.json file from the dependency graph.
 */

import type { DependencyGraph } from './types.js';

/**
 * Generate the JSON representation of the dependency graph
 */
export function generateJSON(graph: DependencyGraph): string {
  // Create a clean copy without circular references
  const cleanGraph = cleanForJSON(graph);

  return JSON.stringify(cleanGraph, null, 2);
}

/**
 * Clean the graph object for JSON serialization
 * Removes any circular references and non-serializable data
 */
function cleanForJSON(graph: DependencyGraph): DependencyGraph {
  // Deep clone the graph to avoid modifying the original
  const clone = JSON.parse(JSON.stringify(graph));

  // Clean up the files object to remove any functions or complex objects
  for (const filePath of Object.keys(clone.files)) {
    const file = clone.files[filePath];

    // Clean classes
    for (const cls of file.classes || []) {
      // Remove method bodies and complex data
      for (const method of cls.methods || []) {
        // Keep only serializable properties
        delete (method as Record<string, unknown>).body;
        delete (method as Record<string, unknown>).node;
      }
    }

    // Clean functions
    for (const func of file.functions || []) {
      delete (func as Record<string, unknown>).body;
      delete (func as Record<string, unknown>).node;
    }
  }

  return clone;
}

/**
 * Generate a minimal JSON representation for quick lookups
 */
export function generateMinimalJSON(graph: DependencyGraph): string {
  const minimal = {
    metadata: graph.metadata,
    modules: Object.keys(graph.modules).map(name => ({
      name,
      files: graph.modules[name].files.length,
      purpose: graph.modules[name].purpose,
    })),
    fileCount: Object.keys(graph.files).length,
    edges: graph.dependencyGraph.edges.length,
    hasCircularDependencies: graph.circularDependencies.detected,
  };

  return JSON.stringify(minimal, null, 2);
}
