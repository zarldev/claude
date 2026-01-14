# Claude Code Settings Documentation

This document explains the hooks and automation configured in `settings.json`.

## Overview

The settings configure several automation hooks that run at different points in Claude's workflow:

1. **UserPromptSubmit** - Runs when you submit a prompt
2. **PreToolUse** - Runs before Claude uses a tool
3. **PostToolUse** - Runs after Claude uses a tool

## Hooks Explained

### Skill Evaluation (UserPromptSubmit)

**What it does**: Analyzes your prompt and suggests relevant skills based on keywords, file paths, and intent patterns.

**When it runs**: Every time you submit a prompt.

**Example output**:
```
SKILL SUGGESTIONS
=================

Detected file paths: pkg/cache/cache.go

Matched skills (ranked by relevance):
1. pkg-usage (HIGH confidence - score: 9.0)
   Matched: directory "pkg/cache", keyword "cache"
2. go-style-guide (MEDIUM confidence - score: 5.0)
   Matched: path "*.go"
```

**Configuration**: Edit `.claude/hooks/skill-rules.json` to add or modify skill triggers.

---

### Main Branch Protection (PreToolUse)

**What it does**: Prevents editing files when on the `main` branch.

**When it runs**: Before any Edit or Write operation.

**Why**: Encourages feature branch workflow. Create a branch before making changes.

**How to work around**: Create a feature branch:
```bash
git checkout -b feat/my-feature
```

---

### Go Formatting (PostToolUse)

**What it does**: Runs `gofmt` and `goimports` on Go files after editing.

**When it runs**: After editing any `.go` file.

**Why**: Ensures consistent formatting automatically.

**Dependencies**: Requires `gofmt` (included with Go) and `goimports`:
```bash
go install golang.org/x/tools/cmd/goimports@latest
```

---

### Go Vet (PostToolUse)

**What it does**: Runs `go vet` on edited Go files to check for common mistakes.

**When it runs**: After editing any `.go` file.

**Why**: Catches suspicious constructs (printf format errors, unreachable code, etc.)

**Dependencies**: Included with Go.

---

### Go Linting (PostToolUse)

**What it does**: Runs `golangci-lint` on edited Go files.

**When it runs**: After editing any `.go` file.

**Why**: Catches common issues immediately.

**Dependencies**: Requires `golangci-lint`:
```bash
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
```

**Note**: Shows first 20 lines of output. Non-blocking (won't stop Claude).

---

### Test Runner (PostToolUse)

**What it does**: Runs tests in the package containing the edited test file.

**When it runs**: After editing any `*_test.go` file.

**Why**: Immediate feedback on test changes.

**Note**: Shows last 30 lines of output. Non-blocking.

---

### Proto Linting (PostToolUse)

**What it does**: Runs `buf lint` on edited proto files.

**When it runs**: After editing any `.proto` file.

**Dependencies**: Requires `buf`:
```bash
npm install -g @bufbuild/buf
# or
brew install bufbuild/buf/buf
```

---

### Frontend Formatting (PostToolUse)

**What it does**: Runs Prettier on TypeScript/TSX files.

**When it runs**: After editing any `.ts` or `.tsx` file.

**Dependencies**: Requires Prettier in the project:
```bash
npm install --save-dev prettier
```

---

## Customization

### Adding New Skills

Edit `.claude/hooks/skill-rules.json`:

```json
{
  "skills": {
    "my-new-skill": {
      "description": "Description of the skill",
      "priority": 8,
      "triggers": {
        "keywords": ["keyword1", "keyword2"],
        "keywordPatterns": ["\\bpattern\\b"],
        "pathPatterns": ["**/path/**/*.go"],
        "intentPatterns": ["(?:create|add).*thing"]
      }
    }
  }
}
```

### Disabling Hooks

To disable a specific hook, remove it from `settings.json` or comment it out.

### Personal Overrides

Create `.claude/settings.local.json` (gitignored) for personal overrides:

```json
{
  "hooks": {
    "PostToolUse": []
  }
}
```

---

## Troubleshooting

### Hook Not Running

1. Check the tool is installed (`gofmt`, `golangci-lint`, etc.)
2. Check file extension matches the condition
3. Increase timeout if the tool is slow

### Hook Blocking Edits

If a PreToolUse hook blocks an edit:
1. Check the error message
2. Fix the condition (e.g., switch to a feature branch)

### Hook Timeout

If a hook times out:
1. The operation continues without the hook
2. Consider increasing the timeout value

---

## Environment Variables

Available in hooks:

- `$CLAUDE_TOOL_INPUT_FILE_PATH` - Path to the file being edited
- `$CLAUDE_USER_PROMPT` - The user's prompt (for UserPromptSubmit)
- `$INSIDE_CLAUDE_CODE` - Set to "true" when running in Claude Code

---

## Best Practices

1. **Keep hooks fast** - Long-running hooks slow down the workflow
2. **Make hooks non-blocking** - Use `|| true` for informational hooks
3. **Test locally** - Run commands manually before adding as hooks
4. **Document changes** - Update this file when modifying hooks
