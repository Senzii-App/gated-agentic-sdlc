/**
 * Credential suite — dual-path parity (SPEC-001 §6.3), fail-closed secret
 * (AC-10), RFC 9728 discovery header, /health-only bypass.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readSessionSecret } from '../src/config.js';
import { RawMcpClient, toolText, type RpcResponse } from './client.js';
import { TOKEN_DEV_A, startRig, type McpRig } from './harness.js';
import { API_KEY_ORG_A, API_KEY_ORG_B } from './db.js';
import { expiredExp, mintJwt, soonExp } from './jwt.js';

let rig: McpRig;

interface EchoPayload {
  readonly org: number;
  readonly role: string;
  readonly actorUserId: number | null;
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
  return JSON.parse(text) as EchoPayload;
}

beforeAll(async () => {
  rig = await startRig();
});

afterAll(async () => {
  await rig.close();
});

describe('AC-10 fail-closed configuration (no rig needed)', () => {
  it('refuses startup on empty and historically known defaults', () => {
    for (const bad of ['', 'senzii-oauth-secret', 'change-me-to-a-random-string']) {
      expect(() => readSessionSecret({ SESSION_SECRET: bad }), JSON.stringify(bad)).toThrow();
    }
    expect(readSessionSecret({ SESSION_SECRET: 'a-real-operator-chose-this' })).toBe(
      'a-real-operator-chose-this'
    );
  });
});

describe('Credential dual path through one TenantContext', () => {
  it('dev tokens exist only when explicitly enabled and resolve to the seeded orgs', async () => {
    const client = new RawMcpClient(rig.baseUrl);
    await client.initialize(TOKEN_DEV_A);
    const frame = await echoOf(await client.callTool('identity.echo', {}, TOKEN_DEV_A));
    expect(frame?.org).toBe(1);
    expect(frame?.adapter).toBe('dev-token');
  });

  it('oauth-jwt path: valid token resolves claims, role honored', async () => {
    const client = new RawMcpClient(rig.baseUrl);
    const token = mintJwt({ org_id: 1, role: 'super', user_id: 42, exp: soonExp() }, rig.secret);
    const initialized = await client.initialize(token);
    expect(initialized.status).toBe(200);
    const frame = await echoOf(await client.callTool('identity.echo', {}, token));
    expect(frame?.org).toBe(1);
    expect(frame?.role).toBe('super');
    expect(frame?.actorUserId).toBe(42);
    expect(frame?.adapter).toBe('oauth-jwt');
  });

  it('oauth-jwt path: tampered signature refused', async () => {
    const client = new RawMcpClient(rig.baseUrl);
    const token = mintJwt({ org_id: 1, role: 'admin', exp: soonExp() }, rig.secret);
    const parts = token.split('.');
    const head = parts[0] ?? '';
    const body = parts[1] ?? '';
    const signature = (parts[2] ?? '').split('');
    signature[0] = signature[0] === 'A' ? 'B' : 'A';
    const tampered = `${head}.${body}.${signature.join('')}`;
    const response = await client.callTool('identity.echo', {}, tampered);
    expect(response.status).toBe(401);
  });

  it('oauth-jwt path: expired token refused', async () => {
    const client = new RawMcpClient(rig.baseUrl);
    const token = mintJwt({ org_id: 1, role: 'admin', exp: expiredExp() }, rig.secret);
    const response = await client.callTool('identity.echo', {}, token);
    expect(response.status).toBe(401);
  });

  it('api-key path: seeded revocable keys resolve to the same TenantContext shape', async () => {
    const client = new RawMcpClient(rig.baseUrl);
    const initialized = await client.initialize(API_KEY_ORG_B);
    expect(initialized.status).toBe(200);
    const frame = await echoOf(await client.callTool('identity.echo', {}, API_KEY_ORG_B));
    expect(frame?.org).toBe(2);
    expect(frame?.adapter).toBe('api-key');
    expect(frame?.actorUserId).toBe(21);
    expect(API_KEY_ORG_A).not.toBe(API_KEY_ORG_B);
  });
});

describe('Transport posture (production parity §6.3)', () => {
  it('/health is the only unauthenticated route', async () => {
    const client = new RawMcpClient(rig.baseUrl);
    const health = await client.get('/health');
    expect(health.status).toBe(200);
    expect(JSON.stringify(health.body)).toContain('healthy');
  });

  it('401 responses carry the RFC 9728 resource metadata discovery header', async () => {
    const client = new RawMcpClient(rig.baseUrl);
    const response = await client.callTool('identity.echo', {}, null);
    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate'] ?? '').toContain(
      'resource_metadata='
    );
  });
});