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
import { RowGroupingModule } from 'ag-grid-enterprise'
import type { Driver } from './bench'
import type { Row } from './data'
import {
  ROW_HEIGHT,
  HEADER_HEIGHT,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  DEFAULT_COLUMN_COUNT,
  benchColumns,
  GROUP_FIELD,
  GROUP_SUM_FIELD,
  GROUP_AVG_FIELD,
  GROUP_EXPANDED_LEVELS,
  GROUP_COLUMN_WIDTH,
  ROW_BUFFER,
} from './shared-config'

// Row grouping with aggregation is NOT in AG Grid Community — there is no
// RowGroupingModule there at all. The grouped scenario therefore measures
// EliteGrid's free feature against AG Grid's PAID one, and that is the only
// comparison available: the Community tier cannot run this shape.
//
// The enterprise module is registered only when the grouped scenario asks
// for it, so the existing matrix keeps registering exactly what it always
// did and its recorded numbers do not move.
const GROUPED = new URLSearchParams(window.location.search).get('group') === '1'

ModuleRegistry.registerModules(
  GROUPED ? [AllCommunityModule, RowGroupingModule] : [AllCommunityModule]
)

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
function buildColumnDefs(count: number, grouped: boolean): ColDef<Row>[] {
  return benchColumns(count).map((c) => ({
    field: c.field as keyof Row & string,
    headerName: c.header,
    width: c.width,
    ...(c.filter ? { filter: AG_FILTERS[c.filter] } : {}),
    // `hide` matches EliteGrid, which drops the grouped column from the
    // body by default (keepGroupedColumns is false). Without it AG Grid
    // would render one more column than its competitor.
    ...(grouped && c.field === GROUP_FIELD ? { rowGroup: true, hide: true } : {}),
    ...(grouped && c.field === GROUP_SUM_FIELD ? { aggFunc: 'sum' } : {}),
    ...(grouped && c.field === GROUP_AVG_FIELD ? { aggFunc: 'avg' } : {}),
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
  grouped = false,
  onDriver,
}: {
  data: Row[]
  columnCount?: number
  grouped?: boolean
  onDriver: (d: Driver) => void
}) {
  const apiRef = useRef<GridApi<Row> | null>(null)
  const columnDefs = useMemo(
    () => buildColumnDefs(columnCount, grouped),
    [columnCount, grouped]
  )

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
        groupDefaultExpanded={grouped ? GROUP_EXPANDED_LEVELS : undefined}
        grandTotalRow={grouped ? 'bottom' : undefined}
        autoGroupColumnDef={
          grouped
            ? { headerName: 'Department', width: GROUP_COLUMN_WIDTH }
            : undefined
        }
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
