---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/*.ts"
---

# React Rules

## Colors
- always use theme-aware CSS variables: `bg-background`, `text-foreground`, `bg-primary`
- never hardcode colors: no `bg-white`, `text-black`, `bg-[#1a1a1a]`

## Components
- use `cn()` utility for class merging (clsx + tailwind-merge)
- shadcn/ui components where available
- composition over configuration

## State Handling Order
1. error state first
2. loading state (only when no data)
3. empty state
4. data rendering

## Styling
- Tailwind utility classes, no custom CSS for layout
- mobile-first responsive design
- no inline styles
