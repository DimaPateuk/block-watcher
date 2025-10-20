import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthCheckService;
  let prismaHealth: PrismaHealthIndicator;
  let memoryHealth: MemoryHealthIndicator;
  let diskHealth: DiskHealthIndicator;

  const mockHealthCheckResult = {
    status: 'ok' as const,
    info: {
      database: { status: 'up' },
      memory_heap: { status: 'up' },
      memory_rss: { status: 'up' },
      storage: { status: 'up' },
    },
    error: {},
    details: {
      database: { status: 'up' },
      memory_heap: { status: 'up' },
      memory_rss: { status: 'up' },
      storage: { status: 'up' },
    },
  };

  const mockDatabaseOnlyResult = {
    status: 'ok' as const,
    info: { database: { status: 'up' } },
    error: {},
    details: { database: { status: 'up' } },
  };

  beforeEach(async () => {
    const mockHealthService = {
      check: jest.fn(),
    };

    const mockPrismaHealth = {
      pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
    };

    const mockMemoryHealth = {
      checkHeap: jest.fn().mockResolvedValue({ memory_heap: { status: 'up' } }),
      checkRSS: jest.fn().mockResolvedValue({ memory_rss: { status: 'up' } }),
    };

    const mockDiskHealth = {
      checkStorage: jest.fn().mockResolvedValue({ storage: { status: 'up' } }),
    };

    const mockPrismaService = {};

    const mockMetricsService = {
      recordDbQuery: jest.fn(),
      updateConnectionPool: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthService },
        { provide: PrismaHealthIndicator, useValue: mockPrismaHealth },
        { provide: MemoryHealthIndicator, useValue: mockMemoryHealth },
        { provide: DiskHealthIndicator, useValue: mockDiskHealth },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthCheckService>(HealthCheckService);
    prismaHealth = module.get<PrismaHealthIndicator>(PrismaHealthIndicator);
    memoryHealth = module.get<MemoryHealthIndicator>(MemoryHealthIndicator);
    diskHealth = module.get<DiskHealthIndicator>(DiskHealthIndicator);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check()', () => {
    it('should perform comprehensive health check', async () => {
      (healthService.check as jest.Mock).mockResolvedValue(mockHealthCheckResult);

      const result = await controller.check();

      expect(result).toEqual(mockHealthCheckResult);
      expect(healthService.check).toHaveBeenCalledWith([
        expect.any(Function), // database check
        expect.any(Function), // memory heap check
        expect.any(Function), // memory rss check
        expect.any(Function), // disk storage check
      ]);
    });

    it('should include all health indicators', async () => {
      (healthService.check as jest.Mock).mockImplementation(async (checks) => {
        // Execute all the check functions to verify they're properly configured
        const results = await Promise.all(checks.map((check: () => any) => check()));
        return mockHealthCheckResult;
      });

      await controller.check();

      // Verify all health indicators were called
      expect(prismaHealth.pingCheck).toHaveBeenCalledWith('database', expect.any(Object));
      expect(memoryHealth.checkHeap).toHaveBeenCalledWith('memory_heap', 1024 * 1024 * 1024);
      expect(memoryHealth.checkRSS).toHaveBeenCalledWith('memory_rss', 1.5 * 1024 * 1024 * 1024);
      expect(diskHealth.checkStorage).toHaveBeenCalledWith('storage', {
        path: '/',
        thresholdPercent: 0.9,
      });
    });
  });

  describe('checkDatabase()', () => {
    it('should perform database-only health check', async () => {
      (healthService.check as jest.Mock).mockResolvedValue(mockDatabaseOnlyResult);

      const result = await controller.checkDatabase();

      expect(result).toEqual(mockDatabaseOnlyResult);
      expect(healthService.check).toHaveBeenCalledWith([
        expect.any(Function), // only database check
      ]);
    });

    it('should only check database connectivity', async () => {
      (healthService.check as jest.Mock).mockImplementation(async (checks) => {
        expect(checks).toHaveLength(1); // Only one check function
        await checks[0](); // Execute the check
        return mockDatabaseOnlyResult;
      });

      await controller.checkDatabase();

      expect(prismaHealth.pingCheck).toHaveBeenCalledWith('database', expect.any(Object));
      
      // Verify other health indicators were NOT called
      expect(memoryHealth.checkHeap).not.toHaveBeenCalled();
      expect(memoryHealth.checkRSS).not.toHaveBeenCalled();
      expect(diskHealth.checkStorage).not.toHaveBeenCalled();
    });
  });

  describe('health check failure scenarios', () => {
    it('should handle database failure in comprehensive check', async () => {
      const failureResult = {
        status: 'error' as const,
        info: {
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
          storage: { status: 'up' },
        },
        error: {
          database: { status: 'down', message: 'Connection failed' },
        },
        details: {
          database: { status: 'down', message: 'Connection failed' },
          memory_heap: { status: 'up' },
          memory_rss: { status: 'up' },
          storage: { status: 'up' },
        },
      };

      (healthService.check as jest.Mock).mockResolvedValue(failureResult);

      const result = await controller.check();

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('database');
    });

    it('should handle database failure in database-only check', async () => {
      const databaseFailureResult = {
        status: 'error' as const,
        info: {},
        error: {
          database: { status: 'down', message: 'Connection timeout' },
        },
        details: {
          database: { status: 'down', message: 'Connection timeout' },
        },
      };

      (healthService.check as jest.Mock).mockResolvedValue(databaseFailureResult);

      const result = await controller.checkDatabase();

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('database');
    });
  });
});
