import { defineConfig, devices } from '@playwright/test'

const PORT = 5190

export default defineConfig({
  testDir: './tests',
  // One worker, no parallelism, no retries: every parallel worker is another
  // process competing for the same CPU, and a retry would silently replace a
  // slow sample with a fast one. Both destroy the numbers.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // One test drives ALL FOUR libraries (interleaved), so a config costs 24
  // page loads: 4 warm-ups + 5 repetitions each. At 1M rows and at 300
  // columns that is genuinely slow, and a timeout here would truncate a run
  // rather than fail a feature.
  timeout: 30 * 60_000,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    launchOptions: {
      args: [
        // performance.memory is bucketed to 100 KB granularity without this,
        // which is far too coarse to compare heap footprints.
        '--enable-precise-memory-info',
        // Lets the harness force a GC before sampling the heap, so we measure
        // retained memory rather than whatever garbage happened to survive.
        '--js-flags=--expose-gc',
        // Removes a variable that has nothing to do with any grid: without
        // this, Chrome throttles background rAF and the scroll test would
        // measure the throttler.
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
    },
  },
  projects: [{ name: 'bench-chromium' }],
  webServer: {
    // Production build, not dev: dev mode ships unminified React with
    // development-only warnings and per-module HTTP requests. No grid's real
    // performance is visible through that.
    command: `pnpm exec vite build && pnpm exec vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
