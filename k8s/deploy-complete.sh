#!/bin/bash

echo "🚀 Complete Observability Stack Deployment"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Build and Deploy App + Database
echo -e "${YELLOW}1. Building Docker image...${NC}"
cd .. && docker build -t block-watcher:local . && cd k8s

echo -e "${YELLOW}2. Creating secrets from .env file...${NC}"
chmod +x create-secrets.sh
./create-secrets.sh

echo -e "${YELLOW}3. Deploying Application + Database...${NC}"
kubectl apply -f namespace.yaml
kubectl apply -f postgres.yaml

echo "Waiting for database..."
kubectl wait --for=condition=available --timeout=120s deployment/postgres -n block-watcher

kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

echo "Waiting for application..."
kubectl wait --for=condition=available --timeout=120s deployment/block-watcher -n block-watcher

# Step 4: Install Prometheus Stack
echo -e "${YELLOW}4. Installing Prometheus + Grafana + Alertmanager...${NC}"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1
helm repo update

helm upgrade --install observability prometheus-community/kube-prometheus-stack \
    --namespace observability \
    --create-namespace \
    --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
    --set prometheus.prometheusSpec.retention=7d \
    --set grafana.adminPassword=admin123 \
    --wait --timeout=300s

# Step 5: Apply ServiceMonitor and Alert Rules
echo -e "${YELLOW}5. Configuring metrics scraping and alerts...${NC}"
kubectl apply -f service-monitor.yaml
kubectl apply -f alert-rules.yaml

# Step 6: Wait for everything
echo -e "${YELLOW}6. Waiting for observability stack...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment --all -n observability

# Step 7: Apply Ingress (if exists)
if [ -f ingress.yaml ]; then
    echo -e "${YELLOW}7. Configuring public access (Ingress)...${NC}"
    kubectl apply -f ingress.yaml
fi

echo ""
echo -e "${GREEN}✅ Complete Observability Stack Deployed!${NC}"
echo ""
echo "🎯 ACCESS POINTS:"
echo "================="
echo ""
echo "📊 GRAFANA (admin/admin123):"
echo "   kubectl port-forward svc/observability-grafana 3000:80 -n observability"
echo "   → http://localhost:3000"
echo ""
echo "🔥 PROMETHEUS:"
echo "   kubectl port-forward svc/observability-kube-prometheus-prometheus 9090:9090 -n observability" 
echo "   → http://localhost:9090"
echo ""
echo "🚨 ALERTMANAGER:"
echo "   kubectl port-forward svc/observability-alertmanager 9093:9093 -n observability"
echo "   → http://localhost:9093"
echo ""
echo "📈 YOUR APP METRICS:"
echo "   kubectl port-forward svc/block-watcher-service 8080:80 -n block-watcher"
echo "   → http://localhost:8080/api/metrics"
echo ""
echo "📋 CHECK LOGS:"
echo "   kubectl logs -l app=block-watcher -n block-watcher -f"
echo ""
echo "🔍 CHECK STATUS:"
echo "   kubectl get pods -A"
echo ""
echo "💡 QUICK VERIFICATION:"
echo "   ./verify.sh"
