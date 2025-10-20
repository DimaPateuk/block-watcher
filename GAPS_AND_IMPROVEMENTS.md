# Observability Gaps & Production Improvements

## 🚨 **Critical Gaps Identified**

### **1. Node.js Version Risk** ⚠️ **HIGH PRIORITY**
**Current**: Node.js 18.17.1 (EOL risk)
**Target**: Node.js 20.x or 22.x LTS

**Issues**:
- Security vulnerabilities in older Node versions
- Support window narrowing 
- Using polyfill for `crypto.randomUUID()` (unnecessary overhead)

**Action Plan**:
```bash
# Update Node.js version
nvm install 20.18.0  # or latest LTS
nvm use 20.18.0

# Remove polyfill from MetricsService
# crypto.randomUUID() is native in Node 20+
```

### **2. Label Cardinality Explosion** ⚠️ **HIGH PRIORITY**
**Risk**: Unlimited cardinality can crash Prometheus with memory exhaustion

**Current Issues**:
- Block hashes as labels (potentially infinite)
- Transaction addresses as labels
- Dynamic route IDs

**Safe Label Strategy**:
```typescript
// ✅ GOOD - Low cardinality
labels: {
  chainId: "1" | "5" | "137",
  network: "mainnet" | "testnet",
  operation: "sync" | "reorg" | "fetch",
  status: "success" | "error" | "timeout",
  pool: "primary" | "readonly",
  source: "rpc" | "cache" | "db"
}

// ❌ BAD - High cardinality  
labels: {
  blockHash: "0x1a2b3c...",  // Infinite values
  txAddress: "0x742d35...",  // Millions of addresses
  userId: "12345"            // Unbounded user IDs
}
```

### **3. Histogram Buckets Suboptimal** ⚠️ **MEDIUM PRIORITY**
**Current**: Generic prom-client defaults
**Need**: Blockchain-specific optimized buckets

**Recommended Buckets**:
```typescript
// HTTP/RPC calls (network I/O)
HTTP_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

// Database queries (local I/O)
DB_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1];

// Block processing (heavy computation)
BLOCK_PROCESSING_BUCKETS = [0.5, 1, 2, 5, 10, 20, 30, 60];
```

### **4. Health Check Semantics Missing** ⚠️ **HIGH PRIORITY**
**Current**: Generic health checks
**Need**: Proper liveness vs readiness separation

**Kubernetes Requirements**:
```yaml
# Liveness: "Is the process functioning?"
livenessProbe:
  httpGet:
    path: /health/liveness
    port: 3000
  
# Readiness: "Can it serve traffic?"
readinessProbe:
  httpGet:
    path: /health/readiness
    port: 3000
```

### **5. Missing Distributed Tracing** ⚠️ **MEDIUM PRIORITY**
**Gap**: No request correlation across services
**Impact**: Cannot debug slow RPC chains, DB bottlenecks

**OpenTelemetry Implementation Needed**:
- Trace RPC calls to external blockchain nodes
- Trace database operations with Prisma
- Trace block processing pipelines
- Correlation IDs in logs

### **6. Metrics Endpoint Security** ⚠️ **HIGH PRIORITY**
**Current**: Unauthenticated `/api/metrics` exposure
**Risk**: Information disclosure, potential DoS

**Security Model Needed**:
- Network-level controls (Kubernetes NetworkPolicy)
- ServiceMonitor with authentication
- Rate limiting on metrics scraping

---

## 🔧 **High-Impact Immediate Fixes**

### **Fix 1: Upgrade Node.js & Remove Polyfill**

```bash
# .nvmrc
22.9.0
```

```dockerfile
# Dockerfile
FROM node:22-alpine
```

```typescript
// Remove from MetricsService
// ❌ Delete this polyfill
if (!globalThis.crypto?.randomUUID) {
  const { randomUUID } = require('crypto');
  globalThis.crypto = { ...globalThis.crypto, randomUUID };
}
```

### **Fix 2: Lock Down Metrics Endpoint**

```typescript
// metrics.controller.ts
@Controller('metrics')
export class MetricsController {
  @Get()
  @ApiExcludeEndpoint() // Hide from Swagger
  async getMetrics(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // Security headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    const metrics = await this.metricsService.getMetrics();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(metrics);
  }
}
```

```yaml
# k8s/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: block-watcher-metrics
spec:
  podSelector:
    matchLabels:
      app: block-watcher
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 3000
      endPort: 3000
```

