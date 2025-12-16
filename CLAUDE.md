# Bruno's Go Design Philosophy - Claude Reference

This document captures Bruno's design philosophy and coding style for Go projects.

## Core Principles

**Build Philosophy**: Start concrete → understand problem → delete prototype → rebuild with understanding → extract abstractions only when needed

**Error Philosophy**: Errors tell a story - build narrative without stuttering, wrap at every failure point, log once at boundaries

**Interface Philosophy**: Small (ideally 1 method), consumer-side definition, emergent not design-first

**Type Philosophy**: Semantic types for complex domains (`type AssetID = int64`), scope-based naming, pointer abuse prevention

**Code Quality Philosophy**: Always check for duplicated code in branches, extract common operations before/after conditionals, prefer early returns over if/else chains

## Error Handling (Critical)

### Never Use These Prefixes
- ❌ "failed to", "unable to", "could not", "error"
- ✅ Direct context: `fmt.Errorf("open file: %w", err)`

### Sentinel Error Pattern
```go
// Function-specific naming: Err{FunctionName}{ErrorType}
var (
    ErrParseValue  = errors.New("parse value")
    ErrParseSource = errors.New("parse source")
)

// Generic errors (avoid tight coupling):
var (
    ErrNotFound = errors.New("key not found")  // ✅ Good - reusable
    ErrGetNotFound = errors.New("key not found") // ❌ Bad - too tightly coupled
)

// Context-specific errors when generic errors are insufficient:
var (
    ErrQueueClosed = errors.New("queue closed")     // ✅ Specific error condition
    ErrQueueEmpty  = errors.New("queue empty")      // ✅ Different from "not found"
    ErrCanceled    = errors.New("operation canceled") // ✅ Context cancellation
)

// Wrap with context
if err := parser.Parse(ctx, source); err != nil {
    return fmt.Errorf("%w: %s", ErrParseSource, err)
}

// Check with errors.Is
if errors.Is(err, ErrParseValue) {
    // handle specific error
}
```

### Logging Strategy
- Never log every error occurrence
- Log once at application boundaries with full context
- Let error chain build the story through the stack

## Naming Conventions

### Constants
- **Rich enums**: `UPPER_CASE` (e.g., `UNKNOWN`, `FAILED`)
- **Simple constants**: `camelCase` (e.g., `wordsPerMinute`)

### Variables
- **Scope-based naming**: smaller scope = shorter names
- Loop variables: `i`, `j`, `k`
- HTTP handlers: `w`, `r`
- Larger scope: `requestID`, `wordsPerMinute`

### Receivers
- ALWAYS single letters (max 2 chars)
- Match type: `s *Service`, `h *HTTPAPI`, `m *Model`

### Errors
- `ErrNameOfError` format: `ErrParseValue`, `ErrNoEnumsFound`

## Type System

### Type Design
```go
// ❌ Primitive abuse
type Asset struct {
    ID int64 // what kind of ID?
}

// ✅ Semantic types
type AssetID = int64
type Asset struct {
    ID AssetID // clear intent
}
```

### Pointer Usage
- **ONLY use pointers when NIL is a valid value**
- ❌ Don't: `func GetUser() *User` returning struct with primitives
- ✅ Do: `func GetUser() User` and let stack handle it
- ❌ Avoid: Maps/slices of pointers unless NIL semantics needed

### Interface Design
```go
// ✅ Small, consumer-side interfaces
type UserRepository interface {
    GetUser(ctx context.Context, id UserID) (User, error)
}

// ✅ Compose larger interfaces
type UserService interface {
    UserRepository
    UserValidator
}

// ✅ Always add satisfaction checks
var _ UserRepository = (*PostgresUserRepository)(nil)
```

### Type Aliases vs New Types
- **9/10 times**: Create new types for proper separation
- **Type aliases**: Only when preventing abstraction leak between identical structs
- Avoids mapping overhead while maintaining boundaries

## Code Organization

### Package Structure
- ❌ Avoid `pkg/` prefix
- ❌ Avoid `internal/` except for testdata
- ✅ Let structure emerge from domain boundaries

### Abstraction Process
1. Build concrete implementation (even one `main.go`)
2. "Poke the problem with reality"
3. Delete prototype
4. Rebuild with understanding
5. Extract interfaces from actual usage patterns

