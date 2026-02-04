#!/bin/bash
set -e

# Local development setup script for k3d
# Usage: ./local-setup.sh

CLUSTER_NAME="sut-dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUT_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$SUT_DIR")"

echo "🚀 Setting up local Kubernetes environment..."

# Check prerequisites
command -v k3d >/dev/null 2>&1 || { echo "❌ k3d is required. Install: brew install k3d"; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "❌ kubectl is required. Install: brew install kubectl"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ docker is required."; exit 1; }

# Create cluster if not exists
if ! k3d cluster list | grep -q "$CLUSTER_NAME"; then
    echo "📦 Creating k3d cluster: $CLUSTER_NAME"
    k3d cluster create "$CLUSTER_NAME" \
        --port 8080:80@loadbalancer \
        --agents 2
else
    echo "✅ Cluster $CLUSTER_NAME already exists"
fi

# Switch context
kubectl config use-context "k3d-$CLUSTER_NAME"

# Build images
echo "🔨 Building Docker images..."
cd "$PROJECT_ROOT"

docker build -t auth-service:local ./auth-service
docker build -t backend:local ./backend  
docker build -t frontend:local ./frontend

# Import images into k3d
echo "📤 Importing images into k3d..."
k3d image import auth-service:local -c "$CLUSTER_NAME"
k3d image import backend:local -c "$CLUSTER_NAME"
k3d image import frontend:local -c "$CLUSTER_NAME"

# Deploy with Kustomize
echo "🚢 Deploying to Kubernetes..."
kubectl apply -k "$SUT_DIR/k8s/overlays/local"

# Wait for deployments
echo "⏳ Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=120s deployment/auth-service -n sut
kubectl wait --for=condition=available --timeout=120s deployment/backend -n sut
kubectl wait --for=condition=available --timeout=120s deployment/frontend -n sut

# Seed databases
echo "🌱 Seeding databases..."
kubectl exec -n sut deployment/auth-service -- python -m app.db.seed || true
kubectl exec -n sut deployment/backend -- python -m app.db.seed || true

echo ""
echo "✅ Setup complete!"
echo ""
echo "📍 Access the application:"
echo "   Frontend: http://localhost:8080"
echo "   Backend API: http://localhost:8080/api"
echo "   Auth Service: http://localhost:8080/auth"
echo "   Auth Docs: http://localhost:8080/auth/docs"
echo ""
echo "📊 View pods: kubectl get pods -n sut"
echo "🗑️  Cleanup: k3d cluster delete $CLUSTER_NAME"
