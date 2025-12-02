# Create Dependency Graph Tool

Scans the Memory MCP Server codebase and generates comprehensive dependency documentation.

## Output Files

- **DEPENDENCY_GRAPH.md** - Human-readable documentation with:
  - Architecture overview with layer diagrams
  - Module dependency matrix
  - Entry point analysis
  - Per-module dependency breakdowns
  - Cross-module function call flows
  - Mermaid visualization diagram
  - Circular dependency analysis

- **DEPENDENCY_GRAPH.json** - Machine-readable data with:
  - Complete file inventory
  - Import/export tracking
  - Class and method information
  - Dependency edges
  - Algorithm and pattern detection

## Usage

### Quick Run (from project root)

```bash
# Using npx (no build required)
npx tsx tools/create-dependency-graph/src/index.ts

# Or with npm script
cd tools/create-dependency-graph
npm run dev
```

### Build and Run

```bash
cd tools/create-dependency-graph
npm install
npm run build
npm start
```

### From Project Root

```bash
# Add to package.json scripts:
# "generate-deps": "npx tsx tools/create-dependency-graph/src/index.ts"

npm run generate-deps
```

## How It Works

1. **Scanning** - Recursively finds all `.ts` files in `src/memory/`
2. **Parsing** - Uses TypeScript compiler API to extract:
   - Import/export declarations
   - Class definitions and methods
   - Function declarations
   - Interface and type definitions
   - Constants and enums
3. **Graph Building** - Constructs dependency graph with:
   - Module relationships
   - Dependency edges (imports, creates, uses, calls)
   - Layer classification
   - Circular dependency detection
4. **Generation** - Creates both Markdown and JSON output

## Configuration

The tool is configured in `src/index.ts`:

```typescript
const config: ScanConfig = {
  rootDir: process.cwd(),
  srcDir: path.join(process.cwd(), 'src', 'memory'),
  outputDir: path.join(process.cwd(), 'docs', 'architecture'),
  excludePatterns: [
    'node_modules',
    'dist',
    '__tests__',
    '*.test.ts',
    '*.spec.ts',
  ],
};
```

## Architecture

```
tools/create-dependency-graph/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── scanner.ts         # File discovery
│   ├── parser.ts          # TypeScript AST parsing
│   ├── graph-builder.ts   # Dependency graph construction
│   ├── md-generator.ts    # Markdown output
│   ├── json-generator.ts  # JSON output
│   └── types.ts           # Type definitions
├── package.json
├── tsconfig.json
└── README.md
```

## Features Detected

### Design Patterns
- **Facade** - KnowledgeGraphManager
- **Orchestrator** - SearchManager
- **Dependency Injection** - GraphStorage
- **Barrel Exports** - index.ts files

### Algorithms
- **TF-IDF** - Relevance ranking
- **Levenshtein** - Fuzzy matching
- **LRU Cache** - Search caching

### Circular Dependencies
- Detects runtime circular dependencies
- Identifies safe type-only back-references
- Reports findings in both outputs

## Example Output

### Markdown Summary
```
Summary:
- 55 source files across 7 modules
- 112 dependency edges tracked
- 3 algorithm implementations
- Zero circular dependencies verified
```

### JSON Structure
```json
{
  "metadata": { "version": "...", "totalFiles": 55 },
  "modules": { "core": {...}, "features": {...} },
  "files": { "path/to/file.ts": {...} },
  "dependencyGraph": { "layers": [...], "edges": [...] },
  "algorithms": { "tfidf": {...} },
  "patterns": { "facade": {...} },
  "circularDependencies": { "detected": false }
}
```
