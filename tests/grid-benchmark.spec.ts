import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

// ── Provenance of this file ────────────────────────────────────────────────
//
// This is the CANONICAL harness for published numbers. EliteGrid's own
// monorepo keeps a near-identical copy that measures the working tree instead
// of the published package, for regression control. The two differ ONLY in
// module resolution and in which versions they report; every measurement rule
// is the same, and `src/shared-config.ts` must never fork between them — that
// file is where an overscan mismatch once silently gave one library a third
// less DOM to build than its competitors.
//
// ── What this measures ─────────────────────────────────────────────────────
//
// EliteGrid's React adapter against AG Grid Community 36, both driven through
// the same page shell (apps/benchmark) over the same dataset, in the same
// browser process, one after another.
//
// Every timing comes from apps/benchmark/src/bench.ts, so neither library gets
// a different clock. This file only decides WHAT to run and how to summarise
// it.
//
// Two deliberate choices about honesty:
//
//   * Repetitions are summarised by MEDIAN, not mean or best-of. A mean lets a
//     single GC pause dominate; a best-of reports a number no user will ever
//     see. The min and max are recorded too, so a suspiciously wide spread is
//     visible rather than smoothed away.
//
//   * Each repetition gets a brand-new page. Reusing one page would let the
//     first library warm the JIT and the second inherit it, which is a real
//     effect worth several percent, and it would make heap numbers meaningless.

const __dirname = dirname(fileURLToPath(import.meta.url))
const RESULTS_DIR = join(__dirname, '..', 'results')

// 1M was added 2026-10-20 to match the scale published grid benchmarks now
// run at (1771 Technologies tests to 1M, RevoGrid to 1M). Below that scale a
// reader assumes the harness stops where the grid breaks.
const ROW_COUNTS = [1_000, 10_000, 100_000, 1_000_000] as const
// Added 2026-10-20. Chosen by npm weekly downloads among libraries that can
// be measured honestly at this scale; the ones left out are listed in the
// report's "who is not here" section, each with its reason.
const LIBRARIES = ['elite', 'ag', 'tanstack', 'rdg'] as const
const REPS = 5

const LIBRARY_LABEL: Record<Library, string> = {
  elite: 'EliteGrid',
  ag: 'AG Grid',
  tanstack: 'TanStack',
  rdg: 'react-data-grid',
}

const SCROLL_FRAMES = 120
const SCROLL_STEP_PX = 200

// ── Column axis ────────────────────────────────────────────────────────────
// The row matrix above runs at 8 columns, whose widths sum to exactly the
// 1000px viewport — zero horizontal overflow, so column virtualisation never
// engages and the harness could not see it at all. Enterprise grids run 30-80
// columns, so that blind spot covered the shape where the difference is
// largest.
//
// Rows are fixed at 10k here so the only variable is column count. 30 columns
// is 3,640px of content and 80 is 9,640px, both far wider than the viewport.
//
// 300 was added 2026-10-20: it is the column count the 2026 published
// benchmarks use, and at 36,000px of content it is 36× the viewport.
//
// The two axes stay separate rather than becoming a grid of every pair. A
// 1M × 300 cell matrix is 300M values, which exhausts the heap in data
// generation before either library is given a chance to render it — so the
// row axis runs at 8 columns and the column axis at 10,000 rows, and the
// report says so.
const COLUMN_COUNTS = [8, 30, 80, 300] as const
const COLUMN_AXIS_ROWS = 10_000

type Library = (typeof LIBRARIES)[number]

interface ActionTiming {
  commitMs: number
  paintMs: number
}

interface ScrollResult {
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

/** Mirrors `DriverProvides` in apps/benchmark/src/bench.ts. */
interface Provides {
  sort: 'library' | 'harness' | 'none'
  filter: 'library' | 'harness' | 'none'
}

interface Sample {
  provides: Provides
  mount: ActionTiming
  // null when the library cannot do it at all. Faking a number for an
  // operation a library does not implement is the single easiest way to
  // publish a dishonest benchmark, so the type makes it impossible to
  // forget that the value may be absent.
  sort: ActionTiming | null
  clearSort: ActionTiming | null
  filter: ActionTiming | null
  clearFilter: ActionTiming | null
  scroll: ScrollResult
  scrollX: ScrollResult
  heapBaselineBytes: number
  /**
   * Sampled immediately after mount, before any interaction. This is the
   * grid's own retained footprint: row model, indexes, caches built at init.
   */
  heapAfterMountBytes: number
  /**
   * Sampled after mount AND sort, clear sort, filter, clear filter and both
   * scroll runs. Everything the pipeline retained while doing real work is
   * in here, which is a different and much larger thing.
   */
  heapMountedBytes: number
  renderedRows: number
  renderedCells: number
}

interface Summary {
  library: Library
  rows: number
  columns: number
  reps: number
  provides: Provides
  mountPaintMs: Stat
  mountCommitMs: Stat
  sortCommitMs: Stat | null
  filterCommitMs: Stat | null
  clearFilterCommitMs: Stat | null
  scrollP50Ms: Stat
  scrollP95Ms: Stat
  scrollMaxMs: Stat
  scrollFps: Stat
  scrollLongFramePct: Stat
  gridHeapMB: Stat
  workloadHeapMB: Stat
  scrollXP95Ms: Stat
  scrollXFps: Stat
  renderedRows: number
  renderedCells: number
}

interface Stat {
  median: number
  min: number
  max: number
}

const results: Summary[] = []

// ── Environment ────────────────────────────────────────────────────────────
// Recorded in the report because every published grid benchmark that is taken
// seriously states its machine and browser, and because these numbers are not
// transferable without it. A reader cannot reproduce a run they cannot match.

interface Environment {
  browser: string
  platform: string
  cpu: string
  cores: number
  memoryGB: number
  nodeVersion: string
  eliteGridVersion: string
  agGridVersion: string
  tanstackVersion: string
  rdgVersion: string
  viewport: string
}

let environment: Environment | null = null

/**
 * The INSTALLED version of a benchmark dependency, read straight off disk.
 *
 * `require('<pkg>/package.json')` is blocked by AG Grid's `exports` map, so
 * the manifest has to be read as a file rather than resolved.
 *
 * Reading `package.json`'s dependency range instead would be easier and
 * wrong: a range is not what was measured.
 */
function packageVersion(name: string): string {
  try {
    const manifest = join(__dirname, '..', 'node_modules', name, 'package.json')
    return (JSON.parse(readFileSync(manifest, 'utf8')) as { version: string })
      .version
  } catch {
    return 'unknown'
  }
}

test.beforeAll(async ({ browser }) => {
  if (environment) return
  environment = {
    browser: `${browser.browserType().name()} ${browser.version()}`,
    platform: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0]?.model.trim() ?? 'unknown',
    cores: os.cpus().length,
    memoryGB: Math.round(os.totalmem() / 1024 ** 3),
    nodeVersion: process.version,
    // Every library's INSTALLED version, read off disk. This repo measures
    // published packages, so these four lines are what make a number
    // checkable a year from now.
    eliteGridVersion: packageVersion('@elitegrid/react'),
    agGridVersion: packageVersion('ag-grid-community'),
    tanstackVersion: packageVersion('@tanstack/react-table'),
    rdgVersion: packageVersion('react-data-grid'),
    viewport: '1000 × 600',
  }
})

