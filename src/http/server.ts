/**
 * HTTP server — the MCP program (production-parity shape, SPEC-001 §6.3).
 *
 * - `/health` is the only unauthenticated route.
 * - Everything else: per-message identity (T-2) resolved BEFORE dispatch;
 *   absent/invalid/revoked credential → 401 with the RFC 9728 discovery
 *   header; no default identity, ever.
 * - Stateful Streamable HTTP: session map per ADR-0003 §3; unknown or
 *   expired session ids are rejected per the SDK contract.
 */
import { createServer, type ServerResponse, type Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadRegistry, type Registry } from '../mcp/registry.js';
import { createToolHandlers, type ToolHandlerMap } from '../mcp/handlers.js';
import { createSessionMcpServer } from '../mcp/sessionServer.js';
import { buildAdapters, disposeAdapters } from '../tenancy/adapters/index.js';
import { resolveCredential } from '../tenancy/adapter.js';
import { mintTenantContext } from '../tenancy/tenant.js';
import { withRequestIdentity, type RequestIdentityFrame } from '../tenancy/requestIdentity.js';
import type { AppConfig } from '../config.js';
import { asOrgId } from '../ids.js';

export interface StartedServer {
  readonly port: number;
  close(): Promise<void>;
}

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: Server;
}

function send401(res: ServerResponse, baseUrl: string): void {
  res.writeHead(401, {
    'WWW-Authenticate': `Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`
  });
  res.end('Missing, invalid or revoked token');
}

function sendJsonError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message } }));
}

export async function startServer(config: AppConfig, registryOverride?: Registry): Promise<StartedServer> {
  const registry: Registry = registryOverride ?? (await loadRegistry());
  const handlers: ToolHandlerMap = createToolHandlers();
  const adapters = buildAdapters(
    { sessionSecret: config.sessionSecret, databaseUrl: config.databaseUrl },
    { allowDevCredentials: config.allowDevCredentials }
  );
  const sessions = new Map<string, SessionEntry>();
  let publicBaseUrl = config.baseUrl;

  const httpServer: HttpServer = createServer(async (req, res) => {
    const url = req.url ?? '/';
    if (url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy' }));
      return;
    }

    // T-2: identity resolves on EVERY request — no session-scoped lifetime,
    // no freeze at initialize-time (the PR #1 defect class).
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (token === '') {
      send401(res, publicBaseUrl);
      return;
    }

    const resolved = await resolveCredential(token, adapters);
    if (resolved === null) {
      send401(res, publicBaseUrl);
      return;
    }

    const frame: RequestIdentityFrame = {
      context: mintTenantContext({
        org: asOrgId(resolved.claims.org_id),
        role: resolved.claims.role,
        actorUserId: resolved.claims.user_id,
        entityId: resolved.claims.entity_id
      }),
      adapter: resolved.adapter
    };

    const sidHeader = req.headers['mcp-session-id'];
    const sessionId = Array.isArray(sidHeader) ? sidHeader[0] : sidHeader;

    if (sessionId !== undefined) {
      const session = sessions.get(sessionId);
      if (session === undefined) {
        sendJsonError(res, 400, 'Bad Request: No valid session ID provided');
        return;
      }
      try {
        await withRequestIdentity(frame, () => session.transport.handleRequest(req, res));
      } catch (error) {
        console.error('[mcp] request failed:', error);
        if (!res.writableEnded) {
          res.writeHead(500);
          res.end('Internal error');
        }
      }
      return;
    }

    if (req.method !== 'POST') {
      // GET/DELETE/SSE without a session have nothing to address.
      send401(res, publicBaseUrl);
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (initializedId: string) => {
        sessions.set(initializedId, { transport, server });
      }
    });
    const server = createSessionMcpServer(registry, handlers);
    // Known SDK typing friction: Transport's optional properties predate
    // exactOptionalPropertyTypes; cast at this single boundary (ADR-0003 §3).
    await server.connect(transport as unknown as Transport);

    try {
      await withRequestIdentity(frame, () => transport.handleRequest(req, res));
    } catch (error) {
      console.error('[mcp] session initialization failed:', error);
      if (!res.writableEnded) {
        res.writeHead(500);
        res.end('Internal error');
      }
    }
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    httpServer.once('error', rejectListen);
    httpServer.listen(config.mcpPort === 0 ? 0 : config.mcpPort, '127.0.0.1', resolveListen);
  });

  const address = httpServer.address();
  const port =
    address !== null && typeof address === 'object' ? address.port : config.mcpPort;
  if (config.baseUrl === '') {
    // Test/dev default: derive the advertised base from the bound address.
    publicBaseUrl = `http://127.0.0.1:${port}`;
  }

  return {
    port,
    close: async () => {
      await Promise.allSettled([...sessions.values()].map((entry) => entry.transport.close()));
      await new Promise<void>((resolveClose) => httpServer.close(() => resolveClose()));
      await disposeAdapters();
    }
  };
}