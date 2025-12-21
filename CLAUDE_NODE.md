# Bruno's TypeScript/React Design Philosophy

See [CLAUDE.md](./CLAUDE.md) for cross-language principles and overall architecture.
See [CLAUDE_GO.md](./CLAUDE_GO.md) for Go backend and frontend embedding.

## Core Principles

**Target: Node 23+ / React 19+ / TypeScript 5.5+**

**NO Next.js** - React Router + Vite. Client-side SPA embedded in Go binary.

**Proto types are source of truth** - Generated from protobuf, no manual API types.

**Semantic CSS only** - CSS variables for theming, no hardcoded colors.

**React 19 patterns** - ref as prop (no forwardRef), use() hook, Actions for forms.

## Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // proxy API calls to Go backend in dev
  server: {
    proxy: {
      "/api": "http://localhost:8080",
      "/connect": "http://localhost:8080",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
})
```

## Environment Variables

```typescript
// lib/env.ts
const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? "",
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const

export { env }
```

- Prefix with `VITE_` for client exposure
- Access via `import.meta.env`
- Type in `vite-env.d.ts`:

```typescript
// vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

## Type System

### Proto Types are Source of Truth
With ConnectRPC, generated proto types provide type safety. Don't duplicate types:
```typescript
// generated from proto - use these directly
import { User, CreateUserRequest } from "@/gen/user/v1/user_pb"

// don't create parallel type definitions
type User = { id: string; name: string }  // BAD - duplicates proto
```

### When to Use Local Types
Only create local types for:
- UI-specific state (form state, UI flags)
- Derived/computed values not in proto
- Third-party integrations without protos

```typescript
// UI-specific - not in proto
interface UserCardProps {
  user: User        // proto type
  isExpanded: boolean  // UI state
  onEdit: () => void   // callback
}

// form state may differ from proto
interface UserFormValues {
  email: string
  name: string
  confirmEmail: string  // UI-only field
}
```

### Strict TypeScript
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

## Error Handling

### Result Types Over Exceptions
```typescript
type Result<T, E = Error> =
    | { ok: true; value: T }
    | { ok: false; error: E }

function parseConfig(raw: string): Result<Config, ParseError> {
    // ...
}

const result = parseConfig(input)
if (!result.ok) {
    // handle error with full type info
    return
}
// result.value is Config
```

### When to Throw
- Programmer errors (bugs, invariant violations)
- Framework boundaries that expect exceptions

### When to Return Errors
- Expected failures (validation, not found, network errors)
- Business logic errors

### Result Types vs TanStack Query
- **Result types**: Use for utility functions, parsers, non-React logic
- **TanStack Query**: Use for server state in React components - it handles loading/error/data states
- **Don't mix**: Don't wrap TanStack Query hooks in Result types - use `isError`/`error` from the hook

```tsx
// TanStack Query handles errors via hook state
const { data, isLoading, error } = useUser(id)
if (error) {
  // error is the thrown/rejected value
}

// Result types for non-hook logic
function validateEmail(email: string): Result<string, ValidationError> {
  // ...
}
```

## Naming Conventions

### Variables & Functions
- camelCase for variables and functions
- PascalCase for types, interfaces, classes
- SCREAMING_SNAKE_CASE for true constants

### Files
- kebab-case for all file names: `user-service.ts`, `user-card.tsx`
- Components: `user-card.tsx` exports `UserCard`
- Hooks: `use-user.ts` exports `useUser`
- No PascalCase file names - keeps filesystem consistent

## Code Organization

### Frontend Structure
```
frontend/src/
├── main.tsx              # entry point
├── routes.tsx            # React Router config
├── gen/                  # generated from protos (gitignored)
├── components/
│   ├── ui/               # shadcn primitives
│   └── app/              # application components
├── hooks/                # custom hooks (useUser, useAuth, etc.)
├── lib/
│   ├── api-client.ts     # ConnectRPC transport setup
│   ├── query-client.ts   # TanStack Query setup
│   └── utils.ts          # cn(), formatDate(), etc.
├── pages/                # route components
├── layouts/              # layout components
└── styles/
    └── globals.css       # CSS variables, Tailwind imports
```

### Barrel Exports
- Avoid barrel exports in most cases
- Only use for truly public APIs
- Import directly from files: `import { Button } from "@/components/ui/button"`

### The cn() Utility
shadcn uses `cn()` for class merging. It combines clsx and tailwind-merge:
```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// usage - merges classes, handles conflicts
cn("px-4 py-2", condition && "bg-primary", className)
// tailwind-merge resolves conflicts: cn("px-2", "px-4") → "px-4"
```

