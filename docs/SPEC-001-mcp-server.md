# SPEC-001 — MCP Server (Milestone 1) — Governing Specification

**v1.0 — frozen 2026-10-16 (gate g2) — Christopher Ochsenreither**
Status: FROZEN for M1 · Scope class: A2/A3 (tenancy & security spine inside)
Provenance: drafted from the production Senzii MCP server's documented behavior and its post-hoc security review ([PR #1](https://github.com/Senzii-App/app/pull/1), review 5434334457), then re-stated as **first-class intent** for this rebuild. Where the original's incident record taught a lesson, it appears here as a requirement — not a patch.

---

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
| **Transport** | — | Remote Streamable HTTP, stateful sessions, OAuth 2.1 + PKCE |

### 2.2 Non-goals (M1)

Autonomous execution agents (confirmation dispatch, call-out fill cascade, proactive coverage outreach) — roadmap, separate spec. The matching engine is the brain; the agent layer is the hands. Dashboard web application (parity via M3). Payment/claims integration. External messaging channels.

## 3. System model

### 3.1 Tenancy & identity (invariants)

- **T-1 (tenant injection):** every database query derives org scope server-side from the verified transport identity. Tool arguments cannot set, widen, or override org scope.
- **T-2 (per-message identity):** in stateful Streamable HTTP mode, identity is resolved **per message** from the transport-verified request at call time. Session creation-time identity must not bind later calls; a leaked session id must not extend access beyond key revocation.
- Mechanism (carried from the production incident record, verified on stack): auth middleware stores verified identity on `request.scope["senzii_identity"]`; the `tools/call` handler reads it per message via request context.

### 3.2 Architecture

Server: Rust, `rmcp` v1.8 (MCP spec `2025-11-25`). Transport: Streamable HTTP, stateful sessions; OAuth 2.1 + PKCE; session tokens (`mcp-session-id`). Verification stack: Python MCP client `1.29.1` against a stateful `StreamableHTTPSessionManager`, simulated two-tenant environment (synthetic data only).

## 4. Functional requirements

- **F-1** `matching.rank`: candidates ordered by certification fit, distance, availability; response carries per-candidate breakdowns (distance, certifications).
- **F-2** `shifts.list`: site-filtered; in-org only.
- **F-3** `assignments.create`: refuses overlapping assignments (F-3.1); refuses unqualified staff against shift certification requirements (F-3.2); result lands `pending` (§6).
- **F-4** `assignments.unassign`/delete: org-scoped per T-1.
- **F-5** staff lifecycle per §2.1; all writes scoped per T-1.
- **F-6** request lifecycle: create → approve → convert → (any time before conversion) cancel.
- **F-7** certification types org-level; assignment to staff org-scoped.
- **F-8** `get_org_metrics`: counts consistent with DB truth.
- **F-9** illustrative transcript (article-published Spring Garden scenario) reproduces end-to-end: coverage-gap question → metrics + lists → proposal → three pending assignments with distance/cert breakdowns → dashboard confirmation.

## 5. Security requirements (the spine)

### 5.1 Tenant injection — invariant T-1
No MCP-visible argument influences tenant scope; server-side construction of every query. **Design requirement carried from the original's incident record:** the production server shipped four tools whose SQL lacked org filters (unassign by id; availability write by `staff_id`; certification add by arbitrary `staff_id`; create with arbitrary `shift_id`/`staff_id`). In this rebuild those classes are **impossible by construction** — org scope enters every query from the identity layer, and the authZ matrix (§9) proves absence before implementation is written.

### 5.2 Per-message identity binding (CWE-862 class)
Requirement from PR #1's verified blocking finding: identity frozen at session creation allowed org B's valid token, replayed as a leaked `mcp-session-id`, to execute as org A, and key revocation didn't reach an existing session. This rebuild: per-message identity (T-2), verified by the concurrency and replay tests (AC-8/9/12). Replaying the *original's* repro on this build must yield zero leaks by construction.

