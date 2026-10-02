import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import WebSocket from 'ws';
import { createApp } from '../server/app.js';
import { createLogger } from '../server/observability/logger.js';
import { DEFAULT_CONFIG } from '../server/domain/engine.js';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Server e client aperti dai test: cleanup() li chiude anche se un test fallisce a metà,
// altrimenti il processo dei test resterebbe aperto (e la CI bloccata).
const openApps = new Set();
const openClients = new Set();

export async function cleanup() {
  for (const c of openClients) c.ws.terminate();
  openClients.clear();
  await Promise.all([...openApps].map((a) => a.close()));
  openApps.clear();
}

export function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'simulatore-test-'));
}

export async function freePort() {
  const srv = net.createServer();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address();
  await new Promise((r) => srv.close(r));
  return port;
}

// Config con ricevitori e canali su porte libere, così i test non collidono tra loro né con un simulatore avviato.
export async function testConfig(overrides = {}) {
  const pcPort = await freePort();
  const fomPort = await freePort();
  const c = structuredClone(DEFAULT_CONFIG);
  c.pc.port = pcPort;
  c.fom.port = fomPort;
  c.receivers[0].port = pcPort;
  c.receivers[1].port = fomPort;
  return deepAssign(c, overrides);
}

function deepAssign(target, src) {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') deepAssign(target[k], v);
    else target[k] = v;
  }
  return target;
}

export async function startApp({ config, dataDir = tempDir(), ...opts } = {}) {
  if (config !== null) fs.writeFileSync(path.join(dataDir, 'config.json'), JSON.stringify(config ?? (await testConfig())));
  const logger = createLogger({ dir: path.join(dataDir, 'logs'), toConsole: false });
  const app = await createApp({ port: 0, dataDir, logger, ...opts });
  openApps.add(app);
  const url = `http://127.0.0.1:${app.address.port}`;
  return { app, dataDir, url, wsUrl: url.replace('http', 'ws') + '/ws' };
}

export function readLog(dataDir) {
  const dir = path.join(dataDir, 'logs');
  return fs
    .readdirSync(dir)
    .flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n'))
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

// Client WebSocket di prova: raccoglie i messaggi e permette di attenderne uno.
export function connect(wsUrl, options = {}) {
  const ws = new WebSocket(wsUrl, options);
  const client = { ws };
  openClients.add(client);
  const messages = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    messages.push(m);
    for (const w of [...waiters]) if (w.pred(m)) w.resolve(m);
  });
  const closed = new Promise((resolve) => ws.on('close', (code) => resolve(code)));
  const opened = new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('unexpected-response', (req, res) => reject(Object.assign(new Error('rifiutata'), { status: res.statusCode })));
    ws.on('error', reject);
  });
  const waitFor = (pred, ms = 3000) =>
    new Promise((resolve, reject) => {
      const found = messages.find(pred);
      if (found) return resolve(found);
      const w = {
        pred,
        resolve: (m) => {
          clearTimeout(t);
          waiters.splice(waiters.indexOf(w), 1);
          resolve(m);
        },
      };
      const t = setTimeout(() => {
        waiters.splice(waiters.indexOf(w), 1);
        reject(new Error('messaggio atteso non arrivato'));
      }, ms);
      waiters.push(w);
    });
  const cmd = (name, args) => ws.send(JSON.stringify({ type: 'cmd', cmd: name, args }));
  return { ws, messages, waitFor, cmd, opened, closed };
}

export async function waitUntil(fn, ms = 5000, step = 50) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(step);
  }
  return false;
}