### Project Context
- **Personal/Simple**: Keep concrete, move fast
- **Complex domains**: Structure after understanding emerges
- **Libraries**: Design for unknown use cases, optimize for performance

## Comments & Documentation

### Comment Style
- Lowercase, terse, minimal punctuation
- Focus on "why" not "what"
- Self-documenting code is sometimes "a fool's errand"

### When to Comment
**Package-level exports (godoc):**
- Exported functions/types: Brief description for godoc (OK to describe "what")
- Exported sentinel errors: Document what they represent
- Keep brief, let type signatures speak

**Inline comments:**
- ❌ Don't explain what the code does (code should be self-documenting)
- ✅ Do explain WHY decisions were made
- ✅ Do explain non-obvious business logic
- ✅ Do explain edge cases or constraints

**Examples:**
```go
// ❌ Bad - explains WHAT
// loop through users and check if active
for _, user := range users {
    if user.Active { ... }
}

// ✅ Good - explains WHY
// skip inactive users to avoid triggering their webhooks
for _, user := range users {
    if !user.Active {
        continue
    }
}

// ❌ Bad - obvious from function name
// ProcessUserInput processes user input
func ProcessUserInput() (ProberConfig, error)

// ✅ Good - explains constraint or returns sentinel errors
// ProcessUserInput parses flags and returns ErrUsageRequested on invalid input
func ProcessUserInput() (ProberConfig, error)
```

### Documentation Strategy
- **Library/SDK**: Comprehensive with examples
- **Internal code**: Minimal, focus on naming clarity
- Build first, document boundaries after understanding emerges

## Modern Go (Go 1.23+)

### Required Modern Syntax
```go
// ✅ Use range over int (Go 1.23+)
for i := range b.N {
    // work
}

// ❌ Old style
for i := 0; i < b.N; i++ {
    // work
}

// ✅ Use b.Loop() in benchmarks (Go 1.23+)
for b.Loop() {
    // benchmark work
}

// ❌ Old style
for i := 0; i < b.N; i++ {
    // benchmark work
}
```

## Testing

### Test Organization
```go
// ✅ Always use package_test
package mypackage_test

func TestService_GetUser(t *testing.T) {
    tests := []struct {
        name  string
        input UserID
        want  User
        error error // Use errors.Is for checking
    }{
        {
            name:  "successful get",
            input: validUserID,
            want:  expectedUser,
            // omit error field when nil - cleaner and more readable
        },
        {
            name:  "user not found",
            input: invalidUserID,
            want:  User{},
            error: ErrUserNotFound,
        },
    }
}
```

### Testing Philosophy
- **Always**: `package_test` to test exposed API
- **Prefer**: Table-driven tests
- **Love**: Contract tests for implementation conformity
- **Avoid**: Mocking (prefer fake in-memory implementations)
- **If mocking needed**: Use `moq` framework or `sql-mock` for drivers

### Test Field Conventions
- Use `error` field name (not `wantErr` or similar prefixes)
- **Omit nil error fields** - only specify `error` field when expecting an error
- Makes tests more readable - only error cases show the error field
- Reduces visual noise in test tables

### Test Comparison Functions
- **Always use `cmp.Compare[T]` for ordered types** - works for all cmp.Ordered types
- Prefer `cmp.Compare[int]`, `cmp.Compare[string]`, etc. over manual comparison functions
- More idiomatic, type-safe, and avoids overflow issues
- Single consistent approach for all ordered types

### Test Hierarchy
1. Real implementations (best)
2. Fake in-memory implementations
3. Mocks (avoid if possible)

### Context in Tests
- **Always use `t.Context()` for tests requiring context** (Go 1.23+)
- Automatically canceled when test completes
- Provides deadline awareness for better test timeout behavior
- Cleaner than `context.Background()` or manual cancellation

```go
// ✅ Good - use t.Context()
func TestService_FetchData(t *testing.T) {
    ctx := t.Context()
    result, err := service.FetchData(ctx)
    // ...
}

// ❌ Bad - using background context
func TestService_FetchData(t *testing.T) {
    ctx := context.Background()
    result, err := service.FetchData(ctx)
    // ...
}
```

### Time-Based Testing
- **Use `testing/synctest` for time-dependent tests** (Go 1.23+)
- Control time progression in tests without real delays
- Makes time-based tests fast and deterministic
- Essential for testing timeouts, retries, rate limiters

