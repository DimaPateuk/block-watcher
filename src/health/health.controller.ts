import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  PrismaHealthIndicator,
  HealthCheckResult,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly memoryHealth: MemoryHealthIndicator,
    private readonly diskHealth: DiskHealthIndicator,
    private readonly prismaService: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'General health check endpoint',
    description: 'Returns the health status of the application and its dependencies (use /liveness or /readiness for K8s probes)'
  })
  @ApiResponse({
    status: 200,
    description: 'Health check passed',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: { type: 'object' },
        error: { type: 'object' },
        details: { type: 'object' }
      }
    }
  })
  @ApiResponse({
    status: 503,
    description: 'Health check failed - service unavailable'
  })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      // Database connectivity
      () => this.prismaHealth.pingCheck('database', this.prismaService),
      // Memory usage (should be under 1GB)
      () => this.memoryHealth.checkHeap('memory_heap', 1024 * 1024 * 1024),
      // Memory RSS (should be under 1.5GB)  
      () => this.memoryHealth.checkRSS('memory_rss', 1.5 * 1024 * 1024 * 1024),
      // Disk usage (should be under 90%)
      () => this.diskHealth.checkStorage('storage', { 
        path: '/', 
        thresholdPercent: 0.9 
      }),
    ]);
  }

  @Get('liveness')
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness probe - is the process functioning?',
    description: 'Kubernetes liveness probe - checks if process needs restart. Only checks internal process health.'
  })
  @ApiResponse({
    status: 200,
    description: 'Process is alive and functioning'
  })
  @ApiResponse({
    status: 503,
    description: 'Process is unhealthy and should be restarted'
  })
  liveness(): Promise<HealthCheckResult> {
    return this.health.check([
      // Only check if the process itself is functional
      // Memory usage (should be under 2GB for liveness - higher threshold)
      () => this.memoryHealth.checkHeap('memory_heap', 2 * 1024 * 1024 * 1024),
      // RSS memory (should be under 2.5GB)
      () => this.memoryHealth.checkRSS('memory_rss', 2.5 * 1024 * 1024 * 1024),
      // Do NOT check external dependencies - those are for readiness
    ]);
  }

  @Get('readiness')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe - can the service handle traffic?',
    description: 'Kubernetes readiness probe - checks if service can serve requests. Includes all dependencies.'
  })
  @ApiResponse({
    status: 200,
    description: 'Service is ready to handle traffic'
  })
  @ApiResponse({
    status: 503,
    description: 'Service is not ready - dependencies unavailable'
  })
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      // Check all external dependencies required to serve traffic
      () => this.prismaHealth.pingCheck('database', this.prismaService),
      // Memory usage (stricter for readiness)
      () => this.memoryHealth.checkHeap('memory_heap', 1024 * 1024 * 1024),
      () => this.memoryHealth.checkRSS('memory_rss', 1.5 * 1024 * 1024 * 1024),
      // Disk usage
      () => this.diskHealth.checkStorage('storage', { 
        path: '/', 
        thresholdPercent: 0.9 
      }),
      // TODO: Add RPC connectivity check
      // TODO: Add block lag check  
    ]);
  }

  @Get('database')
  @HealthCheck()
  @ApiOperation({
    summary: 'Database health check',
    description: 'Returns specifically the database connectivity status'
  })
  checkDatabase(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prismaService),
    ]);
  }
}