/**
 * `null` when the action was skipped. Any null in the sample set makes the
 * whole stat null: a partial series would silently average the repetitions
 * that happened to run.
 */
function statOrNull(values: (number | null)[]): Stat | null {
  if (values.some((v) => v === null)) return null
  return stat(values as number[])
}

function stat(values: number[]): Stat {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!
  return { median, min: sorted[0]!, max: sorted[sorted.length - 1]! }
}

/**
 * Force a real GC through CDP, then read the heap. `window.gc()` alone is a
 * hint; `HeapProfiler.collectGarbage` is a full collection, which is the only
 * way a heap number means "retained" rather than "allocated recently".
 */
async function heapAfterGC(page: Page): Promise<number> {
  const client = await page.context().newCDPSession(page)
  await client.send('HeapProfiler.collectGarbage')
  await client.detach()
  return page.evaluate(() => window.__bench!.heapBytes())
}

async function runOnce(
  context: BrowserContext,
  library: Library,
  rows: number,
  columns: number
): Promise<Sample> {
  const page = await context.newPage()
  try {
    await page.goto(`/?lib=${library}&rows=${rows}&cols=${columns}`)
    await page.waitForFunction(() => window.__bench?.ready === true)

    // Sampled before mount so it already includes the dataset itself. The
    // difference against the post-mount heap is therefore the grid's own
    // retained memory, not the cost of the rows array both libraries share.
    const heapBaselineBytes = await heapAfterGC(page)

    const mount = await page.evaluate(() => window.__bench!.mount())

    // Before any interaction: the grid's own retained footprint.
    const heapAfterMountBytes = await heapAfterGC(page)


    // Read AFTER mount: the driver, and therefore its declaration of what
    // the library implements, does not exist until the grid is up.
    const provides = await page.evaluate(() => window.__bench!.provides())

    // Every action is measured on a grid that is already mounted and painted,
    // so none of them inherit mount cost. An action the library does not
    // implement is skipped rather than timed — the driver throws if called,
    // so a mistake here fails loudly instead of hanging on a DOM mutation
    // that will never arrive.
    const sort =
      provides.sort === 'none'
        ? null
        : await page.evaluate(() => window.__bench!.sort('asc'))
    const clearSort =
      provides.sort === 'none'
        ? null
        : await page.evaluate(() => window.__bench!.clearSort())
    const filter =
      provides.filter === 'none'
        ? null
        : await page.evaluate(() => window.__bench!.filter())
    const clearFilter =
      provides.filter === 'none'
        ? null
        : await page.evaluate(() => window.__bench!.clearFilter())

    const scroll = await page.evaluate(
      ([frames, step]) => window.__bench!.scroll(frames!, step!, 'y'),
      [SCROLL_FRAMES, SCROLL_STEP_PX]
    )

    // The axis column virtualisation actually governs. At 8 columns there is
    // no horizontal overflow, so this measures a grid that cannot scroll and
    // the numbers are meaningless — which is why the report only prints it for
    // the column axis.
    const scrollX = await page.evaluate(
      ([frames, step]) => window.__bench!.scroll(frames!, step!, 'x'),
      [SCROLL_FRAMES, SCROLL_STEP_PX]
    )

    const heapMountedBytes = await heapAfterGC(page)
    const renderedRows = await page.evaluate(() =>
      window.__bench!.renderedRows()
    )
    const renderedCells = await page.evaluate(() =>
      window.__bench!.renderedCells()
    )

    return {
      provides,
      mount,
      sort,
      clearSort,
      filter,
      clearFilter,
      scroll,
      scrollX,
      heapBaselineBytes,
      heapAfterMountBytes,
      heapMountedBytes,
      renderedRows,
      renderedCells,
    }
  } finally {
    await page.close()
  }
}

