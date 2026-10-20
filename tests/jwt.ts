/** Test-side JWT minting — verify-only in src (ADR-0002 keeps issuance separate). */
import { createHmac } from 'node:crypto';

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export interface MintClaims {
  readonly org_id: number;
  readonly role?: 'admin' | 'super';
  readonly entity_id?: number | null;
  readonly user_id?: number | null;
  readonly exp: number;
}

export function mintJwt(claims: MintClaims, secret: string): string {
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const payload = b64urlJson(claims);
  const signature = createHmac('sha256', secret)
    .update(header + '.' + payload)
    .digest('base64url');
  return header + '.' + payload + '.' + signature;
}

export const soonExp = (): number => Math.floor(Date.now() / 1000) + 600;
export const expiredExp = (): number => Math.floor(Date.now() / 1000) - 5;