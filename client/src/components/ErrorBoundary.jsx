/**
 * RutaQuilla - ErrorBoundary
 * Captura errores críticos de React y muestra una pantalla de recuperación
 * en vez de la pantalla azul/blanca vacía.
 */

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Error desconocido' };
  }

  componentDidCatch(error, info) {
    console.error('[RutaQuilla ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg, #0B1120 0%, #111827 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 20, padding: 32,
          fontFamily: 'Inter, sans-serif',
        }}>
          {/* Icon */}
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.08))',
            border: '1.5px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32,
          }}>
            🚌
          </div>

          <div style={{ textAlign: 'center', maxWidth: 360 }}>
            <h2 style={{
              fontSize: 20, fontWeight: 700, color: '#F1F5F9',
              marginBottom: 8, fontFamily: 'Outfit, sans-serif',
            }}>
              Algo salió mal
            </h2>
            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, marginBottom: 4 }}>
              RutaQuilla encontró un error inesperado. El mapa se reiniciará automáticamente.
            </p>
            {this.state.errorMessage && (
              <code style={{
                display: 'block', marginTop: 12, padding: '8px 12px',
                background: 'rgba(239,68,68,0.06)', borderRadius: 8,
                border: '1px solid rgba(239,68,68,0.15)',
                fontSize: 11, color: '#F87171', textAlign: 'left',
                wordBreak: 'break-all',
              }}>
                {this.state.errorMessage}
              </code>
            )}
          </div>

          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 28px', borderRadius: 14, border: 'none',
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              color: '#000', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', letterSpacing: '0.01em',
              boxShadow: '0 6px 20px rgba(245,158,11,0.35)',
            }}
          >
            🔄 Recargar RutaQuilla
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
