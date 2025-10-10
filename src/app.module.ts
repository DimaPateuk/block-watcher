import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { EthereumModule } from "./ethereum/ethereum.module";
import { EvmBlocksModule } from "./evm-blocks/evm-blocks.module";
import { PrismaModule } from "./prisma/prisma.module";
import { LoggerModule } from "nestjs-pino";

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
    PrismaModule,
    EvmBlocksModule,
    EthereumModule,
  ],
})
export class AppModule {}
