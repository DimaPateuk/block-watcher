import { Module, forwardRef } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { MetricsModule } from "../metrics/metrics.module";

@Module({
  imports: [forwardRef(() => MetricsModule)],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
