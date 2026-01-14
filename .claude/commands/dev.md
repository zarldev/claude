---
description: Start development environment for a project
allowed-tools: Bash, Read
---

# /dev Command

Start development environment with hot reload.

## Arguments

- `$1`: Project name (required)
- `--backend-only`: Skip frontend dev server
- `--frontend-only`: Skip backend dev server

## Projects

Located in `apps/`:

| Project | Backend | Frontend | Notes |
|---------|---------|----------|-------|
| `timer` | :8080 | :5173 | Timer app with React frontend |
| `todoapp` | :8080 | :5173 | Todo app |
| `vault` | :8080 | :5173 | Vault service |
| `gateway` | :8080 | - | API gateway (no frontend) |
| `zarl.dev` | :8080 | embedded | Blog (embedded UI) |

## Process

1. **Check project exists** in `apps/`
2. **Start infrastructure** (Docker if needed)
3. **Start backend** with Air hot reload
4. **Start frontend** with Vite (if present)
5. **Show access URLs**

## Execution

```bash
PROJECT="$1"

if [ -z "$PROJECT" ]; then
    echo "Usage: /dev <project>"
    echo ""
    echo "Available projects:"
    echo "  timer     - Timer app (backend :8080, frontend :5173)"
    echo "  todoapp   - Todo app (backend :8080, frontend :5173)"
    echo "  vault     - Vault service (backend :8080, frontend :5173)"
    echo "  gateway   - API gateway (backend :8080)"
    echo "  zarl.dev  - Personal blog (backend :8080, embedded UI)"
    exit 1
fi

cd "apps/$PROJECT" || { echo "Project not found: $PROJECT"; exit 1; }

# Start infrastructure if docker-compose exists
if [ -f "docker-compose.yaml" ] || [ -f "docker-compose.yml" ]; then
    echo "Starting infrastructure..."
    docker compose up -d
fi

# Start backend
if [[ "$*" != *"--frontend-only"* ]]; then
    if [ -f ".air.toml" ]; then
        echo "Starting backend with Air (hot reload)..."
        air &
    elif [ -f "Makefile" ] && grep -q "dev:" Makefile; then
        make dev &
    else
        echo "Starting backend..."
        go run ./cmd/... &
    fi
fi

# Start frontend
if [[ "$*" != *"--backend-only"* ]]; then
    if [ -d "frontend" ]; then
        echo "Starting frontend..."
        cd frontend && npm run dev &
    elif [ -d "ui" ]; then
        echo "Starting frontend..."
        cd ui && npm run dev &
    fi
fi

echo ""
echo "=== Development Environment ==="
echo "Project:  $PROJECT"
echo "Backend:  http://localhost:8080"
if [ -d "frontend" ] || [ -d "ui" ]; then
    echo "Frontend: http://localhost:5173"
fi
echo ""
echo "Press Ctrl+C to stop all services"

wait
```

## Quick Commands

```bash
/dev timer                # Full dev environment
/dev vault --backend-only # Backend only
/dev todoapp              # Full dev environment
```

## Prerequisites

- **Go 1.24+** with Air installed (`go install github.com/air-verse/air@latest`)
- **Node.js 20+** with npm for frontends
- **Docker** for infrastructure services (optional)

## Stopping

Press `Ctrl+C` to stop all services, or run:
```bash
pkill -f "air"
pkill -f "npm run dev"
docker compose down  # if using Docker
```
