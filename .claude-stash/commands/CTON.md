---
description: Compress files using CTON format for LLM context optimization
allowed-tools: ["Bash", "Read"]
argument-hint: "<file-path> [options]"
---

# Compress for Context (CTON)

Run the `compress-for-context` tool to compress files using CTON (Compact Token-Oriented Notation) format, optimized for LLM context windows.

## Instructions

1. Run the compression tool on the specified file(s):

```bash
C:\mcp-servers\memory-mcp\tools\compress-for-context\compress-for-context.exe $ARGUMENTS
```

2. The tool supports multiple formats: JSON, YAML, Markdown, CSV/TSV, Text/Log, TypeScript/JavaScript, XML/HTML.

3. Report the compression results and token savings.

## Common Options

- `-o, --output <path>` - Output file path
- `-l, --level <level>` - Compression level: light, medium, aggressive
- `-b, --batch` - Batch mode for multiple files
- `-r, --recursive` - Process directories recursively
- `-d, --decompress` - Decompress a CTON file

## Usage Examples

- `/project:CTON package.json` - Compress a single JSON file
- `/project:CTON ./src -b -r` - Batch compress all files in src/
- `/project:CTON data.cton -d` - Decompress a CTON file
- `/project:CTON large-file.md -l aggressive` - Aggressive compression
