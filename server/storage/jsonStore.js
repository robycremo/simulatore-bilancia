// Persistenza su file JSON (Database & storage).
// - scrittura atomica: file temporaneo + fsync + rename, la versione precedente resta in <file>.bak
// - lettura con recupero: file illeggibile → <file>.corrupt-<data-ora>, poi .bak, poi valori di default
import fs from 'node:fs';

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function parseFile(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!isPlainObject(data)) throw new Error('il contenuto non è un oggetto JSON');
  return data;
}

function stamp(d) {
  return d.toISOString().replace(/[:.]/g, '-');
}

// Ritorna { data, warning }: data è null se si devono usare i default.
export function readJson(file, { now = () => new Date() } = {}) {
  if (!fs.existsSync(file)) return { data: null, warning: null };
  try {
    return { data: parseFile(file), warning: null };
  } catch (e) {
    const corrupt = `${file}.corrupt-${stamp(now())}`;
    fs.renameSync(file, corrupt);
    try {
      return { data: parseFile(`${file}.bak`), warning: { file, corrupt, reason: e.message, recovered: 'bak' } };
    } catch {
      return { data: null, warning: { file, corrupt, reason: e.message, recovered: 'default' } };
    }
  }
}

function renameWithRetry(from, to) {
  // Su Windows (antivirus, OneDrive) il file può essere bloccato per un istante.
  for (let i = 0; ; i++) {
    try {
      return fs.renameSync(from, to);
    } catch (e) {
      if (i >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * (i + 1));
    }
  }
}

export function writeJsonSync(file, data) {
  const tmp = `${file}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, JSON.stringify(data, null, 2));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  if (fs.existsSync(file)) {
    try {
      parseFile(file);
      fs.copyFileSync(file, `${file}.bak`);
    } catch {
      // la versione attuale non è valida: non sovrascrive un .bak buono
    }
  }
  renameWithRetry(tmp, file);
}
