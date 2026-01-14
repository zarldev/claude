---
name: connectrpc-web
description: ConnectRPC web client patterns for React frontends. Use when making API calls, handling streaming responses, or integrating with backend services.
triggers:
  keywords:
    - api
    - fetch
    - query
    - mutation
    - tanstack
    - react-query
    - connectrpc
    - client
  keywordPatterns:
    - "\\buse(?:Query|Mutation)\\b"
    - "\\bclient\\b"
  pathPatterns:
    - "**/hooks/use*.ts"
    - "**/hooks/use*.tsx"
    - "**/gen/**/*_connect.ts"
    - "**/lib/api.ts"
    - "**/lib/clients.ts"
  contentPatterns:
    - "@connectrpc/connect"
    - "createPromiseClient"
    - "createConnectTransport"
    - "useQuery"
    - "useMutation"
  intentPatterns:
    - "(?:call|fetch|query).*api"
    - "(?:create|use).*(?:hook|client)"
    - "(?:streaming|real-?time).*(?:data|update)"
priority: 6
related-skills:
  - react-tailwind
  - connectrpc-patterns
  - clerk-auth
---

# ConnectRPC Web Client Patterns

## Setup

### Transport Configuration

```tsx
// lib/api.ts
import { createConnectTransport } from '@connectrpc/connect-web'

export const transport = createConnectTransport({
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080',
})
```

### Client Creation

```tsx
// lib/clients.ts
import { createPromiseClient } from '@connectrpc/connect'
import { UserService } from '@/gen/user/v1/user_connect'
import { transport } from './api'

export const userClient = createPromiseClient(UserService, transport)
```

---

## Query Key Patterns

**CRITICAL**: Use structured query keys for proper cache invalidation.

```tsx
// GOOD - Structured query keys
const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters: string) => [...userKeys.lists(), { filters }] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
}

// BAD - String keys
const queryKey = 'user-123'  // NO! Can't invalidate related queries
const queryKey = ['user', id]  // Better but not structured
```

---

## Basic Queries with React Query

```tsx
// hooks/useUsers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userClient } from '@/lib/clients'

// Get single user
export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: async () => {
      const response = await userClient.getUser({ id })
      return response.user
    },
    enabled: !!id,  // Don't fetch if no ID
  })
}

// List users
export function useUsers() {
  return useQuery({
    queryKey: userKeys.lists(),
    queryFn: async () => {
      const response = await userClient.listUsers({})
      return response.users
    },
  })
}
```

---

## Mutations with Cache Invalidation

```tsx
// GOOD - Invalidate related queries on success
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { name: string; email: string }) => {
      const response = await userClient.createUser(input)
      return response.user
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
    },
  })
}

// GOOD - Invalidate both detail and list
export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { id: string; name: string; email: string }) => {
      const response = await userClient.updateUser(input)
      return response.user
    },
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(user!.id) })
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
    },
  })
}

// BAD - Missing cache invalidation
export function useDeleteUser() {
  return useMutation({
    mutationFn: async (id: string) => {
      await userClient.deleteUser({ id })
    },
    // NO onSuccess - list will show stale data!
  })
}
```

---

## Component Usage Pattern

**Order**: Error → Loading → Empty → Data

```tsx
function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading, error } = useUser(userId)
  const updateUser = useUpdateUser()

  // 1. Error first
  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-destructive">
        Failed to load user: {error.message}
      </div>
    )
  }

  // 2. Loading only when no data (allows background refetch)
  if (isLoading && !user) {
    return <Skeleton className="h-48 w-full" />
  }

  // 3. Empty state
  if (!user) {
    return <div className="text-muted-foreground">User not found</div>
  }

  // 4. Data
  return (
    <Card>
      <CardHeader>
        <CardTitle>{user.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{user.email}</p>
        <Button
          onClick={() => updateUser.mutateAsync({ id: userId, name: 'New Name', email: user.email })}
          disabled={updateUser.isPending}
        >
          {updateUser.isPending ? 'Updating...' : 'Update Name'}
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

## Streaming Responses

```tsx
export function useWatchUser(userId: string) {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!userId) return

    const abortController = new AbortController()

    async function watch() {
      try {
        setIsConnected(true)

        for await (const response of userClient.watchUser(
          { id: userId },
          { signal: abortController.signal }
        )) {
          setUser(response.user ?? null)
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err)
        }
      } finally {
        setIsConnected(false)
      }
    }

    watch()

    return () => {
      abortController.abort()
    }
  }, [userId])

  return { user, error, isConnected }
}
```

---

## Error Handling

```tsx
import { ConnectError, Code } from '@connectrpc/connect'

