---
description: Deep exploration of a task before implementation
allowed-tools: Read, Glob, Grep, Task
related-skills:
  - systematic-debugging
  - pkg-usage
---

# /onboard Command

Thoroughly explore a task before writing any code.

## Arguments

- `$1`: Task description or ticket reference

## Process

1. **Clarify requirements** - What exactly needs to be done?
2. **Search codebase** - Find related code
3. **Identify affected files** - What will change?
4. **List dependencies** - What does this depend on?
5. **Propose approach** - How should this be implemented?
6. **Identify risks** - What could go wrong?

## Execution

### 1. Requirements Clarification

Ask clarifying questions:
- What is the expected behavior?
- Are there edge cases to consider?
- What are the acceptance criteria?
- Are there any constraints?

### 2. Codebase Search

```bash
# Find related files
grep -r "related_term" --include="*.go" .
glob "**/*related*.go"

# Find existing patterns
grep -r "similar_feature" --include="*.go" .
```

### 3. Dependency Analysis

- What packages are involved?
- What services need to change?
- Are there database migrations needed?
- Are there API changes needed?

### 4. Implementation Approach

Propose:
- Which files to modify
- New files to create
- Order of changes
- Testing strategy

### 5. Risk Assessment

Consider:
- Breaking changes
- Performance impact
- Security implications
- Migration requirements

## Output Format

```markdown
## Task Analysis: [Description]

### Requirements
- [Requirement 1]
- [Requirement 2]
- [Open question]

### Related Code
- `pkg/service/user.go` - User service
- `handler/http/user.go` - HTTP handlers
- `repository/postgres/user.go` - Data access

### Affected Files
| File | Change Type |
|------|-------------|
| service/user.go | Modify |
| handler/user.go | Modify |
| migrations/00042_*.sql | Create |

### Dependencies
- Requires pkg/cache for caching
- Uses existing UserRepository interface

### Proposed Approach
1. Add migration for new field
2. Update repository layer
3. Update service layer
4. Update HTTP handlers
5. Add tests

### Risks
- **Medium**: Migration on large table
- **Low**: API backward compatibility

### Questions
- Should we cache the new data?
- What's the expected data volume?

### Estimated Changes
- 4 files modified
- 2 files created
- 1 migration
```

## Usage

```bash
/onboard "Add user avatar upload feature"
/onboard "TICKET-123"
/onboard "Fix memory leak in conversation cache"
```
