# SPEC-001 — MCP Server (Milestone 1) — Governing Specification

**v1.1 — re-frozen 2026-10-16 (gate g2, after Delta-01) — Christopher Ochsenreither**
Status: FROZEN for M1 · Scope class: A2/A3 (tenancy & security spine inside)
Delta log: §11 (deltas only via human re-plan; every delta cited here)

## 1. Charter context

Senzii is a staff scheduling platform matching field staff to shifts by skills, proximity, and availability (web dashboard + conversational surface). This spec governs the rebuild of the **MCP server**: the conversational surface through which an external MCP-compatible client (Claude, ChatGPT, any state-bearing client) manages the scheduling workflow by intent — no dashboard navigation, no API integration.

Core claim honored by this spec: **intent is the artifact**; the implementation is a build output, agent-authored under the gates.

## 2. Scope

### 2.1 In scope (tool surface)

| Group | Tools | Behavior summary |
|---|---|---|
| **Matching** | `matching.rank` | Ranked candidates for a shift by certification fit, distance, availability; per-candidate breakdown fields |
| **Shifts** | `shifts.list` | Site-filtered listing, in-org only |
| **Assignments** | `assignments.create` / `.unassign` / delete | Conflict-detecting create; certification-gated create; lands `pending` (§6) |
| **Staff** | `staff.list` / `.detail` / `.create` / `.set_availability` / `.add_certification` / `.archive` | Full staff lifecycle |
| **Requests** | `requests.create` / `.approve` / `.cancel` | Client request → approve → convert to shift; cancel before conversion |
| **Certifications** | `certifications.*` | Org-level types (OSHA 30, forklift, rigging, signal person, …); staff assignment |
| **Metrics** | `get_org_metrics` | Open shifts / pending requests / unassigned staff; coverage-gap health |
| **SQL surface** | `run_sql` | **Not built by default** (§5.4) |
| **Transport** | — | Remote Streamable HTTP (stateful), OAuth 2.1 + PKCE as the protocol contract (§5.3); M1 ships dev credential adapter (§5.3) |

### 2.2 Non-goals (M1)

Autonomous execution agents (confirmation dispatch, call-out fill cascade, proactive coverage outreach) — roadmap, separate spec. The matching engine is the brain; the agent layer is the hands. Dashboard web application (parity via M3, server-rendered). Payment/claims integration. External messaging channels.

## 3. System model

### 3.1 Tenancy & identity (invariants)

- **T-1 (tenant injection):** every database query derives org scope server-side from the verified transport identity. Tool arguments cannot set, widen, or override org scope.
- **T-1.T (type-level):** tenant context is unforgeable outside the identity layer. `TenantContext` is a branded type with a module-private constructor; every repository/service function takes it as its **first parameter**, and tool-argument types structurally cannot contain it. T-1 is a compile-time property; greppable checks are the secondary net.
- **T-2 (per-message identity):** in stateful Streamable HTTP mode, identity is resolved **per message** from the transport-verified request at call time. Session creation-time identity must not bind later calls; a leaked session id must not extend access beyond key revocation.

### 3.2 Architecture

- Runtime: **Node.js 22 LTS**, ESM, strict TypeScript per [ADR-0001](adr/0001-typescript-rebuild.md) (`strict` + full profile; branded opaque domain IDs; discriminated lifecycle unions with exhaustive `switch`/`assertNever`; parse-at-boundary via Zod; `any` banned in CI).
- MCP: **`@modelcontextprotocol/sdk` (v1.32.1)** — Streamable HTTP server transport, stateful sessions (`mcp-session-id`).
- HTTP: **Hono 4.x** (typed routes); templates: **Eta 4.x**, auto-escape on, typed context wrappers (pages land M2+).
- Tests: **Vitest 5** + the SDK's MCP client (in-process or Streamable HTTP) against a simulated two-tenant environment — synthetic data only.
- Credentials: `CredentialAdapter` interface; M1 = dev token adapter (§5.3); OAuth adapter = ADR-0002 candidate.

## 4. Functional requirements

- **F-1** `matching.rank`: candidates ordered by certification fit, distance, availability; response carries per-candidate breakdowns (distance, certifications).
- **F-2** `shifts.list`: site-filtered; in-org only.
- **F-3** `assignments.create`: refuses overlapping assignments (F-3.1); refuses unqualified staff against shift certification requirements (F-3.2); result lands `pending` (§6).
- **F-4** `assignments.unassign`/delete: org-scoped per T-1.
- **F-5** staff lifecycle per §2.1; all writes scoped per T-1.
- **F-6** request lifecycle: create → approve → convert → (any time before conversion) cancel.
- **F-7** certification types org-level; assignment to staff org-scoped.
- **F-8** `get_org_metrics`: counts consistent with store truth.
- **F-9** illustrative transcript (article-published Spring Garden scenario) reproduces end-to-end: coverage-gap question → metrics + lists → proposal → three pending assignments with distance/cert breakdowns → dashboard confirmation.

## 5. Security requirements (the spine)

### 5.1 Tenant injection — invariants T-1 / T-1.T
No MCP-visible argument influences tenant scope; server-side construction of every query from the tenant context passed by the identity layer. **Design requirement carried from the original's incident record:** the production server shipped four tools whose SQL lacked org filters (unassign by id; availability write by `staff_id`; certification add by arbitrary `staff_id`; create with arbitrary `shift_id`/`staff_id`). In this rebuild those classes are **impossible by construction** — the type system (T-1.T) plus the authZ matrix (§9) prove absence before implementation is written.

