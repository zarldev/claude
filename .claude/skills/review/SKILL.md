---
name: review
description: "Code review against Go style guide - error handling, naming, interfaces, testing"
user-invocable: true
argument-hint: "[file|dir|--pr|--all]"
context: fork
allowed-tools: Read, Glob, Grep, Bash
---

# /review

Review code changes against zstyle Go conventions.

## Arguments

- No arguments: Review staged changes
- `$ARGUMENTS`: File path, directory, `--all` for uncommitted changes, or `--pr` for PR diff

## Process

1. **Identify files to review** using git diff
2. **Apply review checklist** (full checklist in `go-code-reviewer` agent)
3. **Report issues by severity** (Critical > Major > Minor)

## Review Checklist

### Critical
- [ ] No "failed to" / "unable to" / "could not" error prefixes
- [ ] Errors properly wrapped with `fmt.Errorf("context: %w", err)`
- [ ] No `interface{}` (use `any`)
- [ ] Sentinel errors as package-level vars
- [ ] No logging in business logic

### Major
- [ ] Single-letter receivers matching type initial
- [ ] No Get/Set method prefixes
- [ ] Small interfaces (1-3 methods)
- [ ] Consumer-side interface definitions
- [ ] Context cancellation via select, not polling

### Minor
- [ ] Scope-based naming (short vars for short scopes)
- [ ] No duplicated code in branches
- [ ] Early returns over if/else chains
- [ ] Pointers only when nil is valid

## File Discovery

```bash
if [ "$1" == "--pr" ]; then
    FILES=$(git diff origin/main...HEAD --name-only | grep '\.go$')
elif [ "$1" == "--all" ]; then
    FILES=$(git diff --name-only | grep '\.go$')
elif [ -n "$1" ]; then
    FILES="$1"
else
    FILES=$(git diff --cached --name-only | grep '\.go$')
fi
```

## Output Format

```markdown
## Code Review: N files

### Critical Issues (N)

**path/to/file.go:42**
- Current: `return fmt.Errorf("failed to get key: %w", err)`
- Should be: `return fmt.Errorf("get key: %w", err)`

### Major Issues (N)
...

### Style Issues (N)
...

### Summary
- N critical issues
- N major issues
- N style issues
```
