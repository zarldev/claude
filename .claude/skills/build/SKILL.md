---
name: build
description: "Build one or all projects in the monorepo"
user-invocable: true
argument-hint: "[project]"
allowed-tools: Bash, Read, Glob
---

# /build

Build Go projects in the monorepo.

## Arguments

- No arguments: Build all projects
- `$ARGUMENTS`: Project name to build

## Process

1. **Discover projects** - Look for directories with `go.mod`, `Makefile`, or `cmd/` under `apps/` or project root
2. **Build target(s)** - Use Makefile if available, otherwise `go build`
3. **Report results** - Show pass/fail per project

## Execution

```bash
# Build specific project
if [ -n "$PROJECT" ]; then
    if [ -f "Makefile" ]; then
        make build
    else
        go build -o "bin/${PROJECT}" ./cmd/... 2>&1 || go build -o "bin/${PROJECT}" . 2>&1
    fi
else
    # Build all - discover and iterate
    for dir in apps/*/; do
        project=$(basename "$dir")
        echo "=== Building $project ==="
        cd "$dir"
        if [ -f "Makefile" ]; then
            make build && echo "[OK] $project" || echo "[FAIL] $project"
        else
            go build ./... && echo "[OK] $project" || echo "[FAIL] $project"
        fi
        cd ../..
    done
fi
```

## Output Format

```
=== Building projectA ===
[OK] projectA

=== Building projectB ===
[FAIL] projectB
  Error: undefined: someFunction
  File: service/handler.go:42

=== Summary ===
Built: 4/5
Failed: 1 (projectB)
```
