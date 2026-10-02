// Test end-to-end su istanze reali (porte e cartelle temporanee): criteri di accettazione delle change 0001 e 0002.
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.js';
import { ConfigError } from '../server/config/env.js';
import { startApp, testConfig, tempDir, connect, readLog, waitUntil, sleep, freePort, cleanup } from './helpers.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'client', 'dist');

afterEach(cleanup);

function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list ?? []) if (i.family === 'IPv4' && !i.internal) return i.address;
  }
  return null;
}

function runIndex(env, { untilExit = true, timeoutMs = 10_000 } = {}) {
  const child = spawn(process.execPath, ['server/index.js'], { cwd: ROOT, env: { ...process.env, ...env } });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  const exited = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
  if (!untilExit) return { child, exited, output: () => out };
  const timer = setTimeout(() => child.kill(), timeoutMs);
  return exited.then((code) => {
    clearTimeout(timer);
    return { code, out };
  });
}

describe('configurazione e accesso', () => {
  test('di default ascolta solo su 127.0.0.1', async () => {
    const { app } = await startApp();
    assert.equal(app.address.address, '127.0.0.1');
    await app.close();
  });

  test('HOST non locale senza token: errore di configurazione', async () => {
    await assert.rejects(createApp({ host: '0.0.0.0', port: 0, dataDir: tempDir() }), ConfigError);
  });

  test('lanciatore: HOST=0.0.0.0 senza SIM_TOKEN esce con codice 1 e messaggio', async () => {
    const r = await runIndex({ HOST: '0.0.0.0', SIM_TOKEN: '', PORT: '0' });
    assert.equal(r.code, 1);
    assert.match(r.out, /SIM_TOKEN/);
  });

  const lan = lanAddress();
  test('client remoto: token richiesto, sbagliato → 4401 e log, giusto → stato', { skip: !lan && 'nessuna interfaccia di rete' }, async () => {
    const { app, dataDir } = await startApp({ host: '0.0.0.0', token: 'segreto' });
    const url = `ws://${lan}:${app.address.port}/ws`;

    const bad = connect(url);
    await bad.opened;
    await bad.waitFor((m) => m.type === 'authRequired');
    assert.equal(bad.messages.some((m) => m.type === 'state' || m.type === 'config'), false);
    bad.ws.send(JSON.stringify({ type: 'auth', token: 'sbagliato' }));
    assert.equal(await bad.closed, 4401);
    assert.ok(readLog(dataDir).some((l) => l.event === 'auth_denied'));

    const good = connect(url);
    await good.opened;
    await good.waitFor((m) => m.type === 'authRequired');
    good.ws.send(JSON.stringify({ type: 'auth', token: 'segreto' }));
    await good.waitFor((m) => m.type === 'authOk');
    await good.waitFor((m) => m.type === 'config');
    await good.waitFor((m) => m.type === 'state');
    good.ws.close();
    await app.close();
  });
});

