import { useCallback, useRef, useState } from 'react'
import { EliteBench, ELITE_ROW_SELECTOR } from './EliteBench'
import { AgBench, AG_ROW_SELECTOR } from './AgBench'
import { TanStackBench, TS_ROW_SELECTOR } from './TanStackBench'
import { RdgBench, RDG_ROW_SELECTOR } from './RdgBench'
import { installBench, type Driver } from './bench'
import { generateData, type Row } from './data'
import {
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  DEFAULT_COLUMN_COUNT,
} from './shared-config'

type Library = 'elite' | 'ag' | 'tanstack' | 'rdg'

const LIBRARIES: readonly Library[] = ['elite', 'ag', 'tanstack', 'rdg']

const ROW_SELECTORS: Record<Library, string> = {
  elite: ELITE_ROW_SELECTOR,
  ag: AG_ROW_SELECTOR,
  tanstack: TS_ROW_SELECTOR,
  rdg: RDG_ROW_SELECTOR,
}

const params = new URLSearchParams(window.location.search)
const requested = params.get('lib')
const library: Library = LIBRARIES.includes(requested as Library)
  ? (requested as Library)
  : 'elite'
const rowCount = Number(params.get('rows') ?? 1000)
// Column axis. Defaults to the base eight, so every URL that predates the axis
// behaves exactly as it did.
const columnCount = Number(params.get('cols') ?? DEFAULT_COLUMN_COUNT)

// Generated once, before anything mounts, and deliberately outside every
// measured window — data generation is the harness's cost, not the grid's.
const data: Row[] = generateData(rowCount, columnCount)

export function App() {
  const [mounted, setMounted] = useState(false)
  const driverRef = useRef<Driver | null>(null)

  const onDriver = useCallback((d: Driver) => {
    driverRef.current = d
  }, [])

  // Installed on first render so Playwright can await `window.__bench.ready`
  // before it touches anything.
  if (!window.__bench) {
    window.__benchRowSelector = ROW_SELECTORS[library]
    window.__benchMount = () => setMounted(true)
    installBench(library, rowCount, () => driverRef.current)
  }

  return (
    <div
      id="bench-host"
      style={{
        height: VIEWPORT_HEIGHT,
        width: VIEWPORT_WIDTH,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {mounted && library === 'ag' && (
        <AgBench data={data} columnCount={columnCount} onDriver={onDriver} />
      )}
      {mounted && library === 'elite' && (
        <EliteBench data={data} columnCount={columnCount} onDriver={onDriver} />
      )}
      {mounted && library === 'tanstack' && (
        <TanStackBench
          data={data}
          columnCount={columnCount}
          onDriver={onDriver}
        />
      )}
      {mounted && library === 'rdg' && (
        <RdgBench data={data} columnCount={columnCount} onDriver={onDriver} />
      )}
    </div>
  )
}
