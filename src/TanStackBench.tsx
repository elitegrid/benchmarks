import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  useTable,
  tableFeatures,
  rowSortingFeature,
  columnFilteringFeature,
  createSortedRowModel,
  createFilteredRowModel,
  sortFn_basic,
  sortFn_text,
  filterFn_equalsString,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Driver } from './bench'
import type { Row } from './data'
import {
  ROW_HEIGHT,
  HEADER_HEIGHT,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  DEFAULT_COLUMN_COUNT,
  benchColumns,
  ROW_BUFFER,
  COLUMN_BUFFER,
} from './shared-config'

// ── Why this driver is longer than the other three ─────────────────────────
//
// TanStack Table is HEADLESS: it owns sorting and filtering and owns no
// markup, no scroll container and no virtualisation. So a benchmark cannot
// measure "TanStack Table" the way it measures AG Grid — it measures
// TanStack Table plus whoever wrote the renderer, and here that is us.
//
// 1771 Technologies excluded it from their comparison for exactly this
// reason. Including it is the more useful choice, because it is the most
// downloaded table library by a factor of seven and developers really do
// compare against it — but it is only honest if the renderer is the one
// TanStack themselves recommend rather than a strawman. So:
//
//   * Row AND column virtualisation, both via @tanstack/react-virtual,
//     TanStack's own library for this. Virtualising rows only would leave it
//     rendering 300 cells per row against our 11 and the result would be
//     meaningless.
//   * The header sits INSIDE the scroll container as a sticky row, which is
//     the same structure EliteGrid uses, so horizontal scroll moves it for
//     free and no scroll-sync code is in the measured path.
//   * Plain text cells, no flexRender indirection, because the other three
//     grids render plain values too.
//   * Sorting and filtering go through table.setSorting / setColumnFilters,
//     TanStack's own engine. Those two numbers ARE TanStack's.
//
// What is still ours and not theirs: mount, scroll frame timing and heap.
// The report labels that.

export const TS_ROW_SELECTOR = '.ts-row'
export const TS_CELL_SELECTOR = '.ts-cell'

// Only the functions this benchmark uses are registered. Registering the full
// `sortFns` / `filterFns` registries would pull every built-in comparator into
// the bundle, which TanStack's own migration guide warns against — and the
// bundle report compares against this file.
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { basic: sortFn_basic, text: sortFn_text },
  filterFns: { equalsString: filterFn_equalsString },
})

export function TanStackBench({
  data,
  columnCount = DEFAULT_COLUMN_COUNT,
  onDriver,
}: {
  data: Row[]
  columnCount?: number
  onDriver: (d: Driver) => void
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const spec = useMemo(() => benchColumns(columnCount), [columnCount])

  const columns = useMemo(
    () =>
      spec.map((c) => ({
        accessorKey: c.field,
        header: c.header,
        size: c.width,
        // 'basic' is the numeric/lexical comparator; the benchmark sorts
        // `salary`, a number, in every library.
        sortFn: 'basic' as const,
        filterFn: 'equalsString' as const,
      })),
    [spec]
  )

  const table = useTable({
    features,
    data,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    columns: columns as any,
    getRowId: (row: Row) => String(row.id),
  })

  const rows = table.getRowModel().rows

  // Overscan matches the other grids rather than being picked to taste.
  // EliteGrid's effective row buffer is 10 (core-modules.ts) and AG Grid's
  // `rowBuffer` default is also 10, which is why those two render 35 and 34
  // rows for the same viewport. An overscan of 4 here looked harmless and was
  // not: it left TanStack building a third less DOM than the grids it is
  // being compared against, which flatters its mount time and its heap on
  // every single row of the table. Config parity is rule 2 of this harness
  // and overscan is config.
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: ROW_BUFFER,
  })

  const widths = useMemo(() => spec.map((c) => c.width), [spec])
  const totalWidth = useMemo(() => widths.reduce((a, b) => a + b, 0), [widths])

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: widths.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => widths[i]!,
    // Matches EliteGrid's `columnBufferSize` default of 1. A column is far
    // wider than a row is tall, so one of overscan per side is a whole
    // screenful of margin.
    overscan: COLUMN_BUFFER,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const virtualCols = columnVirtualizer.getVirtualItems()

  const register = useCallback(() => {
    onDriver({
      // Sort and filter are TanStack's own row models. Everything else in
      // this component — the scroll container, the virtualisation, the DOM —
      // is the harness, and the report says so.
      provides: { sort: 'library', filter: 'library' },
      rowSelector: TS_ROW_SELECTOR,
      scrollEl: () => scrollRef.current,
      mutationRoot: () => scrollRef.current,
      sort: (dir) => table.setSorting([{ id: 'salary', desc: dir === 'desc' }]),
      clearSort: () => table.setSorting([]),
      filter: () =>
        table.setColumnFilters([{ id: 'department', value: 'Finance' }]),
      clearFilter: () => table.setColumnFilters([]),
      renderedRows: () => document.querySelectorAll(TS_ROW_SELECTOR).length,
      renderedCells: () => document.querySelectorAll(TS_CELL_SELECTOR).length,
    })
  }, [onDriver, table])

  useEffect(register, [register])

  const headerCells = table.getHeaderGroups()[0]?.headers ?? []

  return (
    <div
      ref={scrollRef}
      style={{
        height: VIEWPORT_HEIGHT,
        width: VIEWPORT_WIDTH,
        overflow: 'auto',
        position: 'relative',
        contain: 'strict',
      }}
    >
      {/* Sticky so horizontal scroll carries it, exactly as EliteGrid does. */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          display: 'flex',
          width: totalWidth,
          height: HEADER_HEIGHT,
          background: '#f5f5f5',
          borderBottom: '1px solid #ddd',
          boxSizing: 'border-box',
        }}
      >
        {virtualCols.length > 0 && (
          <div style={{ width: virtualCols[0]!.start, flex: 'none' }} />
        )}
        {virtualCols.map((vc) => (
          <div
            key={vc.key}
            style={{
              width: vc.size,
              flex: 'none',
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              fontWeight: 600,
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            {String(headerCells[vc.index]?.column.columnDef.header ?? '')}
          </div>
        ))}
      </div>

      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: totalWidth,
          position: 'relative',
        }}
      >
        {virtualRows.map((vr) => {
          const row = rows[vr.index]!
          // getAllCells, not getVisibleCells: the latter lives on
          // columnVisibilityFeature, and nothing here hides a column, so
          // registering that feature would charge TanStack for work the
          // benchmark never asks it to do.
          const cells = row.getAllCells()
          return (
            <div
              className="ts-row"
              key={row.id}
              style={{
                position: 'absolute',
                top: vr.start,
                left: 0,
                height: vr.size,
                width: totalWidth,
                display: 'flex',
                borderBottom: '1px solid #eee',
                boxSizing: 'border-box',
              }}
            >
              {virtualCols.length > 0 && (
                <div style={{ width: virtualCols[0]!.start, flex: 'none' }} />
              )}
              {virtualCols.map((vc) => (
                <div
                  className="ts-cell"
                  key={vc.key}
                  style={{
                    width: vc.size,
                    flex: 'none',
                    padding: '0 8px',
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    boxSizing: 'border-box',
                  }}
                >
                  {String(cells[vc.index]?.getValue() ?? '')}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
