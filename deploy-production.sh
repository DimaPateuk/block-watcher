#!/bin/bash
set -e

echo "🚀 Block Watcher - Production Deployment"
echo "========================================="
echo ""

# Check if running on production server
if [ -z "$PRODUCTION" ]; then
    echo "⚠️  WARNING: This script should be run on the production server."
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Deployment cancelled."
        exit 0
    fi
fi

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed."
    echo "   Install: curl -LO https://dl.k8s.io/release/\$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl && sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl"
    exit 1
fi

if ! command -v helm &> /dev/null; then
    echo "❌ Helm is not installed."
    echo "   Install: curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash"
    exit 1
fi

# Check for K3s or other Kubernetes
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Kubernetes cluster is not accessible."
    echo "   Make sure K3s or another Kubernetes distribution is installed and running."
    echo "   K3s install: curl -sfL https://get.k3s.io | sh -"
    exit 1
fi

# Check if Docker is available (for K3s, use ctr/crictl)
BUILD_TOOL=""
if command -v docker &> /dev/null; then
    BUILD_TOOL="docker"
elif command -v k3s &> /dev/null && command -v ctr &> /dev/null; then
    BUILD_TOOL="k3s-ctr"
else
    echo "❌ No container build tool found."
    echo "   Install Docker: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

echo "✅ Prerequisites check passed (using $BUILD_TOOL)"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create .env with your configuration."
    echo "   Copy .env.example to .env and update the values."
    exit 1
fi

# Load environment variables
source .env

# Validate required environment variables
if [ -z "$ETHEREUM_RPC_URL" ]; then
    echo "❌ ETHEREUM_RPC_URL is not set in .env"
    exit 1
fi

echo "✅ Configuration loaded from .env"

# Build Docker image
echo ""
echo "🐳 Step 1: Building Docker image"
if [ "$BUILD_TOOL" = "docker" ]; then
    docker build -t block-watcher:latest .
    echo "✅ Docker image built with Docker"
elif [ "$BUILD_TOOL" = "k3s-ctr" ]; then
    # For K3s without Docker, we need a different approach
    # Build with buildah or nerdctl if available
    if command -v nerdctl &> /dev/null; then
        nerdctl build -t block-watcher:latest .
        echo "✅ Image built with nerdctl"
    else
        echo "❌ Cannot build image without Docker or nerdctl"
        echo "   Install Docker: curl -fsSL https://get.docker.com | sh"
        echo "   Or install nerdctl: https://github.com/containerd/nerdctl/releases"
        exit 1
    fi
fi

# Import image to K3s if using K3s
if command -v k3s &> /dev/null && [ "$BUILD_TOOL" = "docker" ]; then
    echo "Importing image to K3s..."
    docker save block-watcher:latest | sudo k3s ctr images import -
    echo "✅ Image imported to K3s"
fi

# Create namespaces
echo ""
echo "🏗️  Step 2: Creating namespaces"
kubectl apply -f k8s/namespace.yaml
echo "✅ Namespaces created"

# Create secrets from .env
echo ""
echo "🔐 Step 3: Creating secrets from .env"
cd k8s && ./create-secrets.sh && cd ..
echo "✅ Secrets created"

# Deploy PostgreSQL with persistent storage
echo ""
echo "🗄️  Step 4: Deploying PostgreSQL with persistent storage"
kubectl apply -f k8s/postgres.yaml
echo "Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n block-watcher --timeout=180s || true
sleep 5
kubectl wait --for=condition=ready pod -l app=postgres -n block-watcher --timeout=60s
echo "✅ PostgreSQL ready"

# Deploy application
echo ""
echo "🚀 Step 5: Deploying application"
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
echo "Waiting for application to be ready..."
kubectl wait --for=condition=ready pod -l app=block-watcher -n block-watcher --timeout=180s || true
sleep 5
kubectl wait --for=condition=ready pod -l app=block-watcher -n block-watcher --timeout=60s
echo "✅ Application ready"

# Install or upgrade Prometheus Stack
echo ""
echo "📊 Step 6: Installing observability stack"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>/dev/null || true
helm repo update

