---
name: go-error-handling
description: Error handling patterns following Bruno's philosophy - errors tell a story, wrap at every failure point, log once at boundaries, context signals via select
triggers:
  keywords:
    - error
    - err
    - wrap
    - sentinel
    - Errorf
  keywordPatterns:
    - "\\berr\\b"
    - "\\bErr[A-Z]\\w+"
  pathPatterns:
    - "**/*.go"
  contentPatterns:
    - "fmt\\.Errorf"
    - "errors\\.New"
    - "errors\\.Is"
  intentPatterns:
    - "(?:handle|wrap|create|define).*error"
    - "error.*(?:handling|pattern)"
priority: 9
related-skills:
  - go-interfaces
  - go-testing
  - database-patterns
---

# Go Error Handling

> "Errors tell a story - build narrative without stuttering, wrap at every failure point, log once at boundaries"

## Core Philosophy

- Errors are **values**, not exceptions
- Each wrap adds context to the narrative
- The full error chain should read like a sentence
- Log once at boundaries, never in business logic
- Context cancellation is control flow, not errors

---

## Never-Use Prefixes

These prefixes create stuttering when errors chain:

```go
// ❌ BAD - noisy prefixes
"failed to open file"
"unable to parse config"
"could not connect to database"
"error reading response"

// ✅ GOOD - terse, direct context
"open file: %w"
"parse config: %w"
"connect to database: %w"
"read response: %w"
```

**Why?** Chained errors read poorly:
```
// ❌ BAD
failed to process request: failed to validate input: failed to parse date

// ✅ GOOD
process request: validate input: parse date: invalid format
```

---

## Sentinel Error Patterns

### Service-Level Sentinels

```go
// service owns its error vocabulary
var (
    ErrUserNotFound      = errors.New("user not found")
    ErrInsufficientFunds = errors.New("insufficient funds")
    ErrReceiptSendFailed = errors.New("receipt send failed")
    ErrCanceled          = errors.New("canceled")
)
```

### Generic Reusable Sentinels

```go
// ✅ GOOD - reusable at repo level
var (
    ErrNotFound            = errors.New("not found")
    ErrConstraintViolation = errors.New("constraint violation")
)

// ❌ BAD - too tightly coupled
var ErrGetUserNotFound = errors.New("get user not found")
```

### Function-Specific When Needed

```go
// ✅ GOOD - Err{FunctionName}{ErrorType} when generic won't work
var (
    ErrParseValue  = errors.New("parse value")
    ErrParseSource = errors.New("parse source")
)
```

---

## Wrapping Patterns

### Bubble Up Existing Sentinel

When lower layer returns a sentinel you want to preserve:

```go
// just wrap - %w preserves the sentinel
return fmt.Errorf("find account for user %d: %w", userID, err)
```

### Translate to Service Sentinel

When lower layer has generic error, translate to domain sentinel:

```go
account, err := s.repo.FindAccount(ctx, userID)
if err != nil {
    if errors.Is(err, repo.ErrNotFound) {
        return fmt.Errorf("%w: %w", ErrUserNotFound, err)
    }
    return fmt.Errorf("find account for user %d: %w", userID, err)
}
```

### Add New Sentinel to Foreign Error

When external dependency returns error, tag with your sentinel:

```go
if err := s.notifier.SendReceipt(ctx, userID, amount); err != nil {
    return fmt.Errorf("%w: %w", ErrReceiptSendFailed, err)
}
```

---

## Logging Strategy

**Never log in business logic. Log once at boundaries.**

```go
// ❌ BAD - logging in service
func (s *Service) GetUser(id UserID) (User, error) {
    user, err := s.repo.FindUser(id)
    if err != nil {
        log.Error("failed to get user", "error", err) // noise!
        return User{}, fmt.Errorf("find user: %w", err)
    }
    return user, nil
}

// ✅ GOOD - service just wraps
func (s *Service) GetUser(id UserID) (User, error) {
    user, err := s.repo.FindUser(id)
    if err != nil {
        return User{}, fmt.Errorf("find user %d: %w", id, err)
    }
    return user, nil
}

// ✅ GOOD - handler logs at boundary with full context
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
    user, err := h.svc.GetUser(id)
    if err != nil {
        h.log.Error("get user", "id", id, "error", err)
        http.Error(w, "internal error", 500)
        return
    }
    json.NewEncoder(w).Encode(user)
}
```

---

## Context Cancellation

**Context signals are control flow, not errors. Use channels via select.**

### WRONG - Treating as Errors

```go
// ❌ BAD - polling ctx.Err() and bubbling up
func (s *Service) ProcessJob(ctx context.Context, id JobID) error {
    result, err := s.longOperation(ctx, id)
    if err != nil {
        if ctx.Err() != nil {
            return ctx.Err() // wrong - treating signal as error
        }
        return fmt.Errorf("long operation: %w", err)
    }
    return nil
}
```

### CORRECT - Select on ctx.Done()

```go
// ✅ GOOD - loop with select
func (s *Service) ProcessItems(ctx context.Context, items []Item) error {
    for _, item := range items {
        select {
        case <-ctx.Done():
            return ErrCanceled // our sentinel, clean exit
        default:
            if err := s.process(item); err != nil {
                return fmt.Errorf("process item %d: %w", item.ID, err)
            }
        }
    }
    return nil
}

// ✅ GOOD - async work with timeout
func (s *Service) FetchWithTimeout(ctx context.Context, id string) (Result, error) {
    resultCh := make(chan Result, 1)
    errCh := make(chan error, 1)

    go func() {
        result, err := s.fetch(id)
        if err != nil {
            errCh <- err
            return
        }
        resultCh <- result
    }()

    select {
    case <-ctx.Done():
        return Result{}, ErrCanceled // our sentinel, not context.Canceled
    case err := <-errCh:
        return Result{}, fmt.Errorf("fetch: %w", err)
    case result := <-resultCh:
        return result, nil
    }
}

// ✅ GOOD - worker loop
func (w *Worker) Run(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return // clean shutdown
        case job := <-w.jobs:
            if err := w.process(job); err != nil {
                w.log.Error("process job", "id", job.ID, "error", err)
            }
        }
    }
}
```

