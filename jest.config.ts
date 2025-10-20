import type { Config } from 'jest';
import { baseConfig } from './jest.base.config';

const config: Config = {
  ...baseConfig,
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  coverageDirectory: './coverage',
};

export default config;
