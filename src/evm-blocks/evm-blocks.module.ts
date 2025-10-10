import { Module } from "@nestjs/common";
import { EvmBlocksService } from "./evm-blocks.service";
import { EvmBlocksController } from "./evm-blocks.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { EvmWatcherProvider } from "./evm-watcher.provider";

@Module({
  imports: [PrismaModule],
  controllers: [EvmBlocksController],
  providers: [EvmBlocksService, EvmWatcherProvider],
  exports: [EvmBlocksService],
})
export class EvmBlocksModule {}