## Testing

### Setup
```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

```typescript
// src/test/setup.ts
import "@testing-library/jest-dom/vitest"
```

### Component Testing
```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UserCard } from "./user-card"

const testUser = { id: "1", name: "John", email: "john@example.com" }

describe("UserCard", () => {
  it("displays user name", () => {
    render(<UserCard user={testUser} />)

    expect(screen.getByText("John")).toBeInTheDocument()
  })

  it("calls onEdit when edit button clicked", async () => {
    const onEdit = vi.fn()
    const user = userEvent.setup()

    render(<UserCard user={testUser} onEdit={onEdit} />)

    await user.click(screen.getByRole("button", { name: /edit/i }))

    expect(onEdit).toHaveBeenCalledOnce()
  })
})
```

### Testing Hooks
```tsx
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useUser } from "./use-user"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useUser", () => {
  it("fetches user data", async () => {
    const { result } = renderHook(() => useUser("123"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.name).toBe("John")
  })
})
```

### Test Doubles
Same hierarchy as Go:
1. Real implementations
2. In-memory implementations
3. Mocks (avoid)

For API mocking in integration tests, use MSW (Mock Service Worker):
```typescript
// src/test/mocks/handlers.ts
import { http, HttpResponse } from "msw"

export const handlers = [
  http.post("*/connect/user.v1.UserService/GetUser", () => {
    return HttpResponse.json({ id: "1", name: "John" })
  }),
]
```

## API Clients

### ConnectRPC (Preferred)
When backend uses ConnectRPC, generate TypeScript clients from proto definitions:

```bash
# buf.gen.yaml generates TypeScript clients
buf generate
```

### API Client Setup
```typescript
// lib/api-client.ts
import { createClient } from "@connectrpc/connect"
import { createConnectTransport } from "@connectrpc/connect-web"
import { UserService } from "@/gen/user/v1/user_connect"

const transport = createConnectTransport({
  // empty string = same origin (works with Vite proxy in dev, embedded in prod)
  baseUrl: import.meta.env.VITE_API_URL ?? "",
})

// export typed client for use in hooks
export const userClient = createClient(UserService, transport)

// for multiple services, export each client
// export const authClient = createClient(AuthService, transport)
// export const orderClient = createClient(OrderService, transport)
```

### Usage
```typescript
// fully typed request/response
const user = await userClient.getUser({ id: "123" })
```

### Benefits Over Manual Fetch
- Type-safe requests and responses from proto
- No manual URL building or JSON parsing
- Automatic error handling with typed errors
- Streaming support built-in
- Single source of truth (proto files)

### Error Handling with Connect
ConnectRPC codes map directly from Go backend to TypeScript frontend:

| Go Backend | TypeScript Frontend | Meaning |
|------------|---------------------|---------|
| `connect.CodeNotFound` | `Code.NotFound` | Resource not found |
| `connect.CodeInvalidArgument` | `Code.InvalidArgument` | Bad input |
| `connect.CodeUnauthenticated` | `Code.Unauthenticated` | Not logged in |
| `connect.CodePermissionDenied` | `Code.PermissionDenied` | Not authorized |
| `connect.CodeAlreadyExists` | `Code.AlreadyExists` | Conflict |
| `connect.CodeInternal` | `Code.Internal` | Server error |

```typescript
import { ConnectError, Code } from "@connectrpc/connect"

// app-specific error classes - define these in lib/errors.ts
class NotFoundError extends Error {}
class ValidationError extends Error {}
class AuthError extends Error {}
class ForbiddenError extends Error {}

