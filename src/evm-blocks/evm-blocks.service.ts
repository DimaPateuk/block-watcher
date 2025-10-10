import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createPublicClient, http } from "viem";
import {
  mainnet,
  optimism,
  arbitrum,
  polygon,
  base,
  sepolia,
  Chain,
} from "viem/chains";

function viemChainById(id: number): Chain {
  switch (id) {
    case 1:
      return mainnet;
    case 10:
      return optimism;
    case 137:
      return polygon;
    case 42161:
      return arbitrum;
    case 8453:
      return base;
    case 11155111:
      return sepolia;
    default:
      return mainnet;
  }
}

type EvmBlockInsert = Omit<Prisma.EvmBlockUncheckedCreateInput, "id">;

@Injectable()
export class EvmBlocksService {
  readonly clients = new Map<number, ReturnType<typeof createPublicClient>>();
  private readonly logger = new Logger(EvmBlocksService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {
    this.clients.set(
      1,
      createPublicClient({
        chain: viemChainById(1),
        transport: http(this.config.get("RPC_ETH_MAINNET_URL", "")),
      })
    );
  }

  getLatest(chainId: number) {
    return this.prisma.evmBlock.findFirst({
      where: { chainId },
      orderBy: { number: "desc" },
    });
  }
  byNumber(chainId: number, num: number) {
    return this.prisma.evmBlock.findFirst({
      where: { chainId, number: num },
      orderBy: { number: "desc" },
    });
  }

  upsertBlock(input: EvmBlockInsert[]) {
    return this.prisma.evmBlock.createMany({
      data: input,
      skipDuplicates: true,
    });
  }

  getClient(chainId: number) {
    return this.clients.get(chainId)!;
  }

  async getHeadNumber(chainId: number): Promise<bigint> {
    const client = this.getClient(chainId);
    const b = await client.getBlock({ blockTag: "latest" });
    return b.number!;
  }

  async getBlockByNumber(chainId: number, number: bigint) {
    const client = this.getClient(chainId);
    const b = await client.getBlock({ blockNumber: number });
    return b;
  }

  async findMissingFullRange(chainId: number) {
    const first = await this.prisma.evmBlock.findFirst({
      where: { chainId },
      orderBy: { number: "asc" },
      select: { number: true },
    });

    const last = await this.prisma.evmBlock.findFirst({
      where: { chainId },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    if (!first || !last) {
      return [];
    }

    const from = first.number;
    const to = last.number;

    if (to < from) return [];

    const limit = 10;
    const ranges = await this.prisma.$queryRaw<
      Array<{ start_missing: bigint; end_missing: bigint }>
    >`
    WITH ordered AS (
      SELECT
        b."number",
        LEAD(b."number") OVER (ORDER BY b."number") AS next_number
      FROM "EvmBlock" b
      WHERE b."chainId" = ${chainId}
        AND b."number" BETWEEN ${from}::bigint AND ${to}::bigint
    )
    SELECT
      (o."number" + 1)::bigint AS start_missing,
      (o.next_number - 1)::bigint AS end_missing
    FROM ordered o
    WHERE o.next_number IS NOT NULL
      AND o.next_number > o."number" + 1
      LIMIT ${limit};
    `;
    const missing: bigint[] = [];
    for (const r of ranges) {
      for (
        let n = r.start_missing;
        n <= r.end_missing && missing.length < limit;
        n++
      ) {
        missing.push(n);
      }
      if (missing.length >= limit) break;
    }

    return missing;
  }
}
