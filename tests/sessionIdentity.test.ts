/**
 * Session-identity suite — T-2 (per-message binding) plus ADR-0003's
 * fail-closed rules. The PR #1 defect class is the reference defect:
 * initialize-time identity must never outlive its message.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sha256hex } from './db.js';
import { RawMcpClient, toolText, type RpcResponse } from './client.js';
import { TOKEN_DEV_A, TOKEN_DEV_B, startRig, type McpRig } from './harness.js';

let rig: McpRig;

interface EchoPayload {
  readonly org: number;
  readonly role: string;
  readonly adapter: string;
}

function echoOf(response: RpcResponse): EchoPayload | null {
  if (response.status !== 200) {
    return null;
  }
  const text = toolText(response);
  if (text === undefined) {
    return null;
  }
  try {
    return JSON.parse(text) as EchoPayload;
  } catch {
    return null;
  }
}

beforeAll(async () => {
  rig = await startRig();
});

afterAll(async () => {
  await rig.close();
});

describe('T-2 per-message identity binding', () => {
  it('a valid org-B token on an org-A session executes as org B — never as A', async () => {
    const client = new RawMcpClient(rig.baseUrl);
    const initialized = await client.initialize(TOKEN_DEV_A);
    expect(initialized.status).toBe(200);
    expect(client.currentSessionId()).toBeDefined();

    const cross = await echoOf(await client.callTool('identity.echo', {}, TOKEN_DEV_B));
    expect(cross).not.toBeNull();
    expect(cross?.org).toBe(2);
    expect(cross?.org).not.toBe(1);
  });

  it('absent identity on an active session → 401 + discovery header, never a default', async () => {
    const client = new RawMcpClient(rig.baseUrl);
    await client.initialize(TOKEN_DEV_A);
    const response = await client.callTool('identity.echo', {}, '');
    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate'] ?? '').toContain('resource_metadata=');
  });

  it('credential revocation takes effect on the very next message (api-key path)', async () => {
    const client = new RawMcpClient(rig.baseUrl);
    const admin = await rig.admin();
    try {
      const probeKey = 'revocation-probe-key';
      await admin.query(
        'INSERT INTO api_keys (key_hash, user_id, organization_id) VALUES ($1, 31, 1)',
        [sha256hex(probeKey)]
      );

      const initialized = await client.initialize(probeKey);
      expect(initialized.status).toBe(200);
      const before = await echoOf(await client.callTool('identity.echo', {}, probeKey));
      expect(before?.org).toBe(1);

      await admin.query(
        'UPDATE api_keys SET revoked_at = now() WHERE key_hash = $1',
        [sha256hex(probeKey)]
      );

      const after = await echoOf(await client.callTool('identity.echo', {}, probeKey));
      expect(after).toBeNull();
    } finally {
      await admin.end();
    }
  });

  it('AC-12: 60 interleaved calls across sessions → zero cross-tenant leaks', async () => {
    const clients: RawMcpClient[] = [];
    for (let i = 0; i < 5; i++) {
      const client = new RawMcpClient(rig.baseUrl);
      const initializingToken = i % 2 === 0 ? TOKEN_DEV_A : TOKEN_DEV_B;
      const initialized = await client.initialize(initializingToken);
      expect(initialized.status, `session ${i}`).toBe(200);
      clients.push(client);
    }

    const calls = clients.flatMap((client, index) => {
      const token = index % 2 === 0 ? TOKEN_DEV_A : TOKEN_DEV_B;
      return [{ client, token, expectedOrg: token === TOKEN_DEV_A ? 1 : 2 }];
    });
    const echoed = await Promise.all(
      calls.map(async ({ client, token, expectedOrg }) => ({
        frame: await echoOf(await client.callTool('identity.echo', {}, token)),
        expectedOrg
      }))
    );
    expect(echoed).toHaveLength(60);
    expect(echoed.filter((entry) => entry.frame === null)).toHaveLength(0);
    expect(echoed.filter((entry) => entry.frame?.org === entry.expectedOrg)).toHaveLength(60);
  });
});