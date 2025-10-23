# Observability Stack

Complete monitoring, metrics, and alerting for Block Watcher.

## What is Observability?

Observability means understanding what's happening inside your application by examining its outputs:
- **Metrics** - Numerical data (request count, latency, memory usage)
- **Logs** - Event records (errors, info, debug)
- **Health Checks** - Application status (alive, ready)
- **Alerts** - Notifications when things go wrong

## Architecture

```
┌───────────────────────────────────────┐
│      Block Watcher Application       │
│                                       │
│  ┌─────────────┐  ┌────────────────┐│
│  │   Metrics   │  │ Health Checks  ││
│  │   Module    │  │    Module      ││
│  └──────┬──────┘  └────────────────┘│
│         │ exposes /api/metrics       │
└─────────┼───────────────────────────┘
          │
          │ (scrapes every 15s)
          ▼
   ┌────────────────┐
   │   Prometheus   │
   │   (collects &  │
   │    stores)     │
   └───────┬────────┘
           │
           ├──→ [Grafana] ──→ Dashboards
           │
           └──→ [Alertmanager] ──→ Notifications
```

## Components

### 1. Application Metrics (/api/metrics)

The application exposes Prometheus metrics at `/api/metrics`.

**View metrics:**
```bash
curl http://localhost:3000/api/metrics
```

**Metrics exposed:**

**HTTP Metrics:**
- `http_server_requests_seconds_count` - Total requests
- `http_server_requests_seconds_sum` - Total request duration
- `http_server_requests_seconds_bucket` - Request latency histogram

**Node.js Metrics:**
- `nodejs_heap_size_total_bytes` - Heap memory total
- `nodejs_heap_size_used_bytes` - Heap memory used
- `nodejs_process_cpu_seconds_total` - CPU time
- `nodejs_eventloop_lag_seconds` - Event loop lag

**Custom Business Metrics:**
- `evm_blocks_processed_total` - Blocks processed
- `evm_blocks_errors_total` - Processing errors

### 2. Health Checks

The application provides health check endpoints for Kubernetes probes.

**Liveness Probe** - Is the app alive?
```bash
curl http://localhost:3000/api/health/liveness

# Response:
{
  "status": "ok",
  "info": {
    "database": {"status": "up"}
  }
}
```

**Readiness Probe** - Is the app ready to serve traffic?
```bash
curl http://localhost:3000/api/health/readiness

# Response:
{
  "status": "ok",
  "info": {
    "database": {"status": "up"}
  },
  "details": {
    "database": {"status": "up"}
  }
}
```

**Kubernetes uses these:**
```yaml
livenessProbe:
  httpGet:
    path: /api/health/liveness
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/health/readiness
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 5
```

### 3. Prometheus

Prometheus scrapes metrics and stores time-series data.

**Access Prometheus:**
```bash
# Local Kubernetes
kubectl port-forward svc/observability-kube-prometheus-prometheus 9090:9090 -n observability
open http://localhost:9090

# Production
open https://prometheus.yourdomain.com  # (if configured)
```

**Check Targets:**
Visit http://localhost:9090/targets to see if your app is being scraped.

Should show:
- Target: `block-watcher-service-monitor`
- State: `UP` (green)
- Labels: `namespace=block-watcher, pod=block-watcher-xxx`

**Query Examples:**

```promql
# Request rate (requests per second)
rate(http_server_requests_seconds_count[5m])

# Request rate by status code
rate(http_server_requests_seconds_count{status="200"}[5m])

# Error rate
rate(http_server_requests_seconds_count{status=~"5.."}[5m])

# P95 latency
histogram_quantile(0.95, 
  rate(http_server_requests_seconds_bucket[5m])
)

# Memory usage
nodejs_heap_size_used_bytes / 1024 / 1024  # MB

# CPU usage
rate(nodejs_process_cpu_seconds_total[5m])

# Blocks processed per minute
rate(evm_blocks_processed_total[1m]) * 60
```

### 4. Grafana

Grafana visualizes Prometheus metrics in dashboards.

**Access Grafana:**
```bash
# Local
kubectl port-forward svc/observability-grafana 3000:80 -n observability
open http://localhost:3000

# Login: admin / admin123

# Production
open https://grafana.yourdomain.com
```

**Setup Data Source:**
1. Go to Configuration → Data Sources
2. Add Prometheus
3. URL: `http://observability-kube-prometheus-prometheus.observability:9090`
4. Save & Test

**Create Dashboard:**

1. Click "+" → Dashboard
2. Add Panel
3. Select Prometheus data source
4. Enter query:
   ```promql
   rate(http_server_requests_seconds_count[5m])
   ```
5. Set title: "Request Rate"
6. Save dashboard

**Example Panels:**

