/** AC-7.T companion: branded domain IDs are not interchangeable across domains. */
import { describe, expect, expectTypeOf, it } from 'vitest';
import { asOrgId, asStaffId, type OrgId, type StaffId } from '../../src/ids.js';

describe('branded domain IDs are domain-locked (compile-negative)', () => {
  it('StaffId and OrgId are never interchangeable', () => {
    const org: OrgId = asOrgId(1);
    const staff: StaffId = asStaffId(2);
    expectTypeOf(org).not.toMatchTypeOf<StaffId>();
    expectTypeOf(staff).not.toMatchTypeOf<OrgId>();
    // @ts-expect-error domains are never interchangeable (ADR-0001)
    const mixed: StaffId = org;
    expect(mixed).toBeDefined();
  });
});