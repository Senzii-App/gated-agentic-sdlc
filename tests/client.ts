/** Raw Streamable-HTTP JSON-RPC client with per-message Bearer control (ADR-0003). */

export interface RpcResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

export class RawMcpClient {
  #baseUrl: string;
  #nextId = 1;
  #sid: string | undefined;

  constructor(baseUrl: string) {
    this.#baseUrl = baseUrl;
  }

  currentSessionId(): string | undefined {
    return this.#sid;
  }

  #headers(token: string | null): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'accept': 'application/json, text/event-stream'
    };
    if (token !== null && token !== '') {
      headers['authorization'] = `Bearer ${token}`;
    }
    if (this.#sid !== undefined) {
      headers['mcp-session-id'] = this.#sid;
    }
    return headers;
  }

  async #post(token: string | null, body: unknown): Promise<RpcResponse> {
    const response = await fetch(this.#baseUrl + '/mcp', {
      method: 'POST',
      headers: this.#headers(token),
      body: JSON.stringify(body)
    });
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    const sid = response.headers.get('mcp-session-id');
    if (sid !== null && sid !== '') {
      // Per-message session continuation (the header the server mints).
      this.#sid = sid;
    }
    const text = await response.text();
    let parsed: unknown = null;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return { status: response.status, headers, body: parsed };
  }

  async initialize(token: string | null): Promise<RpcResponse> {
    this.#sid = undefined;
    const init = await this.#post(token, {
      jsonrpc: '2.0',
      'id': this.#nextId++,
      method: 'initialize',
      'params': {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'gate-rig', version: '0.0.0' }
      }
    });
    if (this.#sid !== undefined) {
      await this.#post(token, { jsonrpc: '2.0', method: 'notifications/initialized' });
    }
    return init;
  }

  async listTools(token: string | null): Promise<RpcResponse> {
    return this.#post(token, {
      jsonrpc: '2.0',
      'id': this.#nextId++,
      method: 'tools/list',
      'params': {}
    });
  }

  async callTool(
    name: string,
    args: Record<string, unknown> = {},
    token: string | null = null
  ): Promise<RpcResponse> {
    return this.#post(token, {
      jsonrpc: '2.0',
      'id': this.#nextId++,
      method: 'tools/call',
      'params': { name, arguments: args }
    });
  }

  async get(path: string): Promise<RpcResponse> {
    const response = await fetch(this.#baseUrl + path);
    const text = await response.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return { status: response.status, headers, body: parsed };
  }
}

interface ToolCallPayload {
  'result'?: { 'content'?: { 'type': string; 'text': string }[] };
}

/** Extract the single text block of a tools/call response, if present. */
export function toolText(response: RpcResponse): string | undefined {
  const payload = response.body as ToolCallPayload | null;
  const first = payload?.result?.content?.[0];
  return first !== undefined && first.type === 'text' ? first.text : undefined;
}