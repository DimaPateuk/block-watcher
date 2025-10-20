import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, register, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);

  // Optimized histogram buckets for different I/O types
  private readonly HTTP_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]; // Network I/O optimized
  private readonly DB_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]; // Local I/O optimized
  private readonly RPC_BUCKETS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 30]; // Blockchain RPC calls

  // Safe label values to prevent cardinality explosion
  private readonly SAFE_LABEL_VALUES = {
    chainId: ['1', '5', '137', '8453', '42161', 'unknown'], // Ethereum, Goerli, Polygon, Base, Arbitrum
    status: ['success', 'error', 'timeout', 'rate_limited'],
    operation: ['sync', 'reorg', 'fetch', 'validate', 'process'],
    pool: ['primary', 'readonly', 'archive'],
    source: ['rpc', 'cache', 'db', 'memory'],
    method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
  };

  // HTTP request duration histogram
  public readonly httpRequestDuration: Histogram<string>;

  // Event loop lag gauge
  public readonly eventLoopLag: Gauge<string>;

  // Database query duration histogram
  public readonly dbPrismaQueryDuration: Histogram<string>;

  // Connection pool gauges
  public readonly dbConnectionsActive: Gauge<string>;
  public readonly dbConnectionsIdle: Gauge<string>;

  constructor() {
    // Clear any existing metrics (useful for hot reloads in development)
    register.clear();

    // Enable default Node.js metrics collection
    collectDefaultMetrics({
      register,
      prefix: 'nodejs_',
      labels: { service: 'block-watcher' }
    });

    // HTTP request duration histogram with optimal buckets for web APIs
    this.httpRequestDuration = new Histogram({
      name: 'http_server_requests_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: this.HTTP_BUCKETS, // Network I/O optimized buckets
      registers: [register]
    });

    // Event loop lag gauge
    this.eventLoopLag = new Gauge({
      name: 'nodejs_eventloop_lag_seconds',
      help: 'Lag of event loop in seconds',
      registers: [register]
    });

    // Database query duration histogram
    this.dbPrismaQueryDuration = new Histogram({
      name: 'db_prisma_query_seconds',
      help: 'Duration of Prisma database queries in seconds',
      labelNames: ['model', 'action', 'success'],
      buckets: this.DB_BUCKETS, // Local I/O optimized buckets
      registers: [register]
    });

    // Connection pool gauges
    this.dbConnectionsActive = new Gauge({
      name: 'db_connections_active',
      help: 'Number of active database connections',
      registers: [register]
    });

    this.dbConnectionsIdle = new Gauge({
      name: 'db_connections_idle', 
      help: 'Number of idle database connections',
      registers: [register]
    });
  }

  onModuleInit() {
    this.logger.log('✅ Metrics service initialized with default Node.js metrics');
    this.startEventLoopMonitoring();
  }

  /**
   * Get all metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Validate label values to prevent cardinality explosion
   * @param labels Object containing label key-value pairs
   * @throws Error if any label has unsafe high-cardinality values
   */
  private validateLabels(labels: Record<string, string>): void {
    Object.entries(labels).forEach(([key, value]) => {
      if (this.SAFE_LABEL_VALUES[key]) {
        if (!this.SAFE_LABEL_VALUES[key].includes(value)) {
          this.logger.warn(`Invalid label value: ${key}=${value}, using 'unknown'`);
          labels[key] = 'unknown';
        }
      }
      // Check for potentially dangerous patterns
      if (this.isHighCardinalityValue(value)) {
        this.logger.warn(`High cardinality label detected: ${key}=${value}, using normalized value`);
        labels[key] = this.normalizeHighCardinalityValue(key, value);
      }
    });
  }

  /**
   * Check if a value could cause high cardinality
   */
  private isHighCardinalityValue(value: string): boolean {
    // Check for patterns that indicate high cardinality
    return (
      /^0x[a-f0-9]{40,}$/i.test(value) || // Ethereum addresses/hashes
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) || // UUIDs
      /^\d{10,}$/.test(value) || // Large numbers (timestamps, IDs)
      value.length > 20 // Very long strings
    );
  }

  /**
   * Normalize high cardinality values to safe alternatives
   */
  private normalizeHighCardinalityValue(key: string, value: string): string {
    if (/^0x[a-f0-9]{40}$/i.test(value)) return 'address';
    if (/^0x[a-f0-9]{64}$/i.test(value)) return 'hash';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'uuid';
    if (/^\d{10,}$/.test(value)) return 'large_number';
    return 'normalized';
  }

  /**
   * Record HTTP request duration
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    const labels = {
      method: method.toUpperCase(),
      route: route,
      status_code: statusCode.toString(),
    };
    
    this.validateLabels(labels);
    
    this.httpRequestDuration
      .labels(labels.method, labels.route, labels.status_code)
      .observe(duration);
  }

  /**
   * Record database query duration
   */
  recordDbQuery(model: string, action: string, success: boolean, duration: number) {
    const labels = {
      model: model || 'unknown',
      action: action || 'unknown', 
      success: success.toString(),
    };
    
    this.validateLabels(labels);
    
    this.dbPrismaQueryDuration
      .labels(labels.model, labels.action, labels.success)
      .observe(duration);
  }

  /**
   * Update connection pool metrics
   */
  updateConnectionPool(active: number, idle: number) {
    this.dbConnectionsActive.set(active);
    this.dbConnectionsIdle.set(idle);
  }

  /**
   * Start monitoring event loop lag
   */
  private startEventLoopMonitoring() {
    const start = process.hrtime.bigint();
    
    setImmediate(() => {
      const lag = Number(process.hrtime.bigint() - start) / 1e9;
      this.eventLoopLag.set(lag);
      
      // Schedule next measurement
      setTimeout(() => this.startEventLoopMonitoring(), 1000);
    });
  }

  /**
   * Normalize route paths for consistent labeling
   * Examples: /api/blocks/123 -> /api/blocks/:id
   */
  normalizeRoute(path: string): string {
    return path
      // Replace UUIDs first (most specific)
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      // Replace hex strings (blockchain patterns - before numeric)
      .replace(/\/0x[a-f0-9]+/gi, '/:hash')
      .replace(/\/[a-f0-9]{64}/gi, '/:hash')  // 64-char hashes
      .replace(/\/[a-f0-9]{40}/gi, '/:address') // Ethereum addresses
      // Replace numeric IDs last (most general)
      .replace(/\/\d+/g, '/:id')
      || '/unknown';
  }
}
