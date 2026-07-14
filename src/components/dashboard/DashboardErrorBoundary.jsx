import React from 'react';

class DashboardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Dashboard section error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          background: 'var(--bg-danger-subtle)',
          border: '1px solid var(--error-border)',
          borderRadius: 'var(--radius-lg)',
          textAlign: 'center',
          margin: '8px 0'
        }}>
          <p style={{ color: 'var(--text-danger)', fontWeight: 600, fontSize: 'var(--font-size-sm)', margin: 0 }}>
            {this.props.fallbackText || 'This section failed to load'}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default DashboardErrorBoundary;
