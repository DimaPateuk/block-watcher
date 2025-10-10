import { Module } from "@nestjs/common";
import { EvmBlocksService } from "./evm-blocks.service";
import { EvmBlocksController } from "./evm-blocks.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { EvmWatcherProvider } from "./evm-watcher.provider";
import { ScheduleModule } from "@nestjs/schedule";

@Module({
  imports: [PrismaModule, ScheduleModule],
  controllers: [EvmBlocksController],
  providers: [EvmBlocksService, EvmWatcherProvider],
  exports: [EvmBlocksService],
})
export class EvmBlocksModule {}
