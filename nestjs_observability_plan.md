# 🧭 Overview — Observability Stack for NestJS in 2025

Modern backend systems must be **observable by design**, not just monitored.  
That means:

- **Metrics** show *what* is happening (performance, load, errors).  
- **Logs** show *why* it happens.  
- **Traces** show *where* it happens across services.

The most reliable, open-source stack in 2025 combines **Prometheus**, **Grafana**, and **OpenTelemetry**, delivering full visibility from a NestJS service to the infrastructure beneath it.

---

## 🔧 Core Technologies

| Layer | Tool | Purpose |
|-------|------|----------|
| **Application metrics** | [`prom-client`](https://github.com/siimon/prom-client) | Exposes counters, gauges, and histograms at `/metrics`. |
| **Distributed tracing** | [OpenTelemetry SDK for Node.js](https://opentelemetry.io/docs/instrumentation/js/getting-started/) | Automatically instruments HTTP, Prisma, Redis, Kafka; exports traces. |
| **Metrics database** | [Prometheus](https://prometheus.io/) | Scrapes metrics, stores time-series data, and evaluates alert rules. |
| **Visualization** | [Grafana](https://grafana.com/) | Dashboards and alert visualization, integrates traces (exemplars). |
| **Alert routing** | [Alertmanager](https://prometheus.io/docs/alerting/latest/alertmanager/) | Routes alerts to Slack, PagerDuty, or email. |
| **Logs** | [Pino](https://github.com/pinojs/pino) | Lightweight structured logging with trace IDs. |
| **Tracing backend** | [Grafana Tempo](https://grafana.com/oss/tempo/) or Jaeger | Stores and indexes traces. |
| **Infrastructure exporters** | `postgres_exporter`, `redis_exporter`, `kafka_exporter`, `node_exporter`, `cadvisor` | Collect DB, cache, queue, and container metrics. |
| **Container orchestration** | Kubernetes + NGINX/Traefik Ingress | Provides service discovery, scaling, and secure routing. |

---

## 📊 Why This Stack

- **Open standards** — no vendor lock-in.  
- **Unified telemetry** — metrics, traces, and logs share context IDs.  
- **Scalable** — works identically in Docker and Kubernetes.  
- **Low friction** — minimal code overhead inside your NestJS app.

---

# 🚀 Implementation Phases

Each phase is self-contained and can be completed independently.

---

## Phase 1 — Application Metrics Module

**Goal:** instrument the NestJS app to produce RED metrics (Rate, Errors, Duration).

### Steps

1. Install `prom-client`  
   ```bash
   npm i prom-client
   ```

2. Create a `MetricsModule` that:  
   - Calls `collectDefaultMetrics()` (CPU, heap, GC, process stats).  
   - Defines histogram  
     `http_server_requests_seconds{method,route,status}`  
     with buckets `[0.005,0.01,0.025,0.05,0.1,0.25,0.5,1,2,5]`.  
   - Adds `nodejs_eventloop_lag_seconds` gauge.

3. Add middleware to time every request and normalize routes (`/users/:id` instead of `/users/123`).

4. Expose `/metrics` endpoint (no authentication).

**Why:** Prometheus scrapes this endpoint to build latency, error-rate, and throughput graphs — the base for all SLOs.

---

## Phase 2 — Database Metrics

**Goal:** measure DB query latency and connection saturation.

### Steps

1. Add a Prisma middleware recording query duration in  
   `db_prisma_query_seconds{model,action,success}`.  
2. Optionally expose gauges for connection pool usage.  
3. Use `@nestjs/terminus` for DB connectivity checks.

**Why:** database latency and saturation are leading causes of slow APIs.

---

## Phase 3 — Health Endpoints

**Goal:** make the service self-report its health to load balancers or orchestration.

### Steps

1. Install Terminus  
   ```bash
   npm i @nestjs/terminus @nestjs/axios
   ```  
2. Create  
   - `/health/liveness` → checks process/memory.  
   - `/health/readiness` → checks DB, Redis, Kafka connectivity.  
3. Configure Docker or K8s probes to hit these endpoints.

**Why:** ensures zero-downtime deployments and automatic recovery.

---

## Phase 4 — Local Observability Stack

**Goal:** run Prometheus + Grafana + Alertmanager locally.

### Steps

1. Create `docker-compose.yml` with services:  
   - `prom/prometheus`  
   - `grafana/grafana`  
   - `prom/alertmanager`  
   - `postgres_exporter`, `redis_exporter`, `kafka_exporter`  
   - `node_exporter`, `cadvisor`

2. Configure Prometheus:
   ```yaml
   scrape_configs:
     - job_name: "nest_app"
       metrics_path: /metrics
       static_configs:
         - targets: ["host.docker.internal:3000"]
   ```

3. Start stack  
   ```bash
   docker compose up -d
   ```

4. Open Grafana at `http://localhost:3001` and add Prometheus (`http://prometheus:9090`) as data source.

**Why:** enables full visualization and alert testing before cluster deployment.

---

## Phase 5 — Kubernetes Deployment

**Goal:** run observability stack in production.

### Steps

1. Deploy NestJS as a Deployment + Service exposing port 3000.  
2. Install Prometheus Operator:
   ```bash
   helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
   helm install observability prometheus-community/kube-prometheus-stack
   ```
3. Create a `ServiceMonitor` to scrape `/metrics`:
   ```yaml
   apiVersion: monitoring.coreos.com/v1
   kind: ServiceMonitor
   metadata:
     name: nest-service-monitor
   spec:
     selector:
       matchLabels:
         app: nest
     endpoints:
       - port: http
         path: /metrics
         interval: 15s
   ```
4. Expose Grafana / Alertmanager via Ingress with TLS.

**Why:** Prometheus Operator automates discovery and dashboard setup inside Kubernetes.

---

## Phase 6 — OpenTelemetry Tracing

**Goal:** connect metrics with detailed traces.

### Steps

1. Install dependencies  
   ```bash
   npm i @opentelemetry/sdk-node          @opentelemetry/auto-instrumentations-node          @opentelemetry/exporter-trace-otlp-http
   ```
2. Initialize OpenTelemetry before Nest boots (`src/tracing.ts`).  
3. Run an **OpenTelemetry Collector** (sidecar or Deployment) to send data to Tempo/Jaeger.  
4. Enable exemplars in Prometheus (`--enable-feature=exemplar-storage`).

**Why:** lets you click from “p95 latency alert” directly into an example trace showing the cause.

---

## Phase 7 — Alert Rules

**Goal:** turn metrics into actionable alerts.

### Example Rules

```yaml
groups:
  - name: service_slo
    rules:
      - alert: APIErrorFastBurn
        expr: sum(rate(http_server_requests_seconds_count{status=~"5..|429"}[5m])) /
               sum(rate(http_server_requests_seconds_count[5m])) > 0.02
        for: 5m
        labels: { severity: page }
        annotations:
          summary: "High error rate (>2%)"

      - alert: APIHighLatencyP95
        expr: histogram_quantile(0.95, sum by (le)(
                rate(http_server_requests_seconds_bucket[5m]))) > 0.3
        for: 10m
        labels: { severity: ticket }
        annotations:
          summary: "High p95 latency"
```

**Why:** burn-rate alerts detect both fast outages and slow degradations.

---

## Phase 8 — Dashboards

**Goal:** visualize full system health.

### Panels

- **Service overview:** RPS, error%, latency p50/p95/p99, CPU, heap, event-loop lag.  
- **Database:** connections, query latency, size growth, cache hits.  
- **Kafka / Redis:** consumer lag, hit/miss rate.  
- **Infrastructure:** container CPU/memory, restarts.  
- **Traces:** Tempo or Jaeger data source.

**Why:** dashboards enable rapid diagnosis after alerts fire.

---

## Phase 9 — Runbooks and Ownership

**Goal:** standardize incident response.

### Steps

- For each alert, create `runbooks/<alert>.md` describing:  
  - Meaning, likely causes, first steps, dashboards, trace links.  
- Add `runbook_url` annotation to alert definitions.

**Why:** shortens MTTR and ensures on-call consistency.

---

## Phase 10 — Scaling and Optimization

**Goal:** keep observability efficient long-term.

### Practices

- Prometheus retention = 15–30 days.  
- Recording rules for p95/p99 quantiles (reduces query load).  
- Long-term storage via Thanos / Cortex / Mimir.  
- Tail-sample traces (keep slow or error spans).  
- Auto-scale services based on RPS or queue lag.

**Why:** ensures the system remains cost-efficient and scalable as data volume grows.

---

# ✅ Final Outcome

After completing all phases you’ll have:

- A NestJS app emitting clean Prometheus metrics.  
- Prometheus + Grafana + Alertmanager running locally or in Kubernetes.  
- Exporters for Postgres, Redis, Kafka, and containers.  
- OpenTelemetry tracing integrated with metrics exemplars.  
- SLO-based alerts, dashboards, and runbooks for complete observability.
