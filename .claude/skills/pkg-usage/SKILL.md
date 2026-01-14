---
name: pkg-usage
description: ZarlMono shared package usage patterns. Use when importing or using any package from pkg/, understanding the dependency graph, or choosing the right shared package.
triggers:
  keywords:
    - package
    - import
    - pkg
    - shared
  pathPatterns:
    - "**/pkg/**/*.go"
  contentPatterns:
    - "github.com/zarldev/zarlmono/pkg"
    - "pkg/cache"
    - "pkg/options"
    - "pkg/zsync"
  intentPatterns:
    - "(?:use|import).*(?:package|pkg)"
    - "which.*package"
priority: 6
related-skills:
  - go-interfaces
  - go-types
---

# ZarlMono Shared Package Usage

## Package Import Map

```go
// Core Infrastructure
import "github.com/zarldev/monorepo/pkg/ai"           // AI conversation system
import "github.com/zarldev/monorepo/pkg/cache"        // Caching abstractions
import "github.com/zarldev/monorepo/pkg/docstore"     // Document storage
import "github.com/zarldev/monorepo/pkg/filesystem"   // File system abstractions
import "github.com/zarldev/monorepo/pkg/messagebus"   // Event-driven messaging

// Utility Packages
import "github.com/zarldev/monorepo/pkg/options"      // Functional options pattern
import "github.com/zarldev/monorepo/pkg/zlog"         // Structured logging
import "github.com/zarldev/monorepo/pkg/zhttp"        // HTTP utilities
import "github.com/zarldev/monorepo/pkg/zsync"        // Sync primitives
import "github.com/zarldev/monorepo/pkg/tui"          // Terminal UI
import "github.com/zarldev/monorepo/pkg/transport"    // Transport abstractions
import "github.com/zarldev/monorepo/pkg/crypto"       // Cryptography utilities
```

## Dependency Layers

```
Foundation (no dependencies):
├── pkg/options    ← Functional options pattern
└── pkg/zsync      ← Thread-safe data structures

Infrastructure:
├── pkg/filesystem ← pkg/options
└── pkg/zlog       ← pkg/filesystem, pkg/options

Services:
├── pkg/cache      ← pkg/filesystem, pkg/options
├── pkg/docstore   ← pkg/options
└── pkg/messagebus ← pkg/options

Transport:
├── pkg/zhttp      ← pkg/options, pkg/zlog
├── pkg/transport  ← pkg/options, pkg/zlog
└── pkg/tui        ← pkg/options, pkg/zlog

Application:
└── pkg/ai         ← pkg/cache, pkg/zlog, pkg/messagebus, pkg/options, pkg/zsync
```

**RULE**: Lower layers NEVER import higher layers.

## Package Usage Examples

### pkg/options - Functional Options

```go
import "github.com/zarldev/monorepo/pkg/options"

type ServiceConfig struct {
    Timeout     time.Duration
    Retries     int
    EnableCache bool
}

func NewService(opts ...options.Option[ServiceConfig]) *Service {
    cfg := &ServiceConfig{
        Timeout:     30 * time.Second,  // Sane defaults
        Retries:     3,
        EnableCache: true,
    }

    for _, opt := range opts {
        opt(cfg)
    }

    return &Service{config: cfg}
}

func WithTimeout(t time.Duration) options.Option[ServiceConfig] {
    return func(cfg *ServiceConfig) {
        cfg.Timeout = t
    }
}
```

### pkg/zsync - Thread-Safe Data Structures

```go
import "github.com/zarldev/monorepo/pkg/zsync"

// Concurrent map
userCache := zsync.NewZMap[UserID, User]()
userCache.Set(userID, user)
user, err := userCache.Get(userID)
if errors.Is(err, zsync.ErrNotFound) {
    // handle not found
}

// Concurrent set
activeUsers := zsync.NewZSet[UserID]()
activeUsers.Add(userID)
if activeUsers.Contains(userID) {
    // user is active
}

// Concurrent queue
taskQueue := zsync.NewZQueue[Task]()
go func() {
    task, err := taskQueue.Pop(ctx)
    if errors.Is(err, zsync.ErrQueueClosed) {
        return
    }
    processTask(task)
}()
```

### pkg/cache - Caching Abstractions

```go
import "github.com/zarldev/monorepo/pkg/cache"

// Memory cache
userCache := cache.NewMemoryCache[string, User]()

// Redis cache
userCache := cache.NewRedisCache[string, User](redisClient)

// File cache
userCache := cache.NewFileCache[string, User](
    filesystem.New(),
    cache.WithDir("cache/users"),
)

// Same interface for all implementations
err := userCache.Set(ctx, "user:123", user)
user, err := userCache.Get(ctx, "user:123")
if errors.Is(err, cache.ErrNotFound) {
    // cache miss
}
```

### pkg/filesystem - File System Abstractions

```go
import "github.com/zarldev/monorepo/pkg/filesystem"

// OS filesystem (production)
fs := filesystem.NewOSFS()

// Memory filesystem (testing)
fs := filesystem.NewMemFS()

// SeaweedFS (distributed)
fs := filesystem.NewSeaweedFS(client)

// Same interface for all
data, err := fs.ReadFile("config.json")
err = fs.WriteFile("output.txt", data, 0644)
files, err := fs.ReadDir(".")
```

