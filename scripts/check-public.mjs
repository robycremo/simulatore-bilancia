// Controllo dei contenuti pubblicabili (change 0004).
//   node scripts/check-public.mjs              file versionati e nuovi (non ignorati)
//   node scripts/check-public.mjs --history    anche tutti i commit, con l'elenco locale (richiede PCRE in git)
//
// Regole:
//  1. indirizzi IPv4 ammessi solo se di loopback, 0.0.0.0, 255.255.255.255 o negli intervalli per la documentazione
//     (RFC 5737: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24);
//  2. nessuna frase generica di rimando al documento d'origine del formato;
//  3. se esiste scripts/public-check.local.txt (ignorato da git), nessuna occorrenza dei valori che elenca.
// I valori precisi da cercare non vanno mai scritti in questo file: stanno solo nell'elenco locale.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const LOCAL_LIST = path.join(ROOT, 'scripts', 'public-check.local.txt');
const SKIP_FILES = new Set(['package-lock.json']);
const BINARY = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|bundle)$/i;
// Le frasi generiche sono ammesse solo nei documenti della change che ne parla.
const GENERIC_EXEMPT = /^changes\/0004-pubblicazione-open-source\//;

const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`(?<!\\d|\\d\\.)(?:${OCTET}\\.){3}${OCTET}(?!\\d|\\.\\d)`, 'g');
const ALLOWED_IP = [/^127\./, /^0\.0\.0\.0$/, /^255\.255\.255\.255$/, /^192\.0\.2\./, /^198\.51\.100\./, /^203\.0\.113\./];

// Costruite a pezzi perché il sorgente non contenga le frasi stesse.
const GENERIC = [
  ['manuale', 'del', 'terminale'],
  ['esempio', 'del', 'manuale'],
  ['come', 'da', 'manuale'],
].map((words) => new RegExp(words.join('\\s+'), 'i'));

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function localPatterns() {
  if (!fs.existsSync(LOCAL_LIST)) return [];
  return fs
    .readFileSync(LOCAL_LIST, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

const errors = [];
const files = git('ls-files', '-co', '--exclude-standard')
  .split('\n')
  .filter((f) => f && !SKIP_FILES.has(path.basename(f)) && !BINARY.test(f) && fs.existsSync(path.join(ROOT, f)));
const local = localPatterns().map((p) => new RegExp(p, 'i'));

for (const file of files) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    const where = `${file}:${i + 1}`;
    for (const m of line.matchAll(IPV4)) {
      if (!ALLOWED_IP.some((re) => re.test(m[0]))) errors.push(`${where}: indirizzo IP non ammesso ${m[0]}`);
    }
    if (!GENERIC_EXEMPT.test(file) && GENERIC.some((re) => re.test(line)))
      errors.push(`${where}: rimando al documento d'origine del formato`);
    for (const re of local) if (re.test(line)) errors.push(`${where}: valore dell'elenco locale (${re.source})`);
  });
}

if (process.argv.includes('--history')) {
  const patterns = localPatterns();
  if (!patterns.length) {
    errors.push('--history richiede scripts/public-check.local.txt');
  } else {
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'check-public-')), 'patterns.txt');
    fs.writeFileSync(tmp, patterns.join('\n') + '\n');
    for (const commit of git('rev-list', 'HEAD').split('\n').filter(Boolean)) {
      let out = '';
      try {
        out = git('grep', '-n', '-i', '-P', '-f', tmp, commit, '--', ':!package-lock.json');
      } catch (e) {
        if (e.status !== 1) throw e; // 1 = nessuna occorrenza
      }
      for (const hit of out.split('\n').filter(Boolean)) errors.push(`commit ${hit.slice(0, 7)}${hit.slice(40)}`);
    }
  }
}

if (errors.length) {
  console.error(`Contenuti non pubblicabili (${errors.length}):\n` + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(
  `OK: ${files.length} file controllati${local.length ? `, elenco locale di ${local.length} voci` : ''}` +
    (process.argv.includes('--history') ? ', storia inclusa' : '') +
    '.'
);
