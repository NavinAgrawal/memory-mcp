---
description: Generate a dependency graph for a TypeScript project
allowed-tools: ["Bash"]
argument-hint: "[project-path]"
---

# Create Dependency Graph

Run the `create-dependency-graph` tool to generate a dependency graph for a TypeScript project.

## Instructions

1. Run the dependency graph tool on the specified project path (or current directory if not specified):

```bash
C:\mcp-servers\memory-mcp\tools\create-dependency-graph\create-dependency-graph.exe $ARGUMENTS
```

2. If no arguments provided, run on the current working directory.

3. Report the output files generated (typically creates dependency-graph.json and related documentation).

## Usage Examples

- `/project:GRAPH` - Generate graph for current directory
- `/project:GRAPH C:\my-project` - Generate graph for specified path
- `/project:GRAPH ./src` - Generate graph for relative path
