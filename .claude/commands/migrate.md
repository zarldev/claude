---
description: Create or run database migrations
allowed-tools: Bash, Read, Write, Glob
related-skills:
  - database-patterns
---

# /migrate Command

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

## Process

### create
1. Generate timestamp-prefixed filename
2. Create SQL file with goose markers
3. Open for editing

### up/down/status
1. Find migrations directory
2. Run goose command
3. Report results

## Execution

```bash
PROJECT="${PROJECT:-$(basename $PWD)}"
MIGRATIONS_DIR="./migrations"

case "$1" in
    create)
        if [ -z "$2" ]; then
            echo "Usage: /migrate create <name>"
            exit 1
        fi
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
    *)
        echo "Usage: /migrate <create|up|down|status|reset>"
        ;;
esac
```

## Migration Template

When creating migrations, use this template:

```sql
-- migrations/{timestamp}_{name}.sql

-- +goose Up
-- SQL for applying migration

-- +goose Down
-- SQL for reverting migration
```

## Safety Warnings

- **down**: Will rollback one migration
- **reset**: Will rollback ALL migrations - data loss!
- Always test migrations locally first
- Have a backup before running in production

## Examples

```bash
/migrate create add_user_avatar    # Create migration
/migrate up                        # Apply pending
/migrate down                      # Rollback one
/migrate status                    # Check status
/migrate up --project mindmint     # Specific project
```
