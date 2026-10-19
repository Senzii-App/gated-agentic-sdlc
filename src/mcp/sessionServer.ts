/**
 * Per-session low-level MCP server (ADR-0003 §3, production-parity shape).
 * - list_tools: the manifest registry, verbatim, 28 tools (AC-22).
 * - call_tool: fail-closed identity first (T-2), then the hidden diagnostic
 *   echo (identity.echo), then progressive-exposure dispatch.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult, type Tool } from '@modelcontextprotocol/sdk/types.js';
import { IDENTITY_ECHO_TOOL, type Registry } from './registry.js';
import { jsonResult, textResult, type ToolHandlerMap } from './handlers.js';
import { requireRequestIdentity } from '../tenancy/requestIdentity.js';

export function createSessionMcpServer(registry: Registry, handlers: ToolHandlerMap): Server {
  const server = new Server(
    { name: 'senzii-rebuild', version: '0.1.0' },
    { capabilities: { tools: { listChanged: false } } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.listTools().map(
      (t): Tool => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Tool['inputSchema']
      })
    )
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name } = request.params;
    const rawArgs = request.params['arguments'] ?? {};

    // T-2 fail-closed: identity arrives from THIS message's verified frame.
    // Absent frame is a hard error — never a default identity.
    const frame = requireRequestIdentity();

    if (name === IDENTITY_ECHO_TOOL) {
      return jsonResult({
        org: frame.context.org,
        role: frame.context.role,
        actorUserId: frame.context.actorUserId,
        entityId: frame.context.entityId,
        adapter: frame.adapter
      });
    }

    const entry = registry.byName(name);
    if (entry === undefined) {
      return textResult(`Unknown tool: ${name}`, true);
    }

    const handler = handlers.get(name);
    if (handler === undefined) {
      return textResult(
        `Tool not yet landed (SPEC-001 §3.1 progressive exposure): ${name}`,
        true
      );
    }

    return handler(frame.context, rawArgs, entry);
  });

  return server;
}