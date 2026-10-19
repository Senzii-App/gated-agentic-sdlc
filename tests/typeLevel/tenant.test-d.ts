/** AC-7.T: TenantContext is unforgeable outside src/tenancy/ (compile-negative). */
import { describe, expect, expectTypeOf, it } from 'vitest';
import { asOrgId } from '../../src/ids.js';
import { mintTenantContext, type TenantContext } from '../../src/tenancy/tenant.js';

describe('T-1.T — TenantContext is unforgeable (compile-negative)', () => {
  it('the mint path typechecks; a brand-less plain object does not', () => {
    const honest = mintTenantContext({
      org: asOrgId(1),
      role: 'admin',
      'actorUserId': null,
      'entityId': null
    });
    expectTypeOf(honest).toMatchTypeOf<TenantContext>();

    interface Forged {
      org: number;
      role: 'admin' | 'super';
      actorUserId: number | null;
      entityId: number | null;
    }
    const plain: Forged = { org: 1, role: 'admin', 'actorUserId': null, 'entityId': null };
    // @ts-expect-error T-1.T: TenantContext cannot be forged without the private brand symbol
    const forged: TenantContext = plain;
    expect(forged).toBeDefined();
    expect(honest.org).toBe(1);
  });
});