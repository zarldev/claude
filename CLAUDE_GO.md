# Bruno's Go Design Philosophy

See [CLAUDE.md](./CLAUDE.md) for universal principles (error philosophy, layer separation, testing philosophy).

This document covers Go-specific patterns and implementations.

## Go-Specific Principles

- **Interfaces**: Small (ideally 1 method), consumer-side definition, emergent not design-first. Exception: transactions require fat interfaces.
- **Types**: Semantic types (`type AssetID = int64`), pointer only when nil is valid
- **Modern Go**: Use Go 1.23+ features (range over int, slices/maps packages, cmp.Or)

## Naming Conventions

### Constants
- **Enums**: `PascalCase` with type prefix (e.g., `StatusPending`, `StatusActive`)
- **Simple constants**: `camelCase` (e.g., `wordsPerMinute`)

### Enums
Start at 1 so zero value is invalid (forces explicit initialization):
```go
type Status int

const (
    StatusPending Status = iota + 1  // 1
    StatusActive                      // 2
    StatusComplete                    // 3
)

// Zero value Status(0) is invalid - catches uninitialized bugs
```

Exception: when zero value is a meaningful default (e.g., `LogToStdout`).

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

### Semantic Types
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
// ✅ Small, consumer-side interfaces for normal operations
type UserGetter interface {
    GetUser(ctx context.Context, id UserID) (User, error)
}

// ✅ Compose when needed
type UserService interface {
    UserGetter
    UserCreator
}

// ✅ Always add satisfaction checks
var _ UserGetter = (*Postgres)(nil)
```

### Type Aliases vs New Types
```go
// Type alias (=) - same underlying type, interchangeable
type UserID = int64  // ✅ Use for semantic clarity without type barrier

// New type (no =) - distinct type, requires conversion
type UserID int64    // ✅ Use when you need type safety between layers
```

- **Type aliases (`=`)**: Use for semantic naming within a layer (e.g., `type UserID = int64`)
- **New types (no `=`)**: Use when crossing layer boundaries or when you need methods

### Struct Design
```go
// Field ordering
type User struct {
    // 1. Exported fields first
    ID    UserID
    Email string
    Name  string

    // 2. Internal fields with logical grouping
    createdAt time.Time
    updatedAt time.Time
}
```

- Keep concerns separated - different structs for different layers
- JSON and DB tags on same struct = abstraction leak

### Slices and Maps
```go
// ✅ Return nil for empty, not []T{}
if len(results) == 0 {
    return nil
}

// ✅ Check emptiness with len, not nil
if len(items) == 0 { }

// ✅ Zero-value slice is usable
var users []User
users = append(users, user)  // works fine
```

### Copy at Boundaries
Prevent external mutation by copying slices/maps when storing or returning:
```go
func (s *Store) SetItems(items []Item) {
    s.items = slices.Clone(items)
}

func (s *Store) GetItems() []Item {
    return slices.Clone(s.items)
}

func (s *Store) GetCache() map[string]Value {
    return maps.Clone(s.cache)
}
```

## Error Handling

### Never Use These Prefixes
- ❌ "failed to", "unable to", "could not", "error"
- ✅ Direct context: `fmt.Errorf("open file: %w", err)`

### Sentinel Errors
```go
// Function-specific: Err{FunctionName}{ErrorType}
var (
    ErrParseValue  = errors.New("parse value")
    ErrParseSource = errors.New("parse source")
)

// Generic (reusable across functions)
var (
    ErrNotFound = errors.New("not found")
    ErrConflict = errors.New("conflict")
)

