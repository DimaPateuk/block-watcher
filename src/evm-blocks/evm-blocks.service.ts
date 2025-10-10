import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { Injectable } from "@nestjs/common";
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

  upsertBlock(input: EvmBlockInsert) {
    const { chainId, number } = input;
    return this.prisma.evmBlock.upsert({
      where: { chainId_number: { chainId, number } },
      update: {},
      create: input,
    });
  }

  readonly clients = new Map<number, ReturnType<typeof createPublicClient>>();

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
}
