---
description: Build one or all projects
allowed-tools: Bash, Read, Glob
---

# /build Command

Build Go projects in the monorepo.

## Arguments

- No arguments: Build all projects
- `$1`: Project name to build (e.g., `timer`, `vault`)

## Projects

Located in `apps/`:
- `gateway` - API gateway
- `timer` - Timer application
- `todoapp` - Todo application
- `vault` - Vault service
- `vault-addon` - Vault addon
- `zarl.dev` - Personal website

## Process

1. **Identify project(s)** to build
2. **Run make build** or `go build`
3. **Report results**

## Execution

```bash
# Build specific project
if [ -n "$1" ]; then
    PROJECT="$1"
    if [ -d "apps/$PROJECT" ]; then
        cd "apps/$PROJECT"
        if [ -f "Makefile" ]; then
            make build
        else
            go build -o "bin/${PROJECT}" ./cmd/... 2>&1 || go build -o "bin/${PROJECT}" . 2>&1
        fi
    else
        echo "Project not found: $PROJECT"
        echo "Available: gateway, timer, todoapp, vault, vault-addon, zarl.dev"
        exit 1
    fi
else
    # Build all projects
    for project in gateway timer todoapp vault vault-addon zarl.dev; do
        echo "=== Building $project ==="
        if [ -d "apps/$project" ]; then
            cd "apps/$project"
            if [ -f "Makefile" ]; then
                make build && echo "[OK] $project" || echo "[FAIL] $project"
            else
                go build ./... && echo "[OK] $project" || echo "[FAIL] $project"
            fi
            cd ../..
        fi
    done
fi
```

## Output Format

```
=== Building timer ===
[OK] timer

=== Building vault ===
[OK] vault

=== Building todoapp ===
[FAIL] todoapp
  Error: undefined: someFunction
  File: service/handler.go:42

=== Summary ===
Built: 5/6
Failed: 1 (todoapp)
```

## Quick Commands

```bash
/build           # Build all
/build timer     # Build timer only
/build vault     # Build vault only
```
