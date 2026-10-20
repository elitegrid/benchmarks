import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// NOTE: there are deliberately NO module aliases here.
//
// EliteGrid's own monorepo aliases `@elitegrid/react` to the package SOURCE so
// the harness measures the working tree. This repo does the opposite on
// purpose: it resolves `@elitegrid/react` from node_modules, so it measures
// the PUBLISHED build that anyone installing from npm actually gets. That is
// the whole point of this repo existing — the numbers here are reproducible by
// a stranger, which numbers measured against unpublished source are not.
//
// A consequence worth knowing: these figures may differ slightly from any
// published internally against source.
export default defineConfig({
  plugins: [react()],
  build: {
    // Benchmarks run against a production build: dev-mode React and unbundled
    // ESM would measure Vite's module graph, not the grids.
    minify: 'esbuild',
    sourcemap: false,
  },
})