async function getUser(id: string): Promise<Result<User>> {
  try {
    const user = await userClient.getUser({ id })
    return { ok: true, value: user }
  } catch (err) {
    if (err instanceof ConnectError) {
      switch (err.code) {
        case Code.NotFound:
          return { ok: false, error: new NotFoundError(err.message) }
        case Code.InvalidArgument:
          return { ok: false, error: new ValidationError(err.message) }
        case Code.Unauthenticated:
          // redirect to login or return error
          return { ok: false, error: new AuthError(err.message) }
        case Code.PermissionDenied:
          return { ok: false, error: new ForbiddenError(err.message) }
      }
    }
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
```

The error message from `err.message` contains the original Go error text, preserving the error narrative across the wire.

## Styling

### Tailwind v4 with shadcn
Tailwind v4 uses CSS-first configuration. shadcn defines HSL values as CSS variables:

```css
/* globals.css - define theme tokens as HSL values */
@import "tailwindcss";

:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --primary: 0 0% 9%;
  --primary-foreground: 0 0% 98%;
  --secondary: 0 0% 96.1%;
  --muted: 0 0% 96.1%;
  --muted-foreground: 0 0% 45.1%;
  --accent: 0 0% 96.1%;
  --border: 0 0% 89.8%;
  --ring: 0 0% 3.9%;
  --radius: 0.5rem;
}

.dark {
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 0 0% 9%;
  --secondary: 0 0% 14.9%;
  --muted: 0 0% 14.9%;
  --muted-foreground: 0 0% 63.9%;
  --accent: 0 0% 14.9%;
  --border: 0 0% 14.9%;
  --ring: 0 0% 83.1%;
}

/* Tailwind v4 @theme maps CSS vars to utility classes */
@theme {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-border: hsl(var(--border));
  --color-ring: hsl(var(--ring));
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 4px);
}
```

This enables Tailwind classes like `bg-background`, `text-foreground`, `border-border`.

### Usage in Components
```tsx
// Use semantic classes, not specific colors
<div className="bg-background text-foreground">
  <button className="bg-primary text-primary-foreground">
    Click me
  </button>
  <p className="text-muted-foreground">Helper text</p>
</div>

// Never hardcode colors
<div className="bg-white dark:bg-gray-900">  // BAD
<div className="bg-background">              // GOOD
```

### shadcn/ui Components
- Copy components into codebase (not a dependency)
- Customize via CSS variables, not component props
- See Code Organization for directory structure

### Theme Switching
```tsx
// Use class-based dark mode
<html className={theme === 'dark' ? 'dark' : ''}>

// Or system preference
@media (prefers-color-scheme: dark) {
  :root {
    /* dark theme variables */
  }
}
```

### Styling Anti-Patterns
- Hardcoded colors (`bg-blue-500`, `text-gray-900`)
- Inline styles for themeable properties
- Separate light/dark component variants
- Color values in component files

## Routing

### React Router Setup
```tsx
// routes.tsx
import { createBrowserRouter, RouterProvider } from "react-router-dom"

const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "users", element: <UsersPage /> },
      { path: "users/:id", element: <UserDetailPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
])

export function App() {
  return <RouterProvider router={router} />
}
```

### Route Layout
```tsx
// layouts/root-layout.tsx
import { Outlet } from "react-router-dom"

export function RootLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  )
}
```

### Route Parameters
```tsx
import { useParams } from "react-router-dom"

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: user, isLoading } = useUser(id!)

  if (isLoading) return <UserSkeleton />
  if (!user) return <NotFound />

  return <UserDetail user={user} />
}
```

### Navigation
```tsx
import { Link, useNavigate } from "react-router-dom"

// declarative
<Link to="/users/123" className="text-primary hover:underline">
  View User
</Link>

// programmatic
const navigate = useNavigate()
async function handleSubmit() {
  await createUser(data)
  navigate("/users")
}
```

## React Patterns

### Component Structure
```tsx
// props interface at top
interface UserCardProps {
  user: User
  onEdit?: () => void
}

// named export, not default
export function UserCard({ user, onEdit }: UserCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-foreground">{user.name}</h3>
      {onEdit && (
        <Button variant="secondary" onClick={onEdit}>
          Edit
        </Button>
      )}
    </div>
  )
}
```

### State Management
- Local state first (`useState`)
- Lift state only when needed
- Context for truly global state (theme, auth)
- TanStack Query for server state (see Data Fetching)

### Hooks Patterns
```tsx
// custom hooks extract logic
function useUser(id: string) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () => userClient.getUser({ id }),
  })
}
```

### React 19 Hooks
```tsx
import { use, useOptimistic, useActionState } from "react"

// use() - read promises and context directly
function UserProfile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise)  // suspends until resolved
  return <div>{user.name}</div>
}

// use() with context - replaces useContext
function ThemeButton() {
  const theme = use(ThemeContext)  // works in conditionals too
  return <button className={theme}>Click</button>
}

// useOptimistic - optimistic UI updates
function LikeButton({ likes, onLike }: Props) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    likes,
    (current, _) => current + 1
  )

  async function handleLike() {
    addOptimisticLike(null)  // immediately show +1
    await onLike()           // then sync with server
  }

  return <button onClick={handleLike}>{optimisticLikes} likes</button>
}

