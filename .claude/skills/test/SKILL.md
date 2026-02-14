---
name: test
description: "Run Go tests with coverage and race detection"
user-invocable: true
argument-hint: "[path] [--cover] [--race] [--verbose]"
allowed-tools: Bash, Read
---

# /test

Run Go tests with full diagnostics.

## Arguments

- No arguments: Run all tests (`./...`)
- `$ARGUMENTS`: Package path or project name
- `--cover`: Include coverage report
- `--race`: Enable race detection
- `--verbose`: Verbose output

## Process

1. **Determine scope** - All packages or specific path
2. **Run tests** with requested flags
3. **Show failing tests** first
4. **Display coverage** if requested
5. **Summarize results**

## Execution

```bash
FLAGS="-race -timeout 5m"

# Add coverage if requested
if [[ "$*" == *"--cover"* ]]; then
    FLAGS="$FLAGS -coverprofile=coverage.out"
fi

# Add verbose if requested
if [[ "$*" == *"--verbose"* ]]; then
    FLAGS="$FLAGS -v"
fi

# Determine path
PATH_ARG="./..."
if [ -n "$1" ] && [[ "$1" != --* ]]; then
    if [ -d "$1" ]; then
        PATH_ARG="./$1/..."
    else
        PATH_ARG="$1"
    fi
fi

go test $FLAGS $PATH_ARG

# Show coverage summary if generated
if [ -f coverage.out ]; then
    go tool cover -func=coverage.out | tail -1
fi
```

## Output Format

```
=== Running tests ===
Path: ./...
Flags: -race -timeout 5m

=== Results ===
PASS: 142 tests
FAIL: 2 tests
SKIP: 5 tests

=== Failures ===
--- FAIL: TestUserService_Create (0.02s)
    user_test.go:45: expected ErrNotFound, got nil

=== Coverage ===
total: 78.5% of statements
```

## Note

Tests run automatically via PostToolUse hook when editing `*_test.go` files.
Use this skill for on-demand runs or with specific options.
