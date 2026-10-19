# SPEC-001 — MCP Server (Milestone 1) — Governing Specification

**v1.2 — re-frozen 2026-10-19 (gate g2, after Delta-03) — Christopher Ochsenreither**
Status: FROZEN for M1 · Scope class: A2/A3 (tenancy & security spine inside)
Delta log: §12 (deltas only via human re-plan; every delta cited here)

## 1. Charter context

Senzii is a staff scheduling platform matching field staff to shifts by skills, proximity, and availability (web dashboard + conversational surface). This spec governs the rebuild of the **MCP server**: the conversational surface through which an external MCP-compatible client (Claude, ChatGPT, any state-bearing client) manages the scheduling workflow by intent — no dashboard navigation, no API integration.

Core claim honored by this spec: **intent is the artifact**; the implementation is a build output, agent-authored under the gates.

## 2. Coverage boundary

**SPEC-001 governs the MCP program: transport identity (who is calling, which org, which role), the complete registered tool surface, and the tool-level security invariants.**

It does **not** govern:

- **The OAuth authorization-server implementation** (token issuance endpoints, PKCE flows) — the interop contract stays here (§6.3); the AS is ADR-0002's unit. Production-parity for *verification* is §6.3's dual path.
- **Dashboard user authentication** (web login/password reset flows) — separate spec at its milestone (M2.5), under the same loop.
- **Magic-link redemption semantics** (the web flow consuming the generated link) — here the MCP tools are governed as *issuance* only (§6.7); redemption belongs to the web-app spec.
- **Domain persistence design** (M2, ADR-005 candidate).

## 3. Scope

### 3.1 In scope — complete registered tool surface (28 tools, manifest parity)

Verified against the production manifest (`mcp_server/tools/tools.toml`, 349 lines; names + descriptions audited 2026-10-19; cross-checked against `server.py` docstring and the contract-E2E history):

| Group | Tools (exact production names) | Behavior + gating notes |
|---|---|---|
| **Staff** | `list_staff` (`get_staff`) · `create_staff` · `delete_staff` · `add_staff_certification` · `set_staff_availability` | `delete_staff` = soft archive, **blocks if staff has upcoming confirmed assignments**; `set_staff_availability` **replaces** all existing availability; `create_staff` accepts optional certifications (valid names via `list_certifications`) |
| **Clients** | `list_clients` · `create_client` | Clients = the companies that request staff |
| **Shifts** | `list_shifts` · `delete_shift` · `find_candidates` | Site-filtered; `delete_shift` = soft delete, **blocks if the shift has confirmed assignments**; `find_candidates` = the matching engine (weights §5 F-1) |
| **Assignments** | `list_assignments` · `create_assignment` · `unassign_assignment` | create → **pending** (§7); unassign deletes the assignment row |
| **Staffing requests** | `list_staffing_requests` · `create_staffing_request` · `convert_staffing_request` · `cancel_staffing_request` | Status open/filled/cancelled; **no MCP "approve" tool** — acceptance happens web-side; `convert` = accepted request → scheduled shift; `cancel` after acceptance deletes the linked shift and unassigns |
| **Work sites** | `list_work_sites` · `create_work_site` | Locations where shifts happen |
| **Certifications** | `list_certifications` · `create_certification` (idempotent) · `update_certification` · `delete_certification` | **Delete cascades** off all staff holding it — destructive, org-level |
| **Identity issuance** | `send_staff_magic_link` · `send_client_magic_link` | Generate + return a login link. **Identity-issuance surface** — §6.7, the highest bar in this spec |
| **Metrics** | `get_org_metrics` | Open shifts, pending requests, unassigned staff, recent confirmed assignments; coverage-gap health |
| **SQL** | `run_sql` | **Absent by default in this rebuild** (§6.4) |

Manifest-parity rule: the rebuild's tool registry is driven by the same manifest-driven pattern production uses, and §6.5 keeps descriptions authoritative from it. (Production itself already runs this pattern across two implementations — Rust and the Python port served at `mcp.senzii.com` — with a contract-E2E alignment pass; the rebuild inherits the pattern and hardens it.)

### 3.2 Non-goals (M1)

Autonomous execution agents (confirmation dispatch, call-out fill cascade, proactive coverage outreach) — roadmap, separate spec. Dashboard web application (parity via M3, server-rendered). Payment/claims integration. External messaging channels. Coverage boundaries per §2.

