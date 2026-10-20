/** M1 core schema slice + synthetic-tenant seeds (SPEC-001 §10.1). */
import { createHash } from 'node:crypto';

export const API_KEY_ORG_A = 'test-api-key-org-a';
export const API_KEY_ORG_B = 'test-api-key-org-b';

export function sha256hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export const CORE_MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE organizations (
    id serial PRIMARY KEY,
    name text NOT NULL UNIQUE
  );

  CREATE TABLE api_keys (
    key_hash text PRIMARY KEY,
    user_id integer NOT NULL,
    organization_id integer NOT NULL REFERENCES organizations(id),
    revoked_at timestamptz,
    last_used_at timestamptz
  );

  CREATE TABLE audit_log (
    id bigserial PRIMARY KEY,
    organization_id integer NOT NULL REFERENCES organizations(id),
    actor_user_id integer,
    event text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    at timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE work_sites (
    id serial PRIMARY KEY,
    organization_id integer NOT NULL REFERENCES organizations(id),
    name text NOT NULL,
    address text NOT NULL,
    latitude double precision,
    longitude double precision
  );

  CREATE TABLE clients (
    id serial PRIMARY KEY,
    organization_id integer NOT NULL REFERENCES organizations(id),
    name text NOT NULL
  );

  CREATE TABLE certifications (
    id serial PRIMARY KEY,
    organization_id integer NOT NULL REFERENCES organizations(id),
    name text NOT NULL
  );

  CREATE TABLE staff (
    id serial PRIMARY KEY,
    organization_id integer NOT NULL REFERENCES organizations(id),
    name text NOT NULL,
    email text NOT NULL,
    address text NOT NULL,
    latitude double precision,
    longitude double precision,
    timezone text NOT NULL DEFAULT 'UTC'
  );

  CREATE TABLE shifts (
    id serial PRIMARY KEY,
    organization_id integer NOT NULL REFERENCES organizations(id),
    work_site_id integer REFERENCES work_sites(id),
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    required_certifications text[] NOT NULL DEFAULT '{}'
  );

  CREATE TABLE assignments (
    id serial PRIMARY KEY,
    organization_id integer NOT NULL REFERENCES organizations(id),
    shift_id integer NOT NULL REFERENCES shifts(id),
    staff_id integer NOT NULL REFERENCES staff(id),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled'))
  );

  CREATE TABLE staffing_requests (
    id serial PRIMARY KEY,
    organization_id integer NOT NULL REFERENCES organizations(id),
    client_id integer REFERENCES clients(id),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'filled', 'cancelled')),
    requested_at timestamptz NOT NULL DEFAULT now()
  );
  `
];