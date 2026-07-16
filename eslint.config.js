// eslint.config.js
import boundaries from 'eslint-plugin-boundaries';
import tsParser from '@typescript-eslint/parser';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      boundaries,
      'react-hooks': reactHooks,
    },
    settings: {
      'boundaries/elements': [
        { type: 'app',      pattern: 'src/app/*' },
        { type: 'features', pattern: 'src/features/*', capture: ['feature'] },
        { type: 'state',    pattern: 'src/state/*' },
        { type: 'services', pattern: 'src/services/*' },
        { type: 'audio',    pattern: 'src/audio/*' },
        { type: 'domain',   pattern: 'src/domain/*' },
        { type: 'shared',   pattern: 'src/shared/*' },
        { type: 'workers',  pattern: 'src/workers/*' },
      ],
    },
    rules: {
      // ── React Hooks ──────────────────────────────────────
      ...reactHooks.configs.recommended.rules,

      // ── Boundaries ───────────────────────────────────────
      'boundaries/dependencies': ['error', {
        default: 'disallow',
        policies: [
          {
            from: [{ type: 'app' }],
            allow: [
              { type: 'features' },
              { type: 'state' },
              { type: 'services' },
              { type: 'audio' },
              { type: 'domain' },
              { type: 'shared' },
            ],
          },
          {
            from: [{ type: 'features' }],
            allow: [
              { type: 'shared' },
              { type: 'state' },
              { type: 'services' },
              { type: 'domain' },
              {
                type: 'features',
                matcher: { capture: { feature: '!{{feature}}' } },
              },
            ],
          },
          {
            from: [{ type: 'state' }],
            allow: [
              { type: 'services' },
              { type: 'audio' },
              { type: 'domain' },
              { type: 'shared' },
            ],
          },
          {
            from: [{ type: 'services' }],
            allow: [
              { type: 'audio' },
              { type: 'domain' },
              { type: 'shared' },
            ],
          },
          {
            from: [{ type: 'audio' }],
            allow: [
              { type: 'domain' },
              { type: 'shared' },
            ],
          },
          {
            from: [{ type: 'workers' }],
            allow: [
              { type: 'domain' },
              { type: 'shared' },
            ],
          },
          {
            from: [{ type: 'shared' }],
            allow: [
              { type: 'shared' },
              { type: 'domain' },
            ],
          },
          {
            from: [{ type: 'domain' }],
            allow: [
              { type: 'domain' },
            ],
          },
        ],
      }],
    },
  },
];