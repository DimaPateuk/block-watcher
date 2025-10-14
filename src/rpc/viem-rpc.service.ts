import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RpcService } from './rpc.types';
import { createPublicClient, http } from 'viem';
import { mainnet, optimism, arbitrum, polygon, base, sepolia, Chain } from 'viem/chains';

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

@Injectable()
export class ViemRpcService implements RpcService {
  readonly clients = new Map<number, ReturnType<typeof createPublicClient>>();

  constructor(private readonly config: ConfigService) {
    const mainnetUrl = this.config.get<string>('RPC_ETH_MAINNET_URL', '');
    this.clients.set(
      1,
      createPublicClient({
        chain: viemChainById(1),
        transport: http(mainnetUrl),
      }),
    );
  }

  private getClient(chainId: number) {
    const existing = this.clients.get(chainId);
    if (existing) return existing;
    const url = this.config.get<string>(`RPC_CHAIN_${chainId}_URL`, '');
    const client = createPublicClient({ chain: viemChainById(chainId), transport: http(url) });
    this.clients.set(chainId, client);
    return client;
  }

  async getHeadNumber(chainId: number): Promise<bigint> {
    const client = this.getClient(chainId);
    const b = await client.getBlock({ blockTag: 'latest' });
    return b.number!;
  }

  async getBlockByNumber(chainId: number, number: bigint) {
    const client = this.getClient(chainId);
    return client.getBlock({ blockNumber: number });
  }

  getConfiguredChainIds(): number[] {
    return Array.from(this.clients.keys());
  }

  getChainName(chainId: number): string {
    const client = this.getClient(chainId);
    return client.chain?.name ?? `chainId=${chainId}`;
  }
}
