# Production Deployment Guide

Deploy Block Watcher to production server with Kubernetes and full observability.

## Overview

**Important:** This guide is for **production deployment only**.

For **local development**, use Docker Compose instead (see [Local Development Guide](01-local-development.md)).

Production deployment includes:
- **NestJS Application** - Your app in a pod
- **PostgreSQL Database** - Persistent storage (10GB)
- **Prometheus** - Metrics collection
- **Grafana** - Dashboards
- **Alertmanager** - Alert routing
- **NGINX Ingress** - Public access

## Quick Production Deployment

**Prerequisites:**
- Ubuntu Server 20.04 or 22.04
- Minimum: 8GB RAM, 4 CPU cores, 50GB disk
- Public IP address
- Domain name (optional, for HTTPS)
- SSH access with key

**Quick Deploy:**

```bash
# SSH into your production server
ssh user@your-server

# Clone and configure
git clone <your-repo>
cd block-watcher
cp .env.example .env
nano .env  # Configure your environment

# Deploy everything
./deploy-production.sh
```

That's it! The script handles everything.

## Architecture

### Kubernetes Cluster Layout

```
Ubuntu Server (8.8.8.8)
│
├─→ api.yourdomain.com         (Public Access)
├─→ grafana.yourdomain.com     (Public Access)
└─→ alerts.yourdomain.com      (Public Access)
       │
   [NGINX Ingress]
       │
┌──────┴─────────────────────────────────┐
│     Kubernetes Cluster (K3s)            │
│                                         │
│  Namespace: block-watcher               │
│  ┌────────────────┐  ┌───────────────┐│
│  │ Block Watcher  │  │  PostgreSQL   ││
│  │   (3 pods)     │◄─┤  (1 pod)      ││
│  │   NestJS App   │  │               ││
│  └────────┬───────┘  │  Persistent   ││
│           │          │  Volume 10GB  ││
│           │          └───────────────┘│
│           │ (scrapes)                  │
│           ▼                            │
│  Namespace: observability              │
│  ┌────────────────┐                   │
│  │   Prometheus   │                   │
│  │  (collects     │                   │
│  │   metrics)     │                   │
│  └────────┬───────┘                   │
│           │                            │
│           ├─→ [Grafana]                │
│           └─→ [Alertmanager]           │
│                                        │
│  🔒 Database is ClusterIP only         │
│     (not exposed to internet)          │
└────────────────────────────────────────┘
```

### Network Access

**Public (via Ingress):**
- `api.yourdomain.com` → Block Watcher API
- `grafana.yourdomain.com` → Grafana dashboards
- `alerts.yourdomain.com` → Alertmanager UI

**Private (ClusterIP only):**
- `postgres-service:5432` → PostgreSQL (hidden from internet)
- `observability-kube-prometheus-prometheus:9090` → Prometheus

## Kubernetes Manifests

### Core Application Files

**`namespace.yaml`** - Namespaces for organization
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: block-watcher
---
apiVersion: v1
kind: Namespace
metadata:
  name: observability