## 4. System model

### 4.1 Tenancy & identity (invariants)

- **T-1 (tenant injection):** every database query derives org scope server-side from the verified transport identity. Tool arguments cannot set, widen, or override org scope.
- **T-1.T (type-level):** tenant context is unforgeable outside the identity layer. `TenantContext` is a branded type with a module-private constructor; every repository/service function takes it as its **first parameter**, and tool-argument types structurally cannot contain it. T-1 is a compile-time property; greppable checks are the secondary net.
- **T-2 (per-message identity):** in stateful Streamable HTTP mode, identity is resolved **per message** from the transport-verified request at call time. Session creation-time identity must not bind later calls; a leaked session id must not extend access beyond key revocation. Production's landed fix (follow-up to PR #1) codifies this with fail-closed refusal — "Unauthenticated: no request identity bound" — when identity is absent; the rebuild keeps fail-closed refusal and adds the compile-time layer.

### 4.2 Architecture

- Runtime: **Node.js 22 LTS**, ESM, strict TypeScript per [ADR-0001](adr/0001-typescript-rebuild.md) (`strict` + full profile; branded opaque domain IDs; discriminated lifecycle unions with exhaustive `switch`/`assertNever`; parse-at-boundary via Zod; `any` banned in CI).
- MCP: **`@modelcontextprotocol/sdk` (v1.32.1)** — Streamable HTTP server transport, stateful sessions (`mcp-session-id`).
- HTTP: **Hono 4.x** (typed routes); templates: **Eta 4.x**, auto-escape on, typed context wrappers (pages land M2+).
- Tests: **Vitest 5** + the SDK's MCP client (in-process or Streamable HTTP) against a simulated two-tenant environment — synthetic data only.
- Credentials: `CredentialAdapter` interface; M1 = dev token adapter (§6.3); OAuth adapter = ADR-0002 candidate.

## 5. Functional requirements

- **F-1** `find_candidates`: staff scored with documented weights — **skills match 40%, proximity 30%, availability 30%** — each carrying per-candidate breakdowns (distance, certification match); ranked ordering per score.
- **F-2** `list_shifts`: work-site-filtered; in-org only.
- **F-3** `create_assignment`: refuses overlapping assignments (F-3.1); refuses unqualified staff against shift certification requirements (F-3.2); result lands **pending** (§7).
- **F-4** `unassign_assignment` / `delete_shift` / `delete_staff`: org-scoped per T-1; soft-delete semantics with their **blocking conditions** honored exactly as listed in §3.1 (F-4.1).
- **F-5** staff, client, work-site, certification lifecycles per §3.1, all writes scoped per T-1; certification delete cascade applies; `create_certification` idempotent.
- **F-6** request lifecycle: `create` (open) → web-side acceptance → `convert` (accepted request → shift; created assignments pending per §7) → `cancel`: already-accepted cancels delete the linked shift and unassign.
- **F-7** magic-link senders per §6.7.
- **F-8** `get_org_metrics`: counts consistent with store truth (open shifts, pending requests, unassigned staff, recent confirmed assignments).
- **F-9** illustrative transcript (article-published Spring Garden scenario) reproduces end-to-end: coverage-gap question → metrics + lists → proposal → three pending assignments with distance/cert breakdowns → dashboard confirmation.
- **F-10** response shapes maintain contract parity with the production tool contract (N-6), so both implementations diff behaviorally.

## 6. Security requirements (the spine — production-parity where stated)

