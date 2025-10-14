export const RPC_SERVICE = 'RpcService';

export interface IRpcViewClient {
  getBlock(n: bigint): Promise<{
    number: bigint;
    hash: string;
    parentHash: string;
    timestamp: number;
  }>;
}

export interface RpcService {
  getHeadNumber(chainId: number): Promise<bigint>;
  getBlockByNumber(chainId: number, number: bigint): Promise<any>;
  getConfiguredChainIds(): number[];
  getChainName(chainId: number): string;
}
