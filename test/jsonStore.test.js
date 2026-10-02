import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonSync } from '../server/storage/jsonStore.js';
import { tempDir } from './helpers.js';

test('file assente → dati nulli senza avviso', () => {
  assert.deepEqual(readJson(path.join(tempDir(), 'x.json')), { data: null, warning: null });
});

test('scrittura: nessun file temporaneo residuo, versione precedente in .bak', () => {
  const dir = tempDir();
  const f = path.join(dir, 'state.json');
  writeJsonSync(f, { progressive: 1 });
  assert.equal(fs.existsSync(`${f}.bak`), false);
  writeJsonSync(f, { progressive: 2 });
  assert.deepEqual(JSON.parse(fs.readFileSync(f, 'utf8')), { progressive: 2 });
  assert.deepEqual(JSON.parse(fs.readFileSync(`${f}.bak`, 'utf8')), { progressive: 1 });
  assert.deepEqual(fs.readdirSync(dir).sort(), ['state.json', 'state.json.bak']);
});

test('file corrotto con .bak valido → rinominato, recupero dal .bak', () => {
  const dir = tempDir();
  const f = path.join(dir, 'state.json');
  writeJsonSync(f, { progressive: 5 });
  writeJsonSync(f, { progressive: 6 });
  fs.writeFileSync(f, '{"progressive": 6,'); // scrittura interrotta
  const r = readJson(f);
  assert.deepEqual(r.data, { progressive: 5 });
  assert.equal(r.warning.recovered, 'bak');
  assert.ok(fs.readdirSync(dir).some((n) => n.startsWith('state.json.corrupt-')));
  assert.equal(fs.existsSync(f), false);
});

test('file corrotto senza .bak → default', () => {
  const dir = tempDir();
  const f = path.join(dir, 'config.json');
  fs.writeFileSync(f, 'non è json');
  const r = readJson(f);
  assert.equal(r.data, null);
  assert.equal(r.warning.recovered, 'default');
});

test('JSON valido ma non oggetto → trattato come corrotto', () => {
  const dir = tempDir();
  const f = path.join(dir, 'state.json');
  fs.writeFileSync(f, '[1,2,3]');
  assert.equal(readJson(f).warning.recovered, 'default');
});

test('un file attuale corrotto non sovrascrive un .bak valido', () => {
  const dir = tempDir();
  const f = path.join(dir, 'state.json');
  writeJsonSync(f, { progressive: 1 });
  writeJsonSync(f, { progressive: 2 });
  fs.writeFileSync(f, 'rotto');
  writeJsonSync(f, { progressive: 3 });
  assert.deepEqual(JSON.parse(fs.readFileSync(`${f}.bak`, 'utf8')), { progressive: 1 });
});
