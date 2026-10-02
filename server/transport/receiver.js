// Ricevitore di test: simula il PC o il FOM in ascolto e risponde ACK / NAK / niente.
import net from 'node:net';
import dgram from 'node:dgram';
import { EventEmitter } from 'node:events';
import { ACK, NAK } from './net.js';

export class TestReceiver extends EventEmitter {
  constructor() {
    super();
    this.server = null;
    this.status = 'FERMO';
    this.opts = null;
  }

  get running() {
    return !!this.server;
  }

  replyByte() {
    const r = this.opts?.reply;
    return r === 'ack' ? Buffer.from([ACK]) : r === 'nak' ? Buffer.from([NAK]) : null;
  }

  start(opts) {
    this.stop();
    this.opts = { ...opts };
    const port = Number(opts.port);
    if (opts.proto === 'udp') {
      const s = dgram.createSocket('udp4');
      s.on('message', (buf, rinfo) => {
        this.emit('message', { from: `${rinfo.address}:${rinfo.port}`, data: buf.toString('latin1') });
        const b = this.replyByte();
        if (b) s.send(b, rinfo.port, rinfo.address);
      });
      s.on('error', (e) => this.fail(e));
      s.bind(port, () => this.setStatus(`IN ASCOLTO UDP ${port}`));
      this.server = s;
    } else {
      const s = net.createServer((sock) => {
        const from = `${sock.remoteAddress}:${sock.remotePort}`;
        let buf = '';
        sock.on('data', (chunk) => {
          buf += chunk.toString('latin1');
          let i;
          while ((i = buf.indexOf('\r')) >= 0) {
            const msg = buf.slice(0, i + 1);
            buf = buf.slice(i + 1);
            this.emit('message', { from, data: msg });
            const b = this.replyByte();
            if (b) sock.write(b);
          }
        });
        sock.on('end', () => {
          if (buf) this.emit('message', { from, data: buf });
          buf = '';
        });
        sock.on('error', () => {});
      });
      s.on('error', (e) => this.fail(e));
      s.listen(port, () => this.setStatus(`IN ASCOLTO TCP ${port}`));
      this.server = s;
    }
  }

  setReply(reply) {
    if (this.opts) this.opts.reply = reply;
  }

  // Evento 'failure' (non 'error', che senza ascoltatori farebbe terminare il processo).
  fail(e) {
    this.stop();
    this.setStatus(`ERRORE: ${e.code || e.message}`);
    this.emit('failure', e);
  }

  stop() {
    if (this.server) {
      try {
        this.server.close();
      } catch {}
      this.server = null;
      this.setStatus('FERMO');
    }
  }

  setStatus(s) {
    this.status = s;
    this.emit('status', s);
  }
}