// useActionState - form actions with pending state
function SubscribeForm() {
  const [state, submitAction, isPending] = useActionState(
    async (prevState: string | null, formData: FormData) => {
      const email = formData.get("email") as string
      await subscribeUser(email)
      return "Subscribed!"
    },
    null
  )

  return (
    <form action={submitAction}>
      <input name="email" type="email" disabled={isPending} />
      <button disabled={isPending}>
        {isPending ? "Subscribing..." : "Subscribe"}
      </button>
      {state && <p>{state}</p>}
    </form>
  )
}
```

### Error Boundaries
Catch render errors and display fallback UI:
```tsx
// components/error-boundary.tsx
import { Component, ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-4 text-destructive">
          Something went wrong. Please refresh.
        </div>
      )
    }
    return this.props.children
  }
}

// usage - wrap routes or major sections
<ErrorBoundary fallback={<ErrorPage />}>
  <UserDetailPage />
</ErrorBoundary>
```

### Code Splitting
Lazy load routes for smaller initial bundle:
```tsx
import { lazy, Suspense } from "react"

const SettingsPage = lazy(() => import("./pages/settings-page"))

// in router
{
  path: "settings",
  element: (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsPage />
    </Suspense>
  ),
}
```

### Refs in React 19
Pass `ref` as a regular prop - do NOT use `forwardRef`:
```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>
  label?: string
}

export function Input({ ref, label, className, ...props }: InputProps) {
  return (
    <div>
      {label && <label>{label}</label>}
      <input ref={ref} className={cn("...", className)} {...props} />
    </div>
  )
}

// usage
<Input ref={inputRef} label="Email" />
```

## Data Fetching

### TanStack Query with ConnectRPC
```tsx
// lib/query-client.ts
import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
})

// main.tsx
import { QueryClientProvider } from "@tanstack/react-query"

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
```

### Query Hooks
```tsx
// hooks/use-users.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { userClient } from "@/lib/api-client"

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => userClient.listUsers({}),
  })
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ["users", id],
    queryFn: () => userClient.getUser({ id }),
    enabled: !!id,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateUserRequest) => userClient.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
    },
  })
}
```

## Form Handling

### react-hook-form + zod + Proto Types
```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ConnectError, Code } from "@connectrpc/connect"
import { useNavigate } from "react-router-dom"

// zod schema matching proto message
const createUserSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().min(1, "Name required").max(100),
})

type CreateUserForm = z.infer<typeof createUserSchema>

export function CreateUserForm() {
  const navigate = useNavigate()
  const createUser = useCreateUser()

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      name: "",
    },
  })

  async function onSubmit(data: CreateUserForm) {
    try {
      await createUser.mutateAsync(data)
      navigate("/users")
    } catch (err) {
      // ConnectError handling
      if (err instanceof ConnectError) {
        if (err.code === Code.AlreadyExists) {
          form.setError("email", { message: "Email already in use" })
          return
        }
      }
      throw err
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          {...form.register("email")}
          className={form.formState.errors.email ? "border-destructive" : ""}
        />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">
            {form.formState.errors.email.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="text-sm text-destructive">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={createUser.isPending}>
        {createUser.isPending ? "Creating..." : "Create User"}
      </Button>
    </form>
  )
}
```

### Form with shadcn Form Components
```tsx
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

export function CreateUserForm() {
  // ... form setup same as above

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={createUser.isPending}>
          Create User
        </Button>
      </form>
    </Form>
  )
}
```

## Date & Time

### UTC from Backend, Local Display
All dates from backend are UTC. Convert to local timezone only for display.

```tsx
import { format, formatDistanceToNow } from "date-fns"

// proto timestamp comes as Date or string
interface User {
  createdAt: Date  // UTC from backend
}

// format for display - automatically uses local timezone
function formatDate(date: Date): string {
  return format(date, "PPP")  // "April 29, 2024"
}

function formatDateTime(date: Date): string {
  return format(date, "PPP p")  // "April 29, 2024 at 3:45 PM"
}

function formatRelative(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true })  // "3 hours ago"
}

// usage in component
export function UserCard({ user }: { user: User }) {
  return (
    <div>
      <p>Created: {formatDate(user.createdAt)}</p>
      <p className="text-muted-foreground">
        {formatRelative(user.createdAt)}
      </p>
    </div>
  )
}
```

### Sending Dates to Backend
```tsx
// current time as UTC ISO string
const request = {
  scheduledAt: new Date().toISOString(),  // "2024-04-29T15:30:00.000Z"
}

