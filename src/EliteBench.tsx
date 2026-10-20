import { useEffect, useMemo, useRef } from 'react'
import { createGrid, Grid, AllModules } from '@elitegrid/react'
import type { ColumnDef, GridAPI } from '@elitegrid/react'
import type { Driver } from './bench'
import type { Row } from './data'
import {
  ROW_HEIGHT,
  HEADER_HEIGHT,
  DEFAULT_COLUMN_COUNT,
  benchColumns,
  GROUP_FIELD,
  GROUP_SUM_FIELD,
  GROUP_AVG_FIELD,
  GROUP_EXPANDED_LEVELS,
  GROUP_COLUMN_WIDTH,
  ROW_BUFFER,
  COLUMN_BUFFER,
} from './shared-config'

export const ELITE_ROW_SELECTOR = '.yg-row'
export const ELITE_CELL_SELECTOR = '.yg-cell'

// Built from the shared spec rather than written out, so a column added to the
// axis cannot reach one grid and not the other.
function buildColumns(count: number, grouped: boolean): ColumnDef<Row>[] {
  return benchColumns(count).map((c) => ({
    field: c.field as keyof Row & string,
    header: c.header,
    size: { width: c.width },
    ...(c.filter ? { filter: { type: c.filter } } : {}),
    // Aggregates exist only in the grouped scenario, and only on the two
    // fields AG Grid is given an aggFunc for. Anything else would be work
    // one library does and the other does not.
    ...(grouped && c.field === GROUP_SUM_FIELD
      ? { value: { aggregate: (v: number[]) => v.reduce((a, b) => a + Number(b), 0) } }
      : {}),
    ...(grouped && c.field === GROUP_AVG_FIELD
      ? { value: { aggregate: (v: number[]) => v.reduce((a, b) => a + Number(b), 0) / v.length } }
      : {}),
  })) as ColumnDef<Row>[]
}

export function EliteBench({
  data,
  columnCount = DEFAULT_COLUMN_COUNT,
  grouped = false,
  onDriver,
}: {
  data: Row[]
  columnCount?: number
  grouped?: boolean
  onDriver: (d: Driver) => void
}) {
  const apiRef = useRef<GridAPI<Row> | null>(null)
  const columns = useMemo(
    () => buildColumns(columnCount, grouped),
    [columnCount, grouped]
  )

  // NOTE: `createGrid` runs HERE, inside the first render after the harness
  // flips `mounted`, so engine construction is inside the measured mount
  // window. Measured 2026-10-20 at 1M rows: createGrid is 1,517 ms of a
  // 1,604 ms mount — 94.6% of it. The mount number is therefore an engine
  // construction number, not a rendering number.
  const grid = useMemo(
    () =>
      createGrid<Row>({
        columns,
        data,
        rowId: 'id',
        // AllModules keeps this identical to what was benchmarked before
        // modular registration — same plugins registered, same work done
        // per interaction. Trimming to [SortModule, FilterModule] would
        // match the config below more tightly and flatter our numbers, so
        // it is a change to make deliberately and document, not silently.
        modules: [AllModules],
        // Feature parity with the AG Grid config: sort + filter on, no
        // pagination (both virtualise the full dataset), no selection column,
        // no editing. Anything enabled on one side is enabled on the other.
        sorting: { enabled: true, multiSort: false },
        filtering: { enabled: true },
        // Undefined in every pre-existing scenario, so none of the recorded
        // numbers move: the grouped run is a separate scenario, not a new
        // default. Shape matches the landing hero and the AG Grid config.
        grouping: grouped
          ? {
              model: [GROUP_FIELD],
              expandedByDefault: GROUP_EXPANDED_LEVELS,
              grandTotal: 'bottom' as const,
              panel: false,
              groupColumn: { header: 'Department', width: GROUP_COLUMN_WIDTH },
            }
          : undefined,
        pagination: { enabled: false },
        selection: { mode: 'none' },
        editing: { enabled: false },
        // Stated rather than left to the default, so the virtualisation
        // window is pinned in shared-config for every library that can set
        // it. These two values ARE the current defaults, so nothing about
        // EliteGrid's recorded numbers moves.
        scroll: {
          bufferSize: ROW_BUFFER,
          columnBufferSize: COLUMN_BUFFER,
        },
        appearance: {
          rowHeight: ROW_HEIGHT,
          headerHeight: HEADER_HEIGHT,
          rowStriping: false,        },
        events: {
          onReady: (api) => {
            apiRef.current = api
          },
        },
      }),
    [data, columns, grouped]
  )

  useEffect(() => {
    onDriver({
      // Sort and filter are both engine features reached through GridAPI.
      provides: { sort: 'library', filter: 'library' },
      rowSelector: ELITE_ROW_SELECTOR,
      scrollEl: () => document.querySelector<HTMLElement>('.yg-body'),
      mutationRoot: () => document.querySelector<HTMLElement>('.yg-body'),
      sort: (dir) =>
        apiRef.current?.setSortModel([{ columnId: 'salary', direction: dir }]),
      clearSort: () => apiRef.current?.clearSort(),
      filter: () =>
        apiRef.current?.setColumnFilter('department', {
          type: 'text',
          operator: 'equals',
          value: 'Finance',
        }),
      clearFilter: () => apiRef.current?.clearFilters(),
      renderedRows: () =>
        document.querySelectorAll(ELITE_ROW_SELECTOR).length,
      renderedCells: () =>
        document.querySelectorAll(ELITE_CELL_SELECTOR).length,
    })
  }, [grid, onDriver])

  return <Grid grid={grid} />
}
