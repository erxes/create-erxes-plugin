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
    plugins: ['typescript', 'unicorn', 'oxc', 'import', 'vitest'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    categories: { correctness: 'error' },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ['**/node_modules/**', '**/dist/**', 'coverage/**'],
    rules: {
      'vite-plus/prefer-vite-plus-imports': 'error',
      'no-unused-vars': 'error',
      'no-restricted-imports': ['error', restrictedImports],
      'import/no-default-export': 'error',
      'import/no-cycle': 'error',
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      'no-debugger': 'error',
      'typescript/no-explicit-any': 'error',
      'typescript/no-unsafe-type-assertion': 'error',
      'typescript/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
      'oxc/no-accumulating-spread': 'error',
    },
    overrides: [
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