// Wrap with context (Go 1.20+ supports multiple %w)
if err := parser.Parse(ctx, source); err != nil {
    return fmt.Errorf("%w: %w", ErrParseSource, err)
}
```

### Logging Strategy
- Never log every error occurrence
- Log once at application boundaries with full context
- Let error chain build the story through the stack

## Modern Go (Go 1.23+)

### Range Over Int
```go
for i := range 10 {
    // work
}
```

### Benchmark Loops
```go
for b.Loop() {
    // benchmark work
}
```

### Slices Package
Use `slices` for common operations - cleaner, safer, often faster:

```go
slices.Contains(items, target)
slices.Sort(items)
slices.SortFunc(users, func(a, b User) int {
    return cmp.Compare(a.Name, b.Name)
})
slices.Reverse(items)
slices.Clone(items)
slices.Equal(a, b)
slices.Index(items, target)
```

### Maps Package
```go
maps.Clone(m)
maps.Copy(dst, src)
maps.Equal(a, b)
maps.Keys(m)    // returns iter.Seq[K]
maps.Values(m)  // returns iter.Seq[V]

// collect keys into slice
keys := slices.Collect(maps.Keys(m))
```

### Cmp Package
```go
// compare ordered types - returns -1, 0, or 1
cmp.Compare(a, b)

// chain comparisons for multi-field sorting
slices.SortFunc(users, func(a, b User) int {
    if c := cmp.Compare(a.LastName, b.LastName); c != 0 {
        return c
    }
    return cmp.Compare(a.FirstName, b.FirstName)
})

// cmp.Or returns first non-zero value - great for defaults
name := cmp.Or(cfg.Name, env.Name, "default")
timeout := cmp.Or(cfg.Timeout, 30*time.Second)
```

## Code Organization

### Package Structure
- ❌ Avoid `pkg/` prefix
- ❌ Avoid `internal/` - Go's `testdata/` is special regardless of location
- ✅ Let structure emerge from domain boundaries

See [CLAUDE.md](./CLAUDE.md) for Abstraction Process and Project Context guidance.

### Domain Modeling
- Learn corner cases first, build for the 80% case
- Don't over-engineer for edge cases upfront
- Use variadic options pattern for optional fields
- Initialize with sane defaults

### Program Structure
- Exit only in `main()` - use `os.Exit(app.Run())` pattern
- Avoid `init()` - prefer explicit initialization
- See [App Lifecycle](#app-lifecycle) for full pattern

## Configuration

### Environment-Based Config
```go
// config/config.go
package config

type Config struct {
    Repository RepositoryConfig
    Server     ServerConfig
    Transport  TransportConfig
}

type RepositoryConfig struct {
    Type        string // "memory", "sqlite", "postgres"
    PostgresURL string
    SQLitePath  string
}

type ServerConfig struct {
    Port         int
    ReadTimeout  time.Duration
    WriteTimeout time.Duration
}

type TransportConfig struct {
    Type    string // "http", "grpc"
    BaseURL string
}

func Load() Config {
    return Config{
        Repository: RepositoryConfig{
            Type:        getEnv("REPOSITORY_TYPE", "memory"),
            PostgresURL: getEnv("POSTGRES_URL", ""),
            SQLitePath:  getEnv("SQLITE_PATH", "data.db"),
        },
        Server: ServerConfig{
            Port:         getEnv("SERVER_PORT", 8080),
            ReadTimeout:  getEnv("SERVER_READ_TIMEOUT", 30*time.Second),
            WriteTimeout: getEnv("SERVER_WRITE_TIMEOUT", 30*time.Second),
        },
        Transport: TransportConfig{
            Type:    getEnv("TRANSPORT_TYPE", "http"),
            BaseURL: getEnv("TRANSPORT_BASE_URL", ""),
        },
    }
}
```

### Generic Environment Helper
```go
func getEnv[T any](key string, defaultVal T) T {
    v := os.Getenv(key)
    if v == "" {
        return defaultVal
    }

    var result any
    switch any(defaultVal).(type) {
    case string:
        result = v
    case int:
        n, err := strconv.Atoi(v)
        if err != nil {
            return defaultVal
        }
        result = n
    case bool:
        b, err := strconv.ParseBool(v)
        if err != nil {
            return defaultVal
        }
        result = b
    case time.Duration:
        d, err := time.ParseDuration(v)
        if err != nil {
            return defaultVal
        }
        result = d
    default:
        return defaultVal
    }
    return result.(T)
}
```

## App Lifecycle

### Run Pattern
```go
// app/app.go
package app

type closer struct {
    name string
    c    io.Closer
}

