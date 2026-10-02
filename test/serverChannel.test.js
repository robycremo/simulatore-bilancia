// Canale in modalità TCP server (change 0003, T4–T7): client node:net reali su loopback.
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import { ServerChannel, isAllowed, dropIfSlow, normalizeAddress, MAX_PENDING_BYTES } from '../server/transport/serverChannel.js';
import { buildWeighString } from '../server/domain/format.js';
import { DEFAULT_CONFIG } from '../server/domain/engine.js';
import { freePort, waitUntil, sleep } from './helpers.js';

const ACK = '\x06';
const NAK = '\x15';
const PAYLOAD = buildWeighString(
  { date: '15/06/2026', time: '10:30:00', prog: 42, code: 0, desc: '', cgen: '', result: 0, gross: 237.5, tare: 0, net: 237.5 },
  DEFAULT_CONFIG
);

function memLogger() {
  const lines = [];
  const add = (level) => (event, fields = {}) => lines.push({ level, event, ...fields });
  return { lines, info: add('info'), warn: add('warn'), error: add('error'), events: () => lines.map((l) => l.event) };
}

const open = [];
async function channel(opts = {}) {
  const ch = new ServerChannel({ name: 'PC', port: 0, logger: memLogger(), ...opts }).start();
  open.push(ch);
  assert.ok(await waitUntil(() => ch.listening || ch.statusText.startsWith('ERRORE'), 3000), 'canale avviato');
  return ch;
}

// Client che accumula i dati ricevuti; `reply` risponde automaticamente a ogni stringa (CR).
function client(port, { host = '127.0.0.1', reply = null } = {}) {
  const sock = net.connect({ port, host });
  open.push({ close: () => sock.destroy() });
  const c = { sock, data: '', closed: false, ts: [] };
  sock.setEncoding('latin1');
  sock.on('data', (d) => {
    c.data += d;
    c.ts.push(Date.now());
    if (reply && d.includes('\r')) sock.write(reply);
  });
  sock.on('close', () => (c.closed = true));
  sock.on('error', () => {});
  c.connected = new Promise((r) => sock.on('connect', r));
  return c;
}

async function connected(ch, n) {
  assert.ok(await waitUntil(() => ch.clients.size === n, 2000), `${n} client collegati (attuali ${ch.clients.size})`);
}

afterEach(async () => {
  await Promise.all(open.splice(0).map((x) => x.close()));
});

describe('funzioni di supporto', () => {
  test('normalizzazione e controllo degli indirizzi', () => {
    assert.equal(normalizeAddress('::ffff:10.0.0.5'), '10.0.0.5');
    assert.equal(isAllowed('127.0.0.1', 'local', []), true);
    assert.equal(isAllowed('::ffff:127.0.0.1', 'local', []), true);
    assert.equal(isAllowed('::1', 'local', []), true);
    assert.equal(isAllowed('10.0.0.5', 'local', ['10.0.0.5']), false);
    assert.equal(isAllowed('::ffff:10.0.0.5', 'network', ['10.0.0.5']), true);
    assert.equal(isAllowed('10.0.0.6', 'network', ['10.0.0.5']), false);
    assert.equal(isAllowed('127.0.0.1', 'network', ['10.0.0.5']), false, 'in rete vale solo l\'elenco (TR-7)');
  });

  test('client lento: disconnesso oltre 64 KB in attesa (socket finto)', () => {
    let destroyed = false;
    const fake = (len) => ({ writableLength: len, destroy: () => (destroyed = true) });
    assert.equal(dropIfSlow(fake(MAX_PENDING_BYTES)), false);
    assert.equal(destroyed, false);
    assert.equal(dropIfSlow(fake(MAX_PENDING_BYTES + 1)), true);
    assert.equal(destroyed, true);
  });
});

