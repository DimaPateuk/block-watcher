import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsMiddleware } from './metrics.middleware';

@Module({
  providers: [MetricsService],
  controllers: [MetricsController],
  exports: [MetricsService], // Export for use in other modules if needed
})
export class MetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply metrics middleware to all routes except /metrics itself
    // to avoid recording metrics collection requests
    consumer
      .apply(MetricsMiddleware)
      .exclude('metrics')
      .forRoutes('*');
  }
}
