# Core Module

Core business logic and data persistence layer.

## Contents

- `GraphStorage.ts` - File I/O operations for JSONL format
- `EntityManager.ts` - Entity CRUD operations
- `RelationManager.ts` - Relation CRUD operations
- `ObservationManager.ts` - Observation CRUD operations
- `KnowledgeGraphManager.ts` - Main facade orchestrating all managers

## Architecture

Uses composition pattern with dependency injection:
- GraphStorage handles all file I/O
- Specialized managers handle domain-specific operations
- KnowledgeGraphManager provides unified public API
