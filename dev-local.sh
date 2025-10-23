#!/bin/bash
set -e

echo "🚀 Block Watcher - Local Kubernetes Development Setup"
echo "===================================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop."
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install kubectl."
    exit 1
fi

# Check for kind, minikube, or k3d
K8S_TOOL=""
if command -v kind &> /dev/null; then
    K8S_TOOL="kind"
elif command -v minikube &> /dev/null; then
    K8S_TOOL="minikube"
elif command -v k3d &> /dev/null; then
    K8S_TOOL="k3d"
else
    echo "❌ No local Kubernetes tool found. Please install one of:"
    echo "   - kind: brew install kind"
    echo "   - minikube: brew install minikube"
    echo "   - k3d: brew install k3d"
    exit 1
fi

echo "✅ Using $K8S_TOOL for local Kubernetes"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

# Load environment variables
source .env

# Create or start cluster
echo ""
echo "🎯 Step 1: Setting up Kubernetes cluster"
if [ "$K8S_TOOL" = "kind" ]; then
    if kind get clusters | grep -q "block-watcher-dev"; then
        echo "✅ kind cluster 'block-watcher-dev' already exists"
    else
        echo "Creating kind cluster..."
        kind create cluster --name block-watcher-dev --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 30080
    hostPort: 8080
    protocol: TCP
  - containerPort: 30081
    hostPort: 3001
    protocol: TCP
  - containerPort: 30082
    hostPort: 9093
    protocol: TCP
EOF
        echo "✅ kind cluster created"
    fi
    kubectl config use-context kind-block-watcher-dev
elif [ "$K8S_TOOL" = "minikube" ]; then
    if minikube status -p block-watcher-dev &> /dev/null; then
        echo "Starting existing minikube cluster..."
        minikube start -p block-watcher-dev
    else
        echo "Creating minikube cluster..."
        minikube start -p block-watcher-dev --cpus=2 --memory=4096
    fi
    kubectl config use-context block-watcher-dev
elif [ "$K8S_TOOL" = "k3d" ]; then
    if k3d cluster list | grep -q "block-watcher-dev"; then
        echo "✅ k3d cluster 'block-watcher-dev' already exists"
    else
        echo "Creating k3d cluster..."
        k3d cluster create block-watcher-dev -p "8080:30080@server:0" -p "3001:30081@server:0" -p "9093:30082@server:0"
    fi
    kubectl config use-context k3d-block-watcher-dev
fi

# Build Docker image
echo ""
echo "🐳 Step 2: Building Docker image"
docker build -t block-watcher:local .
echo "✅ Docker image built"

# Load image into cluster
echo ""
echo "📦 Step 3: Loading image into cluster"
if [ "$K8S_TOOL" = "kind" ]; then
    kind load docker-image block-watcher:local --name block-watcher-dev
elif [ "$K8S_TOOL" = "minikube" ]; then
    minikube image load block-watcher:local -p block-watcher-dev
elif [ "$K8S_TOOL" = "k3d" ]; then
    k3d image import block-watcher:local -c block-watcher-dev
fi
echo "✅ Image loaded into cluster"

# Create namespaces
echo ""
echo "🏗️  Step 4: Creating namespaces"
kubectl apply -f k8s/namespace.yaml
echo "✅ Namespaces created"

# Create secrets from .env
echo ""
echo "🔐 Step 5: Creating secrets from .env"
cd k8s && ./create-secrets.sh && cd ..
echo "✅ Secrets created"

# Deploy PostgreSQL
echo ""
echo "🗄️  Step 6: Deploying PostgreSQL"
kubectl apply -f k8s/postgres.yaml
echo "Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n block-watcher --timeout=120s
echo "✅ PostgreSQL ready"

# Deploy application
echo ""
echo "🚀 Step 7: Deploying application"
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
echo "Waiting for application to be ready..."
kubectl wait --for=condition=ready pod -l app=block-watcher -n block-watcher --timeout=120s
echo "✅ Application ready"

# Install Prometheus Stack (optional, with Helm)
echo ""
echo "📊 Step 8: Installing observability stack (optional)"
if command -v helm &> /dev/null; then
    if ! helm list -n observability | grep -q "prometheus"; then
        echo "Installing Prometheus stack..."
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
        helm install prometheus prometheus-community/kube-prometheus-stack \
            --namespace observability \
            --create-namespace \
            --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
            --set grafana.service.type=NodePort \
            --set grafana.service.nodePort=30081 \
            --set alertmanager.service.type=NodePort \
            --set alertmanager.service.nodePort=30082
        echo "Waiting for Prometheus stack..."
        sleep 20
    else
        echo "✅ Prometheus stack already installed"
    fi
    
    # Apply ServiceMonitor and PrometheusRule
    kubectl apply -f k8s/servicemonitor.yaml
    kubectl apply -f k8s/prometheusrule.yaml
    echo "✅ Observability stack ready"
else
    echo "⚠️  Helm not found, skipping observability setup"
    echo "   Install Helm: brew install helm"
fi

# Print access information
echo ""
echo "=============================================="
echo "✅ Local development environment is ready!"
echo "=============================================="
echo ""
echo "📍 Access your services:"
echo ""
echo "   API: http://localhost:8080"
echo "   Health: http://localhost:8080/health"
echo "   Metrics: http://localhost:8080/metrics"
echo ""
if command -v helm &> /dev/null && helm list -n observability | grep -q "prometheus"; then
    echo "   Grafana: http://localhost:3001"
    echo "   Username: admin"
    echo "   Password: prom-operator"
    echo ""
    echo "   Alertmanager: http://localhost:9093"
    echo ""
fi
echo "📋 Useful commands:"
echo ""
echo "   View logs:        kubectl logs -f -l app=block-watcher -n block-watcher"
echo "   View pods:        kubectl get pods -n block-watcher"
echo "   Restart app:      kubectl rollout restart deployment/block-watcher -n block-watcher"
echo "   Delete cluster:   $K8S_TOOL delete cluster block-watcher-dev"
echo ""
echo "🔄 To rebuild and redeploy:"
echo "   docker build -t block-watcher:local ."
if [ "$K8S_TOOL" = "kind" ]; then
    echo "   kind load docker-image block-watcher:local --name block-watcher-dev"
elif [ "$K8S_TOOL" = "minikube" ]; then
    echo "   minikube image load block-watcher:local -p block-watcher-dev"
elif [ "$K8S_TOOL" = "k3d" ]; then
    echo "   k3d image import block-watcher:local -c block-watcher-dev"
fi
echo "   kubectl rollout restart deployment/block-watcher -n block-watcher"
echo ""