// serverCloser wraps http.Server to implement io.Closer with timeout
type serverCloser struct{ *http.Server }

func (s *serverCloser) Close() error {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    return s.Shutdown(ctx)
}

type App struct {
    closers []closer
}

func New() *App {
    return &App{}
}

// track registers a closer to be closed on shutdown (LIFO order)
func (a *App) track(name string, c io.Closer) {
    a.closers = append(a.closers, closer{name: name, c: c})
}

// close all tracked resources in reverse order
func (a *App) close(ctx context.Context) error {
    var errs []error
    for i := len(a.closers) - 1; i >= 0; i-- {
        r := a.closers[i]
        slog.InfoContext(ctx, "closing", "resource", r.name)
        if err := r.c.Close(); err != nil {
            slog.ErrorContext(ctx, "close failed", "resource", r.name, "error", err)
            errs = append(errs, err)
        }
    }
    return errors.Join(errs...)
}

func (a *App) Run() int {
    cfg := config.Load()

    ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer stop()

    repo, err := repository.New(ctx, cfg.Repository)
    if err != nil {
        slog.ErrorContext(ctx, "init repository", "error", err)
        return 1
    }
    a.track("repository", repo)

    server := newServer(cfg.Server, repo)
    a.track("server", &serverCloser{server})

    errCh := make(chan error, 1)
    go func() {
        errCh <- server.ListenAndServe()
    }()

    select {
    case err := <-errCh:
        slog.ErrorContext(ctx, "server error", "error", err)
        a.close(ctx)
        return 1
    case <-ctx.Done():
        if err := a.close(ctx); err != nil {
            return 1
        }
        return 0
    }
}
```

### Main
```go
// main.go
func main() {
    os.Exit(app.New().Run())
}
```

## Embedding Frontend

For monorepo with React frontend. See [CLAUDE.md](./CLAUDE.md) for overall architecture.

### Embed Declaration
```go
// frontend.go (at repo root, next to go.mod)
package main

import "embed"

//go:embed all:frontend/dist
var frontendFS embed.FS
```

### SPA Handler
Serve static files with fallback to `index.html` for client-side routing:
```go
// spa.go
package main

import (
    "fmt"
    "io"
    "io/fs"
    "net/http"
    "strings"
)

// spaHandler serves static files, falling back to index.html for SPA routing
func spaHandler() http.Handler {
    dist, err := fs.Sub(frontendFS, "frontend/dist")
    if err != nil {
        panic(fmt.Sprintf("frontend dist: %v", err))
    }

    fileServer := http.FileServer(http.FS(dist))

    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // try to serve the file directly
        f, err := dist.Open(strings.TrimPrefix(r.URL.Path, "/"))
        if err == nil {
            f.Close()
            fileServer.ServeHTTP(w, r)
            return
        }

        // file not found - serve index.html for SPA routing
        index, err := dist.Open("index.html")
        if err != nil {
            http.Error(w, "index.html not found", http.StatusInternalServerError)
            return
        }
        defer index.Close()

        w.Header().Set("Content-Type", "text/html; charset=utf-8")
        // error only occurs if client disconnects - nothing to do
        _, _ = io.Copy(w, index)
    })
}
```

### Mounting in Server
```go
func (a *App) Run() int {
    // ... setup

    mux := http.NewServeMux()

    // API routes first (more specific)
    mux.Handle("/api/", apiHandler)
    mux.Handle("/connect/", connectHandler)

    // frontend catches everything else
    mux.Handle("/", spaHandler())

    // ... start server
}
```

### Build Integration
```makefile
.PHONY: build generate frontend

generate:
	buf generate proto

frontend:
	cd frontend && npm run build

build: generate frontend
	go build -o bin/server ./cmd/server

run: build
	./bin/server
```

### buf.gen.yaml
Generate both Go and TypeScript from protos:
```yaml
version: v2
plugins:
  # Go server
  - remote: buf.build/connectrpc/go
    out: transport/grpc/gen
    opt: paths=source_relative
  - remote: buf.build/protocolbuffers/go
    out: transport/grpc/gen
    opt: paths=source_relative
  # TypeScript client
  - remote: buf.build/bufbuild/es
    out: frontend/src/gen
  - remote: buf.build/connectrpc/es
    out: frontend/src/gen
