# Memory MCP Development Workflow

## Repository Setup
- **Location**: `c:/mcp-servers/memory-mcp/`
- **Remote**: https://github.com/danielsimonjr/servers.git
- **Branch**: main
- **MCP Server**: `c:/mcp-servers/memory-mcp/src/memory/`

## Making Changes

### 1. Edit the code
```bash
cd c:/mcp-servers/memory-mcp/src/memory
# Edit index.ts or other files
```

### 2. Build
```bash
cd c:/mcp-servers/memory-mcp/src/memory
npm run build
```

### 3. Test locally
The MCP server will automatically use the updated build.

### 4. Commit changes
```bash
cd c:/mcp-servers/memory-mcp
git add .
git commit -m "Description of changes"
```

### 5. Push to GitHub
```bash
cd c:/mcp-servers/memory-mcp
git push origin main
```

## Current Configuration
- MCP Config: `node c:/mcp-servers/memory-mcp/src/memory/dist/index.js`
- 15 tools total (11 original + 4 Phase 1-4 enhancements)

## Quick Commands
```bash
# Check status
cd c:/mcp-servers/memory-mcp && git status

# Pull latest
cd c:/mcp-servers/memory-mcp && git pull

# Rebuild
cd c:/mcp-servers/memory-mcp/src/memory && npm run build

# View logs
cd c:/mcp-servers/memory-mcp && git log --oneline -10
```
