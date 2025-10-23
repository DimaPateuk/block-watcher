#!/bin/bash

# Create Kubernetes Secrets from .env file
# Usage: ./create-secrets.sh

set -e

echo "🔐 Creating Kubernetes Secrets from .env file"

# Check if .env exists
if [ ! -f ../.env ]; then
    echo "❌ Error: ../.env file not found"
    echo "Please create a .env file in the project root with:"
    echo "  DATABASE_URL=postgresql://user:password@host:5432/dbname"
    echo "  POSTGRES_DB=blockwatcher"
    echo "  POSTGRES_USER=postgres"
    echo "  POSTGRES_PASSWORD=your-password"
    exit 1
fi

# Load .env file
source ../.env

# Extract database credentials from DATABASE_URL if it exists
if [ -n "$DATABASE_URL" ]; then
    echo "📝 Using DATABASE_URL from .env"
else
    echo "⚠️  DATABASE_URL not found in .env, using individual variables"
fi

# Create namespace if it doesn't exist
kubectl create namespace block-watcher --dry-run=client -o yaml | kubectl apply -f -

# Delete existing secrets if they exist
kubectl delete secret postgres-secret -n block-watcher --ignore-not-found
kubectl delete secret app-secret -n block-watcher --ignore-not-found

# Create postgres secret
echo "Creating postgres-secret..."
kubectl create secret generic postgres-secret \
    --from-literal=POSTGRES_DB="${POSTGRES_DB:-blockwatcher}" \
    --from-literal=POSTGRES_USER="${POSTGRES_USER:-postgres}" \
    --from-literal=POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-password}" \
    -n block-watcher

# Create app secret with DATABASE_URL
echo "Creating app-secret..."
if [ -n "$DATABASE_URL" ]; then
    kubectl create secret generic app-secret \
        --from-literal=DATABASE_URL="$DATABASE_URL" \
        -n block-watcher
else
    # Build DATABASE_URL from components
    DB_URL="postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD:-password}@postgres-service:5432/${POSTGRES_DB:-blockwatcher}"
    kubectl create secret generic app-secret \
        --from-literal=DATABASE_URL="$DB_URL" \
        -n block-watcher
fi

# Create secret from entire .env file (for other env vars)
echo "Creating env-secret from .env file..."
kubectl create secret generic env-secret \
    --from-env-file=../.env \
    -n block-watcher --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "✅ Secrets created successfully!"
echo ""
echo "To verify:"
echo "  kubectl get secrets -n block-watcher"
echo ""
echo "To view secret (decoded):"
echo "  kubectl get secret postgres-secret -n block-watcher -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d"