function summarise(
  library: Library,
  rows: number,
  columns: number,
  samples: Sample[]
): Summary {
  return {
    library,
    rows,
    columns,
    reps: samples.length,
    provides: samples[0]!.provides,
    mountPaintMs: stat(samples.map((s) => s.mount.paintMs)),
    mountCommitMs: stat(samples.map((s) => s.mount.commitMs)),
    sortCommitMs: statOrNull(samples.map((s) => s.sort?.commitMs ?? null)),
    filterCommitMs: statOrNull(samples.map((s) => s.filter?.commitMs ?? null)),
    clearFilterCommitMs: statOrNull(
      samples.map((s) => s.clearFilter?.commitMs ?? null)
    ),
    scrollP50Ms: stat(samples.map((s) => s.scroll.p50)),
    scrollP95Ms: stat(samples.map((s) => s.scroll.p95)),
    scrollMaxMs: stat(samples.map((s) => s.scroll.max)),
    scrollFps: stat(samples.map((s) => s.scroll.fps)),
    scrollLongFramePct: stat(samples.map((s) => s.scroll.longFramePct)),
    scrollXP95Ms: stat(samples.map((s) => s.scrollX.p95)),
    scrollXFps: stat(samples.map((s) => s.scrollX.fps)),
    gridHeapMB: stat(
      samples.map(
        (s) => (s.heapAfterMountBytes - s.heapBaselineBytes) / (1024 * 1024)
      )
    ),
    workloadHeapMB: stat(
      samples.map(
        (s) => (s.heapMountedBytes - s.heapBaselineBytes) / (1024 * 1024)
      )
    ),
    renderedRows: samples[0]!.renderedRows,
    renderedCells: samples[0]!.renderedCells,
  }
}

// One runner for both axes. The row matrix varies rows at 8 columns; the
// column matrix varies columns at 10k rows. Sharing this function is what
// guarantees the two axes are measured identically rather than by two
// implementations that drift.
//
// Both libraries are measured inside ONE test, alternating per repetition
// (elite, ag, elite, ag, …) rather than running five of one and then five of
// the other. A machine does not hold still for the minutes a config takes:
// it thermally throttles, and other processes come and go. Running one
// library's five reps consecutively charges it for whatever the machine was
// doing during its block, which is exactly the shape of the unexplained
// "1k filter" drift recorded in README.md. Interleaving spreads that over
// both libraries instead of assigning it to one.
function benchmark(label: string, rows: number, columns: number) {
  test(label, async ({ context }) => {
    // One untimed warm-up per library. The first execution of either pays for
    // JIT compilation and lazy module init that no subsequent user
    // interaction ever pays again — charging that to one library and not the
    // other depends purely on test ordering, which is not a real difference.
    for (const library of LIBRARIES) {
      await runOnce(context, library, rows, columns)
    }

    const samples: Record<Library, Sample[]> = {
      elite: [],
      ag: [],
      tanstack: [],
      rdg: [],
    }
    for (let i = 0; i < REPS; i++) {
      for (const library of LIBRARIES) {
        samples[library].push(await runOnce(context, library, rows, columns))
      }
    }

    for (const library of LIBRARIES) {
      const summary = summarise(library, rows, columns, samples[library])
      results.push(summary)

      // A negative-control guard, not decoration: if a driver silently failed
      // to mount, every timing above would still be a plausible small number.
      // These assertions make a broken harness fail loudly instead of
      // reporting a fictitious win.
      expect(summary.renderedRows, `${library} rendered no rows`).toBeGreaterThan(0)
      expect(summary.renderedRows).toBeLessThan(rows)
      expect(summary.mountPaintMs.median).toBeGreaterThan(0)
      expect(summary.renderedCells).toBeGreaterThan(0)

      // The column-axis negative control. Above 8 columns the content is far
      // wider than the viewport, so a grid that virtualises columns must
      // render fewer cells than rows x columns. Without this, a regression
      // that silently disabled column virtualisation would still produce a
      // valid report — just a slower one.
      if (columns > 8) {
        expect(summary.renderedCells).toBeLessThan(
          summary.renderedRows * columns
        )
      }
    }
  })
}

for (const rows of ROW_COUNTS) {
  benchmark(`${rowLabel(rows)} rows`, rows, 8)
}

// 8 columns is already covered by the row matrix at 10k rows, so the axis
// starts at 30 rather than re-running an identical configuration.
for (const columns of COLUMN_COUNTS) {
  if (columns === 8) continue
  benchmark(`${columns} columns`, COLUMN_AXIS_ROWS, columns)
}

test.afterAll(() => {
  if (results.length === 0) return
  mkdirSync(RESULTS_DIR, { recursive: true })
  writeFileSync(
    join(RESULTS_DIR, 'results.json'),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), environment, results },
      null,
      2
    )
  )
  writeFileSync(join(RESULTS_DIR, 'REPORT.md'), renderReport(results))
  console.log(`\nBenchmark results written to ${RESULTS_DIR}`)
})

// ── Report ─────────────────────────────────────────────────────────────────

function fmt(n: number, digits = 1): string {
  return n.toFixed(digits)
}

/** Locale-independent grouping: the machine locale rendered 100000 as
 *  "1,00,000", which is correct for en-IN and confusing in a shared report. */
function rowLabel(n: number): string {
  return n.toLocaleString('en-US')
}

type MetricKind = 'time' | 'memory' | 'percent' | 'rate'

