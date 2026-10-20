/** Synthetic-tenant seed (tests/harness seedSyntheticTenants tenant moved here). */
import type { Client } from 'pg';
import { API_KEY_ORG_A, API_KEY_ORG_B, sha256hex } from './db.js';

export async function seedSyntheticTenants(client: Client): Promise<void> {
  await client.query(
    "INSERT INTO organizations (id, name) VALUES (1, 'org-a-synthetic'), (2, 'org-b-synthetic')"
  );
  const keys: readonly [string, number, number][] = [
    [API_KEY_ORG_A, 11, 1],
    [API_KEY_ORG_B, 21, 2]
  ];
  for (const [key, user, org] of keys) {
    await client.query(
      'INSERT INTO api_keys (key_hash, user_id, organization_id) VALUES ($1, $2, $3)',
      [sha256hex(key), user, org]
    );
  }
}