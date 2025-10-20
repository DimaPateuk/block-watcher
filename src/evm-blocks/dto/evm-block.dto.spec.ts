import { EvmBlock } from '@prisma/client';
import { toEvmBlockDto, EvmBlockDto } from './evm-block.dto';

describe('EvmBlockDto', () => {
  describe('toEvmBlockDto', () => {
    it('should convert EvmBlock to EvmBlockDto', () => {
      const mockEvmBlock: EvmBlock = {
        id: BigInt('1'),
        chainId: 1,
        number: BigInt('19000000'),
        hash: '0xabcdef123456789',
        parentHash: '0x123456789abcdef',
        timestamp: BigInt('1728339200'),
      };

      const result = toEvmBlockDto(mockEvmBlock);

      expect(result).toEqual({
        number: '19000000',
        hash: '0xabcdef123456789',
        parentHash: '0x123456789abcdef',
        timestamp: '1728339200',
      });
    });

    it('should convert BigInt values to strings correctly', () => {
      const mockEvmBlock: EvmBlock = {
        id: BigInt('999'),
        chainId: 137,
        number: BigInt('999999999999999999'),
        hash: '0x1234567890abcdef',
        parentHash: '0xfedcba0987654321',
        timestamp: BigInt('9999999999'),
      };

      const result = toEvmBlockDto(mockEvmBlock);

      expect(result.number).toBe('999999999999999999');
      expect(result.timestamp).toBe('9999999999');
      expect(typeof result.number).toBe('string');
      expect(typeof result.timestamp).toBe('string');
    });

    it('should handle zero values', () => {
      const mockEvmBlock: EvmBlock = {
        id: BigInt('0'),
        chainId: 1,
        number: BigInt('0'),
        hash: '0x0000000000000000',
        parentHash: '0x0000000000000000',
        timestamp: BigInt('0'),
      };

      const result = toEvmBlockDto(mockEvmBlock);

      expect(result).toEqual({
        number: '0',
        hash: '0x0000000000000000',
        parentHash: '0x0000000000000000',
        timestamp: '0',
      });
    });

    it('should preserve string fields unchanged', () => {
      const mockEvmBlock: EvmBlock = {
        id: BigInt('42'),
        chainId: 1,
        number: BigInt('12345'),
        hash: '0xSpecialHash123',
        parentHash: '0xParentHash456',
        timestamp: BigInt('987654321'),
      };

      const result = toEvmBlockDto(mockEvmBlock);

      expect(result.hash).toBe('0xSpecialHash123');
      expect(result.parentHash).toBe('0xParentHash456');
    });

    it('should return correct type structure', () => {
      const mockEvmBlock: EvmBlock = {
        id: BigInt('1'),
        chainId: 1,
        number: BigInt('1'),
        hash: '0x1',
        parentHash: '0x0',
        timestamp: BigInt('1'),
      };

      const result = toEvmBlockDto(mockEvmBlock);

      // Check that result matches EvmBlockDto interface
      expect(result).toHaveProperty('number');
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('parentHash');
      expect(result).toHaveProperty('timestamp');
      
      // Ensure no extra properties
      expect(Object.keys(result)).toEqual(['number', 'hash', 'parentHash', 'timestamp']);
    });

    it('should handle very large BigInt numbers', () => {
      const mockEvmBlock: EvmBlock = {
        id: BigInt('1'),
        chainId: 1,
        number: BigInt('18446744073709551615'), // Max uint64
        hash: '0xmax',
        parentHash: '0xmaxparent',
        timestamp: BigInt('253402300799'), // Year 9999 timestamp
      };

      const result = toEvmBlockDto(mockEvmBlock);

      expect(result.number).toBe('18446744073709551615');
      expect(result.timestamp).toBe('253402300799');
    });
  });
});