```

## Repository Pattern

Implementation-agnostic data access with SQLC for generation.

### Package Structure
```
repository/
├── repository.go      # interfaces + errors + types
├── memory.go          # in-memory implementation
├── sqlite.go          # SQLite implementation
├── postgres.go        # Postgres implementation
├── contract_test.go   # contract tests for all implementations
└── gen/
    ├── sqlite/        # SQLC generated
    └── postgres/      # SQLC generated
```

### Repository Errors
```go
// repository/repository.go
package repository

import "errors"

// repository-level errors - all implementations must return these
var (
    ErrNotFound      = errors.New("not found")
    ErrAlreadyExists = errors.New("already exists")
    ErrConflict      = errors.New("conflict")
)

type UserID = int64

type User struct {
    ID    UserID
    Email string
    Name  string
}
```

### Implementation Pattern
```go
// repository/postgres.go
func (p *Postgres) GetUser(ctx context.Context, id UserID) (User, error) {
    row, err := p.q.GetUser(ctx, int64(id))
    if errors.Is(err, pgx.ErrNoRows) {
        return User{}, ErrNotFound  // map driver error to repository error
    }
    if err != nil {
        return User{}, fmt.Errorf("query user: %w", err)
    }
    return toUser(row), nil
}

var _ UserRepository = (*Postgres)(nil)
```

### Transactions (Exception to Small Interfaces)
Transactions inherently need multiple operations - that's the whole point. Accept the fat interface in transaction callbacks:

```go
// fat interface is acceptable here - transactions are cross-cutting by definition
func (p *Postgres) WithTx(ctx context.Context, fn func(UserRepository) error) error {
    tx, err := p.pool.Begin(ctx)
    if err != nil {
        return fmt.Errorf("begin tx: %w", err)
    }
    defer tx.Rollback(ctx)

    txRepo := &Postgres{pool: p.pool, q: p.q.WithTx(tx)}

    if err := fn(txRepo); err != nil {
        return err
    }

    return tx.Commit(ctx)
}
```

### Factory
```go
// repository/repository.go
func New(ctx context.Context, cfg config.RepositoryConfig) (UserRepository, error) {
    switch cfg.Type {
    case "memory":
        return NewMemory(), nil
    case "sqlite":
        return NewSQLite(cfg.SQLitePath)
    case "postgres":
        return NewPostgres(ctx, cfg.PostgresURL)
    default:
        return nil, fmt.Errorf("unknown repository type: %s", cfg.Type)
    }
}
```

### Contract Tests
```go
// repository/contract_test.go
package repository_test

func runContractTests(t *testing.T, newRepo func() repository.UserRepository) {
    t.Run("GetUser returns ErrNotFound for missing user", func(t *testing.T) {
        repo := newRepo()
        _, err := repo.GetUser(t.Context(), 999)
        if !errors.Is(err, repository.ErrNotFound) {
            t.Errorf("got %v, want ErrNotFound", err)
        }
    })
}

func TestMemory(t *testing.T)   { runContractTests(t, newMemory) }
func TestSQLite(t *testing.T)   { runContractTests(t, newSQLite) }
func TestPostgres(t *testing.T) { runContractTests(t, newPostgres) }
```

## Service Layer

Business logic lives here. Services define consumer-side interfaces for their dependencies and their own errors.

Each layer defines its own types - no shared `domain` package. Repository types live in `repository/`, HTTP request/response structs live in `transport/http/`, etc. Map between layers at boundaries.

### Service Errors
```go
// service/service.go
package service

import "errors"

// service-level errors - transport layer maps these to HTTP/gRPC codes
var (
    ErrNotFound     = errors.New("not found")
    ErrInvalidInput = errors.New("invalid input")
    ErrUnauthorized = errors.New("unauthorized")
    ErrForbidden    = errors.New("forbidden")
    ErrConflict     = errors.New("conflict")
)
```

### Service Types
```go
// service defines its own types - no tags, only business-relevant fields
type UserID = int64

