# zstyle - Claude Code Configuration

Claude Code configuration for [zarldev](https://github.com/zarldev)'s Go and React development style.

## What is zstyle?

**zstyle** is a collaboratively developed coding style guide that emphasizes:

- **Errors tell a story** - Build narrative through wrapping, log once at boundaries
- **Small, emergent interfaces** - Consumer-side definition, not design-first
- **Scope-based naming** - Smaller scope = shorter names
- **Build concrete first** - Poke the problem with reality, then abstract
- **Fakes over mocks** - In-memory implementations for testing

This repo packages zstyle into modular Claude Code skills that activate based on context.

## Origin

The skills in this repo are distilled from comprehensive style guides developed for the [ZarlMono](https://github.com/zarldev/zarlmono) monorepo:

- `zstyle_go.md` - Go patterns, error handling, interfaces, testing
- `zstyle_node.md` - React 19, Tailwind v4, ConnectRPC web clients

## Structure

```
.
├── CLAUDE.md              # Core design philosophy
└── .claude/
    ├── skills/            # 13 domain knowledge modules
    ├── agents/            # 4 specialized sub-agents
    ├── commands/          # 7 slash commands
    ├── hooks/             # Automated checks
    └── settings.json      # Configuration
```

## Skills

Skills activate automatically based on keywords, file paths, and intent patterns.

### Go Core

| Skill | Priority | Description |
|-------|----------|-------------|
| `go-error-handling` | 9 | Sentinel errors, wrapping, logging at boundaries |
| `go-interfaces` | 8 | Consumer-side, small, composition patterns |
| `go-testing` | 8 | Table-driven, fakes over mocks, synctest |
| `go-concurrency` | 8 | Goroutine lifecycle, channels, sync primitives |
| `go-naming` | 7 | Scope-based naming, receivers, constants |
| `go-types` | 7 | Semantic types, pointer rules, type aliases |

### Infrastructure

| Skill | Priority | Description |
|-------|----------|-------------|
| `connectrpc-patterns` | 8 | Proto design, buf generation, handlers |
| `database-patterns` | 7 | sqlc, migrations, repository pattern |
| `pkg-usage` | 6 | ZarlMono shared package patterns |

### Frontend

| Skill | Priority | Description |
|-------|----------|-------------|
| `react-tailwind` | 6 | Tailwind v4, theme-aware colors |
| `connectrpc-web` | 6 | ConnectRPC client, React Query hooks |
| `clerk-auth` | 6 | Clerk authentication patterns |

### Process

| Skill | Priority | Description |
|-------|----------|-------------|
| `systematic-debugging` | 9 | Root cause first, no blind fixes |

## Agents

- **go-code-reviewer** - Reviews against zstyle
- **migration-planner** - Safe database migrations
- **proto-designer** - Protocol Buffer schemas
- **github-workflow** - Git operations and PRs

## Commands

| Command | Description |
|---------|-------------|
| `/build` | Build projects |
| `/dev` | Start dev environment |
| `/test` | Run tests with coverage |
| `/proto` | Generate protobuf code |
| `/migrate` | Database migrations |
| `/review` | Code review |
| `/onboard` | Deep exploration |

## Hooks

Automated checks on every file edit:

| Files | Checks |
|-------|--------|
| `*.go` | gofmt, goimports, go vet, golangci-lint |
| `*_test.go` | go test -race |
| `*.proto` | buf lint, buf breaking |
| `*.ts/*.tsx` | prettier, eslint, tsc --noEmit |

Plus: main branch protection (blocks direct edits).

## Key Principles

From zstyle:

> "Errors tell a story - build narrative without stuttering, wrap at every failure point"

> "The larger the interface, the weaker the abstraction"

> "Scope-based naming is my jam - smaller scope = shorter names"

> "Poking the problem with reality - understand before abstracting"

> "Never fire-and-forget - every goroutine needs lifecycle management"

## Usage

**For your own projects:**

1. Copy `.claude/` to your repo
2. Update `pkg-usage` skill for your packages
3. Modify triggers in `skill-rules.json` as needed

**Skills activate when you:**
- Mention keywords ("error handling", "interface", "goroutine")
- Work with matching files (`*.go`, `*_test.go`, `*.proto`)
- Express intent ("add a test", "fix the bug", "create migration")

## Adding Skills

1. Create `.claude/skills/{name}/SKILL.md`:

```yaml
---
name: skill-name
description: What this skill covers
triggers:
  keywords: [keyword1, keyword2]
  pathPatterns: ["**/*.go"]
priority: 7
related-skills: [other-skill]
---

# Skill Title

Content with examples...
```

2. Add to `.claude/hooks/skill-rules.json`
3. Update `.claude/README.md`

## Priority Scale

| Priority | Category | Examples |
|----------|----------|----------|
| 9 | Critical | error-handling, debugging |
| 8 | Core | interfaces, testing, concurrency |
| 7 | Domain | types, naming, database |
| 6 | Specialized | Tailwind, Clerk, pkg-usage |

## License

MIT - Use as reference or starting point for your own Claude Code configuration.
