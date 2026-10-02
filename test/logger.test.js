import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '../server/observability/logger.js';
import { tempDir } from './helpers.js';

test('una riga JSON per evento nel file del giorno', () => {
  const dir = tempDir();
  const now = new Date(2026, 9, 2, 15, 30, 0);
  const log = createLogger({ dir, toConsole: false, now: () => now });
  log.info('weighing', { prog: 1, net: 237.5 });
  log.warn('tx_error', { ch: 'FOM', reason: 'NAK' });
  const lines = fs.readFileSync(path.join(dir, 'simulatore-2026-10-02.log'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].event, 'weighing');
  assert.equal(lines[0].level, 'info');
  assert.equal(lines[0].net, 237.5);
  assert.equal(lines[1].level, 'warn');
  assert.ok(lines[0].ts);
});

test('cambio file a mezzanotte', () => {
  const dir = tempDir();
  let now = new Date(2026, 9, 2, 23, 59, 59);
  const log = createLogger({ dir, toConsole: false, now: () => now });
  log.info('a');
  now = new Date(2026, 9, 3, 0, 0, 1);
  log.info('b');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['simulatore-2026-10-02.log', 'simulatore-2026-10-03.log']);
});

test('all\'avvio elimina i log più vecchi di 14 giorni e lascia gli altri file', () => {
  const dir = tempDir();
  for (const name of ['simulatore-2026-09-17.log', 'simulatore-2026-09-18.log', 'simulatore-2026-10-01.log', 'altro.txt']) {
    fs.writeFileSync(path.join(dir, name), '');
  }
  createLogger({ dir, toConsole: false, now: () => new Date(2026, 9, 2, 8, 0, 0) });
  const left = fs.readdirSync(dir).sort();
  assert.ok(!left.includes('simulatore-2026-09-17.log'), '15 giorni: eliminato');
  assert.ok(left.includes('simulatore-2026-09-18.log'), '14 giorni: conservato');
  assert.ok(left.includes('simulatore-2026-10-01.log'));
  assert.ok(left.includes('altro.txt'));
});
