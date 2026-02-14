---
paths:
  - "**/*.proto"
---

# Proto Rules

## Enums
- always UNSPECIFIED = 0 as first value
- prefix values with enum name: `TIMER_STATE_RUNNING`

## Field Numbers
- 1-10: identity fields (id, user_id, name)
- 11-50: business fields
- 90-99: metadata (created_at, updated_at)

## Naming
- request/response: `{Method}Request`, `{Method}Response`
- service methods: verb-first action names
- fields: snake_case
- package: `company.domain.version`

## Compatibility
- never remove fields or change field numbers
- never change field types
- add new fields with new numbers
- deprecate with `[deprecated = true]`, don't delete
