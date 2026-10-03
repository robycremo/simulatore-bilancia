import { test, describe } from 'node:test';
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

describe('modalità TCP server (0003)', () => {
  const check = (mut) => {
    const c = structuredClone(DEFAULT_CONFIG);
    mut(c);
    return configSchema(c);
  };
  const server = (c, k = 'pc', port = 4001) => {
    c[k].proto = 'tcp-server';
    c[k].port = port;
  };

  test('nuovi valori e campi validi', () => {
    assert.equal(check((c) => server(c)).ok, true);
    assert.equal(check((c) => (server(c), (c.pc.access = 'network'), (c.pc.allowedIps = ['192.0.2.10', '198.51.100.20']))).ok, true);
    assert.equal(check((c) => (server(c, 'pc', 4001), server(c, 'fom', 4002))).ok, true);
  });

  test('valori non ammessi', () => {
    assert.equal(check((c) => (c.pc.proto = 'tcp-client')).ok, false);
    assert.equal(check((c) => (c.pc.access = 'internet')).ok, false);
    assert.equal(check((c) => delete c.pc.access).ok, false);
    assert.equal(check((c) => (c.pc.allowedIps = '203.0.113.1')).ok, false);
  });

  test('indirizzi IPv4: formato, duplicati, massimo 20', () => {
    for (const ip of ['10.0.0.256', '01.2.3.4', '1.2.3', '198.51.100.4.5', 'a.b.c.d', ' 198.51.100.4', '::1']) {
      assert.equal(check((c) => (c.pc.allowedIps = [ip])).ok, false, ip);
    }
    assert.equal(check((c) => (c.pc.allowedIps = ['0.0.0.0', '255.255.255.255'])).ok, true);
    assert.equal(check((c) => (c.pc.allowedIps = ['198.51.100.4', '198.51.100.4'])).ok, false);
    assert.equal(check((c) => (c.pc.allowedIps = Array.from({ length: 20 }, (_, i) => `203.0.113.${i}`))).ok, true);
    assert.equal(check((c) => (c.pc.allowedIps = Array.from({ length: 21 }, (_, i) => `203.0.113.${i}`))).ok, false);
  });

  test('controlli tra campi', () => {
    const err = (mut) => check(mut).error ?? '';
    assert.match(err((c) => (server(c), (c.pc.access = 'network'))), /almeno un IP/);
    assert.match(err((c) => server(c, 'fom', c.receivers[0].port)), /ricevitore di test/);
    assert.match(err((c) => server(c, 'pc', c.receivers[1].port)), /ricevitore di test/);
    assert.match(err((c) => (server(c, 'pc', 4001), server(c, 'fom', 4001))), /stessa porta/);
    // in modalità client le stesse porte restano lecite (i ricevitori di test sono i destinatari)
    assert.equal(check((c) => (c.pc.access = 'network')).ok, true);
  });

  test('updateConfig passa dagli stessi controlli', () => {
    const c = structuredClone(DEFAULT_CONFIG);
    c.pc.proto = 'tcp-server';
    c.pc.access = 'network';
    assert.equal(v('updateConfig', c).ok, false);
  });
});
