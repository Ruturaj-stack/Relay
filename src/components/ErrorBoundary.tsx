import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface State {
  hasError: boolean
  message?: string
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('RELAY surface error', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-danger/25 bg-danger/10 text-danger">
            <AlertTriangle size={22} />
          </div>
          <h1 className="text-[20px] font-medium tracking-tight text-ink">Something broke on this screen</h1>
          <p className="mt-2 max-w-[420px] text-[12.5px] leading-relaxed text-muted">
            {this.state.message || 'An unexpected error interrupted the view.'} Your saved handoffs are untouched.
          </p>
          <button
            type="button"
            className="btn btn-secondary mt-6"
            onClick={() => {
              this.setState({ hasError: false })
              window.location.reload()
            }}
          >
            <RefreshCw size={14} /> Reload RELAY
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
