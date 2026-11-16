import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Dev only: ?battle=<encounter-id> opens the battle preview (see src/battle3d/BattlePreview.tsx).
const BattlePreview = import.meta.env.DEV ? React.lazy(() => import('./battle3d/BattlePreview')) : null
const preview = BattlePreview && new URLSearchParams(location.search).has('battle')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {preview && BattlePreview ? (
      <React.Suspense fallback={null}>
        <BattlePreview />
      </React.Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
