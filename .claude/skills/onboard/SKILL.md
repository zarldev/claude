---
name: onboard
description: "Deep exploration and analysis of a task before implementation - requirements, dependencies, risks"
user-invocable: true
argument-hint: "<task description>"
context: fork
allowed-tools: Read, Glob, Grep, Bash, WebSearch
---

# /onboard

Thoroughly explore a task before writing any code.

## Arguments

- `$ARGUMENTS`: Task description or ticket reference

## Process

1. **Clarify requirements** - What exactly needs to be done?
2. **Search codebase** - Find related code, existing patterns
3. **Identify affected files** - What will change?
4. **List dependencies** - What does this depend on?
5. **Propose approach** - How should this be implemented?
6. **Identify risks** - What could go wrong?

## Investigation Steps

### 1. Requirements Clarification

Ask clarifying questions:
- What is the expected behavior?
- Are there edge cases to consider?
- What are the acceptance criteria?
- Are there any constraints?

### 2. Codebase Search

- Find related files and existing patterns
- Trace data flow through layers (repo → service → transport)
- Check for similar features already implemented

### 3. Dependency Analysis

- What packages are involved?
- What services need to change?
- Are there database migrations needed?
- Are there API changes (proto) needed?

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
- `service/user.go` - User service
- `repository/user.go` - Data access
- `transport/grpc/user.go` - RPC handlers

### Affected Files
| File | Change Type |
|------|-------------|
| service/user.go | Modify |
| migrations/00042_*.sql | Create |

### Dependencies
- Uses existing UserRepository interface
- Requires new migration

### Proposed Approach
1. Add migration for new field
2. Update repository layer
3. Update service layer
4. Update transport handlers
5. Add tests

### Risks
- **Medium**: Migration on large table
- **Low**: API backward compatibility

### Questions
- Should we cache the new data?
- What's the expected data volume?
```
