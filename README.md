# gated-agentic-sdlc

Rebuilding the [Senzii Scheduling App](https://github.com/Senzii-App/app) through a **Gated Agentic SDLC** — a public, auditable experiment.

**The claim:** this application is rebuilt entirely from agentic execution — **zero hand-written implementation code**. The human authors intent artifacts (charter, specifications, gate policies); AI coding agents author the implementation; every unit of work passes through an explicit gate; the commit history is the audit trail.

**The falsifier:** any commit whose implementation diff is hand-written by a human invalidates the run. [`docs/PROVENANCE.md`](docs/PROVENANCE.md) records authorship per commit; the ledger is append-only, and any violation gets logged there, not hidden.

## Why

1. The production Senzii app (see [`Senzii-App/app`](https://github.com/Senzii-App/app)) was built the traditional way — human architecture, increasingly agent-assisted, spec discipline accumulated *after* the fact. This repo applies the operating model **from day one**, so the comparison is live and honest.
2. The 2026 field data is blunt: an empirical study of AI-authored commits found **15%+ of commits from every AI coding assistant studied introduced at least one issue, and 24.2% of AI-introduced issues survived to the latest revision**. The bottleneck has moved from writing code to **specifying and verifying** it. This repo is the operating answer: six phases, four human gates, three enforcement modes.

## The loop

```
CHARTER ─g1─ SPECIFY ─g2─ PLAN ─g3─ BUILD ⇄ steer ─g4─ GATE & MERGE ─ LAND & LEARN
                                                             │
             (metrics, provenance, skills feed back) ────────┘
```

- **g1** charter approved → **g2** specification frozen (immutable within the unit) → **g3** test catalogue locked, red-first → **g4** human merge — every unit, every tier. Agents never merge.
- Full model: [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).

## What the rebuild deliberately improves on the original

The production server's post-hoc security review ([PR #1](https://github.com/Senzii-App/app/pull/1), cross-tenant `run_sql`, review 5434334457, 2026-10-06) surfaced **four pre-existing tenant-scope violations** on `main` despite a README claiming cross-org access was impossible. In this rebuild, the governance spec ([`docs/SPEC-001`](docs/SPEC-001-mcp-server.md), §5) states the tenant invariant **first**; the authZ matrix tests are locked **before** implementation exists (red-first, immutable); and those violation classes are impossible by construction.

The behavioral diff between the two codebases is the methodology's ROI, demonstrated in the open.

## Repo map

| Path | What it is |
|---|---|
| [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) | The operating model: six phases / four gates / enforcement spectrum / autonomy ladder / acceptance scorecard |
| [`docs/SPEC-001-mcp-server.md`](docs/SPEC-001-mcp-server.md) | Governing specification for milestone 1 (MCP server), with AC traceability |
| [`docs/GATES.md`](docs/GATES.md) | Gate policy per file area + autonomy tier map per unit |
| [`docs/PROVENANCE.md`](docs/PROVENANCE.md) | Append-only ledger: commit → spec → ACs → authorship → gate record; baseline scorecard |

## Commit convention

Every commit carries trailers:

```
Spec: SPEC-001
ACs: AC-7, AC-8
Tier: A2 (consequential)
Author-Class: agent (steered-human: @ochsec)
Gate: g3-tests-locked, g4-human-review
```

**Author-Class vocabulary:** `human` (intent artifacts + gate decisions) · `agent` (implementation) · `agent-drafted` (agent wrote, human edited — counts as human-authored, logged). Implementation code is expected to be `agent`; charter/spec/gate artifacts are `human`. That split *is* the experiment.

## Stack & milestones

**Rebuilt in TypeScript / Node — a different language than the original, deliberately.** The spec, not the codebase, is the bridge between the two: whatever transfers, transfers by intent. Stack decision and the strict-typing profile: [docs/adr/0001](docs/adr/0001-typescript-rebuild.md).

- Runtime: Node.js 22 LTS (ESM) · strict TypeScript (`strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`; `any` banned in CI)
- MCP: official TypeScript SDK `@modelcontextprotocol/sdk` 1.32.1 — Streamable HTTP, stateful sessions
- HTTP: Hono 4.x (typed routes) · Templates: Eta 4.x (auto-escape, typed contexts, server-rendered pages)
- Tests: Vitest 5 + the SDK's MCP client against a simulated two-tenant environment (synthetic data only)

Milestones: **M1** tenancy core + read-only tool surface (metrics, matching, shifts) → **M1.5** OAuth 2.1 + PKCE credential adapter → **M2** write surface (assignments/staff/requests) with the server-rendered pending→confirm flow → **M2.5** audit + per-role flows → **M3** full dashboard port.

- [Original app](https://github.com/Senzii-App/app) · [Public site](https://github.com/Senzii-App/site) · [senzii.com](https://senzii.com)

## Data & secrets policy

Synthetic tenants only. No production data, no credentials, no PHI/PII — not in fixtures, not in context, not in commit messages. Secrets via `.env.example` (empty values + generation hint) from the first commit; fail-closed on missing `SESSION_SECRET`.

## Status

- [ ] Charter + operating model published (g1)
- [ ] SPEC-001 frozen (g2)
- [ ] AuthZ matrix + session-identity tests locked red (g3)
- [ ] M1: tenant-injection core (design ADR + security review at g4)
- [ ] M1: tool surface units — matching → assignments → staff → requests → metrics
- [ ] Scorecard instrumented (first-pass alignment, steering cost, time-to-green)