# Production Server Setup Guide

This guide will help you prepare an Ubuntu server for deploying the Block Watcher application.

## Prerequisites

- Ubuntu 20.04 or 22.04 server
- Root or sudo access
- At least 2GB RAM and 20GB disk space
- Public IP address

## Step 1: Initial Server Setup

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install basic tools
sudo apt install -y curl wget git nano ufw
```

## Step 2: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to docker group (optional, to run without sudo)
sudo usermod -aG docker $USER

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Verify installation
docker --version
```

## Step 3: Install K3s (Lightweight Kubernetes)

```bash
# Install K3s
curl -sfL https://get.k3s.io | sh -

# Wait for K3s to be ready
sudo systemctl status k3s

# Configure kubectl for your user
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $USER:$USER ~/.kube/config

# Verify K3s installation
kubectl get nodes
```

## Step 4: Install Helm

```bash
# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Verify installation
helm version
```

## Step 5: Configure Firewall

```bash
# Enable firewall
sudo ufw enable

# Allow SSH (IMPORTANT: Do this first!)
sudo ufw allow 22/tcp

# Allow application ports
sudo ufw allow 8080/tcp      # API
sudo ufw allow 30081/tcp     # Grafana
sudo ufw allow 30082/tcp     # Alertmanager
sudo ufw allow 30090/tcp     # Prometheus

# Allow HTTP/HTTPS if using Ingress
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check firewall status
sudo ufw status
```

## Step 6: Clone Repository and Configure

```bash
# Clone your repository
git clone <your-repo-url>
cd block-watcher

# Create .env file from example
cp .env.example .env
nano .env
```

### Edit .env file:

```bash
# Database credentials
POSTGRES_DB=blockwatcher
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<SECURE_PASSWORD_HERE>

# Application database URL
DATABASE_URL=postgresql://postgres:<SECURE_PASSWORD_HERE>@postgres.block-watcher.svc.cluster.local:5432/blockwatcher

# Ethereum RPC URL (required)
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY

# Application settings
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Monitoring settings
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
```

## Step 7: Deploy Application

```bash
# Run the production deployment script
./deploy-production.sh
```

The script will:
1. ✅ Check all prerequisites
2. ✅ Build the Docker image
3. ✅ Create Kubernetes namespaces
4. ✅ Deploy PostgreSQL with persistent storage
5. ✅ Deploy the application
6. ✅ Install Prometheus, Grafana, and Alertmanager
7. ✅ Configure monitoring and alerts

## Step 8: Access Your Services

After deployment completes, access your services:

```bash
# Get your server IP
curl ifconfig.me

# Access services (replace <SERVER_IP> with your IP)
API:           http://<SERVER_IP>:8080
Grafana:       http://<SERVER_IP>:30081
Alertmanager:  http://<SERVER_IP>:30082
Prometheus:    http://<SERVER_IP>:30090
```

## Optional: Configure Domain and HTTPS

### 1. Point DNS to your server

Create A records:
```
api.yourdomain.com      → <SERVER_IP>
grafana.yourdomain.com  → <SERVER_IP>
alerts.yourdomain.com   → <SERVER_IP>
```

### 2. Install cert-manager for HTTPS

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager
kubectl wait --for=condition=ready pod -l app=cert-manager -n cert-manager --timeout=120s
```

### 3. Apply ingress configuration

Edit `k8s/ingress.yaml` with your domain and apply:

```bash
kubectl apply -f k8s/ingress.yaml
```

## Maintenance Commands

```bash
# View application logs
kubectl logs -f -l app=block-watcher -n block-watcher

# View all resources
kubectl get all -n block-watcher
kubectl get all -n observability

# Restart application
kubectl rollout restart deployment/block-watcher -n block-watcher

# Update application
cd block-watcher
git pull
./deploy-production.sh

# Check persistent storage
sudo ls -lh /var/lib/rancher/k3s/storage/

# Backup database
kubectl exec -it -n block-watcher $(kubectl get pod -n block-watcher -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- pg_dump -U postgres blockwatcher > backup.sql
```

## Troubleshooting

### Check cluster status
```bash
kubectl cluster-info
kubectl get nodes
kubectl get pods --all-namespaces
```

### Check application health
```bash
curl http://localhost:8080/health
curl http://localhost:8080/metrics
```

### View logs
```bash
# Application logs
kubectl logs -f -l app=block-watcher -n block-watcher

# PostgreSQL logs
kubectl logs -f -l app=postgres -n block-watcher

# Previous container logs (if crashed)
kubectl logs -l app=block-watcher -n block-watcher --previous
```

### Common Issues

**Pod in CrashLoopBackOff:**
```bash
kubectl describe pod -l app=block-watcher -n block-watcher
kubectl logs -l app=block-watcher -n block-watcher --previous
```

**Database connection issues:**
```bash
# Check PostgreSQL is running
kubectl get pods -n block-watcher -l app=postgres

# Check secrets
kubectl get secrets -n block-watcher
```

**Image pull issues:**
```bash
# Check images in K3s
sudo k3s crictl images | grep block-watcher

# Rebuild and import
docker build -t block-watcher:latest .
docker save block-watcher:latest | sudo k3s ctr images import -
kubectl rollout restart deployment/block-watcher -n block-watcher
```

## Security Checklist

- [ ] Change default PostgreSQL password in .env
- [ ] Use strong, unique passwords
- [ ] Keep .env file secure (add to .gitignore)
- [ ] Configure firewall (ufw) properly
- [ ] Use HTTPS with cert-manager for production
- [ ] Regularly update system packages
- [ ] Monitor logs for suspicious activity
- [ ] Set up regular database backups
- [ ] Review and limit exposed ports

## Performance Tuning

### For production workloads, consider:

```yaml
# In k8s/deployment.yaml, adjust resources:
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

### Scale your application:

```bash
# Scale to 3 replicas
kubectl scale deployment/block-watcher --replicas=3 -n block-watcher
```

### Persistent storage optimization:

```bash
# Check PVC status
kubectl get pvc -n block-watcher

# Monitor storage usage
kubectl exec -it -n block-watcher $(kubectl get pod -n block-watcher -l app=postgres -o jsonpath='{.items[0].metadata.name}') -- df -h
```

## Next Steps

- Set up automated backups
- Configure custom Grafana dashboards
- Set up alert notifications (email, Slack, etc.)
- Implement log aggregation
- Set up CI/CD pipeline for automated deployments

For more details, see the [cookbook documentation](cookbook/).
