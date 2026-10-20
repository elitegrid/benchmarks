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
  ROW_BUFFER,
  COLUMN_BUFFER,
} from './shared-config'

export const ELITE_ROW_SELECTOR = '.yg-row'
export const ELITE_CELL_SELECTOR = '.yg-cell'

// Built from the shared spec rather than written out, so a column added to the
// axis cannot reach one grid and not the other.
function buildColumns(count: number): ColumnDef<Row>[] {
  return benchColumns(count).map((c) => ({
    field: c.field as keyof Row & string,
    header: c.header,
    size: { width: c.width },
    ...(c.filter ? { filter: { type: c.filter } } : {}),
  })) as ColumnDef<Row>[]
}

export function EliteBench({
  data,
  columnCount = DEFAULT_COLUMN_COUNT,
  onDriver,
}: {
  data: Row[]
  columnCount?: number
  onDriver: (d: Driver) => void
}) {
  const apiRef = useRef<GridAPI<Row> | null>(null)
  const columns = useMemo(() => buildColumns(columnCount), [columnCount])

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
    [data, columns]
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