describe('ascolto e accettazione (T4)', () => {
  test('accesso locale: ascolta solo su 127.0.0.1', async () => {
    const ch = await channel();
    assert.equal(ch.server.address().address, '127.0.0.1');
    assert.equal(ch.status().listening, true);
    assert.match(ch.status().status, /IN ASCOLTO TCP \d+/);
    assert.ok(ch.log.events().includes('server_listen'));
  });

  test('sesto client disconnesso subito; i primi cinque restano', async () => {
    const ch = await channel();
    const cs = [];
    for (let i = 0; i < 5; i++) {
      cs.push(client(ch.port));
      await connected(ch, i + 1);
    }
    const sixth = client(ch.port);
    assert.ok(await waitUntil(() => sixth.closed, 2000), 'sesto chiuso');
    assert.equal(ch.clients.size, 5);
    assert.ok(ch.log.lines.some((l) => l.event === 'server_client_refused' && l.reason === 'max_clients'));
  });

  test('testo inviato dal client ignorato', async () => {
    const ch = await channel();
    const c = client(ch.port);
    await connected(ch, 1);
    c.sock.write('ciao dal terminale\r\n'.repeat(1000));
    await sleep(100);
    assert.equal(ch.clients.size, 1);
    const r = await ch.send(PAYLOAD);
    assert.equal(r.ok, true);
  });

  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i?.family === 'IPv4' && !i.internal)?.address;

  test('accesso locale: connessione dall\'IP di rete rifiutata', { skip: !lan && 'nessuna interfaccia di rete' }, async () => {
    const ch = await channel();
    // In accesso locale la porta non è nemmeno raggiungibile dall'IP di rete. Su Windows il rifiuto arriva dopo
    // i ritentativi del sistema (circa 2 s), da qui l'attesa più lunga.
    const c = client(ch.port, { host: lan });
    assert.ok(await waitUntil(() => c.closed, 6000));
    assert.equal(ch.clients.size, 0);
  });

  test('accesso rete: IP ammesso accettato, IP non in elenco rifiutato e registrato', { skip: !lan && 'nessuna interfaccia di rete' }, async () => {
    const allowed = await channel({ access: 'network', allowedIps: [lan] });
    assert.equal(allowed.server.address().address, '0.0.0.0');
    client(allowed.port, { host: lan });
    await connected(allowed, 1);

    const denied = await channel({ access: 'network', allowedIps: ['10.255.255.254'] });
    const c = client(denied.port, { host: lan });
    assert.ok(await waitUntil(() => c.closed, 2000));
    assert.equal(denied.clients.size, 0);
    assert.ok(denied.log.lines.some((l) => l.event === 'server_client_refused' && l.reason === 'ip' && l.ip === lan));
  });
});

describe('invio ed esito (T5)', () => {
  test('nessun client → NESSUN CLIENT, senza attese', async () => {
    const ch = await channel();
    const t0 = Date.now();
    assert.deepEqual(await ch.send(PAYLOAD, { timeoutMs: 1000 }), { ok: false, reason: 'NESSUN CLIENT', attempts: 1, clients: 0 });
    assert.ok(Date.now() - t0 < 100);
    const r = await ch.send(PAYLOAD, { ackNak: true, timeoutMs: 1000 });
    assert.equal(r.reason, 'NESSUN CLIENT');
  });

  test('due client ricevono la stessa stringa, identica byte per byte', async () => {
    const ch = await channel();
    const a = client(ch.port);
    const b = client(ch.port);
    await connected(ch, 2);
    const r = await ch.send(PAYLOAD);
    assert.deepEqual(r, { ok: true, reason: 'INVIATO', attempts: 1, clients: 2 });
    assert.ok(await waitUntil(() => a.data.length === 104 && b.data.length === 104, 2000));
    assert.equal(a.data, PAYLOAD);
    assert.equal(b.data, PAYLOAD);
  });

  test('client collegato dopo un invio riceve solo le stringhe successive', async () => {
    const ch = await channel();
    client(ch.port);
    await connected(ch, 1);
    await ch.send('$PRIMA\r');
    const late = client(ch.port);
    await connected(ch, 2);
    await ch.send('$DOPO\r');
    assert.ok(await waitUntil(() => late.data.length > 0, 2000));
    await sleep(50);
    assert.equal(late.data, '$DOPO\r');
  });

  test('latenza: stringa al client entro 100 ms', async () => {
    const ch = await channel();
    const c = client(ch.port);
    await connected(ch, 1);
    const t0 = Date.now();
    await ch.send(PAYLOAD);
    assert.ok(await waitUntil(() => c.ts.length > 0, 1000, 5));
    assert.ok(c.ts[0] - t0 < 100, `latenza ${c.ts[0] - t0} ms`);
  });

  test('ACK/NAK: un client risponde ACK → corretto', async () => {
    const ch = await channel();
    client(ch.port, { reply: ACK });
    await connected(ch, 1);
    assert.deepEqual(await ch.send(PAYLOAD, { ackNak: true, timeoutMs: 500, retries: 3 }), { ok: true, reason: 'ACK', attempts: 1, clients: 1 });
  });

  test('ACK/NAK: NAK → nuovi invii fino a retries, poi NAK', async () => {
    const ch = await channel();
    const c = client(ch.port, { reply: NAK });
    await connected(ch, 1);
    const t0 = Date.now();
    const r = await ch.send(PAYLOAD, { ackNak: true, timeoutMs: 2000, retries: 3 });
    assert.deepEqual(r, { ok: false, reason: 'NAK', attempts: 3, clients: 0 });
    assert.ok(Date.now() - t0 < 1500, 'tutti NAK: nessuna attesa del time-out');
    assert.ok(await waitUntil(() => c.data.length === 3 * 104, 1000), 'tre invii');
  });

  test('ACK/NAK: un client NAK e uno ACK → vale il primo ACK', async () => {
    const ch = await channel();
    client(ch.port, { reply: NAK });
    client(ch.port, { reply: ACK });
    await connected(ch, 2);
    const r = await ch.send(PAYLOAD, { ackNak: true, timeoutMs: 1000, retries: 3 });
    assert.equal(r.ok, true);
    assert.equal(r.attempts, 1);
  });

  test('ACK/NAK: nessuna risposta → TIMEOUT ACK dopo i tentativi', async () => {
    const ch = await channel();
    client(ch.port);
    await connected(ch, 1);
    const r = await ch.send(PAYLOAD, { ackNak: true, timeoutMs: 150, retries: 2 });
    assert.deepEqual(r, { ok: false, reason: 'TIMEOUT ACK', attempts: 2, clients: 0 });
  });

  test('client che si chiude: rimosso dal conteggio, poi NESSUN CLIENT', async () => {
    const ch = await channel();
    const c = client(ch.port);
    await connected(ch, 1);
    c.sock.destroy();
    await connected(ch, 0);
    assert.equal((await ch.send(PAYLOAD)).reason, 'NESSUN CLIENT');
    assert.ok(ch.log.events().includes('server_client_disconnect'));
  });
});

