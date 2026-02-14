---
name: clerk-auth
description: "Clerk authentication patterns for React and Go - protected routes, auth hooks, JWT middleware, ConnectRPC auth interceptors. Use when implementing authentication or authorization with Clerk."
---

# Clerk Authentication Patterns

## React Frontend

### Provider Setup

```tsx
// main.tsx
import { ClerkProvider } from '@clerk/clerk-react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')
}

function App() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <Router />
    </ClerkProvider>
  )
}
```

---

## Protected Routes

```tsx
// GOOD - Using Clerk components
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}

// Usage in router
function Router() {
  return (
    <Routes>
      <Route path="/login" element={<SignIn />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

// BAD - Manual redirect without Clerk components
function ProtectedRoute({ children }) {
  const { isSignedIn } = useUser()
  if (!isSignedIn) {
    window.location.href = '/login'  // NO! Use RedirectToSignIn
    return null
  }
  return children
}
```

---

## Using Auth Hooks

```tsx
import { useAuth, useUser } from '@clerk/clerk-react'

function UserProfile() {
  const { isLoaded, isSignedIn, user } = useUser()
  const { getToken, signOut } = useAuth()

  // Always check isLoaded first
  if (!isLoaded) {
    return <Skeleton className="h-20 w-full" />
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <img
          src={user.imageUrl}
          alt={user.fullName ?? 'User'}
          className="h-12 w-12 rounded-full"
        />
        <div>
          <p className="font-medium">{user.fullName}</p>
          <p className="text-sm text-muted-foreground">
            {user.primaryEmailAddress?.emailAddress}
          </p>
        </div>
      </div>
      <Button variant="outline" onClick={() => signOut()}>
        Sign Out
      </Button>
    </div>
  )
}
```

---

## Auth in API Calls

```tsx
// GOOD - Transport with auth interceptor
import { useAuth } from '@clerk/clerk-react'
import { createConnectTransport } from '@connectrpc/connect-web'

function useAuthenticatedClient() {
  const { getToken } = useAuth()

  const transport = useMemo(() => {
    return createConnectTransport({
      baseUrl: import.meta.env.VITE_API_URL,
      interceptors: [
        (next) => async (req) => {
          const token = await getToken()
          if (token) {
            req.header.set('Authorization', `Bearer ${token}`)
          }
          return next(req)
        },
      ],
    })
  }, [getToken])

  return useMemo(() => createPromiseClient(UserService, transport), [transport])
}

// BAD - Fetching token on every call
async function fetchUser(id: string, getToken: () => Promise<string | null>) {
  const token = await getToken()  // Called every time!
  // ...
}
```

---

## Sign In/Up Components

```tsx
import { SignIn, SignUp } from '@clerk/clerk-react'

function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-card shadow-lg',
          },
        }}
        redirectUrl="/dashboard"
      />
    </div>
  )
}

function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-card shadow-lg',
          },
        }}
        redirectUrl="/onboarding"
      />
    </div>
  )
}
```

---

## Go Backend

### HTTP Middleware

```go
package auth

import (
    "context"
    "net/http"
    "strings"

    "github.com/clerk/clerk-sdk-go/v2/jwt"
)

type contextKey string

const userIDKey contextKey = "user_id"

func Middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := extractToken(r)
        if token == "" {
            http.Error(w, "unauthorized", http.StatusUnauthorized)
            return
        }

        claims, err := jwt.Verify(r.Context(), &jwt.VerifyParams{
            Token: token,
        })
        if err != nil {
            http.Error(w, "invalid token", http.StatusUnauthorized)
            return
        }

        ctx := context.WithValue(r.Context(), userIDKey, claims.Subject)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func extractToken(r *http.Request) string {
    auth := r.Header.Get("Authorization")
    if auth == "" {
        return ""
    }

    parts := strings.SplitN(auth, " ", 2)
    if len(parts) != 2 || parts[0] != "Bearer" {
        return ""
    }

    return parts[1]
}

func UserID(ctx context.Context) (string, bool) {
    id, ok := ctx.Value(userIDKey).(string)
    return id, ok
}
```