describe('API e validazione', () => {
  test('comandi non validi: errore al client, stato invariato', async () => {
    const { app, wsUrl } = await startApp();
    const c = connect(wsUrl);
    await c.opened;
    const cfgBefore = JSON.stringify(app.engine.config);

    c.cmd('setLoad', 'abc');
    await c.waitFor((m) => m.type === 'error' && /setLoad/.test(m.message));
    assert.equal(app.engine.load, 0);

    c.cmd('formatDisk');
    await c.waitFor((m) => m.type === 'error' && /sconosciuto/.test(m.message));

    const bad = structuredClone(app.engine.config);
    bad.pc.port = 70000;
    c.cmd('updateConfig', bad);
    await c.waitFor((m) => m.type === 'error' && /updateConfig/.test(m.message));
    assert.equal(JSON.stringify(app.engine.config), cfgBefore);

    c.ws.send('{non json');
    await c.waitFor((m) => m.type === 'error' && /JSON/.test(m.message));

    c.ws.send(JSON.stringify({ type: 'cmd', cmd: 'setData', args: { desc: 'x'.repeat(20 * 1024) } }));
    await c.waitFor((m) => m.type === 'error' && /troppo grande/.test(m.message));
    assert.equal(c.ws.readyState, 1, 'la connessione resta aperta');

    c.ws.close();
    await app.close();
  });

  test('GET /api/health', async () => {
    const { app, url } = await startApp();
    const res = await fetch(`${url}/api/health`);
    assert.equal(res.status, 200);
    const h = await res.json();
    for (const k of ['status', 'version', 'uptime', 'phase', 'mode', 'receivers']) assert.ok(k in h, k);
    assert.equal(h.status, 'ok');
    assert.equal(h.receivers.length, 2);
    await app.close();
  });

  test('POST /api/client-error finisce nel log', async () => {
    const { app, url, dataDir } = await startApp();
    const res = await fetch(`${url}/api/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'boom', stack: 'at X' }),
    });
    assert.equal(res.status, 204);
    assert.ok(readLog(dataDir).some((l) => l.event === 'client_error' && l.message === 'boom'));
    await app.close();
  });
});

describe('storage e recovery', () => {
  test('state.json corrotto: rinominato, avvio regolare, avviso nel log', async () => {
    const dataDir = tempDir();
    fs.writeFileSync(path.join(dataDir, 'state.json'), 'questo non è json');
    const { app } = await startApp({ dataDir });
    assert.ok(fs.readdirSync(dataDir).some((n) => n.startsWith('state.json.corrupt-')));
    assert.ok(readLog(dataDir).some((l) => l.event === 'storage_recovered' && l.recovered === 'default'));
    assert.equal(app.engine.progressive, 1);
    await app.close();
  });

  test('arresto e riavvio: progressivo conservato, .bak presente', async () => {
    const { app, dataDir, wsUrl } = await startApp();
    const c = connect(wsUrl);
    await c.opened;
    c.cmd('setProgressive', 6);
    await waitUntil(() => app.engine.progressive === 6);
    await sleep(500); // salvataggio differito
    c.cmd('setProgressive', 7);
    await waitUntil(() => app.engine.progressive === 7);
    c.ws.close();
    const t0 = Date.now();
    await app.close();
    assert.ok(Date.now() - t0 < 3000);
    assert.ok(fs.existsSync(path.join(dataDir, 'state.json.bak')));

    const again = await startApp({ dataDir, config: null });
    assert.equal(again.app.engine.progressive, 7);
    assert.ok(readLog(dataDir).some((l) => l.event === 'shutdown'));
    await again.app.close();
  });

  test('ricevitore su porta occupata: errore, poi riparte entro 5 s', async () => {
    const blocker = net.createServer();
    const config = await testConfig();
    await new Promise((r) => blocker.listen(config.receivers[0].port, r));
    const { app, url, dataDir } = await startApp({ config });
    const health = async () => (await (await fetch(`${url}/api/health`)).json()).receivers[0];

    assert.equal((await health()).running, false);
    assert.match((await health()).status, /ERRORE/);
    await new Promise((r) => blocker.close(r));
    assert.ok(await waitUntil(async () => (await health()).running, 6500, 200), 'ricevitore ripartito');
    const events = readLog(dataDir).map((l) => l.event);
    assert.ok(events.includes('receiver_error') && events.includes('receiver_retry'));
    await app.close();
  });
});

describe('sicurezza, limiti, cache', () => {
  test('WebSocket da Origin di un altro sito: rifiutato', async () => {
    const { app, wsUrl } = await startApp();
    const c = connect(wsUrl, { origin: 'http://sito-esterno.example' });
    await assert.rejects(c.opened, (e) => e.status === 403);
    const same = connect(wsUrl, { origin: `http://127.0.0.1:${app.address.port}` });
    await same.opened;
    same.ws.close();
    await app.close();
  });

  test('intestazioni di sicurezza e cache', { skip: !fs.existsSync(path.join(DIST, 'index.html')) && 'eseguire prima npm run build' }, async () => {
    const { app, url } = await startApp();
    const res = await fetch(`${url}/`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    assert.match(res.headers.get('content-security-policy'), /default-src 'self'.*frame-ancestors 'none'/);
    assert.equal(res.headers.get('x-powered-by'), null);

    const asset = fs.readdirSync(path.join(DIST, 'assets'))[0];
    const a = await fetch(`${url}/assets/${asset}`);
    assert.equal(a.status, 200);
    assert.equal(a.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    await app.close();
  });

  test('raffica di comandi: avviso, poi chiusura se continua', async () => {
    const { app, wsUrl, dataDir } = await startApp({ wsOptions: { limiterOptions: { closeAfterSeconds: 2 } } });
    const c = connect(wsUrl);
    await c.opened;
    for (let i = 0; i < 200; i++) c.cmd('setNoise', false);
    await c.waitFor((m) => m.type === 'error' && /Troppi comandi/.test(m.message));
    const flood = setInterval(() => c.ws.readyState === 1 && c.cmd('setNoise', false), 2);
    const code = await c.closed;
    clearInterval(flood);
    assert.equal(code, 1008);
    assert.ok(readLog(dataDir).some((l) => l.event === 'rate_limit_close'));
    await app.close();
  });

  test('undicesima connessione rifiutata', async () => {
    const { app, wsUrl } = await startApp();
    const clients = [];
    for (let i = 0; i < 10; i++) {
      const c = connect(wsUrl);
      await c.opened;
      clients.push(c);
    }
    const extra = connect(wsUrl);
    await assert.rejects(extra.opened, (e) => e.status === 503);
    clients.forEach((c) => c.ws.close());
    await app.close();
  });

  test('seconda istanza sulla stessa porta: EADDRINUSE; lanciatore esce con 1 e messaggio chiaro', async () => {
    const { app } = await startApp();
    const port = app.address.port;
    await assert.rejects(startApp({ port }), (e) => e.code === 'EADDRINUSE');
    const r = await runIndex({ PORT: String(port), HOST: '127.0.0.1' });
    assert.equal(r.code, 1);
    assert.match(r.out, /già in uso/);
    assert.doesNotMatch(r.out, /\n\s+at /, 'nessuno stack trace');
    await app.close();
  });
});

describe('pesatura e log (nessuna regressione 0001)', () => {
  test('soglia → stringa 104 car. a PC; FOM in NAK → ritrasmissione, OUT1, non totalizzato, log', async () => {
    const config = await testConfig({
      totalizeOnlyIfFomOk: true,
      fom: { ackNak: true, retries: 2, timeoutMs: 300 },
    });
    config.receivers[1].reply = 'nak';
    const { app, wsUrl, dataDir } = await startApp({ config });
    const c = connect(wsUrl);
    await c.opened;

    // L'impulso e la fine della pesata avvengono nello stesso istante: si verifica che l'impulso sia stato emesso
    // (scadenza di OUT1 successiva all'avvio della pesata) invece di tentare di osservarlo acceso.
    const t0 = Date.now();
    c.cmd('setLoad', 237.5);
    assert.ok(await waitUntil(() => app.engine.progressive === 2, 6000), 'pesata eseguita');

    const tx = app.engine.txLog;
    const pc = tx.find((l) => l.ch === 'PC');
    const fom = tx.find((l) => l.ch === 'FOM');
    assert.equal(pc.ok, true);
    assert.equal(pc.payload.replace('<CR>', '\r').length, 104);
    assert.equal(fom.ok, false);
    assert.equal(fom.reason, 'NAK');
    assert.equal(fom.attempts, 2);
    assert.ok(app.engine.outUntil.fom >= t0 + 500, 'impulso OUT1 di 0,5 s emesso');
    assert.equal(app.engine.totals.count, 0, 'non totalizzato');
    assert.ok(app.engine.rxLog.some((r) => r.rx === 'PC' && r.len === 104));

    const log = readLog(dataDir);
    assert.ok(log.some((l) => l.event === 'weighing' && l.prog === 1 && l.fom === false && l.totalized === false));
    assert.ok(log.some((l) => l.event === 'tx_error' && l.ch === 'FOM' && l.reason === 'NAK'));
    c.ws.close();
    await app.close();
  });

  test('MPP: archivio e stringa a PC; fine partita: progressivo a 1 e stringa speciale', async () => {
    const { app, wsUrl } = await startApp();
    const c = connect(wsUrl);
    await c.opened;
    c.cmd('toggleMode');
    c.cmd('setData', { mpp: 42 });
    await waitUntil(() => app.engine.opMode === 'MPP');
    c.cmd('setLoad', 77.7);
    assert.ok(await waitUntil(() => app.engine.mppArchive.length === 1 && app.engine.phase === 'PRONTO', 6000));
    assert.equal(app.engine.mppArchive[0].mpp, 42);
    assert.equal(app.engine.mppArchive[0].net, 77.7);
    assert.ok(await waitUntil(() => app.engine.txLog.some((l) => l.kind === 'MPP' && l.ok)));

    c.cmd('setLoad', 0);
    await waitUntil(() => app.engine.gross === 0 && app.engine.armedThreshold, 4000);
    c.cmd('endBatch');
    assert.ok(await waitUntil(() => app.engine.txLog.some((l) => l.kind === 'FINE PARTITA')));
    assert.equal(app.engine.progressive, 1);
    assert.equal(app.engine.headerNeeded, true);
    c.ws.close();
    await app.close();
  });
});

describe('arresto con segnale reale', { skip: process.platform === 'win32' && 'su Windows: prova manuale con Ctrl+C' }, () => {
  test('SIGINT: uscita con codice 0 entro 3 s', async () => {
    const port = await freePort();
    const p = runIndex({ PORT: String(port), HOST: '127.0.0.1' }, { untilExit: false });
    try {
      assert.ok(await waitUntil(() => p.output().includes('Simulatore bilancia:'), 8000), p.output());
      const t0 = Date.now();
      p.child.kill('SIGINT');
      const code = await p.exited;
      assert.equal(code, 0);
      assert.ok(Date.now() - t0 < 3000);
    } finally {
      if (p.child.exitCode === null) p.child.kill('SIGKILL');
    }
  });
});