describe('errori di ascolto e arresto (T7)', () => {
  test('porta occupata: errore, poi ascolto entro il nuovo tentativo', async () => {
    const port = await freePort();
    const blocker = net.createServer();
    await new Promise((r) => blocker.listen(port, '127.0.0.1', r));
    const ch = await channel({ port, retryMs: 300 });
    assert.equal(ch.listening, false);
    assert.match(ch.statusText, /ERRORE: EADDRINUSE/);
    assert.ok(ch.log.events().includes('server_listen_error'));
    await new Promise((r) => blocker.close(r));
    assert.ok(await waitUntil(() => ch.listening, 3000), 'in ascolto dopo il nuovo tentativo');
  });

  test('close(): client disconnessi e porta liberata', async () => {
    const ch = await channel();
    const c = client(ch.port);
    await connected(ch, 1);
    const port = ch.port;
    await ch.close();
    assert.ok(await waitUntil(() => c.closed, 1000));
    const again = net.createServer();
    await new Promise((resolve, reject) => {
      again.once('error', reject);
      again.listen(port, '127.0.0.1', resolve);
    });
    await new Promise((r) => again.close(r));
  });
});

describe('ChannelManager (T8)', () => {
  async function manager(overrides) {
    const { ChannelManager } = await import('../server/transport/channels.js');
    const config = structuredClone(DEFAULT_CONFIG);
    Object.assign(config.pc, { proto: 'tcp-server', port: await freePort() }, overrides);
    const m = new ChannelManager(config, { logger: memLogger() });
    open.push(m);
    assert.ok(await waitUntil(() => m.channels.pc.listening, 2000));
    return { m, config };
  }

  test('canale client per tcp/udp, server per tcp-server', async () => {
    const { m } = await manager();
    assert.equal(m.status().pc.mode, 'tcp-server');
    assert.equal(m.status().fom.mode, 'tcp');
    assert.equal(m.status().pc.clients, 0);
  });

  test('cambio porta: la vecchia non accetta più, la nuova sì entro 1 s', async () => {
    const { m, config } = await manager();
    const oldPort = m.channels.pc.port;
    const newPort = await freePort();
    const t0 = Date.now();
    await m.reconfigure({ ...config, pc: { ...config.pc, port: newPort } });
    assert.ok(await waitUntil(() => m.channels.pc.listening, 1000));
    assert.ok(Date.now() - t0 < 1000);
    assert.equal(m.channels.pc.port, newPort);
    const stale = client(oldPort);
    assert.ok(await waitUntil(() => stale.closed, 3000), 'vecchia porta chiusa');
    client(newPort);
    await connected(m.channels.pc, 1);
  });

  test('cambio di timeoutMs o ackNak: nessun riavvio, i client restano collegati', async () => {
    const { m, config } = await manager();
    const before = m.channels.pc;
    client(before.port);
    await connected(before, 1);
    await m.reconfigure({ ...config, pc: { ...config.pc, timeoutMs: 250, ackNak: true } });
    assert.equal(m.channels.pc, before);
    assert.equal(before.clients.size, 1);
    const r = await m.send('pc', PAYLOAD);
    assert.equal(r.reason, 'TIMEOUT ACK', 'usa ackNak e timeoutMs nuovi');
  });

  test('canale disabilitato: nessun ascolto', async () => {
    const { m, config } = await manager();
    const port = m.channels.pc.port;
    await m.reconfigure({ ...config, pc: { ...config.pc, enabled: false } });
    assert.equal(m.status().pc.mode, 'tcp-server');
    assert.equal(m.channels.pc.listening, undefined);
    const c = client(port);
    assert.ok(await waitUntil(() => c.closed, 3000));
  });
});
