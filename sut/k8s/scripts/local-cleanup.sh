#!/bin/bash
set -e

# Cleanup script for local k3d environment
# Usage: ./local-cleanup.sh

CLUSTER_NAME="sut-dev"

echo "🗑️  Cleaning up local Kubernetes environment..."

if k3d cluster list | grep -q "$CLUSTER_NAME"; then
    k3d cluster delete "$CLUSTER_NAME"
    echo "✅ Cluster $CLUSTER_NAME deleted"
else
    echo "ℹ️  Cluster $CLUSTER_NAME not found"
fi

# Optionally clean up Docker images
read -p "Remove local Docker images? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker rmi auth-service:local backend:local frontend:local 2>/dev/null || true
    echo "✅ Docker images removed"
fi

echo "🧹 Cleanup complete!"
