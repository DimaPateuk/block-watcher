#!/bin/bash

# Phase 5 - Kubernetes Deployment Script for Block Watcher Observability Stack

set -e

echo "🚀 Starting Phase 5 - Kubernetes Deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}❌ kubectl is not installed${NC}"
    exit 1
fi

# Check if helm is installed
if ! command -v helm &> /dev/null; then
    echo -e "${RED}❌ helm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites checked${NC}"

# Step 1: Create namespaces
echo -e "${YELLOW}📦 Creating namespaces...${NC}"
kubectl apply -f namespace.yaml

# Step 2: Install Prometheus Operator via Helm
echo -e "${YELLOW}📊 Installing Prometheus Operator...${NC}"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Check if release already exists
if helm list -n observability | grep -q "observability"; then
    echo -e "${YELLOW}🔄 Upgrading existing Prometheus stack...${NC}"
    helm upgrade observability prometheus-community/kube-prometheus-stack \
        --namespace observability \
        --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
        --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false \
        --set prometheus.prometheusSpec.ruleSelectorNilUsesHelmValues=false \
        --set prometheus.prometheusSpec.retention=30d \
        --set grafana.adminPassword=admin123 \
        --wait
else
    echo -e "${YELLOW}🆕 Installing new Prometheus stack...${NC}"
    helm install observability prometheus-community/kube-prometheus-stack \
        --namespace observability \
        --create-namespace \
        --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
        --set prometheus.prometheusSpec.podMonitorSelectorNilUsesHelmValues=false \
        --set prometheus.prometheusSpec.ruleSelectorNilUsesHelmValues=false \
        --set prometheus.prometheusSpec.retention=30d \
        --set grafana.adminPassword=admin123 \
        --wait
fi

# Step 3: Deploy the NestJS application
echo -e "${YELLOW}🏗️ Deploying Block Watcher application...${NC}"
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Step 4: Create ServiceMonitor
echo -e "${YELLOW}📈 Creating ServiceMonitor...${NC}"
kubectl apply -f service-monitor.yaml

# Step 5: Create basic auth for Alertmanager (optional)
echo -e "${YELLOW}🔐 Creating Alertmanager basic auth...${NC}"
kubectl apply -f alertmanager-auth.yaml

# Step 6: Deploy Ingress (update domains first!)
echo -e "${YELLOW}⚠️  Please update the domain names in grafana-ingress.yaml before applying ingress${NC}"
echo -e "${YELLOW}🌐 To apply ingress (after domain update): kubectl apply -f grafana-ingress.yaml${NC}"

# Wait for deployments
echo -e "${YELLOW}⏳ Waiting for deployments to be ready...${NC}"
kubectl wait --for=condition=available --timeout=300s deployment/block-watcher -n block-watcher

echo -e "${GREEN}✅ Phase 5 deployment completed!${NC}"

# Print access information
echo ""
echo -e "${GREEN}🎉 Observability Stack Deployed Successfully!${NC}"
echo ""
echo "📊 Access Information:"
echo "Grafana: kubectl port-forward svc/observability-grafana 3000:80 -n observability"
echo "         Then visit: http://localhost:3000 (admin/admin123)"
echo ""
echo "🔥 Prometheus: kubectl port-forward svc/observability-kube-prometheus-prometheus 9090:9090 -n observability"
echo "              Then visit: http://localhost:9090"
echo ""
echo "📢 Alertmanager: kubectl port-forward svc/observability-alertmanager 9093:9093 -n observability"
echo "                Then visit: http://localhost:9093"
echo ""
echo "📈 Application: kubectl port-forward svc/block-watcher-service 8080:80 -n block-watcher"
echo "              Then visit: http://localhost:8080/metrics"
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "1. Update domain names in grafana-ingress.yaml"
echo "2. Install cert-manager for TLS certificates"
echo "3. Apply ingress: kubectl apply -f grafana-ingress.yaml"
echo "4. Import dashboards from monitoring/grafana/dashboards/"