**Request Rate:**
```promql
sum(rate(http_server_requests_seconds_count[5m]))
```

**Error Rate:**
```promql
sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m]))
```

**Response Time (P95):**
```promql
histogram_quantile(0.95, 
  sum(rate(http_server_requests_seconds_bucket[5m])) by (le)
)
```

**Memory Usage:**
```promql
nodejs_heap_size_used_bytes{service="block-watcher"}
```

**Active Pods:**
```promql
count(up{service="block-watcher-service"})
```

### 5. Alertmanager

Alertmanager receives alerts from Prometheus and routes them to notification channels.

**Access Alertmanager:**
```bash
# Local
kubectl port-forward svc/observability-alertmanager 9093:9093 -n observability
open http://localhost:9093

# Production
open https://alerts.yourdomain.com
```

**View Active Alerts:**
The UI shows:
- **Firing** - Alerts currently active
- **Silenced** - Alerts temporarily muted
- **Inhibited** - Alerts suppressed by other alerts

## Alert Rules

Four custom alert rules monitor the application.

### 1. BlockWatcherDown
Application is completely down.

```yaml
alert: BlockWatcherDown
expr: up{service="block-watcher-service"} == 0
for: 1m
severity: critical
```

**When it fires:**
- No metrics received for 1 minute
- All pods are down
- Kubernetes can't reach any pod

**How to fix:**
```bash
kubectl get pods -n block-watcher
kubectl logs -l app=block-watcher -n block-watcher
kubectl describe pod <pod-name> -n block-watcher
```

### 2. BlockWatcherHighErrorRate
Too many 5xx errors.

```yaml
alert: BlockWatcherHighErrorRate
expr: rate(http_server_requests_seconds_count{status=~"5.."}[5m]) > 0.1
for: 2m
severity: warning
```

**When it fires:**
- More than 0.1 errors per second for 2 minutes
- Application returning 500 errors

**How to fix:**
```bash
# Check logs for errors
kubectl logs -l app=block-watcher -n block-watcher | grep ERROR

# Check database connection
kubectl exec -it deployment/block-watcher -n block-watcher -- \
  wget -O- postgres-service:5432
```

### 3. BlockWatcherHighLatency
Responses are too slow.

```yaml
alert: BlockWatcherHighLatency
expr: histogram_quantile(0.95, 
  rate(http_server_requests_seconds_bucket[5m])) > 0.5
for: 2m
severity: warning
```

**When it fires:**
- P95 latency exceeds 500ms for 2 minutes
- 95% of requests taking longer than 500ms

**How to fix:**
```bash
# Check resource usage
kubectl top pods -n block-watcher

# Check database performance
kubectl logs -l app=postgres -n block-watcher

# Scale up if needed
kubectl scale deployment block-watcher --replicas=5 -n block-watcher
```

### 4. BlockWatcherDatabaseDown
PostgreSQL database is offline.

```yaml
alert: BlockWatcherDatabaseDown
expr: up{job="postgres"} == 0
for: 1m
severity: critical
```

**When it fires:**
- Database pod is down
- Application can't connect to database

**How to fix:**
```bash
# Check database pod
kubectl get pods -l app=postgres -n block-watcher

# Check logs
kubectl logs -l app=postgres -n block-watcher

# Restart if needed
kubectl delete pod -l app=postgres -n block-watcher
```

## Configuring Notifications

### Slack Notifications

**1. Create Slack Webhook:**
1. Go to https://api.slack.com/apps
2. Create new app
3. Enable Incoming Webhooks
4. Create webhook for channel
5. Copy webhook URL

**2. Configure Alertmanager:**
```yaml
# alertmanager-config.yaml
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-config
  namespace: observability
type: Opaque
stringData:
  alertmanager.yaml: |
    global:
      slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
    
    route:
      receiver: 'slack-notifications'
      group_by: ['alertname', 'cluster', 'service']
      group_wait: 10s
      group_interval: 5m
      repeat_interval: 3h
      
    receivers:
    - name: 'slack-notifications'
      slack_configs:
      - channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ .Annotations.description }}\n{{ end }}'
        send_resolved: true
```

**3. Apply Configuration:**
```bash
kubectl apply -f alertmanager-config.yaml

# Restart Alertmanager
kubectl rollout restart statefulset alertmanager-observability-alertmanager -n observability
```

### Email Notifications

```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@yourdomain.com'
  smtp_auth_username: 'alerts@yourdomain.com'
  smtp_auth_password: 'your-app-password'

receivers:
- name: 'email-notifications'
  email_configs:
  - to: 'team@yourdomain.com'
    headers:
      Subject: '[ALERT] {{ .GroupLabels.alertname }}'
```

### PagerDuty Integration