### **Fix 3: Implement OpenTelemetry**

```bash
npm install @opentelemetry/sdk-node @opentelemetry/api \
  @opentelemetry/instrumentation-nestjs-core \
  @opentelemetry/instrumentation-http \
  @prisma/instrumentation \
  @opentelemetry/exporter-jaeger
```

```typescript
// src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';

const sdk = new NodeSDK({
  instrumentations: [
    new HttpInstrumentation(),
    new NestInstrumentation(),
    new PrismaInstrumentation(),
  ],
  serviceName: 'block-watcher',
  serviceVersion: process.env.npm_package_version,
});

sdk.start();
```

### **Fix 4: Optimize Histogram Buckets**

```typescript
// metrics.service.ts
private readonly HTTP_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
private readonly DB_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1];
private readonly RPC_BUCKETS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30];

constructor() {
  this.httpRequestDuration = new Histogram({
    name: 'http_server_requests_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: this.HTTP_BUCKETS, // ✅ Optimized buckets
  });

  this.dbPrismaQueryDuration = new Histogram({
    name: 'db_prisma_query_seconds',
    help: 'Duration of Prisma database queries in seconds',
    labelNames: ['model', 'action', 'success'],
    buckets: this.DB_BUCKETS, // ✅ DB-optimized buckets
  });
}
```

### **Fix 5: Implement Proper Health Checks**

```typescript
// health.controller.ts
@Controller('health')
export class HealthController {
  @Get('liveness')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe - is process alive?' })
  liveness(): Promise<HealthCheckResult> {
    return this.health.check([
      // Only check if process is functional
      () => this.memoryHealth.checkHeap('memory_heap', 2 * 1024 * 1024 * 1024), // 2GB
      () => this.checkEventLoopLag(),
    ]);
  }

  @Get('readiness')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe - can serve traffic?' })
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      // Check all dependencies
      () => this.prismaHealth.pingCheck('database', this.prismaService),
      () => this.checkRpcConnectivity(),
      () => this.checkBlockLag(),
      () => this.diskHealth.checkStorage('storage', { path: '/', thresholdPercent: 0.9 }),
    ]);
  }

  private async checkEventLoopLag(): Promise<any> {
    // Implement event loop lag check
    const lag = process.hrtime.bigint();
    return { eventloop: { status: 'up', lag: Number(lag) / 1e6 } };
  }

  private async checkRpcConnectivity(): Promise<any> {
    // Check RPC quota and connectivity
    try {
      // Implement lightweight RPC health check
      return { rpc: { status: 'up' } };
    } catch (error) {
      throw new Error(`RPC unhealthy: ${error.message}`);
    }
  }

  private async checkBlockLag(): Promise<any> {
    // Check if block synchronization is current
    const maxLagBlocks = 5; // Alert if >5 blocks behind
    // Implement block lag check logic
    return { block_sync: { status: 'up', lag: 0 } };
  }
}
```

---

## 📊 **Enhanced Metrics Strategy**

### **Safe Label Cardinality Rules**

```typescript
// metrics.service.ts
private validateLabels(labels: Record<string, string>): void {
  const SAFE_LABEL_VALUES = {
    chainId: ['1', '5', '137', '8453', '42161'], // Ethereum, Goerli, Polygon, Base, Arbitrum
    status: ['success', 'error', 'timeout', 'rate_limited'],
    operation: ['sync', 'reorg', 'fetch', 'validate'],
    pool: ['primary', 'readonly', 'archive'],
  };

  Object.entries(labels).forEach(([key, value]) => {
    if (SAFE_LABEL_VALUES[key] && !SAFE_LABEL_VALUES[key].includes(value)) {
      throw new Error(`Invalid label value: ${key}=${value}`);
    }
  });
}

// ✅ Safe metric recording
recordRpcCall(chainId: string, operation: string, duration: number, success: boolean): void {
  const labels = {
    chain_id: this.normalizeChainId(chainId), // Ensure known chains only
    operation: this.normalizeOperation(operation),
    status: success ? 'success' : 'error',
  };
  
  this.validateLabels(labels);
  this.rpcDuration.observe(labels, duration);
}
```

### **Blockchain-Specific Metrics**