if helm list -n observability | grep -q "prometheus"; then
    echo "Upgrading existing Prometheus stack..."
    helm upgrade prometheus prometheus-community/kube-prometheus-stack \
        --namespace observability \
        --reuse-values
else
    echo "Installing Prometheus stack..."
    helm install prometheus prometheus-community/kube-prometheus-stack \
        --namespace observability \
        --create-namespace \
        --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
        --set grafana.service.type=NodePort \
        --set grafana.service.nodePort=30081 \
        --set alertmanager.service.type=NodePort \
        --set alertmanager.service.nodePort=30082 \
        --set prometheus.service.type=NodePort \
        --set prometheus.service.nodePort=30090
fi

echo "Waiting for observability stack..."
sleep 20
echo "✅ Observability stack ready"

# Apply monitoring configuration
echo ""
echo "📈 Step 7: Applying monitoring configuration"
kubectl apply -f k8s/servicemonitor.yaml
kubectl apply -f k8s/prometheusrule.yaml
echo "✅ Monitoring configured"

# Check if ingress should be applied
echo ""
echo "🌐 Step 8: Configuring ingress (optional)"
if [ -f k8s/ingress.yaml ]; then
    read -p "Do you want to apply ingress configuration? (yes/no): " apply_ingress
    if [ "$apply_ingress" = "yes" ]; then
        # Check if NGINX Ingress Controller is installed
        if ! kubectl get pods -n kube-system | grep -q "ingress-nginx"; then
            echo "Installing NGINX Ingress Controller..."
            kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
            echo "Waiting for ingress controller..."
            sleep 30
        fi
        
        read -p "Enter your domain (e.g., example.com): " DOMAIN
        if [ -n "$DOMAIN" ]; then
            # Update ingress with domain
            sed -i.bak "s/your-domain.com/$DOMAIN/g" k8s/ingress.yaml
            kubectl apply -f k8s/ingress.yaml
            echo "✅ Ingress configured for $DOMAIN"
            echo ""
            echo "📋 Configure your DNS records:"
            echo "   api.$DOMAIN     → $(kubectl get nodes -o wide | awk 'NR==2 {print $6}')"
            echo "   grafana.$DOMAIN → $(kubectl get nodes -o wide | awk 'NR==2 {print $6}')"
            echo "   alerts.$DOMAIN  → $(kubectl get nodes -o wide | awk 'NR==2 {print $6}')"
        fi
    fi
else
    echo "⚠️  No ingress.yaml found, skipping ingress configuration"
fi

# Get Grafana admin password
GRAFANA_PASSWORD=$(kubectl get secret -n observability prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 --decode)

# Get node IP
NODE_IP=$(kubectl get nodes -o wide | awk 'NR==2 {print $6}')

# Print deployment summary
echo ""
echo "=============================================="
echo "✅ Production deployment completed!"
echo "=============================================="
echo ""
echo "📍 Access your services:"
echo ""
echo "   API Health: http://$NODE_IP:8080/health"
echo "   API Metrics: http://$NODE_IP:8080/metrics"
echo ""
echo "   Grafana: http://$NODE_IP:30081"
echo "   Username: admin"
echo "   Password: $GRAFANA_PASSWORD"
echo ""
echo "   Alertmanager: http://$NODE_IP:30082"
echo "   Prometheus: http://$NODE_IP:30090"
echo ""
echo "🔥 Important: Configure firewall rules to allow access:"
echo "   sudo ufw allow 8080/tcp    # API"
echo "   sudo ufw allow 30081/tcp   # Grafana"
echo "   sudo ufw allow 30082/tcp   # Alertmanager"
echo "   sudo ufw allow 30090/tcp   # Prometheus"
echo ""
echo "📋 Useful commands:"
echo ""
echo "   View logs:        kubectl logs -f -l app=block-watcher -n block-watcher"
echo "   View pods:        kubectl get pods -n block-watcher"
echo "   View all:         kubectl get all -n block-watcher"
echo "   Restart app:      kubectl rollout restart deployment/block-watcher -n block-watcher"
echo ""
echo "🔄 To update the application:"
echo "   git pull"
echo "   ./deploy-production.sh"
echo ""
echo "💾 Database data is persisted in: /var/lib/rancher/k3s/storage/"
echo ""
