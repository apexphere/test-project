#!/bin/bash
set -e

# Local development setup script for test-reporter using k3d
# Usage: ./local-setup.sh

CLUSTER_NAME="test-reporter-dev"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$SCRIPT_DIR")"
TEST_REPORTER_DIR="$(dirname "$K8S_DIR")"

echo "🚀 Setting up test-reporter local Kubernetes environment..."

# Check prerequisites
command -v k3d >/dev/null 2>&1 || { echo "❌ k3d is required. Install: brew install k3d"; exit 1; }
command -v kubectl >/dev/null 2>&1 || { echo "❌ kubectl is required. Install: brew install kubectl"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ docker is required."; exit 1; }

# Create cluster if not exists
if ! k3d cluster list | grep -q "$CLUSTER_NAME"; then
    echo "📦 Creating k3d cluster: $CLUSTER_NAME"
    k3d cluster create "$CLUSTER_NAME" \
        --port 8081:80@loadbalancer \
        --port 8444:443@loadbalancer \
        --k3s-arg "--disable=traefik@server:0" \
        --wait
    
    echo "🌐 Installing nginx ingress controller..."
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/cloud/deploy.yaml
    
    echo "⏳ Waiting for ingress controller..."
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=120s
else
    echo "✅ Cluster $CLUSTER_NAME already exists"
fi

# Switch context
kubectl config use-context "k3d-$CLUSTER_NAME"

# Build images
echo "🔨 Building Docker images..."
cd "$TEST_REPORTER_DIR"

docker build -t test-reporter-server:local ./server

docker build -t test-reporter-dashboard:local \
    --build-arg VITE_API_URL=http://localhost:8081/api \
    ./dashboard

# Import images into k3d
echo "📤 Importing images into k3d..."
k3d image import test-reporter-server:local -c "$CLUSTER_NAME"
k3d image import test-reporter-dashboard:local -c "$CLUSTER_NAME"

# Deploy with Kustomize
echo "🚢 Deploying to Kubernetes..."
kubectl apply -k "$K8S_DIR/overlays/local"

# Wait for postgres to be ready first
echo "⏳ Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready --timeout=120s pod -l app=postgres -n test-reporter

# Wait for deployments
echo "⏳ Waiting for deployments to be ready..."
kubectl wait --for=condition=available --timeout=120s deployment/server -n test-reporter
kubectl wait --for=condition=available --timeout=120s deployment/dashboard -n test-reporter

echo ""
echo "✅ Setup complete!"
echo ""
echo "📍 Access the application:"
echo "   Dashboard: http://localhost:8081"
echo "   API: http://localhost:8081/api"
echo "   Health: http://localhost:8081/api/health"
echo ""
echo "📊 View pods: kubectl get pods -n test-reporter"
echo "📜 View logs: kubectl logs -n test-reporter deployment/server"
echo "🗑️  Cleanup: ./local-cleanup.sh"
