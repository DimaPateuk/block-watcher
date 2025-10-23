#!/bin/bash

# Remote Server Deployment Script
# This script deploys to your Ubuntu server via SSH

set -e

# Configuration - UPDATE THESE VALUES
SERVER_USER="your-username"
SERVER_IP="your-server-ip"
DOMAIN="yourdomain.com"  # Your domain name

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🚀 Remote Server Deployment"
echo "==========================="
echo ""
echo "Server: ${SERVER_USER}@${SERVER_IP}"
echo "Domain: ${DOMAIN}"
echo ""

# Step 1: Build Docker image locally
echo -e "${YELLOW}1. Building Docker image locally...${NC}"
cd .. && docker build -t block-watcher:latest . && cd k8s

# Step 2: Save and transfer Docker image
echo -e "${YELLOW}2. Transferring Docker image to server...${NC}"
docker save block-watcher:latest | gzip > /tmp/block-watcher.tar.gz
scp /tmp/block-watcher.tar.gz ${SERVER_USER}@${SERVER_IP}:/tmp/
rm /tmp/block-watcher.tar.gz

# Step 3: Transfer Kubernetes manifests
echo -e "${YELLOW}3. Transferring Kubernetes manifests...${NC}"
ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p ~/block-watcher/k8s"
scp *.yaml ${SERVER_USER}@${SERVER_IP}:~/block-watcher/k8s/
scp deploy-complete.sh verify.sh ${SERVER_USER}@${SERVER_IP}:~/block-watcher/k8s/

# Step 4: Update domain in ingress
echo -e "${YELLOW}4. Updating domain configuration...${NC}"
ssh ${SERVER_USER}@${SERVER_IP} << EOF
cd ~/block-watcher/k8s
sed -i "s/yourdomain.com/${DOMAIN}/g" ingress.yaml
chmod +x deploy-complete.sh verify.sh
EOF

# Step 5: Load Docker image and deploy
echo -e "${YELLOW}5. Deploying to Kubernetes on remote server...${NC}"
ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
cd ~/block-watcher/k8s

# Load Docker image
sudo k3s ctr images import /tmp/block-watcher.tar.gz
rm /tmp/block-watcher.tar.gz

# Deploy everything
./deploy-complete.sh

# Apply ingress
kubectl apply -f ingress.yaml

echo ""
echo "✅ Remote deployment complete!"
echo ""
echo "Your services are available at:"
echo "- API: https://api.${DOMAIN}"
echo "- Grafana: https://grafana.${DOMAIN} (admin/admin123)"
echo "- Alertmanager: https://alerts.${DOMAIN}"
EOF

echo ""
echo -e "${GREEN}✅ Deployment to remote server complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Point your DNS records to ${SERVER_IP}:"
echo "   - api.${DOMAIN} → ${SERVER_IP}"
echo "   - grafana.${DOMAIN} → ${SERVER_IP}"
echo "   - alerts.${DOMAIN} → ${SERVER_IP}"
echo ""
echo "2. Verify deployment:"
echo "   ssh ${SERVER_USER}@${SERVER_IP} 'cd ~/block-watcher/k8s && ./verify.sh'"
