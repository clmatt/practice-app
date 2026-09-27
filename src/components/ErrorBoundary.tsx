import { Component, type ErrorInfo, type ReactNode } from 'react'
import { exportData } from '../backup'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Catches render crashes so the user can still export their data. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="h-full p-6 flex flex-col justify-center gap-4 bg-slate-950 text-slate-100">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="text-slate-400 text-sm">
          Your data is still saved on this device. Export a backup to be safe, then reload.
        </p>
        <p className="text-xs text-slate-500 font-mono break-words">{error.message}</p>
        <button
          onClick={() => void exportData()}
          className="w-full bg-violet-600 hover:bg-violet-500 rounded-xl py-3 font-semibold"
        >
          Export data
        </button>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-slate-800 hover:bg-slate-700 rounded-xl py-3 font-semibold"
        >
          Reload
        </button>
        <button
          onClick={() => {
            window.location.hash = '#/'
            this.setState({ error: null })
          }}
          className="w-full text-slate-400 text-sm py-2"
        >
          Go to home screen
        </button>
      </div>
    )
  }
}
