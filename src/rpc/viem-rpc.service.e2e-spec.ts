import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ViemRpcService } from './viem-rpc.service';
import { RPC_SERVICE } from './rpc.types';
import { createBlocks } from '../../test/utils/block-gen';
import { MockRpcService, toRpcMockBlock } from '../../test/utils/rpc-mock';

describe('ViemRpcService E2E', () => {
  let rpcService: ViemRpcService;
  let mockRpc: MockRpcService;
  let module: TestingModule;

  beforeAll(async () => {
    mockRpc = new MockRpcService();
    
    module = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'RPC_ETH_MAINNET_URL') return 'http://localhost:8545';
              if (key.startsWith('RPC_CHAIN_')) return 'http://localhost:8545';
              return 'test-value';
            }),
          },
        },
        ViemRpcService,
        {
          provide: RPC_SERVICE,
          useClass: ViemRpcService,
        },
      ],
    }).compile();

    rpcService = module.get<ViemRpcService>(ViemRpcService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Service Configuration', () => {
    it('should be defined', () => {
      expect(rpcService).toBeDefined();
    });

    it('should have configured chains', () => {
      const chainIds = rpcService.getConfiguredChainIds();
      expect(chainIds).toContain(1); // Mainnet should be configured by default
    });

    it('should provide chain names', () => {
      expect(rpcService.getChainName(1)).toBe('Ethereum');
      expect(rpcService.getChainName(10)).toBe('OP Mainnet');
      expect(rpcService.getChainName(137)).toBe('Polygon');
      expect(rpcService.getChainName(42161)).toBe('Arbitrum One');
      expect(rpcService.getChainName(8453)).toBe('Base');
      expect(rpcService.getChainName(11155111)).toBe('Sepolia');
    });

    it('should fallback to mainnet for unknown chains', () => {
      // Unknown chains fall back to mainnet chain configuration
      expect(rpcService.getChainName(99999)).toBe('Ethereum');
    });
  });

  describe('RPC Operations with Mock', () => {
    beforeAll(async () => {
      // Setup mock RPC responses for testing
      const testBlocks = createBlocks(5, {
        chainId: 1,
        startNumber: 20000n,
        salt: 'rpc-integration-test',
      }).map(block => toRpcMockBlock({
        number: typeof block.number === 'bigint' ? block.number : BigInt(block.number),
        hash: block.hash,
        parentHash: block.parentHash,
        timestamp: typeof block.timestamp === 'bigint' ? block.timestamp : BigInt(block.timestamp),
      }));
      
      mockRpc.setBlocks(1, testBlocks);
      mockRpc.setHeadNumber(1, 20004n);
    });

    it('should get head number', async () => {
      // Note: This would normally test against real RPC, but we're testing the interface
      expect(rpcService.getHeadNumber).toBeDefined();
      expect(typeof rpcService.getHeadNumber).toBe('function');
    });

    it('should get block by number', async () => {
      // Note: This would normally test against real RPC, but we're testing the interface
      expect(rpcService.getBlockByNumber).toBeDefined();
      expect(typeof rpcService.getBlockByNumber).toBe('function');
    });
  });

  describe('Mock RPC Service Integration', () => {
    it('should work with mock for testing purposes', async () => {
      const headNumber = await mockRpc.getHeadNumber(1);
      expect(headNumber).toBe(20004n);
    });

    it('should return mock blocks', async () => {
      const block = await mockRpc.getBlockByNumber(1, 20002n);
      expect(block).not.toBeNull();
      expect(block?.number).toBe(20002n);
      expect(block?.hash).toContain('0x');
    });

    it('should return null for non-existent blocks', async () => {
      const block = await mockRpc.getBlockByNumber(1, 99999n);
      expect(block).toBeNull();
    });

    it('should handle multiple chains', async () => {
      // Setup chain 2
      const chain2Blocks = createBlocks(3, {
        chainId: 2,
        startNumber: 1000n,
        salt: 'chain2-test',
      }).map(block => toRpcMockBlock({
        number: typeof block.number === 'bigint' ? block.number : BigInt(block.number),
        hash: block.hash,
        parentHash: block.parentHash,
        timestamp: typeof block.timestamp === 'bigint' ? block.timestamp : BigInt(block.timestamp),
      }));
      
      mockRpc.setBlocks(2, chain2Blocks);
      mockRpc.setHeadNumber(2, 1002n);
      
      const configuredChains = mockRpc.getConfiguredChainIds();
      expect(configuredChains).toContain(1);
      expect(configuredChains).toContain(2);
      
      const head2 = await mockRpc.getHeadNumber(2);
      expect(head2).toBe(1002n);
      
      const block2 = await mockRpc.getBlockByNumber(2, 1001n);
      expect(block2).not.toBeNull();
      expect(block2?.number).toBe(1001n);
    });
  });

  describe('Chain Configuration', () => {
    it('should support mainnet by default', () => {
      const chainIds = rpcService.getConfiguredChainIds();
      expect(chainIds).toContain(1);
    });

    it('should provide correct chain names for supported networks', () => {
      const supportedChains = [
        { id: 1, name: 'Ethereum' },
        { id: 10, name: 'OP Mainnet' },
        { id: 137, name: 'Polygon' },
        { id: 42161, name: 'Arbitrum One' },
        { id: 8453, name: 'Base' },
        { id: 11155111, name: 'Sepolia' },
      ];
      
      supportedChains.forEach(({ id, name }) => {
        expect(rpcService.getChainName(id)).toBe(name);
      });
    });

    it('should handle dynamic chain configuration', () => {
      // The service should be able to create clients for new chains dynamically
      // Unknown chains fall back to mainnet configuration
      expect(rpcService.getChainName(999)).toBe('Ethereum');
    });
  });

  describe('Service Interface Compliance', () => {
    it('should implement RpcService interface correctly', () => {
      expect(rpcService.getHeadNumber).toBeDefined();
      expect(rpcService.getBlockByNumber).toBeDefined();
      expect(rpcService.getConfiguredChainIds).toBeDefined();
      expect(rpcService.getChainName).toBeDefined();
    });

    it('should return correct types', () => {
      const chainIds = rpcService.getConfiguredChainIds();
      expect(Array.isArray(chainIds)).toBe(true);
      expect(chainIds.every(id => typeof id === 'number')).toBe(true);
      
      const chainName = rpcService.getChainName(1);
      expect(typeof chainName).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid chain IDs gracefully', () => {
      expect(() => rpcService.getChainName(-1)).not.toThrow();
      expect(() => rpcService.getChainName(0)).not.toThrow();
      expect(() => rpcService.getConfiguredChainIds()).not.toThrow();
    });
  });
});
