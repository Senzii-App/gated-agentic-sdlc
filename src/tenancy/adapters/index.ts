/**
 * Credential adapters — unit/m1-tenancy-core RED state (ADR-0003 §rollout).
 *
 * Red: every adapter is an explicit, throw-everything stub. The identity
 * middleware treats a failed/unavailable adapter as "no credential" → the
 * server is honestly fail-closed at this commit: NOTHING authenticates.
 * The green commit lands the real implementations and the suites go green.
 */
import type { CredentialAdapter } from '../adapter.js';
import { UnitNotImplemented } from '../adapter.js';

export interface AdapterChainConfig {
  readonly sessionSecret: string;
  readonly databaseUrl: string;
}

export function oauthJwtAdapter(_sessionSecret: string): CredentialAdapter {
  return {
    name: 'oauth-jwt',
    verify: async () => {
      throw new UnitNotImplemented('unit/m1-tenancy-core (red): oauth-jwt adapter not implemented');
    }
  };
}

export function apiKeyAdapter(_databaseUrl: string): CredentialAdapter {
  return {
    name: 'api-key',
    verify: async () => {
      throw new UnitNotImplemented('unit/m1-tenancy-core (red): api-key adapter not implemented');
    }
  };
}

export function devTokenAdapter(): CredentialAdapter {
  return {
    name: 'dev-token',
    verify: async () => {
      throw new UnitNotImplemented('unit/m1-tenancy-core (red): dev-token adapter not implemented');
    }
  };
}

/** Production-parity order: oauth-jwt → api-key → (test-only) dev-token. */
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

/** Red state: nothing owns a pool yet; green commit wires disposal here. */
export async function disposeAdapters(): Promise<void> {
  return Promise.resolve();
}