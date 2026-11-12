import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:4173', channel: process.env.BRAINAGE_BROWSER || undefined },
  webServer: { command: 'npm run dev -- --host localhost --port 4173 --strictPort', url: 'http://localhost:4173' },
})
