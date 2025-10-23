#!/bin/bash

# Interactive Configuration Script
# This helps you configure the deployment for your server

echo "🔧 Block Watcher Deployment Configuration"
echo "=========================================="
echo ""

# Get server details
read -p "Server IP address: " SERVER_IP
read -p "Server username (e.g., ubuntu): " SERVER_USER
read -p "Your domain name (e.g., example.com): " DOMAIN

# Update deploy-remote.sh
echo ""
echo "Updating deploy-remote.sh..."
sed -i.bak "s/SERVER_USER=\".*\"/SERVER_USER=\"${SERVER_USER}\"/" deploy-remote.sh
sed -i.bak "s/SERVER_IP=\".*\"/SERVER_IP=\"${SERVER_IP}\"/" deploy-remote.sh
sed -i.bak "s/DOMAIN=\".*\"/DOMAIN=\"${DOMAIN}\"/" deploy-remote.sh
rm deploy-remote.sh.bak

# Update ingress.yaml
echo "Updating ingress.yaml..."
sed -i.bak "s/yourdomain.com/${DOMAIN}/g" ingress.yaml
rm ingress.yaml.bak

echo ""
echo "✅ Configuration complete!"
echo ""
echo "Your services will be available at:"
echo "  - API:          https://api.${DOMAIN}"
echo "  - Grafana:      https://grafana.${DOMAIN}"
echo "  - Alertmanager: https://alerts.${DOMAIN}"
echo ""
echo "Next steps:"
echo "1. Make sure DNS records point to ${SERVER_IP}:"
echo "   - api.${DOMAIN} → ${SERVER_IP}"
echo "   - grafana.${DOMAIN} → ${SERVER_IP}"
echo "   - alerts.${DOMAIN} → ${SERVER_IP}"
echo ""
echo "2. Deploy to server:"
echo "   ./deploy-remote.sh"
echo ""
echo "3. Or see SERVER-SETUP.md for manual installation"