```go
func TestRateLimiter(t *testing.T) {
    synctest.Run(func() {
        limiter := NewRateLimiter(10, time.Second)

        // test immediate requests
        for range 10 {
            if !limiter.Allow() {
                t.Fatal("should allow within limit")
            }
        }

        // should be rate limited now
        if limiter.Allow() {
            t.Fatal("should be rate limited")
        }

        // advance time by 1 second
        synctest.Wait()
        time.Sleep(time.Second)

        // should be allowed again
        if !limiter.Allow() {
            t.Fatal("should allow after time window")
        }
    })
}
```

### Test Helpers and Data
- **Create `testdata` package for shared test utilities**
- Common test fixtures, builders, and assertions
- Keep test data and helpers separate from production code
- Makes tests more readable and maintainable

```go
// testdata/users.go
package testdata

func NewUserBuilder() *UserBuilder {
    return &UserBuilder{
        id:    1,
        email: "test@example.com",
        name:  "Test User",
    }
}

func (b *UserBuilder) WithEmail(email string) *UserBuilder {
    b.email = email
    return b
}

func (b *UserBuilder) Build() User {
    return User{
        ID:    b.id,
        Email: b.email,
        Name:  b.name,
    }
}

// Usage in tests
func TestUserService(t *testing.T) {
    user := testdata.NewUserBuilder().
        WithEmail("custom@example.com").
        Build()
    // ...
}
```

## Performance vs Readability

### Library Code
- Must be fast and bulletproof (unknown use cases)
- Learn from stdlib (e.g., `go stringer` techniques)
- Prevent panics at all costs: "I HATE PANICS"

### Application Code
- Prioritize readability and simplicity
- Optimize only when measured bottlenecks exist

## Anti-Patterns to Avoid

### Type System
- ❌ Pointer abuse for non-nullable fields
- ❌ One struct with `json:`, `db:`, `yaml:` tags (abstraction leak)
- ❌ `interface{}` instead of `any`
- ❌ Large interfaces (weak abstractions)

### Error Handling
- ❌ Logging every error occurrence
- ❌ "failed to" prefixes
- ❌ Error functions instead of variables for sentinels

### Code Organization
- ❌ Design-first interfaces
- ❌ Premature abstraction
- ❌ `pkg/` and `internal/` package prefixes

### Testing
- ❌ Testing internal implementation details
- ❌ Mockery-generated mocks
- ❌ Individual tests instead of table-driven

### Code Quality (CRITICAL - NO SLOPPINESS)
- ❌ Duplicated code in if/else branches
- ❌ if/else chains instead of early returns
- ❌ Not extracting common operations before/after conditionals

```go
// ❌ BAD - duplicated operation in both branches
if condition {
    doSomethingSpecific()
    commonOperation()
    return
}
doSomethingElse()
commonOperation()  // duplicated!

// ✅ GOOD - extract common operation
commonOperation()
if condition {
    doSomethingSpecific()
    return
}
doSomethingElse()

// ❌ BAD - if/else chains
if printer != nil {
    printer.PrintError(err)
} else {
    fmt.Fprintf(os.Stderr, err)
}

// ✅ GOOD - early return
if printer != nil {
    printer.PrintError(err)
    return
}
fmt.Fprintf(os.Stderr, err)
```

**Rule**: ALWAYS review code for duplication before submitting. Look for:
- Same operation in multiple branches → extract before/after conditional
- if/else blocks → convert to guard clauses with early returns
- Repeated code → DRY (Don't Repeat Yourself)

## Struct Design

### Field Ordering
1. Exported fields first
2. Internal fields with logical grouping
3. Size optimization for wire protocols

### Struct Tags
- Keep concerns separated - different structs for different layers
- JSON and DB tags on same struct = abstraction leak

## Domain Modeling

### Complex Domains
- Learn corner cases first
- Build for the 80% case
- Don't over-engineer for edge cases upfront

### Optional Fields
- Use variadic options pattern
- Initialize with sane defaults
- Avoid pointer abuse for optionality

## Remember

> "Errors tell a story" - build the narrative through wrapping
> "Poking the problem with reality" - understand before abstracting
> "Build for the 80%" - don't over-engineer edge cases
> "Scope-based naming is my jam" - smaller scope = shorter names
> "Interface emergence, not design-first" - feel the pain before abstracting
> "Be Comprehensive" - always check for duplication in branches, extract common operations, prefer early returns
