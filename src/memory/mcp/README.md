# MCP Module

Model Context Protocol server setup, tool definitions, and request handlers.

## Contents

### Server
- `server.ts` - MCP server initialization and configuration

### Tools
- `tools/entity.tools.ts` - Entity CRUD tool schemas
- `tools/search.tools.ts` - Search tool schemas
- `tools/tag.tools.ts` - Tag operation tool schemas
- `tools/hierarchy.tools.ts` - Hierarchy tool schemas
- `tools/analytics.tools.ts` - Analytics tool schemas
- `tools/import-export.tools.ts` - Import/export tool schemas
- `tools/index.ts` - Tool registry

### Handlers
- `handlers/entity.handlers.ts` - Entity tool request handlers
- `handlers/search.handlers.ts` - Search tool request handlers
- `handlers/tag.handlers.ts` - Tag tool request handlers
- `handlers/hierarchy.handlers.ts` - Hierarchy tool request handlers
- `handlers/analytics.handlers.ts` - Analytics tool request handlers
- `handlers/import-export.handlers.ts` - Import/export tool request handlers
- `handlers/index.ts` - Handler registry and routing

## Architecture

Separation of concerns:
1. **Tool Definitions**: JSON schemas for MCP tools
2. **Handlers**: Request handling logic
3. **Registries**: Aggregate tools/handlers
4. **Server**: Glue everything together
