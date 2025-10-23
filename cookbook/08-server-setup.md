# 🖥️ Ubuntu Server Setup Guide

Complete guide to setup your Ubuntu server for Kubernetes deployment.

## 📋 Prerequisites

- **Ubuntu Server** 20.04 or 22.04 LTS
- **Minimum**: 4 GB RAM, 2 CPU cores, 40 GB disk
- **Recommended**: 8 GB RAM, 4 CPU cores, 100 GB disk
- **Root or sudo access**
- **Public IP address**
- **Domain name** (e.g., yourdomain.com)

## 🚀 Step-by-Step Installation

### Step 1: Update System

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

### Step 2: Install K3s (Lightweight Kubernetes)

```bash
# Install K3s with built-in storage and ingress
curl -sfL https://get.k3s.io | sh -s - --write-kubeconfig-mode 644

# Wait for K3s to be ready
sudo k3s kubectl get nodes

# Setup kubectl for current user
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER:$USER ~/.kube/config

# Verify
kubectl get nodes
```

### Step 3: Install Helm

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Verify
helm version
```

### Step 4: Configure Firewall

```bash
# Allow HTTP, HTTPS, and SSH
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 6443/tcp  # Kubernetes API (optional, for remote kubectl)
sudo ufw enable
sudo ufw status
```

### Step 5: Setup DNS Records

Point these DNS A records to your server IP:

```
api.yourdomain.com      → YOUR_SERVER_IP
grafana.yourdomain.com  → YOUR_SERVER_IP
alerts.yourdomain.com   → YOUR_SERVER_IP
```

### Step 6: Install NGINX Ingress Controller

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml

# Wait for ingress to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

### Step 7: Install cert-manager (Optional - for HTTPS)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --namespace cert-manager \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/instance=cert-manager \
  --timeout=120s
```

### Step 8: Setup Let's Encrypt (Optional - for HTTPS)

Create `letsencrypt-prod.yaml`:

```bash
cat > ~/letsencrypt-prod.yaml << 'EOF'
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com  # UPDATE THIS
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

kubectl apply -f ~/letsencrypt-prod.yaml
```

## 📦 Deploy Your Application

### Option 1: From Your Local Machine (Recommended)

On your **local machine**:

```bash
# SSH into your server
ssh user@your-server

# Clone your repository
git clone <your-repo>
cd block-watcher

# Configure environment
cp .env.example .env
nano .env  # Update with your settings

# Deploy everything
./deploy-production.sh
```

### Option 2: Manually on Server

On your **Ubuntu server**:

```bash
# Create directory
mkdir -p ~/block-watcher/k8s
cd ~/block-watcher

# Transfer your files via scp from local machine:
# scp -r k8s/* user@server-ip:~/block-watcher/k8s/

# Build and deploy
./deploy-production.sh

# Apply ingress
kubectl apply -f ingress.yaml
```

## 🔒 Enable HTTPS (Optional)

Update `ingress.yaml` to add TLS:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: block-watcher-api
  namespace: block-watcher
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: api-tls
  rules:
  - host: api.yourdomain.com
    # ... rest of config
```

Then apply:
```bash
kubectl apply -f ingress.yaml
```

## ✅ Verification

```bash
# Check all pods
kubectl get pods -A

# Check ingress
kubectl get ingress -A

# Verify services are accessible
curl -I http://api.yourdomain.com/api/health/liveness
curl -I http://grafana.yourdomain.com

# View logs
kubectl logs -l app=block-watcher -n block-watcher -f
```

## 📊 Access Your Services

After deployment:

- **API**: http://api.yourdomain.com/api/metrics
- **API Docs**: http://api.yourdomain.com/docs
- **Grafana**: http://grafana.yourdomain.com (admin/admin123)
- **Alertmanager**: http://alerts.yourdomain.com
- **Database**: Hidden inside cluster (not publicly accessible ✅)

## 🔄 Updates & Maintenance

### Update Application

```bash
# SSH to server and run
ssh user@server
cd block-watcher
./deploy-production.sh
```

### Check Database Persistence

```bash
# SSH to server
ssh user@server-ip

# Check PVC status
kubectl get pvc -n block-watcher

# Database data is stored in /var/lib/rancher/k3s/storage/
# This survives cluster restarts!
```

### Backup Database

```bash
# Create backup
kubectl exec -n block-watcher deployment/postgres -- \
  pg_dump -U postgres blockwatcher > backup.sql

# Restore backup
kubectl exec -i -n block-watcher deployment/postgres -- \
  psql -U postgres blockwatcher < backup.sql
```

### View Application Logs

```bash
ssh user@server-ip
kubectl logs -l app=block-watcher -n block-watcher -f
```

### Restart Application

```bash
kubectl rollout restart deployment/block-watcher -n block-watcher
```

## 🛠️ Troubleshooting

### Pods not starting
```bash
kubectl get pods -A
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
```

### Ingress not working
```bash
kubectl get ingress -A
kubectl describe ingress <ingress-name> -n <namespace>
```

### Database data lost
```bash
# Check if PVC exists
kubectl get pvc -n block-watcher

# PVC should show "Bound" status
# Data is in: /var/lib/rancher/k3s/storage/pvc-xxxxx/
```

### Clean restart
```bash
# Delete everything except PVC (keeps database data)
kubectl delete namespace observability
kubectl delete deployment,service -n block-watcher --all

# Keep PVC (database data persists!)
# Then redeploy
cd ~/block-watcher
./deploy-production.sh
```

## 🎯 Production Checklist

- [ ] Server has 8GB+ RAM
- [ ] Firewall configured (ports 80, 443, 22)
- [ ] DNS records pointing to server
- [ ] K3s installed and running
- [ ] Helm installed
- [ ] NGINX Ingress Controller running
- [ ] Application deployed
- [ ] Database using PersistentVolumeClaim
- [ ] Ingress configured with your domains
- [ ] (Optional) HTTPS with Let's Encrypt
- [ ] (Optional) Database backups scheduled
- [ ] Monitoring in Grafana configured

## 📚 Useful Commands

```bash
# Check cluster resources
kubectl top nodes
kubectl top pods -A

# View all services
kubectl get svc -A

# Check storage
kubectl get pv,pvc -A

# Restart observability stack
kubectl rollout restart deployment -n observability

# Clean all (WARNING: deletes everything including database)
kubectl delete namespace block-watcher observability
```
