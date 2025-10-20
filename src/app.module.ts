import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { EvmBlocksModule } from "./evm-blocks/evm-blocks.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RpcModule } from "./rpc/rpc.module";
import { LoggerModule } from "nestjs-pino";
import { MetricsModule } from "./metrics/metrics.module";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        name: "PINO-LOG",
        level: process.env.NODE_ENV === "production" ? "info" : "debug",
        autoLogging: {
          ignore: (req) => process.env.NODE_ENV === "development",
        },
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { colorize: true } }
            : undefined,
      },
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    MetricsModule,
    HealthModule,
    PrismaModule,
    RpcModule,
    EvmBlocksModule,
  ],
})
export class AppModule {}