// date-only: send as YYYY-MM-DD string, let backend interpret
const dateOnly = format(selectedDate, "yyyy-MM-dd")  // "2024-04-29"
```

### Date Input Handling
```tsx
import { format, parseISO } from "date-fns"

// Date → input value
const inputValue = format(date, "yyyy-MM-dd")

// input value → Date (parses as local midnight)
const parsed = parseISO(inputValue)

// datetime-local input
const datetimeValue = format(date, "yyyy-MM-dd'T'HH:mm")
const parsedDatetime = parseISO(datetimeInputValue)
```

### Timezone Gotchas
```tsx
// parseISO("2024-04-29") → local midnight, NOT UTC midnight
// parseISO("2024-04-29T00:00:00Z") → UTC midnight

// for UTC midnight specifically:
import { parseISO } from "date-fns"
const utcMidnight = parseISO(dateString + "T00:00:00Z")
```

## Loading States

### Skeleton Components
Use shadcn Skeleton for loading states:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export function UserCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-24" />
    </div>
  )
}

export function UserListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <UserCardSkeleton key={i} />
      ))}
    </div>
  )
}
```

### Loading Pattern in Pages
```tsx
export function UsersPage() {
  const { data: users, isLoading, error } = useUsers()

  if (isLoading) return <UserListSkeleton />
  if (error) return <ErrorDisplay error={error} />
  if (!users?.length) return <EmptyState message="No users found" />

  return (
    <div className="space-y-4">
      {users.map(user => (
        <UserCard key={user.id} user={user} />
      ))}
    </div>
  )
}
```

### Button Loading State
```tsx
<Button disabled={isPending}>
  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {isPending ? "Saving..." : "Save"}
</Button>
```

## Icons

### lucide-react
```tsx
import { User, Settings, ChevronRight, Loader2, Check, X } from "lucide-react"

// size with className
<User className="h-4 w-4" />
<Settings className="h-5 w-5 text-muted-foreground" />

// in buttons
<Button>
  <User className="mr-2 h-4 w-4" />
  Profile
</Button>

// icon-only button
<Button variant="ghost" size="icon">
  <Settings className="h-4 w-4" />
  <span className="sr-only">Settings</span>
</Button>
```

### Icon Sizing Convention
- `h-4 w-4` - inline with text, buttons
- `h-5 w-5` - standalone small
- `h-6 w-6` - standalone medium
- `h-8 w-8` or larger - hero/empty states

## Performance

### useMemo
Memoize expensive calculations:
```tsx
function UserList({ users, filter }: Props) {
  // memoize filtered list
  const filteredUsers = useMemo(
    () => users.filter(u => u.name.toLowerCase().includes(filter.toLowerCase())),
    [users, filter]
  )

  return filteredUsers.map(user => <UserCard key={user.id} user={user} />)
}
```

### useCallback
Memoize callbacks passed to children:
```tsx
function UserList({ users }: Props) {
  const queryClient = useQueryClient()

  // memoize to prevent child re-renders
  const handleDelete = useCallback(
    (id: string) => {
      deleteUser(id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["users"] })
      })
    },
    [queryClient]
  )

  return users.map(user => (
    <UserCard key={user.id} user={user} onDelete={handleDelete} />
  ))
}
```

### When to Use
- `useMemo`: expensive calculations, derived data, referential equality for deps
- `useCallback`: callbacks passed to memoized children, callbacks in deps arrays
- Don't overuse - measure first, most components don't need it

### React.memo
Prevent re-renders when props unchanged:
```tsx
export const UserCard = memo(function UserCard({ user, onDelete }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4">
      {/* ... */}
    </div>
  )
})
```

## Anti-Patterns

See [CLAUDE.md](./CLAUDE.md) for universal anti-patterns. TypeScript/React-specific:

- ❌ `any` type (use `unknown` and narrow)
- ❌ Type assertions without validation (`as Type`)
- ❌ Barrel files that export everything
- ❌ Throwing for expected errors (use Result types)
- ❌ Fire-and-forget promises
- ❌ Default exports (use named exports)
- ❌ Hardcoded colors in Tailwind classes
- ❌ Prop drilling (use composition or context)
- ❌ Next.js (use React Router + Vite)
- ❌ Manual fetch calls (use generated ConnectRPC client)
- ❌ Overusing useMemo/useCallback (measure first)
- ❌ `forwardRef` (pass ref as prop in React 19)
- ❌ `useContext` (use `use(Context)` in React 19)
