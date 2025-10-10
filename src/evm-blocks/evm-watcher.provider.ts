import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EvmBlocksService } from "../evm-blocks/evm-blocks.service";
import { Cron, CronExpression } from "@nestjs/schedule";

@Injectable()
export class EvmWatcherProvider implements OnModuleInit {
  private readonly logger = new Logger(EvmWatcherProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly evmBlocks: EvmBlocksService
  ) {}

  async onModuleInit() {
    this.scanTipWindows();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scanTipWindows() {
    const clients = (this.evmBlocks as any).clients as
      | Map<number, any>
      | undefined;
    if (!clients || clients.size === 0) {
      this.logger.debug("No EVM clients configured — skipping tip scan");
      return;
    }

    // Loop all clients and delegate work
    for (const [chainId, client] of clients.entries()) {
      await this.scanClientTip(chainId, client);
    }
  }

  private async scanClientTip(chainId: number, client: any) {
    const name = client?.chain?.name ?? `chainId=${chainId}`;

    const latest = await this.evmBlocks.getLatest(chainId);

    if (!latest) {
      this.logger.debug(`[${name}] No blocks in DB yet — skipping`);
      return;
    }

    const missing = await this.evmBlocks.findMissingFullRange(chainId);

    const blocksRequests = missing.map((n) => {
      return client.getBlock({ blockNumber: n });
    });

    const data = (await Promise.all(blocksRequests)).map((b) => {
      const mapped = {
        chainId,
        number: b.number!,
        hash: b.hash!,
        parentHash: b.parentHash!,
        timestamp: Number(b.timestamp),
      };

      return mapped;
    });

    await this.evmBlocks.upsertBlock(data);

    this.logger.log(
      `[${this.evmBlocks.getClient(chainId).chain?.name}] synced ${missing.join(
        ", "
      )}`
    );
  }

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

    await this.evmBlocks.upsertBlock([
      {
        chainId,
        number: b.number,
        hash: b.hash,
        parentHash: b.parentHash,
        timestamp: b.timestamp,
      },
    ]);

    this.logger.log(
      `[${
        this.evmBlocks.getClient(chainId).chain?.name
      }] last number is ${head.toString()}`
    );
  }
}
