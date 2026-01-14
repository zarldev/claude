---
name: connectrpc-patterns
description: ConnectRPC and Protocol Buffer patterns for Go services. Use when working with .proto files, gRPC services, buf generation, or ConnectRPC handlers.
triggers:
  keywords:
    - connectrpc
    - grpc
    - proto
    - protobuf
    - buf
  pathPatterns:
    - "**/*.proto"
    - "**/buf.yaml"
    - "**/buf.gen.yaml"
    - "**/*connect*.go"
  contentPatterns:
    - "connectrpc.com/connect"
    - "syntax.*proto3"
    - "buf generate"
  intentPatterns:
    - "(?:create|add).*(?:rpc|grpc|proto)"
    - "(?:generate|buf).*proto"
priority: 8
related-skills:
  - go-error-handling
  - go-interfaces
  - connectrpc-web
---

# ConnectRPC Patterns

## Project Structure

```
project/
├── proto/
│   ├── buf.yaml           # Buf configuration
│   ├── buf.gen.yaml       # Code generation config
│   └── service/
│       └── v1/
│           └── service.proto
├── transport/
│   └── grpc/
│       ├── gen/           # Generated code (do not edit)
│       │   └── service/
│       │       └── v1/
│       │           ├── service.pb.go
│       │           └── servicev1connect/
│       │               └── service.connect.go
│       └── server.go      # Handler implementation
└── frontend/
    └── src/
        └── gen/           # Generated TypeScript
```

## buf.yaml Configuration

```yaml
version: v2
modules:
  - path: proto
lint:
  use:
    - DEFAULT
breaking:
  use:
    - FILE
```

## buf.gen.yaml Configuration

```yaml
version: v2
plugins:
  # Go server
  - remote: buf.build/protocolbuffers/go
    out: transport/grpc/gen
    opt: paths=source_relative
  - remote: buf.build/connectrpc/go
    out: transport/grpc/gen
    opt: paths=source_relative
  # TypeScript client
  - remote: buf.build/bufbuild/es
    out: frontend/src/gen
  - remote: buf.build/connectrpc/es
    out: frontend/src/gen
```

## Proto File Best Practices

```protobuf
syntax = "proto3";

package myapp.user.v1;

option go_package = "github.com/zarldev/monorepo/project/transport/grpc/gen/user/v1;userv1";

import "google/protobuf/timestamp.proto";

// Service definition - actions, not CRUD
service UserService {
  // Create a new user
  rpc CreateUser(CreateUserRequest) returns (CreateUserResponse);

  // Get user by ID
  rpc GetUser(GetUserRequest) returns (GetUserResponse);

  // Stream user updates
  rpc WatchUser(WatchUserRequest) returns (stream WatchUserResponse);
}

// Request/Response naming: {Method}Request, {Method}Response
message CreateUserRequest {
  string name = 1;
  string email = 2;
}

message CreateUserResponse {
  User user = 1;
}

message GetUserRequest {
  string id = 1;
}

message GetUserResponse {
  User user = 1;
}

// Domain message
message User {
  string id = 1;
  string name = 2;
  string email = 3;
  google.protobuf.Timestamp created_at = 4;
}
```

## Handler Implementation

```go
package grpc

import (
    "context"

    "connectrpc.com/connect"
    userv1 "github.com/zarldev/monorepo/project/transport/grpc/gen/user/v1"
    "github.com/zarldev/monorepo/project/transport/grpc/gen/user/v1/userv1connect"
)

// Ensure interface satisfaction
var _ userv1connect.UserServiceHandler = (*UserServer)(nil)

type UserServer struct {
    svc *service.UserService
}

func NewUserServer(svc *service.UserService) *UserServer {
    return &UserServer{svc: svc}
}

func (s *UserServer) CreateUser(
    ctx context.Context,
    req *connect.Request[userv1.CreateUserRequest],
) (*connect.Response[userv1.CreateUserResponse], error) {
    // Map from proto to domain
    user, err := s.svc.CreateUser(ctx, service.CreateUserInput{
        Name:  req.Msg.Name,
        Email: req.Msg.Email,
    })
    if err != nil {
        return nil, toConnectError(err)
    }

    // Map from domain to proto
    return connect.NewResponse(&userv1.CreateUserResponse{
        User: toProtoUser(user),
    }), nil
}

func (s *UserServer) GetUser(
    ctx context.Context,
    req *connect.Request[userv1.GetUserRequest],
) (*connect.Response[userv1.GetUserResponse], error) {
    user, err := s.svc.User(ctx, service.UserID(req.Msg.Id))
    if err != nil {
        return nil, toConnectError(err)
    }

    return connect.NewResponse(&userv1.GetUserResponse{
        User: toProtoUser(user),
    }), nil
}
```

## Error Mapping

