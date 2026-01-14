# Claude Code Configuration

Personal Claude Code configuration implementing a modular skill-based system for Go and React development.

## Overview

This repo contains Claude Code configuration that encodes a specific design philosophy and coding style. Instead of one large instructions file, knowledge is split into focused skills that activate based on context.

## Structure

```
.
├── CLAUDE.md              # Core design philosophy (cross-language)
└── .claude/
    ├── skills/            # Domain knowledge modules (13 skills)
    ├── agents/            # Specialized sub-agents (4 agents)
    ├── commands/          # Slash commands (7 commands)
    ├── hooks/             # Automation scripts
    └── settings.json      # Hook configuration
```

## Skills

Skills provide domain-specific knowledge that activates automatically based on keywords, file paths, and intent patterns.

### Go Skills

| Skill | Description |
|-------|-------------|
| `go-error-handling` | Sentinel errors, wrapping, logging at boundaries |
| `go-interfaces` | Consumer-side, small, composition patterns |
| `go-testing` | Table-driven tests, fakes over mocks, synctest |
| `go-concurrency` | Goroutine lifecycle, channels, sync primitives |
| `go-naming` | Scope-based naming, receivers, constants |
| `go-types` | Semantic types, pointer rules, type aliases |

### Domain Skills

| Skill | Description |
|-------|-------------|
| `connectrpc-patterns` | Proto design, buf generation, service handlers |
| `database-patterns` | sqlc, migrations, repository pattern |
| `pkg-usage` | Shared package import patterns |

### Frontend Skills

| Skill | Description |
|-------|-------------|
| `react-tailwind` | Tailwind v4, theme-aware colors, components |
| `connectrpc-web` | ConnectRPC web client, React Query hooks |
| `clerk-auth` | Clerk authentication for React and Go |

### Process Skills

| Skill | Description |
|-------|-------------|
| `systematic-debugging` | Root cause first, no blind fixes |

## Agents

Specialized sub-agents for specific workflows:

- **go-code-reviewer** - Reviews Go code against style guide
- **migration-planner** - Plans safe database migrations
- **proto-designer** - Designs Protocol Buffer schemas
- **github-workflow** - Handles git operations and PRs

## Commands

Slash commands for common tasks:

| Command | Description |
|---------|-------------|
| `/build` | Build projects |
| `/dev` | Start development environment |
| `/test` | Run tests with coverage |
| `/proto` | Generate protobuf code |
| `/migrate` | Create/run database migrations |
| `/review` | Run code review |
| `/onboard` | Deep exploration before implementation |

## Hooks

Automated checks on file changes:

**Go files:**
- `gofmt` + `goimports` - Formatting
- `go vet` - Static analysis
- `golangci-lint` - Linting
- `go test -race` - Tests on `*_test.go` changes

**Proto files:**
- `buf lint` - Linting
- `buf breaking` - Breaking change detection

**TypeScript files:**
- `prettier` - Formatting
- `eslint` - Linting
- `tsc --noEmit` - Type checking

**Branch protection:**
- Blocks edits on `main` branch

## Design Philosophy

Core principles encoded in the skills:

- **Errors tell a story** - Wrap at every failure point, log once at boundaries
- **Small interfaces** - Consumer-side definition, emergent not design-first
- **Scope-based naming** - Smaller scope = shorter names
- **Pointers only when nil is valid** - Avoid pointer abuse
- **Fakes over mocks** - In-memory implementations for testing
- **No fire-and-forget** - Every goroutine needs lifecycle management

## Usage

1. Clone this repo (or copy `.claude/` to your project)
2. Claude Code will automatically load skills based on context
3. Use `/command` syntax for common workflows
4. Skills activate via keywords, file paths, or intent patterns

## Customization

### Adding a skill

1. Create `.claude/skills/{name}/SKILL.md` with YAML frontmatter
2. Add entry to `.claude/hooks/skill-rules.json`
3. Update `.claude/README.md`

### Skill frontmatter

```yaml
---
name: skill-name
description: What this skill covers
triggers:
  keywords: [keyword1, keyword2]
  pathPatterns: ["**/*.go"]
  intentPatterns: ["(?:create|add).*thing"]
priority: 7
related-skills: [other-skill]
---
```

### Priority scale

| Priority | Category |
|----------|----------|
| 9 | Critical (error handling, debugging) |
| 8 | Core patterns (interfaces, testing, concurrency) |
| 7 | Domain patterns (types, naming, database) |
| 6 | Specialized (Tailwind, Clerk, pkg usage) |

## License

Personal configuration - use as reference or starting point for your own setup.
