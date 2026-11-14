import { defineConfig } from 'vite-plus';

// Core owns these; the plugin reaches them through erxes-ui's public exports.
const restrictedImports = {
  patterns: [
    {
      group: [
        '@radix-ui/*',
        'radix-ui',
        '@apollo/*',
        'graphql',
        'mongoose',
        'erxes-ui/*',
        '!erxes-ui/*.css',
      ],
      message: 'Use erxes-ui through its public exports; data goes through oRPC (ui/src/orpc.ts).',
    },
    {
      group: ['@erxes/core-db', '@erxes/core-db/*'],
      message:
        "Core's tables are core's. Reach core through @erxes/plugin-sdk (api/src/core.ts); the plugin's own tables are in api/src/db.",
    },
  ],
};

export default defineConfig({
  fmt: {
    singleQuote: true,
    sortPackageJson: true,
    ignorePatterns: [
      '**/node_modules/**',
      '**/dist/**',
      'coverage/**',
      'api/drizzle/**',
      'pnpm-lock.yaml',
    ],
  },
  lint: {
    plugins: ['typescript', 'unicorn', 'oxc', 'import', 'vitest', 'node'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    categories: { correctness: 'error' },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ['**/node_modules/**', '**/dist/**', 'coverage/**'],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      // `const { orgId, ...columns } = ...` drops a field on purpose.
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
      'no-restricted-imports': ['error', restrictedImports],
      'import/no-default-export': 'error',
      'import/no-cycle': 'error',
      // The API logs through pino (api/src/logger.ts).
      'no-console': 'error',
      'no-debugger': 'error',
      // No TODO/FIXME/XXX left in code: finish it or don't write it.
      'no-warning-comments': 'error',
      'typescript/no-explicit-any': 'error',
      'typescript/no-unsafe-type-assertion': 'error',
      'typescript/no-non-null-assertion': 'error',
      'typescript/ban-ts-comment': 'error',
      'typescript/no-deprecated': 'error',
      'typescript/no-floating-promises': 'error',
      'typescript/consistent-type-imports': 'error',
      'typescript/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
      'oxc/no-accumulating-spread': 'error',
      // Settings are read once, validated, in api/src/config.ts.
      'node/no-process-env': 'error',
    },
    overrides: [
      {
        // The plugin's code. Every agent reads a file whole: split by
        // responsibility, not into part1/part2. The migration kit is a
        // one-off tool, outside the limits.
        files: ['api/**', 'ui/**'],
        rules: {
          'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
          'max-lines-per-function': [
            'error',
            { max: 80, skipBlankLines: true, skipComments: true, IIFEs: true },
          ],
        },
      },
      {
        files: ['api/**'],
        env: { node: true },
      },
      {
        files: ['ui/**'],
        plugins: ['react', 'jsx-a11y'],
        env: { browser: true },
        rules: {
          'no-restricted-globals': [
            'error',
            { name: 'fetch', message: 'Call the API through ui/src/orpc.ts.' },
          ],
        },
      },
      {
        // Where settings come from the environment: the API's config, tests and build configs.
        files: [
          'api/src/config.ts',
          'api/src/test/**',
          'vite.config.ts',
          'api/drizzle.config.ts',
          'ui/rsbuild.config.ts',
        ],
        rules: { 'node/no-process-env': 'off' },
      },
      {
        // Command-line tools that print to the terminal and read their settings.
        files: ['migration/**', 'scripts/**'],
        env: { node: true },
        rules: { 'no-console': 'off', 'node/no-process-env': 'off' },
      },
      {
        // Tools load these through their default export.
        files: ['vite.config.ts', 'api/drizzle.config.ts', 'ui/rsbuild.config.ts'],
        rules: { 'import/no-default-export': 'off' },
      },
    ],
  },
  test: {
    projects: [
      {
        root: 'api',
        test: {
          name: 'api',
          include: ['src/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['src/test/setup.ts'],
          // config.ts needs these; tests never reach core.
          env: {
            CORE_URL: 'http://127.0.0.1:9',
            PLUGIN_SECRET: 'test-secret-'.padEnd(32, 'x'),
            LOG_LEVEL: 'silent',
          },
        },
      },
    ],
  },
});
