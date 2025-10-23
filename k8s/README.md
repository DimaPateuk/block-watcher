# 🚀 Kubernetes Deployment for Block Watcher

Complete Kubernetes deployment with observability stack.

## 📋 What Gets Deployed

- ✅ **Block Watcher NestJS App** with PostgreSQL database
- ✅ **Prometheus** (metrics collection)
- ✅ **Grafana** (dashboards & visualization)
- ✅ **Alertmanager** (alerting)
- ✅ **Alert Rules** (application monitoring)
- ✅ **Persistent Storage** for database

## 🎯 Two Deployment Workflows

### 🏠 Local Development

Run from your local machine with kind/minikube/k3d:

```bash
cd ..
./dev-local.sh
```

Access at: http://localhost:8080 | Grafana: http://localhost:3001

### 🚀 Production Deployment

SSH into your server and run:

```bash
git clone <your-repo>
cd block-watcher
cp .env.example .env
nano .env  # Configure
./deploy-production.sh
```

See **[../PRODUCTION-SETUP.md](../PRODUCTION-SETUP.md)** for complete server setup guide.

## 📊 Access Your Stack

### Grafana (Dashboards)
```bash
kubectl port-forward svc/observability-grafana 3000:80 -n observability
# Visit: http://localhost:3000
# Login: admin / admin123
```

### Prometheus (Metrics)
```bash
kubectl port-forward svc/observability-kube-prometheus-prometheus 9090:9090 -n observability
# Visit: http://localhost:9090
# Check targets: http://localhost:9090/targets
```

### Alertmanager (Alerts)
```bash
kubectl port-forward svc/observability-alertmanager 9093:9093 -n observability
# Visit: http://localhost:9093
```

### Your Application
```bash
kubectl port-forward svc/block-watcher-service 8080:80 -n block-watcher
# Metrics: http://localhost:8080/api/metrics
# Health: http://localhost:8080/api/health/liveness
# Docs: http://localhost:8080/docs
```

## 📋 Check Everything Works

```bash
./verify.sh
```

## 📝 View Application Logs

```bash
# Follow logs in real-time
kubectl logs -l app=block-watcher -n block-watcher -f

# View recent logs
kubectl logs -l app=block-watcher -n block-watcher --tail=50
```

## 🔍 Monitor Your App

1. **In Grafana**: Create dashboards using your app metrics
2. **In Prometheus**: Query `http_server_requests_seconds_count` for request metrics
3. **Alerts**: Check Alertmanager for any firing alerts

## 📁 File Structure

```
k8s/
├── namespace.yaml          # Kubernetes namespaces
├── postgres.yaml           # PostgreSQL with persistent storage
├── deployment.yaml         # Block Watcher app
├── service.yaml           # App service (NodePort)
├── servicemonitor.yaml     # Prometheus scraping config
├── prometheusrule.yaml     # Alert rules
├── ingress.yaml           # Ingress for public access (optional)
├── create-secrets.sh      # Create K8s secrets from .env
└── README.md              # This file

Root deployment scripts:
../dev-local.sh            # 🏠 Local Kubernetes development
../deploy-production.sh    # 🚀 Production deployment (run on server)
```

## 🆘 Troubleshooting

**App not starting?**
```bash
kubectl logs -l app=block-watcher -n block-watcher
kubectl describe pod -l app=block-watcher -n block-watcher
```

**Database issues?**
```bash
kubectl logs -l app=postgres -n block-watcher
```

**Prometheus not scraping?**
```bash
kubectl get servicemonitor -n observability
# Check Prometheus targets: http://localhost:9090/targets
```

**Clean restart:**
```bash
kubectl delete namespace block-watcher observability
./deploy-complete.sh
```
