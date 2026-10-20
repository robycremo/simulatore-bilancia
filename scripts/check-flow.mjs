// Verifica che le change rispettino il percorso
//   intent → spec → tech-requirements → plan → tasks → codice → test-results.
//   node scripts/check-flow.mjs                 controlla la struttura di changes/
//   node scripts/check-flow.mjs --base <ref>    controlla anche che le modifiche al codice rispetto a <ref> tocchino una change
//     con PR_AUTHOR impostata (solo nella CI delle pull request) vale l'eccezione per Dependabot (costituzione § 3)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { evaluateExemption } from './dependabot-exemption.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHANGES = path.join(ROOT, 'changes');
const DOCS = ['intent', 'spec', 'tech-requirements', 'plan', 'tasks', 'test-results'];
const ROOT_DOCS = ['constitution.md', 'intent.md', 'spec.md', 'tech-requirements.md', 'plan.md'];
// Stati ammessi per documento
const STATES = {
  intent: ['bozza', 'approvato', 'completato', 'abbandonato'],
  spec: ['bozza', 'approvato', 'completato', 'abbandonato'],
  'tech-requirements': ['bozza', 'approvato', 'completato', 'abbandonato'],
  plan: ['bozza', 'approvato', 'completato', 'abbandonato'],
  tasks: ['bozza', 'approvato', 'in corso', 'completato', 'abbandonato'],
  'test-results': ['bozza', 'in corso', 'completato', 'abbandonato'],
};
const CODE_PATHS = [/^server\//, /^client\/src\//, /^client\/index\.html$/, /^package\.json$/, /^vite\.config\.js$/];

const errors = [];
const fail = (msg) => errors.push(msg);

function readState(file) {
  const m = fs.readFileSync(file, 'utf8').match(/^> Stato:\s*(.+?)\s*$/m);
  return m ? m[1] : null;
}

for (const doc of ROOT_DOCS) {
  if (!fs.existsSync(path.join(ROOT, doc))) fail(`manca il documento vivo ${doc} in radice`);
}

const dirs = fs
  .readdirSync(CHANGES, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== '_template')
  .map((d) => d.name)
  .sort();

const seen = new Set();
for (const name of dirs) {
  if (!/^\d{4}-[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    fail(`${name}: il nome deve essere NNNN-nome-in-kebab-case`);
    continue;
  }
  const num = name.slice(0, 4);
  if (seen.has(num)) fail(`${name}: numero ${num} già usato`);
  seen.add(num);

  const st = {};
  for (const doc of DOCS) {
    const file = path.join(CHANGES, name, `${doc}.md`);
    if (!fs.existsSync(file)) {
      fail(`${name}: manca ${doc}.md`);
      continue;
    }
    const s = readState(file);
    if (!s) fail(`${name}/${doc}.md: manca la riga "> Stato: ..."`);
    else if (!STATES[doc].includes(s)) fail(`${name}/${doc}.md: stato "${s}" non valido (${STATES[doc].join(', ')})`);
    st[doc] = s;
  }
  if (Object.keys(st).length < DOCS.length || Object.values(st).includes('abbandonato')) continue;

  for (let i = 1; i < DOCS.length; i++) {
    const [prev, doc] = [DOCS[i - 1], DOCS[i]];
    if (st[doc] !== 'bozza' && st[prev] === 'bozza') fail(`${name}: ${doc}.md oltre la bozza con ${prev}.md in bozza`);
  }
  if (st['test-results'] !== 'bozza' && !['in corso', 'completato'].includes(st.tasks))
    fail(`${name}: test-results.md avviato ma tasks.md non avviato`);
  // La chiusura è un unico passo: test-results completato ⇔ tutti i documenti completati.
  // Prima della chiusura solo tasks può essere completato.
  const closed = st['test-results'] === 'completato';
  for (const doc of DOCS) {
    if (closed && st[doc] !== 'completato') fail(`${name}: test-results.md completato ma ${doc}.md no`);
    if (!closed && doc !== 'tasks' && doc !== 'test-results' && st[doc] === 'completato')
      fail(`${name}: ${doc}.md completato prima della chiusura (test-results.md non completato)`);
  }
}

const baseIdx = process.argv.indexOf('--base');
if (baseIdx > 0) {
  const base = process.argv[baseIdx + 1];
  const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const codeTouched = changed.filter((f) => CODE_PATHS.some((re) => re.test(f)));
  const changeTouched = changed.some((f) => /^changes\/\d{4}-/.test(f));
  if (codeTouched.length && !changeTouched) {
    const author = process.env.PR_AUTHOR?.trim();
    const exemption = author ? dependabotExemption(base, changed, author) : null;
    if (exemption?.exempt) {
      // Costituzione § 3, change 0005: aggiornamento di versione di Dependabot, nessuna change richiesta.
      console.log(
        `Eccezione per gli aggiornamenti di Dependabot applicata (PR di ${author}; file: ${changed.join(', ')}): ` +
          (exemption.updates.length ? exemption.updates.join(', ') : 'solo package-lock.json')
      );
    } else {
      fail(`codice modificato senza una change in changes/: ${codeTouched.join(', ')}`);
      if (exemption) {
        for (const r of exemption.reasons) fail(`eccezione per Dependabot non applicabile: ${r}`);
      }
    }
  }
}

// Legge package.json alla base comune e in HEAD, poi valuta l'eccezione (scripts/dependabot-exemption.mjs).
function dependabotExemption(base, changedFiles, author) {
  const readManifest = (ref) => {
    try {
      return JSON.parse(execFileSync('git', ['show', `${ref}:package.json`], { cwd: ROOT, encoding: 'utf8' }));
    } catch {
      return null;
    }
  };
  const mergeBase = execFileSync('git', ['merge-base', base, 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  return evaluateExemption({ author, changedFiles, base: readManifest(mergeBase), head: readManifest('HEAD') });
}

if (errors.length) {
  console.error('Percorso intent → spec → tech-requirements → plan → tasks → codice → test-results non rispettato:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`OK: ${dirs.length} change verificate.`);
