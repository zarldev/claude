# Skills Index

Skills are domain knowledge documents that Claude uses to provide context-aware assistance. They activate automatically based on keywords, file paths, and intent patterns in your prompts.

## How Skills Work

1. **Automatic Activation**: The skill evaluation hook analyzes your prompt
2. **Pattern Matching**: Keywords, file paths, and intent trigger relevant skills
3. **Context Loading**: Matched skills provide specialized knowledge
4. **Better Responses**: Claude applies skill-specific patterns

## Available Skills

### Go Core Skills

| Skill | Description | Triggers |
|-------|-------------|----------|
| [go-style-guide](go-style-guide/SKILL.md) | Bruno's Go philosophy | Any Go code, "style", "pattern" |
| [go-error-handling](go-error-handling/SKILL.md) | Error patterns | "error", "wrap", "sentinel" |
| [go-testing](go-testing/SKILL.md) | Table-driven testing | `*_test.go`, "test", "mock" |
| [go-interfaces](go-interfaces/SKILL.md) | Interface design | "interface", "abstraction" |

### Infrastructure Skills

| Skill | Description | Triggers |
|-------|-------------|----------|
| [connectrpc-patterns](connectrpc-patterns/SKILL.md) | ConnectRPC/Proto | `*.proto`, "grpc", "buf" |
| [pkg-usage](pkg-usage/SKILL.md) | Shared packages | `pkg/*`, package names |
| [database-patterns](database-patterns/SKILL.md) | Repository patterns | "postgres", "migration", "sqlc" |

### Frontend Skills

| Skill | Description | Triggers |
|-------|-------------|----------|
| [react-tailwind](react-tailwind/SKILL.md) | React + Tailwind v4 | `*.tsx`, "tailwind", "component" |
| [connectrpc-web](connectrpc-web/SKILL.md) | Frontend API calls | "useQuery", "mutation" |
| [clerk-auth](clerk-auth/SKILL.md) | Authentication | "auth", "clerk", "login" |

### Project-Specific Skills

| Skill | Description | Triggers |
|-------|-------------|----------|
| [mindmint-development](mindmint-development/SKILL.md) | AI persona system | `mindmint/*`, "persona" |
| [timer-development](timer-development/SKILL.md) | Timer app | `timer/*`, "alarm" |

## Skill File Format

Each skill is a markdown file with YAML frontmatter:

```markdown
---
name: skill-name
description: Description used for activation matching
model: claude-sonnet-4-20250514  # Optional: specific model
allowed-tools: Read, Grep, Glob  # Optional: tool restrictions
---

# Skill Title

Skill content with patterns, examples, and guidance.
```

## Adding New Skills

1. Create directory: `.claude/skills/my-skill/`
2. Create `SKILL.md` with frontmatter
3. Add to `.claude/hooks/skill-rules.json`:

```json
{
  "skills": {
    "my-skill": {
      "description": "What this skill does",
      "priority": 8,
      "triggers": {
        "keywords": ["keyword1", "keyword2"],
        "pathPatterns": ["**/path/**/*.go"],
        "intentPatterns": ["(?:create|add).*thing"]
      }
    }
  }
}
```

4. Update this README

## Skill Activation

### Manual Activation

Mention a skill by name:
- "Apply the go-style-guide skill"
- "Use the testing-patterns skill"

### Automatic Activation

The skill evaluator suggests skills based on:
- **Keywords**: Words in your prompt
- **Path Patterns**: File paths you mention
- **Directory Mappings**: Working in specific directories
- **Intent Patterns**: What you're trying to do

### Checking Active Skills

The skill evaluator outputs suggestions at the start of each prompt. Look for:

```
SKILL SUGGESTIONS
=================

Matched skills (ranked by relevance):
1. go-style-guide (HIGH confidence - score: 9.0)
   Matched: keyword "error", path "*.go"
```

## Best Practices

1. **Keep skills focused** - One domain per skill
2. **Include examples** - Show good and bad patterns
3. **Reference related skills** - Link to complementary skills
4. **Update regularly** - Keep skills in sync with code

## Skill Priority

Skills have a priority (1-10) that affects ranking:
- 10: Critical (go-style-guide)
- 9: Project-specific (mindmint, timer)
- 8: Technology-specific (connectrpc, database)
- 7: General patterns (pkg-usage)
