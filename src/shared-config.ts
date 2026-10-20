// ── Config both grids must agree on ────────────────────────────────────────
// Row height and column widths change how many rows fit the viewport and how
// much layout work each frame costs, so a mismatch here silently biases every
// scroll and render number. They live in one file so neither grid can drift.

export const ROW_HEIGHT = 40
export const HEADER_HEIGHT = 44

export const COLUMN_WIDTHS = {
  id: 80,
  name: 180,
  department: 150,
  salary: 120,
  location: 150,
  active: 90,
  joinDate: 130,
  score: 100,
} as const

/** Viewport the grid renders into. Fixed so virtualisation windows match. */
export const VIEWPORT_HEIGHT = 600
export const VIEWPORT_WIDTH = 1000

// ── Virtualisation window ──────────────────────────────────────────────────
// Rows of overscan above and below the viewport, and columns either side.
//
// This is the single most biasing knob in the whole harness and it used to be
// left to each library's default. Overscan decides how much DOM exists, and
// DOM is what mount time, frame cost and retained heap are made of — a grid
// rendering 22 rows beats one rendering 35 on all three without being any
// faster. 10 and 1 are EliteGrid's effective defaults (`bufferSize` in
// core-modules.ts, `columnBufferSize` in the viewport plugin) and 10 is also
// AG Grid's `rowBuffer` default, so pinning every configurable library here
// changes nothing about how those two already behaved — it only stops a
// third library being compared at a different window by accident.
//
// react-data-grid exposes no overscan option at all and renders a smaller
// window than this; that is noted in the report rather than worked around.
export const ROW_BUFFER = 10
export const COLUMN_BUFFER = 1

// ── Column axis ────────────────────────────────────────────────────────────
// The eight columns above sum to exactly 1000px — the viewport width — so the
// grid never scrolls sideways and column virtualisation is invisible. That was
// this harness's biggest blind spot: it measured only the shape where the
// feature does nothing, while enterprise grids run 30–80 columns.
//
// Column counts above 8 append synthetic columns to the base eight rather than
// replacing them, so the 8-column numbers stay directly comparable with every
// result recorded before the axis existed.

export const EXTRA_COLUMN_WIDTH = 120
export const DEFAULT_COLUMN_COUNT = 8

export type BenchFilter = 'number' | 'boolean' | 'date' | 'text' | undefined

export interface BenchColumn {
  field: string
  header: string
  width: number
  filter: BenchFilter
}

const BASE_COLUMNS: BenchColumn[] = [
  { field: 'id', header: 'ID', width: COLUMN_WIDTHS.id, filter: undefined },
  { field: 'name', header: 'Name', width: COLUMN_WIDTHS.name, filter: undefined },
  {
    field: 'department',
    header: 'Department',
    width: COLUMN_WIDTHS.department,
    filter: 'text',
  },
  {
    field: 'salary',
    header: 'Salary',
    width: COLUMN_WIDTHS.salary,
    filter: 'number',
  },
  {
    field: 'location',
    header: 'Location',
    width: COLUMN_WIDTHS.location,
    filter: undefined,
  },
  {
    field: 'active',
    header: 'Active',
    width: COLUMN_WIDTHS.active,
    filter: 'boolean',
  },
  {
    field: 'joinDate',
    header: 'Join Date',
    width: COLUMN_WIDTHS.joinDate,
    filter: 'date',
  },
  {
    field: 'score',
    header: 'Score',
    width: COLUMN_WIDTHS.score,
    filter: 'number',
  },
]

/** Field name of the nth synthetic column. Shared so data and both grids agree. */
export function extraField(index: number): string {
  return `extra${index}`
}

/**
 * The column set both grids render at a given count.
 *
 * Below 8 this truncates the base set; above 8 it appends `extraN` columns of
 * a fixed width. Every column is sortable and filterable in both libraries, so
 * neither pays for a feature the other skips.
 */
export function benchColumns(count: number): BenchColumn[] {
  if (count <= BASE_COLUMNS.length) return BASE_COLUMNS.slice(0, count)

  const extras: BenchColumn[] = []
  for (let i = 0; i < count - BASE_COLUMNS.length; i++) {
    extras.push({
      field: extraField(i),
      header: `Extra ${i + 1}`,
      width: EXTRA_COLUMN_WIDTH,
      filter: 'number',
    })
  }
  return [...BASE_COLUMNS, ...extras]
}

/** Total px width of a column set — above VIEWPORT_WIDTH means real overflow. */
export function totalColumnWidth(count: number): number {
  return benchColumns(count).reduce((sum, c) => sum + c.width, 0)
}

