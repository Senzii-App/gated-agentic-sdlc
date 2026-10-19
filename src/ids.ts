/**
 * Branded opaque domain identifiers (ADR-0001).
 *
 * Rule: IDs of different domains are never interchangeable or confusable.
 * The brand symbols are module-private — no other module can fabricate the
 * brand key, and the compile-negative suite (AC-7.T / ids test) proves it.
 */

declare const orgBrand: unique symbol;
declare const staffBrand: unique symbol;
declare const shiftBrand: unique symbol;
declare const assignmentBrand: unique symbol;
declare const certificationBrand: unique symbol;
declare const clientBrand: unique symbol;
declare const workSiteBrand: unique symbol;
declare const requestBrand: unique symbol;

export type OrgId = number & { readonly [orgBrand]: 'OrgId' };
export type StaffId = number & { readonly [staffBrand]: 'StaffId' };
export type ShiftId = number & { readonly [shiftBrand]: 'ShiftId' };
export type AssignmentId = number & { readonly [assignmentBrand]: 'AssignmentId' };
export type CertificationId = number & { readonly [certificationBrand]: 'CertificationId' };
export type ClientId = number & { readonly [clientBrand]: 'ClientId' };
export type WorkSiteId = number & { readonly [workSiteBrand]: 'WorkSiteId' };
export type RequestId = number & { readonly [requestBrand]: 'RequestId' };

export const asOrgId = (n: number): OrgId => n as OrgId;
export const asStaffId = (n: number): StaffId => n as StaffId;
export const asShiftId = (n: number): ShiftId => n as ShiftId;
export const asAssignmentId = (n: number): AssignmentId => n as AssignmentId;
export const asCertificationId = (n: number): CertificationId => n as CertificationId;
export const asClientId = (n: number): ClientId => n as ClientId;
export const asWorkSiteId = (n: number): WorkSiteId => n as WorkSiteId;
export const asRequestId = (n: number): RequestId => n as RequestId;