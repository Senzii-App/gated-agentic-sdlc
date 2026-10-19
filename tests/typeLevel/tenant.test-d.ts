/** AC-7.T: TenantContext is unforgeable outside src/tenancy/ (compile-negative). */
import { expectTypeOf } from 'vitest';
import { asOrgId } from '../../src/ids.js';
import { mintTenantContext, type TenantContext } from '../../src/tenancy/tenant.js';

// The honest mint path typechecks.
const honest = mintTenantContext({
  org: asOrgId(1),
  role: 'admin',
  actorUserId: null,
  entityId: null
});

expectTypeOf(honest).toMatchTypeOf<TenantContext>();

// Forge attempt: a structurally-complete plain object must NOT satisfy
// TenantContext — the private brand symbol is not in the literal.
interface Forged {
  org: number;
  role: 'admin' | 'super';
  actorUserId: number | null;
  entityId: number | null;
}
const plain: Forged = { org: 1, role: 'admin', actorUserId: null, entityId: null };
// @ts-expect-error T-1.T: TenantContext cannot be forged without the brand symbol
const forged: TenantContext = plain;
export const __touched = { honest, forged } as const;
export type KeepAlive = TenantContext;