import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = process.hrtime.bigint();
    const metricsService = this.metricsService; // Capture in closure

    // Store original end method
    const originalEnd = res.end;

    // Override end method to capture metrics when response completes
    res.end = function (this: Response, ...args: any[]) {
      // Calculate duration in seconds
      const duration = Number(process.hrtime.bigint() - startTime) / 1e9;

      // Get normalized route (fallback to pathname if route not available)
      const route = req.route?.path || req.path || '/unknown';
      const normalizedRoute = metricsService.normalizeRoute(route);

      // Record the metrics
      metricsService.recordHttpRequest(
        req.method,
        normalizedRoute,
        res.statusCode,
        duration
      );

      // Call the original end method
      return originalEnd.apply(this, args);
    };

    next();
  }
}