```typescript
// New metrics for blockchain apps
private readonly blockProcessingDuration = new Histogram({
  name: 'block_processing_seconds',
  help: 'Time to process a block',
  labelNames: ['chain_id', 'operation', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
});

private readonly rpcRequestDuration = new Histogram({
  name: 'rpc_request_seconds', 
  help: 'RPC call duration',
  labelNames: ['chain_id', 'method', 'status'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 30],
});

private readonly blockLagGauge = new Gauge({
  name: 'block_lag_number',
  help: 'Number of blocks behind head',
  labelNames: ['chain_id'],
});

private readonly rpcRateLimitCounter = new Counter({
  name: 'rpc_rate_limit_total',
  help: 'Number of rate limit hits',
  labelNames: ['chain_id', 'provider'],
});
```

---

## 🎯 **Alerting Rules & SLOs**

### **SLO Definitions**

```yaml
# prometheus/rules/slos.yml
groups:
- name: block-watcher-slos
  rules:
  # HTTP SLO: 99% of requests under 500ms
  - record: http_request_success_rate
    expr: rate(http_server_requests_seconds_count{status_code!~"5.."}[5m]) / rate(http_server_requests_seconds_count[5m])
  
  - record: http_request_p95_latency
    expr: histogram_quantile(0.95, rate(http_server_requests_seconds_bucket[5m]))
  
  # Database SLO: 99.9% of queries under 100ms
  - record: db_query_success_rate
    expr: rate(db_prisma_query_seconds_count{success="true"}[5m]) / rate(db_prisma_query_seconds_count[5m])
  
  - record: db_query_p95_latency
    expr: histogram_quantile(0.95, rate(db_prisma_query_seconds_bucket[5m]))
  
  # RPC SLO: 95% success rate, P95 < 2s
  - record: rpc_success_rate
    expr: rate(rpc_request_seconds_count{status="success"}[5m]) / rate(rpc_request_seconds_count[5m])
  
  # Block sync SLO: Never more than 5 blocks behind for >5 minutes
  - record: block_sync_healthy
    expr: block_lag_number < 5
```

### **Critical Alerts**

```yaml
# prometheus/rules/alerts.yml
groups:
- name: block-watcher-alerts
  rules:
  - alert: BlockWatcherDown
    expr: up{job="block-watcher"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Block Watcher is down"
      
  - alert: HighEventLoopLag
    expr: nodejs_eventloop_lag_seconds > 0.1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "Event loop lag is high (>100ms)"
      
  - alert: DatabaseConnectionSaturation
    expr: db_connections_active / (db_connections_active + db_connections_idle) > 0.9
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Database connection pool >90% utilized"
      
  - alert: BlockSyncLagging
    expr: block_lag_number > 5
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Block sync lagging >5 blocks for >5 minutes"
      
  - alert: RpcErrorRate
    expr: rpc_success_rate < 0.95
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "RPC error rate >5%"
```

---

## 🔄 **Implementation Priority**

### **Phase 1: Critical Security & Stability** (Week 1)
1. ✅ Node.js upgrade to LTS 20.x/22.x
2. ✅ Remove crypto polyfill
3. ✅ Lock down `/api/metrics` endpoint
4. ✅ Implement liveness/readiness separation
5. ✅ Fix histogram buckets

### **Phase 2: Enhanced Observability** (Week 2)
1. ✅ OpenTelemetry integration
2. ✅ Prisma instrumentation
3. ✅ Correlation IDs in logs
4. ✅ Label cardinality validation
5. ✅ Blockchain-specific metrics

### **Phase 3: Production Hardening** (Week 3)
1. ✅ SLO definitions and alerting rules
2. ✅ Grafana dashboards
3. ✅ Load testing with k6
4. ✅ Metrics documentation
5. ✅ Blackbox monitoring

---

## 📋 **Testing & Validation Checklist**

### **Security Tests**
- [ ] `/api/metrics` not accessible from outside cluster
- [ ] Metrics scraping requires authentication
- [ ] No high-cardinality labels accepted
- [ ] Rate limiting on metrics endpoint

### **Performance Tests**
- [ ] Histogram buckets capture P95/P99 correctly
- [ ] Metrics collection adds <1ms overhead
- [ ] Memory usage stable under load
- [ ] No metrics registry leaks

### **Reliability Tests**
- [ ] Liveness probe fails only when process is broken
- [ ] Readiness probe fails when dependencies unavailable
- [ ] Alerts fire within defined timeframes
- [ ] SLO tracking matches actual performance

This comprehensive plan addresses all the critical gaps you identified and provides a roadmap for production-ready observability.
