# zstyle - zarldev's Design Philosophy

Cross-language principles and coding style. Detailed patterns are in `.claude/skills/`.

## Core Principles

- **Errors tell a story** - Wrap at every failure point, log once at boundaries
- **Small, emergent interfaces** - Consumer-side definition, not design-first
- **Scope-based naming** - Smaller scope = shorter names
- **Build concrete first** - Poke the problem with reality, then abstract
- **Fakes over mocks** - In-memory implementations for testing
- **No fire-and-forget** - Every goroutine needs lifecycle management

## Architecture

### Single Binary Deployment

Go backend with React frontend compiled and embedded:
- API via ConnectRPC (gRPC-Web compatible)
- Static frontend assets via `embed.FS`
- SPA routing handled server-side

### Monorepo Structure

```
myapp/
├── cmd/server/           # Go entrypoint
├── service/              # business logic
├── repository/           # data access
├── transport/grpc/       # ConnectRPC handlers
│   └── gen/              # generated Go from protos
├── proto/                # protobuf definitions (source of truth)
├── frontend/             # React SPA (Vite)
│   ├── src/gen/          # generated TypeScript from protos
│   └── dist/             # build output (gitignored)
└── go.mod
```

### Layer Separation

Each layer owns its types - no shared "domain" package:
- Repository: database types
- Service: business logic types (no tags)
- Transport: request/response types (with wire format tags)

Map between layers at boundaries.

### Proto as Contract

Protobuf is the single source of truth:
- Generate Go server code (ConnectRPC)
- Generate TypeScript client code (ConnectRPC)
- No manual API type definitions

## Skills Reference

| Category | Skills |
|----------|--------|
| Go Core | `go-error-handling`, `go-interfaces`, `go-testing`, `go-concurrency`, `go-naming`, `go-types` |
| Infrastructure | `connectrpc-patterns`, `database-patterns`, `pkg-usage` |
| Frontend | `react-tailwind`, `connectrpc-web`, `clerk-auth` |
| Process | `systematic-debugging` |

## Quick Rules

### Error Handling
- Never: "failed to", "unable to", "could not"
- Always: `fmt.Errorf("context: %w", err)`
- Log once at boundaries, not throughout

### Naming
- Loop: `i`, `j`, `k`
- Short-lived: `u`, `r`, `w`
- Larger scope: `requestID`, `userCount`

### Code Quality
- Early returns over if/else chains
- Extract common operations from branches
- No duplication

### Testing
- `package_test` (black-box)
- Table-driven with `t.Run`
- `t.Context()` for context
- Fakes over mocks

## Anti-Patterns

- Primitive obsession
- Shared domain package
- Large interfaces
- Verbose error prefixes
- Logging every error
- Duplicated code in branches
- Design-first interfaces
- Premature abstraction
- Fire-and-forget goroutines
- Mocking when fakes work

## Remember

> "Errors tell a story"

> "Poke the problem with reality"

> "Scope-based naming is my jam"

> "Interface emergence, not design-first"
