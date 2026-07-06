# memory skill

A playbook (judgment layer, not new tools) over the `memory-mcp` knowledge-graph server — the sqlite-backed (or JSONL) cross-session memory store. It consolidates three workflows that previously lived as separate repo commands (`MEMORY`, `EXPLORE`, `MIGRATE`) into one skill, calling the server's existing tools rather than adding any of its own.

- **Load id**: `memory-mcp:memory`
- **Slash trigger**: `/memory`

## What it covers

- **Graph CRUD / search / maintenance** — search, read, create/update/delete entities and relations, tag, score importance, find and merge duplicates, compress the graph.
- **Project indexing** — gather a project's current state (package metadata, git history, file counts) and record it as entities/observations/relations in the graph, optionally syncing CLAUDE.md.
- **Storage migration** — convert the memory store between JSONL and SQLite via the bundled `migrate-from-jsonl-to-sqlite` tool.

It does **not** cover this repo's general dev-utility commands (`CHUNK`, `CTON`, `COMMIT`, `DEPS`, `GRAPH`, `SEARCH`) — those are unrelated file-chunking, context-compression, dependency-graph, commit, and file-search helpers that remain separate commands, not knowledge-graph operations.

## Where things live

- `SKILL.md` (this directory) — the full playbook: intro, when-to-use guidance, the tool-mapping table for graph CRUD/search/maintenance, the project-indexing recipe, the storage-migration recipe, and known gotchas (including the `read_graph` size warning and the large ~225-tool surface).
- The underlying tools are called as `mcp__plugin_memory-mcp_memory-mcp__<tool>` — this skill doesn't introduce new ones, it just tells you which existing tool fits which intent.

Read `SKILL.md` for anything beyond this overview; this file is intentionally just a map to it.
