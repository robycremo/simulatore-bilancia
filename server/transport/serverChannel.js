// Canale in modalità TCP server: il simulatore ascolta su una porta e invia le stringhe ai client collegati
// (per esempio PuTTY in modalità Raw). Stesso esito della modalità client: { ok, reason, attempts, clients }.
import net from 'node:net';
import { EventEmitter } from 'node:events';
import { ACK, NAK } from './net.js';

export const MAX_CLIENTS = 5;
export const MAX_PENDING_BYTES = 64 * 1024;
export const KEEPALIVE_DELAY_MS = 10_000;
export const RETRY_MS = 5000;

const noop = () => {};
const nullLogger = { info: noop, warn: noop, error: noop };

export function normalizeAddress(addr) {
  return typeof addr === 'string' && addr.startsWith('::ffff:') ? addr.slice(7) : addr;
}

// 'local': solo loopback. 'network': solo gli indirizzi dell'elenco (TR-7).
export function isAllowed(addr, access, allowedIps) {
  const a = normalizeAddress(addr);
  if (access === 'network') return allowedIps.includes(a);
  return a === '::1' || /^127\./.test(a ?? '');
}

// Un client che non legge accumula dati in attesa di invio: oltre la soglia viene disconnesso (TR-10).
export function dropIfSlow(socket, maxPending = MAX_PENDING_BYTES) {
  if (socket.writableLength > maxPending) {
    socket.destroy();
    return true;
  }
  return false;
}

export class ServerChannel extends EventEmitter {
  constructor({ name, port, access = 'local', allowedIps = [], logger = nullLogger, maxClients = MAX_CLIENTS, maxPending = MAX_PENDING_BYTES, retryMs = RETRY_MS }) {
    super();
    Object.assign(this, { name, port, access, allowedIps, log: logger, maxClients, maxPending, retryMs });
    this.clients = new Set();
    this.server = null;
    this.listening = false;
    this.closed = false;
    this.statusText = 'AVVIO';
    this.pendingAck = null;
    this.queue = Promise.resolve();
  }

  get host() {
    return this.access === 'network' ? '0.0.0.0' : '127.0.0.1';
  }

  // ---------- ascolto ----------
  start() {
    if (this.closed) return this;
    const server = net.createServer((sock) => this.onConnection(sock));
    this.server = server;
    server.once('error', (e) => this.onListenError(server, e));
    server.listen(this.port, this.host, () => {
      this.listening = true;
      this.port = server.address().port;
      this.setStatus(`IN ASCOLTO TCP ${this.port}`);
      this.log.info('server_listen', { channel: this.name, port: this.port, access: this.access });
    });
    return this;
  }

  onListenError(server, e) {
    this.listening = false;
    server.close();
    if (this.server === server) this.server = null;
    if (this.closed) return;
    const code = e.code || e.message;
    this.log.warn('server_listen_error', { channel: this.name, port: this.port, error: code });
    this.setStatus(`ERRORE: ${code} — nuovo tentativo tra ${this.retryMs / 1000} s`);
    this.retryTimer = setTimeout(() => this.start(), this.retryMs);
  }

  setStatus(text) {
    this.statusText = text;
    this.emit('status', text);
  }

  // ---------- connessioni ----------
  onConnection(sock) {
    const ip = normalizeAddress(sock.remoteAddress);
    const refuse = (reason) => {
      this.log.warn('server_client_refused', { channel: this.name, port: this.port, ip, reason });
      sock.destroy();
    };
    if (!isAllowed(ip, this.access, this.allowedIps)) return refuse('ip');
    if (this.clients.size >= this.maxClients) return refuse('max_clients');

    this.clients.add(sock);
    sock.setNoDelay(true);
    sock.setKeepAlive(true, KEEPALIVE_DELAY_MS);
    this.log.info('server_client_connect', { channel: this.name, port: this.port, ip, clients: this.clients.size });
    this.emit('clients', this.clients.size);

    // I dati del client non vengono accumulati: servono solo i byte ACK/NAK durante un'attesa (TR-9).
    sock.on('data', (buf) => this.onData(sock, buf));
    sock.on('error', noop);
    sock.on('close', () => {
      if (!this.clients.delete(sock)) return;
      this.log.info('server_client_disconnect', { channel: this.name, port: this.port, ip, clients: this.clients.size });
      this.emit('clients', this.clients.size);
      this.pendingAck?.check();
    });
  }

