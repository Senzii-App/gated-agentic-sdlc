/**
 * Test harness — SPEC-001 §10.1 storage contract.
 * Real PostgreSQL, branched template databases, synthetic tenants only.
 * One harness, two provisioning factories: embedded binaries (local default)
 * or Testcontainers (CI, TEST_PROVISIONER=testcontainers) — the factory is
 * selected by the provisioner, never hardcoded.
 */
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Client } from 'pg';
import EmbeddedPostgres from 'embedded-postgres';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { startServer } from '../src/http/server.js';
import type { AppConfig } from '../src/config.js';
import { CORE_MIGRATIONS } from './db.js';
import { seedSyntheticTenants } from './seed.js';

export const TOKEN_DEV_A = 'dev-org-a';
export const TOKEN_DEV_B = 'dev-org-b';

export interface ProvisionedPostgres {
  readonly host: string;
  readonly port: number;
  /** Real password-auth credentials — both factories honor these. */
  readonly username: string;
  readonly password: string;
  close(): Promise<void>;
}

/** The pinned engine for both factories (§10.1: engine version pinned). */
const PINNED_PG_VERSION = 'postgres:18.4';

function readProvisioner(): 'embedded' | 'testcontainers' {
  return process.env['TEST_PROVISIONER'] === 'testcontainers' ? 'testcontainers' : 'embedded';
}

/** Factory 1: embedded-Postgres binaries (local default, zero daemon). */
async function provisionEmbedded(): Promise<ProvisionedPostgres> {
  // Pick a free port at bind time so parallel suites can never collide.
  const net = await import('node:net');
  const freePort: number = await new Promise((resolvePort, rejectPort) => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = address !== null && typeof address === 'object' ? address.port : 5433;
      probe.close(() => resolvePort(port));
    });
    probe.on('error', rejectPort);
  });
  const dataDir = path.join(process.cwd(), '.pgdata-test-' + randomUUID().slice(0, 8));
  const pg = new EmbeddedPostgres({
    'databaseDir': dataDir,
    'user': 'postgres',
    'password': 'postgres',
    'port': freePort,
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
    port: freePort,
    username: 'postgres',
    password: 'postgres',
    close: async () => {
      await pg.stop();
    }
  };
}

/** Factory 2: Testcontainers with the pinned engine (CI, Docker present). */
async function provisionTestcontainers(): Promise<ProvisionedPostgres> {
  const password = 'rig-' + randomUUID().replaceAll('-', '');
  const container: StartedTestContainer = await new GenericContainer(PINNED_PG_VERSION)
    .withExposedPorts(5432)
    .withEnvironment({
      'POSTGRES_USER': 'postgres',
      'POSTGRES_PASSWORD': password
    })
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  return {
    host: container.getHost(),
    port: container.getMappedPort(5432),
    username: 'postgres',
    password,
    close: async () => {
      await container.stop();
    }
  };
}

export async function provisionPostgres(): Promise<ProvisionedPostgres> {
  return readProvisioner() === 'testcontainers' ? provisionTestcontainers() : provisionEmbedded();
}

export interface McpRig {
  readonly baseUrl: string;
  readonly secret: string;
  admin(): Promise<Client>;
  /** A client connected to the rig's branch database (test data plane). */
  db(): Promise<Client>;
  close(): Promise<void>;
}

export async function startRig(): Promise<McpRig> {
  const pg = await provisionPostgres();
  const admin = (): Promise<Client> =>
    (async () => {
      const c = new Client({ 'host': pg.host, 'port': pg.port, 'user': pg.username, 'password': pg.password, 'database': 'postgres' });
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
  const templateClient = new Client({ 'host': pg.host, 'port': pg.port, 'user': pg.username, 'password': pg.password, 'database': 'gt_template' });
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
  const branchUri = `postgresql://${pg.username}:${encodeURIComponent(pg.password)}@${pg.host}:${pg.port}/${branchName}`;

  const config: AppConfig = {
    'sessionSecret': 'rig-secret-' + randomUUID(),
    'databaseUrl': branchUri,
    'mcpPort': 0,
    'baseUrl': '',
    'allowDevCredentials': true,
    'testProvisioner': readProvisioner()
  };
  const started = await startServer(config, undefined);
  const baseUrl = `http://127.0.0.1:${started.port}`;

  const dataClient = (): Promise<Client> =>
    (async () => {
      const c = new Client({ 'connectionString': branchUri });
      await c.connect();
      return c;
    })();

  return {
    baseUrl,
    'secret': config['sessionSecret'],
    admin,
    db: dataClient,
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