---
name: go-testing
description: "Go testing patterns - table-driven tests, fakes over mocks, contract testing, synctest for time. Use when writing tests, creating test fixtures, or setting up test infrastructure."
---

# Go Testing Patterns

> "Real implementations > In-memory fakes > Never mocks"

## Core Philosophy

- **Always `package_test`** - Test the exposed API, not internals
- **Table-driven tests** - Comprehensive, readable test cases
- **In-memory fakes over mocks** - Simple implementations, not mock frameworks
- **Contract tests** - All implementations satisfy same interface
- **Omit nil error fields** - Cleaner test tables
- **`t.Context()` everywhere** - Auto-cancellation on test completion

---

## Package Structure

```go
// ALWAYS use package_test suffix
package mypackage_test

import (
    "testing"

    "github.com/zarldev/zarlmono/mypackage"
)

// Forces testing the exposed API
// Cannot access unexported fields/methods
// Tests what consumers actually see
```

---

## Table-Driven Tests

```go
func TestService_CreateUser(t *testing.T) {
    svc := setupService(t)

    tests := []struct {
        name  string
        input CreateUserRequest
        want  User
        err error // only specify when expecting error
    }{
        {
            name: "valid user",
            input: CreateUserRequest{
                Name:  "John",
                Email: "john@example.com",
            },
            want: User{
                Name:  "John",
                Email: "john@example.com",
            },
            // error field omitted - cleaner when nil
        },
        {
            name: "empty name",
            input: CreateUserRequest{
                Name:  "",
                Email: "john@example.com",
            },
            err: ErrEmptyName,
        },
        {
            name: "invalid email",
            input: CreateUserRequest{
                Name:  "John",
                Email: "invalid",
            },
            err: ErrInvalidEmail,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := svc.CreateUser(t.Context(), tt.input)

            // check error with errors.Is
            if tt.err != nil {
                if !errors.Is(err, tt.err) {
                    t.Errorf("got error %v, want %v", err, tt.error)
                }
                return
            }

            if err != nil {
                t.Fatalf("unexpected error: %v", err)
            }

            if diff := cmp.Diff(tt.want, got); diff != "" {
                t.Errorf("mismatch (-want +got):\n%s", diff)
            }
        })
    }
}
```

**Key patterns:**
- Omit `err` field when expecting success
- Use `errors.Is()` for sentinel error checking
- Use `cmp.Diff()` for struct comparison
- Always use `t.Context()` not `context.Background()`

---

## Test Hierarchy

```
1. Real implementations (best)
   └── Actual database, actual services

2. In-memory fakes (preferred for unit tests)
   └── Simple map-based implementations

3. Mocks (avoid - only for driver-level testing)
   └── sql-mock for database drivers only
```

---

## In-Memory Fake Pattern

```go
// repository/memory.go - simple in-memory implementation
type Memory struct {
    mu    sync.RWMutex
    users map[UserID]User
}

func NewMemory(opts ...func(*Memory)) *Memory {
    m := &Memory{users: make(map[UserID]User)}
    for _, opt := range opts {
        opt(m)
    }
    return m
}

// Functional option for seeding test data
func WithUsers(users ...User) func(*Memory) {
    return func(m *Memory) {
        for _, u := range users {
            m.users[u.ID] = u
        }
    }
}

func (m *Memory) User(ctx context.Context, id UserID) (User, error) {
    select {
    case <-ctx.Done():
        return User{}, ErrCanceled
    default:
    }

    m.mu.RLock()
    defer m.mu.RUnlock()

    user, exists := m.users[id]
    if !exists {
        return User{}, ErrNotFound
    }
    return user, nil
}

func (m *Memory) CreateUser(ctx context.Context, u User) (User, error) {
    select {
    case <-ctx.Done():
        return User{}, ErrCanceled
    default:
    }

    m.mu.Lock()
    defer m.mu.Unlock()

    if _, exists := m.users[u.ID]; exists {
        return User{}, ErrAlreadyExists
    }
    m.users[u.ID] = u
    return u, nil
}
```

**Using in tests:**

```go
func TestUserService(t *testing.T) {
    repo := repository.NewMemory(
        repository.WithUsers(
            User{ID: "1", Name: "Test User"},
        ),
    )

    svc := service.NewUserService(repo)

    user, err := svc.User(t.Context(), "1")
    if err != nil {
        t.Fatal(err)
    }

    if user.Name != "Test User" {
        t.Errorf("got %s, want Test User", user.Name)
    }
}
```

---

## Contract Tests

Test all implementations against the same interface:

