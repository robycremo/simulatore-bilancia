import { useEffect, useRef } from 'react';
import { fmtW } from '../hooks/useEngine.js';

function useAutoScroll(dep) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [dep]);
  return ref;
}

export function PrinterPanel({ lists, state: s, config: c, cmd }) {
  const ref = useAutoScroll(lists.printerOut.length);
  return (
    <div className="panel">
      <div className="row">
        <label className="chk">
          <input
            type="checkbox"
            checked={s.printer.connected}
            onChange={(e) => cmd('setPrinterStatus', { connected: e.target.checked })}
          />{' '}
          collegata
        </label>
        <label className="chk">
          <input type="checkbox" checked={s.printer.paper} onChange={(e) => cmd('setPrinterStatus', { paper: e.target.checked })} /> carta
          presente
        </label>
        <span className={`badge ${s.printerFault ? 'ko' : 'ok'}`}>{s.printerFault ? 'STAMPANTE IN AVARIA' : 'STAMPANTE OK'}</span>
        <span className="muted">
          {c.printerPresent ? `${c.ticketType}${c.reducedPrint ? ', stampa ridotta' : ''}` : 'non presente'}
        </span>
        <button onClick={() => cmd('clearPrinter')}>pulisci</button>
      </div>
      <pre ref={ref} className={`paper ${c.ticketType}`}>
        {lists.printerOut.join('\n') || '(nessuna stampa)'}
      </pre>
    </div>
  );
}

export function TxPanel({ lists, cmd }) {
  const ref = useAutoScroll(lists.txLog.length);
  return (
    <div className="panel">
      <div className="row">
        <span className="muted">Stringhe inviate a PC / FOM (caratteri di controllo mostrati come &lt;CR&gt;)</span>
        <button onClick={() => cmd('clearLogs')}>pulisci</button>
      </div>
      <div ref={ref} className="log">
        {lists.txLog.map((l, i) => (
          <div key={i} className={l.ok ? '' : 'err'}>
            <span className="t">{l.t}</span> <b>{l.ch}</b> {l.kind} · {l.reason}
            {l.attempts > 1 ? ` (${l.attempts} tentativi)` : ''}{l.clients != null ? ` · ${l.clients} client` : ''} · {l.payload.replace(/<CR>$/, '').length + 1} car.
            <pre>{l.payload}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MppPanel({ lists, config: c, cmd }) {
  const ref = useAutoScroll(lists.mppArchive.length);
  const tot = lists.mppArchive.reduce((a, r) => a + r.net, 0);
  return (
    <div className="panel">
      <div className="row">
        <span>
          {lists.mppArchive.length} pesate in archivio · netto {fmtW(tot, c)} {c.unit}
        </span>
        <button onClick={() => cmd('clearMpp')}>svuota archivio</button>
      </div>
      <div ref={ref} className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Data</th>
              <th>Ora</th>
              <th>Cod. MPP</th>
              <th>Prog.</th>
              <th>Lordo</th>
              <th>Tara</th>
              <th>Netto</th>
              <th>Trasm. PC</th>
            </tr>
          </thead>
          <tbody>
            {lists.mppArchive.map((r) => (
              <tr key={r.n}>
                <td>{r.n}</td>
                <td>{r.date}</td>
                <td>{r.time}</td>
                <td>{r.mpp}</td>
                <td>{r.prog}</td>
                <td className="num">{fmtW(r.gross, c)}</td>
                <td className="num">{fmtW(r.tare, c)}</td>
                <td className="num">
                  {fmtW(r.net, c)}
                  {r.unstable ? ' *' : ''}
                </td>
                <td className={r.tx === 'OK' || r.tx === '-' ? '' : 'errtxt'}>{r.tx}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">* peso acquisito per time-out, non stabile</p>
    </div>
  );
}

export function ReceiverPanel({ lists, config: c, cmd }) {
  const ref = useAutoScroll(lists.rxLog.length);
  return (
    <div className="panel">
      <p className="muted">
        Ricevitori integrati che simulano PC e FOM in ascolto. Porta e protocollo si impostano in Setup; la risposta si cambia
        qui al volo (NAK o nessuna risposta servono a provare gli errori di trasmissione con ACK/NAK attivo).
      </p>
      {c.receivers.map((rc, i) => {
        const st = lists.receivers[i] || {};
        return (
          <div key={i} className="row rx">
            <b>{rc.name}</b>
            <span>
              {rc.proto.toUpperCase()} {rc.port}
            </span>
            <span className={`badge ${st.running ? 'ok' : 'ko'}`}>{st.status}</span>
            <select value={rc.reply} onChange={(e) => cmd('receiver', { index: i, action: 'reply', reply: e.target.value })}>
              <option value="ack">risponde ACK</option>
              <option value="nak">risponde NAK</option>
              <option value="none">non risponde</option>
            </select>
            {st.running ? (
              <button onClick={() => cmd('receiver', { index: i, action: 'stop' })}>ferma</button>
            ) : (
              <button onClick={() => cmd('receiver', { index: i, action: 'start' })}>avvia</button>
            )}
          </div>
        );
      })}
      <div ref={ref} className="log">
        {lists.rxLog.map((l, i) => (
          <div key={i}>
            <span className="t">{l.t}</span> <b>{l.rx}</b> da {l.from} · {l.len} car.
            <pre>{l.data}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
