import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: './vitest.setup.ts',
    exclude: ['node_modules', 'dist'],
    environment: 'node',
    globals: true,
    dir: 'src/__tests__',
    root: 'src/',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/types/**',
        '**/*.d.ts'
      ],
      thresholds: {
        branches: 50,
        functions: 70,
        lines: 70,
        statements: 70,
      }
    },
    testTimeout: 30000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    },
    silent: true,
  },
})