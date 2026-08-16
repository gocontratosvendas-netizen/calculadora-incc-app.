import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/modules/financeiro/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/modules/financeiro/engine/**/*.ts'],
      exclude: ['src/modules/financeiro/engine/**/*.test.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 90,
      },
    },
  },
})
