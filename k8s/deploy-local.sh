#!/bin/bash

echo "🚀 Deploying to local Kubernetes"

# Build and deploy
echo "1. Building Docker image..."
cd .. && docker build -t block-watcher:local . && cd k8s

echo "2. Applying Kubernetes manifests..."
kubectl apply -f namespace.yaml
kubectl apply -f postgres.yaml

echo "3. Waiting for database..."
kubectl wait --for=condition=available --timeout=120s deployment/postgres -n block-watcher

echo "4. Deploying application..."
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

echo "5. Waiting for deployment..."
kubectl wait --for=condition=available --timeout=120s deployment/block-watcher -n block-watcher

echo "6. Checking pod status..."
kubectl get pods -n block-watcher

echo ""
echo "✅ Deployment complete!"
echo ""
echo "To test:"
echo "kubectl port-forward svc/block-watcher-service 8080:80 -n block-watcher"
echo "curl http://localhost:8080/api/metrics"
echo "curl http://localhost:8080/api/health/liveness"
