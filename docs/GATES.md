# Gate Policy & Autonomy Tier Map

**v1.0 (2026-10-16)** — companion to [`AGENTS.md`](../AGENTS.md) and [`docs/SPEC-001-mcp-server.md`](SPEC-001-mcp-server.md)

## 1. The four gates

| Gate | Passes when |
|---|---|
| **g1** | Charter approved: this repo's README claim + falsifier, [`AGENTS.md`](../AGENTS.md) operating rules, guardrails |
| **g2** | Specification frozen for the milestone's scope: `SPEC-NNN` approved; immutable within units; deltas via human re-plan only |
| **g3** | Test catalogue written first and **locked** (immutable within the unit); failing/expected-absent tests recorded; tier + enforcement mode assigned per unit |
| **g4** | Human merge: every unit, every tier, both suites reviewed. **Agents never merge.** |

## 2. Enforcement mode per file area

| Area | Mode | Mechanism |
|---|---|---|
| Tenancy, identity, auth, session, `run_sql` | **E3** — controls the agent cannot edit | AuthZ matrix tests locked at g3 and immutable within the unit; CI greps the invariant (no `org_id`-bearing tool-arg fields; org scope enters queries only from the identity layer); green = runner output on the real harness |
| Domain logic (matching / assignments / requests / staff / metrics) | **E3-lite** | Runner-verified green; immutable per-unit test lists; human merge |
| Docs, CI drafts, tooling | **E2** | Front-loaded structure; constitution-as-checked-doc; human merge |

Mode selection rule: **mode follows blast radius** (see METHODOLOGY §4). A team running E3 everywhere is slow; a team running E1 on tenancy is negligent.

## 3. Autonomy tier map (M1 units)

| Unit | Tier | Gate handling |
|---|---|---|
| MCP server skeleton + transport + OAuth | A1 | g4 human merge |
| Tenancy core (identity injection, per-message binding) | **A3-design / human-gated** | Design ADR mandatory; security review at g4; matrix tests locked first |
| Org metrics (read-only) | A1 | g4 human merge |
| Matching (read-only) | A1 | g4 human merge |
| Assignments lifecycle (writes; conflict + certification gates) | **A2** | Tests locked first; security-relevant review at g4 |
| Staff lifecycle (writes) | A2 | as above |
| Requests lifecycle | A2 | as above |
| `run_sql` | **Default: never built** | If ever: A3, super-only, READ ONLY, ADR + human-gated |
| Dashboard port (M3) | A2 | as above |

## 4. Promotion & revocation

- Autonomy expansion is evidence-based: a work class may move up a tier only after its rework rate and escaped-defect metrics hold for a standing window (target: 30 merges) as recorded in [`docs/PROVENANCE.md`](PROVENANCE.md).
- Any escaped defect in a class ⇒ tier review for that class; expansion pauses.
- Revocation is immediate on incident; restoration is a g4 human decision.

## 5. Escalation

Ambiguity inside an A2/A3 unit is a **STOP**: the agent files a spec-delta note and waits for human re-plan. The model never decides when its own work gets human review.