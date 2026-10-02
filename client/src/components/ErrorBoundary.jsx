import { Component } from 'react';
import { storedToken } from '../hooks/useEngine.js';

function report(error, info) {
  const headers = { 'Content-Type': 'application/json' };
  const token = storedToken();
  if (token) headers['X-Sim-Token'] = token;
  fetch('/api/client-error', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: String(error?.message || error).slice(0, 500),
      stack: String(error?.stack || '').slice(0, 1500),
      componentStack: String(info?.componentStack || '').slice(0, 1500),
    }),
  }).catch(() => {});
}

// Un errore di rendering mostra un pannello con "Ricarica" invece di una pagina bianca, e viene registrato dal server.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    report(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fatal">
        <h2>Errore dell'interfaccia</h2>
        <p>L'errore è stato registrato nel log del simulatore. Il motore della bilancia continua a funzionare.</p>
        <pre>{String(this.state.error.message || this.state.error)}</pre>
        <button className="primary" onClick={() => location.reload()}>
          Ricarica
        </button>
      </div>
    );
  }
}
