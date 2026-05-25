import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ─── Catch top-level errors and show them on screen (no more white screen) ───
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
    this.setState({ info })
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0a0a0f',
          color: '#fff',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontSize: 14,
          lineHeight: 1.5,
        }}>
          <h1 style={{ color: '#E85D26', fontSize: 22, margin: '0 0 12px' }}>
            ⚠ Application Error
          </h1>
          <p style={{ color: '#9ca3af', marginBottom: 16 }}>
            Something prevented the app from rendering. Details below:
          </p>
          <div style={{
            background: '#1a1a24',
            border: '1px solid rgba(232, 93, 38, 0.3)',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
            fontFamily: 'ui-monospace, Consolas, monospace',
            fontSize: 12,
            overflow: 'auto',
          }}>
            <strong style={{ color: '#fb923c' }}>
              {this.state.error?.name}: {this.state.error?.message}
            </strong>
            {this.state.error?.stack && (
              <pre style={{
                marginTop: 12,
                color: '#9ca3af',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {this.state.error.stack}
              </pre>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#E85D26',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Reload
          </button>
          <p style={{ marginTop: 16, fontSize: 11, color: '#6b7280' }}>
            Copy the error above and send to the developer.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}

// Also catch global unhandled errors (outside React tree)
window.addEventListener('error', (e) => {
  console.error('[window.error]', e.error || e.message)
  const root = document.getElementById('root')
  if (root && !root.innerHTML) {
    root.innerHTML = `<div style="padding:24px;font-family:system-ui;color:#fff;background:#0a0a0f;min-height:100vh">
      <h1 style="color:#E85D26">⚠ Boot Error</h1>
      <pre style="background:#1a1a24;padding:16px;border-radius:8px;color:#fb923c;white-space:pre-wrap;word-break:break-word">${(e.error?.stack || e.message || 'Unknown error').replace(/</g, '&lt;')}</pre>
    </div>`
  }
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandledrejection]', e.reason)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
