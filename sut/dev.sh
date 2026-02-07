#!/usr/bin/env bash
# Convenience wrapper for k3d local development

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
    echo "Usage: ./dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  up       Start the local k3d cluster and deploy services"
    echo "  down     Stop and delete the k3d cluster"
    echo "  restart  Restart the cluster (down + up)"
    echo "  logs     Tail logs from all pods"
    echo "  status   Show pod status"
    echo ""
    echo "Examples:"
    echo "  ./dev.sh up        # Start local dev environment"
    echo "  ./dev.sh logs      # Watch all logs"
    echo "  ./dev.sh down      # Clean up"
}

case "${1:-}" in
    up)
        echo "🚀 Starting local k3d environment..."
        "$SCRIPT_DIR/k8s/scripts/local-setup.sh"
        ;;
    down)
        echo "🧹 Cleaning up k3d environment..."
        "$SCRIPT_DIR/k8s/scripts/local-cleanup.sh"
        ;;
    restart)
        echo "🔄 Restarting k3d environment..."
        "$SCRIPT_DIR/k8s/scripts/local-cleanup.sh" || true
        "$SCRIPT_DIR/k8s/scripts/local-setup.sh"
        ;;
    logs)
        echo "📋 Tailing logs from all pods..."
        kubectl logs -n sut -f --all-containers=true -l 'app in (frontend,backend,auth-service)'
        ;;
    status)
        echo "📊 Pod status:"
        kubectl get pods -n sut
        echo ""
        echo "📊 Services:"
        kubectl get svc -n sut
        ;;
    -h|--help|help)
        usage
        ;;
    *)
        echo "Error: Unknown command '${1:-}'"
        echo ""
        usage
        exit 1
        ;;
esac
