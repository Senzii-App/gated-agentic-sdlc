import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    typecheck: { 'enabled': true, 'include': ['tests/**/*.test-d.ts'] },
    'testTimeout': 45_000,
    'hookTimeout': 120_000,
    pool: 'forks',
    'poolOptions': { 'forks': { 'singleFork': true } },
    'fileParallelism': false
  },
  esbuild: { 'target': 'es2023' }
});