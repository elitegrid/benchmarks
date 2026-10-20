import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DataGrid, type Column, type DataGridHandle, type SortColumn } from 'react-data-grid'
import 'react-data-grid/lib/styles.css'
import type { Driver } from './bench'
import type { Row } from './data'
import {
  ROW_HEIGHT,
  HEADER_HEIGHT,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  DEFAULT_COLUMN_COUNT,
  benchColumns,
} from './shared-config'

// ── What react-data-grid does and does not provide ────────────────────────
//
// Mount, scroll and memory are entirely the library's: `enableVirtualization`
// (on by default) windows both rows and columns, so those three numbers are a
// true like-for-like comparison.
//
// Sorting is NOT. react-data-grid reports which column you clicked through
// `sortColumns` / `onSortColumnsChange` and leaves the actual sort to you —
// so the comparator below is ours, and the number measures OUR sort plus
// their re-render, not their sort. It is recorded with provenance 'harness'.
//
// Filtering does not exist here at all. There is no filter prop on
// `DataGridProps`; the documented approach is to filter the array yourself
// and pass fewer rows, which is not a grid feature being measured. The two
// filter actions below therefore THROW rather than quietly doing nothing: a
// no-op would leave the harness waiting on a DOM mutation that never comes
// and hang the run, and a hand-rolled array filter would publish a number
// against a feature the library does not have.
//
// Row identity uses `[role="row"]:has([role="gridcell"])` because the class
// names are content-hashed per release (`.rdg-7-0-0-beta-62-02a50147`) and
// would silently stop matching on upgrade. The `:has` clause excludes the
// header row, which also carries role="row".

export const RDG_ROW_SELECTOR = '[role="row"]:has([role="gridcell"])'
export const RDG_CELL_SELECTOR = '[role="gridcell"]'

export function RdgBench({
  data,
  columnCount = DEFAULT_COLUMN_COUNT,
  onDriver,
}: {
  data: Row[]
  columnCount?: number
  onDriver: (d: Driver) => void
}) {
  const gridRef = useRef<DataGridHandle | null>(null)
  const [sortColumns, setSortColumns] = useState<readonly SortColumn[]>([])

  const columns = useMemo<Column<Row>[]>(
    () =>
      benchColumns(columnCount).map((c) => ({
        key: c.field,
        name: c.header,
        width: c.width,
        sortable: true,
        // Values are rendered as text in every library in this comparison.
        renderCell: ({ row }) => String(row[c.field] ?? ''),
      })),
    [columnCount]
  )

  // The sort itself. react-data-grid gives us the intent, not the ordering.
  const rows = useMemo(() => {
    if (sortColumns.length === 0) return data
    const { columnKey, direction } = sortColumns[0]!
    const sign = direction === 'ASC' ? 1 : -1
    return [...data].sort((a, b) => {
      const av = a[columnKey]
      const bv = b[columnKey]
      if (av === bv) return 0
      return (av! < bv! ? -1 : 1) * sign
    })
  }, [data, sortColumns])

  const register = useCallback(() => {
    onDriver({
      provides: { sort: 'harness', filter: 'none' },
      rowSelector: RDG_ROW_SELECTOR,
      scrollEl: () => gridRef.current?.element ?? null,
      mutationRoot: () => gridRef.current?.element ?? null,
      sort: (dir) =>
        setSortColumns([
          { columnKey: 'salary', direction: dir === 'asc' ? 'ASC' : 'DESC' },
        ]),
      clearSort: () => setSortColumns([]),
      filter: () => {
        throw new Error(
          'react-data-grid has no filtering; this action must be skipped'
        )
      },
      clearFilter: () => {
        throw new Error(
          'react-data-grid has no filtering; this action must be skipped'
        )
      },
      renderedRows: () => document.querySelectorAll(RDG_ROW_SELECTOR).length,
      renderedCells: () => document.querySelectorAll(RDG_CELL_SELECTOR).length,
    })
  }, [onDriver])

  useEffect(register, [register])

  return (
    <DataGrid<Row>
      ref={gridRef}
      columns={columns}
      rows={rows}
      rowKeyGetter={(row) => row.id}
      rowHeight={ROW_HEIGHT}
      headerRowHeight={HEADER_HEIGHT}
      sortColumns={sortColumns}
      onSortColumnsChange={setSortColumns}
      style={{ height: VIEWPORT_HEIGHT, width: VIEWPORT_WIDTH }}
    />
  )
}
