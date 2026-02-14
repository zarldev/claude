# zstyle - Claude Code Configuration

Claude Code configuration for [zarldev](https://github.com/zarldev)'s Go and React development style.

## What is zstyle?

**zstyle** is zarldev's personal coding style guide, built from conventions learned over years of Go and React development. It emphasizes:

- **Errors tell a story** - Build narrative through wrapping, log once at boundaries
- **Small, emergent interfaces** - Consumer-side definition, not design-first
- **Scope-based naming** - Smaller scope = shorter names
- **Build concrete first** - Poke the problem with reality, then abstract
- **Fakes over mocks** - In-memory implementations for testing

This repo packages zstyle into modular Claude Code skills, rules, and agents.

## Structure

```
.
├── CLAUDE.md              # Core design philosophy
├── .mcp.json              # MCP server configuration (GitHub)
└── .claude/
    ├── rules/             # Always-on path-scoped rules
    ├── skills/            # 13 knowledge + 7 invocable skills
    ├── agents/            # 4 specialized sub-agents
    └── settings.json      # Hooks and configuration
```

## Rules (Always-On)

Path-scoped rules load automatically when matching files are touched:

| Rule | Paths | Covers |
|------|-------|--------|
| `go.md` | `**/*.go` | Error handling, naming, types, interfaces, testing, concurrency |
| `react.md` | `**/*.tsx`, `**/*.jsx`, `**/*.ts` | Theme colors, components, state handling, styling |
| `proto.md` | `**/*.proto` | Enums, field numbers, naming, compatibility |

## Skills

### Knowledge Skills

Detailed reference that Claude loads based on context (description matching):

| Category | Skill | Description |
|----------|-------|-------------|
| Go Core | `go-error-handling` | Sentinel errors, wrapping, logging at boundaries |
| Go Core | `go-interfaces` | Consumer-side, small, composition patterns |
| Go Core | `go-testing` | Table-driven, fakes over mocks, synctest |
| Go Core | `go-concurrency` | Goroutine lifecycle, channels, sync primitives |
| Go Core | `go-naming` | Scope-based naming, receivers, constants |
| Go Core | `go-types` | Semantic types, pointer rules, type aliases |
| Infra | `connectrpc-patterns` | Proto design, buf generation, handlers |
| Infra | `database-patterns` | sqlc, migrations, repository pattern |
| Infra | `pkg-usage` | Shared package patterns |
| Frontend | `react-tailwind` | Tailwind v4, theme-aware colors |
| Frontend | `connectrpc-web` | ConnectRPC client, TanStack Query hooks |
| Frontend | `clerk-auth` | Clerk authentication patterns |
| Process | `systematic-debugging` | Root cause first, no blind fixes |

### Invocable Skills

Slash commands available during sessions:

| Skill | Description |
|-------|-------------|
| `/build [project]` | Build one or all projects |
| `/dev <project>` | Start dev environment with hot reload |
| `/test [path] [--cover]` | Run tests with coverage and race detection |
| `/proto [project]` | Generate and validate protobuf code |
| `/migrate <cmd> [name]` | Create or run database migrations |
| `/review [file\|--pr]` | Code review against zstyle conventions |
| `/onboard <task>` | Deep exploration before implementation |

## Agents

| Agent | Description | Preloaded Skills |
|-------|-------------|------------------|
| `go-code-reviewer` | Reviews against zstyle | All Go core skills |
| `migration-planner` | Safe database migrations | database-patterns |
| `proto-designer` | Protocol Buffer schemas | connectrpc-patterns, database-patterns |
| `github-workflow` | Git operations and PRs | - |

## Hooks

Automated checks configured in `settings.json`:

| Files | Checks |
|-------|--------|
| `*.go` | gofmt, goimports, go vet, golangci-lint |
| `*_test.go` | go test -race |
| `*.proto` | buf lint, buf breaking |
| `*.ts/*.tsx` | prettier, eslint, tsc --noEmit |

Plus: main branch protection (blocks direct edits on main).

## MCP Servers

| Server | Purpose |
|--------|---------|
| `github` | GitHub API access via MCP protocol |

## Key Principles

> "Errors tell a story - build narrative without stuttering, wrap at every failure point"

> "The larger the interface, the weaker the abstraction"

> "Scope-based naming is my jam - smaller scope = shorter names"

> "Poking the problem with reality - understand before abstracting"

> "Never fire-and-forget - every goroutine needs lifecycle management"

## Usage

**For your own projects:**

1. Copy `.claude/` and `.mcp.json` to your repo
2. Update `pkg-usage` skill for your packages
3. Adjust rules in `.claude/rules/` for your conventions

**Skills activate when you:**
- Work with matching files (`*.go`, `*_test.go`, `*.proto`, `*.tsx`)
- Mention relevant topics ("error handling", "interface", "goroutine")
- Use slash commands (`/build`, `/test`, `/review`)

## Adding Skills

Create `.claude/skills/{name}/SKILL.md`:

```yaml
---
name: skill-name
description: "What this skill covers and when to use it"
---

# Skill Title

Content with examples...
```

For invocable skills, add:

```yaml
---
name: skill-name
description: "What this skill does"
user-invocable: true
argument-hint: "<required> [optional]"
allowed-tools: Bash, Read
---
```

## License

MIT - Use as reference or starting point for your own Claude Code configuration.
