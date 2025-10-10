import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EvmBlocksModule } from "../evm-blocks/evm-blocks.module";

@Module({
  imports: [ConfigModule, EvmBlocksModule],
  providers: [],
  exports: [],
})
export class EthereumModule {}
