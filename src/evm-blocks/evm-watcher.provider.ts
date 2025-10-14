import { Injectable, Logger, OnModuleInit, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EvmBlocksService } from "../evm-blocks/evm-blocks.service";
import { Cron, CronExpression } from "@nestjs/schedule";
import { RPC_SERVICE, RpcService } from "../rpc/rpc.types";

@Injectable()
export class EvmWatcherProvider implements OnModuleInit {
  private readonly logger = new Logger(EvmWatcherProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly evmBlocks: EvmBlocksService,
    @Inject(RPC_SERVICE) private readonly rpc: RpcService
  ) {}

  async onModuleInit() {
    this.scanTipWindows();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scanTipWindows() {
    const configuredChainIds = this.rpc.getConfiguredChainIds();
    if (configuredChainIds.length === 0) {
      this.logger.debug("No EVM clients configured — skipping tip scan");
      return;
    }

    // Loop all configured chains and delegate work
    for (const chainId of configuredChainIds) {
      try {
        await this.scanClientTip(chainId);
      } catch (err: any) {
        this.logger.error(`[${chainId}] ${err?.message || err}`);
      }
    }
  }

  private async scanClientTip(chainId: number) {
    const name = this.rpc.getChainName(chainId);

    const latest = await this.evmBlocks.getLatest(chainId);

    if (!latest) {
      this.logger.debug(`[${name}] No blocks in DB yet — skipping`);
      return;
    }

    const missing = await this.evmBlocks.findMissingFullRange(chainId);
    
    if (missing.length === 0) {
      this.logger.debug(`[${name}] No missing blocks found`);
      return;
    }

    const blocksRequests = missing.map((n) => {
      return this.rpc.getBlockByNumber(chainId, n);
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

    await this.evmBlocks.upsertBlocks(data);

    this.logger.log(
      `[${name}] synced ${missing.join(", ")}`
    );
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleCron() {
    const configuredChainIds = this.rpc.getConfiguredChainIds();
    
    for (const chainId of configuredChainIds) {
      try {
        await this.tick(chainId);
      } catch (err: any) {
        this.logger.error(`[${chainId}] ${err?.message || err}`);
      }
    }
  }

  private async tick(chainId: number) {
    const head = await this.rpc.getHeadNumber(chainId);

    const b = await this.rpc.getBlockByNumber(chainId, head);

    await this.evmBlocks.upsertBlocks([
      {
        chainId,
        number: b.number!,
        hash: b.hash!,
        parentHash: b.parentHash!,
        timestamp: Number(b.timestamp),
      },
    ]);

    const name = this.rpc.getChainName(chainId);
    this.logger.log(
      `[${name}] inserted head block ${head.toString()}`
    );
  }
}
