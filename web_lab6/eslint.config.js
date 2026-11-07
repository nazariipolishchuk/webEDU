import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist/', 'dist-dev/']), // build results are not checked
  js.configs.recommended,
  {
    // src and vite.config.ts. The rules that need types read them from tsconfig.app/node.json.
    files: ['**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: globals.browser, // window, document, fetch...
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      eqeqeq: 'error',
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // The language tasks and the strict mode page print their results to the console on purpose
    files: ['src/js/tasks/**/*.ts', 'src/js/strict-on.ts', 'src/public/js/strict-off.js'],
    rules: { 'no-console': 'off' },
  },
  {
    // A classic script: it has to run in sloppy mode, which a module never does
    files: ['src/public/**/*.js'],
    languageOptions: { sourceType: 'script', globals: globals.browser },
  },
  {
    // Configuration files run in Node.js
    files: ['*.config.js', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  prettier, // last: turns off the rules about formatting, Prettier owns them
]);
