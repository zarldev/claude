---
paths:
  - "**/*.go"
---

# Go Rules

## Error Handling
- never use "failed to", "unable to", "could not", "error" prefixes
- always wrap: `fmt.Errorf("context: %w", err)`
- sentinel errors as package-level vars: `var ErrNotFound = errors.New("not found")`
- check with `errors.Is()`, not type assertions
- log once at application boundaries, never in business logic
- context cancellation via `select { case <-ctx.Done(): }`, return own `ErrCanceled` sentinel
- never poll `ctx.Err()`, never return `context.Canceled` directly

## Naming
- receivers: single letter matching type initial (`s *Service`, `h *Handler`)
- no Get/Set method prefixes - this is Go, not Java
- scope-based: `i`/`j`/`k` in loops, `u`/`r`/`w` short-lived, `requestID`/`userCount` larger scope
- error vars: `ErrNameOfError`
- constants: UPPER_CASE for rich enums, camelCase for simple

## Types
- use `any` not `interface{}`
- pointers ONLY when nil is a valid value
- semantic types over primitives: `type UserID = string`
- separate structs per layer - no mixed json/db tags
- useful zero values, variadic options for configuration

## Interfaces
- small: ideally 1 method, max 3-4
- consumer-side definition (define where used, not where implemented)
- satisfaction checks: `var _ Interface = (*Impl)(nil)`
- accept interfaces, return structs
- let interfaces emerge from usage, not design-first

## Testing
- always `package_test` (black-box)
- table-driven with `t.Run`
- `t.Context()` for context
- fakes over mocks (in-memory implementations)
- omit nil error fields in test cases
- use `errors.Is()` for error checking
- `moq` if mocking unavoidable, `sql-mock` for drivers

## Concurrency
- never fire-and-forget: every goroutine needs stop signal + done signal
- channel size: 0 or 1 (larger needs justification)
- never embed mutexes (keep private)
- `errgroup` for concurrent error handling

## Code Quality
- early returns over if/else chains
- extract common operations from branches - no duplication
- generics only when writing repetitive type-specific code
- prevent panics: careful bounds checking and slice management
