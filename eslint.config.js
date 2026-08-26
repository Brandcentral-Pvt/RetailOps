import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// ─── Design-system guard: no raw hex colors in source ────────────────────────
// All colors must come from the token system (src/styles/tokens.css, --bc-*)
// or shared theme constants. This rule starts as a WARNING (Phase 1) and
// flips to ERROR per-file as inline styles are converted (Phase 3).
const bcTokensPlugin = {
  rules: {
    'no-raw-hex': {
      meta: {
        type: 'suggestion',
        docs: {
          description:
            'Disallow raw hex color literals — use var(--bc-*) tokens or shared constants (see src/styles/DESIGN-SYSTEM.md)',
        },
        schema: [],
        messages: {
          rawHex:
            "Raw hex color '{{hex}}' — use a --bc-* token (src/styles/tokens.css) or a shared constant instead",
        },
      },
      create(context) {
        const HEX = /^#(?:[\da-fA-F]{3,4}|[\da-fA-F]{6}|[\da-fA-F]{8})$/
        return {
          Literal(node) {
            if (typeof node.value === 'string' && HEX.test(node.value.trim())) {
              context.report({
                node,
                messageId: 'rawHex',
                data: { hex: node.value.trim() },
              })
            }
          },
        }
      },
    },
  },
}

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'backend', 'src/CometChat']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
    ],
    plugins: { 'bc-tokens': bcTokensPlugin },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Phase 1: warning-only. Flip to 'error' per-directory as conversions land.
      'bc-tokens/no-raw-hex': 'warn',
    },
  },
  {
    // TypeScript island: only the design-system guard runs here for now.
    // Full TS linting is tracked separately (tsconfig strict work).
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    // Registering the TS plugin so legacy inline eslint-disable directives
    // referencing its rules resolve; no TS rules are enabled here.
    plugins: { '@typescript-eslint': tseslint.plugin, 'bc-tokens': bcTokensPlugin },
    rules: {
      'bc-tokens/no-raw-hex': 'warn',
    },
  },
])
