# Provenance Ledger — append-only

One row per commit that carries implementation diffs, plus a running scorecard. **Append-only:** violations are logged, never edited away. This file is the falsification record for the repo's central claim (zero hand-written implementation code).

## Commit ledger

| Date | Commit | Unit | Spec / ACs | Tier | Author-class | Gates | Notes |
|---|---|---|---|---|---|---|---|
| 2026-10-16 | bootstrap series | charter + SPEC-001 + gate policy + ledger | SPEC-001 (g2 frozen) | — | human (charter/gates, drafted in agent steering) | g1, g2, g3-policy | no implementation code yet; matrix tests to follow |
| 2026-10-16 | pivot commits | ADR-0001 (TypeScript/Node rebuild) + SPEC-001 v1.1 (Delta-01) + charter alignment | SPEC-001 v1.1 (g2 re-frozen) | — | human (decision: @ochsec; doc drafting in agent steering) | g1-decision, g2 | stack: TS strict profile; type-level tenancy added; OAuth adapter deferred via interface |

## Author-class vocabulary

- `human` — hand-written intent artifact (charter, spec, gate decision, ADR, this ledger).
- `agent` — agent-authored implementation; human steering recorded in the unit's task doc.
- `agent-drafted` — agent wrote, human edited; **counts as human-authored** and is logged as such (the model counts edits, not intentions).

## Violations register

| Date | Commit | Violation | Disposition |
|---|---|---|---|
| — | — | — | — |

*(Empty is the goal. Any entry here is the experiment's falsifier firing.)*

## Baseline scorecard (instrumented as units land; zeros at bootstrap)

| Metric | Definition | Current |
|---|---|---|
| Acceptance rate | share of agent-authored changes merged to main | n/a (no units yet) |
| Rework rate | churn on agent-authored files within 14 days of merge | n/a |
| Escaped defects by gate | defects found after each gate, attributed per gate | 0 / none escaped (nothing shipped) |
| First-pass alignment | tasks landing without material rework on first synthesis | n/a |
| Steering cost | human steering hours per landed feature | target: recorded per unit |
| Time-to-green | task start → runner-verified green | target: recorded per unit |

Field context for why these numbers matter: 2026 empirical work found 15%+ of commits from every AI coding assistant studied introduced at least one issue, and 24.2% of AI-introduced issues survived to the latest revision — volume is vanity; this scorecard tracks whether agent work becomes shipped work.