```go
package grpc

import (
    "errors"

    "connectrpc.com/connect"
    "github.com/zarldev/monorepo/project/service"
)

func toConnectError(err error) error {
    switch {
    case errors.Is(err, service.ErrNotFound):
        return connect.NewError(connect.CodeNotFound, err)
    case errors.Is(err, service.ErrInvalidInput):
        return connect.NewError(connect.CodeInvalidArgument, err)
    case errors.Is(err, service.ErrUnauthorized):
        return connect.NewError(connect.CodeUnauthenticated, err)
    case errors.Is(err, service.ErrForbidden):
        return connect.NewError(connect.CodePermissionDenied, err)
    case errors.Is(err, service.ErrConflict):
        return connect.NewError(connect.CodeAlreadyExists, err)
    default:
        return connect.NewError(connect.CodeInternal, err)
    }
}
```

## Type Mappers

```go
package grpc

import (
    "google.golang.org/protobuf/types/known/timestamppb"

    userv1 "github.com/zarldev/monorepo/project/transport/grpc/gen/user/v1"
    "github.com/zarldev/monorepo/project/service"
)

func toProtoUser(u service.User) *userv1.User {
    return &userv1.User{
        Id:        string(u.ID),
        Name:      u.Name,
        Email:     u.Email,
        CreatedAt: timestamppb.New(u.CreatedAt),
    }
}

func fromProtoUser(u *userv1.User) service.User {
    return service.User{
        ID:        service.UserID(u.Id),
        Name:      u.Name,
        Email:     u.Email,
        CreatedAt: u.CreatedAt.AsTime(),
    }
}
```

## Server Setup

```go
package main

import (
    "net/http"

    "connectrpc.com/connect"
    "golang.org/x/net/http2"
    "golang.org/x/net/http2/h2c"

    "github.com/zarldev/monorepo/project/transport/grpc"
    "github.com/zarldev/monorepo/project/transport/grpc/gen/user/v1/userv1connect"
)

func main() {
    mux := http.NewServeMux()

    // Create service handler
    userServer := grpc.NewUserServer(userService)

    // Mount with interceptors
    path, handler := userv1connect.NewUserServiceHandler(
        userServer,
        connect.WithInterceptors(
            loggingInterceptor(),
            authInterceptor(),
        ),
    )
    mux.Handle(path, handler)

    // HTTP/2 support without TLS (for development)
    server := &http.Server{
        Addr:    ":8080",
        Handler: h2c.NewHandler(mux, &http2.Server{}),
    }

    server.ListenAndServe()
}
```

## Interceptors

```go
package grpc

import (
    "context"
    "log/slog"

    "connectrpc.com/connect"
)

func loggingInterceptor() connect.UnaryInterceptorFunc {
    return func(next connect.UnaryFunc) connect.UnaryFunc {
        return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
            slog.InfoContext(ctx, "rpc call",
                "procedure", req.Spec().Procedure,
            )

            resp, err := next(ctx, req)
            if err != nil {
                slog.ErrorContext(ctx, "rpc error",
                    "procedure", req.Spec().Procedure,
                    "error", err,
                )
            }

            return resp, err
        }
    }
}

func authInterceptor() connect.UnaryInterceptorFunc {
    return func(next connect.UnaryFunc) connect.UnaryFunc {
        return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
            token := req.Header().Get("Authorization")
            if token == "" {
                return nil, connect.NewError(
                    connect.CodeUnauthenticated,
                    errors.New("missing authorization"),
                )
            }

            // Validate token and add to context
            ctx = withUserID(ctx, userID)

            return next(ctx, req)
        }
    }
}
```

## Streaming

```go
// Service-level sentinel for cancellation
var ErrCanceled = errors.New("canceled")

func (s *UserServer) WatchUser(
    ctx context.Context,
    req *connect.Request[userv1.WatchUserRequest],
    stream *connect.ServerStream[userv1.WatchUserResponse],
) error {
    userID := service.UserID(req.Msg.Id)

    // Subscribe to updates
    updates := s.svc.WatchUser(ctx, userID)

    for {
        select {
        case <-ctx.Done():
            return nil  // clean shutdown, client disconnected
        case update, ok := <-updates:
            if !ok {
                return nil  // channel closed, clean shutdown
            }
            if err := stream.Send(&userv1.WatchUserResponse{
                User: toProtoUser(update),
            }); err != nil {
                return fmt.Errorf("send update: %w", err)
            }
        }
    }
}
```

## Common Commands

```bash
# Generate code
buf generate

# Lint proto files
buf lint

# Check breaking changes
buf breaking --against '.git#branch=main'

# Format proto files
buf format -w
```

## Anti-Patterns

| Pattern | Why It's Wrong | Fix |
|---------|----------------|-----|
| `return ctx.Err()` in streams | Returns context error directly | `return nil` for clean shutdown |
| Inline proto → domain mapping | Repeated, error-prone | Dedicated mapper functions |
| Missing interface satisfaction check | Runtime errors | `var _ Handler = (*Server)(nil)` |
| Giant proto messages | Hard to evolve | Smaller, focused messages |
| CRUD service naming | Not action-oriented | Domain action names |
| Logging in handlers | Log at boundaries | Use interceptors |
| `errors.New()` in error mapping | Creates new error each time | Map to connect codes only |

---

## Integration Notes

- **go-error-handling**: Use sentinel errors, map in `toConnectError()`
- **go-interfaces**: Handler satisfies generated interface
- **connectrpc-web**: TypeScript client generation
- **go-types**: Separate proto types from domain types
