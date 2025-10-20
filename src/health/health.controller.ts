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
    summary: 'Health check endpoint',
    description: 'Returns the health status of the application and its dependencies'
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
