/**
 * AC-7.T / AC-22 type-level and manifest-parity verification.
 * test-d files enforce compile-time invariants; this file enforces the
 * manifest being the single description source (§6.5).
 */
import { describe, expect, it } from 'vitest';
import { parse } from 'smol-toml';
import { readFile } from 'node:fs/promises';
import { loadRegistry, manifestPath } from '../src/mcp/registry.js';

describe('AC-22 manifest parity', () => {
  it('registry exposes exactly the manifest tools with verbatim descriptions', async () => {
    const registry = await loadRegistry();
    const manifest = parse(await readFile(manifestPath(), 'utf8')) as {
      tool: { name: string; description: string }[];
    };
    expect(manifest.tool).toHaveLength(28);
    expect(registry.tools).toHaveLength(28);
    expect(registry.tools.map((tool) => tool.name)).toEqual(manifest.tool.map((tool) => tool.name));
    manifest.tool.forEach((tool, index) => {
      const entry = registry.tools[index];
      expect(entry?.description).toBe(tool.description);
    });
  });

  it('run_sql manifest description states the super-gating (§6.5)', async () => {
    const registry = await loadRegistry();
    const sql = registry.tools.find((tool) => tool.name === 'run_sql');
    expect(sql?.description.toLowerCase()).toContain('super');
  });

  it('list_tools payload carries 28 entries and never leaks the hidden diagnostic', async () => {
    const registry = await loadRegistry();
    const tools = registry.listTools();
    expect(tools).toHaveLength(28);
    expect(tools.map((tool) => tool.name).includes('identity.echo')).toBe(false);
  });
});