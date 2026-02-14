---
name: go-interfaces
description: "Go interface design - consumer-side definition, small interfaces, composition, and satisfaction checks. Use when designing abstractions, defining contracts, or refactoring dependencies."
---

# Go Interface Design

> "The larger the interface, the weaker the abstraction"

## Core Philosophy

- **Small interfaces** - Ideally 1 method, max 3-4
- **Consumer-side definition** - Define where used, not where implemented
- **Emergent, not design-first** - Extract from actual usage patterns
- **Interface duplication is OK** - Avoids import cycles
- **Accept interfaces, return structs** - Hide nothing from callers

---

## Accept Interfaces, Return Structs

```go
// ✅ GOOD - accept interface, return concrete
func NewService(repo UserReader) *Service {
    return &Service{repo: repo}
}

// ❌ BAD - return interface (hides concrete type)
func NewService(repo UserReader) ServiceInterface {
    return &Service{repo: repo}
}
```

**Why?** Returning concrete types:
- Allows callers to access all methods, not just interface subset
- Makes dependencies explicit
- Enables better IDE support and documentation

---

## Consumer-Side Definition

Define interfaces where they're used, not where they're implemented.

```go
// ✅ GOOD - Consumer defines what it needs
package http

type UserFinder interface {
    User(ctx context.Context, id UserID) (User, error)
}

type Handler struct {
    users UserFinder
}

func NewHandler(users UserFinder) *Handler {
    return &Handler{users: users}
}
```

```go
// ❌ BAD - Producer defines massive interface
package service

type UserServiceInterface interface {
    GetUser(id string) (*User, error)
    GetAllUsers() ([]*User, error)
    CreateUser(user *User) error
    UpdateUser(user *User) error
    DeleteUser(id string) error
}
// Forces all consumers to depend on methods they don't need
```

**Benefits:**
- Consumer only depends on what it uses
- Multiple consumers can have different interface shapes
- No cyclical import issues
- Smaller interfaces = simpler fakes for testing

---

## Interface Composition

Build larger interfaces from smaller ones. Real example from `pkg/cache`:

```go
type Reader[K comparable, V any] interface {
    Get(ctx context.Context, key K) (V, error)
    Len(ctx context.Context) (int, error)
}

type Writer[K comparable, V any] interface {
    Set(ctx context.Context, key K, value V) error
    Delete(ctx context.Context, key K) (bool, error)
    Clear(ctx context.Context) error
}

type ReadWriter[K comparable, V any] interface {
    Reader[K, V]
    Writer[K, V]
}

type Cache[K comparable, V any] interface {
    ReadWriter[K, V]
    Healthy() error
}
```

**Pattern:** Start with 1-method interfaces, compose as needed.

---

## Satisfaction Checks

Always add compile-time verification:

```go
var _ UserRepository = (*PostgresRepo)(nil)
var _ UserRepository = (*MemoryRepo)(nil)
var _ Cache[string, User] = (*MemoryCache[string, User])(nil)
```

**Benefits:**
- Compile-time verification
- Documents which interfaces a type satisfies
- Catches breaking changes early

---

## Interface Duplication is OK

Duplicating small interfaces across packages avoids import cycles:

```go
// package handlers
type Logger interface {
    Log(msg string, args ...any)
}

// package workers - duplicates, avoids importing handlers
type Logger interface {
    Log(msg string, args ...any)
}

// Both satisfied by same concrete type - no problem
```

---

## Generic Interface Patterns

### Option[T] - Variadic Configuration

From `pkg/options`:

```go
type Option[T any] func(*T)

func WithTimeout(d time.Duration) Option[Config] {
    return func(c *Config) {
        c.Timeout = d
    }
}

func WithRetries(n int) Option[Config] {
    return func(c *Config) {
        c.Retries = n
    }
}

func New(opts ...Option[Config]) *Service {
    cfg := Config{
        Timeout: 30 * time.Second,
        Retries: 3,
    }
    for _, opt := range opts {
        opt(&cfg)
    }
    return &Service{cfg: cfg}
}

// Usage
svc := New(
    WithTimeout(60 * time.Second),
    WithRetries(5),
)
```

### Cache[K, V] - Generic Data Access

From `pkg/cache`:

```go
type Cache[K comparable, V any] interface {
    Get(ctx context.Context, key K) (V, error)
    Set(ctx context.Context, key K, value V) error
    Delete(ctx context.Context, key K) (bool, error)
}

// Implementations: MemoryCache, FileCache, RedisCache
// All satisfy same interface with type safety
```

---

## When to Create Interfaces

### DO Create When:

**Multiple implementations exist:**
```go
type Cache[K comparable, V any] interface {
    Get(ctx context.Context, key K) (V, error)
    Set(ctx context.Context, key K, value V) error
}
// Memory, File, Redis implementations
```

**Testing requires substitution:**
```go
type UserStore interface {
    User(ctx context.Context, id UserID) (User, error)
}
// Real DB in prod, memory fake in tests
```

**External dependency boundaries:**
```go
type HTTPDoer interface {
    Do(req *http.Request) (*http.Response, error)
}
// Wrap http.Client for testing
```

### DON'T Create When:

**Only one implementation exists:**
```go
// ❌ BAD - premature abstraction
type ConfigLoaderInterface interface {
    LoadConfig() Config
}
// Just use the concrete type
```

**Designing upfront without usage patterns:**
```go
// ❌ BAD - design-first
type UserServiceInterface interface {
    // 15 methods you think you'll need
}
// Wait for patterns to emerge
```

---

## Interface Emergence Pattern

```go
// Step 1: Start concrete
type UserService struct {
    db *sql.DB
}

func (s *UserService) CreateUser(ctx context.Context, u User) (User, error) { ... }
func (s *UserService) User(ctx context.Context, id UserID) (User, error) { ... }
func (s *UserService) DeleteUser(ctx context.Context, id UserID) error { ... }

// Step 2: Observe usage - handler only calls User()
type Handler struct {
    svc *UserService
}

func (h *Handler) HandleGetUser(w http.ResponseWriter, r *http.Request) {
    user, err := h.svc.User(ctx, id)
    // ...
}

// Step 3: Extract interface from actual usage
type UserFinder interface {
    User(ctx context.Context, id UserID) (User, error)
}

type Handler struct {
    users UserFinder  // Abstracted based on actual needs
}
```

---

## Anti-Patterns

| Pattern | Why It's Wrong | Fix |
|---------|----------------|-----|
| `IUser` prefix | Hungarian notation | Descriptive name: `UserReader` |
| `UserInterface` suffix | Redundant | Just `User` or behavior name |
| 10+ method interface | Weak abstraction | Split into small interfaces |
| Producer-side interface | Forces unused deps | Consumer-side definition |
| Return interface from constructor | Hides concrete type | Return struct |
| `interface{}` / `any` catch-all | Loses type safety | Specific interface or generic |
| Design-first interfaces | Premature abstraction | Let patterns emerge |
| Generic Repository[T, ID] | Too abstract, design-first | Concrete per entity |

---

## Integration Notes

- **go-testing**: Small interfaces = simpler fakes, no mocking needed
- **go-error-handling**: Error interfaces stay small (just `error`)
- **pkg-usage**: Reuse interfaces from `pkg/cache`, `pkg/options` when applicable
