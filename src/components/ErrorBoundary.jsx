import { Component } from 'react';

/**
 * Top-level error boundary.
 *
 * React 18: if any component tree throws during render, React unmounts the
 * entire tree and shows a blank white page — unless an Error Boundary is in
 * place.  This boundary catches those crashes and shows a useful message so
 * the user can reload rather than staring at a white screen.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console so the error appears in browser DevTools / server logs
    console.error('[ErrorBoundary] Uncaught render error:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #151744 0%, #393392 50%, #707CF1 100%)',
          color: '#fff',
          padding: '2rem',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>
            Something went wrong
          </h1>
          <p style={{ opacity: 0.85, marginBottom: '0.5rem', textAlign: 'center', maxWidth: 480 }}>
            An unexpected error occurred while loading the application.
          </p>
          {this.state.error && (
            <pre style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 8,
              fontSize: '0.75rem',
              maxWidth: 600,
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => window.location.href = '/'}
            style={{
              marginTop: '1.5rem',
              padding: '0.6rem 1.5rem',
              borderRadius: 8,
              border: 'none',
              background: '#fff',
              color: '#151744',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
