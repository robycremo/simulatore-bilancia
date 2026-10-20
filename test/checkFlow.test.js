// check-flow con l'eccezione per Dependabot (change 0005, T3): repository git temporanei con una copia degli script.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tempDir } from './helpers.js';

const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args], { cwd });
const write = (dir, files) => {
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
  }
};

const manifest = (concurrently = '^9.2.0', extra = {}) => ({
  name: 'prova',
  version: '1.0.0',
  scripts: { test: 'node --test' },
  devDependencies: { concurrently },
  ...extra,
});

// Repository con main (base) e un ramo "pr" con le modifiche indicate; restituisce la cartella.
function repo(prFiles) {
  const dir = tempDir();
  git(dir, 'init', '-q', '-b', 'main');
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  for (const f of ['check-flow.mjs', 'dependabot-exemption.mjs']) fs.copyFileSync(path.join(SCRIPTS, f), path.join(dir, 'scripts', f));
  write(dir, {
    'constitution.md': '# c\n', 'intent.md': '# i\n', 'spec.md': '# s\n', 'tech-requirements.md': '# t\n', 'plan.md': '# p\n',
    'changes/README.md': '# change\n',
    'package.json': manifest(),
    'package-lock.json': { name: 'prova', lockfileVersion: 3, packages: { 'node_modules/concurrently': { version: '9.2.4' } } },
  });
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'base');
  git(dir, 'switch', '-q', '-c', 'pr');
  write(dir, prFiles);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'pr');
  return dir;
}

const run = (dir, author) => {
  const env = { ...process.env };
  delete env.PR_AUTHOR;
  if (author !== undefined) env.PR_AUTHOR = author;
  return spawnSync(process.execPath, ['scripts/check-flow.mjs', '--base', 'main'], { cwd: dir, encoding: 'utf8', env });
};

// Stessi file e versioni della PR #3: concurrently ^9.2.0 → ^9.2.5 e lock aggiornato.
const PR3 = {
  'package.json': manifest('^9.2.5'),
  'package-lock.json': { name: 'prova', lockfileVersion: 3, packages: { 'node_modules/concurrently': { version: '9.2.5' }, 'node_modules/shell-quote': { version: '1.12.0' } } },
};

test('riproduzione della PR #3 con autore dependabot[bot] → esente, con la riga dell\'eccezione', () => {
  const r = run(repo(PR3), 'dependabot[bot]');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Eccezione per gli aggiornamenti di Dependabot applicata .*concurrently: \^9\.2\.0 → \^9\.2\.5/);
});

test('stessa PR senza PR_AUTHOR (esecuzione locale) → regola di sempre', () => {
  const r = run(repo(PR3));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /codice modificato senza una change in changes\/: package\.json/);
  assert.doesNotMatch(r.stderr, /eccezione/);
});

test('stessa PR con un altro autore (anche su un ramo chiamato dependabot/…) → rifiutata con il motivo', () => {
  const dir = repo(PR3);
  git(dir, 'branch', '-m', 'dependabot/npm_and_yarn/finto');
  const r = run(dir, 'qualcuno');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /autore della PR "qualcuno" diverso da dependabot\[bot\]/);
});

test('PR di Dependabot che tocca anche un altro file → rifiutata con il nome del file', () => {
  const r = run(repo({ ...PR3, 'server.js': 'console.log(1)\n' }), 'dependabot[bot]');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /file diversi da package\.json e package-lock\.json: server\.js/);
});

test('PR di Dependabot con versione maggiore → rifiutata: serve una change', () => {
  const r = run(repo({ 'package.json': manifest('^10.0.0') }), 'dependabot[bot]');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /versione maggiore per concurrently: \^9\.2\.0 → \^10\.0\.0 \(serve una change\)/);
});

test('modifica senza codice (solo documenti) → invariata, nessuna eccezione necessaria', () => {
  const r = run(repo({ 'intent.md': '# intent aggiornato\n' }), 'qualcuno');
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /Eccezione/);
});
