---
name: dev
description: "Start development environment with hot reload for a project"
user-invocable: true
argument-hint: "<project> [--backend-only] [--frontend-only]"
allowed-tools: Bash, Read
---

# /dev

Start development environment with hot reload.

## Arguments

- `$ARGUMENTS`: Project name (required)
- `--backend-only`: Skip frontend dev server
- `--frontend-only`: Skip backend dev server

## Process

1. **Check project exists** in `apps/` or project root
2. **Start infrastructure** (Docker if needed)
3. **Start backend** with Air hot reload
4. **Start frontend** with Vite (if present)
5. **Show access URLs**

## Execution

```bash
PROJECT="$1"

cd "apps/$PROJECT" || cd "$PROJECT" || { echo "Project not found: $PROJECT"; exit 1; }

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
        cd frontend && npm run dev &
    elif [ -d "ui" ]; then
        cd ui && npm run dev &
    fi
fi

echo ""
echo "=== Development Environment ==="
echo "Project:  $PROJECT"
echo "Backend:  http://localhost:8080"
echo "Frontend: http://localhost:5173 (if present)"
echo ""
echo "Press Ctrl+C to stop all services"

wait
```

## Prerequisites

- **Go 1.24+** with Air installed (`go install github.com/air-verse/air@latest`)
- **Node.js 20+** with npm for frontends
- **Docker** for infrastructure services (optional)

## Stopping

```bash
pkill -f "air"
pkill -f "npm run dev"
docker compose down  # if using Docker
```
