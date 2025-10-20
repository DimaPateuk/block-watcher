import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import { EvmBlocksController } from './evm-blocks.controller';
import { EvmBlocksService } from './evm-blocks.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { createBlocks } from '../../test/utils/block-gen';

describe('EvmBlocksController E2E', () => {
  let app: INestApplication;
  let controller: EvmBlocksController;
  let service: EvmBlocksService;
  let prisma: PrismaService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      controllers: [EvmBlocksController],
      providers: [
        EvmBlocksService,
        PrismaService,
        {
          provide: MetricsService,
          useValue: {
            recordDbQuery: jest.fn(),
            updateConnectionPool: jest.fn(),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    controller = module.get<EvmBlocksController>(EvmBlocksController);
    service = module.get<EvmBlocksService>(EvmBlocksService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
    await module.close();
  });

  describe('GET /evm/blocks/health', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/evm/blocks/health')
        .expect(200);

      expect(response.body).toEqual({ ok: true });
    });
  });

  describe('GET /evm/blocks/:chainId/latest', () => {
    it('should return latest block for existing chain', async () => {
      // Create test blocks using utility
      const blocks = createBlocks(5, { 
        startNumber: BigInt(19000000), 
        chainId: 1 
      });
      
      await service.upsertBlocks(blocks);

      const response = await request(app.getHttpServer())
        .get('/evm/blocks/1/latest')
        .expect(200);

      expect(response.body).toMatchObject({
        number: '19000004', // Latest block (0-based, so 4 is the last)
        hash: expect.stringMatching(/^0x[a-f0-9]{64}$/),
        parentHash: expect.stringMatching(/^0x[a-f0-9]{64}$/),
        timestamp: expect.stringMatching(/^\d+$/),
      });
    });

    it('should return error for non-existent chain', async () => {
      const response = await request(app.getHttpServer())
        .get('/evm/blocks/999/latest')
        .expect(200);

      expect(response.body).toEqual({ error: 'Not found' });
    });

    it('should handle invalid chainId parameter', async () => {
      await request(app.getHttpServer())
        .get('/evm/blocks/invalid/latest')
        .expect(400);
    });

    it('should return latest among multiple blocks', async () => {
      // Create blocks with different numbers
      const earlierBlocks = createBlocks(3, { 
        startNumber: BigInt(1000), 
        chainId: 1 
      });
      
      const laterBlocks = createBlocks(2, { 
        startNumber: BigInt(2000), 
        chainId: 1 
      });

      await service.upsertBlocks([...earlierBlocks, ...laterBlocks]);

      const response = await request(app.getHttpServer())
        .get('/evm/blocks/1/latest')
        .expect(200);

      expect(response.body.number).toBe('2001'); // Latest block
    });
  });

  describe('GET /evm/blocks/:chainId/:number', () => {
    beforeEach(async () => {
      // Set up test data
      const blocks = createBlocks(10, { 
        startNumber: BigInt(19000000), 
        chainId: 1 
      });
      
      await service.upsertBlocks(blocks);
    });

    it('should return specific block by number', async () => {
      const response = await request(app.getHttpServer())
        .get('/evm/blocks/1/19000005')
        .expect(200);

      expect(response.body).toMatchObject({
        number: '19000005',
        hash: expect.stringMatching(/^0x[a-f0-9]{64}$/),
        parentHash: expect.stringMatching(/^0x[a-f0-9]{64}$/),
        timestamp: expect.stringMatching(/^\d+$/),
      });
    });

    it('should return error for non-existent block number', async () => {
      const response = await request(app.getHttpServer())
        .get('/evm/blocks/1/99999999')
        .expect(200);

      expect(response.body).toEqual({ error: 'Not found' });
    });

    it('should return error for non-existent chain', async () => {
      const response = await request(app.getHttpServer())
        .get('/evm/blocks/999/19000005')
        .expect(200);

      expect(response.body).toEqual({ error: 'Not found' });
    });

    it('should handle invalid parameters', async () => {
      await request(app.getHttpServer())
        .get('/evm/blocks/invalid/19000005')
        .expect(400);

      await request(app.getHttpServer())
        .get('/evm/blocks/1/invalid')
        .expect(400);
    });

    it('should return genesis block (number 0)', async () => {
      // Create genesis block
      const genesisBlocks = createBlocks(1, { 
        startNumber: BigInt(0), 
        chainId: 1 
      });
      
      await service.upsertBlocks(genesisBlocks);

      const response = await request(app.getHttpServer())
        .get('/evm/blocks/1/0')
        .expect(200);

      expect(response.body.number).toBe('0');
    });

    it('should handle very large block numbers', async () => {
      // Create a block with large number
      const largeBlocks = createBlocks(1, { 
        startNumber: BigInt('999999999999999'), 
        chainId: 1 
      });
      
      await service.upsertBlocks(largeBlocks);

      const response = await request(app.getHttpServer())
        .get('/evm/blocks/1/999999999999999')
        .expect(200);

      expect(response.body.number).toBe('999999999999999');
    });
  });

  describe('Multiple chains', () => {
    it('should handle different chains independently', async () => {
      // Create blocks for different chains
      const ethBlocks = createBlocks(3, { 
        startNumber: BigInt(19000000), 
        chainId: 1 
      });
      
      const polygonBlocks = createBlocks(3, { 
        startNumber: BigInt(50000000), 
        chainId: 137 
      });

      await service.upsertBlocks([...ethBlocks, ...polygonBlocks]);

      // Test Ethereum latest
      const ethResponse = await request(app.getHttpServer())
        .get('/evm/blocks/1/latest')
        .expect(200);
      expect(ethResponse.body.number).toBe('19000002');

      // Test Polygon latest
      const polygonResponse = await request(app.getHttpServer())
        .get('/evm/blocks/137/latest')
        .expect(200);
      expect(polygonResponse.body.number).toBe('50000002');

      // Test specific blocks
      await request(app.getHttpServer())
        .get('/evm/blocks/1/19000001')
        .expect(200);

      await request(app.getHttpServer())
        .get('/evm/blocks/137/50000001')
        .expect(200);

      // Cross-chain queries should fail
      const crossChainResponse = await request(app.getHttpServer())
        .get('/evm/blocks/1/50000001')
        .expect(200);
      expect(crossChainResponse.body).toEqual({ error: 'Not found' });
    });
  });

  describe('Controller direct method calls', () => {
    it('should work with controller methods directly', async () => {
      const blocks = createBlocks(5, { 
        startNumber: BigInt(1), 
        chainId: 1 
      });
      
      await service.upsertBlocks(blocks);

      // Test health method
      const health = controller.getHealth();
      expect(health).toEqual({ ok: true });

      // Test latest method
      const latest = await controller.latest(1);
      expect(latest).toHaveProperty('number', '5');

      // Test byNumber method
      const specific = await controller.byNumber(1, 3);
      expect(specific).toHaveProperty('number', '3');

      // Test not found cases
      const notFound1 = await controller.latest(999);
      expect(notFound1).toEqual({ error: 'Not found' });

      const notFound2 = await controller.byNumber(1, 999);
      expect(notFound2).toEqual({ error: 'Not found' });
    });
  });
});
