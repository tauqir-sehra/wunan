// Lint rules for the whole repository: recommended JavaScript, TypeScript, and Svelte checks.
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/build/',
      '**/.svelte-kit/',
      '**/coverage/',
      '**/test-results/',
      '**/playwright-report/',
      'apps/api/drizzle/',
      'apps/api/photos/'
    ]
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: ts.parser } }
  },
  {
    rules: {
      // Unused variables are allowed only when deliberately prefixed with an underscore.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // wunan is always served from the site root (no base path), so plain links are correct and
      // wrapping every href in resolve() would only add noise.
      'svelte/no-navigation-without-resolve': 'off'
    }
  }
);
