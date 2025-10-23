# Quick Reference Guide

## 🏠 Local Development Workflow

### Initial Setup (once)
```bash
# 1. Install prerequisites
brew install kind        # or minikube/k3d
brew install kubectl
brew install helm

# 2. Configure environment
cp .env.example .env
nano .env  # Add ETHEREUM_RPC_URL
```

### Start Development
```bash
./dev-local.sh
```

**Access:**
- API: http://localhost:8080
- Grafana: http://localhost:3001 (admin/prom-operator)
- Alertmanager: http://localhost:9093

### Development Cycle
```bash
# Make code changes, then:
docker build -t block-watcher:local .
kind load docker-image block-watcher:local --name block-watcher-dev
kubectl rollout restart deployment/block-watcher -n block-watcher

# View logs
kubectl logs -f -l app=block-watcher -n block-watcher
```

### Cleanup
```bash
kind delete cluster --name block-watcher-dev
```

---

## 🚀 Production Deployment Workflow

### Server Preparation (once)

```bash
# 1. SSH to server
ssh user@your-server-ip

# 2. Install dependencies
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
curl -sfL https://get.k3s.io | sh -
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# 3. Configure firewall
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 30081/tcp
sudo ufw allow 30082/tcp
sudo ufw allow 30090/tcp

# 4. Clone repository
git clone <your-repo-url>
cd block-watcher
```

### Deploy Application

```bash
# 1. Create .env file
cp .env.example .env
nano .env  # Configure with production values

# 2. Deploy
./deploy-production.sh
```

**Access (replace SERVER_IP with your IP):**
- API: http://SERVER_IP:8080
- Grafana: http://SERVER_IP:30081
- Alertmanager: http://SERVER_IP:30082
- Prometheus: http://SERVER_IP:30090

### Update Application

```bash
# SSH to server
cd block-watcher
git pull
./deploy-production.sh
```

---

## 📋 Common Commands

### View Resources
```bash
kubectl get all -n block-watcher
kubectl get all -n observability
kubectl get pvc -n block-watcher  # Check persistent storage
```

### View Logs
```bash
# Application logs
kubectl logs -f -l app=block-watcher -n block-watcher

# Database logs
kubectl logs -f -l app=postgres -n block-watcher

# Previous logs (if crashed)
kubectl logs -l app=block-watcher -n block-watcher --previous
```

### Restart Services
```bash
kubectl rollout restart deployment/block-watcher -n block-watcher
kubectl rollout restart deployment/postgres -n block-watcher
```

### Debug Pods
```bash
kubectl describe pod -l app=block-watcher -n block-watcher
kubectl get events -n block-watcher --sort-by='.lastTimestamp'
```

### Access Database
```bash
# Get pod name
kubectl get pods -n block-watcher -l app=postgres

# Connect to database
kubectl exec -it <postgres-pod-name> -n block-watcher -- psql -U postgres -d blockwatcher
```

### Check Secrets
```bash
kubectl get secrets -n block-watcher
kubectl describe secret postgres-secret -n block-watcher
kubectl describe secret app-secret -n block-watcher
```

---

## 🔧 Troubleshooting Quick Fixes

### Pod CrashLoopBackOff
```bash
kubectl logs -l app=block-watcher -n block-watcher --previous
kubectl describe pod -l app=block-watcher -n block-watcher
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
kubectl get pods -n block-watcher -l app=postgres

# Check database logs
kubectl logs -l app=postgres -n block-watcher

# Verify secrets
kubectl get secret postgres-secret -n block-watcher -o yaml
```

### Image Not Found
```bash
# For local development
docker build -t block-watcher:local .
kind load docker-image block-watcher:local --name block-watcher-dev

# For production
docker build -t block-watcher:latest .
docker save block-watcher:latest | sudo k3s ctr images import -
```

### Metrics Not Showing in Prometheus
```bash
# Check ServiceMonitor
kubectl get servicemonitor -n observability

# Check if Prometheus is scraping
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n observability
# Visit: http://localhost:9090/targets
```

### Clean Restart (Nuclear Option)
```bash
# Local
kind delete cluster --name block-watcher-dev
./dev-local.sh

# Production (⚠️ DELETES ALL DATA)
kubectl delete namespace block-watcher observability
./deploy-production.sh
```

---

## 📊 Monitoring Quick Start

### Create Grafana Dashboard

1. Access Grafana
2. Add Prometheus data source: `http://prometheus-kube-prometheus-prometheus.observability:9090`
3. Create dashboard with these queries:

**Request Rate:**
```promql
rate(http_server_requests_seconds_count[5m])
```

**Request Duration (95th percentile):**
```promql
histogram_quantile(0.95, rate(http_server_requests_seconds_bucket[5m]))
```

**Active Database Connections:**
```promql
nestjs_database_connections_active
```

### Check Alerts
```bash
# View alert rules
kubectl get prometheusrules -n observability

# Check firing alerts in Alertmanager
kubectl port-forward svc/prometheus-kube-prometheus-alertmanager 9093:9093 -n observability
# Visit: http://localhost:9093
```

---

## 🔐 Security Checklist

- [ ] Change default PostgreSQL password in .env
- [ ] Use strong, unique passwords
- [ ] Keep .env out of version control (check .gitignore)
- [ ] Configure firewall properly (ufw)
- [ ] Use HTTPS with cert-manager for production
- [ ] Regularly update system packages
- [ ] Set up regular database backups
- [ ] Review exposed ports
- [ ] Limit SSH access (use SSH keys)
- [ ] Monitor security logs

---

## 📚 Additional Resources

- [Full Production Setup Guide](PRODUCTION-SETUP.md)
- [Main README](README.md)
- [Cookbook Documentation](cookbook/)
- [Kubernetes Manifests](k8s/)
