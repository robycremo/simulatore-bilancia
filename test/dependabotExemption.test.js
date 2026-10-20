// Eccezione per gli aggiornamenti di Dependabot (change 0005, T1): funzioni pure.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { majorOf, compareManifests, evaluateExemption, DEPENDABOT } from '../scripts/dependabot-exemption.mjs';

describe('majorOf', () => {
  test('intervalli interpretabili', () => {
    assert.equal(majorOf('^9.2.0'), '9');
    assert.equal(majorOf('~1.4'), '1');
    assert.equal(majorOf('>=2.0.0'), '2');
    assert.equal(majorOf('>= 2.0.0 <3.0.0'), '2');
    assert.equal(majorOf('v10.0.0'), '10');
    assert.equal(majorOf('=8.18.0'), '8');
    assert.equal(majorOf('5.1.0-beta.2'), '5');
    assert.equal(majorOf('1.2.3 || 2.0.0'), '1');
  });

  test('serie 0.x: conta la minore', () => {
    assert.equal(majorOf('0.3.1'), '0.3');
    assert.equal(majorOf('^0.4.0'), '0.4');
  });

  test('valori non interpretabili', () => {
    for (const v of ['git+https://github.com/a/b.git', 'github:a/b', 'file:../x', 'npm:other@1.2.3', '*', 'latest', '1.x', '', undefined, 42]) {
      assert.equal(majorOf(v), null, String(v));
    }
  });
});

// Manifest di partenza, come quello del progetto (forma ridotta).
const base = () => ({
  name: 'simulatore-bilancia',
  version: '1.0.0',
  scripts: { test: 'node --test', dev: 'vite' },
  dependencies: { express: '^5.1.0', ws: '^8.18.0' },
  devDependencies: { concurrently: '^9.2.0', vite: '^7.1.0' },
});
const withChange = (mut) => {
  const h = base();
  mut(h);
  return h;
};
const pr3 = () => withChange((h) => (h.devDependencies.concurrently = '^9.2.5'));
const files = ['package.json', 'package-lock.json'];

describe('evaluateExemption', () => {
  test('1. aggiornamento minore di Dependabot (come la PR #3) → esente', () => {
    const r = evaluateExemption({ author: DEPENDABOT, changedFiles: files, base: base(), head: pr3() });
    assert.equal(r.exempt, true, r.reasons.join('; '));
    assert.deepEqual(r.updates, ['concurrently: ^9.2.0 → ^9.2.5']);
  });

  test('2. stessi file, autore diverso → rifiutato', () => {
    const r = evaluateExemption({ author: 'robycremo', changedFiles: files, base: base(), head: pr3() });
    assert.equal(r.exempt, false);
    assert.match(r.reasons.join('\n'), /autore della PR "robycremo" diverso da dependabot\[bot\]/);
  });

  test('3. file in più → rifiutato con il nome del file', () => {
    const r = evaluateExemption({ author: DEPENDABOT, changedFiles: [...files, '.github/workflows/ci.yml'], base: base(), head: pr3() });
    assert.equal(r.exempt, false);
    assert.match(r.reasons.join('\n'), /\.github\/workflows\/ci\.yml/);
  });

  test('4. dipendenza aggiunta → rifiutato', () => {
    const r = evaluateExemption({ author: DEPENDABOT, changedFiles: files, base: base(), head: withChange((h) => (h.dependencies.lodash = '^4.17.21')) });
    assert.deepEqual(r.reasons, ['dipendenza aggiunta in dependencies: lodash']);
  });

  test('5. dipendenza tolta → rifiutato', () => {
    const r = evaluateExemption({ author: DEPENDABOT, changedFiles: files, base: base(), head: withChange((h) => delete h.devDependencies.vite) });
    assert.deepEqual(r.reasons, ['dipendenza tolta da devDependencies: vite']);
  });

  test('6. script cambiato → rifiutato', () => {
    const r = evaluateExemption({ author: DEPENDABOT, changedFiles: files, base: base(), head: withChange((h) => (h.scripts.test = 'echo ok')) });
    assert.deepEqual(r.reasons, ['campo "scripts" di package.json modificato']);
  });

  test('7. versione maggiore → rifiutato; anche 0.3 → 0.4', () => {
    const r = evaluateExemption({ author: DEPENDABOT, changedFiles: files, base: base(), head: withChange((h) => (h.devDependencies.concurrently = '^10.0.0')) });
    assert.deepEqual(r.reasons, ['versione maggiore per concurrently: ^9.2.0 → ^10.0.0 (serve una change)']);
    const b0 = withChange((h) => (h.dependencies.tiny = '^0.3.1'));
    const h0 = withChange((h) => (h.dependencies.tiny = '^0.4.0'));
    assert.match(evaluateExemption({ author: DEPENDABOT, changedFiles: files, base: b0, head: h0 }).reasons.join(), /versione maggiore per tiny/);
  });

  test('8. valore non interpretabile → rifiutato', () => {
    const r = evaluateExemption({ author: DEPENDABOT, changedFiles: files, base: base(), head: withChange((h) => (h.dependencies.ws = 'github:websockets/ws')) });
    assert.match(r.reasons.join(), /versione non interpretabile per ws/);
  });

  test('9. più condizioni mancate → tutti i motivi elencati', () => {
    const head = withChange((h) => {
      h.devDependencies.concurrently = '^10.0.0';
      h.scripts.dev = 'vite --host';
      h.dependencies.lodash = '^4.17.21';
    });
    const r = evaluateExemption({ author: 'qualcuno', changedFiles: [...files, 'server/app.js'], base: base(), head });
    assert.equal(r.exempt, false);
    assert.equal(r.reasons.length, 5, r.reasons.join('\n'));
  });

  test('solo package-lock.json modificato da Dependabot → esente', () => {
    const r = evaluateExemption({ author: DEPENDABOT, changedFiles: ['package-lock.json'] });
    assert.equal(r.exempt, true);
  });

  test('compareManifests: package.json non leggibile → motivo esplicito', () => {
    assert.deepEqual(compareManifests(null, base()).reasons, ['package.json non leggibile come oggetto JSON']);
  });
});
