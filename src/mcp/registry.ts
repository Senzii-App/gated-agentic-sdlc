/**
 * Manifest-driven tool registry (SPEC-001 §6.5, AC-22).
 * The manifest file is the single source of truth for names, descriptions,
 * and gating. Descriptions ship verbatim; comments and docstrings may never
 * contradict it (production audit finding, Delta-02).
 */
import { z } from 'zod';
import { parse } from 'smol-toml';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ManifestSchema = z.object({
  tool: z.array(
    z.object({
      name: z.string(),
      handler: z.string(),
      description: z.string(),
      input_schema: z.record(z.string(), z.unknown()).default({})
    })
  )
});

export interface ManifestTool {
  readonly name: string;
  readonly handler: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

export interface ToolListing {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

export interface Registry {
  readonly tools: readonly ManifestTool[];
  byName(name: string): ManifestTool | undefined;
  listTools(): ToolListing[];
}

/** The production manifest, copied verbatim at unit time (AC-22). */
export function manifestPath(): string {
  return fileURLToPath(new URL('../../mcp/tools/manifest.toml', import.meta.url));
}

export async function loadRegistry(): Promise<Registry> {
  const text = await readFile(manifestPath(), 'utf8');
  const doc = ManifestSchema.parse(parse(text));
  const tools: ManifestTool[] = doc.tool.map((t) => ({
    name: t.name,
    handler: t.handler,
    description: t.description,
    inputSchema: t.input_schema
  }));
  return {
    tools,
    byName(name: string): ManifestTool | undefined {
      return tools.find((t) => t.name === name);
    },
    listTools(): ToolListing[] {
      return tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
    }
  };
}

/** The hidden diagnostic tool (ADR-0003 §5) — never listed, always identity-gated. */
export const IDENTITY_ECHO_TOOL = 'identity.echo';