// Costruzione delle stringhe trasmesse dal terminale.
//
// Stringa dati pesata (104 caratteri, 106 con checksum):
//   $ | data(10) | ora(8) | progressivo(6) | cod.merce(6) | descrizione(20) |
//   cod.generico(8) | risultato(8) | lordo(9+3) | tara(9+3) | netto(9+3) | [checksum(2)] | CR

export function decimalsOf(division) {
  const s = String(division);
  return s.includes('.') ? s.split('.')[1].length : 0;
}

export function roundToDivision(value, division) {
  const d = decimalsOf(division);
  return Number((Math.round(value / division) * division).toFixed(d));
}

export function fmtWeight(value, cfg, width = 9) {
  const s = value.toFixed(decimalsOf(cfg.division)).replace('.', cfg.decimalSep);
  return s.padStart(width);
}

export function fmtUnit(cfg) {
  return (' ' + cfg.unit).padEnd(3).slice(0, 3);
}

const pad2 = (n) => String(n).padStart(2, '0');
export const fmtDate = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
export const fmtTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

const fixL = (v, n) => String(v ?? '').padEnd(n).slice(0, n);
const fixR = (v, n) => String(v ?? '').padStart(n).slice(-n);

export function checksum(body, type) {
  if (type === 'xor') {
    let x = 0;
    for (const ch of Buffer.from(body, 'latin1')) x ^= ch;
    return x.toString(16).toUpperCase().padStart(2, '0');
  }
  if (type === 'sum') {
    let s = 0;
    for (const ch of Buffer.from(body, 'latin1')) s = (s + ch) & 0xff;
    return s.toString(16).toUpperCase().padStart(2, '0');
  }
  return '';
}

// Aggiunge carattere di inizio, checksum (calcolato sul corpo, escluso il carattere iniziale) e CR.
export function frame(body, cfg) {
  return cfg.prefix + body + checksum(body, cfg.checksum) + '\r';
}

function fields(rec, cfg, extra = {}) {
  const u = fmtUnit(cfg);
  return {
    data: rec.date,
    ora: rec.time,
    prog: fixR(rec.prog, 6),
    codice: fixR(rec.code, 6),
    desc: fixL(rec.desc, 20),
    cgen: fixL(rec.cgen, 8),
    risultato: fixR(rec.result, 8),
    lordo: fmtWeight(rec.gross, cfg) + u,
    tara: fmtWeight(rec.tare, cfg) + u,
    netto: fmtWeight(rec.net, cfg) + u,
    mpp: fixR(rec.mpp, 6),
    ...extra,
  };
}

export function buildWeighString(rec, cfg) {
  const f = fields(rec, cfg);
  const body = f.data + f.ora + f.prog + f.codice + f.desc + f.cgen + f.risultato + f.lordo + f.tara + f.netto;
  return frame(body, cfg);
}

export function fillTemplate(template, rec, cfg, extra = {}) {
  const f = fields(rec, cfg, extra);
  return frame(template.replace(/\{(\w+)\}/g, (m, k) => (k in f ? f[k] : m)), cfg);
}

export function visible(s) {
  return s.replace(/\r/g, '<CR>').replace(/\n/g, '<LF>').replace(/\x06/g, '<ACK>').replace(/\x15/g, '<NAK>');
}
