import type { TestDb } from './setupTests.e2e';

declare global {
  // eslint-disable-next-line no-var
  var __TEST_DB__: TestDb | undefined;
}
export {};