### 5.2 Per-message identity binding (CWE-862 class)
Requirement from PR #1's verified blocking finding on the production server: identity frozen at session creation allowed org B's valid token, replayed as a leaked `mcp-session-id`, to execute as org A, and key revocation didn't reach an existing session. This rebuild: per-message identity (T-2) on the TS SDK's session semantics — the identity middleware verifies the credential on **every** request and the tool handler resolves it from the request context per call. The binding tests are the evidence regardless of stack: concurrency leak regression and replayed-session negative test (AC-8/9/12). Mechanism detail is an ADR concern; the requirement is stack-independent.

### 5.3 Credentials
- **OAuth 2.1 + PKCE** is the required interop contract for the remote transport (unchanged by Delta-01).
- **M1 ships the `CredentialAdapter` interface** + a dev/bearer token adapter mapping synthetic per-tenant tokens to `TenantContext` — sufficient to make the tenancy spine testable; the production OAuth adapter is a separate unit (ADR-0002 candidate), never bypassing the interface.
- No unauthenticated access path exists in any milestone.

### 5.4 SQL surface
`run_sql` is **absent by default**; if ever introduced: super-role only, strict `READ ONLY` transactions, ADR required, tier A3. This reverses the original's order of operations (shipping first, hardening later) into: spec first, build second — or never.

### 5.5 Tool descriptions are authoritative
`list_tools` output must state actual gating for every tool (the original's tool manifest described `run_sql` as "Admin only" while it was super-gated). Descriptions ship in the same unit as the gating they describe.

## 6. Human-in-the-loop (product rule)

- AI proposes; human approves. MCP-created assignments land **`pending`**; dashboard confirmation (server-rendered page, M2) makes them live (AC-5).
- Autonomous approval is capability-gated **OFF** by default (AC-6). Rationale: assigning an uncertified worker in regulated field service is a liability event, not a bug. The gate is deliberate product design with technical support, not a limitation — and it is the A3 pattern of the operating model applied at the product's riskiest mutation.

## 7. Non-functional requirements

| ID | Requirement |
|---|---|
| N-1 | Session reaping: idle timeout to bound revocation lag (design target: 1800s) |
| N-2 | Audit parity: auth/reset/entity-change events record audit-log entries |
| N-3 | Tool descriptions authoritative (§5.5) |
| N-4 | Fresh-clone boots: `.env.example` (empty values + generation hint); no silent crash on missing env |
| N-5 | Type-strictness in CI: full profile per ADR-0001, `any` banned, typecheck gate green required for merge |

## 8. Acceptance criteria (spec → test traceability)

| AC | Requirement |
|---|---|
| AC-1 | In-org listing (`shifts.list`) |
| AC-2 | Ranked matching with breakdowns |
| AC-3.1 / AC-3.2 | Overlap refusal; certification-gated refusal |
| AC-4 | Org-scoped unassign/delete |
| AC-5 / AC-6 | Pending default; autonomous approval off unless explicitly enabled |
| AC-7 | Tenant injection: authZ matrix across every tool — no argument path widens org scope |
| AC-7.T | **Type-level:** compile-negative test — `TenantContext` unforgeable outside `src/tenancy/` |
| AC-8 / AC-9 | Per-message identity: org-B token on org-A session executes as B; revocation effective on next message |
| AC-10 | Fail-closed behavior on missing/ambiguous credential configuration |
| AC-11 | `run_sql` absent by default (positive/negative checks) |
| AC-12 | Concurrency leak regression: 60 concurrent cross-tenant probes → 0/60 leaks |
| AC-13–15 | Request lifecycle; metric accuracy; audit parity |

## 9. Test catalogue (executable form of this spec — locked red at g3)

- **Type-level suite** — compile-negative assertions for T-1.T (AC-7.T); branded-ID mismatch assertions.
- **Tenant-isolation suite** — authZ matrix across every tool (AC-7); two-tenant simulation harness (TS MCP client).
- **Session-identity suite** — per-message binding; revocation timeliness; replayed-session negative test (AC-8/9); concurrency leak regression (AC-12).
- **Credential suite** — adapter contract; fail-closed configuration (AC-10).
- **Workflow suite** — matching → assignment → pending → dashboard confirm; request lifecycle (AC-1–6, 13).
- **Audit suite** — log record assertions (AC-14/15).
- **Metrics suite** — count-accuracy checks (AC-14).

Deploy gate (per [`docs/GATES.md`](GATES.md)): all suites green on the real runner in the synthetic multi-tenant stack; N-5 typecheck gate green; g4 human merge recorded.

## 10. Open register (design notes, not gaps)

- Progressive exposure of the tool surface (start: metrics + matching + shifts.list reads; write groups follow their units).
- Session reaping default selection (N-1) — ADR-004 candidate.
- M2 persistence layout — ADR-005 candidate (intentionally out of M1 scope).
- **ADR-0002: production OAuth 2.1 + PKCE credential adapter** — candidate; interface already fixed by §5.3.

## 11. Delta log

| Delta | Date | Change | Authority |
|---|---|---|---|
| **Delta-01** | 2026-10-16 | Stack port: Rust/`rmcp` + Python client harness → TypeScript/Node (strict profile; `@modelcontextprotocol/sdk` 1.32.1; Hono; Eta SSR pages; Vitest + TS client harness); credential-adapter split (OAuth contract retained; M1 dev adapter); type-level tenancy added (T-1.T, AC-7.T); SSR pages dated M2 (+M2.5 audit/role flows). Reason: [ADR-0001](adr/0001-typescript-rebuild.md) — human decision (@ochsec). v1.0 → v1.1. | human re-plan (g2 re-freeze) |

> This spec freezes at g2 for the duration of its units of work; deltas require human re-plan per [`AGENTS.md`](../AGENTS.md) and are recorded in §11 only.