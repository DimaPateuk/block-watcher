import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { exec as _exec } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(_exec);

export type TestDb = {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  databaseUrl: string;
};

export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('block_watcher_test')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const databaseUrl = container.getConnectionUri();

  process.env.DATABASE_URL = databaseUrl;

  await runMigrations(databaseUrl);

  const pool = new Pool({ connectionString: databaseUrl });

  return { container, pool, databaseUrl };
}

export async function resetDb(db: TestDb): Promise<void> {
  const client = await db.pool.connect();
  try {
    const { rows } = await client.query<{
      tablename: string;
    }>(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('_prisma_migrations')"
    );

    if (rows.length > 0) {
      const tableNames = rows.map((r) => `"${r.tablename}"`).join(', ');
      await client.query(`TRUNCATE ${tableNames} RESTART IDENTITY CASCADE;`);
    }
  } finally {
    client.release();
  }
}

export async function stopTestDb(db: TestDb): Promise<void> {
  await db.pool.end();
  await db.container.stop();
}

async function runMigrations(databaseUrl: string): Promise<void> {
  await exec(`npx prisma migrate deploy`, {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
