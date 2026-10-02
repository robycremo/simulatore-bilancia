import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCommand, configSchema } from '../server/api/validate.js';
import { DEFAULT_CONFIG } from '../server/domain/engine.js';

const ctx = { config: DEFAULT_CONFIG };
const v = (cmd, args) => validateCommand(cmd, args, ctx);

test('comandi validi', () => {
  assert.equal(v('setLoad', 237.5).ok, true);
  assert.equal(v('zero').ok, true);
  assert.equal(v('photocell', true).ok, true);
  assert.equal(v('setData', { desc: 'COTTO', code: 12 }).ok, true);
  assert.equal(v('receiver', { index: 1, action: 'reply', reply: 'nak' }).ok, true);
  assert.equal(v('receiver', { index: 0, action: 'stop' }).ok, true);
  assert.equal(v('updateConfig', structuredClone(DEFAULT_CONFIG)).ok, true);
});

test('setLoad non numerico o fuori portata', () => {
  assert.equal(v('setLoad', 'abc').ok, false);
  assert.equal(v('setLoad', NaN).ok, false);
  assert.equal(v('setLoad', DEFAULT_CONFIG.capacity * 2).ok, false);
});

test('comando sconosciuto, anche se è una proprietà di Object', () => {
  assert.equal(v('formatDisk').ok, false);
  assert.equal(v('constructor').ok, false);
  assert.equal(v('__proto__').ok, false);
});

test('argomenti non previsti', () => {
  assert.equal(v('zero', 5).ok, false);
  assert.equal(v('setData', { desc: 'x'.repeat(21) }).ok, false);
  assert.equal(v('setData', { altro: 1 }).ok, false);
  assert.equal(v('setData', {}).ok, false);
  assert.equal(v('setProgressive', '7').ok, false);
  assert.equal(v('setProgressive', 0).ok, false);
  assert.equal(v('receiver', { index: 2, action: 'start' }).ok, false);
  assert.equal(v('receiver', { index: 0, action: 'reply' }).ok, false);
});

test('updateConfig: porte, divisione, soglia, chiavi sconosciute', () => {
  const bad = (mut) => {
    const c = structuredClone(DEFAULT_CONFIG);
    mut(c);
    return configSchema(c).ok;
  };
  assert.equal(bad((c) => (c.pc.port = 70000)), false);
  assert.equal(bad((c) => (c.receivers[1].port = 0)), false);
  assert.equal(bad((c) => (c.division = 0)), false);
  assert.equal(bad((c) => (c.threshold = -1)), false);
  assert.equal(bad((c) => (c.capacity = 0)), false);
  assert.equal(bad((c) => (c.fom.proto = 'http')), false);
  assert.equal(bad((c) => (c.pc.host = '')), false);
  assert.equal(bad((c) => (c.extra = 1)), false);
  assert.equal(bad((c) => delete c.unit), false);
  assert.equal(bad((c) => (c.stableTimeout = 1.5)), false);
});