### pkg/zlog - Structured Logging

```go
import "github.com/zarldev/monorepo/pkg/zlog"

logger := zlog.NewLogger(zlog.DefaultConfig())

logger.Info("processing request",
    "user_id", userID,
    "action", "create",
)

logger.Error("request failed",
    "error", err,
    "request_id", reqID,
)
```

### pkg/messagebus - Event-Driven Messaging

```go
import "github.com/zarldev/monorepo/pkg/messagebus"

// NATS implementation
bus := messagebus.NewNATS(natsConn)

// Memory implementation (testing)
bus := messagebus.NewMemory()

// Publish
err := bus.Publish(ctx, "user.created", userEvent)

// Subscribe
sub, err := bus.Subscribe(ctx, "user.*", func(msg Message) error {
    // handle message
    return nil
})
defer sub.Unsubscribe()
```

### pkg/zhttp - HTTP Utilities

```go
import "github.com/zarldev/monorepo/pkg/zhttp"

func handler(w http.ResponseWriter, r *http.Request) {
    user, err := getUser(r.Context())
    if err != nil {
        zhttp.WriteError(w, http.StatusNotFound, "user not found")
        return
    }

    zhttp.WriteJSON(w, http.StatusOK, user)
}

// Middleware
mux.Handle("/api/", zhttp.Chain(
    zhttp.RequestID,
    zhttp.Logging(logger),
    zhttp.Recovery,
)(apiHandler))
```

### pkg/tui - Terminal UI

```go
import "github.com/zarldev/monorepo/pkg/tui"

form := tui.NewForm().
    AddInput("name", "Name:", "").
    AddInput("email", "Email:", "").
    AddTextArea("description", "Description:", "")

wizard := tui.NewWizard("Setup").
    AddStep("basic", "Basic Info", form).
    AddStep("advanced", "Advanced Options", advancedForm)

result, err := wizard.Run()
```

## Common Usage Combinations

### Web Application Stack
```go
import (
    "github.com/zarldev/monorepo/pkg/zlog"
    "github.com/zarldev/monorepo/pkg/zhttp"
    "github.com/zarldev/monorepo/pkg/cache"
    "github.com/zarldev/monorepo/pkg/options"
)
```

### AI-Powered Application
```go
import (
    "github.com/zarldev/monorepo/pkg/ai"
    "github.com/zarldev/monorepo/pkg/cache"
    "github.com/zarldev/monorepo/pkg/messagebus"
    "github.com/zarldev/monorepo/pkg/zlog"
)
```

### Data Processing Service
```go
import (
    "github.com/zarldev/monorepo/pkg/docstore"
    "github.com/zarldev/monorepo/pkg/filesystem"
    "github.com/zarldev/monorepo/pkg/zsync"
    "github.com/zarldev/monorepo/pkg/messagebus"
)
```

### CLI Tool
```go
import (
    "github.com/zarldev/monorepo/pkg/tui"
    "github.com/zarldev/monorepo/pkg/filesystem"
    "github.com/zarldev/monorepo/pkg/zlog"
)
```

## When to Use Each Package

| Need | Package |
|------|---------|
| Functional options | `pkg/options` |
| Concurrent map/set/queue | `pkg/zsync` |
| Caching with TTL | `pkg/cache` |
| File operations (testable) | `pkg/filesystem` |
| Document storage | `pkg/docstore` |
| Event publishing | `pkg/messagebus` |
| Structured logging | `pkg/zlog` |
| HTTP middleware | `pkg/zhttp` |
| Interactive CLI | `pkg/tui` |
| AI conversations | `pkg/ai` |
| Encryption | `pkg/crypto` |

## DON'T Roll Your Own

```go
// DON'T: Custom concurrent map
type MyCache struct {
    mu   sync.RWMutex
    data map[string]any  // Using interface{}!
}

// DO: Use zsync
cache := zsync.NewZMap[string, User]()

// DON'T: Custom file handling
data, _ := os.ReadFile(path)

// DO: Use filesystem for testability
fs := filesystem.NewOSFS()
data, _ := fs.ReadFile(path)

// DON'T: Reinvent options
func NewService(opts ...func(*Config))

// DO: Use options package
func NewService(opts ...options.Option[Config])
```

## Anti-Patterns

| Pattern | Why It's Wrong | Fix |
|---------|----------------|-----|
| Custom concurrent map | Reinventing the wheel | `zsync.NewZMap[K,V]()` |
| `os.ReadFile` directly | Not testable | `filesystem.NewOSFS()` |
| Custom options funcs | Inconsistent pattern | `options.Option[T]` |
| `interface{}` in maps | Type unsafe | `zsync.NewZMap[K,V]()` |
| Higher layer importing lower | Circular deps | Follow dependency layers |
| Rolling custom logging | Inconsistent | `pkg/zlog` |

---

## Integration Notes

- **go-interfaces**: Packages expose small interfaces
- **go-types**: Use semantic types with package types
- **go-testing**: Use Memory implementations for testing
