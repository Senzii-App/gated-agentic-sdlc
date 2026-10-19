/**
 * Credential claims — parsed, validated, branded at the boundary (ADR-0001:
 * parse, don't validate). Production parity: HMAC-signed JWT claims carry
 * org_id (required), role (default "admin"), entity_id, user_id.
 * Rebuild rule: role must be one of the MCP roles — no silent widening.
 */
import { z } from 'zod';

export const McpRoles = ['admin', 'super'] as const;
export type McpRole = (typeof McpRoles)[number];

export const TenantClaimsSchema = z.object({
  org_id: z.number().int().positive(),
  role: z.enum(McpRoles).default('admin'),
  entity_id: z.number().int().nullable().default(null),
  user_id: z.number().int().nullable().default(null)
});

export type TenantClaimsInput = z.input<typeof TenantClaimsSchema>;
export type TenantClaims = z.output<typeof TenantClaimsSchema>;