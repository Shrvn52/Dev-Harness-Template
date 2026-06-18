import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

// ─────────────────────────────────────────────────────────────────────────────
// Mechanical convention enforcement.
//
// The discipline: every convention an agent could violate is either a hard lint
// failure here (or an arch test under tests/arch/), or documented in CLAUDE.md
// with its failure mode. Review then only ever does genuine judgment work.
//
// THE PROMOTION LOOP: when a review finding recurs, encode it as the smallest
// expressible AST fingerprint below + a message naming the canonical fix. One
// worked example ships in T1_BACKEND_RULES; add more selectors as your own
// conventions emerge. See CLAUDE.md → "Conventions".
// ─────────────────────────────────────────────────────────────────────────────

// Rules that apply equally to backend/src and shared/.
const COMMON_TS_RULES = {
  ...tseslint.configs.recommended.rules,
  // Node built-ins must use the `node:` prefix (`node:fs`, not `fs`). Keeps the
  // import surface unambiguous and future-proof against a userland `fs` package.
  'no-restricted-imports': ['error', {
    patterns: [
      {
        group: ['fs', 'fs/promises', 'path', 'os', 'crypto', 'child_process', 'url', 'util', 'stream', 'events', 'net', 'http', 'https', 'buffer', 'assert', 'zlib'],
        message: "Use the 'node:' prefix (e.g. 'node:fs').",
      },
    ],
  }],
  '@typescript-eslint/no-explicit-any': 'warn',
  // `_`-prefixed vars/args/catch-bindings are intentional discards.
  '@typescript-eslint/no-unused-vars': ['error', {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    caughtErrorsIgnorePattern: '^_',
    ignoreRestSiblings: true,
  }],
};

// Backend-only framework conventions. WORKED EXAMPLE of the promotion loop:
// one custom selector that bans `throw new Error(...)` in favour of the typed
// errors in `lib/errors.ts`. The teaching is in the shape, not the rule —
// smallest AST fingerprint + a message that names the canonical fix.
const T1_BACKEND_RULES = {
  'no-restricted-syntax': ['error',
    {
      selector: "ThrowStatement > NewExpression[callee.name='Error']",
      message: "Use a typed error from 'lib/errors.ts' (BadRequestError | NotFoundError | ConflictError | ValidationError | ServiceUnavailableError | AppError). They map to the right HTTP status via routeErrorHandler — plain `new Error()` reaches onError as a 500 and bypasses the mapping.",
    },
  ],
  // Structured logging only in services/routes. `console.*` is reserved for the
  // boot path (index.ts, config.ts — whitelisted below) and the unknown-error
  // fallback in route-error-handler.ts (inline-disabled there with rationale).
  'no-console': 'error',
};

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', 'backend/dist/**', 'frontend/dist/**', '.claude/**', '.archon/**'] },

  // Backend — common rules + the worked framework selector.
  {
    files: ['backend/src/**/*.ts'],
    languageOptions: { parser: tsparser },
    plugins: { '@typescript-eslint': tseslint },
    rules: { ...COMMON_TS_RULES, ...T1_BACKEND_RULES },
  },

  // Shared — same baseline, minus the HTTP-specific backend rules (shared code
  // has no Hono context; forcing AppError on a pure-util guard would be wrong).
  {
    files: ['shared/**/*.ts'],
    languageOptions: { parser: tsparser },
    plugins: { '@typescript-eslint': tseslint },
    rules: COMMON_TS_RULES,
  },

  // Tests — baseline minus no-explicit-any (mock plumbing type-erases freely).
  {
    files: ['tests/**/*.ts'],
    languageOptions: { parser: tsparser },
    plugins: { '@typescript-eslint': tseslint },
    rules: { ...COMMON_TS_RULES, '@typescript-eslint/no-explicit-any': 'off' },
  },

  // Boot-path exception: console.* is legitimate before the logger could fire.
  {
    files: ['backend/src/index.ts', 'backend/src/config.ts'],
    rules: { 'no-console': 'off' },
  },

  // Frontend.
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    languageOptions: { parser: tsparser },
    plugins: { '@typescript-eslint': tseslint, 'react-hooks': reactHooks },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
];