### Key Principles

- `ctx.Done()` is a **channel** - select on it
- Return `ErrCanceled` sentinel, not `context.Canceled`
- Service owns its cancellation sentinel
- No wrapping, no bubbling `context.Canceled`

---

## Handler Error Mapping

Use switch for clean error-to-HTTP mapping:

```go
func (h *Handler) SubmitPayment(w http.ResponseWriter, r *http.Request) {
    var req PaymentRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid request", 400)
        return
    }

    err := h.svc.ProcessPayment(r.Context(), req.UserID, req.Amount)
    if err != nil {
        switch {
        case errors.Is(err, ErrCanceled):
            return // client gone, no response, no log
        case errors.Is(err, ErrReceiptSendFailed):
            // non-critical - log warning, continue as success
            h.log.Warn("receipt failed", "user", req.UserID, "error", err)
        case errors.Is(err, ErrInsufficientFunds):
            http.Error(w, "insufficient funds", 402)
            return
        case errors.Is(err, ErrUserNotFound):
            http.Error(w, "user not found", 404)
            return
        default:
            h.log.Error("submit payment", "user", req.UserID, "error", err)
            http.Error(w, "internal error", 500)
            return
        }
    }

    w.WriteHeader(204)
}
```

---

## Complete Example

```go
package payment

import (
    "context"
    "errors"
    "fmt"
)

// Service-level sentinels
var (
    ErrUserNotFound      = errors.New("user not found")
    ErrInsufficientFunds = errors.New("insufficient funds")
    ErrReceiptSendFailed = errors.New("receipt send failed")
    ErrCanceled          = errors.New("canceled")
)

// Repository - returns generic sentinels or wraps
func (r *Repo) DebitAccount(ctx context.Context, id AccountID, amount int64) error {
    result, err := r.db.ExecContext(ctx, debitQuery, id, amount)
    if err != nil {
        return fmt.Errorf("exec debit: %w", err)
    }

    rows, err := result.RowsAffected()
    if err != nil {
        return fmt.Errorf("rows affected: %w", err)
    }
    if rows == 0 {
        return ErrConstraintViolation
    }
    return nil
}

// Service - translates repo errors to domain sentinels, never logs
func (s *Service) ProcessPayment(ctx context.Context, userID UserID, amount int64) error {
    account, err := s.repo.FindAccount(ctx, userID)
    if err != nil {
        if errors.Is(err, repo.ErrNotFound) {
            return fmt.Errorf("%w: %w", ErrUserNotFound, err)
        }
        return fmt.Errorf("find account for user %d: %w", userID, err)
    }

    if err := s.repo.DebitAccount(ctx, account.ID, amount); err != nil {
        if errors.Is(err, repo.ErrConstraintViolation) {
            return fmt.Errorf("%w: %w", ErrInsufficientFunds, err)
        }
        return fmt.Errorf("debit account %d: %w", account.ID, err)
    }

    if err := s.notifier.SendReceipt(ctx, userID, amount); err != nil {
        return fmt.Errorf("%w: %w", ErrReceiptSendFailed, err)
    }

    return nil
}

// Handler - logs at boundary, maps sentinels to HTTP
func (h *Handler) SubmitPayment(w http.ResponseWriter, r *http.Request) {
    var req PaymentRequest
    if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
        http.Error(w, "invalid request", 400)
        return
    }

    err := h.svc.ProcessPayment(r.Context(), req.UserID, req.Amount)
    if err != nil {
        switch {
        case errors.Is(err, ErrCanceled):
            return
        case errors.Is(err, ErrReceiptSendFailed):
            h.log.Warn("receipt failed", "user", req.UserID, "error", err)
        case errors.Is(err, ErrInsufficientFunds):
            http.Error(w, "insufficient funds", 402)
            return
        case errors.Is(err, ErrUserNotFound):
            http.Error(w, "user not found", 404)
            return
        default:
            h.log.Error("submit payment", "user", req.UserID, "error", err)
            http.Error(w, "internal error", 500)
            return
        }
    }

    w.WriteHeader(204)
}
```

---

## Anti-Patterns

| Pattern | Why It's Wrong | Fix |
|---------|----------------|-----|
| `"failed to X"` prefix | Stuttering when chained | `"X: %w"` |
| `log.Error` then `return err` | Double logging | Log at boundaries only |
| `errors.New` in function body | Can't use `errors.Is` | Package-level sentinel |
| `if err != nil { return err }` | Loses context | `fmt.Errorf("context: %w", err)` |
| `return ctx.Err()` | Treating signal as error | Return `ErrCanceled` sentinel |
| `if ctx.Err() != nil` in loop | Polling instead of select | `select { case <-ctx.Done(): }` |
| `fmt.Errorf("...: %w", ctx.Err())` | Wrapping a signal | Return sentinel directly |
| Error functions `ErrFoo()` | Allocates each call | `var ErrFoo = errors.New()` |

---

## Integration Notes

- **go-testing**: Test error cases with `errors.Is(err, ErrExpected)` in table tests
- **go-interfaces**: Error interfaces should be small - usually just `error`
- **database-patterns**: Repository returns generic sentinels, service translates to domain sentinels
