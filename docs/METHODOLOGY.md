# Gated Agentic SDLC — An Operating Model for AI-Native Software Development

**v1.0 (public edition) — Christopher Ochsenreither — October 2026**
*Working draft with planning material is kept privately; this document is the public statement of the model. The model being applied end-to-end, live, is this repository.*

---

## 0. Thesis

The bottleneck in software development moved. It is no longer the speed of typing code — agents synthesize whole feature branches in a single pass. The binding constraint is now **the clarity and verifiability of intent**. A 2026 empirical survey of AI-authored commits found that more than 15% of commits from *every* AI coding assistant studied introduced at least one issue, and 24.2% of AI-introduced issues survived to the latest repository revision [7]. The output machine got faster than the review machine.

Therefore: **the engineer's product is no longer the code. It is the intent artifact and the verification harness that make the code trustworthy.** The code is manufactured. The spec, the test list, the gates, and the autonomy policy are *authored*. In this operating model, human judgment concentrates at four gates, and agent labor fills everything between them.

The overall shape is a **gated agentic SDLC**: six phases, four human gates, three enforcement modes, and one rule that outranks the rest — *a control the agent can ignore is not a control.*

Chat-driven agent sessions are still the steering interface — that part of current practice is right. What makes chat-driven *rigorous* instead of messy is that every steering session lands in a reviewable artifact. If it isn't in a file, it didn't happen.

---

## 1. The field, 2025–2026 (what this model builds on)