type User struct {
    ID    UserID
    Email string
    Name  string
}

// map from repository type to service type
func toUser(u repository.User) User {
    return User{
        ID:    UserID(u.ID),
        Email: u.Email,
        Name:  u.Name,
    }
}
```

### Consumer-Side Interfaces
```go
// interface uses repository types - that's what implementations return
type UserGetter interface {
    GetUser(ctx context.Context, id repository.UserID) (repository.User, error)
}

type Service struct {
    users UserGetter
}

// service must know repository errors to map them - this coupling is acceptable
func (s *Service) GetUser(ctx context.Context, id UserID) (User, error) {
    repoUser, err := s.users.GetUser(ctx, repository.UserID(id))
    if errors.Is(err, repository.ErrNotFound) {
        return User{}, ErrNotFound
    }
    if err != nil {
        return User{}, fmt.Errorf("get user: %w", err)
    }
    return toUser(repoUser), nil
}
```

## Transport Pattern

Same philosophy as Repository - implementation-agnostic errors and types. Use ConnectRPC for gRPC, plain HTTP for WebSocket/SSE.

### Error Flow
```
Servers (outbound):
  Repository errors → Service errors → HTTP/gRPC codes

Clients (inbound):
  HTTP/gRPC codes → Transport errors → Consumer handles
```

**Servers** map service errors to wire format. **Clients** map wire format to transport errors.

### Package Structure
```
transport/
├── transport.go         # errors + types
├── http/
│   ├── client.go        # HTTP client
│   └── server.go        # HTTP handlers
└── grpc/
    ├── client.go        # ConnectRPC client
    ├── server.go        # ConnectRPC handlers
    └── gen/             # buf generated
```

### Transport Errors (for clients)
```go
// transport/transport.go
var (
    ErrUnauthenticated  = errors.New("unauthenticated")
    ErrPermissionDenied = errors.New("permission denied")
    ErrInvalidArgument  = errors.New("invalid argument")
    ErrNotFound         = errors.New("not found")
    ErrAlreadyExists    = errors.New("already exists")
    ErrRateLimited      = errors.New("rate limited")
    ErrUnavailable      = errors.New("service unavailable")
)
```

### Client Pattern (maps wire → transport errors)
```go
// transport layer defines its own types
type UserID = int64
type User struct {
    ID    UserID `json:"id"`
    Email string `json:"email"`
    Name  string `json:"name"`
}

func (c *Client) GetUser(ctx context.Context, id UserID) (User, error) {
    url := c.baseURL + "/users/" + strconv.FormatInt(id, 10)
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return User{}, fmt.Errorf("create request: %w", err)
    }
    resp, err := c.http.Do(req)
    if err != nil {
        return User{}, fmt.Errorf("do request: %w", err)
    }
    defer resp.Body.Close()

    if err := httpErr(resp.StatusCode); err != nil {
        return User{}, err
    }
    // decode response...
}

func httpErr(status int) error {
    switch status {
    case http.StatusOK, http.StatusCreated, http.StatusNoContent:
        return nil
    case http.StatusNotFound:
        return ErrNotFound // from transport package
    case http.StatusUnauthorized:
        return ErrUnauthenticated
    // ... other mappings
    default:
        return fmt.Errorf("unexpected status: %d", status)
    }
}
```

### Server Pattern (maps service errors → wire)
```go
// server response types with json tags
type UserResponse struct {
    ID    int64  `json:"id"`
    Email string `json:"email"`
    Name  string `json:"name"`
}

func toUserResponse(u service.User) UserResponse {
    return UserResponse{ID: int64(u.ID), Email: u.Email, Name: u.Name}
}

func (s *Server) getUser(w http.ResponseWriter, r *http.Request) {
    id, err := strconv.ParseInt(r.PathValue("id"), 10, 64) // Go 1.22+
    if err != nil {
        writeErr(w, service.ErrInvalidInput)
        return
    }
    user, err := s.svc.GetUser(r.Context(), service.UserID(id))
    if err != nil {
        writeErr(w, err)
        return
    }
    writeJSON(w, http.StatusOK, toUserResponse(user))
}

