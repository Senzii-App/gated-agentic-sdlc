# AGENTS.md — Senzii Gated Agentic SDLC (repository charter)

Version: 1.0 (2026-10-16) · Companion: [`docs/GATES.md`](docs/GATES.md) · Specs: [`docs/`](docs/)
Kept high-signal by policy: ≤200 lines, minimal set that changes agent behavior (bloat measurably degrades adherence — see METHODOLOGY §1).

## What this repo is

A public rebuild of the Senzii scheduling app through a gated agentic SDLC.

**Hard rule — no hand-written implementation code.** Humans write: charter, specifications, gate decisions, ADRs, this file. Agents write: all implementation code, tests, and CI configuration drafts.

If a task seems to require human hand-written code: **STOP.** Escalate to the human. Change the plan or the guardrails — never the rule.

## The loop

```
CHARTER─g1─ SPECIFY─g2─ PLAN─g3─ BUILD ⇄ steer ─g4─ GATE & MERGE ── LAND & LEARN
```

1. **g1** — charter approved (README + this file + guardrails).
2. **g2** — spec frozen per unit of work: `docs/specs/SPEC-NNN` approved; immutable within the unit. If it must change: spec-delta note + human re-plan, never silent edit.
3. **g3** — test catalogue **written first and locked**: failing tests before implementation; the test list is immutable within the unit.
4. **BUILD** — agent implements against locked tests; steering sessions summarized into the unit's task doc (decisions, why, what changed). If it isn't in a file, it didn't happen.
5. **g4** — human merge, every unit, every tier. Agents never merge.
6. **LAND & LEARN** — deploy notes, ADRs, scorecard updates, skills updates.

## Workflow rules

- **Unit of work = one tool group**; one PR per unit; nothing merges without g4.
- **Green is honest:** success = test-runner output on a real harness (Rust `cargo test` + the Python MCP client `1.29.1` harness on the stateful `StreamableHTTPSessionManager` with simulated tenants), never the agent's self-report.
- **Every commit carries the trailers** defined in README (Spec / ACs / Tier / Author-Class / Gate). Missing trailers = invalid commit.
- Blocked or spec looks wrong → **stop and ask**; do not improvise around a frozen spec.
- Consequential decisions → ADR (`docs/adr/NNNN-title.md`).

## Tenancy red lines (invariant T-1 — the security spine)

- Org scope is injected server-side from the **verified transport identity** into every database query.
- Tool arguments **must never** set, widen, or override tenant scope.
- Identity is resolved **per message** (request scope at call time), never bound at session creation; key revocation must take effect on the next request regardless of session age.
- `run_sql`-class surfaces: absent by default; if ever, super-role only + READ ONLY transactions.
- These areas are E3 (controls the agent cannot edit — locked authZ matrix, deterministic CI checks). Any work here ⇒ human review is **deterministic**, never model-decided.

## Human-in-the-loop (product rule)

AI proposes; human approves. Assignments via MCP land `pending`; dashboard confirmation makes them live. Autonomous approval stays config-gated **OFF** by default — the gate is the product decision, backed by a deliberate design rationale (liability in regulated field service), not a technical limitation.

## Stack (M1)

Rust + `rmcp` v1.8 (MCP `2025-11-25`); Streamable HTTP; OAuth 2.1 + PKCE; stateful sessions. Test harness: Python MCP client `1.29.1` + stateful `StreamableHTTPSessionManager`, synthetic multi-tenant stacks.

## Context hygiene

- Keep this file < 200 lines; move phase-specific behavior to skills; record decisions as ADRs, not prose here.
- **Synthetic tenants only** in fixtures. No production data, credentials, or PHI/PII — not in fixtures, context, or commit messages.
- Secrets via `.env.example` (empty values + generation hint). **Fail-closed** on missing `SESSION_SECRET`.
- CI checks the tenancy red lines mechanically (e.g., no `org_id` among tool-arg fields) — greppable, not advisory.

## When unsure

Check the tier map in `docs/GATES.md`. If the unit is A2/A3 and anything is ambiguous: that is a **STOP**, not a judgment call. The model never decides when its own work gets human review.