import { Test, TestingModule } from '@nestjs/testing';
import { EvmBlocksService } from './evm-blocks.service';
import { PrismaService } from '../prisma/prisma.service';
import { RPC_SERVICE } from '../rpc/rpc.types';
import { 
  createBlocks, 
  createBlocksWithHoles, 
  createBlockRange,
  getExpectedLatest,
  getMissingNumbers 
} from '../../test/utils/block-gen';
import { MockRpcService, toRpcMockBlock } from '../../test/utils/rpc-mock';

describe('EvmBlocksService E2E', () => {
  let service: EvmBlocksService;
  let prisma: PrismaService;
  let module: TestingModule;
  let mockRpc: MockRpcService;

  beforeAll(async () => {
    mockRpc = new MockRpcService();
    
    module = await Test.createTestingModule({
      providers: [
        EvmBlocksService,
        PrismaService,
        {
          provide: RPC_SERVICE,
          useValue: mockRpc,
        },
      ],
    }).compile();

    service = module.get<EvmBlocksService>(EvmBlocksService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await module.close();
  });


  describe('getLatest', () => {
    it('should return null when database is empty', async () => {
      const latest = await service.getLatest(1);
      expect(latest).toBeNull();
    });

    const blockCounts = [10, 100, 1000];
    
    for (let i = 0; i < blockCounts.length; i++) {
      const count = blockCounts[i];
      const startNumber = 1000n + BigInt(i * 2000);
      
      it(`should return latest block for chainId with ${count} blocks`, async () => {
        // Generate deterministic blocks for this test
        const testBlocks = createBlocks(count, {
          chainId: 1,
          startNumber,
          salt: `test-iteration-${count}`,
        });
        
        // Insert blocks into database
        const insertResult = await service.upsertBlocks(testBlocks);
        expect(insertResult.count).toBe(count);
        
        // Get expected latest block from generator
        const expectedLatest = getExpectedLatest(testBlocks);
        expect(expectedLatest).not.toBeNull();
        
        // Test the getLatest method
        const latest = await service.getLatest(1);
        expect(latest).toMatchObject({
          chainId: expectedLatest!.chainId,
          number: expectedLatest!.number,
          hash: expectedLatest!.hash,
          parentHash: expectedLatest!.parentHash,
          timestamp: expectedLatest!.timestamp,
        });
        
        console.log(`✅ Tested getLatest with ${count} blocks - latest block number: ${latest?.number} (range: ${startNumber} to ${startNumber + BigInt(count - 1)})`);
      });
    }
  });

  describe('byNumber', () => {
    beforeEach(async () => {
      // Setup test data for byNumber tests (use beforeEach to ensure fresh data each test)
      const testBlocks = createBlockRange(5000n, 5010n, {
        chainId: 1,
        salt: 'byNumber-test',
      });
      await service.upsertBlocks(testBlocks);
    });

    it('should return specific block by number', async () => {
      const block = await service.byNumber(1, 5005);
      expect(block).not.toBeNull();
      expect(block?.chainId).toBe(1);
      expect(block?.number).toBe(5005n);
    });

    it('should return null for non-existent block', async () => {
      const block = await service.byNumber(1, 9999);
      expect(block).toBeNull();
    });

    it('should return null for different chainId', async () => {
      const block = await service.byNumber(2, 5005);
      expect(block).toBeNull();
    });
  });

  describe('upsertBlocks', () => {
    it('should insert new blocks', async () => {
      const testBlocks = createBlocks(5, {
        chainId: 2,
        startNumber: 6000n,
        salt: 'upsert-new',
      });
      
      const result = await service.upsertBlocks(testBlocks);
      expect(result.count).toBe(5);
    });

    it('should skip duplicate blocks', async () => {
      const testBlocks = createBlocks(3, {
        chainId: 2,
        startNumber: 7000n,
        salt: 'upsert-dup',
      });
      
      // First insert
      const result1 = await service.upsertBlocks(testBlocks);
      expect(result1.count).toBe(3);
      
      // Second insert (duplicates)
      const result2 = await service.upsertBlocks(testBlocks);
      expect(result2.count).toBe(0);
    });

    it('should handle empty array', async () => {
      const result = await service.upsertBlocks([]);
      expect(result.count).toBe(0);
    });

    it('should handle mixed new and duplicate blocks', async () => {
      const blocks1 = createBlocks(3, {
        chainId: 2,
        startNumber: 8000n,
        salt: 'mixed-1',
      }); // Creates blocks 8000, 8001, 8002
      
      const blocks2 = createBlocks(5, {
        chainId: 2,
        startNumber: 8001n, // Overlaps with 2 blocks from first set (8001, 8002)
        salt: 'mixed-1', // Same salt to ensure same hashes
      }); // Creates blocks 8001, 8002, 8003, 8004, 8005
      
      // Insert first set (3 blocks: 8000, 8001, 8002)
      const result1 = await service.upsertBlocks(blocks1);
      expect(result1.count).toBe(3);
      
      // Insert overlapping set - should only add the 3 new blocks (8003, 8004, 8005)
      const result = await service.upsertBlocks(blocks2);
      expect(result.count).toBe(3); // Only 8003, 8004, 8005 are new
    });
  });

  describe('Database with holes', () => {
    beforeEach(async () => {
      // Create blocks with holes: 10000-10005, 10010-10015, 10020-10025
      const blocksWithHoles = createBlocksWithHoles([
        { from: 10000n, to: 10005n },
        { from: 10010n, to: 10015n },
        { from: 10020n, to: 10025n },
      ], {
        chainId: 3,
        salt: 'holes-test',
      });
      
      await service.upsertBlocks(blocksWithHoles);
    });

    it('should find missing blocks in range', async () => {
      const missing = await service.findMissingFullRange(3);
      
      // Should find gaps: 10006-10009 and 10016-10019
      const expectedMissing = [
        10006n, 10007n, 10008n, 10009n,
        10016n, 10017n, 10018n, 10019n,
      ];
      
      expect(missing.length).toBeGreaterThan(0);
      expectedMissing.slice(0, 10).forEach(num => {
        expect(missing).toContain(num);
      });
    });

    it('should return empty array when no blocks exist', async () => {
      const missing = await service.findMissingFullRange(999);
      expect(missing).toEqual([]);
    });
  });


  describe('Performance Tests', () => {
    it('should handle large dataset efficiently', async () => {
      const largeDataset = createBlocks(5000, {
        chainId: 5,
        startNumber: 30000n,
        salt: 'perf-test',
      });
      
      const startTime = Date.now();
      await service.upsertBlocks(largeDataset);
      const insertTime = Date.now() - startTime;
      
      const queryStartTime = Date.now();
      const latest = await service.getLatest(5);
      const queryTime = Date.now() - queryStartTime;
      
      expect(latest?.number).toBe(34999n);
      expect(insertTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(queryTime).toBeLessThan(100);   // Query should be very fast
      
      console.log(`Performance: ${largeDataset.length} blocks inserted in ${insertTime}ms, queried in ${queryTime}ms`);
    });
  });
});
