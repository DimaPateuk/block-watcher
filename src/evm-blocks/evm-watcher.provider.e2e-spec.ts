import { TestingModule } from '@nestjs/testing';
import { EvmWatcherProvider } from './evm-watcher.provider';
import { EvmBlocksService } from './evm-blocks.service';
import { 
  createBlocks, 
  createBlocksWithHoles, 
  createBlockRange 
} from '../../test/utils/block-gen';
import { TestModuleProvider, createWatcherTestModule } from '../../test/utils/test-module.provider';
import { MockRpcService } from '../../test/utils/rpc-mock';

describe('EvmWatcherProvider E2E', () => {
  let provider: EvmWatcherProvider;
  let evmBlocksService: EvmBlocksService;
  let mockRpc: MockRpcService;
  let module: TestingModule;

  beforeAll(async () => {
    const testModule = await createWatcherTestModule();
    module = testModule.module;
    provider = testModule.watcherProvider!;
    evmBlocksService = testModule.evmBlocksService;
    mockRpc = testModule.mockRpc;
  });

  beforeEach(() => {
    // Reset mock RPC state before each test
    TestModuleProvider.resetMockRpc();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('onModuleInit', () => {
    it('should trigger scanTipWindows on module initialization', async () => {
      const scanSpy = jest.spyOn(provider, 'scanTipWindows').mockResolvedValue();
      
      await provider.onModuleInit();
      
      expect(scanSpy).toHaveBeenCalled();
      
      scanSpy.mockRestore();
    });
  });

  describe('scanTipWindows - Empty Database Scenarios', () => {
    it('should skip when no RPC clients configured', async () => {
      const debugSpy = jest.spyOn((provider as any).logger, 'debug');
      // mockRpc starts with no configured chains after reset
      
      await provider.scanTipWindows();
      
      expect(debugSpy).toHaveBeenCalledWith('No EVM clients configured — skipping tip scan');
    });

    it('should skip chains with empty database', async () => {
      const debugSpy = jest.spyOn((provider as any).logger, 'debug');
      
      // Configure chains but don't add any database blocks
      mockRpc.configureChain(1);
      mockRpc.configureChain(2);
      
      // Database is empty - getLatest will return null
      await provider.scanTipWindows();
      
      expect(debugSpy).toHaveBeenCalledWith('[MockChain1] No blocks in DB yet — skipping');
      expect(debugSpy).toHaveBeenCalledWith('[MockChain2] No blocks in DB yet — skipping');
    });
  });

  describe('scanTipWindows - Database with Contiguous Blocks', () => {
    beforeEach(async () => {
      // Setup database with contiguous blocks for chain 1
      const contiguousBlocks = createBlockRange(1000n, 1020n, {
        chainId: 1,
        salt: 'contiguous-watcher-test',
      });
      await evmBlocksService.upsertBlocks(contiguousBlocks);
      
      mockRpc.configureChain(1);
    });

    it('should skip when no missing blocks found', async () => {
      const debugSpy = jest.spyOn((provider as any).logger, 'debug');
      
      await provider.scanTipWindows();
      
      expect(debugSpy).toHaveBeenCalledWith('[MockChain1] No missing blocks found');
    });
  });

  describe('scanTipWindows - Database with Holes', () => {
    beforeEach(async () => {
      // Setup database with holes for chain 2
      const blocksWithHoles = createBlocksWithHoles([
        { from: 2000n, to: 2005n },    // blocks 2000-2005
        { from: 2010n, to: 2015n },    // blocks 2010-2015 (missing 2006-2009)
      ], {
        chainId: 2,
        salt: 'holes-watcher-test',
      });
      await evmBlocksService.upsertBlocks(blocksWithHoles);
      
      mockRpc.configureChain(2);
      
      // Add RPC blocks for missing numbers
      const missingBlocks = Array.from({ length: 4 }, (_, i) => ({
        number: BigInt(2006 + i),
        hash: `0xmock_${2006 + i}`,
        parentHash: `0xparent_${2006 + i}`,
        timestamp: 1700000000,
      }));
      mockRpc.setBlocks(2, missingBlocks);
    });

    it('should sync missing blocks successfully', async () => {
      const logSpy = jest.spyOn((provider as any).logger, 'log');
      
      await provider.scanTipWindows();
      
      // Should sync the missing blocks (2006, 2007, 2008, 2009)
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MockChain2] synced 2006, 2007, 2008, 2009')
      );
      
      // Verify blocks were actually inserted into database
      const block2006 = await evmBlocksService.byNumber(2, 2006);
      const block2009 = await evmBlocksService.byNumber(2, 2009);
      
      expect(block2006).not.toBeNull();
      expect(block2009).not.toBeNull();
      expect(block2006?.hash).toBe('0xmock_2006');
      expect(block2009?.hash).toBe('0xmock_2009');
      
      // Verify blocks were retrieved from RPC (no need to verify method calls with real service)
    });

    it('should handle RPC errors gracefully', async () => {
      const errorSpy = jest.spyOn((provider as any).logger, 'error');
      
      // Simulate RPC error
      mockRpc.simulateError('getBlockByNumber', 2, new Error('Network timeout'));
      
      await provider.scanTipWindows();
      
      expect(errorSpy).toHaveBeenCalledWith('[2] Network timeout');
    });

    it('should handle null blocks from RPC', async () => {
      const errorSpy = jest.spyOn((provider as any).logger, 'error');
      
      // Clear blocks so RPC returns null
      mockRpc.reset();
      mockRpc.configureChain(2);
      
      // Add database blocks with holes but no RPC blocks
      const blocksWithHoles = createBlocksWithHoles([
        { from: 2000n, to: 2005n },
        { from: 2010n, to: 2015n },
      ], { chainId: 2, salt: 'null-test' });
      await evmBlocksService.upsertBlocks(blocksWithHoles);
      
      await provider.scanTipWindows();
      
      // Should handle gracefully and log error
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('handleCron - Head Block Syncing', () => {
    beforeEach(() => {
      mockRpc.configureChain(3);
    });

    it('should sync head block successfully', async () => {
      const logSpy = jest.spyOn((provider as any).logger, 'log');
      
      // Setup RPC responses
      mockRpc.setHeadNumber(3, 5000n);
      mockRpc.setBlocks(3, [{
        number: 5000n,
        hash: '0xhead5000',
        parentHash: '0xparent5000', 
        timestamp: 1700000000,
      }]);
      
      await provider.handleCron();
      
      expect(logSpy).toHaveBeenCalledWith('[MockChain3] inserted head block 5000');
      
      // Verify block was actually inserted into database
      const headBlock = await evmBlocksService.byNumber(3, 5000);
      expect(headBlock).not.toBeNull();
      expect(headBlock?.hash).toBe('0xhead5000');
      expect(headBlock?.parentHash).toBe('0xparent5000');
    });

    it('should handle multiple chains', async () => {
      // Setup multiple chains with different head numbers
      mockRpc.setupMultiChainScenario([
        { 
          chainId: 4, 
          headNumber: 4000n,
          blocks: [{ number: 4000n, hash: '0xchain4_4000', parentHash: '0xparent4_4000', timestamp: 1700000000 }]
        },
        { 
          chainId: 5, 
          headNumber: 5000n,
          blocks: [{ number: 5000n, hash: '0xchain5_5000', parentHash: '0xparent5_5000', timestamp: 1700000000 }]
        },
        { 
          chainId: 6, 
          headNumber: 6000n,
          blocks: [{ number: 6000n, hash: '0xchain6_6000', parentHash: '0xparent6_6000', timestamp: 1700000000 }]
        }
      ]);
      
      const logSpy = jest.spyOn((provider as any).logger, 'log');
      
      await provider.handleCron();
      
      // Verify all chains were processed
      expect(logSpy).toHaveBeenCalledWith('[MockChain4] inserted head block 4000');
      expect(logSpy).toHaveBeenCalledWith('[MockChain5] inserted head block 5000');
      expect(logSpy).toHaveBeenCalledWith('[MockChain6] inserted head block 6000');
      
      // Verify blocks were inserted
      const block4000 = await evmBlocksService.byNumber(4, 4000);
      const block5000 = await evmBlocksService.byNumber(5, 5000);
      const block6000 = await evmBlocksService.byNumber(6, 6000);
      
      expect(block4000?.hash).toBe('0xchain4_4000');
      expect(block5000?.hash).toBe('0xchain5_5000');
      expect(block6000?.hash).toBe('0xchain6_6000');
    });

    it('should handle RPC errors during head sync', async () => {
      const errorSpy = jest.spyOn((provider as any).logger, 'error');
      
      mockRpc.simulateRpcConnectionFailed(3);
      
      await provider.handleCron();
      
      expect(errorSpy).toHaveBeenCalledWith('[3] RPC connection failed');
    });

    it('should handle block fetch errors during head sync', async () => {
      const errorSpy = jest.spyOn((provider as any).logger, 'error');
      
      mockRpc.setHeadNumber(3, 6000n);
      mockRpc.simulateError('getBlockByNumber', 3, new Error('Block fetch failed'));
      
      await provider.handleCron();
      
      expect(errorSpy).toHaveBeenCalledWith('[3] Block fetch failed');
    });
  });

  describe('Integration Scenarios - Mixed Database States', () => {
    beforeEach(async () => {
      // Setup different scenarios for different chains
      
      // Chain 10: Empty database (no setup needed)
      mockRpc.configureChain(10);
      
      // Chain 11: Contiguous blocks
      const contiguous = createBlockRange(100n, 110n, {
        chainId: 11,
        salt: 'integration-contiguous',
      });
      await evmBlocksService.upsertBlocks(contiguous);
      mockRpc.configureChain(11);
      
      // Chain 12: Blocks with holes
      const withHoles = createBlocksWithHoles([
        { from: 200n, to: 205n },
        { from: 210n, to: 215n },  // Missing 206-209
      ], {
        chainId: 12,
        salt: 'integration-holes',
      });
      await evmBlocksService.upsertBlocks(withHoles);
      mockRpc.configureChain(12);
      
      // Add missing blocks to RPC for chain 12
      const missingBlocks = Array.from({ length: 4 }, (_, i) => ({
        number: BigInt(206 + i),
        hash: `0xintegration_12_${206 + i}`,
        parentHash: `0xparent_12_${206 + i}`,
        timestamp: 1700000000,
      }));
      mockRpc.setBlocks(12, missingBlocks);
    });

    it('should handle mixed database states correctly in scanTipWindows', async () => {
      const logSpy = jest.spyOn((provider as any).logger, 'log');
      const debugSpy = jest.spyOn((provider as any).logger, 'debug');
      
      await provider.scanTipWindows();
      
      // Chain 10: Should skip (empty database)
      expect(debugSpy).toHaveBeenCalledWith('[MockChain10] No blocks in DB yet — skipping');
      
      // Chain 11: Should skip (no missing blocks)  
      expect(debugSpy).toHaveBeenCalledWith('[MockChain11] No missing blocks found');
      
      // Chain 12: Should sync missing blocks
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MockChain12] synced 206, 207, 208, 209')
      );
      
      // Verify missing blocks were actually synced for chain 12
      const block206 = await evmBlocksService.byNumber(12, 206);
      const block209 = await evmBlocksService.byNumber(12, 209);
      expect(block206).not.toBeNull();
      expect(block209).not.toBeNull();
    });

    it('should sync head blocks for all chains in handleCron', async () => {
      const logSpy = jest.spyOn((provider as any).logger, 'log');
      
      // Setup head blocks for each chain
      mockRpc.setHeadNumber(10, 1000n);
      mockRpc.setHeadNumber(11, 1100n);
      mockRpc.setHeadNumber(12, 1200n);
      
      // Add head blocks to RPC
      mockRpc.setBlocks(10, [{ number: 1000n, hash: '0xhead10', parentHash: '0xparent10', timestamp: 1700000000 }]);
      mockRpc.setBlocks(11, [{ number: 1100n, hash: '0xhead11', parentHash: '0xparent11', timestamp: 1700000000 }]);
      mockRpc.setBlocks(12, [{ number: 1200n, hash: '0xhead12', parentHash: '0xparent12', timestamp: 1700000000 }]);
      
      await provider.handleCron();
      
      // All chains should sync head blocks
      expect(logSpy).toHaveBeenCalledWith('[MockChain10] inserted head block 1000');
      expect(logSpy).toHaveBeenCalledWith('[MockChain11] inserted head block 1100');
      expect(logSpy).toHaveBeenCalledWith('[MockChain12] inserted head block 1200');
      
      // Verify head blocks were inserted
      const head10 = await evmBlocksService.byNumber(10, 1000);
      const head11 = await evmBlocksService.byNumber(11, 1100);
      const head12 = await evmBlocksService.byNumber(12, 1200);
      
      expect(head10?.chainId).toBe(10);
      expect(head11?.chainId).toBe(11);
      expect(head12?.chainId).toBe(12);
    });
  });

  describe('Performance and Stress Tests', () => {
    beforeEach(async () => {
      // Setup chain 99 with many holes for performance testing
      const manyHoles = createBlocksWithHoles([
        { from: 3000n, to: 3010n },   // 11 blocks
        { from: 3050n, to: 3060n },   // 11 blocks (missing 3011-3049 = 39 blocks)
        { from: 3100n, to: 3110n },   // 11 blocks (missing 3061-3099 = 39 blocks)
      ], {
        chainId: 99,
        salt: 'performance-test',
      });
      await evmBlocksService.upsertBlocks(manyHoles);
      
      mockRpc.configureChain(99);
      
      // Add all missing blocks to RPC
      const missingBlocks = [
        // Missing range 3011-3049
        ...Array.from({ length: 39 }, (_, i) => ({
          number: BigInt(3011 + i),
          hash: `0xperf_${3011 + i}`,
          parentHash: `0xparent_${3011 + i}`,
          timestamp: 1700000000,
        })),
        // Missing range 3061-3099  
        ...Array.from({ length: 39 }, (_, i) => ({
          number: BigInt(3061 + i),
          hash: `0xperf_${3061 + i}`,
          parentHash: `0xparent_${3061 + i}`,
          timestamp: 1700000000,
        }))
      ];
      mockRpc.setBlocks(99, missingBlocks);
    });

    it('should handle large number of missing blocks efficiently', async () => {
      const logSpy = jest.spyOn((provider as any).logger, 'log');
      
      const startTime = Date.now();
      await provider.scanTipWindows();
      const duration = Date.now() - startTime;
      
      // Should sync missing blocks
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MockChain99] synced 3011')
      );
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds max
      
      // Verify that some missing blocks were actually synced
      const block3011 = await evmBlocksService.byNumber(99, 3011);
      const block3015 = await evmBlocksService.byNumber(99, 3015);
      expect(block3011?.hash).toBe('0xperf_3011');
      expect(block3015?.hash).toBe('0xperf_3015');
      
      console.log(`Performance: Synced ~78 missing blocks in ${duration}ms`);
    });

    it('should handle concurrent operations without conflicts', async () => {
      // Setup fresh chain for concurrency test
      mockRpc.configureChain(98);
      mockRpc.setHeadNumber(98, 4000n);
      mockRpc.setBlocks(98, [{ number: 4000n, hash: '0xconcurrent', parentHash: '0xparent', timestamp: 1700000000 }]);
      
      const concurrentBlocks = createBlockRange(4000n, 4010n, {
        chainId: 98,
        salt: 'concurrent-test',
      });
      await evmBlocksService.upsertBlocks(concurrentBlocks);
      
      // Run both operations concurrently
      const [scanResult, cronResult] = await Promise.allSettled([
        provider.scanTipWindows(),
        provider.handleCron(),
      ]);
      
      // Both should complete successfully
      expect(scanResult.status).toBe('fulfilled');
      expect(cronResult.status).toBe('fulfilled');
    });
  });

  describe('Edge Cases and Error Resilience', () => {
    beforeEach(() => {
      mockRpc.configureChain(50);
    });

    it('should handle empty missing blocks array gracefully', async () => {
      // Setup chain with no missing blocks
      const complete = createBlockRange(5000n, 5010n, {
        chainId: 50,
        salt: 'complete-test',
      });
      await evmBlocksService.upsertBlocks(complete);
      
      const debugSpy = jest.spyOn((provider as any).logger, 'debug');
      
      await provider.scanTipWindows();
      
      expect(debugSpy).toHaveBeenCalledWith('[MockChain50] No missing blocks found');
      // With real service, no need to verify method call count
    });

    it('should handle database constraint violations gracefully', async () => {
      // Setup scenario that might cause duplicate insertions
      mockRpc.setHeadNumber(50, 6000n);
      mockRpc.setBlocks(50, [{
        number: 6000n,
        hash: '0xduplicate6000',
        parentHash: '0xparent6000',
        timestamp: 1700000000,
      }]);
      
      // Insert the same block multiple times (should skip duplicates)
      await provider.handleCron();
      await provider.handleCron();
      
      // Should not throw error due to skipDuplicates: true
      const block = await evmBlocksService.byNumber(50, 6000);
      expect(block).not.toBeNull();
      expect(block?.hash).toBe('0xduplicate6000');
    });
  });
});
