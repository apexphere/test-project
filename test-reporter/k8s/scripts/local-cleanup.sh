#!/bin/bash
set -e

# Cleanup script for test-reporter k3d cluster
# Usage: ./local-cleanup.sh

CLUSTER_NAME="test-reporter-dev"

echo "🗑️  Cleaning up test-reporter local environment..."

if k3d cluster list | grep -q "$CLUSTER_NAME"; then
    echo "📦 Deleting k3d cluster: $CLUSTER_NAME"
    k3d cluster delete "$CLUSTER_NAME"
    echo "✅ Cleanup complete!"
else
    echo "ℹ️  Cluster $CLUSTER_NAME does not exist"
fi
