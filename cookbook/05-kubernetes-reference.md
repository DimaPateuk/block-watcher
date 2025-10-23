# Kubernetes Manifests Reference

Detailed documentation of all Kubernetes manifests and scripts.

## File Structure

```
k8s/
├── Scripts
│   ├── create-secrets.sh      - Secret creation from .env
│   └── verify.sh              - Health verification
│
Root scripts:
├── deploy-production.sh       - Production deployment (run on server)
└── dev-local.sh               - Local Kubernetes development
│
├── Core Application
│   ├── namespace.yaml         - Kubernetes namespaces
│   ├── deployment.yaml        - Application deployment
│   ├── service.yaml           - Service definition
│   ├── postgres.yaml          - Database + persistence
│   └── ingress.yaml           - Public access routes
│
└── Observability
    ├── service-monitor.yaml   - Prometheus scraping config
    ├── alert-rules.yaml       - Alert definitions
    └── SECRETS-GUIDE.md       - Secret management guide
```

## Core Manifests

### namespace.yaml

Creates two namespaces to separate application from observability stack.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: block-watcher
  labels:
    name: block-watcher
---
apiVersion: v1
kind: Namespace
metadata:
  name: observability
  labels:
    name: observability
```

**Purpose:**
- `block-watcher` - Application and database
- `observability` - Prometheus, Grafana, Alertmanager

**Why separate namespaces:**
- Logical separation
- Resource quotas
- Network policies
- RBAC isolation

### deployment.yaml

Defines how the application runs.

**Key Sections:**

**Replicas:**
```yaml
spec:
  replicas: 1  # Number of pods
```

**Init Container (Migrations):**
```yaml
initContainers:
- name: prisma-migrate
  image: block-watcher:local
  command: ["npx", "prisma", "db", "push"]
  env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: app-secret
        key: DATABASE_URL
```

Runs before main container to apply database migrations.

**Main Container:**
```yaml
containers:
- name: block-watcher
  image: block-watcher:local
  imagePullPolicy: Never  # Use local image (for Docker Desktop)
  ports:
  - containerPort: 3000
```

**Environment Variables:**
```yaml
envFrom:
- secretRef:
    name: env-secret  # Loads ALL .env variables

env:
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: app-secret
      key: DATABASE_URL
```

**Health Checks:**
```yaml
livenessProbe:
  httpGet:
    path: /api/health/liveness
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/health/readiness
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 5
  failureThreshold: 3
```

**Resource Limits:**
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

**Annotations for Prometheus:**
```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3000"
  prometheus.io/path: "/api/metrics"
```

### service.yaml

Exposes the application pods.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: block-watcher-service
  namespace: block-watcher
  labels:
    app: block-watcher
spec:
  selector:
    app: block-watcher  # Selects pods with this label
  ports:
  - name: http
    port: 80          # Service port
    targetPort: 3000  # Container port
    protocol: TCP
  type: ClusterIP     # Internal only
```

**Service Types:**
- `ClusterIP` - Internal only (default)
- `NodePort` - Exposes on node IP
- `LoadBalancer` - Cloud load balancer
- `ExternalName` - DNS alias

### postgres.yaml

Database with persistent storage.

**Deployment:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: block-watcher
spec:
  replicas: 1  # Single instance (not HA)
  template:
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: POSTGRES_DB
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: POSTGRES_PASSWORD
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
```

**PersistentVolumeClaim:**
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: block-watcher
spec:
  accessModes:
    - ReadWriteOnce  # Single node access
  resources:
    requests:
      storage: 10Gi  # 10 GB storage
  storageClassName: local-path  # K3s default
```

**Service:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: block-watcher
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP  # Not exposed externally
```

### ingress.yaml

Routes external traffic to services.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: block-watcher-api
  namespace: block-watcher
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: block-watcher-service
            port:
              number: 80
```

**With TLS:**
```yaml
spec:
  tls:
  - hosts:
    - api.yourdomain.com
    secretName: api-tls  # Certificate secret
  rules:
  - host: api.yourdomain.com
    # ... paths
```

**Annotations for HTTPS redirect:**
```yaml
annotations:
  cert-manager.io/cluster-issuer: "letsencrypt-prod"
  nginx.ingress.kubernetes.io/ssl-redirect: "true"
  nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
```

## Observability Manifests

### service-monitor.yaml

Tells Prometheus how to scrape metrics.

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: block-watcher-service-monitor
  namespace: observability
  labels:
    release: observability  # CRITICAL: Must match Prometheus selector
spec:
  namespaceSelector:
    matchNames:
    - block-watcher  # Watch this namespace
  selector:
    matchLabels:
      app: block-watcher  # Select services with this label
  endpoints:
  - port: http  # Must match service port name
    path: /api/metrics
    interval: 15s
    scrapeTimeout: 10s
    relabelings:
    - sourceLabels: [__meta_kubernetes_service_name]
      targetLabel: service
    - sourceLabels: [__meta_kubernetes_namespace]
      targetLabel: namespace
    - sourceLabels: [__meta_kubernetes_pod_name]
      targetLabel: instance
```

**Key Points:**
- Must be in `observability` namespace
- Label `release: observability` required
- Service must have matching label
- Port name must match

### alert-rules.yaml

Defines when to trigger alerts.

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: block-watcher-alerts
  namespace: observability
  labels:
    release: observability  # Required for Prometheus to use it
spec:
  groups:
  - name: block-watcher
    rules:
    - alert: BlockWatcherDown
      expr: up{service="block-watcher-service"} == 0
      for: 1m
      labels:
        severity: critical
      annotations:
        summary: "Block Watcher application is down"
        description: "No pods responding for 1 minute"
```

