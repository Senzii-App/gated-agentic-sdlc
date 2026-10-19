# ADR-0001 — Rebuild in TypeScript / Node.js rather than the original's stack

**Status:** Accepted — 2026-10-16 (decision: human, @ochsec)
**Companion delta:** SPEC-001 v1.1 (Delta-01)
**Tier:** charter-level (affects every unit that follows)

## Context

The original Senzii MCP server runs on Rust with `rmcp` v1.8. The rebuild experiment's central claim — *agent-authored implementation, zero hand-written code, spec as the artifact* — must choose its implementation language before the first unit of work lands.

Options considered:

- **A. Same-stack mirror** (Rust + `rmcp`): maximal apples-to-apples parity with production.
- **B. TypeScript / Node.js port** (this decision): different language from the original, max practical typing, server-rendered templates.

## Decision

**Option B.** The rebuild is TypeScript on Node.js 22 LTS (ESM), strictest practical typing (ADR §Typing profile), MCP over the official TypeScript SDK (`@modelcontextprotocol/sdk`), typed-routed HTTP (Hono), and server-side rendered templates (Eta) for all app pages — no client framework.

## Rationale

1. **Portability proof.** Rebuilding in a *different* language than the original is the stronger form of the demo: the spec is the only bridge between the two codebases, so whatever transfers, transfers by intent — not by code reuse. "Same app, different language, same spec" proves the artifact claim harder than a mirror does.
2. **Typing as governance.** TS is the stack where the tenancy invariant can become a *compile-time* property rather than a linted convention: an unforgeable `TenantContext` (branded, constructor module-private) that every repository/service function takes as its first parameter cannot be fabricated from tool arguments — T-1 holds at the type boundary, which is E3 implemented in the language itself.
3. **SDK parity.** The official TS MCP SDK (v1.32.1) natively supports the Streamable HTTP transport with stateful sessions (`mcp-session-id`), so the security-critical semantics (per-message identity binding; revocation timeliness) are testable against the same protocol surface as production.
4. **Typed SSR pages.** Requirement: app pages render server-side from templates. Eta with auto-escape on, invoked through typed context wrappers, satisfies "render templates + maximum typing" without adopting a client framework.
5. **Ecosystem currency.** Hono 4.x, Eta 4.x, Vitest 5, Zod at the boundary — current, maintained, small dependency surface.

## Typing profile (enforced in CI)

- `tsconfig`: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `isolatedModules`, `moduleDetection: "force"`, `noEmit` (typecheck gate separately from build).
- Domain primitives are **branded opaque types** (`OrgId`, `StaffId`, `ShiftId`, `AssignmentId`, `CertificationId`): IDs of different domains are never interchangeable.
- All mutable domain states are **discriminated unions** (assignment lifecycle, request lifecycle) with exhaustive `switch` + `assertNever`; no open-ended string states.
- **Parse, don't validate:** every external input passes schema validation at the boundary; the interior deals only in validated, branded types.
- `any` is banned (`@typescript-eslint/no-explicit-any: error`); `unknown` + narrowing is the pattern.
- Type-level negative tests (compile-fail assertions) are part of the test catalogue where invariants are type-expressible.

## Consequences

- The production PR #1 verification mechanisms were proven on the Rust/`rmcp` + Python client stack; on the TS stack, **the same tests remain the binding evidence** (concurrency leak regression, replayed-session negative test), re-targeted to the TS harness — spec §5.2's mechanism note updated accordingly.
- OAuth 2.1 + PKCE remains the required interop contract; M1 ships the **`CredentialAdapter` interface with a dev token adapter** so the tenancy spine is testable now, with the OAuth adapter as its own ADR (ADR-0002 candidate) — no unauthenticated path exists, ever.
- App pages (M2+) are server-rendered Eta templates with typed contexts; no client-side framework.

## Alternatives rejected

- **A (same-stack mirror):** rejected — parity is achievable but it weakens the demo (codebase knowledge from the original could carry the build) and forfeits the compile-time tenancy design.
- **Denormalized/looser TS config:** rejected — a demo about governed agent-authored code that tolerates `any` is self-refuting.