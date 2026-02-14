---
name: migrate
description: "Create or run database migrations with Goose"
user-invocable: true
argument-hint: "<create|up|down|status> [name]"
allowed-tools: Bash, Read, Write, Glob
---

# /migrate

Manage database migrations with Goose.

## Arguments

- `create <name>` - Create new migration file
- `up` - Run all pending migrations
- `down` - Rollback last migration
- `status` - Show migration status
- `reset` - Rollback all migrations (DANGER)

Optional:
- `--project <name>` - Specify project (default: current directory)
- `--db <url>` - Database URL override

## Execution

```bash
MIGRATIONS_DIR="./migrations"

case "$1" in
    create)
        goose -dir "$MIGRATIONS_DIR" create "$2" sql
        ;;
    up)
        goose -dir "$MIGRATIONS_DIR" postgres "$DATABASE_URL" up
        ;;
    down)
        goose -dir "$MIGRATIONS_DIR" postgres "$DATABASE_URL" down
        ;;
    status)
        goose -dir "$MIGRATIONS_DIR" postgres "$DATABASE_URL" status
        ;;
    reset)
        echo "WARNING: This will rollback ALL migrations!"
        goose -dir "$MIGRATIONS_DIR" postgres "$DATABASE_URL" reset
        ;;
esac
```

## Migration Template

When creating migrations, use this template:

```sql
-- +goose Up
-- SQL for applying migration

-- +goose Down
-- SQL for reverting migration
```

## Safety

- **down**: Rollbacks one migration
- **reset**: Rollbacks ALL migrations - data loss!
- Always test migrations locally first
- Have a backup before running in production

## Examples

```
/migrate create add_user_avatar
/migrate up
/migrate down
/migrate status
```
