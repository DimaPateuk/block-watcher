import type { Config } from 'jest';
import { baseConfig } from '../jest.base.config';

const config: Config = {
  ...baseConfig,
  setupFilesAfterEnv: ['<rootDir>/test/setup-global.ts'],
  rootDir: '..',
  testRegex: '.*\\.e2e-spec\\.ts$',
  coverageDirectory: './coverage-e2e',
  testTimeout: 120000, // 2 minutes for container startup
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1, // Run tests sequentially to avoid container conflicts
};

export default config;
