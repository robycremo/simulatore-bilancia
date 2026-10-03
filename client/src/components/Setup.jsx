import { useEffect, useState } from 'react';

const get = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
function set(o, p, v) {
  const out = structuredClone(o);
  const keys = p.split('.');
  let cur = out;
  for (const k of keys.slice(0, -1)) cur = cur[k];
  cur[keys.at(-1)] = v;
  return out;
}

function Field({ d, path, label, type = 'number', options, hint, setD }) {
  const v = get(d, path);
  let input;
  if (type === 'bool') {
    input = <input type="checkbox" checked={!!v} onChange={(e) => setD(set(d, path, e.target.checked))} />;
  } else if (options) {
    input = (
      <select value={v} onChange={(e) => setD(set(d, path, e.target.value))}>
        {options.map(([val, lab]) => (
          <option key={val} value={val}>
            {lab}
          </option>
        ))}
      </select>
    );
  } else {
    input = (
      <input
        type={type}
        value={v}
        step="any"
        onChange={(e) => setD(set(d, path, type === 'number' ? Number(e.target.value) : e.target.value))}
      />
    );
  }
  return (
    <label className="sfield">
      <span className="lab">{label}</span>
      {input}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

const PROTO = [
  ['tcp', 'TCP'],
  ['udp', 'UDP'],
];

const CHANNEL_PROTO = [
  ['tcp', 'TCP client'],
  ['udp', 'UDP'],
  ['tcp-server', 'TCP server'],
];
const ACCESS = [
  ['local', 'solo questo PC'],
  ['network', 'rete (IP ammessi)'],
];
// Porte proposte passando a TCP server, se quella attuale è di un ricevitore di test (TR-5).
const SERVER_PORT = { pc: 4001, fom: 4002 };

const parseIps = (text) => text.split(/[\s,;]+/).filter(Boolean);

// Elenco IP come testo separato da virgole; convertito in lista all'uscita dal campo.
function IpList({ d, k, setD }) {
  const ips = d[k].allowedIps;
  const [text, setText] = useState(ips.join(', '));
  useEffect(() => setText(ips.join(', ')), [ips]);
  return (
    <label className="sfield">
      <span className="lab">IP ammessi</span>
      <input
        type="text"
        value={text}
        placeholder="es. 192.0.2.20, 192.0.2.21"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => setD(set(d, `${k}.allowedIps`, parseIps(text)))}
      />
      <span className="hint">indirizzi IPv4 separati da virgola, al massimo 20</span>
    </label>
  );
}

function Channel({ d, k, title, setD, status }) {
  const ch = d[k];
  const server = ch.proto === 'tcp-server';
  const setProto = (proto) => {
    let next = set(d, `${k}.proto`, proto);
    if (proto === 'tcp-server' && d.receivers.some((r) => r.port === ch.port)) next = set(next, `${k}.port`, SERVER_PORT[k]);
    setD(next);
  };
  return (
    <fieldset>
      <legend>{title}</legend>
      <Field d={d} setD={setD} path={`${k}.enabled`} label="Abilitata" type="bool" />
      <label className="sfield">
        <span className="lab">Protocollo</span>
        <select value={ch.proto} onChange={(e) => setProto(e.target.value)}>
          {CHANNEL_PROTO.map(([val, lab]) => (
            <option key={val} value={val}>
              {lab}
            </option>
          ))}
        </select>
        {server && <span className="hint">il simulatore ascolta: i client (es. PuTTY in modalità Raw) si collegano alla porta</span>}
      </label>
      {!server && <Field d={d} setD={setD} path={`${k}.host`} label="Indirizzo IP" type="text" />}
      <Field d={d} setD={setD} path={`${k}.port`} label={server ? 'Porta di ascolto' : 'Porta'} />
      {server && <Field d={d} setD={setD} path={`${k}.access`} label="Accesso" options={ACCESS} />}
      {server && ch.access === 'network' && <IpList d={d} k={k} setD={setD} />}
      {server && status?.mode === 'tcp-server' && (
        <div className="sfield">
          <span className="lab">Stato</span>
          <span className={`badge ${status.listening ? 'ok' : 'ko'}`}>{status.status ?? 'NON ATTIVO'}</span>
          <span className="hint">{status.listening ? `${status.clients} client collegati` : ''}</span>
        </div>
      )}
      <Field d={d} setD={setD} path={`${k}.ackNak`} label="Protocollo ACK/NAK" type="bool" />
      <Field d={d} setD={setD} path={`${k}.timeoutMs`} label="Timeout risposta (ms)" />
      <Field d={d} setD={setD} path={`${k}.retries`} label="Tentativi (ACK/NAK)" />
    </fieldset>
  );
}

export default function Setup({ config, cmd, state }) {
  const [d, setD] = useState(config);
  useEffect(() => setD(config), [config]);
  const dirty = JSON.stringify(d) !== JSON.stringify(config);
  const p = { d, setD };

  return (
    <div className="panel setup">
      <div className="row sticky">
        <button className="primary" disabled={!dirty} onClick={() => cmd('updateConfig', d)}>
          Salva setup
        </button>
        <button disabled={!dirty} onClick={() => setD(config)}>
          Annulla
        </button>
        {dirty && <span className="muted">modifiche non salvate</span>}
      </div>

      <fieldset>
        <legend>Pesatura</legend>
        <Field
          {...p}
          path="triggerMode"
          label="1) Funzionamento"
          options={[
            ['soglia', 'Con soglia'],
            ['input', 'Con input / fotocellula'],
          ]}
        />
        <Field {...p} path="threshold" label="2) Peso di soglia" hint="0 = nessun controllo" />
        <Field {...p} path="stableTimeout" label="3) Time-out peso stabile (decimi s)" hint="0 = attende sempre lo stabile" />
        <Field {...p} path="stableWindow" label="Finestra di stabilità (decimi s)" />
        <Field {...p} path="totalizeOnlyIfFomOk" label="4) Totalizza solo con trasmissione FOM corretta" type="bool" />
        <Field {...p} path="resetProgOnEndBatch" label="5) Progressivo a 1 dopo fine partita" type="bool" />
        <Field {...p} path="endBatchInput" label="9) Input di fine partita abilitato" type="bool" />
        <Field {...p} path="endBatchAckNak" label="Stringa fine partita con ACK/NAK" type="bool" />
        <Field {...p} path="errorOutputs" label="8) Uscite errore trasmissione FOM / PC" type="bool" />
      </fieldset>

      <fieldset>
        <legend>Stampante</legend>
        <Field {...p} path="printerPresent" label="Stampante presente" type="bool" />
        <Field
          {...p}
          path="ticketType"
          label="10) Tipo"
          options={[
            ['nastro', 'Nastro'],
            ['cartellino', 'Cartellino'],
          ]}
        />
        <Field {...p} path="reducedPrint" label="Stampa ridotta (progressivo + netto)" type="bool" />
        <Field {...p} path="printerPreCheck" label="6) Controlli stato stampante prima di stampare" type="bool" />
        <Field {...p} path="clearTotalsAfterPrint" label="Azzera totali dopo la stampa" type="bool" />
      </fieldset>

      <fieldset>
        <legend>Bilancia</legend>
        <Field {...p} path="capacity" label="Portata" />
        <Field {...p} path="division" label="Divisione" />
        <Field {...p} path="unit" label="Unità di misura" type="text" />
        <Field
          {...p}
          path="decimalSep"
          label="Separatore decimale"
          options={[
            [',', 'virgola'],
            ['.', 'punto'],
          ]}
        />
      </fieldset>

      <fieldset>
        <legend>Stringhe</legend>
        <Field {...p} path="prefix" label="Carattere di inizio" type="text" />
        <Field
          {...p}
          path="checksum"
          label="Checksum (2 car.)"
          options={[
            ['none', 'Nessuno (104 car.)'],
            ['xor', 'XOR esadecimale (106 car.)'],
            ['sum', 'Somma mod 256 esadecimale (106 car.)'],
          ]}
        />
        <Field {...p} path="mppTemplate" label="Stringa MPP" type="text" />
        <Field {...p} path="endBatchTemplate" label="Stringa fine partita" type="text" />
        <p className="hint">
          Campi: {'{data} {ora} {prog} {codice} {desc} {cgen} {risultato} {lordo} {tara} {netto} {mpp}'}; nella fine partita anche{' '}
          {'{npesate} {totnetto}'}. Carattere iniziale, checksum e CR vengono aggiunti in automatico.
        </p>
      </fieldset>

      <Channel {...p} k="pc" title="7) Trasmissione a PC" status={state?.channels?.pc} />
      <Channel {...p} k="fom" title="7) Trasmissione a FOM" status={state?.channels?.fom} />

      <fieldset>
        <legend>Ricevitori di test</legend>
        {d.receivers.map((r, i) => (
          <div key={i} className="row">
            <b style={{ width: 40 }}>{r.name}</b>
            <Field {...p} path={`receivers.${i}.port`} label="Porta" />
            <Field {...p} path={`receivers.${i}.proto`} label="Protocollo" options={PROTO} />
            <Field {...p} path={`receivers.${i}.autoStart`} label="Avvio automatico" type="bool" />
          </div>
        ))}
        <p className="hint">Le modifiche ai ricevitori valgono al prossimo avvio/riavvio del ricevitore.</p>
      </fieldset>
    </div>
  );
}
