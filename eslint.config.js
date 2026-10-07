import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const rootDir = dirname(fileURLToPath(import.meta.url));

// Convert a single .gitignore-style line into an ESLint flat-config glob.
function toGlob(pattern) {
  if (pattern.endsWith('/')) return `${pattern}**`;
  if (pattern.includes('/')) return pattern;
  return `**/${pattern}`;
}

/**
 * Always ignored, whether or not a `.gitignore` is present. This project keeps its
 * `.gitignore` out of version control, so a fresh clone and CI both arrive without one, and
 * without this floor ESLint would try to lint `node_modules` and the build output.
 */
const BASELINE_IGNORES = ['node_modules/**', 'dist/**', 'release/**', 'coverage/**'];

// Anything Git already ignores is unpublished or generated, so it must never surface as a lint failure.
function readIgnoreFile(file) {
  let contents;
  try {
    contents = readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('!'))
    .map(toGlob);
}

const ignores = [
  ...new Set([
    ...BASELINE_IGNORES,
    ...[join(rootDir, '.gitignore'), join(rootDir, '.git', 'info', 'exclude')].flatMap(
      readIgnoreFile,
    ),
  ]),
];

export default tseslint.config(
  {
    ignores,
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: [
      'vite.config.ts',
      'vite.electron.node.config.ts',
      'vite.electron.renderer.config.ts',
      'vite.extension.gecko.config.ts',
      'vite.manifest.ts',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Build tooling that runs under Node directly, outside any bundler.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  {
    // Electron's main process and the preload run in Node, not the browser.
    files: ['electron/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
);
