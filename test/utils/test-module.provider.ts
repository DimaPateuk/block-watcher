import { TestingModule, Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EvmBlocksService } from '../../src/evm-blocks/evm-blocks.service';
import { EvmWatcherProvider } from '../../src/evm-blocks/evm-watcher.provider';
import { PrismaService } from '../../src/prisma/prisma.service';
import { MetricsService } from '../../src/metrics/metrics.service';
import { RPC_SERVICE } from '../../src/rpc/rpc.types';
import { MockRpcService } from './rpc-mock';

export interface TestModuleConfig {
  includeWatcher?: boolean;
  mockConfigValues?: Record<string, any>;
}

export class TestModuleProvider {
  private static mockRpcInstance: MockRpcService;
  
  static async createTestModule(config: TestModuleConfig = {}): Promise<{
    module: TestingModule;
    mockRpc: MockRpcService;
    evmBlocksService: EvmBlocksService;
    watcherProvider?: EvmWatcherProvider;
  }> {
    // Create or reuse MockRpcService instance
    if (!this.mockRpcInstance) {
      this.mockRpcInstance = new MockRpcService();
    } else {
      // Reset state for clean test environment
      this.mockRpcInstance.reset();
    }

    const providers: any[] = [
      EvmBlocksService,
      PrismaService,
      {
        provide: MetricsService,
        useValue: {
          recordDbQuery: jest.fn(),
          updateConnectionPool: jest.fn(),
          recordHttpRequest: jest.fn(),
        },
      },
      {
        provide: ConfigService,
        useValue: {
          get: jest.fn().mockImplementation((key: string) => {
            return config.mockConfigValues?.[key] ?? 'test-value';
          }),
        },
      },
      {
        provide: RPC_SERVICE,
        useValue: this.mockRpcInstance,
      },
    ];

    // Conditionally add EvmWatcherProvider
    if (config.includeWatcher) {
      providers.push(EvmWatcherProvider);
    }

    const module = await Test.createTestingModule({
      providers,
    }).compile();

    const evmBlocksService = module.get<EvmBlocksService>(EvmBlocksService);
    const watcherProvider = config.includeWatcher 
      ? module.get<EvmWatcherProvider>(EvmWatcherProvider)
      : undefined;

    return {
      module,
      mockRpc: this.mockRpcInstance,
      evmBlocksService,
      watcherProvider,
    };
  }

  static resetMockRpc(): void {
    if (this.mockRpcInstance) {
      this.mockRpcInstance.reset();
    }
  }

  static getMockRpcInstance(): MockRpcService | undefined {
    return this.mockRpcInstance;
  }

  // Pre-configured test scenarios
  static async createModuleWithEmptyDatabase(config: TestModuleConfig = {}) {
    const result = await this.createTestModule(config);
    // Database is already empty due to reset in global setup
    return result;
  }

  static async createModuleWithContiguousBlocks(config: TestModuleConfig = {}) {
    const result = await this.createTestModule(config);
    
    // Setup contiguous blocks scenario
    result.mockRpc.setupMultiChainScenario([
      { 
        chainId: 1, 
        headNumber: 1020n,
        blocks: Array.from({ length: 21 }, (_, i) => ({
          number: BigInt(1000 + i),
          hash: `0xcontiguous${1000 + i}`,
          parentHash: `0xparent${1000 + i}`,
          timestamp: 1700000000 + i,
        }))
      }
    ]);

    return result;
  }

  static async createModuleWithBlockHoles(config: TestModuleConfig = {}) {
    const result = await this.createTestModule(config);
    
    // Setup blocks with holes scenario
    const blocksWithHoles = [
      // First range: 2000-2005
      ...Array.from({ length: 6 }, (_, i) => ({
        number: BigInt(2000 + i),
        hash: `0xholes${2000 + i}`,
        parentHash: `0xparent${2000 + i}`,
        timestamp: 1700000000 + i,
      })),
      // Second range: 2010-2015 (missing 2006-2009)
      ...Array.from({ length: 6 }, (_, i) => ({
        number: BigInt(2010 + i),
        hash: `0xholes${2010 + i}`,
        parentHash: `0xparent${2010 + i}`,
        timestamp: 1700000010 + i,
      })),
    ];

    result.mockRpc.setupMultiChainScenario([
      { 
        chainId: 1, 
        headNumber: 2015n,
        blocks: blocksWithHoles
      }
    ]);

    // Also setup missing blocks that can be fetched via RPC
    const missingBlocks = Array.from({ length: 4 }, (_, i) => ({
      number: BigInt(2006 + i),
      hash: `0xmissing${2006 + i}`,
      parentHash: `0xparent${2006 + i}`,
      timestamp: 1700000006 + i,
    }));
    
    result.mockRpc.setBlocks(1, missingBlocks);

    return result;
  }

  static async createModuleWithMultiChain(config: TestModuleConfig = {}) {
    const result = await this.createTestModule(config);
    
    // Setup multi-chain scenario
    result.mockRpc.setupMultiChainScenario([
      { 
        chainId: 1, 
        headNumber: 1000n,
        blocks: [
          { number: 1000n, hash: '0xchain1_1000', parentHash: '0xparent1_1000', timestamp: 1700001000 }
        ]
      },
      { 
        chainId: 2, 
        headNumber: 2000n,
        blocks: [
          { number: 2000n, hash: '0xchain2_2000', parentHash: '0xparent2_2000', timestamp: 1700002000 }
        ]
      },
      { 
        chainId: 3, 
        headNumber: 3000n,
        blocks: [
          { number: 3000n, hash: '0xchain3_3000', parentHash: '0xparent3_3000', timestamp: 1700003000 }
        ]
      }
    ]);

    return result;
  }

  static async createModuleWithErrorSimulation(config: TestModuleConfig = {}) {
    const result = await this.createTestModule(config);
    
    // Setup error simulation
    result.mockRpc.simulateNetworkTimeout(1);
    result.mockRpc.simulateRpcConnectionFailed(2);
    
    return result;
  }
}

// Convenience helper for common test patterns
export const createBasicTestModule = () => TestModuleProvider.createModuleWithEmptyDatabase();
export const createWatcherTestModule = () => TestModuleProvider.createModuleWithEmptyDatabase({ includeWatcher: true });
export const createMultiChainTestModule = () => TestModuleProvider.createModuleWithMultiChain({ includeWatcher: true });
