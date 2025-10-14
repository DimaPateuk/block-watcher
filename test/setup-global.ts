// Runs once per Jest worker and sets up hooks for ALL e2e tests
import { startTestDb, resetDb, stopTestDb, TestDb } from './setupTests.e2e';

declare global {
  // handy if you ever need access in a spec
  // (optional – you can omit if you never use it)
  // eslint-disable-next-line no-var
  var __TEST_DB__: TestDb | undefined;
}

let db: TestDb;

beforeAll(async () => {
  db = await startTestDb();
  global.__TEST_DB__ = db; // optional
});

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await stopTestDb(db);
  global.__TEST_DB__ = undefined;
});
