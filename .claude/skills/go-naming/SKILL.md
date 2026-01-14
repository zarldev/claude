---
name: go-naming
description: Naming conventions for Go code including scope-based variable naming, receivers, constants, errors, and method naming. Use when writing or reviewing Go code.
triggers:
  keywords:
    - naming
    - convention
    - receiver
    - constant
    - variable
  pathPatterns:
    - "**/*.go"
  intentPatterns:
    - "(?:name|naming|call).*(?:variable|function|method)"
    - "what.*(?:call|name)"
priority: 7
related-skills:
  - go-error-handling
  - go-interfaces
---

# Go Naming Conventions

> "Scope-based naming is my jam" - smaller scope = shorter names

## Core Philosophy

- **Scope-based naming** - Name length proportional to scope size
- **No Get/Set prefixes** - Not Java
- **Expose fields directly** - Methods only for behavior
- **Single-letter receivers** - Match type initial
- **Descriptive exports** - Short internals

---

## Variables - Scope-Based

Name length matches scope size:

```go
// ✅ GOOD - tiny scope, tiny name
for i := range items { }
for k, v := range m { }

// ✅ GOOD - small scope (handlers)
func(w http.ResponseWriter, r *http.Request)

// ✅ GOOD - medium scope
ctx := r.Context()
user, err := svc.User(ctx, id)

// ✅ GOOD - larger scope, descriptive
requestID := uuid.New()
wordsPerMin := 200
connTimeout := 30 * time.Second
```

```go
// ❌ BAD - verbose for tiny scope
for index := range items { }
for key, value := range myMap { }

// ❌ BAD - too short for large scope
wpm := 200  // unclear at distance
ct := 30 * time.Second  // cryptic
```

---

## Receivers - Single Letter

Always single letter (max 2), match type initial:

```go
// ✅ GOOD
func (s *Service) Process()
func (h *Handler) ServeHTTP()
func (c *Cache) Get()
func (u *User) Validate()
func (tx *Tx) Commit()           // 2 chars OK for common abbreviations
func (rw *ResponseWriter) Write() // 2 chars when needed

// ❌ BAD - too verbose
func (svc *Service) Process()
func (handler *Handler) ServeHTTP()
func (self *Cache) Get()         // not Python
func (this *User) Validate()     // not Java
```

---

## Constants

**Rich enums** - UPPER_CASE:
```go
const (
    UNKNOWN Status = iota
    PENDING
    RUNNING
    FAILED
    COMPLETED
)
```

**Simple constants** - camelCase:
```go
const (
    wordsPerMinute = 200
    maxRetries     = 3
    defaultTimeout = 30 * time.Second
)
```

---

## Errors

Always `Err` prefix with descriptive name:

```go
// ✅ GOOD - package-level sentinels
var (
    ErrNotFound      = errors.New("not found")
    ErrInvalidInput  = errors.New("invalid input")
    ErrCanceled      = errors.New("canceled")
)

// ✅ GOOD - function-specific when needed
var (
    ErrParseValue  = errors.New("parse value")
    ErrParseSource = errors.New("parse source")
)

// ❌ BAD
var NotFoundError = errors.New("not found")  // wrong suffix
var NOT_FOUND = errors.New("not found")      // wrong case
var errNotFound = errors.New("not found")    // unexported sentinel
```

---

## Methods - No Get/Set, Expose Fields

```go
// ❌ BAD - Java ceremony
type Service struct {
    config Config
}
func (s *Service) GetConfig() Config { return s.config }
func (s *Service) SetConfig(cfg Config) { s.config = cfg }

// ✅ GOOD - expose directly when no behavior
type Service struct {
    Config Config  // public field, direct access
}
// usage: svc.Config, svc.Config = newCfg

// ✅ GOOD - method only when there's actual behavior
func (s *Service) User(id UserID) (User, error)  // fetches from DB
func (s *Service) Reload() error                  // reconnects, has side effects
func (s *Service) ProcessJob(j Job) error         // does work
```

**When to use methods:**
- Fetching from external source (DB, API, cache)
- Side effects (reconnect, notify, log)
- Computation that isn't just field access
- Validation before returning

**When to expose fields:**
- Simple data access
- Configuration values
- Anything without behavior

---

## Packages

```go
// ✅ GOOD - short, singular, lowercase
package user
package cache
package http
package repository

// ❌ BAD
package users          // plural
package userService    // camelCase
package user_service   // snake_case
package util           // meaningless
package common         // meaningless
package helpers        // meaningless
```

---

## Files

```go
// ✅ GOOD - snake_case
user_repository.go
http_handler.go
memory_cache.go

// ❌ BAD
userRepository.go      // camelCase
UserRepository.go      // PascalCase
user-repository.go     // kebab-case
```

---

## Type Names

```go
// ✅ GOOD - clear, no stuttering
type User struct { }
type UserID = int64
type Cache[K, V any] interface { }

// ❌ BAD - stutters with package
type UserUser struct { }      // user.UserUser
type CacheCache struct { }    // cache.CacheCache

// ❌ BAD - Hungarian notation
type IUser interface { }      // I prefix
type UserInterface interface { }  // Interface suffix
type TUser struct { }         // T prefix
```

---

## Function Names

```go
// ✅ GOOD - verb or verb phrase for actions
func CreateUser() error
func ValidateInput() error
func ProcessJob() error

// ✅ GOOD - noun for constructors
func NewService() *Service
func NewUserRepository() *UserRepository

// ✅ GOOD - predicate for booleans
func IsValid() bool
func HasPermission() bool
func CanProcess() bool

// ❌ BAD
func DoCreateUser()    // redundant "Do"
func PerformValidation()  // verbose
func MakeNewService()  // redundant "Make" with "New"
```

---

## Anti-Patterns

| Pattern | Why It's Wrong | Fix |
|---------|----------------|-----|
| `GetX()` / `SetX()` | Java ceremony | Expose field or use verb |
| `svc *Service` receiver | Too long | `s *Service` |
| `self` / `this` receiver | Not Go | Single letter |
| `index` in `for` loop | Too verbose for scope | `i` |
| `package utils` | Meaningless | Domain-specific name |
| Unexported sentinels `errX` | Can't check with errors.Is | `ErrX` exported |
| `IInterface` prefix | Hungarian notation | Just `Interface` |
| `UserUser` type | Stutters with package | Just `User` |
| camelCase files | Not convention | snake_case.go |

---

## Integration Notes

- **go-error-handling**: Error naming follows `ErrXxx` pattern
- **go-interfaces**: Interface names describe behavior, no `I` prefix
- **go-types**: Type names avoid stuttering with package name
