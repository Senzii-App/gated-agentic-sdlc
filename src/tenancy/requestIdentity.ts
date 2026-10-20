/**
 * Per-message identity frame (SPEC-001 §6.2, T-2).
 *
 * The identity middleware sets the frame immediately before dispatching the
 * SDK transport handler; tool handlers read it via requireRequestIdentity().
 * If the frame is absent at tool execution, the call REFUSES — never falls
 * back to a default or a session-stale identity (fail-closed; the exact
 * defect class from PR #1's verified finding).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantContext } from './tenant.js';

export interface RequestIdentityFrame {
  readonly context: TenantContext;
  readonly adapter: 'oauth-jwt' | 'api-key' | 'dev-token';
}

export class IdentityNotBoundError extends Error {}

const als = new AsyncLocalStorage<RequestIdentityFrame>();

export function withRequestIdentity<T>(frame: RequestIdentityFrame, fn: () => Promise<T>): Promise<T> {
  return als.run(frame, fn);
}

/** Tool-handler entrypoint: absent frame → refuse (fail-closed). */
export function requireRequestIdentity(): RequestIdentityFrame {
  const frame = als.getStore();
  if (frame === undefined) {
    throw new IdentityNotBoundError('Unauthenticated: no request identity bound');
  }
  return frame;
}