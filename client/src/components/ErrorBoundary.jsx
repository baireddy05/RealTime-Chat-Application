import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    try {
      window.location.reload();
    } catch {}
  };

  // Nuclear option for stale cached chunks after a deploy: drop the service
  // worker + every cache, then reload fresh from the network.
  handlePurgeAndReload = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
      }
    } catch {}
    try {
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
      }
    } catch {}
    try {
      window.location.reload();
    } catch {}
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = /dynamically imported module|importing a module|chunk|Loading/i.test(
        String(this.state.error?.message || "")
      );
      return (
        <div style={{ padding: 20, backgroundColor: '#641212', color: 'white', height: '100%', overflow: 'auto' }}>
          <h2>Something went wrong.</h2>
          <p style={{ fontSize: 13, opacity: 0.9 }}>
            {isChunkError
              ? "A part of the app failed to load (often a stale update). Reloading usually fixes it."
              : "The app hit an unexpected error. Your chats and data are safe."}
          </p>
          <div style={{ display: 'flex', gap: 8, margin: '12px 0', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.12)', color: 'white', fontWeight: 700, cursor: 'pointer' }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: 'white', color: '#641212', fontWeight: 700, cursor: 'pointer' }}
            >
              Reload app
            </button>
            <button
              type="button"
              onClick={this.handlePurgeAndReload}
              style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', fontWeight: 600, cursor: 'pointer' }}
              title="Clears offline cache and reloads (fixes stale-update crashes)"
            >
              Clear cache & reload
            </button>
          </div>
          <details style={{ whiteSpace: 'pre-wrap', fontSize: 12, opacity: 0.85 }}>
            <summary style={{ cursor: 'pointer' }}>Details</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
