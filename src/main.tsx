import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import StartupErrorScreen from './components/StartupErrorScreen'
import { initStorage } from './storage'

const root = createRoot(document.getElementById('root')!)

initStorage().then(
  () => root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
  error => {
    console.error('Failed to initialise storage', error)
    root.render(<StartupErrorScreen error={error} />)
  },
)
