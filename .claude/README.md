# Claude Code Configuration

This directory contains Claude Code configuration for the ZarlMono workspace.

## Directory Structure

```
.claude/
├── README.md           # This file
├── settings.json       # Hooks and environment config
├── skills/             # Domain knowledge modules
├── agents/             # Specialized sub-agents
├── commands/           # Slash commands
└── hooks/              # Hook scripts
```

## Skills

Skills provide domain-specific knowledge that Claude can apply when working on relevant tasks.

### Go Core Skills

| Skill | Priority | Description |
|-------|----------|-------------|
| [go-error-handling](skills/go-error-handling/SKILL.md) | 9 | Sentinel errors, wrapping, logging at boundaries, context via select |
| [go-interfaces](skills/go-interfaces/SKILL.md) | 8 | Consumer-side, small, composition, satisfaction checks |
| [go-testing](skills/go-testing/SKILL.md) | 8 | Table-driven, fakes over mocks, contract tests, synctest |
| [go-concurrency](skills/go-concurrency/SKILL.md) | 8 | Goroutine lifecycle, channels, sync primitives, worker pools |
| [go-naming](skills/go-naming/SKILL.md) | 7 | Scope-based naming, receivers, constants |
| [go-types](skills/go-types/SKILL.md) | 7 | Semantic types, pointer rules, aliases |

### Domain Skills

| Skill | Priority | Description |
|-------|----------|-------------|
| [connectrpc-patterns](skills/connectrpc-patterns/SKILL.md) | 8 | Proto design, buf generation, service handlers |
| [database-patterns](skills/database-patterns/SKILL.md) | 7 | sqlc, migrations, repositories |
| [pkg-usage](skills/pkg-usage/SKILL.md) | 6 | Shared package import patterns, dependency layers |

### Frontend Skills

| Skill | Priority | Description |
|-------|----------|-------------|
| [react-tailwind](skills/react-tailwind/SKILL.md) | 6 | Tailwind v4, theme-aware colors |
| [connectrpc-web](skills/connectrpc-web/SKILL.md) | 6 | ConnectRPC web client patterns |
| [clerk-auth](skills/clerk-auth/SKILL.md) | 6 | Clerk authentication patterns |

### Process Skills

| Skill | Priority | Description |
|-------|----------|-------------|
| [systematic-debugging](skills/systematic-debugging/SKILL.md) | 9 | Root cause first, no blind fixes |

## Priority Scale

| Priority | Category | Description |
|----------|----------|-------------|
| 9 | Critical process | Core patterns that apply to almost all code (error handling, debugging) |
| 8 | Core patterns | Fundamental patterns within a domain (interfaces, testing, concurrency) |
| 7 | Domain patterns | Specific architectural patterns (types, naming, database) |
| 6 | Specialized | Technology-specific patterns (Tailwind, Clerk, pkg usage) |

Higher priority skills have their scores weighted more heavily during matching.

## Skill Combinations

Common task patterns and which skills to apply:

| Task | Skills |
|------|--------|
| Writing Go service code | go-error-handling → go-interfaces → go-testing |
| Building API endpoint | connectrpc-patterns → go-error-handling → database-patterns |
| Debugging production issue | systematic-debugging → go-error-handling |
| Database changes | database-patterns → go-testing |
| Concurrent/async code | go-concurrency → go-error-handling → go-testing |
| Frontend work | react-tailwind → connectrpc-web |

## Adding New Skills

1. Create directory: `.claude/skills/{skill-name}/`
2. Create `SKILL.md` with YAML frontmatter:
   ```yaml
   ---
   name: skill-name
   description: What this skill covers
   triggers:
     keywords: [list, of, keywords]
     pathPatterns: ["**/*.go"]
   priority: 1-9 (9 = highest)
   related-skills: [other-skill]
   ---
   ```
3. Add skill content with:
   - Core philosophy
   - Patterns with CORRECT/WRONG examples
   - Anti-patterns table
   - Integration notes
4. Update this README

## Style Guide Reference

All skills align with Bruno's Go design philosophy documented in:
- `/CLAUDE.md` - Root workspace documentation
- `/docs/zstyle.md` - Comprehensive style guide (if exists)

Core principles:
- Errors tell a story
- Small, consumer-side interfaces
- Scope-based naming
- Pointers only when nil is valid
- Log at boundaries
- Context signals via select