```

**`deployment.yaml`** - Application deployment
- 3 replicas for high availability
- Init container runs Prisma migrations
- Environment variables from secrets
- Health checks (liveness/readiness)
- Resource limits (CPU/memory)

**`service.yaml`** - Service to expose pods
- ClusterIP service
- Routes traffic to app pods
- Used by Ingress

**`postgres.yaml`** - Database deployment
- Single PostgreSQL instance
- PersistentVolumeClaim for data storage
- Credentials from secrets
- ClusterIP service (not exposed)

**`ingress.yaml`** - Public access configuration
- Routes domains to services
- NGINX Ingress Controller
- Optional TLS/HTTPS support

### Observability Files

**`service-monitor.yaml`** - Prometheus scraping config
- Tells Prometheus where to scrape metrics
- Scrapes `/api/metrics` every 15 seconds
- Adds labels (namespace, service, pod)

**`alert-rules.yaml`** - Alert definitions
- BlockWatcherDown - App is down
- BlockWatcherHighErrorRate - Too many errors
- BlockWatcherHighLatency - Slow responses
- BlockWatcherDatabaseDown - DB offline

## Deployment Scripts

### `deploy-production.sh` - Production Deployment

Deploys everything in order:
1. Builds Docker image
2. Creates secrets from `.env`
3. Deploys database
4. Deploys application
5. Installs Prometheus stack
6. Configures metrics scraping
7. Applies ingress (optional)

```bash
./deploy-production.sh
```

Run this on your production server. See [PRODUCTION-SETUP.md](../PRODUCTION-SETUP.md) for complete setup.

### `verify.sh` - Health Check

Tests that everything is working:
- Pods are running
- Metrics endpoint responding
- Prometheus discovering targets
- ServiceMonitor configured

```bash
./verify.sh
```

### `create-secrets.sh` - Secret Management

Creates Kubernetes secrets from `.env` file:
- `postgres-secret` - Database credentials
- `app-secret` - DATABASE_URL
- `env-secret` - All .env variables

```bash
cd k8s
./create-secrets.sh
```

This is automatically called by `deploy-production.sh`.

## Database Persistence

### How It Works

The database uses a **PersistentVolumeClaim (PVC)** to store data:

```yaml
# In postgres.yaml
volumes:
- name: postgres-storage
  persistentVolumeClaim:
    claimName: postgres-pvc
```

**Storage Location:** `/var/lib/rancher/k3s/storage/pvc-xxxxx/`

**Data Survives:**
- ✅ Pod restarts
- ✅ Deployment updates
- ✅ Node restarts
- ✅ Cluster restarts
- ✅ Even namespace deletion (if you keep the PVC)

**Data Lost Only If:**
- ❌ PVC is explicitly deleted
- ❌ Node disk fails (without backup)

### Backup & Restore

**Create Backup:**
```bash
# Local Kubernetes
kubectl exec -n block-watcher deployment/postgres -- \
  pg_dump -U postgres blockwatcher > backup-$(date +%Y%m%d).sql

# Remote server
ssh user@server 'kubectl exec -n block-watcher deployment/postgres -- \
  pg_dump -U postgres blockwatcher > ~/backup.sql'
```

**Restore Backup:**
```bash
# Local
kubectl exec -i -n block-watcher deployment/postgres -- \
  psql -U postgres blockwatcher < backup.sql

# Remote
cat backup.sql | ssh user@server \
  'kubectl exec -i -n block-watcher deployment/postgres -- \
   psql -U postgres blockwatcher'
```

**Schedule Automated Backups:**
```yaml
# cronjob-backup.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: block-watcher
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15-alpine
            command:
            - /bin/sh
            - -c
            - pg_dump -U postgres -h postgres-service blockwatcher > /backup/backup-$(date +%Y%m%d).sql
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: POSTGRES_PASSWORD
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          restartPolicy: OnFailure
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
```

## Monitoring & Observability

### Prometheus

Prometheus scrapes metrics from your app every 15 seconds.

**Access Prometheus:**
```bash
# Local
kubectl port-forward svc/observability-kube-prometheus-prometheus 9090:9090 -n observability
open http://localhost:9090

# Check targets
open http://localhost:9090/targets
```

**Query Examples:**
```promql
# Request rate
rate(http_server_requests_seconds_count[5m])

# Error rate
rate(http_server_requests_seconds_count{status=~"5.."}[5m])

# Memory usage
nodejs_heap_size_total_bytes
```

### Grafana

Grafana visualizes Prometheus metrics.

**Access Grafana:**
```bash
# Local
kubectl port-forward svc/observability-grafana 3000:80 -n observability
open http://localhost:3000

# Production
open https://grafana.yourdomain.com

# Login: admin / admin123
```

**Create Dashboard:**
1. Add Prometheus data source: `http://observability-kube-prometheus-prometheus.observability:9090`
2. Create new dashboard
3. Add panels with queries
4. Save dashboard

### Alertmanager

Alertmanager routes alerts to notification channels.

**Access Alertmanager:**
```bash
# Local
kubectl port-forward svc/observability-alertmanager 9093:9093 -n observability
open http://localhost:9093

# Production
open https://alerts.yourdomain.com
```

