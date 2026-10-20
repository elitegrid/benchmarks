// ── Measurement primitives ─────────────────────────────────────────────────
//
// Every number the benchmark reports comes from this file, so both grids are
// measured by literally the same code path. The grid-specific parts are
// isolated behind `Driver` — a component registers one, and the harness never
// knows which grid it is driving.
//
// Two timings are reported per action:
//
//   commitMs — trigger → first DOM mutation inside the grid. This is the
//              library's own work: engine pass + framework render + DOM write.
//   paintMs  — trigger → the browser has painted the result. This is what a
//              user perceives. Measured with rAF + MessageChannel, which the
//              spec guarantees runs after the frame is presented (a plain
//              double-rAF resolves *before* the second frame paints and
//              undercounts by up to one frame).
//
// commitMs is the fairer engine comparison; paintMs is the fairer UX
// comparison. Reporting only one of them would flatter whichever library
// happens to do more work off the critical path, so we report both.

/**
 * Who does the work behind a measured action.
 *
 * This exists because not every library in the comparison implements every
 * operation. react-data-grid has no filtering at all, and its sorting is
 * state-only — it reports which column you clicked and you sort the array
 * yourself. Timing that and printing it in the same column as AG Grid's
 * filter engine would be comparing our sort to their nothing.
 *
 *   'library' — the library does it. Comparable.
 *   'harness' — the library exposes the intent but the work is ours. The
 *               number is real but it is not a measurement OF that library.
 *   'none'    — the library cannot do it. The action is skipped entirely
 *               rather than faked.
 */
export type Provenance = 'library' | 'harness' | 'none'

export interface DriverProvides {
  sort: Provenance
  filter: Provenance
}

export interface Driver {
  /** Which measured actions this library implements itself. */
  provides: DriverProvides
  /** CSS selector matching one rendered row. */
  rowSelector: string
  /** The element that actually scrolls. */
  scrollEl: () => HTMLElement | null
  /** Element whose subtree mutates when rows change. */
  mutationRoot: () => HTMLElement | null
  sort: (dir: 'asc' | 'desc') => void
  clearSort: () => void
  filter: () => void
  clearFilter: () => void
  /** Rows currently in the DOM (virtualised window, not dataset size). */
  renderedRows: () => number
  /**
   * Cells currently in the DOM. Rows alone cannot see column virtualisation:
   * two grids rendering the same 28 rows differ by 10× in cell count if one
   * windows columns and the other does not, and cell count is what drives
   * layout, paint and heap on a wide grid.
   */
  renderedCells: () => number
}

export type ScrollAxis = 'x' | 'y'

export interface ActionTiming {
  commitMs: number
  paintMs: number
}

export interface ScrollResult {
  frames: number
  p50: number
  p95: number
  p99: number
  max: number
  /**
   * Mean frame interval, and the frames per second it implies.
   *
   * FPS is the metric every published grid benchmark compares on, so it is
   * reported for comparability — but it is derived from the same vsync-capped
   * intervals as the percentiles, so it saturates at the display refresh rate.
   * It answers "does the grid keep up?", never "which grid is quicker?".
   */
  meanMs: number
  fps: number
  /**
   * Frames slower than 33.3 ms — two missed 60 Hz deadlines, which is the
   * point a user actually sees a stutter.
   *
   * The obvious threshold, 16.7 ms, is useless here: rAF is vsync-locked, so a
   * healthy frame lands *at* 16.7 ms and normal scheduling jitter pushes half
   * of them a hair over. Measured at 1k rows, that threshold called 41% of
   * EliteGrid's and 45% of AG Grid's frames "dropped" while both were in fact
   * holding a steady 60 fps. A metric that fires on a grid doing nothing wrong
   * cannot distinguish the two libraries.
   */
  longFrames: number
  longFramePct: number
  /** Rows in the DOM at the end of the run — virtualisation sanity check. */
  renderedRows: number
  /** Cells in the DOM at the end of the run — the column-virtualisation check. */
  renderedCells: number
}

// ── After-paint clock ──────────────────────────────────────────────────────
// rAF fires *before* the frame is painted; a message posted from inside that
// callback is delivered after the frame is presented.
function afterPaint(): Promise<number> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      const channel = new MessageChannel()
      channel.port1.onmessage = () => resolve(performance.now())
      channel.port2.postMessage(0)
    })
  })
}

function firstMutation(root: Node): Promise<number> {
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      observer.disconnect()
      resolve(performance.now())
    })
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    })
  })
}

/**
 * Run `trigger`, then report when the grid's DOM changed and when that change
 * reached the screen. Both clocks start at the same instant, immediately
 * before the trigger.
 */
export async function measure(
  root: Node,
  trigger: () => void
): Promise<ActionTiming> {
  const mutated = firstMutation(root)
  const t0 = performance.now()
  trigger()
  const commit = await mutated
  const paint = await afterPaint()
  return { commitMs: commit - t0, paintMs: paint - t0 }
}

