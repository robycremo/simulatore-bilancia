// Trasmissione delle stringhe su IP (TCP client o UDP), con protocollo ACK/NAK opzionale.
import net from 'node:net';
import dgram from 'node:dgram';

export const ACK = 0x06;
export const NAK = 0x15;

function evalReply(buf) {
  if (buf.includes(ACK)) return { ok: true, reason: 'ACK' };
  if (buf.includes(NAK)) return { ok: false, reason: 'NAK' };
  return { ok: false, reason: 'RISPOSTA NON VALIDA' };
}

function sendTcp(ch, payload, ackNak) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sock.destroy();
      resolve(r);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: ackNak ? 'TIMEOUT ACK' : 'TIMEOUT' }), ch.timeoutMs);
    const sock = net.createConnection({ host: ch.host, port: Number(ch.port) });
    sock.on('connect', () => {
      sock.write(Buffer.from(payload, 'latin1'), () => {
        if (!ackNak) finish({ ok: true, reason: 'INVIATO' });
      });
    });
    sock.on('data', (buf) => ackNak && finish(evalReply(buf)));
    sock.on('error', (e) => finish({ ok: false, reason: e.code || e.message }));
    sock.on('close', () => finish({ ok: false, reason: 'CONNESSIONE CHIUSA' }));
  });
}

function sendUdp(ch, payload, ackNak) {
  return new Promise((resolve) => {
    let done = false;
    const sock = dgram.createSocket('udp4');
    const finish = (r) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sock.close();
      resolve(r);
    };
    const timer = setTimeout(() => finish({ ok: false, reason: 'TIMEOUT ACK' }), ch.timeoutMs);
    sock.on('message', (buf) => ackNak && finish(evalReply(buf)));
    sock.on('error', (e) => finish({ ok: false, reason: e.code || e.message }));
    sock.send(Buffer.from(payload, 'latin1'), Number(ch.port), ch.host, (err) => {
      if (err) finish({ ok: false, reason: err.code || err.message });
      else if (!ackNak) finish({ ok: true, reason: 'INVIATO' });
    });
  });
}

// Con ACK/NAK la stringa viene ritrasmessa (fino a `retries` volte) se arriva NAK o nessuna risposta.
export async function transmit(ch, payload, ackNak = ch.ackNak) {
  const tries = ackNak ? Math.max(1, Number(ch.retries) || 1) : 1;
  let r;
  for (let i = 1; i <= tries; i++) {
    r = await (ch.proto === 'udp' ? sendUdp : sendTcp)(ch, payload, ackNak);
    r.attempts = i;
    if (r.ok || !['NAK', 'TIMEOUT ACK', 'RISPOSTA NON VALIDA'].includes(r.reason)) break;
  }
  return r;
}