### ConnectRPC Interceptor

```go
package auth

import (
    "context"
    "errors"
    "fmt"
    "strings"

    "connectrpc.com/connect"
    "github.com/clerk/clerk-sdk-go/v2/jwt"
)

func Interceptor() connect.UnaryInterceptorFunc {
    return func(next connect.UnaryFunc) connect.UnaryFunc {
        return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
            token := req.Header().Get("Authorization")
            if token == "" {
                return nil, connect.NewError(
                    connect.CodeUnauthenticated,
                    errors.New("missing authorization header"),
                )
            }

            token = strings.TrimPrefix(token, "Bearer ")

            claims, err := jwt.Verify(ctx, &jwt.VerifyParams{
                Token: token,
            })
            if err != nil {
                return nil, connect.NewError(
                    connect.CodeUnauthenticated,
                    fmt.Errorf("verify token: %w", err),
                )
            }

            ctx = context.WithValue(ctx, userIDKey, claims.Subject)
            return next(ctx, req)
        }
    }
}
```

### Using in Handlers

```go
func (s *Server) CreateTimer(
    ctx context.Context,
    req *connect.Request[timerv1.CreateTimerRequest],
) (*connect.Response[timerv1.CreateTimerResponse], error) {
    userID, ok := auth.UserID(ctx)
    if !ok {
        return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("no user"))
    }

    timer, err := s.svc.CreateTimer(ctx, service.CreateTimerInput{
        UserID: userID,
        Name:   req.Msg.Name,
    })
    if err != nil {
        return nil, toConnectError(err)
    }

    return connect.NewResponse(&timerv1.CreateTimerResponse{
        Timer: toProtoTimer(timer),
    }), nil
}
```

---

## Conditional UI

```tsx
import { SignedIn, SignedOut, SignInButton, SignOutButton, UserButton } from '@clerk/clerk-react'

function NavBar() {
  return (
    <nav className="flex items-center justify-between p-4">
      <Logo />
      <SignedIn>
        <div className="flex items-center gap-4">
          <UserButton />
          <SignOutButton>
            <Button variant="ghost">Sign Out</Button>
          </SignOutButton>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex gap-2">
          <SignInButton mode="modal">
            <Button variant="ghost">Sign In</Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button>Sign Up</Button>
          </SignUpButton>
        </div>
      </SignedOut>
    </nav>
  )
}
```

---

## Role-Based Access

```tsx
// GOOD - Check metadata for roles
function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useUser()

  if (user?.publicMetadata?.role !== 'admin') {
    return null
  }

  return <>{children}</>
}

// Usage
function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <AdminOnly>
        <AdminPanel />
      </AdminOnly>
    </div>
  )
}

// BAD - Checking on every render without memoization
function AdminOnly({ children }) {
  const { user } = useUser()
  const isAdmin = checkAdminStatus(user)  // Expensive operation
  // ...
}
```

---

## Environment Variables

```bash
# Frontend (.env)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Backend
CLERK_SECRET_KEY=sk_test_...
```

---

## Anti-Patterns

| Pattern | Why It's Wrong | Fix |
|---------|----------------|-----|
| `window.location.href = '/login'` | Loses state, not declarative | Use `<RedirectToSignIn />` |
| Not checking `isLoaded` | Flash of wrong content | Always check `isLoaded` first |
| Storing token in localStorage | XSS vulnerable | Let Clerk manage tokens |
| Calling `getToken()` every request | Unnecessary async | Use transport interceptor |
| Manual JWT validation | Easy to get wrong | Use `clerk-sdk-go/jwt.Verify` |
| Hardcoding Clerk keys | Security risk | Use environment variables |
| Missing `SignedOut` fallback | Broken UX for logged out users | Always pair with `SignedIn` |
| `if (!user)` instead of `if (!isSignedIn)` | User can be null while loading | Use `isSignedIn` from `useUser` |

---

## Integration Notes

- **react-tailwind**: Style Clerk components with `appearance` prop using theme colors
- **connectrpc-web**: Add auth interceptor to transport for API calls
- **connectrpc-patterns**: Backend interceptor validates JWT and extracts user ID
