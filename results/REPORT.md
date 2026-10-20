# EliteGrid (React) vs AG Grid, TanStack Table, react-data-grid

Generated: 2026-10-20T09:25:33.862Z

Median of 5 repetitions, each in a fresh page, after one untimed warm-up run per library. All libraries are **interleaved** — one repetition of each, round-robin — so thermal throttling and machine noise during a run are spread across all of them rather than charged to whichever happened to go first. Production build, sort + filter enabled wherever the library has them, pagination and selection off everywhere. The row matrix below runs at 8 columns; a separate column axis varies column count at 10,000 rows.

A **bold** figure is the best in its row, including anything within that metric's noise floor of the best — a 0.3 ms lead is not a win. `n/a` means the library does not implement that operation at all. The `vs AG Grid` column is EliteGrid against AG Grid specifically, kept because that is the pairing with a published history behind it.

## Environment

| | |
| --- | --- |
| Browser | chromium 149.0.7827.55 |
| OS | Windows_NT 10.0.19045 |
| CPU | 11th Gen Intel(R) Core(TM) i3-1115G4 @ 3.00GHz (4 cores) |
| RAM | 12 GB |
| Node | v22.14.0 |
| EliteGrid | 0.2.0 |
| AG Grid | 36.0.2 |
| TanStack Table | 9.3.1 |
| react-data-grid | 7.0.0-beta.62 |
| Grid viewport | 1000 × 600 px |

These numbers are tied to this machine. A different CPU, display refresh rate or browser version moves them, which is why the raw per-repetition samples are published in `results.json` and the harness is runnable with one command.

