---
name: database-patterns
description: Database and repository patterns for PostgreSQL, MongoDB, and SQLite. Use when working with repositories, migrations, sqlc, or database queries.
triggers:
  keywords:
    - database
    - repository
    - migration
    - sqlc
    - postgres
    - sqlite
    - mongodb
  pathPatterns:
    - "**/migrations/*.sql"
    - "**/queries/*.sql"
    - "**/sqlc.yaml"
    - "**/repository/*.go"
  contentPatterns:
    - "pgxpool"
    - "sqlc"
    - "goose"
    - "ErrNoRows"
  intentPatterns:
    - "(?:create|add).*(?:migration|table)"
    - "(?:database|db).*(?:query|pattern)"
priority: 7
related-skills:
  - go-error-handling
  - go-testing
  - go-interfaces
---

# Database Patterns

## Repository Design

### Interface Definition (Consumer-Side)
```go
// Define at the consumer level
type UserRepository interface {
    User(ctx context.Context, id UserID) (User, error)
    CreateUser(ctx context.Context, u User) (User, error)
    UpdateUser(ctx context.Context, u User) error
    DeleteUser(ctx context.Context, id UserID) error
}

// Satisfaction check
var _ UserRepository = (*PostgresUserRepository)(nil)
var _ UserRepository = (*MemoryUserRepository)(nil)
```

### Sentinel Errors
```go
// Repository-level errors
var (
    ErrNotFound      = errors.New("not found")
    ErrAlreadyExists = errors.New("already exists")
    ErrConstraint    = errors.New("constraint violation")
)
```

## PostgreSQL with sqlc

### sqlc.yaml Configuration
```yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "queries/"
    schema: "migrations/"
    gen:
      go:
        package: "db"
        out: "repository/db"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_prepared_queries: false
        emit_interface: false
        emit_exact_table_names: false
```

### Query Files
```sql
-- queries/users.sql

-- name: GetUser :one
SELECT * FROM users WHERE id = $1;

-- name: ListUsers :many
SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2;

-- name: CreateUser :one
INSERT INTO users (name, email)
VALUES ($1, $2)
RETURNING *;

-- name: UpdateUser :one
UPDATE users
SET name = $2, email = $3, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;
```

### Repository Implementation
```go
package postgres

import (
    "context"
    "errors"

    "github.com/jackc/pgx/v5"
    "github.com/jackc/pgx/v5/pgxpool"

    "project/repository"
    "project/repository/db"
)

type UserRepository struct {
    pool    *pgxpool.Pool
    queries *db.Queries
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
    return &UserRepository{
        pool:    pool,
        queries: db.New(pool),
    }
}

func (r *UserRepository) User(ctx context.Context, id repository.UserID) (repository.User, error) {
    row, err := r.queries.GetUser(ctx, string(id))
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return repository.User{}, repository.ErrNotFound
        }
        return repository.User{}, fmt.Errorf("query user: %w", err)
    }
    return toUser(row), nil
}

func (r *UserRepository) CreateUser(ctx context.Context, u repository.User) (repository.User, error) {
    row, err := r.queries.CreateUser(ctx, db.CreateUserParams{
        Name:  u.Name,
        Email: u.Email,
    })
    if err != nil {
        if isUniqueViolation(err) {
            return repository.User{}, repository.ErrAlreadyExists
        }
        return repository.User{}, fmt.Errorf("insert user: %w", err)
    }
    return toUser(row), nil
}

// Type mapper
func toUser(row db.User) repository.User {
    return repository.User{
        ID:        repository.UserID(row.ID),
        Name:      row.Name,
        Email:     row.Email,
        CreatedAt: row.CreatedAt,
    }
}

func isUniqueViolation(err error) bool {
    var pgErr *pgconn.PgError
    return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
```

## Migrations with Goose

### Migration Structure
```
migrations/
├── 00001_create_users.sql
├── 00002_add_email_index.sql
└── 00003_add_settings.sql
```

### Migration File Format
```sql
-- migrations/00001_create_users.sql

-- +goose Up
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email ON users(email);

-- +goose Down
DROP TABLE IF EXISTS users;
```

### Running Migrations
```bash
# Run all pending migrations
goose -dir migrations postgres "$DATABASE_URL" up

# Rollback last migration
goose -dir migrations postgres "$DATABASE_URL" down

# Check migration status
goose -dir migrations postgres "$DATABASE_URL" status

# Create new migration
goose -dir migrations create add_settings sql
```

## SQLite for Standalone Apps

### Connection Setup
```go
package sqlite

import (
    "database/sql"

    _ "github.com/mattn/go-sqlite3"
)

func Connect(path string) (*sql.DB, error) {
    db, err := sql.Open("sqlite3", path+"?_foreign_keys=on&_journal_mode=WAL")
    if err != nil {
        return nil, fmt.Errorf("open database: %w", err)
    }

    // Connection pool settings for SQLite
    db.SetMaxOpenConns(1)  // SQLite doesn't support concurrent writes

    return db, nil
}
```

