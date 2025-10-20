import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, register, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);

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
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
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
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
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
   * Record HTTP request duration
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    this.httpRequestDuration
      .labels(method, route, statusCode.toString())
      .observe(duration);
  }

  /**
   * Record database query duration
   */
  recordDbQuery(model: string, action: string, success: boolean, duration: number) {
    this.dbPrismaQueryDuration
      .labels(model, action, success.toString())
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
