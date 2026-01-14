---
description: Run code review against Go style guide
allowed-tools: Read, Glob, Grep, Bash(git:*)
related-skills:
  - go-error-handling
  - go-interfaces
  - go-testing
  - go-naming
  - go-types
---

# /review Command

Review code changes against Bruno's Go style guide.

## Arguments

- No arguments: Review staged changes
- `$1`: File path, directory, or `--all` for all uncommitted changes
- `--pr`: Review current PR changes

## Process

1. **Identify files to review**
   - Staged changes (default)
   - Specific file/directory
   - PR diff
2. **Load go-code-reviewer agent**
3. **Apply review checklist**
4. **Report issues by severity**

## Execution

```bash
# Get files to review
if [ "$1" == "--pr" ]; then
    FILES=$(git diff origin/main...HEAD --name-only | grep '\.go$')
elif [ "$1" == "--all" ]; then
    FILES=$(git diff --name-only | grep '\.go$')
elif [ -n "$1" ]; then
    FILES="$1"
else
    FILES=$(git diff --cached --name-only | grep '\.go$')
fi

echo "Files to review:"
echo "$FILES"
```

## Review Checklist

Apply the go-code-reviewer agent checklist:

### Critical
- [ ] No "failed to" error prefixes
- [ ] Errors properly wrapped
- [ ] No `interface{}`

### Major
- [ ] Single-letter receivers
- [ ] No Get/Set prefixes
- [ ] Small interfaces

### Minor
- [ ] Scope-based naming
- [ ] No duplicated code

## Output Format

```markdown
## Code Review: 3 files

### Critical Issues (2)

**pkg/cache/cache.go:42**
```go
// Current
return fmt.Errorf("failed to get key: %w", err)
// Should be
return fmt.Errorf("get key: %w", err)
```

**service/user.go:15**
```go
// Current
func (service *UserService) GetUser()
// Should be
func (s *UserService) User()
```

### Style Issues (1)

**handler/http.go:88**
- Receiver name `handler` should be `h`

### Summary
- 2 critical issues
- 1 style issue
- 0 suggestions

Run `/review` again after fixes.
```
