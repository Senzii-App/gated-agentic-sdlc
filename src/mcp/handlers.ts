/**
 * Tool-handler seam. Units register handlers here as they land;
 * SPEC-001 §3.1's progressive exposure means list_tools always reflects the
 * manifest (AC-22), while dispatch refuses tools whose unit has not landed.
 */
import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import type { TenantContext } from '../tenancy/tenant.js';
import type { ToolListing } from './registry.js';

export type ToolResult = CallToolResult;

export type ToolHandler = (
  ctx: TenantContext,
  args: Readonly<Record<string, unknown>>,
  listing: ToolListing
) => Promise<ToolResult>;

export type ToolHandlerMap = ReadonlyMap<string, ToolHandler>;

export function createToolHandlers(): ToolHandlerMap {
  // unit/m1-tenancy-core: no tool units have landed yet.
  return new Map<string, ToolHandler>();
}

export function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) };
}

export function jsonResult(payload: unknown, isError = false): ToolResult {
  return textResult(JSON.stringify(payload), isError);
}