### 6.1 Tenant injection — invariants T-1 / T-1.T
No MCP-visible argument influences tenant scope; server-side construction of every query from the tenant context passed by the identity layer. **Incident record (closed upstream):** the production server shipped four tools whose SQL lacked org filters (`unassign_assignment`; `set_staff_availability`; `add_staff_certification`; `create_assignment`) — fixed at code level 2026-10-06 (follow-up commits to PR #1). In this rebuild those classes are **impossible by construction** — the type system (T-1.T) plus the authZ matrix (§10) prove absence before implementation is written.

### 6.2 Per-message identity binding (CWE-862 class)
Requirement from PR #1's verified blocking finding: identity frozen at session creation allowed org B's valid token, replayed as a leaked `mcp-session-id`, to execute as org A, and key revocation didn't reach an existing session. Production's fix (request-scope identity + fail-closed refusal) landed 2026-10-06. This rebuild: per-message identity (T-2) on the TS SDK's session semantics — the identity middleware verifies the credential on **every** request; the tool handler resolves it from the request context per call; **absent identity → refuse, never fall back to a default identity**. The binding tests are the evidence regardless of stack: concurrency leak regression and replayed-session negative test (AC-8/9/12).

### 6.3 Credentials (production-parity dual path)
- **Verified production reality** (`server.py`, `api_keys.py`, `config.py` audited 2026-10-19): Bearer `Authorization` with **two accepted credential classes**, both resolving through the identity middleware to the same per-request state (`org_id`, `role`, `entity_id`, `user_id`):
  1. **OAuth JWT** — HMAC-SHA256 signed with `SESSION_SECRET`; claims `org_id` (required), `role` (default `admin`), `entity_id`, `user_id`; `exp` enforced.
  2. **API keys** — SHA-256-hashed lookup, **revocable**, last-use tracked.
- **Fail-closed `SESSION_SECRET`**: empty or historically known defaults → hard startup refusal with operator guidance. Rebuild keeps this verbatim as a requirement.
- 401 responses carry the RFC 9728 `WWW-Authenticate: Bearer resource_metadata=…` discovery header; **the only unauthenticated route is the health check `/health`** (infra necessity, explicitly allow-listed).
- OAuth 2.1 + PKCE and the OAuth AS remain the target interop contract (issuance side); the AS unit is ADR-0002's.
- **M1 ships the `CredentialAdapter` interface** + a dev/bearer token adapter mapping synthetic per-tenant tokens to `TenantContext` — the same interface production's dual path plugs into. No unauthenticated access path exists in any milestone.

### 6.4 SQL surface
`run_sql` is **absent by default**; if ever introduced: super-role only (platform operators), strict `READ ONLY` (SELECT only), ADR required, tier A3 — mirroring the manifest's gating, not the docstring's label (§6.5).

### 6.5 Tool descriptions are authoritative (single source of truth)
`list_tools` output must state actual gating for every tool. **Audit finding (same class in production today):** the manifest restricts `run_sql` to the `super` role, while the server source docstring still says "admin only, SELECT only." The rebuild's rule: **descriptions are manifest-generated and may not be contradicted by comments or docstrings**; CI checks the tool registry against the manifest.

### 6.6 Roles (MCP scope)
MCP-side roles: `admin` (default claim) and `super` (platform operators; `run_sql` only). Entity/user levels exist in claims, but MCP tool gating derives from role + T-1 org enforcement. Dashboard-side per-role authZ (admin/staff/client users) is **out of scope** (§2 boundary, M2.5).

### 6.7 Identity-issuance surface (magic links) — the highest bar in this spec
`send_staff_magic_link` / `send_client_magic_link` **mint login credentials**. In the rebuild:
- in-org restriction via T-1 (a caller may issue only for its own org's staff/clients) — the authZ matrix covers these as issuance paths;
- **audit-logged on issuance**; token non-guessable; link content excluded from logs and analytics;
- issuance is deterministic-human-review territory (**A3**) — E3 enforcement (locked tests, runner-verified green);
- redemption semantics (expiry, single-use) govern the **web app's** auth flow and are explicitly out of this spec's scope (§2); this spec requires only that issuance is honest, scoped, and auditable.

## 7. Human-in-the-loop (product rule)

- AI proposes; human approves. MCP-created assignments land **`pending`**; dashboard confirmation (server-rendered page, M2) makes them live (AC-5).
- Autonomous approval is capability-gated **OFF** by default (AC-6). Rationale: assigning an uncertified worker in regulated field service is a liability event, not a bug. The gate is deliberate product design with technical support, not a limitation — and it is the A3 pattern of the operating model applied at the product's riskiest mutation.

## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| N-1 | Session reaping: idle timeout to bound revocation lag (design target: 1800s) |
| N-2 | Audit parity: auth/reset/entity-change events record audit-log entries; issuance events (§6.7) audit-logged |
| N-3 | Tool descriptions authoritative, manifest-generated (§6.5); no comment/docstring contradictions |
| N-4 | Fresh-clone boots: `.env.example` (empty values + generation hint); no silent crash on missing env |
| N-5 | Type-strictness in CI: full profile per ADR-0001, `any` banned, typecheck gate green required for merge |
| N-6 | Response-shape contract parity with the production tool contract — the two implementations diff behaviorally |

## 9. Acceptance criteria (spec → test traceability)

| AC | Requirement |
|---|---|
| AC-1 | In-org listing (`list_shifts`) |
| AC-2 | Ranked matching with breakdowns (`find_candidates`) |
| AC-3.1 / AC-3.2 | Overlap refusal; certification-gated refusal |
| AC-4 | Org-scoped unassign / soft-deletes (with AC-19) |
| AC-5 / AC-6 | Pending default; autonomous approval off unless explicitly enabled |
| AC-7 | Tenant injection: authZ matrix across **all 28 registered tools** — no argument path widens org scope |
| AC-7.T | **Type-level:** compile-negative test — `TenantContext` unforgeable outside `src/tenancy/` |
| AC-8 / AC-9 | Per-message identity: org-B token on org-A session executes as B; revocation effective on next message; absent identity refuses (never defaults) |
| AC-10 | Fail-closed startup on secret absence (historical defaults rejected) |
| AC-11 | `run_sql` absent by default (positive/negative checks) |
| AC-12 | Concurrency leak regression: 60 concurrent cross-tenant probes → 0/60 leaks |
| AC-16 | Work-site + client lifecycles (list/create), in-org only |
| AC-17 | Certification lifecycle incl. idempotent create + delete cascade |
| AC-18 | Magic links: in-org issuance only; audit-logged; non-guessable; link contents never logged |
| AC-19 | Soft-delete blocking conditions (upcoming confirmed assignments / confirmed-assignment shift) |
| AC-20 | Matching weights honored: skills 40% / proximity 30% / availability 30%, with breakdown fields |
| AC-21 | Credential dual path through one `CredentialAdapter` → same `TenantContext`; 401 carries RFC 9728 discovery header; only `/health` unauthenticated |
| AC-22 | Manifest parity: rebuild registry enumerates the same 28 tools with manifest-derived descriptions (§6.5) |
| AC-13–15 | Request lifecycle (no MCP approve step); metric accuracy; audit parity |

## 10. Test catalogue (executable form of this spec — locked red at g3)

- **Type-level suite** — compile-negative assertions for T-1.T (AC-7.T); branded-ID mismatch assertions.
- **Manifest-parity suite** — registry enumeration vs. production manifest: 28 tools, exact names, descriptions-as-gating (AC-22, §6.5).
- **Tenant-isolation suite** — authZ matrix across every registered tool, incl. issuance paths (AC-7, AC-18); two-tenant simulation harness (TS MCP client).
- **Session-identity suite** — per-message binding; revocation timeliness; replayed-session negative test (AC-8/9); concurrency leak regression (AC-12); absent-identity refusal.
- **Credential suite** — dual path through the adapter; fail-closed configuration (AC-10, AC-21); RFC 9728 header assertion.
- **Workflow suite** — matching → assignment → pending → dashboard confirm; request lifecycle (AC-1–6, 13, 20); soft-delete blockers (AC-19); work-sites/clients/certifications (AC-16/17).
- **Audit suite** — log-record assertions incl. issuance events (AC-14/15, AC-18).
- **Metrics suite** — count-accuracy checks (AC-14).
- **Contract-parity suite** — response shapes vs. the production contract (N-6, AC-13–15).

Deploy gate (per [`docs/GATES.md`](GATES.md)): all suites green on the real runner in the synthetic multi-tenant stack; N-5 typecheck gate green; g4 human merge recorded.

## 10.1 Test storage contract (Delta-03)

- **Real database, production engine.** Every suite that touches tenancy, identity, credentials, workflow, audit, or metrics runs against a **real PostgreSQL** — the engine the production MCP server actually uses (`asyncpg` connection pool verified in source, 2026-10-19). No in-memory store stands between the suites and the queries. T-1 is a *query-construction* property: an in-memory stand-in behind the repository interface can pass an authZ matrix the real SQL fails — which is precisely the bug class production shipped four times before the 2026-10-06 fixes. In-memory would make green dishonest.
- **Provisioning, one harness / two factories.** CI (GitHub Actions) provisions Postgres via **Testcontainers** (Docker present on runners, engine version pinned). Local runs provision via an **embedded-Postgres binary** path (zero daemon required). Same tests, same assertions, identical green either way — the factory is a 20-line seam, the harness is the contract.
- **Isolation: branched template databases.** A seeded template DB (core schema + two synthetic tenants, org A/B) is minted once per run; each test cuts a copy-on-write branch (`createdb -T` from template) and discards it after ("the branch is the fixture; disposal is the reset"). Transaction-rollback isolation alone is insufficient for the session-identity and credential suites — revocation/API-key lookup and session replay need durable, cross-connection state.
- **Synthetic data only** — orgs, staff, shifts in fixtures are synthetic; no production rows, ever; issuance/audit assertions (N-2, AC-18) run against the seeded fixtures.
- **DB-free suites:** type-level (compile, `tsc`), manifest-parity (filesystem), response-shape contract (fixture-driven, no storage).

## 11. Open register (design notes, not gaps)

- Progressive exposure of the tool surface (start: metrics + matching + shift reads; write groups follow their units).
- Session reaping default selection (N-1) — ADR-004 candidate.
- M2 persistence layout — ADR-005 candidate (intentionally out of M1 scope).
- **ADR-0002: OAuth 2.1 + PKCE AS + production credential adapter** — interface fixed by §6.3.
- Magic-link delivery mechanics (email channel) — web-app spec concern; the MCP tool only generates and returns.

## 12. Delta log

| Delta | Date | Change | Authority |
|---|---|---|---|
| **Delta-03** | 2026-10-19 | **Test storage contract** (§10.1 added; triggered by the human owner's test-infrastructure question): real **PostgreSQL** (production engine — `asyncpg` pool verified in source) for all tenancy/identity/credential/workflow/audit/metrics suites; Testcontainers in CI + embedded-Postgres locally behind one harness seam; per-test branched template DBs (copy-on-write; no rollback-only isolation for revocation/session-replay state); synthetic tenants only; DB-free suites enumerated (type-level, manifest-parity, response-shape contract). v1.2 (§ numbering unchanged; Delta log stays §12). | human re-plan (@ochsec) |
| **Delta-02** | 2026-10-19 | **Conformance audit vs. production source** (first direct check of the original app; triggered by the human owner's completeness challenge): complete 28-tool manifest-parity inventory with exact production names (was: partial inventory; `matching.rank` → the real `find_candidates`); added work-sites, clients, magic-link, certification-update/delete tooling; corrected request lifecycle (**no MCP approve step** — acceptance is web-side); added soft-delete blocking conditions and matching weights (40/30/30) as requirements; **auth boundary made explicit (§2)** — SPEC-001 governs MCP transport identity; OAuth AS = ADR-0002; magic-link redemption + dashboard user-auth = web-app spec (M2.5); production credential reality documented (JWT-HMAC + revocable API keys, RFC 9728 discovery header, /health-only bypass); new §6.7 identity-issuance bar (magic-link senders; A3); §6.5 hardened to manifest-generated descriptions after a live docstring/manifest mismatch finding (`run_sql`: docstring "admin only" vs manifest super-gating); ACs extended (AC-7 matrix = all 28 tools; AC-16–22 added). v1.1 → v1.2. **Audit sources:** production `tools.toml` (349 L, 28 tools), `server.py` (261 L), `api_keys.py`, `config.py`, git history (`c84889f`, `85cad82` — upstream fixes landed 2026-10-06). | human re-plan (@ochsec) |
| **Delta-01** | 2026-10-16 | Stack port: Rust/`rmcp` + Python client harness → TypeScript/Node (strict profile; `@modelcontextprotocol/sdk` 1.32.1; Hono; Eta SSR pages; Vitest + TS client harness); credential-adapter split (OAuth contract retained; M1 dev adapter); type-level tenancy added (T-1.T, AC-7.T); SSR pages dated M2 (+M2.5 audit/role flows). Reason: [ADR-0001](adr/0001-typescript-rebuild.md) — human decision (@ochsec). v1.0 → v1.1. | human re-plan (g2 re-freeze) |

> This spec freezes at g2 for the duration of its units of work; deltas require human re-plan per [`AGENTS.md`](../AGENTS.md) and are recorded in §12 only.