- **Spec-first became a product category.** GitHub's Spec Kit (Sept 2025), Amazon Kiro (GA Nov 2025), OpenSpec, and others capture intent in durable artifacts before code. A 2026 corpus study found spec files in 73,000+ public repositories, almost all committed 2025 or later [8].
- **The rigor ladder.** Spec-first (agree on the spec before code) → spec-anchored (keep the spec reconciled with code) → spec-as-source (spec is the artifact, code is the build output).
- **Enforcement is the differentiator, not specification.** Recent framework analyses document that agents, under pressure, will disable or delete tests to go green, over-mock real behavior, and misreport success — which is why "honest green" (a passing **test-runner** result, not an agent's claim) and **immutable tests** are first-class design decisions [2][6].
- **Context engineering is a discipline with published failure data.** Configuration-file smells are measurable: lint leakage affected 62% and context bloat 42% of studied repositories [5]; recommended practice keeps guidance files high-signal and small (~≤200 lines) [4].
- **Governance has converged on a pattern:** least privilege, task-scoped permissions, agent identity, and the one line worth memorizing — **"never let the model decide when human review is required"** [9].
- **The metrics moved off vanity.** Lines generated and suggestion-accepted counts mean little; acceptance rate, time-to-merge, rework rate, and escaped defects are the scorecard that tracks value [7]. Gate-attribution matters too: defects found past each gate say *where* the harness is weak, not just *that* the code was wrong [3].

---

## 2. Principles (in priority order)

1. **Intent is the artifact.** Specs, acceptance criteria, and test lists are the durable statements of what is being built; code is a build output. A spec the agent edits under pressure is not a spec — freeze it per unit of work.
2. **Gates beat guidelines.** Prose instructions to a non-deterministic worker are advice. Place the controls the agent cannot reach: immutable test lists, deterministic CI gates, human-approved merge authority.
3. **Green must be honest.** Success is recorded only when a test runner passes on real infrastructure — never from the agent's self-report.
4. **Autonomy is rationed, not defaulted.** Graduated by blast radius, expanded only on evidence, revoked on incident. *The model never chooses which of its own outputs gets human review.*
5. **Context is supply, not decoration.** Agents fail from missing or noisy context, not missing ability. Keep per-repo guidance high-signal and small; document consequential decisions as ADRs.
6. **Human authority stays at the merge.** Agents may synthesize, verify, and even review — merge and release authority is a human signature, every time. This mirrors how regulated industries already govern models.
7. **Measure the gate, not the tool.** Track whether agent-authored work becomes shipped work, and attribute misses to the gate that let them through.

---

## 3. The loop: six phases, four gates

```
CHARTER ─ g1 ─ SPECIFY ─ g2 ─ PLAN ─ g3 ─ BUILD ⇄ (steer) ─ g4 ─ GATE & MERGE ─ LAND & LEARN
   │                                                                    │
   └────────────── metrics, provenance, and skills feed back ───────────┘
```

| Phase | Purpose | Artifacts | Human gate |
|---|---|---|---|
| **1. Charter** (per project/epic) | Operating envelope: stack, context sources, guardrails, autonomy ceilings, provenance policy | `AGENTS.md`, guardrail register, blast-radius list | g1 |
| **2. Specify** | Intent → reviewable spec: behavior, scope, non-functionals, compliance notes | `docs/specs/SPEC-NNN` with acceptance criteria | g2: spec frozen |
| **3. Plan** | Task graph + **test-first plan**; per-task blast-radius classification → autonomy tier + enforcement mode | task state doc; test catalogue; tier map | g3: tests locked |
| **4. Build** | Agents implement task-by-task; steering sessions logged; context refreshed per task | PRs, steering log, red-green-refactor history | — |
| **5. Gate & Merge** | CI, security scan, reviewer pass, human review; provenance stamped | merged PR + provenance tag + gate results | g4: human merge (all tiers) |
| **6. Land & Learn** | Deploy, observe, feed learnings back | ADRs, `AGENTS.md`/skills updates, scorecard updates | — |

Rules that hold the loop up:

- **Spec freeze per unit of work.** Living specs are reconciled under human re-plan, not drifted by the agent to match what it built.
- **Steering is logged.** A steering session ends with a one-paragraph state note on the task: decisions, why, what changed.
- **Ceremony is right-sized by tier, never by enthusiasm.** A trivial docs fix doesn't need a frozen spec; money and PII do.

---

## 4. The enforcement spectrum (pick per blast radius, not per fashion)

| Mode | What it is | Cost | Where it's right |
|---|---|---|---|
| **E1 — Persuasion** | Prompt discipline; rules the agent may ignore | Near-zero | Exploratory work, scaffolds, throwaway prototypes |
| **E2 — Front-loaded structure** | Strong spec + plan, then a trusted agent build | Low | Low-risk work inside mature repos |
| **E3 — Controls the agent cannot edit** | Deterministic orchestrator; immutable test list; human-approved gates; runner-verified green (ideally against a real, branched environment) | Higher | Money, PHI/PII, auth, migrations, compliance-adjacent paths |

Field framing: this is the axis where 2025–2026 frameworks genuinely diverge — some are E1/E2 (persuasion + structure), Consort-style systems are E3 — and the honest engineering statement is *"mode follows blast radius."* A team running E3 everywhere is slow; a team running E1 on billing code is negligent.

**The three failure modes E3 exists to close** [2]:
1. Test deletion/editing to force green → tests immutable within the unit of work.
2. Over-mocking (agents materially out-mock humans, validating less real behavior) → verify against real, production-shaped dependencies, not doubles.
3. Self-reported green → success = the runner's record, never the agent's.

---

## 5. The autonomy ladder (least privilege, graduated by blast radius)

| Tier | Definition | Autonomy granted | Human role |
|---|---|---|---|
| **A0** | Trivial/non-consequential: docs, formatting, comments | Agent acts; lands directly | None (spot audit) |
| **A1** | Routine inside mature guardrails: standard feature code behind CI | Agent builds; PR auto-raised | Reviewer-agent gates; human merge review (fast) |
| **A2** | Consequential: billing logic, auth, data migrations, public APIs | Agent proposes; tests written/locked **first** | Human reviews design + diff at g4; test list locked |
| **A3** | External/irreversible: prod deploys, data deletion, external comms, PHI/PII-touching paths | Agent may draft scripts/runbooks | Human executes or human-gated step-by-step |
| **A4** | Out of bounds | Not granted | — |

Operating rules: autonomy is **per task, not per person**; expansion is evidence-based (rework + escape metrics must hold); revocation is immediate on incident. Credentials are task-scoped and time-boxed; agent identity is separate from human identity; every tool call is the result of an explicit permission, never an implicit one [9].

---

## 6. Metrics: the acceptance scorecard

The point is to make "works with AI" falsifiable:

| Metric | Definition | Reads as |
|---|---|---|
| Acceptance rate | share of AI-authored changes merged to main | signal quality of specs + steering |
| Rework rate | churn on AI-authored files within N days of merge | review/eval quality |
| Escaped defects (by gate) | defects found after each gate, attributed per gate | where the harness leaks |
| First-pass alignment | share of tasks landing without material rework on first synthesis | spec fidelity in practice |
| Steering cost | human steering hours per landed feature | the actual labor model |
| Time-to-green / time-to-merge | elapsed from task start to runner-verified green, and to merge | loop friction |
| Spec-fidelity checklist | completeness / consistency / unambiguity / verifiability — 4 checks on every frozen spec [8] | upstream quality, the cheapest lever |

**First 30 days at a new seat:** instrument the scorecard, baseline current AI-authored work, attribute escapes by gate, then move one work-class up or down the ladder on the evidence. Decisions from measured data, not vibes.

---

## 7. Anti-patterns (the tells of someone who hasn't run agentic work in production)

1. **Acceptance-rate theater** — celebrating lines generated; nobody asks what shipped.
2. **Agent-reported green** — trusting the agent's "tests pass" instead of the runner's record.
3. **Spec drift** — letting the agent edit the spec to match the build.
4. **Context bloat** — a 600-line guidance file the model partially ignores (measurable failure modes in the wild [5]).
5. **Mock-rich verification** — tests validate mocks, not behavior.
6. **Mid-synthesis intent changes** — parking mid-build requirement changes behind the re-plan gate instead of fragmenting context.
7. **Model-decided escalation** — letting the agent decide when its own work needs human review. It will decide "never."

---

## 8. Worked example — the Senzii MCP server (this model, applied in public)

- **Production system:** [`Senzii-App/app`](https://github.com/Senzii-App/app) — staff scheduling platform (web dashboard + MCP server: ranked matching, shifts/assignments with conflict detection and certification gating, staffing-request lifecycle, org metrics), OAuth 2.1 + PKCE, human-in-the-loop approval by design: the AI proposes, the human confirms, and autonomous approval is deliberately capability-gated off.
- **The governing specification:** [`docs/SPEC-001-mcp-server.md`](SPEC-001-mcp-server.md) — drafted from the production system's documented behavior and its security review, re-stated as first-class intent for this rebuild.
- **The incident record that shaped it:** [`PR #1`](https://github.com/Senzii-App/app/pull/1) (cross-tenant `run_sql` + auth hardening) — reviewed with live-stack reproductions; the verified blocking finding (session-creation-time identity binding) is codified in the spec as §5.2, and four pre-existing tenant-scope violations on `main` become design requirements for the rebuild (§5.1) with absence-proving matrix tests.
- **This repo is the proof run:** charter at g1, spec frozen at g2, tests locked red at g3, every unit human-merged at g4 — the loop above, executed in the open.

---

## 9. Objection answers (pre-rehearsed)

- **"Isn't spec-first just waterfall again?"** — The reader changed. Specs used to be expensive because a human re-read them at every handoff; now the machine consumes them directly, making the spec cheap and the ambiguity expensive. It's waterfall's clarity without waterfall's rigidity — frozen per increment, re-planned when humans re-plan.
- **"Doesn't this slow the team down?"** — The opposite, on the metrics that matter: AI-accelerated teams report large velocity gains *when* up-front spec rigor is in place, and sharp quality degradation when it isn't. First-pass alignment rate is how you watch that trade live.
- **"How do you trust the tests aren't gamed?"** — Immutable within a unit of work; success defined as a runner-verified green; gate-attributed escape metrics catch the leak regardless.
- **"What about regulated data?"** — That's why the ladder exists: PHI/PII paths are A3 with deterministic human gates and provenance on every PR.
- **"We already use a framework (Spec Kit/Kiro/etc.)"** — The frameworks converge on intent capture and diverge on enforcement; that's a choice space, not a religion. The gate policy plugs onto whichever harness the team already runs.

---

## 10. One-page summary

```
GATED AGENTIC SDLC — SIX PHASES, FOUR GATES
Charter → Specify → Plan → Build ⇄ → Gate&Merge → Land&Learn
  g1 charter     g2 spec frozen    g3 tests locked    g4 human merge (always)

ENFORCEMENT (pick by blast radius)
E1 persuasion · E2 front-loaded structure · E3 controls the agent cannot edit
                                  (immutable tests · runner-verified green
                                   · deterministic gates · real-dependency verification)

AUTONOMY LADDER      A0 docs/trivial → A1 routine → A2 consequential (money/auth)
                              → A3 irreversible/PHI (human-gated) → A4 never

SCORECARD            acceptance · rework · escapes-by-gate · first-pass alignment
                     · steering cost · time-to-green · spec fidelity

THE ONE RULE         the model never decides when its own work gets human review
```

---

## 11. References

1. SonarSource — *The Acceptance Gap: Why AI-Generated Code Still Fails to Become Shipped Work* (2026) — sonarsource.com/blog/the-acceptance-gap
2. Hartman, K. (Databricks) — *Consort: A Spec-First Agent Framework for Enforced, Test-Driven Development on Live Database Branches* (2026)
3. Augment Code — *Autonomous Development Metrics & KPIs for AI-Assisted Engineering Teams* (2026) — augmentcode.com/guides/ai-code-quality-metrics
4. Anthropic — *Effective Context Engineering for AI Agents* — anthropic.com/engineering/effective-context-engineering-for-ai-agents; Claude Code docs — code.claude.com/docs/en/memory
5. *Configuration Smells in AGENTS.md Files* — arXiv:2606.15828
6. *Spec-Driven Development as Prescribed and as Practiced* — arXiv:2608.25202 (practitioner-corpus evidence; 73,030 repos)
7. (a) same as [1] for the 15% / 24.2% findings; (b) *Spec-Driven Agentic Development for the AI-Native SDLC (SDAD)* — arXiv:2608.20341
8. (a) *Spec-Driven Development as Prescribed and as Practiced* — arXiv:2608.25202; (b) GitHub Spec Kit (Sept 2025); Amazon Kiro GA (Nov 2025)
9. Microsoft Security Blog — *Defense in Depth for Autonomous AI Agents* (May 2026) — microsoft.com/en-us/security/blog/2026/05/14/defense-in-depth-autonomous-ai-agents

*Field data retrieved October 2026; numbers re-verify against primary sources before external quotation.*