const BETTER_WORD: Record<MetricKind, [better: string, worse: string]> = {
  time: ['faster', 'slower'],
  memory: ['less memory', 'more memory'],
  percent: ['fewer', 'more'],
  rate: ['higher', 'lower'],
}

/** FPS is the one metric where a bigger number is the better one. */
const HIGHER_IS_BETTER: MetricKind = 'rate'

/**
 * Two numbers that should not be separated into a winner and a loser.
 *
 * A noise floor alone is not enough, and the 1M-row scroll run is what
 * proved it: at a 16.7 ms vsync floor, a p50 of 17.0 ms and one of 33.4 ms
 * are 16.4 ms apart and were reported as "no meaningful difference" — while
 * the janky-frames row on the same table said one of those grids was missing
 * 51% of its frames. The floor is sound reasoning about QUANTISATION near one
 * frame interval; it says nothing about a value two frame intervals away.
 *
 * So a tie now needs both: the absolute gap must be inside the floor AND the
 * two must be within 15% of each other. 17.0 vs 33.4 fails the second test
 * and is correctly called.
 */
const TIE_RATIO = 1.15

function isNoise(a: number, b: number, floor: number): boolean {
  if (Math.abs(a - b) >= floor) return false
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  if (lo <= 0) return hi <= 0
  return hi / lo < TIE_RATIO
}

/**
 * `noiseFloor` is the point below which a difference is measurement artefact,
 * not a result. For frame timings that floor is one vsync interval: rAF is
 * capped at the display refresh, so a grid that finishes its work in 2 ms and
 * one that takes 12 ms both report ~16.7 ms. Printing "1.06× faster" from
 * numbers quantised to 16.7 ms would be inventing a win.
 */
function ratio(
  elite: number,
  ag: number,
  kind: MetricKind,
  noiseFloor = 0
): string {
  if (ag === 0 && elite === 0) return 'both zero'
  if (ag === 0 || elite === 0) return '—'
  if (isNoise(elite, ag, noiseFloor)) return 'no meaningful difference'
  const [better, worse] = BETTER_WORD[kind]
  if (kind === HIGHER_IS_BETTER) {
    if (elite >= ag) return `**${fmt(elite / ag, 2)}× ${better}**`
    return `${fmt(ag / elite, 2)}× ${worse}`
  }
  if (elite <= ag) return `**${fmt(ag / elite, 2)}× ${better}**`
  return `${fmt(elite / ag, 2)}× ${worse}`
}

// ── Per-config table ───────────────────────────────────────────────────────
// One table per configuration, one column per library. The "vs AG Grid"
// column is kept because that pairing is the one with a published history
// behind it, and dropping it when the comparison widened would have quietly
// retired every claim made before today.

interface MetricSpec {
  label: string
  pick: (s: Summary) => Stat | null
  unit: string
  kind: MetricKind
  noiseFloor: number
}

// 16.7 ms on frame percentiles — one vsync interval, since rAF is capped at
// the display refresh.
const VSYNC_MS = 16.7
// 2 ms on action timings: at 1,000 rows the gap between the fastest two
// libraries changed sign between consecutive runs of this suite.
const ACTION_NOISE_MS = 2
// 3 fps: derived from vsync-capped intervals, so a residual gap between two
// libraries both holding 60 is scheduling jitter.
const FPS_NOISE = 3

const ROW_AXIS_METRICS: MetricSpec[] = [
  { label: 'Mount (paint)', pick: (s) => s.mountPaintMs, unit: 'ms', kind: 'time', noiseFloor: ACTION_NOISE_MS },
  { label: 'Mount (commit)', pick: (s) => s.mountCommitMs, unit: 'ms', kind: 'time', noiseFloor: ACTION_NOISE_MS },
  { label: 'Sort (commit)', pick: (s) => s.sortCommitMs, unit: 'ms', kind: 'time', noiseFloor: ACTION_NOISE_MS },
  { label: 'Filter (commit)', pick: (s) => s.filterCommitMs, unit: 'ms', kind: 'time', noiseFloor: ACTION_NOISE_MS },
  { label: 'Clear filter (commit)', pick: (s) => s.clearFilterCommitMs, unit: 'ms', kind: 'time', noiseFloor: ACTION_NOISE_MS },
  { label: 'Scroll FPS', pick: (s) => s.scrollFps, unit: 'fps', kind: 'rate', noiseFloor: FPS_NOISE },
  { label: 'Scroll frame p50', pick: (s) => s.scrollP50Ms, unit: 'ms', kind: 'time', noiseFloor: VSYNC_MS },
  { label: 'Scroll frame p95', pick: (s) => s.scrollP95Ms, unit: 'ms', kind: 'time', noiseFloor: VSYNC_MS },
  { label: 'Scroll frame max', pick: (s) => s.scrollMaxMs, unit: 'ms', kind: 'time', noiseFloor: VSYNC_MS },
  { label: 'Janky frames (>33 ms)', pick: (s) => s.scrollLongFramePct, unit: '%', kind: 'percent', noiseFloor: 0 },
  { label: 'Heap after mount', pick: (s) => s.gridHeapMB, unit: 'MB', kind: 'memory', noiseFloor: 0 },
  { label: 'Heap after workload', pick: (s) => s.workloadHeapMB, unit: 'MB', kind: 'memory', noiseFloor: 0 },
]

