import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EvmBlocksService } from "../evm-blocks/evm-blocks.service";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class EvmWatcherProvider implements OnModuleInit {
  private readonly logger = new Logger(EvmWatcherProvider.name);
  private readonly pollMs: number;

  constructor(
    private readonly config: ConfigService,
    private readonly evmBlocks: EvmBlocksService
  ) {}

  async onModuleInit() {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleCron() {
    for (const [_, client] of this.evmBlocks.clients) {
      const chainId = client.chain?.id;
      if (!chainId) continue;

      try {
        await this.tick(chainId);
      } catch (err: any) {
        this.logger.error(`[${chainId}] ${err?.message || err}`);
      }
    }
  }

  private async tick(chainId: number) {
    const head = await this.evmBlocks.getHeadNumber(chainId);

    const b = await this.evmBlocks.getBlockByNumber(chainId, head);

    await this.evmBlocks.upsertBlock({
      chainId,
      number: b.number,
      hash: b.hash,
      parentHash: b.parentHash,
      timestamp: b.timestamp,
    });

    this.logger.log(
      `[${
        this.evmBlocks.getClient(chainId).chain?.name
      }] last number is ${head.toString()}`
    );
  }
}
