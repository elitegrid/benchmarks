# EliteGrid benchmarks

A reproducible performance comparison of four React data grids, measured by one
clock, from one harness, in one browser process.

| Library | Version measured |
| --- | --- |
| [EliteGrid](https://www.npmjs.com/package/@elitegrid/react) | 0.2.0 |
| [AG Grid Community](https://www.npmjs.com/package/ag-grid-community) | 36.0.2 |
| [TanStack Table](https://www.npmjs.com/package/@tanstack/react-table) + [Virtual](https://www.npmjs.com/package/@tanstack/react-virtual) | 9.3.1 + 3.14.21 |
| [react-data-grid](https://www.npmjs.com/package/react-data-grid) | 7.0.0-beta.62 |

Every version is pinned exactly — no `^`, no ranges — so a clone measures the
same code we measured. All four are installed **from npm**, including ours:
this repo deliberately does not measure unpublished source.

**Latest results: [`results/REPORT.md`](results/REPORT.md).** Raw
per-repetition samples, including every min and max:
[`results/results.json`](results/results.json).

---

## Run it yourself

```bash
pnpm install
pnpm exec playwright install chromium
pnpm bench
```

Needs Node 20+, pnpm, and roughly **20 minutes**. The 1,000,000-row
configurations want a machine with at least 8 GB of RAM free; TanStack Table
alone retains about 500 MB at that size.

Results are written to `results/REPORT.md` and `results/results.json`,
overwriting what is there. The report records the machine, OS, CPU, browser
version and every library version it measured, because none of these numbers
transfer between machines.

To run one configuration instead of all seven:

```bash
pnpm exec playwright test --config playwright.bench.config.ts -g "1,000,000 rows"
pnpm exec playwright test --config playwright.bench.config.ts -g "300 columns"
```

Use that form rather than `pnpm bench -g "..."`: **pnpm reads `-g` as its own
`--global` flag** and the filter never reaches Playwright, so the command
silently runs the whole matrix instead of the one configuration you asked for.
A partial run only rewrites the report for the configurations it ran.

---

## What is measured

Seven configurations across two axes:

- **Rows** — 1k / 10k / 100k / 1M at 8 columns.
- **Columns** — 8 / 30 / 80 / 300 at 10,000 rows.

Per configuration: mount, sort, filter, clear filter, sustained vertical and
horizontal scroll (frame percentiles, FPS, dropped frames), retained heap
before and after a workload, and the number of rows and cells each library
keeps in the DOM.

**The axes do not cross.** There is no 1M × 300 measurement: that is 300
million values, and the harness exhausts its heap generating them before any
library is asked to render anything. A benchmark quoting that shape would be
measuring its own data generator.

---

## How this harness tries not to lie

Benchmarks are easy to write so that the author's library wins. These are the
constraints that exist to stop that, and they are worth checking before
trusting any number here.

1. **One clock for all four.** Every timing comes from `src/bench.ts`. A
   driver can only say *how* to sort a column, never how long it took.
2. **The libraries are interleaved, not blocked** — one repetition of each,
   round-robin. A machine does not hold still for the minutes a configuration
   takes; running five reps of one library and then five of another charges
   whichever went first for whatever the machine was doing during its block.
3. **Config parity is pinned in one file.** `src/shared-config.ts` holds row
   height, header height, column widths, viewport size and the virtualisation
   window. This matters more than it sounds: overscan decides how much DOM
   exists, and DOM is what mount time, frame cost and heap are made of. Three
   of the four libraries are pinned to 10 rows of overscan either side — which
   is already both EliteGrid's and AG Grid's own default. react-data-grid
   exposes no such option and renders a smaller window; that is disclosed in
   the report rather than worked around.
4. **Data generation is deterministic, outside every measured window**, and
   scrambled so sorting is real work rather than a no-op on ordered input.
5. **A warm-up run per library is discarded.** Otherwise whichever library ran
   first pays for JIT compilation, which is an artefact of test ordering.
6. **A fresh page per repetition.** Shared pages leak JIT state and make heap
   numbers meaningless.
7. **Median of 5, with min and max recorded.** Not mean — one GC pause
   dominates it. Not best-of — that reports a number no user will ever see.
8. **Differences below a stated noise floor are refused, not rounded into a
   win.** Frame timings get a 16.7 ms floor because `requestAnimationFrame` is
   vsync-capped; action timings get 2 ms; FPS gets 3. A tie additionally
   requires the two values to be within 15% of each other, so a floor cannot
   declare 17 ms and 34 ms equivalent.
9. **Negative controls.** Every configuration asserts that rows actually
   rendered, that fewer rows are in the DOM than in the dataset, and — above 8
   columns — that fewer cells are rendered than `rows × columns`. A driver
   that silently failed to mount would otherwise report excellent timings for
   a blank page.
10. **The report states what it does not measure**, including where the setup
    flatters EliteGrid and where it does not.

---

## Where this comparison is not like-for-like

Read this before quoting anything. It is in the generated report too.

**TanStack Table is headless.** It owns sorting and filtering and owns no
markup, no scroll container and no virtualisation. Its sort and filter numbers
are genuinely TanStack's. Its mount, scroll and heap numbers measure TanStack
**plus the renderer in `src/TanStackBench.tsx`, which we wrote** — using
TanStack Virtual for both axes, a sticky in-scroller header, and plain text
cells. Those three rows are not a verdict on TanStack Table; they are a verdict
on one integration of it. Read that file, and
[tell us](../../issues) if it is unfair.

**react-data-grid has no filtering at all** — there is no filter prop on
`DataGridProps` — so those rows are `n/a` rather than a number. Its sorting is
state-only: it reports which column you clicked and leaves the ordering to you,
so the comparator being timed is ours, and the report marks it as harness work.
Its mount and heap are genuinely its own, and it wins both by a wide margin
because it builds no row model.

**EliteGrid and AG Grid register their full feature sets** (`AllModules`,
`AllCommunityModule`) while TanStack registers only sorting and filtering and
react-data-grid has no module system. The two full grids are carrying weight
the two lighter entrants are not.

**Nobody should read the per-row winner marking as a product verdict.** The
four libraries are not four of the same thing.

---

## Who is not here, and why

Candidates were ranked by npm weekly downloads and then filtered by whether
they can be measured honestly at this scale.

| Library | Downloads/wk | In? | Why |
| --- | ---: | --- | --- |
| `@tanstack/react-table` | 13.9M | yes, with caveats above | Headless. |
| `ag-grid-community` | 1.9M | yes | Full DOM grid, direct comparison. |
| `@mui/x-data-grid` | 1.6M | **no** | Row virtualisation is a **Pro** feature and the free Data Grid caps it at 100 rows. Benchmarking the free build at 10,000+ rows would measure an unvirtualised grid and produce a meaningless win; the Pro build needs a paid licence. |
| `react-data-grid` | 381k | yes, partly | See above. Current release is a beta; there is no stable 7.x. |
| `@glideapps/glide-data-grid` | 219k | **no** | Renders to canvas. There are no row or cell elements to count, so the DOM-based virtualisation controls cannot run and cell count does not exist. |
| `handsontable` | 159k | **no** | Free for non-commercial use only, and a vendor comparison published for marketing is commercial use. |

Download figures are from the npm registry API, rounded. They are a proxy for
reach, not for quality.

---

## Layout

| Path | Role |
| --- | --- |
| `src/bench.ts` | All timing primitives. Every library is measured by this one file. |
| `src/shared-config.ts` | Row height, column widths, viewport, virtualisation window. The parity contract. |
| `src/data.ts` | Deterministic dataset generator. |
| `src/EliteBench.tsx` etc. | One `Driver` per library — the only library-specific code. |
| `tests/grid-benchmark.spec.ts` | Decides what to run and renders the report. |
| `playwright.bench.config.ts` | Chromium, 1 worker, no retries, production build. |

A `Driver` declares its own **provenance** — whether sorting and filtering are
the library's work, the harness's, or unavailable. That declaration is what
produces the `n/a` cells and the per-table provenance notes, and it is why no
number here is invented for an operation a library cannot perform.

---

## Licence

MIT for the harness. Each measured library is governed by its own licence.
