---
description: Generate and validate Protocol Buffer code
allowed-tools: Bash, Read, Glob, Grep
related-skills:
  - connectrpc-patterns
---

# /proto Command

Generate and validate Protocol Buffer code using Buf.

## Arguments

- No arguments: Generate for all projects
- `$1`: Project name (e.g., `timer`, `mindmint`)

## Process

1. **Find proto files** in the specified project or all projects
2. **Lint** the proto files with `buf lint`
3. **Generate** code with `buf generate`
4. **Verify** generated Go code compiles
5. **Show** what was generated

## Execution

```bash
# If project specified
if [ -n "$1" ]; then
    cd "$1"
fi

# Find buf.yaml locations
find . -name "buf.yaml" -o -name "buf.gen.yaml" | head -5

# Lint proto files
buf lint

# Generate code
buf generate

# Show generated files
find . -name "*.pb.go" -newer /tmp/before-gen 2>/dev/null | head -20
find . -name "*_connect.go" -newer /tmp/before-gen 2>/dev/null | head -10
find . -name "*_pb.ts" -newer /tmp/before-gen 2>/dev/null | head -10

# Verify Go code compiles
go build ./...
```

## Output

Report:
- Proto files found
- Lint warnings/errors
- Generated files (Go and TypeScript)
- Compilation status

## Note on Hooks

`buf lint` runs automatically via PostToolUse hook when editing `.proto` files.
Use this command to generate code or run full validation.
