// Schema dei comandi WebSocket e dei loro argomenti (APIs, Security).
// Ogni validatore riceve (valore, contesto) e restituisce { ok: true, value } oppure { ok: false, error }.

const ok = (value) => ({ ok: true, value });
const fail = (error) => ({ ok: false, error });
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const num = (min, max, { int = false } = {}) => (v, ctx) => {
  const lo = typeof min === 'function' ? min(ctx) : min;
  const hi = typeof max === 'function' ? max(ctx) : max;
  if (typeof v !== 'number' || !Number.isFinite(v) || (int && !Number.isInteger(v)) || v < lo || v > hi) {
    return fail(`atteso numero${int ? ' intero' : ''} tra ${lo} e ${hi}`);
  }
  return ok(v);
};
const positive = (max) => (v) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? ok(v) : fail(`atteso numero maggiore di 0 e fino a ${max}`);
const bool = (v) => (typeof v === 'boolean' ? ok(v) : fail('atteso booleano'));
const str = (max, { min = 0 } = {}) => (v) =>
  typeof v === 'string' && v.length >= min && v.length <= max ? ok(v) : fail(`attesa stringa di ${min}–${max} caratteri`);
const oneOf = (...values) => (v) => (values.includes(v) ? ok(v) : fail(`atteso uno tra: ${values.join(', ')}`));
const none = (v) => (v === undefined || v === null ? ok(undefined) : fail('nessun argomento previsto'));

const obj = (shape, { partial = false, optional = [] } = {}) => (v, ctx) => {
  if (!isPlainObject(v)) return fail('atteso oggetto');
  for (const k of Object.keys(v)) if (!(k in shape)) return fail(`campo sconosciuto "${k}"`);
  const out = {};
  for (const [k, check] of Object.entries(shape)) {
    if (v[k] === undefined) {
      if (partial || optional.includes(k)) continue;
      return fail(`manca il campo "${k}"`);
    }
    const r = check(v[k], ctx);
    if (!r.ok) return fail(`${k}: ${r.error}`);
    out[k] = r.value;
  }
  if (partial && Object.keys(out).length === 0) return fail('nessun campo');
  return ok(out);
};

const arr = (item, length) => (v, ctx) => {
  if (!Array.isArray(v) || v.length !== length) return fail(`attesa lista di ${length} elementi`);
  const out = [];
  for (let i = 0; i < v.length; i++) {
    const r = item(v[i], ctx);
    if (!r.ok) return fail(`[${i}] ${r.error}`);
    out.push(r.value);
  }
  return ok(out);
};

// Lista a lunghezza variabile (0…max), opzionalmente senza duplicati.
const arrOf = (item, { max, unique = false }) => (v, ctx) => {
  if (!Array.isArray(v) || v.length > max) return fail(`attesa lista di al massimo ${max} elementi`);
  const out = [];
  for (let i = 0; i < v.length; i++) {
    const r = item(v[i], ctx);
    if (!r.ok) return fail(`[${i}] ${r.error}`);
    if (unique && out.includes(r.value)) return fail(`[${i}] valore duplicato "${r.value}"`);
    out.push(r.value);
  }
  return ok(out);
};

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const ipv4 = (v) => (typeof v === 'string' && IPV4_RE.test(v) ? ok(v) : fail(`indirizzo IPv4 non valido "${v}"`));

const port = num(1, 65535, { int: true });
const proto = oneOf('tcp', 'udp');
const channelProto = oneOf('tcp', 'udp', 'tcp-server');
const reply = oneOf('ack', 'nak', 'none');

export const MAX_ALLOWED_IPS = 20;

const channel = obj({
  enabled: bool,
  host: str(253, { min: 1 }),
  port,
  proto: channelProto,
  access: oneOf('local', 'network'),
  allowedIps: arrOf(ipv4, { max: MAX_ALLOWED_IPS, unique: true }),
  ackNak: bool,
  timeoutMs: num(0, 60000, { int: true }),
  retries: num(0, 20, { int: true }),
});

const receiverCfg = obj({
  name: str(10, { min: 1 }),
  port,
  proto,
  reply,
  autoStart: bool,
});

const configFields = obj({
  triggerMode: oneOf('soglia', 'input'),
  threshold: num(0, 1e7),
  stableTimeout: num(0, 6000, { int: true }),
  stableWindow: num(1, 100, { int: true }),
  totalizeOnlyIfFomOk: bool,
  resetProgOnEndBatch: bool,
  printerPreCheck: bool,
  endBatchInput: bool,
  endBatchAckNak: bool,
  errorOutputs: bool,
  printerPresent: bool,
  ticketType: oneOf('nastro', 'cartellino'),
  reducedPrint: bool,
  clearTotalsAfterPrint: bool,
  capacity: positive(1e7),
  division: positive(1000),
  unit: str(3, { min: 1 }),
  decimalSep: oneOf(',', '.'),
  prefix: str(4),
  checksum: oneOf('none', 'xor', 'sum'),
  mppTemplate: str(200),
  endBatchTemplate: str(200),
  pc: channel,
  fom: channel,
  receivers: arr(receiverCfg, 2),
});

// Controlli tra campi del setup (modalità TCP server).
function crossCheck(c) {
  const receiverPorts = c.receivers.map((r) => r.port);
  for (const k of ['pc', 'fom']) {
    const ch = c[k];
    if (ch.proto !== 'tcp-server') continue;
    if (ch.access === 'network' && ch.allowedIps.length === 0)
      return `${k}: con accesso "rete" serve almeno un IP ammesso`;
    if (receiverPorts.includes(ch.port)) return `${k}: la porta ${ch.port} è già usata da un ricevitore di test`;
  }
  if (c.pc.proto === 'tcp-server' && c.fom.proto === 'tcp-server' && c.pc.port === c.fom.port)
    return `pc e fom: stessa porta server ${c.pc.port}`;
  return null;
}

export const configSchema = (v, ctx) => {
  const r = configFields(v, ctx);
  if (!r.ok) return r;
  const error = crossCheck(r.value);
  return error ? fail(error) : r;
};

const loadRange = (ctx) => (ctx?.config?.capacity ?? 0) * 1.2;

export const commands = {
  setLoad: num((ctx) => -loadRange(ctx), loadRange),
  setNoise: bool,
  zero: none,
  tare: none,
  printKey: none,
  printInput: none,
  photocell: bool,
  endBatch: none,
  printTotals: none,
  togglePrinter: none,
  toggleMode: none,
  setPrinterStatus: obj({ connected: bool, paper: bool }, { partial: true }),
  setData: obj(
    {
      code: num(0, 999999, { int: true }),
      desc: str(20),
      cgen: str(8),
      result: num(-9999999, 99999999, { int: true }),
      mpp: num(0, 999999, { int: true }),
    },
    { partial: true }
  ),
  setProgressive: num(1, 999999, { int: true }),
  resetTotals: none,
  clearPrinter: none,
  clearLogs: none,
  clearMpp: none,
  updateConfig: configSchema,
  receiver: obj(
    { index: num(0, 1, { int: true }), action: oneOf('start', 'stop', 'reply'), reply },
    { optional: ['reply'] }
  ),
};

export function validateCommand(cmd, args, ctx) {
  if (typeof cmd !== 'string' || !Object.hasOwn(commands, cmd)) return fail(`comando sconosciuto "${cmd}"`);
  const r = commands[cmd](args, ctx);
  if (!r.ok) return fail(`${cmd}: ${r.error}`);
  if (cmd === 'receiver' && r.value.action === 'reply' && !r.value.reply) return fail('receiver: manca il campo "reply"');
  return r;
}
