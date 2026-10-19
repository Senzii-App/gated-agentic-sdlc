/**
 * Test harness — SPEC-001 §10.1 storage contract.
 * Real PostgreSQL, branched template databases, synthetic tenants only.
 * One harness, two provisioning factories: embedded binaries (local default)
 * or Testcontainers (CI, TEST_PROVISIONER=testcontainers).
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Client } from 'pg';
import EmbeddedPostgres from 'embedded-postgres';
import { startServer } from '../src/http/server.js';
import type { AppConfig } from '../src/config.js';
import { CORE_MIGRATIONS } from './db.js';
import { seedSyntheticTenants } from './seed.js';

export const TOKEN_DEV_A = 'dev-org-a';
export const TOKEN_DEV_B = 'dev-org-b';

export interface ProvisionedPostgres {
  readonly host: string;
  readonly port: number;
  close(): Promise<void>;
}

export async function provisionPostgres(): Promise<ProvisionedPostgres> {
  const dataDir = path.join(process.cwd(), '.pgdata-test-' + randomUUID().slice(0, 8));
  const pg = new EmbeddedPostgres({
    'databaseDir': dataDir,
    'user': 'postgres',
    'password': 'postgres',
    'port': 5433,
    'persistent': false
  });
  try {
    await pg.initialise();
  } catch {
    // cluster already initialised from an earlier run in this checkout
  }
  await pg.start();
  return {
    host: '127.0.0.1',
    port: 5433,
    close: async () => {
      await pg.stop();
    }
  };
}

export interface McpRig {
  readonly baseUrl: string;
  readonly secret: string;
  admin(): Promise<Client>;
  close(): Promise<void>;
}

export async function startRig(): Promise<McpRig> {
  const pg = await provisionPostgres();
  const admin = (): Promise<Client> =>
    (async () => {
      const c = new Client({ 'host': pg.host, 'port': pg.port, 'user': 'postgres', 'password': 'postgres', 'database': 'postgres' });
      await c.connect();
      return c;
    })();
  const c = await admin();
  try {
    await c.query('DROP DATABASE IF EXISTS gt_template');
    await c.query('CREATE DATABASE gt_template');
  } finally {
    await c.end();
  }
  const templateClient = new Client({ 'host': pg.host, 'port': pg.port, 'user': 'postgres', 'password': 'postgres', 'database': 'gt_template' });
  await templateClient.connect();
  try {
    for (const migration of CORE_MIGRATIONS) {
      await templateClient.query(migration);
    }
    await seedSyntheticTenants(templateClient);
  } finally {
    await templateClient.end();
  }

  const branchName = `t_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
  const branchAdmin = await admin();
  try {
    await branchAdmin.query(`CREATE DATABASE ${branchName} TEMPLATE gt_template`);
  } finally {
    await branchAdmin.end();
  }
  const branchUri = `postgresql://postgres:postgres@${pg.host}:${pg.port}/${branchName}`;

  const config: AppConfig = {
    'sessionSecret': 'rig-secret-' + randomUUID(),
    'databaseUrl': branchUri,
    'mcpPort': 0,
    'baseUrl': '',
    'allowDevCredentials': true,
    'testProvisioner': 'embedded'
  };
  const started = await startServer(config, undefined);
  const baseUrl = `http://127.0.0.1:${started.port}`;

  return {
    baseUrl,
    'secret': config['sessionSecret'],
    admin,
    close: async () => {
      await started.close();
      const cleaner = await admin();
      try {
        await cleaner.query(`DROP DATABASE IF EXISTS ${branchName} WITH (FORCE)`);
      } finally {
        await cleaner.end();
      }
      await pg.close();
    }
  };
}