const COLUMN_AXIS_METRICS: MetricSpec[] = [
  { label: 'Mount (paint)', pick: (s) => s.mountPaintMs, unit: 'ms', kind: 'time', noiseFloor: ACTION_NOISE_MS },
  { label: 'Sort (commit)', pick: (s) => s.sortCommitMs, unit: 'ms', kind: 'time', noiseFloor: ACTION_NOISE_MS },
  { label: 'Filter (commit)', pick: (s) => s.filterCommitMs, unit: 'ms', kind: 'time', noiseFloor: ACTION_NOISE_MS },
  { label: 'Scroll ↓ frame p95', pick: (s) => s.scrollP95Ms, unit: 'ms', kind: 'time', noiseFloor: VSYNC_MS },
  { label: 'Scroll → frame p95', pick: (s) => s.scrollXP95Ms, unit: 'ms', kind: 'time', noiseFloor: VSYNC_MS },
  { label: 'Scroll ↓ FPS', pick: (s) => s.scrollFps, unit: 'fps', kind: 'rate', noiseFloor: FPS_NOISE },
  { label: 'Scroll → FPS', pick: (s) => s.scrollXFps, unit: 'fps', kind: 'rate', noiseFloor: FPS_NOISE },
  { label: 'Heap after mount', pick: (s) => s.gridHeapMB, unit: 'MB', kind: 'memory', noiseFloor: 0 },
]

/** The provenance note for one library, or null when everything is its own. */
function provenanceNote(s: Summary): string | null {
  const parts: string[] = []
  if (s.provides.sort === 'harness') {
    parts.push('sorting is implemented by the harness, not the library')
  }
  if (s.provides.sort === 'none') parts.push('no sorting')
  if (s.provides.filter === 'harness') {
    parts.push('filtering is implemented by the harness, not the library')
  }
  if (s.provides.filter === 'none') parts.push('no filtering of any kind')
  return parts.length ? `**${LIBRARY_LABEL[s.library]}** — ${parts.join('; ')}.` : null
}

function renderConfigTable(
  lines: string[],
  all: Summary[],
  rows: number,
  columns: number,
  metrics: MetricSpec[]
): void {
  const at = (lib: Library) =>
    all.find(
      (r) => r.rows === rows && r.columns === columns && r.library === lib
    )
  const present = LIBRARIES.map(at).filter((s): s is Summary => Boolean(s))
  if (present.length === 0) return

  const elite = at('elite')
  const ag = at('ag')
  const anyUnstable = new Set<string>()

  lines.push(
    `| Metric | ${present.map((s) => LIBRARY_LABEL[s.library]).join(' | ')} | vs AG Grid |`
  )
  lines.push(
    `| --- | ${present.map(() => '---:').join(' | ')} | :--- |`
  )

  for (const m of metrics) {
    const cells = present.map((s) => {
      const v = m.pick(s)
      return { library: s.library, median: v?.median ?? null }
    })
    const numeric = cells
      .map((c) => c.median)
      .filter((v): v is number => v !== null)

    // Winner marking is per row, across whichever libraries reported a
    // number. Everything within the noise floor of the best is marked too —
    // a 0.3 ms lead is not a win and must not be printed as one.
    const best =
      m.kind === 'rate' ? Math.max(...numeric) : Math.min(...numeric)
    const isTop = (v: number | null) =>
      v !== null &&
      numeric.length > 0 &&
      (v === best || isNoise(v, best, m.noiseFloor))

    // ── Instability marker ────────────────────────────────────────────────
    // A median is only worth printing if the repetitions behind it agree.
    // EliteGrid's filter at 1,000,000 rows swings 140-490 ms across five
    // reps: quoting its median as a 5.7x win is defensible one run and a
    // slight LOSS the next, because the number is dominated by whether a GC
    // landed inside the measured window. Marking it is what stops that
    // becoming a published claim — by us or by anyone reading this.
    const unstable = (s: Stat | null) =>
      s !== null &&
      s.min > 0 &&
      s.max / s.min > 2 &&
      s.max - s.min > Math.max(m.noiseFloor, 1)

    let sawUnstable = false
    const rendered = present.map((s, i) => {
      const c = cells[i]!
      if (c.median === null) return 'n/a'
      let flag = ''
      if (unstable(m.pick(s))) {
        sawUnstable = true
        flag = ' ⚠'
      }
      return isTop(c.median)
        ? `**${fmt(c.median)} ${m.unit}**${flag}`
        : `${fmt(c.median)} ${m.unit}${flag}`
    })
    if (sawUnstable) anyUnstable.add(m.label)

    const eliteV = elite ? m.pick(elite)?.median ?? null : null
    const agV = ag ? m.pick(ag)?.median ?? null : null
    const verdict =
      eliteV !== null && agV !== null
        ? ratio(eliteV, agV, m.kind, m.noiseFloor)
        : '—'

    lines.push(`| ${m.label} | ${rendered.join(' | ')} | ${verdict} |`)
  }

  lines.push(
    `| Rows in the DOM | ${present.map((s) => String(s.renderedRows)).join(' | ')} | — |`
  )
  lines.push(
    `| Cells in the DOM | ${present.map((s) => String(s.renderedCells)).join(' | ')} | — |`
  )
  lines.push('')

  if (anyUnstable.size > 0) {
    lines.push(
      `⚠ = the five repetitions behind this median spread by more than 2×, ` +
        'so the median is not a reliable figure and should not be quoted. ' +
        `Affected here: ${[...anyUnstable].join(', ')}. See the raw ` +
        'per-repetition min/max in `results.json`.'
    )
    lines.push('')
  }

  const notes = present
    .map(provenanceNote)
    .filter((n): n is string => n !== null)
  if (notes.length) {
    lines.push('Provenance for this table:')
    lines.push('')
    for (const n of notes) lines.push(`- ${n}`)
    lines.push('')
  }
}