**Alert Structure:**
- `alert` - Alert name
- `expr` - PromQL expression
- `for` - How long condition must be true
- `labels` - Categorization (severity, team)
- `annotations` - Human-readable info

## Deployment Scripts

### deploy-production.sh (root)

Production deployment automation (run on server).

**What it does:**
1. Checks prerequisites (kubectl, helm, K3s)
2. Builds Docker image
3. Creates secrets from .env
4. Deploys PostgreSQL
5. Deploys application
6. Installs Prometheus stack
7. Configures monitoring
8. Optionally applies ingress

**Usage:**
```bash
# On production server
./deploy-production.sh
```

**Idempotent:** Safe to run multiple times.

### dev-local.sh (root)

Local Kubernetes development setup.

**What it does:**
1. Creates local K8s cluster (kind/minikube/k3d)
2. Builds and loads Docker image
3. Creates secrets from .env
4. Deploys PostgreSQL
5. Deploys application
6. Optionally installs observability stack

**Usage:**
```bash
# On local machine
./dev-local.sh
```

### create-secrets.sh

Creates Kubernetes secrets from `.env`.

**Creates 3 secrets:**
1. `postgres-secret` - DB credentials
2. `app-secret` - DATABASE_URL
3. `env-secret` - All .env variables

**Usage:**
```bash
cd k8s
./create-secrets.sh
```

**Called automatically by `deploy-production.sh` and `dev-local.sh`.

### verify.sh

Health check script.

**Checks:**
- Pods are running
- Metrics endpoint responds
- Prometheus targets configured
- ServiceMonitor exists

**Usage:**
```bash
./verify.sh
```

## Common Patterns

### Labels and Selectors

**Deployment labels pods:**
```yaml
template:
  metadata:
    labels:
      app: block-watcher
```

**Service selects pods:**
```yaml
selector:
  app: block-watcher
```

**ServiceMonitor selects service:**
```yaml
selector:
  matchLabels:
    app: block-watcher
```

### Environment Variables

**From literal:**
```yaml
env:
- name: NODE_ENV
  value: "production"
```

**From secret:**
```yaml
env:
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: app-secret
      key: DATABASE_URL
```

**All from secret:**
```yaml
envFrom:
- secretRef:
    name: env-secret
```

**From ConfigMap:**
```yaml
env:
- name: LOG_LEVEL
  valueFrom:
    configMapKeyRef:
      name: app-config
      key: LOG_LEVEL
```

### Resource Management

**Requests vs Limits:**
```yaml
resources:
  requests:
    memory: "256Mi"  # Guaranteed minimum
    cpu: "100m"      # 0.1 CPU cores
  limits:
    memory: "512Mi"  # Maximum allowed
    cpu: "500m"      # 0.5 CPU cores
```

**QoS Classes:**
- `Guaranteed` - requests == limits
- `Burstable` - requests < limits
- `BestEffort` - no requests/limits

### Volume Mounts

**PersistentVolumeClaim:**
```yaml
volumes:
- name: data
  persistentVolumeClaim:
    claimName: my-pvc

volumeMounts:
- name: data
  mountPath: /data
```

**EmptyDir (temporary):**
```yaml
volumes:
- name: temp
  emptyDir: {}
```

**ConfigMap:**
```yaml
volumes:
- name: config
  configMap:
    name: app-config
```

**Secret:**
```yaml
volumes:
- name: certs
  secret:
    secretName: tls-secret
```

## Troubleshooting Guide

### Pod Won't Start

```bash
# Check pod status
kubectl get pods -n block-watcher

# View events
kubectl describe pod <pod-name> -n block-watcher

# Common issues:
# - ImagePullBackOff: Image not found
# - CrashLoopBackOff: App crashes on start
# - Pending: No resources available
```

### Service Not Accessible

```bash
# Check service exists
kubectl get svc -n block-watcher

# Check endpoints
kubectl get endpoints block-watcher-service -n block-watcher

# Should show pod IPs
# If empty, selector doesn't match pod labels
```

### Ingress Not Working

```bash
# Check ingress
kubectl get ingress -n block-watcher

# Check NGINX controller
kubectl get pods -n ingress-nginx

# Check logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

### PVC Won't Bind

```bash
# Check PVC status
kubectl get pvc -n block-watcher

# Check PV available
kubectl get pv

# Check storage class
kubectl get storageclass
```

## Best Practices

**1. Use Labels Consistently**
```yaml
labels:
  app: block-watcher
  component: api
  version: v1
```

**2. Set Resource Limits**
```yaml
resources:
  requests: # Start small
  limits:   # Prevent runaway
```

**3. Health Checks Always**
```yaml
livenessProbe: ...
readinessProbe: ...
```

**4. Secrets, Not Hardcoded**
```yaml
env:
- name: PASSWORD
  valueFrom:
    secretKeyRef: ...
```

**5. Use Namespaces**
Separate environments/teams.

**6. Add Annotations**
```yaml
annotations:
  description: "Main API service"
  owner: "platform-team"
```

**7. Version Everything**
```yaml
labels:
  version: "1.2.3"
```

## Next Steps

- **[Production Checklist](06-production-checklist.md)** - Pre-deployment verification
- **[Troubleshooting Guide](07-troubleshooting.md)** - Common issues and solutions
