/**
 * CredentialAdapter — the single identity seam (SPEC-001 §6.3).
 * Production-parity order: oauth-jwt → api-key → (test-only) dev-token.
 * Every adapter yields TenantClaims; the identity middleware converts them
 * into a minted TenantContext, per message (T-2), fail-closed (§6.2).
 */
import type { TenantClaims } from './claims.js';

export interface CredentialAdapter {
  readonly name: 'oauth-jwt' | 'api-key' | 'dev-token';
  /** Verify a raw bearer credential. Null = this adapter does not accept it. */
  verify(bearer: string): Promise<TenantClaims | null>;
}

export interface AdapterResolution {
  readonly claims: TenantClaims;
  readonly adapter: CredentialAdapter['name'];
}

/** Fail-closed: an adapter error is treated as "no credential" — logged, never escalated to access. */
export async function resolveCredential(
  bearer: string,
  adapters: readonly CredentialAdapter[]
): Promise<AdapterResolution | null> {
  for (const adapter of adapters) {
    try {
      const claims = await adapter.verify(bearer);
      if (claims !== null) {
        return { claims, adapter: adapter.name };
      }
    } catch (error) {
      console.error(`[tenancy] adapter ${adapter.name} failed:`, error);
    }
  }
  return null;
}

/** Marker for unit-red states: thrown explicitly, never swallowed silently. */
export class UnitNotImplemented extends Error {}