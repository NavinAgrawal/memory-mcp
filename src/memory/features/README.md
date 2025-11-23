# Features Module

Advanced feature implementations for the Memory MCP Server.

## Contents

- `TagManager.ts` - Tag operations and alias management
- `ImportanceManager.ts` - Importance level operations
- `HierarchyManager.ts` - Parent-child entity relationships
- `AnalyticsManager.ts` - Statistics and graph validation
- `CompressionManager.ts` - Duplicate detection and merging
- `ArchiveManager.ts` - Criteria-based archiving
- `import-export/` - Multi-format import/export handlers

## Feature Categories

### Tags & Metadata
- Tag CRUD operations
- Tag aliases for synonyms
- Bulk tag operations
- Importance levels (0-10 scale)

### Hierarchy
- Parent-child relationships
- Ancestry traversal
- Subtree extraction
- Cycle detection

### Optimization
- Duplicate detection (similarity scoring)
- Entity merging
- Graph compression
- Archiving by age/importance/tags

### Analytics
- Graph statistics
- Validation reports
- Orphaned relation detection

### Import/Export
- JSON, CSV, GraphML, GEXF, DOT, Markdown, Mermaid
- Multiple merge strategies
- Dry-run mode for safety
