/**
 * AC-7 tenant-injection matrix — generated from the registry (28 tools).
 * Refusal parity today; org-scoped result checks attach per unit as
 * handlers land (suite files immutable within the unit; growth additive).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadRegistry } from '../src/mcp/registry.js';
import { RawMcpClient, toolText } from './client.js';
import { TOKEN_DEV_A, TOKEN_DEV_B, startRig, type McpRig } from './harness.js';

let rig: McpRig;
let toolNames: string[];

beforeAll(async () => {
  rig = await startRig();
  const registry = await loadRegistry();
  toolNames = registry.tools.map((tool) => tool.name);
});

afterAll(async () => {
  await rig.close();
});

describe('AC-7 tenant-injection matrix (all 28 registered tools)', () => {
  it('no credential → 401 with the RFC 9728 discovery header, for every tool', async () => {
    const client = new RawMcpClient(rig.baseUrl);
    const first = await client.callTool(toolNames[0] ?? 'list_staff', {}, null);
    expect(first.status).toBe(401);
    expect(first.headers['www-authenticate'] ?? '').toContain('resource_metadata=');
    for (const name of toolNames) {
      const response = await client.callTool(name, {}, null);
      expect(response.status, `tool: ${name}`).toBe(401);
    }
  });

  it('authenticated calls → org-independent refusal while the tool is not landed', async () => {
    const clientA = new RawMcpClient(rig.baseUrl);
    const clientB = new RawMcpClient(rig.baseUrl);
    await clientA.initialize(TOKEN_DEV_A);
    await clientB.initialize(TOKEN_DEV_B);
    for (const name of toolNames) {
      const responseA = await clientA.callTool(name, {}, TOKEN_DEV_A);
      const responseB = await clientB.callTool(name, {}, TOKEN_DEV_B);
      const textA = toolText(responseA);
      const textB = toolText(responseB);
      expect(textA, `tool: ${name}`).toBe(textB);
      expect(textA, `tool: ${name}`).toContain('not yet landed');
    }
  });

  it('the hidden diagnostic tool is never listed but answers the identity frame', async () => {
    const client = new RawMcpClient(rig.baseUrl);
    await client.initialize(TOKEN_DEV_A);
    await client.listTools(TOKEN_DEV_A);
    const response = await client.callTool('identity.echo', {}, TOKEN_DEV_A);
    expect(toolText(response)).toBeDefined();
  });
});