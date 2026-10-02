import { useEffect, useState } from 'react';
import { fmtW } from '../hooks/useEngine.js';

function DataField({ label, value, onCommit, width, type = 'text' }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={v}
        style={{ width }}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => onCommit(v)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </label>
  );
}

export default function Controls({ state: s, config: c, cmd }) {
  const [loadText, setLoadText] = useState('');
  const step = Number(c.division);
  const setLoad = (v) => cmd('setLoad', Math.round(v / step) * step);
  const presets = [0, c.threshold / 2, c.threshold * 1.5, c.capacity / 10, c.capacity / 2].map((v) =>
    Number((Math.round(v / step) * step).toFixed(6))
  );

  return (
    <div className="controls">
      <fieldset>
        <legend>Carico sulla bilancia</legend>
        <input
          type="range"
          className="slider"
          min={0}
          max={c.capacity * 1.05}
          step={step}
          value={s.load}
          onChange={(e) => setLoad(Number(e.target.value))}
        />
        <div className="row">
          <span className="loadval">
            {fmtW(s.load, c)} {c.unit}
          </span>
          <input
            placeholder="peso…"
            value={loadText}
            style={{ width: 90 }}
            onChange={(e) => setLoadText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setLoad(Number(loadText.replace(',', '.')) || 0);
                setLoadText('');
              }
            }}
          />
          {presets.map((p, i) => (
            <button key={i} onClick={() => setLoad(p)}>
              {fmtW(p, c)}
            </button>
          ))}
          <button onClick={() => setLoad(s.load - step * 10)}>−10d</button>
          <button onClick={() => setLoad(s.load + step * 10)}>+10d</button>
          <label className="chk">
            <input type="checkbox" checked={s.noise} onChange={(e) => cmd('setNoise', e.target.checked)} /> peso instabile
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Tastiera e ingressi</legend>
        <div className="keys">
          <button onClick={() => cmd('zero')}>ZERO <kbd>F7</kbd></button>
          <button onClick={() => cmd('tare')}>TARA <kbd>F8</kbd></button>
          <button className="primary" onClick={() => cmd('printKey')}>
            STAMPA <kbd>F2</kbd>
          </button>
          <button className={s.photocell ? 'active' : ''} onClick={() => cmd('photocell', !s.photocell)}>
            FOTOCELLULA {s.photocell ? 'OSCURATA' : 'LIBERA'} <kbd>F3</kbd>
          </button>
          <button onClick={() => cmd('printInput')}>INPUT STAMPA</button>
          <button disabled={!c.endBatchInput} onClick={() => cmd('endBatch')}>
            FINE PARTITA <kbd>F4</kbd>
          </button>
          <button className={s.printerEnabled ? '' : 'warn'} onClick={() => cmd('togglePrinter')}>
            STAMPANTE {s.printerEnabled ? 'ON' : 'OFF'} <kbd>F5</kbd>
          </button>
          <button onClick={() => cmd('toggleMode')}>
            STD / MPP <kbd>F6</kbd>
          </button>
          <button onClick={() => cmd('printTotals')}>STAMPA TOTALI</button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Dati pesata</legend>
        <div className="row wrap">
          <DataField label="Cod. merce" width={70} value={s.data.code} onCommit={(v) => cmd('setData', { code: Number(v) || 0 })} />
          <DataField label="Descrizione" width={170} value={s.data.desc} onCommit={(v) => cmd('setData', { desc: v.slice(0, 20) })} />
          <DataField label="Cod. generico" width={90} value={s.data.cgen} onCommit={(v) => cmd('setData', { cgen: v.slice(0, 8) })} />
          <DataField label="Risultato" width={80} value={s.data.result} onCommit={(v) => cmd('setData', { result: Number(v) || 0 })} />
          <DataField label="Cod. MPP" width={70} value={s.data.mpp} onCommit={(v) => cmd('setData', { mpp: Number(v) || 0 })} />
          <DataField label="Progressivo" width={70} value={s.progressive} onCommit={(v) => cmd('setProgressive', Number(v) || 1)} />
        </div>
        <div className="row totals">
          Totali: <b>{s.totals.count}</b> pesate · netto <b>{fmtW(s.totals.net, c)} {c.unit}</b>
          <button onClick={() => cmd('resetTotals')}>azzera totali</button>
        </div>
      </fieldset>
    </div>
  );
}
