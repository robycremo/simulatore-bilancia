// Log strutturati (Error tracking & logs): una riga JSON per evento in <dir>/simulatore-AAAA-MM-GG.log,
// più una riga leggibile in console. Scrittura sincrona: gli eventi sono pochi e un errore fatale
// deve finire su file prima che il processo termini.
import fs from 'node:fs';
import path from 'node:path';

const FILE_RE = /^simulatore-(\d{4}-\d{2}-\d{2})\.log$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hms = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

export function errorInfo(err) {
  if (err instanceof Error) return { message: err.message, code: err.code, stack: err.stack };
  return { message: String(err) };
}

// Elimina i file di log con data più vecchia di `retentionDays` giorni.
export function cleanupLogs(dir, retentionDays, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const removed = [];
  for (const name of fs.readdirSync(dir)) {
    const m = name.match(FILE_RE);
    if (!m) continue;
    const [y, mo, d] = m[1].split('-').map(Number);
    if (today - new Date(y, mo - 1, d).getTime() > retentionDays * DAY_MS) {
      fs.rmSync(path.join(dir, name), { force: true });
      removed.push(name);
    }
  }
  return removed;
}

function consoleLine(d, level, event, fields) {
  const parts = Object.entries(fields)
    .filter(([k]) => k !== 'stack')
    .map(([k, v]) => `${k}=${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`);
  return `${hms(d)} ${level.toUpperCase().padEnd(5)} ${event}${parts.length ? ' ' + parts.join(' ') : ''}`;
}

export function createLogger({ dir, retentionDays = 14, toConsole = true, now = () => new Date() }) {
  fs.mkdirSync(dir, { recursive: true });
  const removed = cleanupLogs(dir, retentionDays, now());

  function write(level, event, fields = {}) {
    const d = now();
    const rec = { ts: d.toISOString(), level, event, ...fields };
    try {
      fs.appendFileSync(path.join(dir, `simulatore-${ymd(d)}.log`), JSON.stringify(rec) + '\n');
    } catch (e) {
      console.error('Impossibile scrivere il log:', e.message);
    }
    if (toConsole) {
      const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      out(consoleLine(d, level, event, fields));
    }
  }

  const logger = {
    dir,
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields),
  };
  if (removed.length) logger.info('log_cleanup', { removed: removed.length });
  return logger;
}

export const nullLogger = { info() {}, warn() {}, error() {} };