func writeErr(w http.ResponseWriter, err error) {
    status := http.StatusInternalServerError
    switch {
    case errors.Is(err, service.ErrNotFound):
        status = http.StatusNotFound
    case errors.Is(err, service.ErrInvalidInput):
        status = http.StatusBadRequest
    case errors.Is(err, service.ErrUnauthorized):
        status = http.StatusUnauthorized
    case errors.Is(err, service.ErrForbidden):
        status = http.StatusForbidden
    case errors.Is(err, service.ErrConflict):
        status = http.StatusConflict
    }
    http.Error(w, err.Error(), status)
}
```

ConnectRPC follows the same pattern:
```go
func connectErr(err error) error {
    switch {
    case errors.Is(err, service.ErrNotFound):
        return connect.NewError(connect.CodeNotFound, err)
    case errors.Is(err, service.ErrInvalidInput):
        return connect.NewError(connect.CodeInvalidArgument, err)
    case errors.Is(err, service.ErrUnauthorized):
        return connect.NewError(connect.CodeUnauthenticated, err)
    default:
        return connect.NewError(connect.CodeInternal, err)
    }
}
```

### Client Factory
```go
// transport/transport.go
func NewClient(cfg config.TransportConfig) (UserClient, error) {
    switch cfg.Type {
    case "http":
        return http.NewClient(cfg.BaseURL), nil
    case "grpc":
        return grpc.NewClient(cfg.BaseURL)
    default:
        return nil, fmt.Errorf("unknown transport type: %s", cfg.Type)
    }
}
```

## Testing

### Philosophy
- **Always**: `package_test` to test exposed API
- **Prefer**: Table-driven tests
- **Love**: Contract tests for implementation conformity
- **Avoid**: Mocking (prefer in-memory implementations)
- **If mocking needed**: Use `moq` framework or `sql-mock` for drivers

### Test Hierarchy
1. Real implementations (best)
2. In-memory implementations with seed data (primary test double)
3. Mocks (avoid if possible)

### Table-Driven Tests
```go
package service_test

func TestService_GetUser(t *testing.T) {
    tests := []struct {
        name string
        id   service.UserID
        want service.User
        err  error // omit when nil - cleaner
    }{
        {
            name: "successful get",
            id:   1,
            want: service.User{ID: 1, Email: "test@example.com", Name: "Test User"},
        },
        {
            name: "user not found",
            id:   999,
            err:  service.ErrNotFound,
        },
    }

    // seed repository with repository types
    repo := repository.NewMemory(repository.WithUsers(testdata.RepoValidUser))
    svc := service.New(repo)

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := svc.GetUser(t.Context(), tt.id)
            if !errors.Is(err, tt.err) {
                t.Errorf("err = %v, want %v", err, tt.err)
            }
            if got != tt.want {
                t.Errorf("got = %v, want %v", got, tt.want)
            }
        })
    }
}
```

### Context in Tests
Always use `t.Context()` for tests requiring context - auto-canceled when test completes, provides deadline awareness:

```go
func TestService_FetchData(t *testing.T) {
    ctx := t.Context()
    result, err := service.FetchData(ctx)
    // ...
}

// ❌ Bad - context.Background() has no cancellation or deadline
func TestService_FetchData(t *testing.T) {
    ctx := context.Background()
    // ...
}
```

### Time-Based Testing with synctest
Use `testing/synctest` for deterministic time-dependent tests - no flaky sleeps, no slow tests:

```go
func TestRateLimiter(t *testing.T) {
    synctest.Run(func() {
        limiter := NewRateLimiter(10, time.Second)

        // exhaust the limit
        for range 10 {
            if !limiter.Allow() {
                t.Fatal("should allow within limit")
            }
        }

        // should be rate limited
        if limiter.Allow() {
            t.Fatal("should be rate limited")
        }

        // advance time - no actual waiting
        synctest.Wait()
        time.Sleep(time.Second)

        // should be allowed again
        if !limiter.Allow() {
            t.Fatal("should allow after window reset")
        }
    })
}
```

Essential for testing: timeouts, retries, rate limiters, caches with TTL, debouncing.

### Test Helpers
Create `testdata` package for seed data. Use layer-prefixed names since types differ per layer:
```go
// testdata/users.go
package testdata

