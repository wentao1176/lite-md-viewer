import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    css: { include: [/homework\.css/] },
    environment: 'node',
    include: ['electron/**/*.test.ts', 'src/**/*.test.ts']
  }
})
