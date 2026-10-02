// Motore del terminale di pesatura: modello del peso, ciclo di pesata STD / MPP,
// stampante, totali, archivio MPP, trasmissioni a PC e FOM, uscite di errore.
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { ChannelManager } from '../transport/channels.js';
import { TestReceiver } from '../transport/receiver.js';
import { readJson, writeJsonSync } from '../storage/jsonStore.js';
import { nullLogger, errorInfo } from '../observability/logger.js';
import { configSchema } from '../api/validate.js';
import * as F from './format.js';

const TICK_MS = 100;

export const DEFAULT_CONFIG = {
  // 1) innesco automatico: 'soglia' (peso lordo > soglia) oppure 'input' (fotocellula / input di stampa)
  triggerMode: 'soglia',
  // 2) peso soglia (0 = nessun controllo soglia)
  threshold: 10,
  // 3) time-out attesa peso stabile in decimi di secondo (0 = attende sempre il peso stabile)
  stableTimeout: 30,
  // finestra di stabilità: il peso è stabile se non varia per N decimi
  stableWindow: 5,
  // 4) totalizza solo se la trasmissione a FOM è corretta
  totalizeOnlyIfFomOk: false,
  // 5) azzera (porta a 1) il progressivo dopo l'input di fine partita
  resetProgOnEndBatch: true,
  // 6) controlli stato stampante (collegata / carta) prima della stampa
  printerPreCheck: true,
  // 9) input di fine partita abilitato
  endBatchInput: true,
  // la stringa speciale di fine partita usa ACK/NAK
  endBatchAckNak: true,
  // 8) uscite di segnalazione errore trasmissione FOM / PC
  errorOutputs: true,
  // 10) stampante
  printerPresent: true,
  ticketType: 'nastro', // 'nastro' | 'cartellino'
  reducedPrint: true,
  clearTotalsAfterPrint: true,
  // bilancia
  capacity: 1500,
  division: 0.1,
  unit: 'kg',
  decimalSep: ',',
  // stringhe
  prefix: '$',
  checksum: 'none', // 'none' | 'xor' | 'sum'
  mppTemplate: '{data}{ora}{mpp}{prog}{netto}',
  endBatchTemplate: '{data}{ora}FINE PARTITA{npesate}{totnetto}',
  // 7) canali di trasmissione
  // proto: 'tcp' (client), 'udp', 'tcp-server'; access e allowedIps valgono solo per 'tcp-server'
  pc: { enabled: true, host: '127.0.0.1', port: 9100, proto: 'tcp', access: 'local', allowedIps: [], ackNak: false, timeoutMs: 1000, retries: 3 },
  fom: { enabled: true, host: '127.0.0.1', port: 9101, proto: 'tcp', access: 'local', allowedIps: [], ackNak: false, timeoutMs: 1000, retries: 3 },
  // ricevitori di test integrati
  receivers: [
    { name: 'PC', port: 9100, proto: 'tcp', reply: 'ack', autoStart: true },
    { name: 'FOM', port: 9101, proto: 'tcp', reply: 'ack', autoStart: true },
  ],
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Unisce `over` su `base` tenendo solo le chiavi note di `base`.
function mergeKnown(base, over) {
  const out = structuredClone(base);
  if (!isPlainObject(over)) return out;
  for (const k of Object.keys(base)) {
    if (!(k in over)) continue;
    const b = base[k];
    const v = over[k];
    if (isPlainObject(b)) out[k] = mergeKnown(b, v);
    else if (Array.isArray(b) && Array.isArray(v) && v.length === b.length)
      out[k] = b.map((item, i) => (isPlainObject(item) ? mergeKnown(item, v[i]) : v[i]));
    else out[k] = v;
  }
  return out;
}

const cap = (arr, n) => arr.length > n && arr.splice(0, arr.length - n);
const RECEIVER_RETRY_MS = 5000;

export class Engine extends EventEmitter {
  constructor(dataDir, { logger = nullLogger, version = '0.0.0' } = {}) {
    super();
    this.log = logger;
    this.version = version;
    this.startedAt = Date.now();
    fs.mkdirSync(dataDir, { recursive: true });
    this.cfgFile = path.join(dataDir, 'config.json');
    this.stateFile = path.join(dataDir, 'state.json');

    const cfgRead = readJson(this.cfgFile);
    if (cfgRead.warning) this.log.warn('storage_recovered', cfgRead.warning);
    this.config = mergeKnown(DEFAULT_CONFIG, cfgRead.data);
    const valid = configSchema(this.config);
    if (!valid.ok) {
      this.log.warn('config_invalid', { error: valid.error, action: 'uso dei valori di default' });
      this.config = structuredClone(DEFAULT_CONFIG);
    }

    const stRead = readJson(this.stateFile);
    if (stRead.warning) this.log.warn('storage_recovered', stRead.warning);
    const saved = stRead.data || {};
    this.progressive = saved.progressive ?? 1;
    this.totals = saved.totals ?? { count: 0, net: 0 };
    this.mppArchive = saved.mppArchive ?? [];
    this.opMode = saved.opMode ?? 'STD';
    this.printerEnabled = saved.printerEnabled ?? true;
    this.data = saved.data ?? { code: 0, desc: '', cgen: '', result: 0, mpp: 1 };

    this.printer = { connected: true, paper: true };
    this.printerOut = [];
    this.txLog = [];
    this.rxLog = [];
    this.headerNeeded = true; // intestazione dopo ogni accensione

    // modello del peso
    this.load = 0;
    this.noise = false;
    this.settleAmp = 0;
    this.tickN = 0;
    this.zeroOffset = 0;
    this.tare = 0;
    this.gross = 0;
    this.hist = [];
    this.stable = false;

    // ciclo di pesata
    this.phase = 'PRONTO'; // PRONTO | ATTESA | TRASMISSIONE
    this.trigger = null;
    this.waitStart = 0;
    this.armedThreshold = true;
    this.photocell = false;
    this.armedPhotocell = true;
    this.pending = null; // innesco richiesto da tasto / input
    this.message = '';
    this.messageUntil = 0;
    this.outUntil = { fom: 0, pc: 0 };
    this.printerFault = false;

    this.listsDirty = true;
    this.retryTimers = [];
    this.receivers = this.config.receivers.map((rc, i) => {
      const r = new TestReceiver();
      r.on('message', (m) => this.onReceived(i, m));
      r.on('status', () => (this.listsDirty = true));
      r.on('failure', (e) => this.onReceiverFailure(i, e));
      if (rc.autoStart) r.start(rc);
      return r;
    });

    this.channels = new ChannelManager(this.config, { logger: this.log, onChange: () => (this.listsDirty = true) });

    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  // ---------- ricevitori di test: nuovo tentativo automatico ----------
  onReceiverFailure(i, e) {
    const rc = this.config.receivers[i];
    this.log.warn('receiver_error', { receiver: rc.name, port: rc.port, error: e.code || e.message });
    if (!rc.autoStart || this.closed) return;
    clearTimeout(this.retryTimers[i]);
    this.receivers[i].setStatus(`ERRORE: ${e.code || e.message} — nuovo tentativo tra ${RECEIVER_RETRY_MS / 1000} s`);
    this.retryTimers[i] = setTimeout(() => {
      if (this.closed || this.receivers[i].running) return;
      this.log.info('receiver_retry', { receiver: rc.name, port: rc.port });
      this.receivers[i].start(this.config.receivers[i]);
    }, RECEIVER_RETRY_MS);
  }

  // ---------- persistenza ----------
  snapshot() {
    return {
      progressive: this.progressive,
      totals: this.totals,
      mppArchive: this.mppArchive,
      opMode: this.opMode,
      printerEnabled: this.printerEnabled,
      data: this.data,
    };
  }

  saveState() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveStateSync(), 300);
  }

  saveStateSync() {
    clearTimeout(this.saveTimer);
    try {
      writeJsonSync(this.stateFile, this.snapshot());
    } catch (e) {
      this.log.error('storage_write_failed', { file: this.stateFile, ...errorInfo(e) });
    }
  }

  // Arresto: ferma tick, ricevitori e tentativi, salva lo stato, chiude i canali in modalità server.
  close() {
    if (this.closed) return this.closing;
    this.closed = true;
    clearInterval(this.timer);
    this.retryTimers.forEach(clearTimeout);
    this.receivers.forEach((r) => r.stop());
    this.saveStateSync();
    this.closing = this.channels.close();
    return this.closing;
  }

  getHealth() {
    return {
      status: 'ok',
      version: this.version,
      uptime: Math.round((Date.now() - this.startedAt) / 1000),
      phase: this.phase,
      mode: this.opMode,
      receivers: this.receivers.map((r, i) => ({
        name: this.config.receivers[i].name,
        running: r.running,
        status: r.status,
      })),
      channels: this.channels.status(),
    };
  }

  // ---------- messaggi / log ----------
  showMessage(text, ms = 2500) {
    this.message = text;
    this.messageUntil = Date.now() + ms;
  }

  print(lines) {
    this.printerOut.push(...lines);
    cap(this.printerOut, 600);
    this.listsDirty = true;
  }

  logTx(entry) {
    if (!entry.ok) {
      this.log.warn('tx_error', { ch: entry.ch, kind: entry.kind, reason: entry.reason, attempts: entry.attempts, clients: entry.clients });
    }
    this.txLog.push({ t: F.fmtTime(new Date()), ...entry, payload: F.visible(entry.payload) });
    cap(this.txLog, 200);
    this.listsDirty = true;
  }

  onReceived(i, m) {
    this.rxLog.push({
      t: F.fmtTime(new Date()),
      rx: this.config.receivers[i].name,
      from: m.from,
      len: m.data.length,
      data: F.visible(m.data),
    });
    cap(this.rxLog, 200);
    this.listsDirty = true;
  }

  // ---------- modello del peso ----------
  updateWeight() {
    const c = this.config;
    this.tickN++;
    const osc = this.settleAmp * Math.sin(this.tickN * 2.3);
    this.settleAmp *= 0.6;
    if (this.settleAmp < c.division / 3) this.settleAmp = 0;
    const noise = this.noise ? (Math.floor(Math.random() * 3) - 1) * c.division : 0;
    this.gross = F.roundToDivision(this.load + osc + noise - this.zeroOffset, c.division);
    this.hist.push(this.gross);
    cap(this.hist, Math.max(2, c.stableWindow));
    this.stable = this.hist.length >= Math.max(2, c.stableWindow) && this.hist.every((v) => v === this.gross);
  }

  get net() {
    return F.roundToDivision(this.gross - this.tare, this.config.division);
  }

  get overload() {
    return this.gross > this.config.capacity + 9 * this.config.division;
  }

  // ---------- ciclo ----------
  tick() {
    this.updateWeight();
    const c = this.config;
    const now = Date.now();
    if (this.message && now > this.messageUntil) this.message = '';

    // riarmo: scarico sotto soglia o fotocellula liberata
    if (!this.armedThreshold && this.gross <= c.threshold) this.armedThreshold = true;
    if (!this.armedPhotocell && !this.photocell) this.armedPhotocell = true;

    if (this.phase === 'PRONTO') {
      let trig = null;
      if (this.pending) {
        trig = this.pending;
        this.pending = null;
      } else if (c.triggerMode === 'soglia' && this.armedThreshold && this.gross > c.threshold && this.gross > 0) {
        trig = 'SOGLIA';
      } else if (c.triggerMode === 'input' && this.armedPhotocell && this.photocell) {
        trig = 'FOTOCELLULA';
      }
      if (trig) {
        this.trigger = trig;
        this.phase = 'ATTESA';
        this.waitStart = now;
      }
    } else if (this.phase === 'ATTESA') {
      const elapsed = (now - this.waitStart) / 100; // decimi
      const timedOut = c.stableTimeout > 0 && elapsed >= c.stableTimeout;
      if (this.stable || timedOut) this.validate(!this.stable);
    }

    this.emit('tick');
    if (this.listsDirty) {
      this.listsDirty = false;
      this.emit('lists');
    }
  }

  disarm() {
    this.armedThreshold = false;
    this.armedPhotocell = false;
  }

  endCycle() {
    this.phase = 'PRONTO';
    this.trigger = null;
    this.disarm();
  }

  validate(unstable) {
    const c = this.config;
    if (this.overload || this.gross <= 0) {
      this.showMessage('PESO NON VALIDO');
      return this.endCycle();
    }
    if (c.threshold > 0 && this.gross < c.threshold) {
      this.showMessage('PESO SOTTO SOGLIA');
      return this.endCycle();
    }
    const d = new Date();
    const rec = {
      date: F.fmtDate(d),
      time: F.fmtTime(d),
      prog: this.progressive,
      ...this.data,
      gross: this.gross,
      tare: this.tare,
      net: this.net,
      unstable,
    };
    if (this.opMode === 'MPP') this.executeMpp(rec);
    else this.executeStd(rec);
  }

  // ----- pesatura standard (senza MPP) -----
  executeStd(rec) {
    const c = this.config;
    const pr = this.printWeighing(rec);
    if (pr === 'abort') {
      this.showMessage('STAMPANTE IN AVARIA', 3000);
      this.log.warn('printer_fault', { when: 'pre-stampa', prog: rec.prog, action: 'pesata annullata', printer: this.printer });
      return this.endCycle();
    }

    this.phase = 'TRASMISSIONE';
    const payload = F.buildWeighString(rec, c);
    const jobs = [];
    for (const key of ['fom', 'pc']) {
      const ch = c[key];
      if (!ch.enabled) continue;
      jobs.push(
        this.channels.send(key, payload).then((r) => {
          this.logTx({ ch: key.toUpperCase(), kind: 'PESATA', ok: r.ok, reason: r.reason, attempts: r.attempts, clients: r.clients, payload });
          if (!r.ok) this.pulse(key, 500);
          return [key, r.ok];
        })
      );
    }

    Promise.all(jobs).then((results) => {
      const res = Object.fromEntries(results);
      const fomFailed = res.fom === false;
      const totalized = !(c.totalizeOnlyIfFomOk && fomFailed);
      this.log.info('weighing', {
        mode: 'STD', prog: rec.prog, gross: rec.gross, tare: rec.tare, net: rec.net,
        trigger: this.trigger, unstable: rec.unstable, print: pr, fom: res.fom ?? null, pc: res.pc ?? null, totalized,
      });
      if (totalized) {
        this.totals.count++;
        this.totals.net = F.roundToDivision(this.totals.net + rec.net, c.division);
      } else {
        this.showMessage('ERRORE TRASM FOM - NON TOTALIZZATO', 3000);
      }
      if (res.pc === false && !fomFailed) this.showMessage('ERRORE TRASM PC', 2500);
      else if (fomFailed && !c.totalizeOnlyIfFomOk) this.showMessage('ERRORE TRASM FOM', 2500);
      this.progressive++;
      this.saveState();
      this.endCycle();
    });
  }

  // Ritorna 'abort' se i controlli pre-stampa falliscono, altrimenti continua (anche con avaria post-stampa).
  printWeighing(rec) {
    const c = this.config;
    if (!c.printerPresent || !this.printerEnabled) return 'skip';
    const ok = this.printer.connected && this.printer.paper;
    if (c.printerPreCheck && !ok) {
      this.printerFault = true;
      return 'abort';
    }
    if (ok) {
      const lines = [];
      if (this.headerNeeded || c.ticketType === 'cartellino') {
        lines.push(...this.headerLines(rec));
        this.headerNeeded = false;
      }
      const u = F.fmtUnit(c);
      if (c.reducedPrint) {
        lines.push(`${String(rec.prog).padStart(6)}   ${F.fmtWeight(rec.net, c, 12)}${u}`);
      } else {
        lines.push(
          `N.PROG.  ${String(rec.prog).padStart(6)}  ${rec.time}`,
          `LORDO   ${F.fmtWeight(rec.gross, c, 12)}${u}`,
          `TARA    ${F.fmtWeight(rec.tare, c, 12)}${u}`,
          `NETTO   ${F.fmtWeight(rec.net, c, 12)}${u}`,
          ''
        );
      }
      if (c.ticketType === 'cartellino') lines.push('- - - - - - - - - - - - - -', '');
      this.print(lines);
    }
    // controlli sempre eseguiti al termine della stampa
    this.printerFault = !ok;
    if (!ok) {
      this.showMessage('STAMPANTE IN AVARIA', 3000);
      this.log.warn('printer_fault', { when: 'post-stampa', prog: rec.prog, action: 'pesata proseguita', printer: this.printer });
    }
    return ok ? 'printed' : 'fault';
  }

  headerLines(rec) {
    const l = ['==========================', `DATA ${rec.date}  ORA ${rec.time.slice(0, 5)}`];
    if (Number(rec.code) !== 0) l.push(`COD.MERCE ${String(rec.code).padStart(6, '0')}`, `${rec.desc}`);
    if (String(rec.cgen).trim()) l.push(`COD.GEN.  ${rec.cgen}`);
    l.push('--------------------------', 'N.PROG.            NETTO', '--------------------------');
    return l;
  }

  // ----- pesatura con MPP: archivio + stringa a PC con codice MPP e peso -----
  executeMpp(rec) {
    const c = this.config;
    this.phase = 'TRASMISSIONE';
    const entry = { n: this.mppArchive.length + 1, ...rec, tx: c.pc.enabled ? '...' : '-' };
    this.mppArchive.push(entry);
    cap(this.mppArchive, 5000);
    this.listsDirty = true;

    const done = (pc) => {
      this.log.info('weighing', {
        mode: 'MPP', prog: rec.prog, mpp: rec.mpp, gross: rec.gross, tare: rec.tare, net: rec.net,
        trigger: this.trigger, unstable: rec.unstable, pc,
      });
      this.progressive++;
      this.saveState();
      this.endCycle();
    };
    if (!c.pc.enabled) return done(null);

    const payload = F.fillTemplate(c.mppTemplate, rec, c);
    this.channels.send('pc', payload).then((r) => {
      entry.tx = r.ok ? 'OK' : r.reason;
      this.logTx({ ch: 'PC', kind: 'MPP', ok: r.ok, reason: r.reason, attempts: r.attempts, clients: r.clients, payload });
      if (!r.ok) {
        this.pulse('pc', 1000);
        this.showMessage('ERRORE TRASM PC', 2500);
      }
      done(r.ok);
    });
  }

  pulse(key, ms) {
    if (this.config.errorOutputs) this.outUntil[key] = Date.now() + ms;
  }

  // ---------- comandi dall'interfaccia ----------
  command(name, args) {
    const fn = this['cmd_' + name];
    if (typeof fn === 'function') fn.call(this, args);
  }

  cmd_setLoad(v) {
    const n = Math.max(-this.config.capacity, Math.min(this.config.capacity * 1.2, Number(v) || 0));
    this.settleAmp = Math.min(this.settleAmp + Math.abs(n - this.load) * 0.15, this.config.capacity * 0.05);
    this.load = n;
  }
  cmd_setNoise(v) {
    this.noise = !!v;
  }
  cmd_zero() {
    if (Math.abs(this.gross) <= this.config.capacity * 0.02) {
      this.zeroOffset += this.gross;
      this.hist = [];
    } else this.showMessage('ZERO FUORI CAMPO');
  }
  cmd_tare() {
    if (this.gross > 0 && this.stable) this.tare = this.gross;
    else if (this.gross <= 0) this.tare = 0;
    else this.showMessage('PESO NON STABILE');
  }
  cmd_printKey() {
    if (this.phase === 'PRONTO') this.pending = 'TASTO';
  }
  cmd_printInput() {
    if (this.config.triggerMode !== 'input') return this.showMessage('INPUT NON ABILITATO (MODO SOGLIA)');
    if (this.phase === 'PRONTO') this.pending = 'INPUT';
  }
  cmd_photocell(v) {
    this.photocell = !!v;
  }
  cmd_endBatch() {
    const c = this.config;
    if (!c.endBatchInput) return this.showMessage('INPUT FINE PARTITA NON ABILITATO');
    if (this.phase !== 'PRONTO') return this.showMessage('PESATA IN CORSO');
    const d = new Date();
    const rec = { date: F.fmtDate(d), time: F.fmtTime(d), prog: this.progressive, ...this.data, gross: 0, tare: 0, net: 0 };
    const extra = {
      npesate: String(this.totals.count).padStart(6),
      totnetto: F.fmtWeight(this.totals.net, c, 12) + F.fmtUnit(c),
    };
    this.log.info('end_batch', { lastProg: this.progressive, count: this.totals.count, net: this.totals.net, resetProg: c.resetProgOnEndBatch });
    if (c.resetProgOnEndBatch) this.progressive = 1;
    this.headerNeeded = true;
    this.showMessage('FINE PARTITA');
    this.saveState();
    if (c.pc.enabled) {
      const payload = F.fillTemplate(c.endBatchTemplate, rec, c, extra);
      // l'esito non influisce sull'operazione
      this.channels.send('pc', payload, { ackNak: c.endBatchAckNak }).then((r) =>
        this.logTx({ ch: 'PC', kind: 'FINE PARTITA', ok: r.ok, reason: r.reason, attempts: r.attempts, clients: r.clients, payload })
      );
    }
  }
  cmd_printTotals() {
    const c = this.config;
    if (!c.printerPresent || !this.printerEnabled) return this.showMessage('STAMPANTE DISABILITATA');
    if (!(this.printer.connected && this.printer.paper)) {
      this.printerFault = true;
      this.log.warn('printer_fault', { when: 'stampa totali', printer: this.printer });
      return this.showMessage('STAMPANTE IN AVARIA', 3000);
    }
    const d = new Date();
    this.print([
      '==========================',
      '        *** TOTALI ***',
      `DATA ${F.fmtDate(d)}  ORA ${F.fmtTime(d).slice(0, 5)}`,
      `N. PESATE     ${String(this.totals.count).padStart(8)}`,
      `TOT. NETTO ${F.fmtWeight(this.totals.net, c, 10)}${F.fmtUnit(c)}`,
      '==========================',
      '',
    ]);
    this.headerNeeded = true;
    if (c.clearTotalsAfterPrint) this.totals = { count: 0, net: 0 };
    this.saveState();
  }
  cmd_togglePrinter() {
    this.printerEnabled = !this.printerEnabled;
    this.showMessage(this.printerEnabled ? 'STAMPANTE ABILITATA' : 'STAMPANTE DISABILITATA', 1500);
    this.saveState();
  }
  cmd_toggleMode() {
    if (this.phase !== 'PRONTO') return;
    this.opMode = this.opMode === 'MPP' ? 'STD' : 'MPP';
    this.showMessage(`FUNZIONAMENTO ${this.opMode}`, 1500);
    this.saveState();
  }
  cmd_setPrinterStatus(s) {
    Object.assign(this.printer, s);
    if (this.printer.connected && this.printer.paper) this.printerFault = false;
  }
  cmd_setData(d) {
    Object.assign(this.data, d);
    this.saveState();
  }
  cmd_setProgressive(n) {
    this.progressive = Math.max(1, Math.min(999999, Number(n) || 1));
    this.saveState();
  }
  cmd_resetTotals() {
    this.totals = { count: 0, net: 0 };
    this.saveState();
  }
  cmd_clearPrinter() {
    this.printerOut = [];
    this.listsDirty = true;
  }
  cmd_clearLogs() {
    this.txLog = [];
    this.rxLog = [];
    this.listsDirty = true;
  }
  cmd_clearMpp() {
    this.mppArchive = [];
    this.listsDirty = true;
    this.saveState();
  }
  cmd_updateConfig(cfg) {
    const old = this.config;
    this.config = mergeKnown(DEFAULT_CONFIG, cfg);
    if (this.tare && old.division !== this.config.division) this.tare = 0;
    try {
      writeJsonSync(this.cfgFile, this.config);
    } catch (e) {
      this.log.error('storage_write_failed', { file: this.cfgFile, ...errorInfo(e) });
    }
    const changed = Object.keys(this.config).filter((k) => JSON.stringify(old[k]) !== JSON.stringify(this.config[k]));
    this.log.info('config_updated', { changed });
    this.channels.reconfigure(this.config);
    this.emit('config');
    this.showMessage('SETUP SALVATO', 1500);
  }
  cmd_receiver({ index, action, reply }) {
    const r = this.receivers[index];
    if (!r) return;
    const rc = this.config.receivers[index];
    clearTimeout(this.retryTimers[index]);
    if (action === 'start') r.start(rc);
    else if (action === 'stop') r.stop();
    else if (action === 'reply') {
      rc.reply = reply;
      r.setReply(reply);
      this.emit('config');
    }
    this.listsDirty = true;
  }

  // ---------- stato per l'interfaccia ----------
  getState() {
    const now = Date.now();
    return {
      gross: this.gross,
      tare: this.tare,
      net: this.net,
      load: this.load,
      noise: this.noise,
      stable: this.stable,
      overload: this.overload,
      phase: this.phase,
      trigger: this.trigger,
      waitElapsed: this.phase === 'ATTESA' ? Math.floor((now - this.waitStart) / 100) : 0,
      message: this.message,
      outputs: { fom: now < this.outUntil.fom, pc: now < this.outUntil.pc },
      opMode: this.opMode,
      printerEnabled: this.printerEnabled,
      printer: this.printer,
      printerFault: this.printerFault,
      progressive: this.progressive,
      totals: this.totals,
      data: this.data,
      photocell: this.photocell,
      armed: this.config.triggerMode === 'soglia' ? this.armedThreshold : this.armedPhotocell,
      channels: this.channels.status(),
    };
  }

  getLists() {
    return {
      printerOut: this.printerOut,
      txLog: this.txLog.slice(-100),
      rxLog: this.rxLog.slice(-100),
      mppArchive: this.mppArchive.slice(-300),
      receivers: this.receivers.map((r) => ({ status: r.status, running: r.running })),
    };
  }
}
