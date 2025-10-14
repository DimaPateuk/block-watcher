import { Injectable } from '@nestjs/common';
import { RpcService, IRpcViewClient } from '../../src/rpc/rpc.types';

export interface MockRpcBlock {
  number: bigint;
  hash: string;
  parentHash: string;
  timestamp: number;
}

@Injectable()
export class MockRpcService implements RpcService {
  private blocks = new Map<string, MockRpcBlock>();
  private headNumbers = new Map<number, bigint>();
  private configuredChains = new Set<number>();
  private errorSimulations = new Map<string, Error>();

  constructor() {
    // Start with no configured chains by default
  }

  // Configuration methods for tests
  reset(): void {
    this.blocks.clear();
    this.headNumbers.clear();
    this.configuredChains.clear();
    this.errorSimulations.clear();
  }

  configureChain(chainId: number, headNumber?: bigint): void {
    this.configuredChains.add(chainId);
    if (headNumber !== undefined) {
      this.headNumbers.set(chainId, headNumber);
    }
  }

  setBlocks(chainId: number, blocks: MockRpcBlock[]): void {
    blocks.forEach(block => {
      this.blocks.set(`${chainId}:${block.number}`, block);
    });
    this.configuredChains.add(chainId);
  }

  setHeadNumber(chainId: number, headNumber: bigint): void {
    this.headNumbers.set(chainId, headNumber);
    this.configuredChains.add(chainId);
  }

  // Error simulation methods
  simulateError(method: 'getHeadNumber' | 'getBlockByNumber', chainId: number, error: Error): void {
    this.errorSimulations.set(`${method}:${chainId}`, error);
  }

  simulateErrorForBlock(chainId: number, blockNumber: bigint, error: Error): void {
    this.errorSimulations.set(`getBlockByNumber:${chainId}:${blockNumber}`, error);
  }

  clearErrors(): void {
    this.errorSimulations.clear();
  }

  // RpcService implementation
  async getHeadNumber(chainId: number): Promise<bigint> {
    const errorKey = `getHeadNumber:${chainId}`;
    if (this.errorSimulations.has(errorKey)) {
      throw this.errorSimulations.get(errorKey)!;
    }
    
    return this.headNumbers.get(chainId) ?? 1000n;
  }

  async getBlockByNumber(chainId: number, number: bigint): Promise<MockRpcBlock | null> {
    const errorKey = `getBlockByNumber:${chainId}`;
    const blockErrorKey = `getBlockByNumber:${chainId}:${number}`;
    
    if (this.errorSimulations.has(blockErrorKey)) {
      throw this.errorSimulations.get(blockErrorKey)!;
    }
    if (this.errorSimulations.has(errorKey)) {
      throw this.errorSimulations.get(errorKey)!;
    }
    
    const key = `${chainId}:${number}`;
    return this.blocks.get(key) ?? null;
  }

  getConfiguredChainIds(): number[] {
    return Array.from(this.configuredChains);
  }

  getChainName(chainId: number): string {
    return `MockChain${chainId}`;
  }

  // Helper methods for test setup
  setupDefaultTestData(): void {
    // Setup common test scenarios with explicit chains
    this.configureChain(1, 1000n);
    this.configureChain(2, 2000n);
    
    // Add some default blocks for testing
    const defaultBlocks: MockRpcBlock[] = [
      { number: 1000n, hash: '0xdefault1000', parentHash: '0xparent1000', timestamp: 1700000000 },
      { number: 1001n, hash: '0xdefault1001', parentHash: '0xdefault1000', timestamp: 1700000001 },
    ];
    
    this.setBlocks(1, defaultBlocks);
  }

  // Batch configuration for complex test scenarios
  setupMultiChainScenario(chains: Array<{ chainId: number; headNumber: bigint; blocks?: MockRpcBlock[] }>): void {
    chains.forEach(({ chainId, headNumber, blocks = [] }) => {
      this.configureChain(chainId, headNumber);
      if (blocks.length > 0) {
        this.setBlocks(chainId, blocks);
      }
    });
  }

  // Simulate network conditions
  simulateNetworkTimeout(chainId: number): void {
    this.simulateError('getHeadNumber', chainId, new Error('Network timeout'));
    this.simulateError('getBlockByNumber', chainId, new Error('Network timeout'));
  }

  simulateRpcConnectionFailed(chainId: number): void {
    this.simulateError('getHeadNumber', chainId, new Error('RPC connection failed'));
    this.simulateError('getBlockByNumber', chainId, new Error('RPC connection failed'));
  }
}

export const createMockRpcViewClient = (blocks: MockRpcBlock[] = []): IRpcViewClient => {
  const blockMap = new Map<bigint, MockRpcBlock>();
  blocks.forEach(block => blockMap.set(block.number, block));

  return {
    async getBlock(n: bigint): Promise<MockRpcBlock> {
      const block = blockMap.get(n);
      if (!block) {
        throw new Error(`Block ${n} not found in mock`);
      }
      return block;
    }
  };
};

/** Convert our test block format to RPC mock format */
export function toRpcMockBlock(block: {
  number: bigint;
  hash: string;
  parentHash: string;
  timestamp: bigint;
}): MockRpcBlock {
  return {
    number: block.number,
    hash: block.hash,
    parentHash: block.parentHash,
    timestamp: Number(block.timestamp),
  };
}
