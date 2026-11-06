import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['dist/', 'dist-dev/']), // build results are not checked
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: globals.browser }, // window, document, fetch...
    rules: {
      eqeqeq: 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // The language tasks and the strict mode page print their results to the console on purpose
    files: ['src/js/tasks/**/*.js', 'src/js/strict-on.js', 'src/public/js/strict-off.js'],
    rules: { 'no-console': 'off' },
  },
  {
    // A classic script: it has to run in sloppy mode, which a module never does
    files: ['src/public/**/*.js'],
    languageOptions: { sourceType: 'script' },
  },
  {
    // Configuration files run in Node.js
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
  prettier, // last: turns off the rules about formatting, Prettier owns them
]);
