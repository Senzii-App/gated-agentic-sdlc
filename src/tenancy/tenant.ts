/**
 * TenantContext — the unforgeable tenant/actor scope (SPEC-001 §4.1 T-1.T).
 *
 * The brand symbol is module-private: code outside src/tenancy/ cannot
 * construct an object satisfying this interface. The compile-negative suite
 * (AC-7.T) locks that property; the CI greps (I2) lock minting confinement.
 */
import type { OrgId } from '../ids.js';
import type { McpRole } from './claims.js';

const tenantBrand: unique symbol = Symbol('tenant-context');

export interface TenantContext {
  readonly [tenantBrand]: 'tenant-context';
  readonly org: OrgId;
  readonly role: McpRole;
  readonly actorUserId: number | null;
  readonly entityId: number | null;
}

export interface TenantContextInput {
  readonly org: OrgId;
  readonly role: McpRole;
  readonly actorUserId: number | null;
  readonly entityId: number | null;
}

/** Mint TenantContext — confined to src/tenancy/ (CI invariant I2). */
export function mintTenantContext(input: TenantContextInput): TenantContext {
  return {
    [tenantBrand]: 'tenant-context',
    org: input.org,
    role: input.role,
    actorUserId: input.actorUserId,
    entityId: input.entityId
  };
}

/** Type-guard for defense in depth (never used as a substitute for T-1.T). */
export function isTenantContext(value: unknown): value is TenantContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    tenantBrand in value &&
    (value as { [tenantBrand]: unknown })[tenantBrand] === 'tenant-context'
  );
}