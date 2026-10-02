import { useState } from 'react';

// Richiesta del token di accesso per i client non locali; il token resta per la sessione del browser.
export default function TokenPrompt({ error, onSubmit }) {
  const [token, setToken] = useState('');
  return (
    <div className="overlay">
      <form
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (token) onSubmit(token);
        }}
      >
        <h2>Accesso al simulatore</h2>
        <p className="muted">Il simulatore è su un altro PC: inserire il token di accesso (variabile SIM_TOKEN del server).</p>
        <input type="password" autoFocus value={token} onChange={(e) => setToken(e.target.value)} placeholder="token" />
        {error && <p className="errtxt">{error}</p>}
        <button className="primary" type="submit" disabled={!token}>
          Entra
        </button>
      </form>
    </div>
  );
}
