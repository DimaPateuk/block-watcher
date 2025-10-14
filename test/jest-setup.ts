// Jest setup for e2e tests
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for Node.js globals that may be missing
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

// Mock File constructor if not available
if (typeof (global as any).File === 'undefined') {
  (global as any).File = class File {
    name: string;
    type: string;
    lastModified: number;

    constructor(bits: any, name: string, options: { type?: string; lastModified?: number } = {}) {
      this.name = name;
      this.type = options.type || '';
      this.lastModified = options.lastModified || Date.now();
    }
  };
}
