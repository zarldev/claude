---
name: react-tailwind
description: "React and Tailwind v4 patterns - theme-aware colors, component composition, shadcn/ui, loading/error/empty states. Use when building or styling React components."
---

# React + Tailwind v4 Patterns

## Tailwind v4 Theme-Aware Colors

**CRITICAL**: Always use theme-aware CSS variables for colors.

```tsx
// GOOD - Theme-aware colors (Tailwind v4)
<div className="bg-background text-foreground">
  <button className="bg-primary text-primary-foreground">
    Click me
  </button>
  <p className="text-muted-foreground">Secondary text</p>
</div>

// BAD - Hardcoded colors
<div className="bg-white text-black">  // NO! Not theme-aware
  <button className="bg-blue-500 text-white">  // NO!
    Click me
  </button>
</div>
```

## Common Theme Colors

```css
/* Available in index.css */
--background        /* Main background */
--foreground        /* Main text */
--card              /* Card backgrounds */
--card-foreground   /* Card text */
--primary           /* Primary actions */
--primary-foreground /* Text on primary */
--secondary         /* Secondary elements */
--secondary-foreground
--muted             /* Muted backgrounds */
--muted-foreground  /* Muted text */
--accent            /* Accent highlights */
--accent-foreground
--destructive       /* Destructive actions */
--destructive-foreground
--border            /* Borders */
--input             /* Input borders */
--ring              /* Focus rings */
```

## Component Patterns

### Basic Component
```tsx
interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
}

export function Button({
  variant = 'default',
  size = 'md',
  children,
  onClick,
  disabled,
  loading,
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        // Base styles
        'inline-flex items-center justify-center rounded-md font-medium',
        'transition-colors focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        // Variant styles
        {
          'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'default',
          'bg-destructive text-destructive-foreground hover:bg-destructive/90': variant === 'destructive',
          'border border-input bg-background hover:bg-accent': variant === 'outline',
          'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
        },
        // Size styles
        {
          'h-8 px-3 text-sm': size === 'sm',
          'h-10 px-4': size === 'md',
          'h-12 px-6 text-lg': size === 'lg',
        }
      )}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}
```

### Card Component
```tsx
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'rounded-lg border bg-card text-card-foreground shadow-sm',
      className
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col space-y-1.5 p-6">{children}</div>
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-2xl font-semibold leading-none tracking-tight">{children}</h3>
}

export function CardContent({ children }: { children: React.ReactNode }) {
  return <div className="p-6 pt-0">{children}</div>
}
```

## State Handling Patterns

### Loading States
```tsx
function UserList() {
  const { data, isLoading, error } = useUsers()

  // Error first
  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 p-4 text-destructive">
        {error.message}
      </div>
    )
  }

  // Loading only when no data
  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Empty state
  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Users className="h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">No users found</p>
      </div>
    )
  }

  // Data
  return (
    <ul className="divide-y divide-border">
      {data.map(user => (
        <UserItem key={user.id} user={user} />
      ))}
    </ul>
  )
}
```

### Form with Mutation
```tsx
function CreateUserForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const { mutate, isPending, error } = useCreateUser()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutate({ name, email })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          disabled={isPending}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          disabled={isPending}
        />
      </div>

      <Button type="submit" disabled={isPending} loading={isPending}>
        Create User
      </Button>
    </form>
  )
}
```

## Responsive Patterns

```tsx
// Mobile-first responsive design
<div className="
  grid grid-cols-1 gap-4
  sm:grid-cols-2
  lg:grid-cols-3
  xl:grid-cols-4
">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>

// Hide/show based on screen size
<nav className="hidden md:flex">Desktop nav</nav>
<nav className="flex md:hidden">Mobile nav</nav>

// Responsive text
<h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
  Heading
</h1>
```

## Dark Mode

```tsx
// Theme toggle
function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="rounded-md p-2 hover:bg-accent"
    >
      {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}
```

## shadcn/ui Components

This monorepo uses shadcn/ui. Import from the shared UI package:

```tsx
import { Button } from '@zarldev/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@zarldev/ui/card'
import { Input } from '@zarldev/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@zarldev/ui/dialog'
```

## Utility Function: cn

```tsx
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Usage
<div className={cn(
  'base-styles',
  isActive && 'active-styles',
  className  // Allow overrides
)} />
```

## Anti-Patterns

| Pattern | Why It's Wrong | Fix |
|---------|----------------|-----|
| `style={{ color: '#fff' }}` | Inline styles | Tailwind classes |
| `bg-[#1a1a1a]` | Hardcoded colors | `bg-background` theme vars |
| `bg-white text-black` | Not theme-aware | `bg-background text-foreground` |
| Custom CSS for layout | Tailwind exists | `flex items-center justify-center` |
| Missing loading state | Bad UX | Check `isLoading && !data` |
| Missing error state | Silent failures | Check `error` first |
| Missing empty state | Confusing UX | Check `!data?.length` |
| `className="..."` strings | Not mergeable | Use `cn()` utility |

---

## Integration Notes

- **connectrpc-web**: Use with ConnectRPC clients for API calls
- **clerk-auth**: Authentication UI components