```yaml
receivers:
- name: 'pagerduty'
  pagerduty_configs:
  - service_key: 'your-pagerduty-key'
    description: '{{ .GroupLabels.alertname }}'
```

## ServiceMonitor

The `ServiceMonitor` tells Prometheus where to scrape metrics.

```yaml
# service-monitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: block-watcher-service-monitor
  namespace: observability
  labels:
    release: observability  # Must match Prometheus selector
spec:
  namespaceSelector:
    matchNames:
    - block-watcher
  selector:
    matchLabels:
      app: block-watcher  # Must match service labels
  endpoints:
  - port: http
    path: /api/metrics  # Metrics endpoint
    interval: 15s       # Scrape every 15 seconds
```

**Verify ServiceMonitor:**
```bash
kubectl get servicemonitor -n observability

# Check if Prometheus is using it
kubectl logs -l app.kubernetes.io/name=prometheus -n observability | grep "block-watcher"
```

## Adding Custom Metrics

### Define Metric in Service

```typescript
// src/metrics/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  // Counter - monotonically increasing
  public readonly blocksProcessed = new Counter({
    name: 'evm_blocks_processed_total',
    help: 'Total blocks processed',
    labelNames: ['chainId']
  });

  // Histogram - track distribution
  public readonly processingTime = new Histogram({
    name: 'evm_block_processing_seconds',
    help: 'Block processing time',
    buckets: [0.1, 0.5, 1, 2, 5]
  });

  // Gauge - value that goes up and down
  public readonly activeConnections = new Gauge({
    name: 'evm_active_connections',
    help: 'Number of active connections'
  });
}
```

### Use in Your Code

```typescript
// src/evm-blocks/evm-blocks.service.ts
export class EvmBlocksService {
  constructor(private metrics: MetricsService) {}

  async processBlock(block: Block) {
    const start = Date.now();
    
    try {
      // Process block
      await this.saveBlock(block);
      
      // Increment counter
      this.metrics.blocksProcessed
        .labels(block.chainId.toString())
        .inc();
      
      // Record processing time
      const duration = (Date.now() - start) / 1000;
      this.metrics.processingTime.observe(duration);
      
    } catch (error) {
      // Record error
      this.metrics.blocksProcessed
        .labels(block.chainId.toString(), 'error')
        .inc();
      throw error;
    }
  }
}
```

### Query Custom Metrics

```promql
# Total blocks processed
evm_blocks_processed_total

# Blocks per minute
rate(evm_blocks_processed_total[1m]) * 60

# Average processing time
rate(evm_block_processing_seconds_sum[5m]) / 
rate(evm_block_processing_seconds_count[5m])

# P95 processing time
histogram_quantile(0.95, 
  rate(evm_block_processing_seconds_bucket[5m])
)
```

## Troubleshooting

### Metrics Not Appearing

```bash
# 1. Check if app exposes metrics
kubectl port-forward svc/block-watcher-service 8080:80 -n block-watcher
curl http://localhost:8080/api/metrics

# 2. Check ServiceMonitor exists
kubectl get servicemonitor -n observability

# 3. Check Prometheus targets
kubectl port-forward svc/observability-kube-prometheus-prometheus 9090:9090 -n observability
open http://localhost:9090/targets

# 4. Check Prometheus logs
kubectl logs -l app.kubernetes.io/name=prometheus -n observability
```

### Alerts Not Firing

```bash
# 1. Check alert rules exist
kubectl get prometheusrules -n observability

# 2. Check Prometheus rules
open http://localhost:9090/rules

# 3. Manually trigger condition
# (e.g., stop all pods to trigger BlockWatcherDown)
kubectl scale deployment block-watcher --replicas=0 -n block-watcher

# 4. Check Alertmanager
open http://localhost:9093
```

### Grafana Can't Connect to Prometheus

```bash
# Check Prometheus service
kubectl get svc -n observability | grep prometheus

# Test connection from Grafana pod
kubectl exec -it deployment/observability-grafana -n observability -- \
  wget -O- observability-kube-prometheus-prometheus:9090/api/v1/query?query=up

# URL should be:
# http://observability-kube-prometheus-prometheus.observability:9090
```

## Best Practices

1. **Add metrics for important operations** - Track what matters
2. **Use appropriate metric types** - Counter, Histogram, Gauge, Summary
3. **Label metrics carefully** - Makes querying easier
4. **Keep dashboards simple** - Focus on key metrics
5. **Set meaningful alert thresholds** - Avoid alert fatigue
6. **Document what metrics mean** - Help future developers
7. **Test alerts** - Ensure they actually fire
8. **Monitor the monitors** - Alert on Prometheus being down

## Next Steps

- **[Kubernetes Reference](05-kubernetes-reference.md)** - Detailed manifest documentation
- **[Production Checklist](06-production-checklist.md)** - Pre-deployment checklist
