import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.pgdata*/**'] },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    'extends': [...tseslint.configs.strict],
    'languageOptions': {
      'parserOptions': {
        'projectService': true,
        'tsconfigRootDir': import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { 'prefer': 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }]
    }
  }
);