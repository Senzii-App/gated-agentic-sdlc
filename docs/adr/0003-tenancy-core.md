# ADR-0003 — Tenancy core: per-message identity binding (unit/m1-tenancy-core)

**Status:** Implemented (design ADR for the unit) — 2026-10-19
**Tier:** A3-design / human-gated (GATES.md) — **g4: awaiting human review by @ochsec**
**Spec:** SPEC-001 v1.2 (T-1 / T-1.T / T-2; §6.1–6.3; §10.1 storage contract)

## Context

The MCP transport carries stateful sessions (`mcp-session-id`). Production's incident record (PR #1 + follow-ups, landed 2026-10-06) proved two things: identity must resolve **per message**, never at session creation; and absence of identity must **refuse**, never default. The unit must make both properties hold on the TypeScript SDK's session semantics — and be *provable* by the locked suites, not assumed.

## Decision

1. **Identity middleware per request.** Every request to `/mcp` resolves its Bearer credential through the adapter chain **at that request**, mints a `TenantContext`, and dispatches the SDK's `transport.handleRequest` inside an **AsyncLocalStorage frame carrying that identity**. Tool handlers read the frame via `requireRequestIdentity()`; **absent frame or absent identity → hard refusal** (never a default identity, never a cached identity past its message).
2. **Adapter chain, production-parity order.** `oauth-jwt` (HMAC-SHA256 `SESSION_SECRET`-signed claims, `exp` enforced, `org_id` required) → `api-key` (SHA-256 hash lookup, revocable, last-use tracked) → `dev-token` (**test environments only** — enabled only when `ALLOW_DEV_CREDENTIALS=1`; synthetic tenants A/B). All adapters return the same `TenantClaims`, so the credential suite can prove behavioral parity through one `TenantContext`.
3. **One low-level `Server` per session, registry shared.** The SDK's stateful pattern: a session map of `{server, transport}` pairs; `onsessioninitialized` registers; a POST with an unknown/expired session id is rejected (400) per the SDK contract. Handlers are per-message (§6.2 mechanism above); session lifetime is bounded later by N-1 reaping (separate unit).
4. **The type layer is part of the design, not decoration.** `TenantContext` is branded with a module-private symbol — unforgeable outside `src/tenancy/` (T-1.T, AC-7.T compile-negative tests). Every future repository/service function takes it as the first parameter; tool-argument zones structurally exclude org scope.
5. **The identity surface is observable.** A diagnostic tool `identity.echo` returns the resolved identity frame. It is **excluded from `list_tools`** (low-level handler emits exactly the 28 manifest tools), so AC-22 manifest parity stays exact while the session-identity suite gains a non-lying oracle.
6. **Fail-closed configuration.** `SESSION_SECRET` refuses startup when empty or a historically known default (`""`, `senzii-oauth-secret`, `change-me-to-a-random-string`) — production behavior, carried verbatim, now with a CI-checkable surface.
7. **401 carries the RFC 9728 discovery header; only `/health` is unauthenticated** — production parity (§6.3), asserted by the credential suite.

## The T-2 mechanism, honestly stated

The AsyncLocalStorage frame is set in the same request lifecycle as `transport.handleRequest`. This assumes the SDK processes the message **within** that lifecycle (the standalone-integration path). The session-identity suite is the referee, with three designed outcomes:

- **Tests green** — mechanism holds; done.
- **Tests red with "identity not bound" refusals** — the SDK defers tool execution outside the request lifecycle; fallback (documented, pre-agreed): per-message verification moves into a per-session latest-verified store, keyed by `mcp-session-id`, rewritten by the middleware on **every** request before dispatch, PLUS the suite's replay and revocation cases re-run — the store is a per-message *cache*, never a session-creation freeze, which is the exact defect class from PR #1; if even that fails semantics, the fallback escalates to a custom transport subclass.
- **Tests red with cross-tenant leakage** — immediate STOP (A3 escalation to the human).

**Alternative rejected:** stateless-per-request transports (`sessionIdGenerator: undefined`) — they sidestep sessions entirely and cannot exercise AC-8/9's replay semantics, which are the point of the unit.

## Rollout (this branch)

1. **Red commit (g3 lock):** ADR + type layer (ids, tenant, claims, adapter interface, request-identity storage, fail-closed config, manifest registry verbatim from production, server wiring) + adapters as explicit `UnitNotImplemented` stubs + ALL suites. Runtime suites fail red by design (fail-closed 401 on every credential — nothing is implemented); type-level + manifest-parity suites pass.
2. **Green commit:** adapter implementations (jwt/api-key/dev-token) + pg pool wiring + seeded branched template databases → all suites green.

### g3 lock addendum — lock revised at green (2026-10-19)

- AC-12 hardened to the spec's 60 interleaved alternating-token calls (red commit had 5 same-token calls); revocation fixture corrected to seed into the branch DB (red commit seeded into the `postgres` admin DB).
- Both `typeLevel/*.test-d.ts` files restructured; no assertion weakened — all changes moved toward SPEC-001 v1.2. The locked suite is the green commit's, not `77beedd`'s file-for-file.

## Consequences

- The authZ matrix generates from the registry (28 tools today); each later unit that lands handlers extends the matrix's landed-section — suite files stay immutable within the unit; growth is additive.
- `identity.echo` never appears in `list_tools`; the parity suite asserts exclusion.
- The unit ends at a PR; **g4 is the human's merge** (@ochsec), with this ADR as the security-review surface.