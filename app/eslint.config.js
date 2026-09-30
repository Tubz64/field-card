// ESLint 10 flat config. Replaces eslint-config-expo, whose React/import
// plugins don't support ESLint 10 yet. Covers TypeScript, React hooks and
// Expo's own rules (e.g. EXPO_PUBLIC_ env var usage).
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');
const expo = require('eslint-plugin-expo');
const globals = require('globals');

module.exports = tseslint.config(
  { ignores: ['dist/', '.expo/', 'node_modules/', 'expo-env.d.ts'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    plugins: { expo },
    rules: {
      'expo/no-env-var-destructuring': 'error',
      'expo/no-dynamic-env-var': 'error',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
