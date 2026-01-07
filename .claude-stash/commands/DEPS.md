---
description: Generate and analyze project dependency graph
allowed-tools: ["Bash", "Read", "Glob"]
argument-hint: "[project-path] [--summary]"
---

# Dependency Graph Analysis

Generate a dependency graph for a TypeScript project and provide analysis.

## Instructions

1. Run the dependency graph tool:

```bash
C:\mcp-servers\memory-mcp\tools\create-dependency-graph\create-dependency-graph.exe $ARGUMENTS
```

2. After generation, locate and read the output files:
   - `dependency-graph.json` - Full graph data
   - `dependency-summary.md` - Human-readable summary (if generated)

3. Provide analysis including:
   - Total files and modules
   - Circular dependencies (if any)
   - Most connected files (hot paths)
   - Module structure overview

## Usage Examples

```bash
# Generate graph for current directory
/project:DEPS

# Generate graph for specific project
/project:DEPS C:\mcp-servers\deepthinking-mcp

# Generate and focus on summary
/project:DEPS . --summary
```

## Output Files

The tool generates several files in the project's docs/architecture/ directory:

| File | Purpose |
|------|---------|
| `dependency-graph.json` | Full dependency data |
| `dependency-graph.yaml` | YAML format (if enabled) |
| `dependency-summary.compact.json` | CTON-compressed for LLM context |
| `unused-analysis.md` | Potentially unused files/exports |

## Analysis Focus Areas

1. **Circular Dependencies** - Runtime vs type-only
2. **Hot Paths** - Files with most imports/exports
3. **Module Boundaries** - How code is organized
4. **Unused Code** - Files/exports that may be dead code
