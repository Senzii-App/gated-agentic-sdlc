#!/usr/bin/env bash
# CI invariant greps — mechanical checks the agent cannot rewrite away.
# Source of truth: SPEC-001 §6.1 (T-1), §6.5 (N-3), AGENTS.md "Tenancy red lines".
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0

# I1 — tool-argument zone must never carry org scope (T-1).
# Org identity enters queries ONLY via TenantContext from the identity layer.
if grep -rniE "org_?id|organization_?id" src/mcp/args/ 2>/dev/null; then
  echo "FAIL I1: org scope named inside tool-argument zone"
  fail=1
else
  echo "ok I1: tool-argument zone carries no org scope"
fi

# I2 — TenantContext minting confined to the tenancy layer (T-1.T).
# Property under test: (a) no mint definition outside src/tenancy/,
# (b) no direct object literal typed as TenantContext outside it,
# (c) the brand symbol never referenced outside it. Callers in the identity
# middleware (src/http/server.ts) may IMPORT and CALL — that is the layer's
# public surface; nothing may mint by construction elsewhere.
if grep -rnE "function mintTenantContext|TenantContext = \{|tenantBrand" src --include="*.ts" | grep -v "^src/tenancy/"; then
  echo "FAIL I2: tenant-context construction escapes the tenancy layer"
  fail=1
else
  echo "ok I2: tenant-context construction confined to src/tenancy/"
fi

# I3 — list_tools must be manifest-driven (N-3 / §6.5: descriptions authoritative).
if grep -q "manifest.toml" src/mcp/registry.ts; then
  echo "ok I3: registry is manifest-driven"
else
  echo "FAIL I3: registry did not reference the manifest"
  fail=1
fi

# I4 — no comment/docstring description source for tools (§6.5: single source).
if find src -name "*.ts" -exec grep -l "Tool description" {} \; | grep -q .; then
  echo "FAIL I4: hand-maintained tool description text found"
  fail=1
else
  echo "ok I4: no secondary description source"
fi

if [ "$fail" -ne 0 ]; then
  echo "INVARIANTS RED — merge refused"
  exit 1
fi
echo "INVARIANTS GREEN"