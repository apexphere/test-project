# Kubernetes Manifests

Kubernetes deployment configuration for the Mini E-commerce platform.

## Prerequisites

- **k3d** - Lightweight Kubernetes for local development
- **kubectl** - Kubernetes CLI
- **Docker** - Container runtime (must be running)

```bash
# Install on macOS
brew install k3d kubectl

# Verify installations
k3d --version    # v5.8.3 or higher
kubectl version --client
docker info      # Docker must be running
```

## Quick Start (Local Development)

```bash
# One-command setup
./scripts/local-setup.sh

# Access the app
open http://localhost:8080
```

This will:
1. Create a k3d cluster (`sut-dev`) with nginx ingress
2. Build all Docker images
3. Import images into k3d
4. Deploy all services via Kustomize
5. Wait for pods to be ready
6. Seed the databases with test data

### Test Credentials
- **Admin:** admin@example.com / admin123
- **User:** user@example.com / user123

## Manual Deployment

### 1. Create Cluster with Ingress

```bash
# Create k3d cluster with nginx ingress support
k3d cluster create sut-dev \
    --port 8080:80@loadbalancer \
    --k3s-arg "--disable=traefik@server:0" \
    --wait

# Verify cluster is ready
kubectl cluster-info

# Install nginx ingress controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/cloud/deploy.yaml

# Wait for ingress controller
kubectl wait --namespace ingress-nginx \
    --for=condition=ready pod \
    --selector=app.kubernetes.io/component=controller \
    --timeout=120s
```

### 2. Build & Load Images

```bash
cd sut

# Build images with required build args
docker build -t auth-service:local ./auth-service
docker build -t backend:local ./backend
docker build -t frontend:local \
    --build-arg VITE_API_URL=http://localhost:8080/api \
    --build-arg VITE_AUTH_URL=http://localhost:8080/auth \
    ./frontend

# Import into k3d
k3d image import auth-service:local backend:local frontend:local -c sut-dev
```

### 3. Deploy with Kustomize

```bash
# Apply local overlay
kubectl apply -k k8s/overlays/local

# Watch pods come up
kubectl get pods -n sut -w
```

### 4. Wait & Verify

```bash
# Wait for all deployments
kubectl wait --for=condition=available --timeout=120s \
    deployment/auth-service \
    deployment/backend \
    deployment/frontend \
    -n sut

# Check all pods are Running
kubectl get pods -n sut

# Test the frontend
curl http://localhost:8080/

# Health checks require port-forwarding (not exposed via ingress)
kubectl port-forward -n sut svc/backend 8000:8000 &
curl http://localhost:8000/health      # Backend health

kubectl port-forward -n sut svc/auth-service 8001:8000 &
curl http://localhost:8001/health      # Auth-service health
```

### 5. Seed Databases

```bash
kubectl exec -n sut deployment/auth-service -- python -m app.db.seed
kubectl exec -n sut deployment/backend -- python -m app.db.seed
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx Ingress                         │
│                   (port 8080)                            │
├─────────────────────────────────────────────────────────┤
│   /              │   /api/*        │   /auth/*          │
│   ↓              │   ↓             │   ↓                │
│ ┌──────────┐    │ ┌─────────┐    │ ┌──────────────┐   │
│ │ Frontend │    │ │ Backend │    │ │ Auth Service │   │
│ │ (Vite)   │    │ │(FastAPI)│    │ │  (FastAPI)   │   │
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

## Endpoints

| Path | Service | Description |
|------|---------|-------------|
| `/` | frontend | React SPA (Vite dev server) |
| `/api/products` | backend | Products API |
| `/api/cart` | backend | Cart API |
| `/api/orders` | backend | Orders API |
| `/auth/login` | auth-service | Login (POST) |
| `/auth/register` | auth-service | Register (POST) |
| `/auth/docs` | auth-service | Swagger UI |

> **Note:** Health endpoints (`/health`) are available on each service directly but are not exposed via ingress. Use port-forwarding to access them (see [Port-forward to access services directly](#port-forward-to-access-services-directly)).

## Directory Structure

```
k8s/
├── base/                    # Shared manifests
│   ├── namespace.yaml
│   ├── ingress.yaml         # Nginx ingress rules
│   ├── kustomization.yaml
│   ├── auth-service/
│   ├── backend/
│   ├── frontend/
│   ├── postgres-main/
│   ├── postgres-auth/
│   └── redis/
├── overlays/
│   ├── local/               # k3d overlay (increased memory for Vite)
│   │   └── kustomization.yaml
│   └── ci/                  # CI overlay
│       └── kustomization.yaml
└── scripts/
    ├── local-setup.sh       # One-command setup
    └── local-cleanup.sh     # Cleanup script
```

## Cleanup

```bash
# Quick cleanup
./scripts/local-cleanup.sh

# Manual cleanup
k3d cluster delete sut-dev
```

## Troubleshooting

### Pods stuck in CrashLoopBackOff

**Cause:** Backend/auth-service started before Postgres was ready.

**Fix:** The pods will auto-recover once Postgres is running. Check:
```bash
kubectl get pods -n sut -l app=postgres-main
kubectl get pods -n sut -l app=postgres-auth
```

If postgres is stuck, check:
```bash
kubectl describe pod -n sut postgres-main-0
kubectl logs -n sut postgres-main-0
```

### Frontend OOMKilled

**Cause:** Vite dev server needs more memory than the default 128Mi limit.

**Fix:** The local overlay increases frontend memory to 512Mi. Verify:
```bash
kubectl get deployment frontend -n sut -o jsonpath='{.spec.template.spec.containers[0].resources}'
```

### Ingress not routing

**Cause:** Nginx ingress controller not installed or not ready.

**Check:**
```bash
kubectl get pods -n ingress-nginx
kubectl get ingress -n sut
```

**Fix:** Install nginx ingress:
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/cloud/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=120s
```

### Database connection errors

**Check service DNS:**
```bash
kubectl exec -n sut deployment/backend -- nslookup postgres-main
kubectl exec -n sut deployment/auth-service -- nslookup postgres-auth
```

**Check postgres logs:**
```bash
kubectl logs -n sut postgres-main-0
kubectl logs -n sut postgres-auth-0
```

### Images not found (ErrImageNeverPull)

**Cause:** Images not imported into k3d cluster.

**Fix:**
```bash
# Check images in cluster
docker exec k3d-sut-dev-server-0 crictl images | grep -E "(auth-service|backend|frontend)"

# Re-import if missing
k3d image import auth-service:local backend:local frontend:local -c sut-dev
```

### Port 8080 already in use

**Cause:** Another process using port 8080.

**Fix:**
```bash
# Find the process
lsof -i :8080

# Kill it or use a different port when creating cluster
k3d cluster create sut-dev --port 8081:80@loadbalancer
```

## Local Development Tips

### Rebuild and redeploy a single service

```bash
# Example: rebuild backend
docker build -t backend:local ./backend
k3d image import backend:local -c sut-dev
kubectl rollout restart deployment/backend -n sut
kubectl rollout status deployment/backend -n sut
```

### View logs in real-time

```bash
kubectl logs -n sut -f deployment/backend
kubectl logs -n sut -f deployment/auth-service
```

### Port-forward to access services directly

```bash
# Access backend directly (bypassing ingress)
kubectl port-forward -n sut svc/backend 8000:8000 &
curl http://localhost:8000/api/products

# Access postgres
kubectl port-forward -n sut svc/postgres-main 5432:5432 &
psql -h localhost -U postgres -d ecommerce
```

### Reset everything

```bash
kubectl delete namespace sut
kubectl apply -k k8s/overlays/local
```
