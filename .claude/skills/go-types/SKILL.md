---
name: go-types
description: "Go type design - semantic types, pointer rules, type aliases vs new types, useful zero values. Use when designing data structures, choosing between pointer and value types, or reviewing type usage."
---

# Go Type Design

> "Pointers only when nil is a valid value"

## Core Philosophy

- **Semantic types** - Give meaning to primitives
- **Pointers only when nil valid** - No pointer abuse
- **Separate structs per layer** - No tag mixing
- **Useful zero values** - Design for defaults
- **Type aliases for boundaries** - Prevent abstraction leak

---

## Semantic Types

Give primitives meaning:

```go
// ❌ BAD - primitive abuse
type User struct {
    ID        int64   // what kind of ID?
    AccountID int64   // easy to mix up with ID
    Amount    int64   // cents? dollars? 
}

func Transfer(from, to, amount int64) error  // which is which?

// ✅ GOOD - semantic types
type UserID = int64
type AccountID = int64
type Cents = int64

type User struct {
    ID        UserID
    AccountID AccountID
    Balance   Cents
}

func Transfer(from, to AccountID, amount Cents) error  // clear
```

**Benefits:**
- Self-documenting code
- Compiler catches some mistakes (with new types)
- IDE shows meaningful types
- Clear intent at call sites

---

## Pointer Rules

**Only use pointers when nil is a valid, meaningful value.**

```go
// ❌ BAD - pointer abuse
func Users() []*User              // pointers for no reason
func Config() *Config             // config isn't nullable

type Request struct {
    User *User                    // is nil a valid state?
}

// ✅ GOOD - values unless nil semantics needed
func Users() []User               // slice of values
func Config() Config              // value, not pointer

// ✅ GOOD - pointer when nil means something
func FindUser(id UserID) *User    // nil = not found
func (u *User) Manager() *User    // nil = no manager

type Response struct {
    User  User                    // always present
    Error *Error                  // nil = no error (valid)
}
```

**Pointer guidelines:**
- Slices: `[]User` not `[]*User` (unless nil elements meaningful)
- Maps: `map[K]V` not `map[K]*V` (unless nil values meaningful)
- Struct fields: value unless optional/nullable
- Return values: value unless "not found" is valid state
- Receivers: pointer for mutation, value for read-only small structs

---

## Type Aliases vs New Types

**Type alias** (`=`) - Same underlying type, interchangeable:
```go
type UserID = int64  // UserID IS int64, fully interchangeable

var id UserID = 42
var raw int64 = id   // works - same type
```

**New type** (no `=`) - Distinct type, not interchangeable:
```go
type UserID int64    // UserID wraps int64, distinct type

var id UserID = 42
var raw int64 = id   // ERROR - different types
var raw int64 = int64(id)  // OK - explicit conversion
```

**When to use aliases:**
- Semantic clarity without type safety overhead
- Preventing abstraction leak between packages
- 9/10 times this is what you want

**When to use new types:**
- Need methods on the type
- Want compiler to prevent mixing types
- Building rich enums

```go
// Alias - semantic clarity, easy to use
type UserID = int64
type AccountID = int64

// New type - prevents mixing, can add methods
type Status int

const (
    StatusPending Status = iota
    StatusActive
    StatusClosed
)

func (s Status) String() string { ... }
func (s Status) IsTerminal() bool { ... }
```

---

## Struct Design

### Field Ordering

```go
type User struct {
    // Exported fields first
    ID        UserID
    Name      string
    Email     string
    CreatedAt time.Time
    
    // Unexported fields after
    passwordHash []byte
    lastLogin    time.Time
}
```

### No Tag Mixing - Separate Structs Per Layer

```go
// ❌ BAD - abstraction leak, all concerns in one struct
type User struct {
    ID    int64  `json:"id" db:"user_id" yaml:"id" xml:"Id"`
    Name  string `json:"name" db:"user_name" yaml:"name"`
    Email string `json:"email" db:"email_address" yaml:"email"`
}

// ✅ GOOD - separate structs per layer
// Domain layer - no tags
type User struct {
    ID    UserID
    Name  string
    Email string
}

// API layer - JSON serialization
type UserDTO struct {
    ID    int64  `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}

// Database layer - DB mapping
type UserRow struct {
    UserID       int64  `db:"user_id"`
    UserName     string `db:"user_name"`
    EmailAddress string `db:"email_address"`
}

// Mapping functions between layers
func (u User) ToDTO() UserDTO { ... }
func (r UserRow) ToDomain() User { ... }
```

**Why separate?**
- Each layer can evolve independently
- DB schema changes don't affect API
- API changes don't affect domain logic
- Clear boundaries between concerns

---

## Zero Values

Design types so zero value is useful or use sensible defaults:

```go
// ✅ GOOD - zero value works
type Buffer struct {
    data []byte  // nil slice works, append handles it
}

var b Buffer
b.Write([]byte("hello"))  // works

// ✅ GOOD - zero value is valid state
type Counter struct {
    count int  // zero is valid starting point
}

var c Counter
c.Increment()  // works, starts at 0

// ❌ BAD - zero value panics, required param
type Service struct {
    db Database
}

func NewService(db Database) *Service {
    return &Service{db: db}  // nil db = panic later
}

// ✅ GOOD - sensible default, options for override
func NewService(opts ...Option[Service]) *Service {
    s := &Service{
        db: NewMemoryDB(),  // sensible default - never panics
    }
    for _, opt := range opts {
        opt(s)
    }
    return s
}

func WithDatabase(db Database) Option[Service] {
    return func(s *Service) {
        s.db = db
    }
}

// usage
svc := NewService()                          // works with default
svc := NewService(WithDatabase(postgresDB))  // override when needed
```

---

## Struct Embedding

```go
// ✅ GOOD - embed for composition
type Server struct {
    http.Server              // promotes methods
    Logger      *slog.Logger
}

// s.ListenAndServe() works

// ✅ GOOD - embed interfaces for partial implementation
type ReadOnlyCache struct {
    cache.Reader             // only expose read methods
}

// ❌ BAD - embed for code reuse only (no semantic relationship)
type Handler struct {
    BaseHandler              // if just for shared code, use composition
}
```

---

## Anti-Patterns

| Pattern | Why It's Wrong | Fix |
|---------|----------------|-----|
| `[]*User` slices | Pointer abuse | `[]User` |
| `map[K]*V` | Pointer abuse | `map[K]V` |
| Mixed struct tags | Abstraction leak | Separate structs per layer |
| `type ID int64` everywhere | May not need type safety | `type ID = int64` alias |
| Zero value panics | Unusable default | Sensible default + options |
| Required constructor params | Forces dependencies | Options pattern with defaults |
| Primitive parameters | Easy to mix up | Semantic types |
| `interface{}` fields | Type safety loss | Generics or specific types |

---

## Integration Notes

- **go-naming**: Type names follow naming conventions, no stuttering
- **go-interfaces**: Interface types stay small, often embedded
- **go-interfaces**: Use `Option[T]` pattern from pkg/options
- **database-patterns**: Separate row types from domain types
