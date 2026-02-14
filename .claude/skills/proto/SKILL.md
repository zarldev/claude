---
name: proto
description: "Generate and validate Protocol Buffer code using buf"
user-invocable: true
argument-hint: "[project]"
allowed-tools: Bash, Read, Glob, Grep
---

# /proto

Generate and validate Protocol Buffer code using Buf.

## Arguments

- No arguments: Generate for current project
- `$ARGUMENTS`: Project name or path

## Process

1. **Find proto files** in the specified project or current directory
2. **Lint** with `buf lint`
3. **Generate** with `buf generate`
4. **Verify** generated Go code compiles
5. **Show** what was generated

## Execution

```bash
# Navigate to project if specified
if [ -n "$1" ]; then
    cd "$1"
fi

# Find buf config
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

## Note

`buf lint` runs automatically via PostToolUse hook when editing `.proto` files.
Use this skill to generate code or run full validation.
