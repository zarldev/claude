---
name: go-concurrency
description: "Go concurrency patterns - goroutine lifecycle management, channels, sync primitives, worker pools, and errgroup. Use when writing concurrent code, managing goroutines, or debugging race conditions."
---

# Go Concurrency Patterns

> "Never fire-and-forget. Every goroutine must have a way to stop and be waited on."

## Core Philosophy

- **Goroutine lifecycle** - Every goroutine needs a shutdown signal and completion signal
- **Channel size** - Unbuffered (0) or 1, larger needs justification
- **Mutex hiding** - Never embed mutexes, keep them private
- **Context for cancellation** - Use `ctx.Done()` via select, not polling
- **Share by communicating** - Prefer channels over shared memory when appropriate

---

## Goroutine Lifecycle

Every goroutine needs two things:
1. A way to be told to stop
2. A way to signal it's done

### Basic Worker Pattern

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
    defer close(w.done)  // signal completion

    ticker := time.NewTicker(time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            w.doWork()
        case <-w.stop:
            return  // clean exit
        }
    }
}

func (w *Worker) Shutdown() {
    close(w.stop)  // signal stop
    <-w.done       // wait for completion
}
```

### Context-Based Shutdown

```go
func (w *Worker) Run(ctx context.Context) {
    ticker := time.NewTicker(time.Second)
    defer ticker.Stop()

    for {
        select {
        case <-ticker.C:
            w.doWork()
        case <-ctx.Done():
            return  // context canceled
        }
    }
}

// usage
ctx, cancel := context.WithCancel(context.Background())
go worker.Run(ctx)
// ... later
cancel()  // triggers shutdown
```

---

## Channel Patterns

### Buffer Size Rules

```go
// ✅ GOOD - unbuffered for synchronization
done := make(chan struct{})

// ✅ GOOD - size 1 for handoff
result := make(chan Result, 1)

// ❌ BAD - arbitrary buffer without justification
queue := make(chan Task, 100)  // why 100?
```

**When to use buffered:**
- Preventing sender blocking when receiver is slow (document why)
- Bounded work queues with backpressure
- Batch collecting before processing

### Select with Default

```go
// non-blocking send
select {
case ch <- value:
    // sent
default:
    // channel full or closed, handle gracefully
}

// non-blocking receive
select {
case value := <-ch:
    // received
default:
    // nothing available
}
```

### Fan-Out / Fan-In

```go
func fanOut(ctx context.Context, input <-chan Task, workers int) <-chan Result {
    results := make(chan Result)

    var wg sync.WaitGroup
    for range workers {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for task := range input {
                select {
                case <-ctx.Done():
                    return
                case results <- process(task):
                }
            }
        }()
    }

    go func() {
        wg.Wait()
        close(results)
    }()

    return results
}
```

---

## Sync Primitives

### Mutex - Never Embed

```go
// ❌ BAD - exposes Lock/Unlock in API
type Cache struct {
    sync.Mutex
    data map[string]string
}

// ✅ GOOD - mutex is implementation detail
type Cache struct {
    mu   sync.Mutex
    data map[string]string
}

func (c *Cache) Get(key string) (string, bool) {
    c.mu.Lock()
    defer c.mu.Unlock()
    v, ok := c.data[key]
    return v, ok
}
```

### RWMutex - Read-Heavy Workloads

```go
type Cache struct {
    mu   sync.RWMutex
    data map[string]string
}

func (c *Cache) Get(key string) (string, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    v, ok := c.data[key]
    return v, ok
}

func (c *Cache) Set(key, value string) {
    c.mu.Lock()
    defer c.mu.Unlock()
    c.data[key] = value
}
```

### WaitGroup - Waiting for Multiple Goroutines

```go
func processAll(items []Item) {
    var wg sync.WaitGroup

    for _, item := range items {
        wg.Add(1)
        go func() {
            defer wg.Done()
            process(item)
        }()
    }

    wg.Wait()  // blocks until all done
}
```

### Once - Lazy Initialization

```go
type Service struct {
    initOnce sync.Once
    db       *sql.DB
}

func (s *Service) DB() *sql.DB {
    s.initOnce.Do(func() {
        s.db = connectDB()  // runs exactly once
    })
    return s.db
}
```

---

## Worker Pool

```go
type Pool struct {
    tasks   chan Task
    results chan Result
    workers int
    wg      sync.WaitGroup
}