**Configure Slack Notifications:**
```yaml
# alertmanager-config.yaml
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-config
  namespace: observability
stringData:
  alertmanager.yaml: |
    route:
      receiver: 'slack'
    receivers:
    - name: 'slack'
      slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'
```

## Scaling

### Horizontal Pod Autoscaling

Scale based on CPU usage:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: block-watcher-hpa
  namespace: block-watcher
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: block-watcher
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Manual Scaling

```bash
# Scale to 5 replicas
kubectl scale deployment block-watcher --replicas=5 -n block-watcher

# Check status
kubectl get pods -n block-watcher
```

## Updates & Rollbacks

### Rolling Update

```bash
# Build new image
docker build -t block-watcher:v2 .

# Update deployment
kubectl set image deployment/block-watcher \
  block-watcher=block-watcher:v2 \
  -n block-watcher

# Watch rollout
kubectl rollout status deployment/block-watcher -n block-watcher
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/block-watcher -n block-watcher

# Rollback to specific revision
kubectl rollout undo deployment/block-watcher --to-revision=2 -n block-watcher

# Check rollout history
kubectl rollout history deployment/block-watcher -n block-watcher
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n block-watcher

# Describe pod (shows events)
kubectl describe pod <pod-name> -n block-watcher

# View logs
kubectl logs <pod-name> -n block-watcher

# Check previous container logs (if crashed)
kubectl logs <pod-name> -n block-watcher --previous
```

### Database Connection Failed

```bash
# Check if postgres pod is running
kubectl get pods -l app=postgres -n block-watcher

# Check secrets exist
kubectl get secrets -n block-watcher

# View secret (decoded)
kubectl get secret app-secret -n block-watcher \
  -o jsonpath='{.data.DATABASE_URL}' | base64 -d

# Test connection from app pod
kubectl exec -it deployment/block-watcher -n block-watcher -- \
  wget -O- postgres-service:5432
```

### Metrics Not Appearing

```bash
# Check ServiceMonitor
kubectl get servicemonitor -n observability

# Check if Prometheus is scraping
kubectl port-forward svc/observability-kube-prometheus-prometheus 9090:9090 -n observability
open http://localhost:9090/targets

# Check app metrics endpoint
kubectl port-forward svc/block-watcher-service 8080:80 -n block-watcher
curl http://localhost:8080/api/metrics
```

### Ingress Not Working

```bash
# Check ingress
kubectl get ingress -A

# Check NGINX Ingress Controller
kubectl get pods -n ingress-nginx

# Check ingress logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Test DNS
dig api.yourdomain.com
ping api.yourdomain.com
```

## Common Operations

### View Logs
```bash
# Follow logs
kubectl logs -l app=block-watcher -n block-watcher -f

# Last 100 lines
kubectl logs -l app=block-watcher -n block-watcher --tail=100

# Logs from all pods
kubectl logs -l app=block-watcher -n block-watcher --all-containers
```

### Execute Commands in Pod
```bash
# Shell access
kubectl exec -it deployment/block-watcher -n block-watcher -- /bin/sh

# Run single command
kubectl exec deployment/block-watcher -n block-watcher -- env
```

### Port Forwarding
```bash
# Forward local port to service
kubectl port-forward svc/block-watcher-service 8080:80 -n block-watcher

# Forward to pod directly
kubectl port-forward pod/<pod-name> 8080:3000 -n block-watcher
```

### Resource Usage
```bash
# Node resources
kubectl top nodes

# Pod resources
kubectl top pods -n block-watcher
```

### Clean Up
```bash
# Delete everything (keeps PVC)
kubectl delete namespace block-watcher observability

# Delete including PVC (data loss!)
kubectl delete namespace block-watcher observability
kubectl delete pvc -n block-watcher --all
```

## Next Steps

- **[Configuration Guide](03-configuration.md)** - Manage secrets and environment variables
- **[Observability Deep Dive](04-observability.md)** - Advanced monitoring
- **[Kubernetes Reference](05-kubernetes-reference.md)** - Detailed manifest documentation