```go
func TestRepository(t *testing.T) {
    implementations := []struct {
        name string
        new  func(t *testing.T) Repository
    }{
        {"memory", func(t *testing.T) Repository { return NewMemory() }},
        {"postgres", func(t *testing.T) Repository { return newTestPostgres(t) }},
    }

    for _, impl := range implementations {
        t.Run(impl.name, func(t *testing.T) {
            repo := impl.new(t)

            t.Run("User", func(t *testing.T) {
                testRepositoryUser(t, repo)
            })

            t.Run("CreateUser", func(t *testing.T) {
                testRepositoryCreateUser(t, repo)
            })
        })
    }
}

func testRepositoryUser(t *testing.T, repo Repository) {
    // test not found returns sentinel
    _, err := repo.User(t.Context(), "nonexistent")
    if !errors.Is(err, ErrNotFound) {
        t.Errorf("expected ErrNotFound, got %v", err)
    }

    // test found
    created, _ := repo.CreateUser(t.Context(), User{ID: "1", Name: "Test"})
    found, err := repo.User(t.Context(), created.ID)
    if err != nil {
        t.Fatalf("expected no error, got %v", err)
    }
    if found.Name != "Test" {
        t.Errorf("got %s, want Test", found.Name)
    }
}
```

---

## Test Helpers

```go
func setupService(t *testing.T) *Service {
    t.Helper()

    repo := repository.NewMemory()
    cache := cache.NewMemory[UserID, User]()

    return NewService(repo, cache)
}

func mustCreateUser(t *testing.T, svc *Service, name string) User {
    t.Helper()

    user, err := svc.CreateUser(t.Context(), CreateUserRequest{
        Name:  name,
        Email: name + "@example.com",
    })
    if err != nil {
        t.Fatalf("create user: %v", err)
    }
    return user
}
```

---

## t.Context() - Always Use It

```go
// ✅ GOOD - auto-canceled when test completes/times out
func TestService(t *testing.T) {
    result, err := service.FetchData(t.Context())
    // context canceled if test times out or fails
}

// ❌ BAD - no cancellation, can leak goroutines
func TestService(t *testing.T) {
    ctx := context.Background()
    result, err := service.FetchData(ctx)
}
```

**Benefits:**
- Auto-cancels on test completion
- Auto-cancels on test timeout
- Prevents goroutine leaks
- Matches production context patterns

---

## Time-Based Testing with synctest

For testing time-dependent code without actual waiting (Go 1.24+):

```go
func TestRateLimiter(t *testing.T) {
    synctest.Run(func() {
        limiter := NewRateLimiter(10, time.Second)

        // exhaust limit
        for range 10 {
            if !limiter.Allow() {
                t.Fatal("should allow within limit")
            }
        }

        // should be rate limited
        if limiter.Allow() {
            t.Fatal("should be rate limited")
        }

        // advance virtual time - no actual waiting!
        time.Sleep(time.Second)
        synctest.Wait()

        // should be allowed again
        if !limiter.Allow() {
            t.Fatal("should allow after reset")
        }
    })
}
```

**Testing context timeouts with synctest:**

```go
func TestOperationTimeout(t *testing.T) {
    synctest.Run(func() {
        ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
        defer cancel()

        resultCh := make(chan Result)
        go func() {
            result := slowOperation()
            resultCh <- result
        }()

        // advance time past timeout
        time.Sleep(6 * time.Second)
        synctest.Wait()

        select {
        case <-ctx.Done():
            // expected - timeout triggered
        case <-resultCh:
            t.Fatal("should have timed out")
        }
    })
}
```

**Key points:**
- `synctest.Run()` creates fake time environment
- `time.Sleep()` advances virtual time instantly
- `synctest.Wait()` lets goroutines process
- Tests run in milliseconds, not real time

---

## Comparison Functions

```go
// cmp.Diff for structs
if diff := cmp.Diff(want, got); diff != "" {
    t.Errorf("mismatch (-want +got):\n%s", diff)
}

// slices.Equal for simple slices
if !slices.Equal(got, want) {
    t.Errorf("got %v, want %v", got, want)
}

// errors.Is for sentinel errors
if !errors.Is(err, ErrNotFound) {
    t.Errorf("got %v, want ErrNotFound", err)
}
```

---

## Anti-Patterns

| Pattern | Why It's Wrong | Fix |
|---------|----------------|-----|
| Using mocks (moq, mockery) | Brittle, test implementation not behavior | In-memory fake |
| `context.Background()` in tests | No cancellation, goroutine leaks | `t.Context()` |
| Testing unexported functions | Tests internals, not API | `package_test`, test exports |
| `wantErr bool` field | Less precise than sentinel | `err error` with `errors.Is` |
| Real `time.Sleep` in tests | Slow, flaky | `synctest` for time-based tests |
| Not using `t.Helper()` | Bad error line numbers | Add `t.Helper()` to helpers |
| Individual tests not table-driven | Verbose, hard to add cases | Table-driven tests |
| Comparing errors with `==` | Misses wrapped errors | `errors.Is()` |

---

## Integration Notes

- **go-error-handling**: Test sentinel errors with `errors.Is(err, ErrExpected)`
- **go-interfaces**: Small interfaces = simple fakes, no mocking needed
- **pkg-usage**: Use `cache.NewMemory[K,V]()` from pkg/cache for test caches
