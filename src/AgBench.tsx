import { useCallback, useMemo, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
} from 'ag-grid-community'
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
} from './shared-config'

// Community only, deliberately. The paid tier is not installed and not
// measured: every number in the report is AG Grid Community against
// EliteGrid.
ModuleRegistry.registerModules([AllCommunityModule])

export const AG_ROW_SELECTOR = '.ag-row'
export const AG_CELL_SELECTOR = '.ag-cell'

const AG_FILTERS: Record<string, string> = {
  text: 'agTextColumnFilter',
  number: 'agNumberColumnFilter',
  date: 'agDateColumnFilter',
  boolean: 'agTextColumnFilter',
}

// Built from the shared spec rather than written out, so a column added to the
// axis cannot reach one grid and not the other.
function buildColumnDefs(count: number): ColDef<Row>[] {
  return benchColumns(count).map((c) => ({
    field: c.field as keyof Row & string,
    headerName: c.header,
    width: c.width,
    ...(c.filter ? { filter: AG_FILTERS[c.filter] } : {}),
  }))
}

// Matched to the EliteGrid config: sortable + filterable, no resize animation,
// no row animation (EliteGrid has none, so leaving AG Grid's on would charge it
// for work its competitor never does), no selection column, no editing.
const defaultColDef: ColDef<Row> = {
  sortable: true,
  filter: true,
  resizable: true,
  suppressMovable: true,
}

export function AgBench({
  data,
  columnCount = DEFAULT_COLUMN_COUNT,
  onDriver,
}: {
  data: Row[]
  columnCount?: number
  onDriver: (d: Driver) => void
}) {
  const apiRef = useRef<GridApi<Row> | null>(null)
  const columnDefs = useMemo(() => buildColumnDefs(columnCount), [columnCount])

  const onGridReady = useCallback(
    (e: GridReadyEvent<Row>) => {
      apiRef.current = e.api
      onDriver({
        // Both are AG Grid's own: applyColumnState and setFilterModel.
        provides: { sort: 'library', filter: 'library' },
        rowSelector: AG_ROW_SELECTOR,
        // AG Grid 36 renamed the scrolling viewport from `.ag-body-viewport`
        // to `.ag-grid-viewport`. It also renders a *second* scrollable
        // (`.ag-body-vertical-scroll-viewport`, its custom scrollbar) — that
        // one is a proxy and driving it would not exercise virtualisation.
        scrollEl: () => document.querySelector<HTMLElement>('.ag-grid-viewport'),
        mutationRoot: () =>
          document.querySelector<HTMLElement>('.ag-grid-viewport'),
        sort: (dir) =>
          apiRef.current?.applyColumnState({
            state: [{ colId: 'salary', sort: dir }],
            defaultState: { sort: null },
          }),
        clearSort: () =>
          apiRef.current?.applyColumnState({ defaultState: { sort: null } }),
        filter: () =>
          apiRef.current?.setFilterModel({
            department: {
              filterType: 'text',
              type: 'equals',
              filter: 'Finance',
            },
          }),
        clearFilter: () => apiRef.current?.setFilterModel(null),
        renderedRows: () => document.querySelectorAll(AG_ROW_SELECTOR).length,
        renderedCells: () => document.querySelectorAll(AG_CELL_SELECTOR).length,
      })
    },
    [onDriver]
  )

  const theme = useMemo(() => themeQuartz, [])

  return (
    <div style={{ height: VIEWPORT_HEIGHT, width: VIEWPORT_WIDTH }}>
      <AgGridReact<Row>
        theme={theme}
        rowData={data}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={(p) => String(p.data.id)}
        rowHeight={ROW_HEIGHT}
        headerHeight={HEADER_HEIGHT}
        // Pinned from shared-config rather than left to the default. 10 IS
        // AG Grid's default `rowBuffer`, so its recorded numbers do not move
        // — the point is that the window is now declared in one place for
        // every library that exposes it.
        rowBuffer={ROW_BUFFER}
        animateRows={false}
        pagination={false}
        rowSelection={undefined}
        onGridReady={onGridReady}
      />
    </div>
  )
}
