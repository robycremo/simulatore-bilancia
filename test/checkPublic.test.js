// Controllo dei contenuti pubblicabili (change 0004, T7): repository git temporanei con file di prova.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tempDir } from './helpers.js';

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'check-public.mjs');
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args], { cwd });

function repo(files) {
  const dir = tempDir();
  git(dir, 'init', '-q');
  write(dir, files);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'prova');
  return dir;
}
function write(dir, files) {
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
}
const run = (dir, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
// Frase generica costruita a pezzi, come nello script.
const PHRASE = ['manuale', 'del', 'terminale'].join(' ');
// IP privati di prova costruiti a runtime, così il file di test non contiene indirizzi non ammessi.
const PRIVATE_A = [172, 16, 5, 9].join('.');
const PRIVATE_B = [10, 20, 30, 40].join('.');

test('IP ammessi: loopback, 0.0.0.0, RFC 5737; numeri che non sono IP ignorati', () => {
  const dir = repo({
    'a.md': 'http://127.0.0.1:3000, 0.0.0.0, 255.255.255.255, 192.0.2.10, 198.51.100.4, 203.0.113.254.\n',
    'b.js': "const x = ['01.2.3.4', '198.51.100.4.5', '10.0.0.256', `203.0.113.${1}`];\n",
  });
  const r = run(dir);
  assert.equal(r.status, 0, r.stderr);
});

test('IP non ammesso → errore con file e riga', () => {
  const dir = repo({ 'docs/x.md': `riga uno\ncollegato da ${PRIVATE_A} alle 10\n` });
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes(`docs/x.md:2: indirizzo IP non ammesso ${PRIVATE_A}`), r.stderr);
});

test('frase generica → errore, salvo nei documenti della change 0004', () => {
  assert.equal(run(repo({ 'spec.md': `Vince il ${PHRASE}.\n` })).status, 1);
  assert.equal(run(repo({ 'changes/0004-pubblicazione-open-source/spec.md': `frasi come "${PHRASE}"\n` })).status, 0);
});

test('file nuovo non ancora versionato: controllato; file ignorato: no', () => {
  const dir = repo({ '.gitignore': 'locale/\n', 'a.md': 'ok\n' });
  write(dir, { 'nuovo.md': `host ${PRIVATE_B}\n`, 'locale/x.md': `host ${PRIVATE_B}\n` });
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /nuovo\.md:1/);
  assert.doesNotMatch(r.stderr, /locale\/x\.md/);
});

test('elenco locale: valori cercati nei file e, con --history, nei commit precedenti', () => {
  const dir = repo({ '.gitignore': 'scripts/public-check.local.txt\n', 'a.md': 'codice segreto ZZTOP-42\n' });
  write(dir, { 'scripts/public-check.local.txt': '# elenco di prova\nzztop-\\d+\n' });
  assert.equal(run(dir).status, 1, 'trovato nei file (senza distinzione di maiuscole)');

  write(dir, { 'a.md': 'testo ripulito\n' });
  git(dir, 'commit', '-q', '-am', 'pulizia');
  assert.equal(run(dir).status, 0, 'file attuali puliti');
  const h = run(dir, '--history');
  assert.equal(h.status, 1, 'ancora presente nel primo commit');
  assert.match(h.stderr, /commit [0-9a-f]{7}:a\.md:1/);
});

test('--history senza elenco locale → errore esplicito', () => {
  const r = run(repo({ 'a.md': 'ok\n' }), '--history');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /richiede scripts\/public-check\.local\.txt/);
});
