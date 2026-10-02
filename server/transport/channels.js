// Canali di trasmissione PC e FOM. Il motore chiama solo send(key, payload) e riceve un esito
// { ok, reason, attempts, clients }, senza sapere se il canale è client TCP, UDP o server TCP.
import { transmit } from './net.js';
import { ServerChannel } from './serverChannel.js';

const KEYS = ['pc', 'fom'];
// Campi che richiedono di ricreare il canale; gli altri (ackNak, timeoutMs, retries, host) si leggono a ogni invio.
const RESTART_FIELDS = ['enabled', 'proto', 'port', 'access', 'allowedIps'];

// TCP client e UDP: invariati rispetto alla 0001 (una connessione o un datagramma per stringa).
class ClientChannel {
  constructor(getConfig) {
    this.getConfig = getConfig;
  }
  async send(payload, { ackNak }) {
    return { ...(await transmit(this.getConfig(), payload, ackNak)), clients: null };
  }
  status() {
    return { mode: this.getConfig().proto };
  }
  close() {
    return Promise.resolve();
  }
}

export class ChannelManager {
  constructor(config, { logger, onChange = () => {} } = {}) {
    this.config = config;
    this.log = logger;
    this.onChange = onChange;
    this.channels = {};
    for (const k of KEYS) this.channels[k] = this.build(k);
  }

  build(key) {
    const cfg = this.config[key];
    if (!(cfg.enabled && cfg.proto === 'tcp-server')) return new ClientChannel(() => this.config[key]);
    const ch = new ServerChannel({
      name: key.toUpperCase(),
      port: cfg.port,
      access: cfg.access,
      allowedIps: cfg.allowedIps,
      logger: this.log,
    });
    ch.on('status', this.onChange);
    ch.on('clients', this.onChange);
    return ch.start();
  }

  send(key, payload, { ackNak } = {}) {
    const cfg = this.config[key];
    return this.channels[key].send(payload, {
      ackNak: ackNak ?? cfg.ackNak,
      timeoutMs: cfg.timeoutMs,
      retries: cfg.retries,
    });
  }

  // Applica un nuovo setup: ricrea solo i canali i cui campi di ascolto sono cambiati.
  // Le riconfigurazioni sono in coda, così due salvataggi ravvicinati non si sovrappongono.
  reconfigure(config) {
    const run = (this.pending ?? Promise.resolve()).then(() => this.applyConfig(config));
    this.pending = run.catch(() => {});
    return run;
  }

  async applyConfig(config) {
    const old = this.config;
    this.config = config;
    await Promise.all(
      KEYS.map(async (k) => {
        const changed = RESTART_FIELDS.some((f) => JSON.stringify(old[k][f]) !== JSON.stringify(config[k][f]));
        if (!changed) return;
        await this.channels[k].close();
        this.channels[k] = this.build(k);
      })
    );
    this.onChange();
  }

  status() {
    return Object.fromEntries(KEYS.map((k) => [k, this.channels[k].status()]));
  }

  close() {
    return Promise.all(KEYS.map((k) => this.channels[k].close()));
  }
}
