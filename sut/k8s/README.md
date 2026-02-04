# Kubernetes Manifests

Kubernetes deployment configuration for the Mini E-commerce platform.

## Status

🚧 **Scaffolded** - Awaiting design approval before implementation.

## Structure

```
k8s/
├── base/                    # Base manifests (shared)
│   ├── namespace.yaml
│   ├── frontend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   ├── backend/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── secret.yaml
│   ├── auth-service/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── secret.yaml
│   ├── postgres-main/
│   │   ├── statefulset.yaml
│   │   ├── service.yaml
│   │   └── pvc.yaml
│   ├── postgres-auth/
│   │   ├── statefulset.yaml
│   │   ├── service.yaml
│   │   └── pvc.yaml
│   ├── redis/
│   │   ├── deployment.yaml
│   │   └── service.yaml
│   └── ingress.yaml
├── overlays/
│   ├── local/              # k3d local development
│   │   └── kustomization.yaml
│   └── ci/                 # kind CI testing
│       └── kustomization.yaml
└── kustomization.yaml
```

## Local Development (k3d)

```bash
# Create cluster
k3d cluster create sut-dev --port 8080:80@loadbalancer

# Deploy
kubectl apply -k k8s/overlays/local

# Check status
kubectl get pods -n sut

# Access
# Frontend: http://localhost:8080
# API: http://localhost:8080/api
# Auth: http://localhost:8080/auth

# Delete cluster
k3d cluster delete sut-dev
```

## CI (kind)

```bash
# Create cluster
kind create cluster --name sut-ci

# Deploy
kubectl apply -k k8s/overlays/ci

# Run tests
cd ../test-automation && npx playwright test

# Delete cluster
kind delete cluster --name sut-ci
```

## Design Document

See: [`docs/design/001-auth-service-extraction.md`](../../docs/design/001-auth-service-extraction.md)
