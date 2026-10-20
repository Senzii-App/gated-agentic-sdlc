/**
 * Credential adapters — production-parity implementations (SPEC-001 §6.3).
 * Order: oauth-jwt → api-key → (test-only) dev-token. All three resolve to
 * the same TenantClaims shape so the credential suite can prove parity
 * through one TenantContext. Fail-closed: any adapter error is "no
 * credential" (logged), never access.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { TenantClaimsSchema, type TenantClaims } from '../claims.js';
import type { CredentialAdapter } from '../adapter.js';

export interface AdapterChainConfig {
  readonly sessionSecret: string;
  readonly databaseUrl: string;
}

// ── oauth-jwt ─────────────────────────────────────────────────────────────────
// Production parity (verify side only; issuance = ADR-0002): HMAC-SHA256 over
// "header.payload" with SESSION_SECRET, base64url, exp in seconds, org_id
// required, role ∈ {admin, super} (no silent widening — ADR-0001).

export function oauthJwtAdapter(sessionSecret: string): CredentialAdapter {
  return {
    name: 'oauth-jwt',
    async verify(bearer: string): Promise<TenantClaims | null> {
      const parts = bearer.split('.');
      if (parts.length !== 3) {
        return null;
      }
      const head = parts[0] ?? '';
      const payload = parts[1] ?? '';
      const signature = parts[2] ?? '';

      const expected = createHmac('sha256', sessionSecret)
        .update(head + '.' + payload)
        .digest('base64url');
      const headBytes = Buffer.from(expected, 'utf8');
      const givenBytes = Buffer.from(signature, 'utf8');
      if (
        headBytes.length !== givenBytes.length ||
        !timingSafeEqual(headBytes, givenBytes)
      ) {
        return null;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      } catch {
        return null;
      }
      const claims = TenantClaimsSchema.safeParse(parsed);
      if (!claims.success) {
        return null;
      }

      const exp = (parsed as Record<string, unknown>)['exp'];
      if (typeof exp !== 'number' || Number.isNaN(exp) || Date.now() / 1000 > exp) {
        return null;
      }
      return claims.data;
    }
  };
}

// ── api-key ───────────────────────────────────────────────────────────────────
// Production parity (api_keys.py): SHA-256 hash lookup, revocable, last-use tracked.

interface ApiKeyPoolHolder {
  pool: Pool | null;
}

const poolHolder: ApiKeyPoolHolder = { 'pool': null };

export function apiKeyAdapter(databaseUrl: string): CredentialAdapter {
  return {
    name: 'api-key',
    async verify(bearer: string): Promise<TenantClaims | null> {
      if (databaseUrl === '') {
        return null;
      }
      if (poolHolder.pool === null) {
        poolHolder.pool = new Pool({ connectionString: databaseUrl, max: 5 });
      }
      const pool = poolHolder.pool;
      const keyHash = createHash('sha256').update(bearer).digest('hex');
      const result = await pool.query<{ 'user_id': number; 'organization_id': number }>(
        'SELECT user_id, organization_id FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL',
        [keyHash]
      );
      const record = result.rows[0];
      if (record === undefined) {
        return null;
      }
      await pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1', [keyHash]);
      return TenantClaimsSchema.parse({
        org_id: record.organization_id,
        role: 'admin',
        'entity_id': null,
        'user_id': record.user_id
      });
    }
  };
}

// ── dev-token (test environments only) ───────────────────────────────────────
// Synthetic tenant fixtures; the chain only includes it when the operator
// (or the test rig) explicitly set ALLOW_DEV_CREDENTIALS=1.

const DEV_TOKENS: ReadonlyMap<string, () => TenantClaims> = new Map([
  ['dev-org-a', () => TenantClaimsSchema.parse({ org_id: 1, role: 'admin', entity_id: null, user_id: 11 })],
  ['dev-org-b', () => TenantClaimsSchema.parse({ org_id: 2, role: 'admin', entity_id: null, user_id: 21 })]
]);

export function devTokenAdapter(): CredentialAdapter {
  return {
    name: 'dev-token',
    async verify(bearer: string): Promise<TenantClaims | null> {
      const mint = DEV_TOKENS.get(bearer);
      return mint === undefined ? null : mint();
    }
  };
}

// ── chain assembly + disposal ────────────────────────────────────────────────

export function buildAdapters(
  config: AdapterChainConfig,
  opts: { allowDevCredentials: boolean }
): CredentialAdapter[] {
  const chain: CredentialAdapter[] = [
    oauthJwtAdapter(config.sessionSecret),
    apiKeyAdapter(config.databaseUrl)
  ];
  if (opts.allowDevCredentials) {
    chain.push(devTokenAdapter());
  }
  return chain;
}

/** Server lifecycle: release database connections before the rig stops Postgres. */
export async function disposeAdapters(): Promise<void> {
  if (poolHolder.pool !== null) {
    const pool = poolHolder.pool;
    poolHolder.pool = null;
    await pool.end();
  }
}

/** Exposed for M2+ units that share the same pool (unused in unit-01). */
export function sharedPool(): Pool | PoolClient | null {
  return poolHolder.pool;
}