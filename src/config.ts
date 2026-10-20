/**
 * Fail-closed configuration (SPEC-001 §6.3).
 *
 * SESSION_SECRET has no safe default: empty or historically known values
 * refuse startup (production behavior, carried verbatim + enforced by the
 * credential suite, AC-10). Environment is read raw; .env loading is a
 * deploy-side concern, never an import-side side effect.
 */

const HISTORICAL_DEFAULTS: readonly string[] = [
  '',
  'senzii-oauth-secret',
  'change-me-to-a-random-string'
];

export function readSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const value = env['SESSION_SECRET'];
  if (value === undefined || HISTORICAL_DEFAULTS.includes(value)) {
    throw new Error(
      'SESSION_SECRET must be set to a strong, unique value. It signs auth tokens: ' +
      'an empty or default value lets anyone forge a token for any organization ' +
      '(SPEC-001 §6.3, fail-closed). Set SESSION_SECRET in the environment.'
    );
  }
  return value;
}

export type TestProvisioner = 'embedded' | 'testcontainers';

export interface AppConfig {
  readonly sessionSecret: string;
  readonly databaseUrl: string;
  readonly mcpPort: number;
  readonly baseUrl: string;
  readonly allowDevCredentials: boolean;
  readonly testProvisioner: TestProvisioner;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    sessionSecret: readSessionSecret(env),
    databaseUrl: env['DATABASE_URL'] ?? '',
    mcpPort: Number(env['MCP_PORT'] ?? '3001'),
    baseUrl: env['BASE_URL'] ?? 'https://senzii.com',
    allowDevCredentials: env['ALLOW_DEV_CREDENTIALS'] === '1',
    testProvisioner: (env['TEST_PROVISIONER'] === 'testcontainers' ? 'testcontainers' : 'embedded')
  };
}