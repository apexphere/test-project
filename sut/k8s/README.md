# Kubernetes Manifests

Kubernetes deployment configuration for the Mini E-commerce platform.

## Prerequisites

- **k3d** (local) or **kind** (CI) - Lightweight Kubernetes
- **kubectl** - Kubernetes CLI
- **Docker** - Container runtime

```bash
# Install on macOS
brew install k3d kubectl docker
```

## Quick Start (Local Development)

```bash
# One-command setup
./scripts/local-setup.sh

# Access the app
open http://localhost:8080
```

This will:
1. Create a k3d cluster (`sut-dev`)
2. Build all Docker images
3. Import images into k3d
4. Deploy all services
5. Seed the databases

## Manual Deployment

### 1. Create Cluster

```bash
# k3d (local development)
k3d cluster create sut-dev --port 8080:80@loadbalancer

# kind (CI)
kind create cluster --name sut-ci
```

### 2. Build & Load Images

```bash
cd sut

# Build images
docker build -t auth-service:local ./auth-service
docker build -t backend:local ./backend
docker build -t frontend:local ./frontend

# Load into k3d
k3d image import auth-service:local backend:local frontend:local -c sut-dev

# Or load into kind
kind load docker-image auth-service:local backend:local frontend:local --name sut-ci
```

### 3. Deploy

```bash
# Local (k3d)
kubectl apply -k k8s/overlays/local

# CI (kind)
kubectl apply -k k8s/overlays/ci
```

### 4. Verify

```bash
# Check pods
kubectl get pods -n sut

# Check services
kubectl get svc -n sut

# View logs
kubectl logs -n sut -l app=auth-service
kubectl logs -n sut -l app=backend
```

### 5. Seed Databases

```bash
kubectl exec -n sut deployment/auth-service -- python -m app.db.seed
kubectl exec -n sut deployment/backend -- python -m app.db.seed
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                         Ingress                          │
│                    (nginx, port 8080)                    │
├─────────────────────────────────────────────────────────┤
│   /              │   /api/*        │   /auth/*          │
│   ↓              │   ↓             │   ↓                │
│ ┌──────────┐    │ ┌─────────┐    │ ┌──────────────┐   │
│ │ Frontend │    │ │ Backend │    │ │ Auth Service │   │
│ │ (React)  │    │ │(FastAPI)│    │ │  (FastAPI)   │   │
│ └──────────┘    │ └────┬────┘    │ └──────┬───────┘   │
│                 │      │         │        │           │
│                 │      ▼         │        ▼           │
│                 │ ┌─────────┐    │ ┌──────────────┐   │
│                 │ │Postgres │    │ │  Postgres    │   │
│                 │ │ (main)  │    │ │   (auth)     │   │
│                 │ └─────────┘    │ └──────────────┘   │
│                 │      │         │                    │
│                 │      ▼         │                    │
│                 │ ┌─────────┐    │                    │
│                 │ │  Redis  │    │                    │
│                 │ └─────────┘    │                    │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
k8s/
├── base/                    # Shared manifests
│   ├── namespace.yaml
│   ├── ingress.yaml
│   ├── auth-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── kustomization.yaml
│   ├── backend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   ├── secret.yaml
│   │   └── kustomization.yaml
│   ├── frontend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── kustomization.yaml
│   ├── postgres-main/
│   │   ├── statefulset.yaml
│   │   ├── service.yaml
│   │   ├── secret.yaml
│   │   └── kustomization.yaml
│   ├── postgres-auth/
│   │   └── ...
│   ├── redis/
│   │   └── ...
│   └── kustomization.yaml
├── overlays/
│   ├── local/              # k3d (1 replica, local images)
│   │   └── kustomization.yaml
│   └── ci/                 # kind (1 replica, ci images)
│       └── kustomization.yaml
├── scripts/
│   ├── local-setup.sh      # One-command local setup
│   └── local-cleanup.sh    # Cleanup script
└── README.md
```

## Endpoints

| Path | Service | Port | Description |
|------|---------|------|-------------|
| `/` | frontend | 80 | React SPA |
| `/api/*` | backend | 8000 | Products, Cart, Orders API |
| `/auth/*` | auth-service | 8001 | Auth API |
| `/auth/docs` | auth-service | 8001 | Auth API Docs (Swagger) |

## Cleanup

```bash
# Quick cleanup
./scripts/local-cleanup.sh

# Manual cleanup
k3d cluster delete sut-dev
# or
kind delete cluster --name sut-ci
```

## Troubleshooting

### Cluster corrupted or in bad state

If the cluster gets into a corrupted state (e.g., stuck creating, context errors, nodes not responding):

```bash
# Delete and recreate the cluster
k3d cluster delete sut-dev
k3d cluster create sut-dev --port 8080:80@loadbalancer --wait --timeout 120s

# Verify it's healthy
kubectl get nodes   # Should show Ready status
```

**Note:** The `local-setup.sh` script automatically deletes existing clusters before creating, so running it again will fix most cluster issues.

### Pods not starting

```bash
# Check pod status
kubectl describe pod -n sut <pod-name>

# Check logs
kubectl logs -n sut <pod-name>
```

### Database connection issues

```bash
# Verify postgres is running
kubectl get pods -n sut -l app=postgres-main
kubectl get pods -n sut -l app=postgres-auth

# Check postgres logs
kubectl logs -n sut postgres-main-0
```

### Images not found

```bash
# Verify images are loaded
k3d image list -c sut-dev | grep -E "(auth-service|backend|frontend)"
```
