import { useEffect, useState } from 'react';
import { useEngine } from './hooks/useEngine.js';
import Display from './components/Display.jsx';
import Controls from './components/Controls.jsx';
import Setup from './components/Setup.jsx';
import { PrinterPanel, TxPanel, MppPanel, ReceiverPanel } from './components/Panels.jsx';
import Toast from './components/Toast.jsx';
import TokenPrompt from './components/TokenPrompt.jsx';

// Solo in sviluppo: ?crash forza un errore di rendering per provare ErrorBoundary.
function CrashTest() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('crash')) {
    throw new Error('Errore di prova forzato con ?crash');
  }
  return null;
}

const TABS = [
  ['printer', 'Stampante'],
  ['tx', 'Trasmissioni'],
  ['mpp', 'Archivio MPP'],
  ['rx', 'Ricevitori test'],
  ['setup', 'Setup'],
];

export default function App() {
  const { state, config, lists, connected, cmd, auth, submitToken, errors } = useEngine();
  const [tab, setTab] = useState('printer');

  // Tasti rapidi del terminale
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && !e.key.startsWith('F')) return;
      const map = {
        F2: () => cmd('printKey'),
        F3: () => cmd('photocell', !state?.photocell),
        F4: () => cmd('endBatch'),
        F5: () => cmd('togglePrinter'),
        F6: () => cmd('toggleMode'),
        F7: () => cmd('zero'),
        F8: () => cmd('tare'),
      };
      if (map[e.key]) {
        e.preventDefault();
        map[e.key]();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cmd, state?.photocell]);

  if (auth.required) return <TokenPrompt error={auth.error} onSubmit={submitToken} />;

  if (!state || !config) {
    return <div className="loading">{connected ? 'Caricamento…' : 'Connessione al server del simulatore…'}</div>;
  }

  return (
    <div className="app">
      <CrashTest />
      <Toast errors={errors} />
      <header className="topbar">
        <h1>Simulatore terminale di pesatura</h1>
        <span className={`conn ${connected ? 'ok' : 'ko'}`}>{connected ? 'server connesso' : 'server non raggiungibile'}</span>
      </header>
      <main className="layout">
        <section className="left">
          <Display state={state} config={config} />
          <Controls state={state} config={config} cmd={cmd} />
        </section>
        <section className="right">
          <nav className="tabs">
            {TABS.map(([k, label]) => (
              <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </nav>
          <div className="tabbody">
            {tab === 'printer' && <PrinterPanel lists={lists} state={state} config={config} cmd={cmd} />}
            {tab === 'tx' && <TxPanel lists={lists} cmd={cmd} />}
            {tab === 'mpp' && <MppPanel lists={lists} config={config} cmd={cmd} />}
            {tab === 'rx' && <ReceiverPanel lists={lists} config={config} cmd={cmd} />}
            {tab === 'setup' && <Setup config={config} cmd={cmd} />}
          </div>
        </section>
      </main>
    </div>
  );
}