func NewPool(workers, queueSize int) *Pool {
    p := &Pool{
        tasks:   make(chan Task, queueSize),
        results: make(chan Result, queueSize),
        workers: workers,
    }

    for range workers {
        p.wg.Add(1)
        go p.worker()
    }

    return p
}

func (p *Pool) worker() {
    defer p.wg.Done()
    for task := range p.tasks {
        p.results <- task.Process()
    }
}

func (p *Pool) Submit(task Task) {
    p.tasks <- task
}

func (p *Pool) Results() <-chan Result {
    return p.results
}

func (p *Pool) Shutdown() {
    close(p.tasks)  // no more tasks
    p.wg.Wait()     // wait for workers
    close(p.results)
}
```

---

## errgroup - Concurrent Error Handling

```go
import "golang.org/x/sync/errgroup"

func fetchAll(ctx context.Context, urls []string) ([]Result, error) {
    g, ctx := errgroup.WithContext(ctx)
    results := make([]Result, len(urls))

    for i, url := range urls {
        g.Go(func() error {
            result, err := fetch(ctx, url)
            if err != nil {
                return fmt.Errorf("fetch %s: %w", url, err)
            }
            results[i] = result
            return nil
        })
    }

    if err := g.Wait(); err != nil {
        return nil, err  // first error cancels context
    }

    return results, nil
}
```

---

## Context Cancellation

### Select on ctx.Done()

```go
// ✅ GOOD - select on channel
func (s *Service) Process(ctx context.Context, items []Item) error {
    for _, item := range items {
        select {
        case <-ctx.Done():
            return ErrCanceled  // our sentinel
        default:
            if err := s.processItem(item); err != nil {
                return fmt.Errorf("process item %d: %w", item.ID, err)
            }
        }
    }
    return nil
}

// ❌ BAD - polling ctx.Err()
func (s *Service) Process(ctx context.Context, items []Item) error {
    for _, item := range items {
        if ctx.Err() != nil {
            return ctx.Err()  // wrong - treating signal as error
        }
        // ...
    }
    return nil
}
```

### Async with Timeout

```go
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
        return Result{}, ErrCanceled
    case err := <-errCh:
        return Result{}, fmt.Errorf("fetch: %w", err)
    case result := <-resultCh:
        return result, nil
    }
}
```

---

## Testing Concurrent Code

### Use t.Context()

```go
func TestWorker(t *testing.T) {
    ctx := t.Context()  // auto-cancels on test end

    worker := NewWorker()
    go worker.Run(ctx)

    // test worker behavior
    // context cancels when test ends - no goroutine leak
}
```

### Race Detection

```bash
go test -race ./...
```

Always run tests with `-race` flag to catch data races.

### synctest for Time-Based Tests

```go
func TestRateLimiter(t *testing.T) {
    synctest.Run(func() {
        limiter := NewRateLimiter(10, time.Second)

        // exhaust limit
        for range 10 {
            limiter.Allow()
        }

        // should be limited
        if limiter.Allow() {
            t.Fatal("should be rate limited")
        }

        // advance virtual time
        time.Sleep(time.Second)
        synctest.Wait()

        // should be allowed
        if !limiter.Allow() {
            t.Fatal("should allow after reset")
        }
    })
}
```

---

## Anti-Patterns

| Pattern | Why It's Wrong | Fix |
|---------|----------------|-----|
| Fire-and-forget goroutine | No way to stop or wait | Add stop/done channels |
| Embedded mutex | Exposes Lock/Unlock | Private `mu` field |
| `go func()` without cleanup | Goroutine leak | Track with WaitGroup or context |
| Polling `ctx.Err()` | Inefficient, wrong semantics | Select on `ctx.Done()` |
| Large channel buffers | Hides backpressure issues | Size 0 or 1, justify larger |
| Returning `context.Canceled` | Treats signal as error | Return `ErrCanceled` sentinel |
| Naked goroutine in constructor | No lifecycle control | Return shutdown function |
| `sync.Mutex` for read-heavy | Unnecessary contention | Use `sync.RWMutex` |

---

## Integration Notes

- **go-error-handling**: Return `ErrCanceled` sentinel, not `context.Canceled`
- **go-testing**: Always use `-race` flag, prefer `t.Context()` for test contexts
- **go-interfaces**: Consumer-side interfaces work well with channel-based APIs
