'use client';
import React from 'react';

interface State { hasError: boolean; error?: Error; requestId?: string; }

export class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const requestId = typeof window !== 'undefined' ? (window as any).__lastRequestId : undefined;
    console.error('[UI_ERROR]', {
      error: error.message,
      component: info.componentStack?.split('\n')[1]?.trim(),
      request_id: requestId,
      stack: error.stack?.split('\n').slice(0, 3).join(' | '),
    });
    this.setState({ requestId });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', background: '#0d0f14', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '2rem',
        fontFamily: 'Georgia, serif', color: '#e2e8f0',
      }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: '#c8a96b', fontSize: '1.5rem', marginBottom: '1rem' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#94a3b8', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            An unexpected error occurred. Please refresh the page or go back.
          </p>
          {this.state.requestId && (
            <p style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '1.5rem' }}>
              Request ID: <code style={{ color: '#c8a96b' }}>{this.state.requestId}</code>
            </p>
          )}
          <button
            onClick={() => window.location.href = '/'}
            style={{
              background: '#c8a96b', color: '#0d0f14', border: 'none',
              padding: '0.75rem 2rem', borderRadius: '0.5rem',
              cursor: 'pointer', fontWeight: 'bold',
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }
}
