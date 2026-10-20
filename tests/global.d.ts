// Mirrors the surface apps/benchmark installs on `window`. Kept as a
// declaration rather than an import so the spec never pulls the app's module
// graph into the Playwright process.

interface BenchActionTiming {
  commitMs: number
  paintMs: number
}

interface BenchScrollResult {
  frames: number
  p50: number
  p95: number
  p99: number
  max: number
  meanMs: number
  fps: number
  longFrames: number
  longFramePct: number
  renderedRows: number
  renderedCells: number
}

interface BenchAPI {
  ready: boolean
  rowCount: number
  library: string
  mount(): Promise<BenchActionTiming>
  sort(dir: 'asc' | 'desc'): Promise<BenchActionTiming>
  clearSort(): Promise<BenchActionTiming>
  filter(): Promise<BenchActionTiming>
  clearFilter(): Promise<BenchActionTiming>
  scroll(
    frames: number,
    stepPx: number,
    axis?: 'x' | 'y'
  ): Promise<BenchScrollResult>
  heapBytes(): number
  renderedRows(): number
  renderedCells(): number
  /** Which measured actions the library itself implements. */
  provides(): {
    sort: 'library' | 'harness' | 'none'
    filter: 'library' | 'harness' | 'none'
  }
}

interface Window {
  __bench?: BenchAPI
}
