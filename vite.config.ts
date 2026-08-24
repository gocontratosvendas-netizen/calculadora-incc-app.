import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: [
      'src/modules/financeiro/**/*.test.ts',
      'src/modules/configuracoes/**/*.test.ts',
      'src/lib/casos.test.ts',
      'src/parseExtratoPdf.test.ts',
      'src/inccTable.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/modules/financeiro/engine/**/*.ts',
        'src/modules/configuracoes/autorizacao/**/*.ts',
      ],
      exclude: ['**/*.test.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 90,
      },
    },
  },
})