`commit` = trigger → DOM updated (the library's own work). `paint` = trigger → pixels on screen (what a user feels).

## 1,000 rows

| Metric | EliteGrid | AG Grid | TanStack | react-data-grid | vs AG Grid |
| --- | ---: | ---: | ---: | ---: | :--- |
| Mount (paint) | 80.3 ms | 159.7 ms | **34.3 ms** | 41.5 ms | **1.99× faster** |
| Mount (commit) | 31.8 ms | 138.9 ms | 16.1 ms | **13.5 ms** ⚠ | **4.37× faster** |
| Sort (commit) | 13.2 ms | 11.5 ms | 8.4 ms | **5.6 ms** | no meaningful difference |
| Filter (commit) | 8.8 ms | 11.7 ms | **7.5 ms** ⚠ | n/a | **1.33× faster** |
| Clear filter (commit) | 12.1 ms | 5.5 ms | **2.9 ms** | n/a | 2.20× slower |
| Scroll FPS | **60.1 fps** | **59.5 fps** | **59.8 fps** | **59.8 fps** | no meaningful difference |
| Scroll frame p50 | **17.5 ms** | **16.9 ms** | **18.5 ms** | **19.1 ms** | no meaningful difference |
| Scroll frame p95 | **22.3 ms** | **23.2 ms** | **21.9 ms** | **21.2 ms** | no meaningful difference |
| Scroll frame max | **25.3 ms** | **28.0 ms** | **26.4 ms** | **25.1 ms** | no meaningful difference |
| Janky frames (>33 ms) | **0.0 %** | **0.0 %** | **0.0 %** | **0.0 %** | both zero |
| Heap after mount | 1.9 MB | 4.8 MB | 1.2 MB | **0.9 MB** | **2.48× less memory** |
| Heap after workload | 2.9 MB | 7.0 MB | 2.5 MB | **1.5 MB** | **2.41× less memory** |
| Rows in the DOM | 35 | 34 | 35 | 22 | — |
| Cells in the DOM | 280 | 272 | 280 | 176 | — |

⚠ = the five repetitions behind this median spread by more than 2×, so the median is not a reliable figure and should not be quoted. Affected here: Mount (commit), Filter (commit). See the raw per-repetition min/max in `results.json`.

Provenance for this table:

- **react-data-grid** — sorting is implemented by the harness, not the library; no filtering of any kind.

## 10,000 rows

| Metric | EliteGrid | AG Grid | TanStack | react-data-grid | vs AG Grid |
| --- | ---: | ---: | ---: | ---: | :--- |
| Mount (paint) | 85.5 ms | 170.5 ms | 46.5 ms | **36.3 ms** | **1.99× faster** |
| Mount (commit) | 38.6 ms | 146.1 ms | 28.9 ms | **7.4 ms** ⚠ | **3.78× faster** |
| Sort (commit) | 17.4 ms | 29.7 ms | 26.4 ms | **7.4 ms** | **1.71× faster** |
| Filter (commit) | **11.6 ms** | 33.1 ms | **12.9 ms** | n/a | **2.85× faster** |
| Clear filter (commit) | 8.3 ms | 8.6 ms | **5.9 ms** | n/a | no meaningful difference |
| Scroll FPS | **60.1 fps** | **59.1 fps** | **59.8 fps** | **59.9 fps** | no meaningful difference |
| Scroll frame p50 | **17.5 ms** | **16.2 ms** | 18.7 ms | 19.0 ms | no meaningful difference |
| Scroll frame p95 | **22.4 ms** | **23.1 ms** | **22.0 ms** | **21.2 ms** | no meaningful difference |
| Scroll frame max | **25.2 ms** | 28.6 ms | 27.9 ms | **23.3 ms** | no meaningful difference |
| Janky frames (>33 ms) | **0.0 %** | **0.0 %** | **0.0 %** | **0.0 %** | both zero |
| Heap after mount | 2.8 MB | 6.6 MB | 5.5 MB | **0.9 MB** | **2.35× less memory** |
| Heap after workload | 3.8 MB | 8.8 MB | 6.8 MB | **1.5 MB** | **2.31× less memory** |
| Rows in the DOM | 35 | 34 | 35 | 22 | — |
| Cells in the DOM | 280 | 272 | 280 | 176 | — |

⚠ = the five repetitions behind this median spread by more than 2×, so the median is not a reliable figure and should not be quoted. Affected here: Mount (commit). See the raw per-repetition min/max in `results.json`.

Provenance for this table:

- **react-data-grid** — sorting is implemented by the harness, not the library; no filtering of any kind.

## 100,000 rows

| Metric | EliteGrid | AG Grid | TanStack | react-data-grid | vs AG Grid |
| --- | ---: | ---: | ---: | ---: | :--- |
| Mount (paint) | 204.4 ms | 278.7 ms | 169.0 ms | **36.5 ms** | **1.36× faster** |
| Mount (commit) | 152.6 ms | 259.0 ms | 137.9 ms | **9.8 ms** | **1.70× faster** |
| Sort (commit) | 41.3 ms | 211.2 ms | 254.3 ms | **26.4 ms** | **5.11× faster** |
| Filter (commit) | **21.5 ms** | 65.6 ms | 55.1 ms | n/a | **3.05× faster** |
| Clear filter (commit) | **14.2 ms** | 18.4 ms | 26.4 ms | n/a | **1.30× faster** |
| Scroll FPS | **59.9 fps** | **59.7 fps** | **59.8 fps** | **59.9 fps** | no meaningful difference |
| Scroll frame p50 | **17.2 ms** | **18.0 ms** | **18.7 ms** | **18.8 ms** | no meaningful difference |
| Scroll frame p95 | **22.1 ms** | **22.2 ms** | **22.1 ms** | **21.1 ms** | no meaningful difference |
| Scroll frame max | **27.9 ms** | **25.2 ms** | 29.6 ms | **27.0 ms** | no meaningful difference |
| Janky frames (>33 ms) | **0.0 %** | **0.0 %** | **0.0 %** | **0.0 %** | both zero |
| Heap after mount | 11.9 MB | 25.9 MB | 49.2 MB | **0.9 MB** | **2.17× less memory** |
| Heap after workload | 13.3 MB | 28.1 MB | 50.6 MB | **1.5 MB** | **2.12× less memory** |
| Rows in the DOM | 35 | 34 | 35 | 22 | — |
| Cells in the DOM | 280 | 272 | 280 | 176 | — |

Provenance for this table:

- **react-data-grid** — sorting is implemented by the harness, not the library; no filtering of any kind.

## 1,000,000 rows

| Metric | EliteGrid | AG Grid | TanStack | react-data-grid | vs AG Grid |
| --- | ---: | ---: | ---: | ---: | :--- |
| Mount (paint) | 1769.4 ms | 1937.4 ms | 1382.5 ms | **43.5 ms** | **1.09× faster** |
| Mount (commit) | 1719.8 ms | 1919.1 ms | 1357.0 ms | **12.0 ms** | **1.12× faster** |
| Sort (commit) | **304.2 ms** | 3972.1 ms | 4666.5 ms | 756.1 ms | **13.06× faster** |
| Filter (commit) | **132.2 ms** ⚠ | 384.5 ms | 1018.8 ms | n/a | **2.91× faster** |
| Clear filter (commit) | **20.6 ms** | 142.6 ms | 311.3 ms | n/a | **6.92× faster** |
| Scroll FPS | **59.1 fps** | 29.1 fps | **59.8 fps** | **59.9 fps** | **2.03× higher** |
| Scroll frame p50 | **16.9 ms** | 32.4 ms | **19.0 ms** | **18.7 ms** | **1.92× faster** |
| Scroll frame p95 | **21.9 ms** | 42.7 ms | **22.3 ms** | **20.9 ms** | **1.95× faster** |
| Scroll frame max | 44.4 ms ⚠ | 54.3 ms | 32.6 ms | **25.5 ms** | **1.22× faster** |
| Janky frames (>33 ms) | 0.8 % | 38.7 % | **0.0 %** | **0.0 %** | **46.00× fewer** |
| Heap after mount | 103.7 MB | 227.9 MB | 494.9 MB | **0.9 MB** | **2.20× less memory** |
| Heap after workload | 108.5 MB | 230.1 MB | 507.8 MB | **7.7 MB** | **2.12× less memory** |
| Rows in the DOM | 35 | 34 | 35 | 22 | — |
| Cells in the DOM | 280 | 272 | 280 | 176 | — |

⚠ = the five repetitions behind this median spread by more than 2×, so the median is not a reliable figure and should not be quoted. Affected here: Filter (commit), Scroll frame max. See the raw per-repetition min/max in `results.json`.

Provenance for this table:

- **react-data-grid** — sorting is implemented by the harness, not the library; no filtering of any kind.

## Column axis — 10,000 rows, varying column count

The section above is measured at 8 columns, which sum to exactly the 1000px viewport — the grid never scrolls sideways, so column virtualisation never engages. Enterprise grids routinely run 30-80 columns, and the published 2026 benchmarks run 300, which is where that difference actually shows up — so this axis holds rows at 10,000 and varies only the column count. At 30 columns the content is 3,640px wide, at 80 it is 9,640px, and at 300 it is 36,000px, or 36× the viewport.

### 8 columns

| Metric | EliteGrid | AG Grid | TanStack | react-data-grid | vs AG Grid |
| --- | ---: | ---: | ---: | ---: | :--- |
| Mount (paint) | 85.5 ms | 170.5 ms | 46.5 ms | **36.3 ms** | **1.99× faster** |
| Sort (commit) | 17.4 ms | 29.7 ms | 26.4 ms | **7.4 ms** | **1.71× faster** |
| Filter (commit) | **11.6 ms** | 33.1 ms | **12.9 ms** | n/a | **2.85× faster** |
| Scroll ↓ frame p95 | **22.4 ms** | **23.1 ms** | **22.0 ms** | **21.2 ms** | no meaningful difference |
| Scroll → frame p95 | **24.6 ms** | **24.5 ms** | **24.5 ms** | **24.5 ms** | no meaningful difference |
| Scroll ↓ FPS | **60.1 fps** | **59.1 fps** | **59.8 fps** | **59.9 fps** | no meaningful difference |
| Scroll → FPS | **60.0 fps** | **60.1 fps** | **60.0 fps** | **60.0 fps** | no meaningful difference |
| Heap after mount | 2.8 MB | 6.6 MB | 5.5 MB | **0.9 MB** | **2.35× less memory** |
| Rows in the DOM | 35 | 34 | 35 | 22 | — |
| Cells in the DOM | 280 | 272 | 280 | 176 | — |

Provenance for this table:

- **react-data-grid** — sorting is implemented by the harness, not the library; no filtering of any kind.

**Cells in the DOM** is the row that matters on this axis — a grid that does not window columns renders rows × columns cells, and cell count is what drives layout, paint and retained heap.

### 30 columns

| Metric | EliteGrid | AG Grid | TanStack | react-data-grid | vs AG Grid |
| --- | ---: | ---: | ---: | ---: | :--- |
| Mount (paint) | 119.8 ms | 177.3 ms | 48.4 ms | **37.6 ms** | **1.48× faster** |
| Sort (commit) | 22.0 ms | 34.8 ms | 35.7 ms | **11.3 ms** | **1.58× faster** |
| Filter (commit) | **14.2 ms** | 32.3 ms | **15.9 ms** | n/a | **2.27× faster** |
| Scroll ↓ frame p95 | **22.4 ms** | **22.5 ms** | **21.6 ms** | **21.1 ms** | no meaningful difference |
| Scroll → frame p95 | 31.4 ms | 28.5 ms | **23.4 ms** | **22.3 ms** | no meaningful difference |
| Scroll ↓ FPS | **59.8 fps** | **59.5 fps** | **59.7 fps** | **60.0 fps** | no meaningful difference |
| Scroll → FPS | 56.5 fps | 55.2 fps | **59.9 fps** | **60.0 fps** | no meaningful difference |
| Heap after mount | 3.0 MB | 7.2 MB | 5.5 MB | **0.9 MB** | **2.40× less memory** |
| Rows in the DOM | 35 | 34 | 35 | 22 | — |
| Cells in the DOM | 385 | 408 | 385 | 242 | — |

Provenance for this table:

- **react-data-grid** — sorting is implemented by the harness, not the library; no filtering of any kind.

**Cells in the DOM** is the row that matters on this axis — a grid that does not window columns renders rows × columns cells, and cell count is what drives layout, paint and retained heap.

### 80 columns

| Metric | EliteGrid | AG Grid | TanStack | react-data-grid | vs AG Grid |
| --- | ---: | ---: | ---: | ---: | :--- |
| Mount (paint) | 119.0 ms | 181.4 ms | 49.0 ms | **38.5 ms** | **1.52× faster** |
| Sort (commit) | 22.5 ms | 35.0 ms ⚠ | 30.2 ms | **11.8 ms** | **1.56× faster** |
| Filter (commit) | **14.3 ms** | 34.1 ms ⚠ | 17.2 ms | n/a | **2.38× faster** |
| Scroll ↓ frame p95 | **22.1 ms** | **23.2 ms** | **22.1 ms** | **20.8 ms** | no meaningful difference |
| Scroll → frame p95 | **22.2 ms** | **22.4 ms** | **22.9 ms** | **21.9 ms** | no meaningful difference |
| Scroll ↓ FPS | **59.9 fps** | **59.6 fps** | **59.9 fps** | **59.9 fps** | no meaningful difference |
| Scroll → FPS | **58.9 fps** | **57.6 fps** | **59.9 fps** | **59.9 fps** | no meaningful difference |
| Heap after mount | 3.1 MB | 7.3 MB | 5.7 MB | **0.9 MB** | **2.38× less memory** |
| Rows in the DOM | 35 | 34 | 35 | 22 | — |
| Cells in the DOM | 385 | 408 | 385 | 242 | — |

⚠ = the five repetitions behind this median spread by more than 2×, so the median is not a reliable figure and should not be quoted. Affected here: Sort (commit), Filter (commit). See the raw per-repetition min/max in `results.json`.

Provenance for this table:

- **react-data-grid** — sorting is implemented by the harness, not the library; no filtering of any kind.

**Cells in the DOM** is the row that matters on this axis — a grid that does not window columns renders rows × columns cells, and cell count is what drives layout, paint and retained heap.

### 300 columns

| Metric | EliteGrid | AG Grid | TanStack | react-data-grid | vs AG Grid |
| --- | ---: | ---: | ---: | ---: | :--- |
| Mount (paint) | 125.8 ms | 189.7 ms | 55.5 ms | **36.4 ms** | **1.51× faster** |
| Sort (commit) | 31.5 ms | 38.9 ms | 34.3 ms | **13.6 ms** | **1.23× faster** |
| Filter (commit) | **15.7 ms** ⚠ | 40.1 ms | 25.0 ms | n/a | **2.55× faster** |
| Scroll ↓ frame p95 | **21.5 ms** | **22.5 ms** | **21.8 ms** | **21.2 ms** | no meaningful difference |
| Scroll → frame p95 | **20.9 ms** | **22.6 ms** | **22.9 ms** | **21.7 ms** | no meaningful difference |
| Scroll ↓ FPS | **59.1 fps** | **59.5 fps** | **59.8 fps** | **60.0 fps** | no meaningful difference |
| Scroll → FPS | **59.3 fps** | **59.3 fps** | **59.8 fps** | **60.0 fps** | no meaningful difference |
| Heap after mount | 3.2 MB | 7.8 MB | 6.2 MB | **1.0 MB** | **2.39× less memory** |
| Rows in the DOM | 35 | 34 | 35 | 22 | — |
| Cells in the DOM | 385 | 442 | 385 | 242 | — |

⚠ = the five repetitions behind this median spread by more than 2×, so the median is not a reliable figure and should not be quoted. Affected here: Filter (commit). See the raw per-repetition min/max in `results.json`.

Provenance for this table:

- **react-data-grid** — sorting is implemented by the harness, not the library; no filtering of any kind.

**Cells in the DOM** is the row that matters on this axis — a grid that does not window columns renders rows × columns cells, and cell count is what drives layout, paint and retained heap.

## How to read the scroll rows

Frame timings are measured as the interval between animation frames while the scroll container is driven every frame. That interval is capped by the display refresh rate: a grid finishing its work in 2 ms and one taking 12 ms both report ~16.7 ms. So these rows answer *"does the grid keep up with 60 fps?"* and not *"which grid is quicker?"* — any gap smaller than one vsync interval is quantisation, which is why the verdict column refuses to call those.

Up to and including **100,000 rows that is the whole story: both libraries hold 60 fps** and sustained scrolling is not where they differ. The separation at those sizes is in mount, sort, filter and heap, none of which are vsync-bound.

**At 1,000,000 rows the scroll rows stop being a tie and start being the result.** The cap cuts both ways: it can hide a win, but it cannot manufacture one, so a library reporting well under 60 fps is genuinely missing frames. EliteGrid holds 59.1 fps with 0.8% of frames over 33 ms; AG Grid averages 29.1 fps with 38.7% of them over 33 ms. The per-repetition spreads do not overlap (EliteGrid 55.8–59.5, AG Grid 28.2–29.7), so this is not a sampling artefact.

## Spread across repetitions

| Config | Mount paint (min / median / max) | Scroll p95 (min / median / max) |
| --- | ---: | ---: |
| elite @ 1,000 rows × 8 cols | 75.7 / 80.3 / 93.1 ms | 21.6 / 22.3 / 22.9 ms |
| ag @ 1,000 rows × 8 cols | 150.0 / 159.7 / 167.2 ms | 22.6 / 23.2 / 24.2 ms |
| tanstack @ 1,000 rows × 8 cols | 33.1 / 34.3 / 34.9 ms | 21.6 / 21.9 / 22.3 ms |
| rdg @ 1,000 rows × 8 cols | 32.9 / 41.5 / 44.0 ms | 20.9 / 21.2 / 21.5 ms |
| elite @ 10,000 rows × 8 cols | 80.7 / 85.5 / 95.0 ms | 21.4 / 22.4 / 22.8 ms |
| ag @ 10,000 rows × 8 cols | 162.1 / 170.5 / 185.6 ms | 22.3 / 23.1 / 23.5 ms |
| tanstack @ 10,000 rows × 8 cols | 44.5 / 46.5 / 49.6 ms | 21.3 / 22.0 / 22.1 ms |
| rdg @ 10,000 rows × 8 cols | 34.1 / 36.3 / 37.8 ms | 21.0 / 21.2 / 21.9 ms |
| elite @ 100,000 rows × 8 cols | 179.1 / 204.4 / 266.9 ms | 20.2 / 22.1 / 23.1 ms |
| ag @ 100,000 rows × 8 cols | 274.9 / 278.7 / 287.7 ms | 21.5 / 22.2 / 23.0 ms |
| tanstack @ 100,000 rows × 8 cols | 159.9 / 169.0 / 211.8 ms | 21.6 / 22.1 / 22.7 ms |
| rdg @ 100,000 rows × 8 cols | 33.9 / 36.5 / 49.1 ms | 20.9 / 21.1 / 22.2 ms |
| elite @ 1,000,000 rows × 8 cols | 1756.5 / 1769.4 / 1907.5 ms | 21.0 / 21.9 / 23.1 ms |
| ag @ 1,000,000 rows × 8 cols | 1919.1 / 1937.4 / 2026.8 ms | 42.5 / 42.7 / 43.2 ms |
| tanstack @ 1,000,000 rows × 8 cols | 1372.5 / 1382.5 / 1458.1 ms | 21.8 / 22.3 / 23.8 ms |
| rdg @ 1,000,000 rows × 8 cols | 42.4 / 43.5 / 69.2 ms | 20.8 / 20.9 / 21.8 ms |
| elite @ 10,000 rows × 30 cols | 115.2 / 119.8 / 126.2 ms | 21.6 / 22.4 / 22.8 ms |
| ag @ 10,000 rows × 30 cols | 173.9 / 177.3 / 183.7 ms | 22.0 / 22.5 / 24.1 ms |
| tanstack @ 10,000 rows × 30 cols | 47.2 / 48.4 / 64.2 ms | 21.5 / 21.6 / 22.9 ms |
| rdg @ 10,000 rows × 30 cols | 35.6 / 37.6 / 39.7 ms | 20.9 / 21.1 / 21.6 ms |
| elite @ 10,000 rows × 80 cols | 110.5 / 119.0 / 124.6 ms | 21.4 / 22.1 / 22.3 ms |
| ag @ 10,000 rows × 80 cols | 164.7 / 181.4 / 192.0 ms | 22.7 / 23.2 / 24.4 ms |
| tanstack @ 10,000 rows × 80 cols | 47.6 / 49.0 / 80.1 ms | 22.0 / 22.1 / 22.4 ms |
| rdg @ 10,000 rows × 80 cols | 35.7 / 38.5 / 43.7 ms | 20.7 / 20.8 / 21.1 ms |
| elite @ 10,000 rows × 300 cols | 117.4 / 125.8 / 144.9 ms | 20.7 / 21.5 / 22.4 ms |
| ag @ 10,000 rows × 300 cols | 176.6 / 189.7 / 196.4 ms | 21.9 / 22.5 / 23.0 ms |
| tanstack @ 10,000 rows × 300 cols | 49.6 / 55.5 / 62.0 ms | 21.3 / 21.8 / 22.1 ms |
| rdg @ 10,000 rows × 300 cols | 34.0 / 36.4 / 39.2 ms | 20.6 / 21.2 / 21.8 ms |

## Who is in, who is not, and why

Candidates were ranked by npm weekly downloads and then filtered by whether they can be measured honestly at this scale. The exclusions are listed because a comparison that quietly drops the inconvenient entrants is not a comparison.

| Library | Downloads/wk | In? | Why |
| --- | ---: | --- | --- |
| `@tanstack/react-table` | 13.9M | yes, with a caveat | Headless: it owns sorting and filtering but no markup, scroll container or virtualisation. Those two numbers are TanStack's; mount, scroll and heap measure TanStack **plus the renderer we wrote for it** using TanStack Virtual for both axes. |
| `ag-grid-community` | 1.9M | yes | Full-featured DOM grid, direct comparison. |
| `@mui/x-data-grid` | 1.6M | **no** | Row virtualisation is a **Pro** feature; the free Data Grid caps it at 100 rows. Benchmarking the free build at 10,000+ rows would measure an unvirtualised grid and produce a meaningless win, and the Pro build needs a paid licence. 1771 Technologies hit this same wall and used the Premium build. |
| `react-data-grid` | 381k | yes, partly | Virtualises rows and columns itself, so mount, scroll and heap are directly comparable. It has no filtering at all and its sorting is state-only, so those rows are `n/a` or marked as harness work. Current release is a beta (7.0.0-beta.62); there is no stable 7.x. |
| `@glideapps/glide-data-grid` | 219k | **no** | Renders to canvas. There are no row or cell elements to count, so the DOM-based virtualisation negative controls cannot run and cell count — the whole point of the column axis — does not exist. |
| `handsontable` | 159k | **no** | Not an open licence: free for non-commercial use only, and a vendor comparison published for marketing is commercial use. |

Download figures are from the npm registry API on the generation date above, rounded. They are a proxy for reach, not for quality.

## What this benchmark does not tell you

- **Feature scope is not compared.** This benchmark exercises the slice both libraries implement — mount, sort, filter, virtualised scroll. Verified against the installed package, AG Grid *Community* does not include row grouping, tree data, aggregation, pivoting, master/detail, clipboard, set filters or the tool panels — those are Enterprise. Three things Community ships that EliteGrid does not: external filter, cell spanning, and undo/redo of edits. Being faster at the shared slice is not the same as being a drop-in replacement.
- **EliteGrid and AG Grid register their full feature sets** (`modules: [AllModules]`, `AllCommunityModule`); TanStack registers only sorting and filtering, and react-data-grid has no module system. So the two full-featured grids are carrying weight the two lighter entrants are not, and a mount-time comparison between those groups is not like-for-like. EliteGrid beating AG Grid on mount is a fair comparison; EliteGrid beating a sorting-only TanStack on mount would not be, which is why the per-table winner marking is informational and the `vs AG Grid` column is the one to quote.
- **The virtualisation window is pinned for three of the four, and react-data-grid is the exception.** Overscan is the most biasing knob here: it decides how much DOM exists, and DOM is what mount time, frame cost and heap are made of. EliteGrid, AG Grid and TanStack are all set to 10 rows either side from `shared-config.ts` (which is already both EliteGrid's and AG Grid's default). react-data-grid exposes no overscan option and renders a smaller window than the other three — compare the "Rows in the DOM" line. Some of its mount and heap advantage is that smaller window rather than faster code, and there is no setting available to equalise it.
- **A headless library cannot really be benchmarked, only an integration of it can.** TanStack's mount, scroll and heap numbers move if someone writes a better renderer than ours. They are included because developers do compare against TanStack and a missing row invites the assumption that it won, but they are not a verdict on TanStack Table itself. The driver is in `apps/benchmark/src/TanStackBench.tsx` — read it before quoting those three rows, and tell us if it is unfair.
- **The two axes do not cross.** Rows vary at 8 columns; columns vary at 10,000 rows. There is no 1,000,000 × 300 cell measurement, because generating 300M values exhausts the heap in the harness before either library is asked to render anything. A benchmark that quoted that shape would be measuring its own data generator.
- **FPS is reported but is not a differentiator.** It is derived from the same vsync-capped frame intervals as the percentiles, so it saturates at the display refresh rate. It is published because it is the metric other grid benchmarks compare on, and floored at 3 fps because the residual gap between two libraries that both hold 60 is scheduling jitter.
- **The grid viewport is 1000 × 600, smaller than the 1920 × 1080 the published 2026 benchmarks use.** A taller viewport renders more rows per frame and is harder work. It applies equally to both libraries here, but it means these absolute numbers are not comparable with figures published elsewhere. The width is load-bearing: the eight base columns sum to exactly 1000px, which is what keeps the row axis free of horizontal overflow.
- **One machine, one browser, one shape of data.** Chromium only, no cell renderers, no pinned columns, no row grouping, plain scalar values. Custom cell renderers in particular move render cost from the library into user code and can reorder these results. Row count and column count are still the only two axes.
- **"Mount" is mostly engine construction, not rendering.** Each adapter builds its grid inside the first render of the measured window, so the row model, row-identity map and column model are all inside the number. Measured at 1,000,000 rows: EliteGrid's `createGrid` is 1,517 ms of a 1,604 ms mount — **94.6%**. Read the mount row as "time until an interactive grid", and do not read it as render cost.
- **The two heap rows measure different things, and the difference is the point.** "After mount" is sampled before any interaction and is the grid's own retained footprint. "After workload" is sampled once a sort, a filter, their two clears and both scroll runs have happened, so it includes whatever the pipeline keeps alive while working. They were one number until 2026-10-20, labelled "Grid heap", which was the second figure wearing the first one's name. At 1M rows the gap is small for every library here (EliteGrid 103.7 → 108.5 MB), so the old number was not far wrong — but it was not what it claimed.
- **The heap baseline is verified, not assumed.** It is sampled after the dataset exists but before any grid mounts, so the delta excludes the rows themselves. react-data-grid is the control that proves it: it holds the same 1,000,000-row array and reports 0.9 MB after mount, which is only possible if the array is already in the baseline.
- **Mount `commit` is quantised to a frame.** It is detected by polling per animation frame, so it has ~16.7 ms resolution. Treat mount `paint` as the trustworthy mount number; `commit` is indicative.
- **These are medians of 5 runs on a developer machine, not CI.** The min/max spread above is the honest error bar. Differences under ~10% should not be quoted as wins.