### SQLite Migrations
```sql
-- migrations/00001_create_timers.sql

-- +goose Up
CREATE TABLE timers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    remaining_seconds INTEGER NOT NULL,
    state TEXT NOT NULL DEFAULT 'paused',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- +goose Down
DROP TABLE IF EXISTS timers;
```

## Transaction Patterns

### Basic Transaction
```go
func (r *Repository) CreateUserWithProfile(ctx context.Context, u User, p Profile) error {
    tx, err := r.pool.Begin(ctx)
    if err != nil {
        return fmt.Errorf("begin transaction: %w", err)
    }
    defer tx.Rollback(ctx)

    queries := r.queries.WithTx(tx)

    userRow, err := queries.CreateUser(ctx, db.CreateUserParams{...})
    if err != nil {
        return fmt.Errorf("create user: %w", err)
    }

    _, err = queries.CreateProfile(ctx, db.CreateProfileParams{
        UserID: userRow.ID,
        ...
    })
    if err != nil {
        return fmt.Errorf("create profile: %w", err)
    }

    if err := tx.Commit(ctx); err != nil {
        return fmt.Errorf("commit transaction: %w", err)
    }

    return nil
}
```

### Transaction Helper
```go
func WithTx(ctx context.Context, pool *pgxpool.Pool, fn func(tx pgx.Tx) error) error {
    tx, err := pool.Begin(ctx)
    if err != nil {
        return fmt.Errorf("begin transaction: %w", err)
    }
    defer tx.Rollback(ctx)

    if err := fn(tx); err != nil {
        return err
    }

    return tx.Commit(ctx)
}

// Usage
err := WithTx(ctx, pool, func(tx pgx.Tx) error {
    queries := db.New(tx)
    // operations...
    return nil
})
```

## In-Memory Implementation for Testing

```go
package repository

type Memory struct {
    mu    sync.RWMutex
    users map[UserID]User
    nextID int64
}

func NewMemory(opts ...func(*Memory)) *Memory {
    m := &Memory{
        users: make(map[UserID]User),
    }
    for _, opt := range opts {
        opt(m)
    }
    return m
}

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

    // Check for duplicates
    for _, existing := range m.users {
        if existing.Email == u.Email {
            return User{}, ErrAlreadyExists
        }
    }

    m.nextID++
    u.ID = UserID(fmt.Sprintf("%d", m.nextID))
    u.CreatedAt = time.Now()
    m.users[u.ID] = u

    return u, nil
}
```

## MongoDB with docstore

```go
import "github.com/zarldev/monorepo/pkg/docstore"

type ConversationStore struct {
    store docstore.Store[Conversation]
}

func NewConversationStore(client *mongo.Client) *ConversationStore {
    return &ConversationStore{
        store: docstore.NewMongoDB[Conversation](
            client.Database("app").Collection("conversations"),
        ),
    }
}

func (s *ConversationStore) Conversation(ctx context.Context, id ConversationID) (Conversation, error) {
    conv, err := s.store.Get(ctx, string(id))
    if err != nil {
        if errors.Is(err, docstore.ErrNotFound) {
            return Conversation{}, ErrNotFound
        }
        return Conversation{}, fmt.Errorf("get conversation: %w", err)
    }
    return conv, nil
}
```

## Common Commands

```bash
# Generate sqlc code
sqlc generate

# Run migrations
goose -dir migrations postgres "$DATABASE_URL" up

# Create migration
goose -dir migrations create add_feature sql

# Reset database (dev only)
goose -dir migrations postgres "$DATABASE_URL" reset
```

## Anti-Patterns

| Pattern | Why It's Wrong | Fix |
|---------|----------------|-----|
| `return err` without wrapping | Loses context | `fmt.Errorf("query user: %w", err)` |
| `return sql.ErrNoRows` | Leaks implementation | Return `ErrNotFound` sentinel |
| Missing interface satisfaction | Runtime errors | `var _ Repo = (*PostgresRepo)(nil)` |
| Same struct for domain/DB | Abstraction leak | Separate types, mapper functions |
| Ignoring context | No cancellation | Check `ctx.Done()` |
| `db.SetMaxOpenConns(100)` for SQLite | SQLite single-writer | `SetMaxOpenConns(1)` |
| Inline SQL strings | Hard to maintain | Use sqlc with query files |
| Missing transaction rollback defer | Leaks on panic | `defer tx.Rollback(ctx)` |

---

## Integration Notes

- **go-error-handling**: Return sentinel errors (ErrNotFound), wrap driver errors
- **go-testing**: Use in-memory implementation for unit tests
- **go-interfaces**: Consumer-side repository interfaces
- **go-types**: Separate Row types from domain types
