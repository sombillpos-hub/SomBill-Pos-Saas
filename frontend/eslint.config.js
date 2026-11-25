import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Import boundaries: packages never import apps; an app never imports another app or the dashboards shell.
const APPS = ['manager', 'cashier', 'waiter', 'super-admin'];
const boundary = (files, banned, message) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns: [{ group: banned, message }] }] },
});

export default tseslint.config(
  { ignores: ['**/dist', '**/dist-e2e', '**/node_modules', 'apps/website/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  boundary(
    ['packages/**/*.{ts,tsx}'],
    ['@/*', ...APPS.map((a) => `@sombill/${a}/*`)],
    'Packages must not import apps.',
  ),
  ...APPS.map((app) =>
    boundary(
      [`apps/${app}/src/**/*.{ts,tsx}`],
      ['@/*', ...APPS.filter((a) => a !== app).map((a) => `@sombill/${a}/*`)],
      'An app may only import its own code and packages/.',
    ),
  ),
  // Turns off stylistic rules that Prettier owns, so ESLint and Prettier never disagree.
  prettier,
);