/** Wait until `selector` matches, then until the result is on screen. */
export async function measureUntilPresent(
  selector: string,
  trigger: () => void
): Promise<ActionTiming> {
  const t0 = performance.now()
  trigger()

  let commit = 0
  // Poll per frame: on mount there is no stable subtree to observe yet, so a
  // MutationObserver would need a root that does not exist until React
  // creates it.
  while (!document.querySelector(selector)) {
    await new Promise((r) => requestAnimationFrame(r))
  }
  commit = performance.now()
  const paint = await afterPaint()
  return { commitMs: commit - t0, paintMs: paint - t0 }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]!
}

/**
 * Drive the scroll container for `frames` animation frames, advancing by
 * `stepPx` each frame, and record how long each frame took. This is a
 * sustained-scroll simulation: the grid must re-virtualise every single frame,
 * which is the worst case and the one users notice.
 */
export async function measureScroll(
  driver: Driver,
  frames: number,
  stepPx: number,
  axis: ScrollAxis = 'y'
): Promise<ScrollResult> {
  const el = driver.scrollEl()
  if (!el) throw new Error('scroll container not found')

  // Horizontal is the axis column virtualisation actually governs. It is a
  // separate measurement rather than a replacement: vertical scroll on a wide
  // grid is also affected, because every rendered row carries every rendered
  // cell, but only the horizontal run re-windows COLUMNS every frame.
  const horizontal = axis === 'x'

  const read = () => (horizontal ? el.scrollLeft : el.scrollTop)
  const write = (v: number) => {
    if (horizontal) el.scrollLeft = v
    else el.scrollTop = v
  }

  write(0)
  await afterPaint()

  const durations: number[] = []
  let last = performance.now()
  const maxScroll = horizontal
    ? el.scrollWidth - el.clientWidth
    : el.scrollHeight - el.clientHeight

  for (let i = 0; i < frames; i++) {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        const now = performance.now()
        durations.push(now - last)
        last = now
        // Bounce at the end rather than stopping, so long runs on small
        // datasets still do real virtualisation work every frame.
        const next = read() + stepPx
        write(next > maxScroll ? 0 : next)
        resolve()
      })
    })
  }

  // Drop the first sample: it measures the gap between the setup paint and the
  // first driven frame, not the grid's per-frame cost.
  durations.shift()

  const sorted = [...durations].sort((a, b) => a - b)
  const longFrames = durations.filter((d) => d > 33.3).length
  const meanMs =
    durations.reduce((a, b) => a + b, 0) / Math.max(1, durations.length)

  return {
    frames: durations.length,
    meanMs,
    fps: meanMs > 0 ? 1000 / meanMs : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] ?? 0,
    longFrames,
    longFramePct: (longFrames / durations.length) * 100,
    renderedRows: driver.renderedRows(),
    renderedCells: driver.renderedCells(),
  }
}

// ── Harness surface ────────────────────────────────────────────────────────
// Playwright talks to the page only through `window.__bench`.

export interface BenchAPI {
  ready: boolean
  rowCount: number
  library: string
  mount: () => Promise<ActionTiming>
  sort: (dir: 'asc' | 'desc') => Promise<ActionTiming>
  clearSort: () => Promise<ActionTiming>
  filter: () => Promise<ActionTiming>
  clearFilter: () => Promise<ActionTiming>
  scroll: (
    frames: number,
    stepPx: number,
    axis?: ScrollAxis
  ) => Promise<ScrollResult>
  heapBytes: () => number
  renderedRows: () => number
  renderedCells: () => number
  provides: () => DriverProvides
}

declare global {
  interface Window {
    __bench: BenchAPI | undefined
    __benchMount?: () => void
    __benchRowSelector?: string
  }
}

export function installBench(
  library: string,
  rowCount: number,
  getDriver: () => Driver | null
): void {
  const driver = (): Driver => {
    const d = getDriver()
    if (!d) throw new Error('grid not mounted')
    return d
  }
  const root = (): Node => {
    const r = driver().mutationRoot()
    if (!r) throw new Error('mutation root not found')
    return r
  }

  window.__bench = {
    // True the moment the surface exists — the page shell installs this during
    // its first render, before any grid is mounted, which is exactly the point
    // Playwright is allowed to start driving.
    ready: true,
    library,
    rowCount,
    mount: () =>
      measureUntilPresent(
        // The selector cannot come from the driver: before mount there is no
        // driver. It is registered by the page shell instead.
        window.__benchRowSelector!,
        () => window.__benchMount!()
      ),
    sort: (dir) => measure(root(), () => driver().sort(dir)),
    clearSort: () => measure(root(), () => driver().clearSort()),
    filter: () => measure(root(), () => driver().filter()),
    clearFilter: () => measure(root(), () => driver().clearFilter()),
    scroll: (frames, stepPx, axis) =>
      measureScroll(driver(), frames, stepPx, axis),
    heapBytes: () =>
      (performance as unknown as { memory?: { usedJSHeapSize: number } })
        .memory?.usedJSHeapSize ?? 0,
    renderedRows: () => driver().renderedRows(),
    renderedCells: () => driver().renderedCells(),
    provides: () => driver().provides,
  }
}