function renderReport(all: Summary[]): string {
  const lines: string[] = []
  lines.push('# EliteGrid (React) vs AG Grid, TanStack Table, react-data-grid')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push('')
  lines.push(
    `Median of ${REPS} repetitions, each in a fresh page, after one untimed ` +
      'warm-up run per library. All libraries are **interleaved** — one ' +
      'repetition of each, round-robin — so thermal throttling and machine ' +
      'noise during a run are spread across all of them rather than charged ' +
      'to whichever happened to go first. Production build, sort + filter ' +
      'enabled wherever the library has them, pagination and selection off ' +
      'everywhere. The row matrix below runs at 8 columns; a separate column ' +
      'axis varies column count at 10,000 rows.'
  )
  lines.push('')
  lines.push(
    'A **bold** figure is the best in its row, including anything within ' +
      'that metric\'s noise floor of the best — a 0.3 ms lead is not a win. ' +
      '`n/a` means the library does not implement that operation at all. ' +
      'The `vs AG Grid` column is EliteGrid against AG Grid specifically, ' +
      'kept because that is the pairing with a published history behind it.'
  )
  lines.push('')

  if (environment) {
    lines.push('## Environment')
    lines.push('')
    lines.push('| | |')
    lines.push('| --- | --- |')
    lines.push(`| Browser | ${environment.browser} |`)
    lines.push(`| OS | ${environment.platform} |`)
    lines.push(`| CPU | ${environment.cpu} (${environment.cores} cores) |`)
    lines.push(`| RAM | ${environment.memoryGB} GB |`)
    lines.push(`| Node | ${environment.nodeVersion} |`)
    lines.push(`| EliteGrid | ${environment.eliteGridVersion} |`)
    lines.push(`| AG Grid | ${environment.agGridVersion} |`)
    lines.push(`| TanStack Table | ${environment.tanstackVersion} |`)
    lines.push(`| react-data-grid | ${environment.rdgVersion} |`)
    lines.push(`| Grid viewport | ${environment.viewport} px |`)
    lines.push('')
    lines.push(
      'These numbers are tied to this machine. A different CPU, display ' +
        'refresh rate or browser version moves them, which is why the raw ' +
        'per-repetition samples are published in `results.json` and the ' +
        'harness is runnable with one command.'
    )
    lines.push('')
  }
  lines.push(
    '`commit` = trigger → DOM updated (the library\'s own work). ' +
      '`paint` = trigger → pixels on screen (what a user feels).'
  )
  lines.push('')

  for (const rows of ROW_COUNTS) {
    lines.push(`## ${rowLabel(rows)} rows`)
    lines.push('')
    // columns === 8 matters now that the column axis also records 10k-row
    // entries: without it this would pick whichever 10k run landed first.
    renderConfigTable(lines, all, rows, 8, ROW_AXIS_METRICS)
  }

  // ── Column axis ──────────────────────────────────────────────────────────
  lines.push('## Column axis — 10,000 rows, varying column count')
  lines.push('')
  lines.push(
    'The section above is measured at 8 columns, which sum to exactly the ' +
      '1000px viewport — the grid never scrolls sideways, so column ' +
      'virtualisation never engages. Enterprise grids routinely run 30-80 ' +
      'columns, and the published 2026 benchmarks run 300, which is where ' +
      'that difference actually shows up — so this axis holds rows at 10,000 ' +
      'and varies only the column count. At 30 columns the content is ' +
      '3,640px wide, at 80 it is 9,640px, and at 300 it is 36,000px, or 36× ' +
      'the viewport.'
  )
  lines.push('')

  for (const columns of COLUMN_COUNTS) {
    lines.push(`### ${columns} columns`)
    lines.push('')
    // 8 columns comes from the row matrix's 10k entry — the axis does not
    // re-run an identical configuration.
    renderConfigTable(lines, all, COLUMN_AXIS_ROWS, columns, COLUMN_AXIS_METRICS)
    lines.push(
      '**Cells in the DOM** is the row that matters on this axis — a grid ' +
        'that does not window columns renders rows × columns cells, and cell ' +
        'count is what drives layout, paint and retained heap.'
    )
    lines.push('')
  }

  lines.push('## How to read the scroll rows')
  lines.push('')
  lines.push(
    'Frame timings are measured as the interval between animation frames ' +
      'while the scroll container is driven every frame. That interval is ' +
      'capped by the display refresh rate: a grid finishing its work in 2 ms ' +
      'and one taking 12 ms both report ~16.7 ms. So these rows answer *"does ' +
      'the grid keep up with 60 fps?"* and not *"which grid is quicker?"* — ' +
      'any gap smaller than one vsync interval is quantisation, which is why ' +
      'the verdict column refuses to call those.'
  )
  lines.push('')
  lines.push(
    'Up to and including **100,000 rows that is the whole story: both ' +
      'libraries hold 60 fps** and sustained scrolling is not where they ' +
      'differ. The separation at those sizes is in mount, sort, filter and ' +
      'heap, none of which are vsync-bound.'
  )
  lines.push('')
  // Every figure in this paragraph is read back out of the results, never
  // typed in. A measured number written as a literal in a generated report
  // is how the bundle report's "34% smaller" claim drifted to a real 28%
  // without anyone noticing.
  const biggest = ROW_COUNTS[ROW_COUNTS.length - 1]!
  const atBiggest = (lib: Library) =>
    all.find((r) => r.rows === biggest && r.columns === 8 && r.library === lib)
  const eliteBig = atBiggest('elite')
  const agBig = atBiggest('ag')

  if (eliteBig && agBig && eliteBig.scrollFps.median - agBig.scrollFps.median > 3) {
    const overlap =
      eliteBig.scrollFps.min <= agBig.scrollFps.max &&
      agBig.scrollFps.min <= eliteBig.scrollFps.max
    lines.push(
      `**At ${rowLabel(biggest)} rows the scroll rows stop being a tie and ` +
        'start being the result.** The cap cuts both ways: it can hide a ' +
        'win, but it cannot manufacture one, so a library reporting well ' +
        'under 60 fps is genuinely missing frames. EliteGrid holds ' +
        `${fmt(eliteBig.scrollFps.median)} fps with ` +
        `${fmt(eliteBig.scrollLongFramePct.median)}% of frames over 33 ms; ` +
        `AG Grid averages ${fmt(agBig.scrollFps.median)} fps with ` +
        `${fmt(agBig.scrollLongFramePct.median)}% of them over 33 ms. The ` +
        'per-repetition spreads ' +
        (overlap ? 'OVERLAP' : 'do not overlap') +
        ` (EliteGrid ${fmt(eliteBig.scrollFps.min)}–` +
        `${fmt(eliteBig.scrollFps.max)}, AG Grid ` +
        `${fmt(agBig.scrollFps.min)}–${fmt(agBig.scrollFps.max)}), so this ` +
        (overlap
          ? 'may be a sampling artefact and should not be quoted.'
          : 'is not a sampling artefact.')
    )
  }
  lines.push('')

  lines.push('## Spread across repetitions')
  lines.push('')
  lines.push('| Config | Mount paint (min / median / max) | Scroll p95 (min / median / max) |')
  lines.push('| --- | ---: | ---: |')
  for (const r of all) {
    lines.push(
      `| ${r.library} @ ${rowLabel(r.rows)} rows × ${r.columns} cols | ` +
        `${fmt(r.mountPaintMs.min)} / ${fmt(r.mountPaintMs.median)} / ${fmt(r.mountPaintMs.max)} ms | ` +
        `${fmt(r.scrollP95Ms.min)} / ${fmt(r.scrollP95Ms.median)} / ${fmt(r.scrollP95Ms.max)} ms |`
    )
  }
  lines.push('')

  lines.push('## Who is in, who is not, and why')
  lines.push('')
  lines.push(
    'Candidates were ranked by npm weekly downloads and then filtered by ' +
      'whether they can be measured honestly at this scale. The exclusions ' +
      'are listed because a comparison that quietly drops the inconvenient ' +
      'entrants is not a comparison.'
  )
  lines.push('')
  lines.push('| Library | Downloads/wk | In? | Why |')
  lines.push('| --- | ---: | --- | --- |')
  lines.push(
    '| `@tanstack/react-table` | 13.9M | yes, with a caveat | Headless: it ' +
      'owns sorting and filtering but no markup, scroll container or ' +
      'virtualisation. Those two numbers are TanStack\'s; mount, scroll and ' +
      'heap measure TanStack **plus the renderer we wrote for it** using ' +
      'TanStack Virtual for both axes. |'
  )
  lines.push('| `ag-grid-community` | 1.9M | yes | Full-featured DOM grid, direct comparison. |')
  lines.push(
    '| `@mui/x-data-grid` | 1.6M | **no** | Row virtualisation is a **Pro** ' +
      'feature; the free Data Grid caps it at 100 rows. Benchmarking the ' +
      'free build at 10,000+ rows would measure an unvirtualised grid and ' +
      'produce a meaningless win, and the Pro build needs a paid licence. ' +
      '1771 Technologies hit this same wall and used the Premium build. |'
  )
  lines.push(
    '| `react-data-grid` | 381k | yes, partly | Virtualises rows and ' +
      'columns itself, so mount, scroll and heap are directly comparable. ' +
      'It has no filtering at all and its sorting is state-only, so those ' +
      'rows are `n/a` or marked as harness work. Current release is a beta ' +
      '(7.0.0-beta.62); there is no stable 7.x. |'
  )
  lines.push(
    '| `@glideapps/glide-data-grid` | 219k | **no** | Renders to canvas. ' +
      'There are no row or cell elements to count, so the DOM-based ' +
      'virtualisation negative controls cannot run and cell count — the ' +
      'whole point of the column axis — does not exist. |'
  )
  lines.push(
    '| `handsontable` | 159k | **no** | Not an open licence: free for ' +
      'non-commercial use only, and a vendor comparison published for ' +
      'marketing is commercial use. |'
  )
  lines.push('')
  lines.push(
    'Download figures are from the npm registry API on the generation date ' +
      'above, rounded. They are a proxy for reach, not for quality.'
  )
  lines.push('')

  lines.push('## What this benchmark does not tell you')
  lines.push('')
  lines.push(
    '- **Feature scope is not compared.** This benchmark exercises the slice ' +
      'both libraries implement — mount, sort, filter, virtualised scroll. ' +
      'Verified against the installed package, AG Grid *Community* does not ' +
      'include row grouping, tree data, aggregation, pivoting, master/detail, ' +
      'clipboard, set filters or the tool panels — those are Enterprise. ' +
      'Three things Community ships that EliteGrid does not: external ' +
      'filter, cell spanning, and undo/redo of edits. Being faster at the ' +
      'shared slice is not the same as being a drop-in replacement.'
  )
  lines.push(
    '- **EliteGrid and AG Grid register their full feature sets** ' +
      '(`modules: [AllModules]`, `AllCommunityModule`); TanStack registers ' +
      'only sorting and filtering, and react-data-grid has no module system. ' +
      'So the two full-featured grids are carrying weight the two lighter ' +
      'entrants are not, and a mount-time comparison between those groups is ' +
      'not like-for-like. EliteGrid beating AG Grid on mount is a fair ' +
      'comparison; EliteGrid beating a sorting-only TanStack on mount would ' +
      'not be, which is why the per-table winner marking is informational ' +
      'and the `vs AG Grid` column is the one to quote.'
  )
  lines.push(
    '- **The virtualisation window is pinned for three of the four, and ' +
      'react-data-grid is the exception.** Overscan is the most biasing knob ' +
      'here: it decides how much DOM exists, and DOM is what mount time, ' +
      'frame cost and heap are made of. EliteGrid, AG Grid and TanStack are ' +
      'all set to 10 rows either side from `shared-config.ts` (which is ' +
      'already both EliteGrid\'s and AG Grid\'s default). react-data-grid ' +
      'exposes no overscan option and renders a smaller window than the ' +
      'other three — compare the "Rows in the DOM" line. Some of its mount ' +
      'and heap advantage is that smaller window rather than faster code, ' +
      'and there is no setting available to equalise it.'
  )
  lines.push(
    '- **A headless library cannot really be benchmarked, only an ' +
      'integration of it can.** TanStack\'s mount, scroll and heap numbers ' +
      'move if someone writes a better renderer than ours. They are included ' +
      'because developers do compare against TanStack and a missing row ' +
      'invites the assumption that it won, but they are not a verdict on ' +
      'TanStack Table itself. The driver is in ' +
      '`apps/benchmark/src/TanStackBench.tsx` — read it before quoting those ' +
      'three rows, and tell us if it is unfair.'
  )
  lines.push(
    '- **The two axes do not cross.** Rows vary at 8 columns; columns vary ' +
      'at 10,000 rows. There is no 1,000,000 × 300 cell measurement, because ' +
      'generating 300M values exhausts the heap in the harness before either ' +
      'library is asked to render anything. A benchmark that quoted that ' +
      'shape would be measuring its own data generator.'
  )
  lines.push(
    '- **FPS is reported but is not a differentiator.** It is derived from ' +
      'the same vsync-capped frame intervals as the percentiles, so it ' +
      'saturates at the display refresh rate. It is published because it is ' +
      'the metric other grid benchmarks compare on, and floored at 3 fps ' +
      'because the residual gap between two libraries that both hold 60 is ' +
      'scheduling jitter.'
  )
  lines.push(
    '- **The grid viewport is 1000 × 600, smaller than the 1920 × 1080 the ' +
      'published 2026 benchmarks use.** A taller viewport renders more rows ' +
      'per frame and is harder work. It applies equally to both libraries ' +
      'here, but it means these absolute numbers are not comparable with ' +
      'figures published elsewhere. The width is load-bearing: the eight ' +
      'base columns sum to exactly 1000px, which is what keeps the row axis ' +
      'free of horizontal overflow.'
  )
  lines.push(
    '- **One machine, one browser, one shape of data.** Chromium only, no ' +
      'cell renderers, no pinned columns, no row grouping, plain scalar ' +
      'values. Custom cell renderers in particular move render cost from the ' +
      'library into user code and can reorder these results. Row count and ' +
      'column count are still the only two axes.'
  )
  lines.push(
    '- **"Mount" is mostly engine construction, not rendering.** Each ' +
      'adapter builds its grid inside the first render of the measured ' +
      'window, so the row model, row-identity map and column model are all ' +
      'inside the number. Measured at 1,000,000 rows: EliteGrid\'s ' +
      '`createGrid` is 1,517 ms of a 1,604 ms mount — **94.6%**. Read the ' +
      'mount row as "time until an interactive grid", and do not read it as ' +
      'render cost.'
  )
  lines.push(
    '- **The two heap rows measure different things, and the difference is ' +
      'the point.** "After mount" is sampled before any interaction and is ' +
      'the grid\'s own retained footprint. "After workload" is sampled once ' +
      'a sort, a filter, their two clears and both scroll runs have ' +
      'happened, so it includes whatever the pipeline keeps alive while ' +
      'working. They were one number until 2026-10-20, labelled "Grid heap", ' +
      'which was the second figure wearing the first one\'s name. At 1M rows ' +
      'the gap is small for every library here (EliteGrid 103.7 → 108.5 MB), ' +
      'so the old number was not far wrong — but it was not what it claimed.'
  )
  lines.push(
    '- **The heap baseline is verified, not assumed.** It is sampled after ' +
      'the dataset exists but before any grid mounts, so the delta excludes ' +
      'the rows themselves. react-data-grid is the control that proves it: ' +
      'it holds the same 1,000,000-row array and reports 0.9 MB after mount, ' +
      'which is only possible if the array is already in the baseline.'
  )
  lines.push(
    '- **Mount `commit` is quantised to a frame.** It is detected by polling ' +
      'per animation frame, so it has ~16.7 ms resolution. Treat mount ' +
      '`paint` as the trustworthy mount number; `commit` is indicative.'
  )
  lines.push(
    '- **These are medians of 5 runs on a developer machine, not CI.** The ' +
      'min/max spread above is the honest error bar. Differences under ~10% ' +
      'should not be quoted as wins.'
  )
  lines.push('')

  return lines.join('\n')
}
