import { createRoot } from 'react-dom/client'
import { App } from './App'
import '@elitegrid/react/styles.css'
import './index.css'

// No StrictMode: it double-invokes render and effects, which would double the
// measured mount work for one library's adapter and not necessarily the
// other's. Production builds do not run StrictMode either.
createRoot(document.getElementById('root')!).render(<App />)
