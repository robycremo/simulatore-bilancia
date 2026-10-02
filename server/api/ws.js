// Livello WebSocket: Origin, dimensione messaggi, numero connessioni, token, validazione, rate limiting.
import { WebSocketServer } from 'ws';
import { isLoopbackAddress } from '../config/env.js';
import { tokenMatches } from './auth.js';
import { validateCommand } from './validate.js';
import { RateLimiter } from './rateLimit.js';

export const MAX_MESSAGE_BYTES = 16 * 1024;
export const MAX_CONNECTIONS = 10;
export const CLOSE_AUTH = 4401;
const AUTH_TIMEOUT_MS = 30_000;

function rejectUpgrade(socket, code, text) {
  socket.end(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // client non browser: soggetti comunque al token se remoti
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export function attachWs({ server, engine, logger, token, maxConnections = MAX_CONNECTIONS, limiterOptions }) {
  // Il limite di protocollo è più alto di quello applicativo, così il client riceve un errore invece di
  // una disconnessione per i messaggi tra 16 KB e 1 MB.
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

  server.on('upgrade', (req, socket, head) => {
    const ip = req.socket.remoteAddress;
    if (new URL(req.url, 'http://localhost').pathname !== '/ws') return rejectUpgrade(socket, 404, 'Not Found');
    if (!originAllowed(req)) {
      logger.warn('ws_origin_rejected', { ip, origin: req.headers.origin });
      return rejectUpgrade(socket, 403, 'Forbidden');
    }
    if (wss.clients.size >= maxConnections) {
      logger.warn('ws_too_many_connections', { ip, max: maxConnections });
      return rejectUpgrade(socket, 503, 'Service Unavailable');
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  const send = (ws, obj) => ws.readyState === 1 && ws.send(JSON.stringify(obj));
  const sendInitial = (ws) => {
    send(ws, { type: 'config', config: engine.config });
    send(ws, { type: 'lists', lists: engine.getLists() });
  };

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    ws.authed = isLoopbackAddress(ip);
    const limiter = new RateLimiter(limiterOptions);
    logger.info('ws_connect', { ip, local: ws.authed });

    let authTimer;
    if (ws.authed) sendInitial(ws);
    else {
      send(ws, { type: 'authRequired' });
      authTimer = setTimeout(() => ws.close(CLOSE_AUTH, 'autenticazione mancante'), AUTH_TIMEOUT_MS);
    }

    const reject = (message, fields = {}) => {
      logger.warn('command_rejected', { ip, error: message, ...fields });
      send(ws, { type: 'error', message });
    };

    ws.on('message', (raw) => {
      const r = limiter.take();
      if (!r.allowed) {
        if (r.close) {
          logger.warn('rate_limit_close', { ip });
          return ws.close(1008, 'troppi comandi');
        }
        if (r.notify) {
          logger.warn('rate_limited', { ip });
          send(ws, { type: 'error', message: 'Troppi comandi: alcuni sono stati ignorati' });
        }
        return;
      }
      if (raw.length > MAX_MESSAGE_BYTES) return reject(`Messaggio troppo grande (max ${MAX_MESSAGE_BYTES / 1024} KB)`);

      let m;
      try {
        m = JSON.parse(raw);
      } catch {
        return reject('Messaggio non JSON');
      }

      if (!ws.authed) {
        if (m?.type === 'auth' && tokenMatches(m.token, token)) {
          clearTimeout(authTimer);
          ws.authed = true;
          logger.info('auth_ok', { ip });
          send(ws, { type: 'authOk' });
          return sendInitial(ws);
        }
        logger.warn('auth_denied', { ip, via: 'ws' });
        return ws.close(CLOSE_AUTH, 'token non valido');
      }

      if (m?.type !== 'cmd') return reject('Messaggio non riconosciuto');
      const v = validateCommand(m.cmd, m.args, { config: engine.config });
      if (!v.ok) return reject(`Comando rifiutato: ${v.error}`, { cmd: String(m.cmd).slice(0, 40) });
      engine.command(m.cmd, v.value);
    });

    ws.on('close', (code) => {
      clearTimeout(authTimer);
      logger.info('ws_disconnect', { ip, code });
    });
    ws.on('error', () => {});
  });

  const broadcast = (obj) => {
    const s = JSON.stringify(obj);
    for (const c of wss.clients) if (c.authed && c.readyState === 1) c.send(s);
  };

  const close = () => {
    for (const c of wss.clients) c.terminate();
    wss.close();
  };

  return { wss, broadcast, close };
}