### 5.3 Credentials
- OAuth 2.1 + PKCE on the remote transport.
- **Fail-closed `SESSION_SECRET`**: absent or ambiguous → hard startup failure with a quickstart pointer (generation hint in `.env.example`). No historical default accepted.

### 5.4 SQL surface
`run_sql` is **absent by default**; if ever introduced: super-role only, strict `READ ONLY` transactions, ADR required, tier A3. This reverses the original's order of operations (shipping first, hardening later) into: spec first, build second — or never.

### 5.5 Tool descriptions are authoritative
`list_tools` output must state actual gating for every tool (the original's `tools.toml` described `run_sql` as "Admin only" while it was super-gated). Descriptions ship in the same unit as the gating they describe.

## 6. Human-in-the-loop (product rule)

- AI proposes; human approves. MCP-created assignments land **`pending`**; dashboard confirmation makes them live (AC-5).
- Autonomous approval is capability-gated **OFF** by default (AC-6). Rationale: assigning an uncertified worker in regulated field service is a liability event, not a bug. The gate is deliberate product design with technical support, not a limitation — and it is the A3 pattern of the operating model applied at the product's riskiest mutation.

## 7. Non-functional requirements

| ID | Requirement |
|---|---|
| N-1 | Session reaping: idle timeout to bound revocation lag (design target: 1800s) |
| N-2 | Audit parity: auth/reset/entity-change events record audit-log entries |
| N-3 | Tool descriptions authoritative (§5.5) |
| N-4 | Fresh-clone boots: `.env.example` + quickstart with secret hint; no silent import-time crash |

## 8. Acceptance criteria (spec → test traceability)

| AC | Requirement |
|---|---|
| AC-1 | In-org listing (`shifts.list`) |
| AC-2 | Ranked matching with breakdowns |
| AC-3.1 / AC-3.2 | Overlap refusal; certification-gated refusal |
| AC-4 | Org-scoped unassign/delete |
| AC-5 / AC-6 | Pending default; autonomous approval off unless explicitly enabled |
| AC-7 | Tenant injection: authZ matrix across every tool — no argument path widens org scope |
| AC-8 / AC-9 | Per-message identity: org-B token on org-A session executes as B; revocation effective on next message |
| AC-10 | Fail-closed startup on secret absence (historical defaults rejected) |
| AC-11 | `run_sql` absent by default (positive/negative checks) |
| AC-12 | Concurrency leak regression: 60 concurrent cross-tenant probes → 0/60 leaks |
| AC-13–15 | Request lifecycle; metric accuracy; audit parity |

## 9. Test catalogue (executable form of this spec — locked red at g3)

- **Tenant-isolation suite** — authZ matrix across every tool (AC-7); two-tenant simulation harness.
- **Session-identity suite** — per-message binding; revocation timeliness; replayed-session negative test (AC-8/9); concurrency leak regression (AC-12).
- **Credential suite** — fail-closed secret startup matrix (AC-10).
- **Workflow suite** — matching → assignment → pending → dashboard confirmation; request lifecycle (AC-1–6, 13).
- **Audit suite** — log record assertions (AC-14/15).
- **Metrics suite** — count-accuracy checks against DB truth (AC-14).

Deploy gate (per [`docs/GATES.md`](GATES.md)): all suites green on the real runner in the synthetic multi-tenant stack; g4 human merge recorded.

## 10. Open register (design notes, not gaps)

- Whole-surface tool count vs. progressive exposure (start: matching + shifts/assignments; staff/requests/metrics follow units).
- Session reaping default selection (N-1) — ADR-004 candidate.
- M2 persistence layout decision — ADR-005 candidate (kept out of this spec's scope on purpose).

> This spec freezes at g2 for the duration of M1's units of work; deltas require human re-plan per [`AGENTS.md`](../AGENTS.md).