import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    // Reset metrics after each test to avoid interference
    service['dbConnectionsActive'].set(0);
    service['dbConnectionsIdle'].set(0);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('HTTP metrics', () => {
    it('should record HTTP request duration without errors', () => {
      const method = 'GET';
      const route = '/api/test';
      const statusCode = 200;
      const duration = 0.05; // 50ms

      // Should not throw an error
      expect(() => {
        service.recordHttpRequest(method, route, statusCode, duration);
      }).not.toThrow();
    });

    it('should normalize routes correctly', () => {
      const testCases = [
        { input: '/api/blocks/123', expected: '/api/blocks/:id' },
        { input: '/api/blocks/0x1a2b3c4d', expected: '/api/blocks/:hash' },
        { input: '/api/users/550e8400-e29b-41d4-a716-446655440000', expected: '/api/users/:id' },
        { input: '/api/unknown/path', expected: '/api/unknown/path' },
        // Test actual blockchain patterns
        { input: '/api/tx/0x742d35cc6c6c0532c14216b2e6b1b7e89b5f6cfb', expected: '/api/tx/:hash' },
        { input: '/api/block/1234567890', expected: '/api/block/:id' },
      ];

      testCases.forEach(({ input, expected }) => {
        const normalized = service.normalizeRoute(input);
        expect(normalized).toBe(expected);
      });
    });
  });

  describe('Database metrics', () => {
    it('should record database query duration without errors', () => {
      const model = 'Block';
      const action = 'findMany';
      const success = true;
      const duration = 0.01; // 10ms

      // Should not throw an error
      expect(() => {
        service.recordDbQuery(model, action, success, duration);
      }).not.toThrow();
    });

    it('should update connection pool metrics without errors', () => {
      const activeConnections = 5;
      const idleConnections = 2;

      // Should not throw an error
      expect(() => {
        service.updateConnectionPool(activeConnections, idleConnections);
      }).not.toThrow();
    });
  });

  describe('Metrics export', () => {
    it('should return metrics in Prometheus format', async () => {
      // Record some test metrics
      service.recordHttpRequest('GET', '/api/test', 200, 0.05);
      service.recordDbQuery('Block', 'findMany', true, 0.01);
      service.updateConnectionPool(3, 1);

      const metricsOutput = await service.getMetrics();
      
      // Verify the output contains our custom metrics
      expect(metricsOutput).toContain('http_server_requests_seconds');
      expect(metricsOutput).toContain('db_prisma_query_seconds');
      expect(metricsOutput).toContain('db_connections_active');
      expect(metricsOutput).toContain('db_connections_idle');
      
      // Verify it contains default Node.js metrics
      expect(metricsOutput).toContain('nodejs_');
      expect(metricsOutput).toContain('service="block-watcher"');
    });

    it('should include proper metric metadata', async () => {
      const metricsOutput = await service.getMetrics();
      
      // Check for HELP and TYPE annotations
      expect(metricsOutput).toContain('# HELP http_server_requests_seconds Duration of HTTP requests in seconds');
      expect(metricsOutput).toContain('# TYPE http_server_requests_seconds histogram');
      expect(metricsOutput).toContain('# HELP db_prisma_query_seconds Duration of Prisma database queries in seconds');
      expect(metricsOutput).toContain('# TYPE db_prisma_query_seconds histogram');
    });
  });
});