  onData(sock, buf) {
    const p = this.pendingAck;
    if (!p || !p.targets.has(sock)) return;
    if (buf.includes(ACK)) return p.resolve('ack');
    if (buf.includes(NAK)) {
      p.naks.add(sock);
      p.check();
    }
  }

  // ---------- invio ----------
  writeTo(sock, buf) {
    return new Promise((resolve) => {
      if (sock.destroyed) return resolve(false);
      sock.write(buf, (err) => resolve(!err));
      if (dropIfSlow(sock, this.maxPending)) {
        this.log.warn('server_client_disconnect', { channel: this.name, port: this.port, ip: normalizeAddress(sock.remoteAddress), reason: 'client_lento' });
        resolve(false);
      }
    });
  }

  // Gli invii sullo stesso canale sono in coda: un'attesa ACK non si sovrappone a un altro invio.
  send(payload, opts = {}) {
    const run = this.queue.then(() => this.doSend(payload, opts));
    this.queue = run.catch(noop);
    return run;
  }

  async doSend(payload, { ackNak = false, timeoutMs = 1000, retries = 3 } = {}) {
    const buf = Buffer.from(payload, 'latin1');
    if (!ackNak) {
      const targets = [...this.clients];
      if (!targets.length) return { ok: false, reason: 'NESSUN CLIENT', attempts: 1, clients: 0 };
      const results = await Promise.all(targets.map((s) => withTimeout(this.writeTo(s, buf), timeoutMs, false)));
      const reached = results.filter(Boolean).length;
      return reached ? { ok: true, reason: 'INVIATO', attempts: 1, clients: reached } : { ok: false, reason: 'SCRITTURA FALLITA', attempts: 1, clients: 0 };
    }

    const tries = Math.max(1, retries);
    let reason = 'NESSUN CLIENT';
    for (let attempt = 1; attempt <= tries; attempt++) {
      const targets = new Set(this.clients);
      if (!targets.size) return { ok: false, reason: 'NESSUN CLIENT', attempts: attempt, clients: 0 };
      const outcome = await this.waitAck(targets, buf, timeoutMs);
      if (outcome === 'ack') return { ok: true, reason: 'ACK', attempts: attempt, clients: targets.size };
      reason = outcome === 'nak' ? 'NAK' : 'TIMEOUT ACK';
    }
    return { ok: false, reason, attempts: tries, clients: 0 };
  }

  // Primo ACK da qualsiasi client → 'ack'; NAK da tutti i client ancora collegati → 'nak'; altrimenti allo scadere
  // del time-out 'nak' se almeno un NAK, 'timeout' se nessuna risposta.
  waitAck(targets, buf, timeoutMs) {
    return new Promise((resolve) => {
      const p = {
        targets,
        naks: new Set(),
        done: false,
        resolve: (r) => {
          if (p.done) return;
          p.done = true;
          clearTimeout(timer);
          this.pendingAck = null;
          resolve(r);
        },
        check: () => {
          const alive = [...targets].filter((s) => this.clients.has(s));
          if (!alive.length) p.resolve(p.naks.size ? 'nak' : 'timeout');
          else if (alive.every((s) => p.naks.has(s))) p.resolve('nak');
        },
      };
      const timer = setTimeout(() => p.resolve(p.naks.size ? 'nak' : 'timeout'), timeoutMs);
      this.pendingAck = p;
      for (const s of targets) this.writeTo(s, buf);
    });
  }

  // ---------- stato e arresto ----------
  status() {
    return {
      mode: 'tcp-server',
      port: this.port,
      access: this.access,
      listening: this.listening,
      status: this.statusText,
      clients: this.clients.size,
    };
  }

  close() {
    this.closed = true;
    clearTimeout(this.retryTimer);
    this.pendingAck?.resolve('timeout');
    for (const s of this.clients) s.destroy();
    this.clients.clear();
    const server = this.server;
    this.server = null;
    this.listening = false;
    this.setStatus('FERMO');
    return new Promise((resolve) => (server ? server.close(() => resolve()) : resolve()));
  }
}

function withTimeout(promise, ms, fallback) {
  let t;
  return Promise.race([promise, new Promise((r) => (t = setTimeout(() => r(fallback), ms)))]).finally(() => clearTimeout(t));
}