function handleConnectError(error: unknown): string {
  if (error instanceof ConnectError) {
    switch (error.code) {
      case Code.NotFound:
        return 'Resource not found'
      case Code.PermissionDenied:
        return 'You do not have permission'
      case Code.Unauthenticated:
        window.location.href = '/login'
        return 'Please log in'
      case Code.InvalidArgument:
        return `Invalid input: ${error.message}`
      default:
        return `Error: ${error.message}`
    }
  }
  return 'An unexpected error occurred'
}

// Usage in component
function UserForm() {
  const createUser = useCreateUser()

  const handleSubmit = async (data: FormData) => {
    try {
      await createUser.mutateAsync(data)
    } catch (error) {
      toast.error(handleConnectError(error))
    }
  }
}
```

---

## Authentication Headers

```tsx
// With Clerk
import { useAuth } from '@clerk/clerk-react'

export function useAuthenticatedTransport() {
  const { getToken } = useAuth()

  return useMemo(() => createConnectTransport({
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
  }), [getToken])
}

// Static token (simpler cases)
export const transport = createConnectTransport({
  baseUrl: import.meta.env.VITE_API_URL,
  interceptors: [
    (next) => async (req) => {
      const token = localStorage.getItem('auth_token')
      if (token) {
        req.header.set('Authorization', `Bearer ${token}`)
      }
      return next(req)
    },
  ],
})
```

---

## Optimistic Updates

```tsx
export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateUserInput) => {
      const response = await userClient.updateUser(input)
      return response.user
    },
    onMutate: async (newUser) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: userKeys.detail(newUser.id) })

      // Snapshot previous value
      const previousUser = queryClient.getQueryData(userKeys.detail(newUser.id))

      // Optimistically update
      queryClient.setQueryData(userKeys.detail(newUser.id), newUser)

      return { previousUser }
    },
    onError: (err, newUser, context) => {
      // Rollback on error
      queryClient.setQueryData(
        userKeys.detail(newUser.id),
        context?.previousUser
      )
    },
    onSettled: (data, error, variables) => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: userKeys.detail(variables.id) })
    },
  })
}
```

---

## Query Client Setup

```tsx
// main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectError, Code } from '@connectrpc/connect'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: (failureCount, error) => {
        if (error instanceof ConnectError) {
          // Don't retry auth errors
          if (error.code === Code.Unauthenticated) return false
          if (error.code === Code.PermissionDenied) return false
          if (error.code === Code.NotFound) return false
        }
        return failureCount < 3
      },
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  )
}
```

---

## Anti-Patterns

| Pattern | Why It's Wrong | Fix |
|---------|----------------|-----|
| String query keys | Can't invalidate related queries | Structured key factories |
| Missing `enabled` flag | Fetches with undefined params | `enabled: !!id` |
| `isLoading` without `&& !data` | Blocks UI on background refetch | `isLoading && !data` |
| Missing error handling | Silent failures | Check `error` first |
| No cache invalidation | Stale data after mutation | `onSuccess` with `invalidateQueries` |
| `useEffect` for fetching | Race conditions, no caching | `useQuery` |
| Inline queryFn | Can't reuse, harder to test | Extract to hook |
| Not using AbortController | Memory leaks on unmount | Pass `signal` to streaming |

---

## Integration Notes

- **react-tailwind**: Use theme-aware styling for loading/error states
- **connectrpc-patterns**: Backend defines the proto services this consumes
- **clerk-auth**: Use `useAuth().getToken()` in transport interceptor
