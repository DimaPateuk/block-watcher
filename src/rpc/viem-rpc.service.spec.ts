import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ViemRpcService } from './viem-rpc.service';

describe('ViemRpcService', () => {
  let service: ViemRpcService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ViemRpcService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('https://mainnet.infura.io/v3/test'),
          },
        },
      ],
    }).compile();

    service = module.get<ViemRpcService>(ViemRpcService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have mainnet client initialized', () => {
    expect(service.clients.has(1)).toBe(true);
  });

  describe('getConfiguredChainIds', () => {
    it('should return array with mainnet chain ID', () => {
      const result = service.getConfiguredChainIds();
      expect(result).toContain(1);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getChainName', () => {
    it('should return chain name for mainnet', () => {
      const result = service.getChainName(1);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should create client and return name for unknown chain', () => {
      const result = service.getChainName(999999);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle different supported chain IDs', () => {
      const supportedChains = [1, 10, 137, 42161, 8453, 11155111];
      
      supportedChains.forEach((chainId) => {
        const result = service.getChainName(chainId);
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('private getClient method', () => {
    it('should return existing client for chain 1', () => {
      const client = (service as any).getClient(1);
      expect(client).toBeDefined();
    });

    it('should create new client for new chain ID', () => {
      const client = (service as any).getClient(137);
      expect(client).toBeDefined();
      expect(service.clients.has(137)).toBe(true);
    });

    it('should use config service for RPC URL', () => {
      const getConfigSpy = jest.spyOn(configService, 'get');
      
      (service as any).getClient(137);
      
      expect(getConfigSpy).toHaveBeenCalledWith('RPC_CHAIN_137_URL', '');
    });
  });

  it('should have RPC service methods defined', () => {
    expect(typeof service.getHeadNumber).toBe('function');
    expect(typeof service.getBlockByNumber).toBe('function');
    expect(typeof service.getConfiguredChainIds).toBe('function');
    expect(typeof service.getChainName).toBe('function');
  });

  describe('getHeadNumber', () => {
    it('should call client.getBlock with latest tag', async () => {
      // Get the mainnet client that was set up in constructor
      const mainnetClient = service.clients.get(1);
      const mockGetBlock = jest.spyOn(mainnetClient as any, 'getBlock')
        .mockResolvedValue({ number: BigInt(19000000) });

      const result = await service.getHeadNumber(1);

      expect(mockGetBlock).toHaveBeenCalledWith({ blockTag: 'latest' });
      expect(result).toBe(BigInt(19000000));
    });

    it('should work with newly created clients', async () => {
      // This will create a new client for Polygon
      const polygonClient = (service as any).getClient(137);
      const mockGetBlock = jest.spyOn(polygonClient, 'getBlock')
        .mockResolvedValue({ number: BigInt(50000000) });

      const result = await service.getHeadNumber(137);

      expect(mockGetBlock).toHaveBeenCalledWith({ blockTag: 'latest' });
      expect(result).toBe(BigInt(50000000));
    });

    it('should handle different chain IDs correctly', async () => {
      // Test multiple chain IDs
      const testCases = [
        { chainId: 10, expectedBlock: BigInt(120000000) },
        { chainId: 42161, expectedBlock: BigInt(250000000) },
        { chainId: 8453, expectedBlock: BigInt(15000000) },
      ];

      for (const { chainId, expectedBlock } of testCases) {
        const client = (service as any).getClient(chainId);
        const mockGetBlock = jest.spyOn(client, 'getBlock')
          .mockResolvedValue({ number: expectedBlock });

        const result = await service.getHeadNumber(chainId);

        expect(mockGetBlock).toHaveBeenCalledWith({ blockTag: 'latest' });
        expect(result).toBe(expectedBlock);
      }
    });

    it('should throw error when RPC call fails', async () => {
      const mainnetClient = service.clients.get(1);
      const mockGetBlock = jest.spyOn(mainnetClient as any, 'getBlock')
        .mockRejectedValue(new Error('Network timeout'));

      await expect(service.getHeadNumber(1)).rejects.toThrow('Network timeout');
      expect(mockGetBlock).toHaveBeenCalledWith({ blockTag: 'latest' });
    });

    it('should handle null block number gracefully', async () => {
      const mainnetClient = service.clients.get(1);
      const mockGetBlock = jest.spyOn(mainnetClient as any, 'getBlock')
        .mockResolvedValue({ number: null });

      // The ! assertion will not throw in TypeScript, it just returns null
      // So let's test that it actually returns null in this case
      const result = await service.getHeadNumber(1);
      expect(result).toBe(null);
    });
  });

  describe('getBlockByNumber', () => {
    it('should call client.getBlock with specific block number', async () => {
      const mainnetClient = service.clients.get(1);
      const blockNumber = BigInt(19000000);
      const mockBlock = {
        number: blockNumber,
        hash: '0xabcdef123456789abcdef123456789abcdef123456789abcdef123456789abcdef',
        parentHash: '0x123456789abcdef123456789abcdef123456789abcdef123456789abcdef123456',
        timestamp: BigInt(1728339200),
        gasUsed: BigInt(15000000),
        gasLimit: BigInt(30000000),
      };

      const mockGetBlock = jest.spyOn(mainnetClient as any, 'getBlock')
        .mockResolvedValue(mockBlock);

      const result = await service.getBlockByNumber(1, blockNumber);

      expect(mockGetBlock).toHaveBeenCalledWith({ blockNumber });
      expect(result).toBe(mockBlock);
    });

    it('should work with different chain IDs and block numbers', async () => {
      const testCases = [
        { chainId: 137, blockNumber: BigInt(50000000) },
        { chainId: 10, blockNumber: BigInt(120000000) },
        { chainId: 42161, blockNumber: BigInt(250000000) },
      ];

      for (const { chainId, blockNumber } of testCases) {
        const client = (service as any).getClient(chainId);
        const mockBlock = { number: blockNumber, hash: '0xtest' };
        const mockGetBlock = jest.spyOn(client, 'getBlock')
          .mockResolvedValue(mockBlock);

        const result = await service.getBlockByNumber(chainId, blockNumber);

        expect(mockGetBlock).toHaveBeenCalledWith({ blockNumber });
        expect(result).toBe(mockBlock);
      }
    });

    it('should handle genesis block (block 0)', async () => {
      const mainnetClient = service.clients.get(1);
      const genesisBlock = {
        number: BigInt(0),
        hash: '0xd4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3',
        parentHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      };

      const mockGetBlock = jest.spyOn(mainnetClient as any, 'getBlock')
        .mockResolvedValue(genesisBlock);

      const result = await service.getBlockByNumber(1, BigInt(0));

      expect(mockGetBlock).toHaveBeenCalledWith({ blockNumber: BigInt(0) });
      expect(result).toBe(genesisBlock);
    });

    it('should handle very large block numbers', async () => {
      const mainnetClient = service.clients.get(1);
      const largeBlockNumber = BigInt('999999999999999999');
      const mockBlock = { number: largeBlockNumber };

      const mockGetBlock = jest.spyOn(mainnetClient as any, 'getBlock')
        .mockResolvedValue(mockBlock);

      const result = await service.getBlockByNumber(1, largeBlockNumber);

      expect(mockGetBlock).toHaveBeenCalledWith({ blockNumber: largeBlockNumber });
      expect(result).toBe(mockBlock);
    });

    it('should throw error when block not found', async () => {
      const mainnetClient = service.clients.get(1);
      const mockGetBlock = jest.spyOn(mainnetClient as any, 'getBlock')
        .mockRejectedValue(new Error('Block not found'));

      await expect(service.getBlockByNumber(1, BigInt(99999999)))
        .rejects.toThrow('Block not found');
    });

    it('should handle RPC timeout errors', async () => {
      const polygonClient = (service as any).getClient(137);
      const mockGetBlock = jest.spyOn(polygonClient, 'getBlock')
        .mockRejectedValue(new Error('Request timeout'));

      await expect(service.getBlockByNumber(137, BigInt(50000000)))
        .rejects.toThrow('Request timeout');
    });
  });

  describe('Integration between async methods', () => {
    it('should use getHeadNumber to get latest, then getBlockByNumber to fetch it', async () => {
      const mainnetClient = service.clients.get(1);
      const latestBlockNumber = BigInt(19000000);
      const latestBlock = {
        number: latestBlockNumber,
        hash: '0xlatest',
        timestamp: BigInt(Date.now()),
      };

      // Mock both calls
      const mockGetBlockLatest = jest.spyOn(mainnetClient as any, 'getBlock')
        .mockImplementation(({ blockTag, blockNumber }) => {
          if (blockTag === 'latest') {
            return Promise.resolve({ number: latestBlockNumber });
          }
          if (blockNumber === latestBlockNumber) {
            return Promise.resolve(latestBlock);
          }
          throw new Error('Unexpected call');
        });

      // Get head number first
      const headNumber = await service.getHeadNumber(1);
      expect(headNumber).toBe(latestBlockNumber);

      // Then get the actual block
      const block = await service.getBlockByNumber(1, headNumber);
      expect(block).toBe(latestBlock);

      // Verify both calls were made correctly
      expect(mockGetBlockLatest).toHaveBeenCalledWith({ blockTag: 'latest' });
      expect(mockGetBlockLatest).toHaveBeenCalledWith({ blockNumber: latestBlockNumber });
    });
  });
});