import "myapp/repository"

// repository layer seed data
var (
    RepoValidUser = repository.User{ID: 1, Email: "test@example.com", Name: "Test User"}
    RepoAdminUser = repository.User{ID: 2, Email: "admin@example.com", Name: "Admin"}
)
```

In-memory implementations accept functional options for seeding:
```go
// repository/memory.go
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

func (m *Memory) GetUser(ctx context.Context, id UserID) (User, error) {
    m.mu.RLock()
    defer m.mu.RUnlock()
    user, ok := m.users[id]
    if !ok {
        return User{}, ErrNotFound
    }
    return user, nil
}

func WithUsers(users ...User) func(*Memory) {
    return func(m *Memory) {
        for _, u := range users {
            m.users[u.ID] = u
        }
    }
}

// usage in tests
repo := repository.NewMemory(repository.WithUsers(testdata.RepoValidUser))
```

## Performance

### Library Code
- Must be fast and bulletproof (unknown use cases)
- Learn from stdlib patterns
- Prevent panics at all costs

### Application Code
- Prioritize readability and simplicity
- Optimize only when measured bottlenecks exist

### Pre-allocate When Size Known
```go
// ✅ Slices - avoids reallocations during append
users := make([]User, 0, len(ids))
for _, id := range ids {
    users = append(users, getUser(id))
}

// ✅ Maps - avoids rehashing
cache := make(map[string]Value, len(items))
```

### Prefer strconv Over fmt
```go
// ✅ Fast - 64ns, 1 alloc
s := strconv.Itoa(i)

// ❌ Slow - 143ns, 2 allocs
s := fmt.Sprint(i)
```

## Concurrency

### Don't Embed Mutexes
```go
// ❌ Bad - exposes Lock/Unlock in public API
type Cache struct {
    sync.Mutex
    data map[string]string
}

// ✅ Good - mutex is implementation detail
type Cache struct {
    mu   sync.Mutex
    data map[string]string
}
```

### Channel Buffer Size
Channels should be unbuffered (0) or size 1. Larger buffers need justification:
```go
done := make(chan struct{})    // unbuffered - synchronization
items := make(chan Item, 1)    // size 1 - handoff

// ❌ Avoid without clear reasoning
queue := make(chan Task, 100)
```

### Goroutine Lifecycle
Never fire-and-forget. Every goroutine must have a way to stop and be waited on:
```go
type Worker struct {
    stop chan struct{}
    done chan struct{}
}

func NewWorker() *Worker {
    w := &Worker{
        stop: make(chan struct{}),
        done: make(chan struct{}),
    }
    go w.run()
    return w
}

func (w *Worker) run() {
    defer close(w.done)
    ticker := time.NewTicker(time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            w.doWork()
        case <-w.stop:
            return
        }
    }
}

func (w *Worker) Shutdown() {
    close(w.stop)
    <-w.done
}
```

For multiple goroutines, use `sync.WaitGroup`:
```go
var wg sync.WaitGroup
for range workers {
    wg.Add(1)
    go func() {
        defer wg.Done()
        // work
    }()
}
wg.Wait()
```

## Anti-Patterns

See [CLAUDE.md](./CLAUDE.md) for universal anti-patterns. Go-specific:

- ❌ Pointer abuse for non-nullable fields
- ❌ One struct with `json:`, `db:`, `yaml:` tags (abstraction leak)
- ❌ `interface{}` instead of `any`
- ❌ Large interfaces for normal operations (transactions excepted)
- ❌ `pkg/` prefix
- ❌ `internal/` directory
- ❌ Embedded mutexes (exposes Lock/Unlock)
- ❌ Fire-and-forget goroutines
- ❌ Mockery-generated mocks
- ❌ Individual tests instead of table-driven
