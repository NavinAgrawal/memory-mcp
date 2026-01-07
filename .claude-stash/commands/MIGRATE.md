---
description: Migrate memory storage between JSONL and SQLite formats
allowed-tools: ["Bash"]
argument-hint: "--from <source> --to <target>"
---

# Migrate Storage Format

Run the `migrate-from-jsonl-to-sqlite` tool to convert between JSONL and SQLite storage formats.

## Instructions

1. Run the migration tool:

```bash
C:\mcp-servers\memory-mcp\tools\migrate-from-jsonl-to-sqlite\migrate-from-jsonl-to-sqlite.exe $ARGUMENTS
```

2. The tool automatically detects format based on file extension:
   - `.jsonl`, `.json` → JSONL format
   - `.db`, `.sqlite`, `.sqlite3` → SQLite format

3. Migration includes verification step to ensure data integrity.

## Options

- `--from, -f <path>` - Source file path
- `--to, -t <path>` - Target file path
- `--verbose, -v` - Show detailed progress

## Usage Examples

```bash
# JSONL to SQLite
/project:MIGRATE --from memory.jsonl --to memory.db

# SQLite to JSONL
/project:MIGRATE --from memory.db --to memory.jsonl

# With verbose output
/project:MIGRATE -f memory.jsonl -t memory.db -v

# Positional arguments also work
/project:MIGRATE memory.jsonl memory.db
```

## Notes

- Target file will be created if it doesn't exist
- Existing target file will be overwritten
- Saved searches and tag aliases are stored separately and NOT migrated
