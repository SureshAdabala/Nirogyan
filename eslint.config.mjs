import eslint from '@eslint/js';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      'apps/client/next-env.d.ts',
      '**/coverage/**',
      'docs/archive/**',
      'docs/history/**',
      'docs/research/**',
      'data/**',
      'packages/contracts/schemas/**',
      'packages/contracts/specs/**',
      'packages/contracts/registers/**',
      'packages/contracts/reports/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextCoreWebVitals.map((config) => ({
    ...config,
    files: ['apps/client/**/*.{js,jsx,ts,tsx}'],
    settings: {
      ...config.settings,
      next: {
        rootDir: 'apps/client/',
      },
    },
  })),
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['apps/client/**/*.{ts,tsx}'],
    settings: {
      next: {
        rootDir: 'apps/client/',
      },
    },
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  prettier,
);
