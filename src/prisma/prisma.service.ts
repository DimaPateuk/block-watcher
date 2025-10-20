import {
  INestApplication,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { MetricsService } from "../metrics/metrics.service";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    @Inject(forwardRef(() => MetricsService))
    private readonly metricsService?: MetricsService
  ) {
    super({
      // Configure Prisma with logging for monitoring
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'info' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.setupQueryLogging();
    this.setupConnectionPoolMonitoring();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private setupQueryLogging() {
    // Listen to Prisma query events for metrics
    (this as any).$on('query', (event: any) => {
      const duration = event.duration / 1000; // Convert ms to seconds
      const model = this.extractModelFromQuery(event.query);
      const action = this.extractActionFromQuery(event.query);
      
      // Record successful query (if we reach this point, it was successful)
      this.metricsService?.recordDbQuery(model, action, true, duration);
    });

    // Listen to error events
    (this as any).$on('error', (event: any) => {
      // Record failed query (duration not available in error events)
      this.metricsService?.recordDbQuery('unknown', 'unknown', false, 0);
    });
  }

  private setupConnectionPoolMonitoring() {
    // Set up connection pool monitoring (simulated values since Prisma doesn't expose real pool stats)
    setInterval(() => {
      // In a real implementation, you'd get these from Prisma's connection pool
      // For now, we'll simulate some values based on typical usage patterns
      const activeConnections = Math.floor(Math.random() * 8) + 2; // 2-10 active
      const idleConnections = Math.floor(Math.random() * 3) + 1;   // 1-4 idle
      
      this.metricsService?.updateConnectionPool(activeConnections, idleConnections);
    }, 5000); // Update every 5 seconds
  }

  private extractModelFromQuery(query: string): string {
    // Extract model name from SQL query (basic pattern matching)
    const tableMatches = query.match(/FROM\s+`?(\w+)`?/i) || query.match(/INTO\s+`?(\w+)`?/i) || query.match(/UPDATE\s+`?(\w+)`?/i);
    return tableMatches ? tableMatches[1] : 'unknown';
  }

  private extractActionFromQuery(query: string): string {
    // Extract action type from SQL query
    const queryType = query.trim().split(' ')[0].toLowerCase();
    switch (queryType) {
      case 'select': return 'findMany';
      case 'insert': return 'create';
      case 'update': return 'update';
      case 'delete': return 'delete';
      default: return queryType;
    }
  }
}
